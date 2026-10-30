import { Router } from "express";
import { Cat } from "@bdelab/jscat";
import { ENT_SUBJECT, ENT_PAIR, ENT_SUBJECTS, type EntQuestion, type EntSubject } from "../../shared/ent";
import { bktMastery, calibratedB, eap, expectedPoints, sameAnswer, type Response } from "../../shared/irt";
import { requireStudent, type UserRow } from "../auth";
import { addXp, all, id, one, run } from "../db";
import { HttpError, must, num, str, wrap } from "../http";
import { entMasterGenerate, type EntMasterDraft } from "../ai";
import { reviewResult } from "../review";

// ENT master mode: computerized adaptive testing on item response theory.
// - Items: hard typed-answer problems written by the AI (level C/D) plus bank questions whose answer is short enough
//   to be typed instead of chosen. Typing removes guessing (c ≈ 0), so every answer says much more about the student.
// - Difficulty b of each item starts from its specification level and is recalibrated from all students' answers.
// - Ability θ per subject: EAP over this mode's answers and the student's regular ENT practice (multiple choice, c = 0.25).
// - The next item maximizes Fisher information at the current θ (jsCAT, MFI) among items not seen yet.
// - Forecast: expected ENT points of the subject's real block at θ, with a 90 % interval from θ ± 1.645·SE.
// - Knowledge map: Bayesian knowledge tracing per topic over every ENT answer of the student.

export const entMasterRouter = Router();

interface MasterItem {
  id: string;
  subject: string;
  topic: string;
  stem: string;
  passage?: string;
  accept: string[];
  unit: string;
  solution: string;
  level: "A" | "B" | "C" | "D";
}

/** A bank question can be typed when its stem does not refer to the options and the right option is short. */
const typable = (q: EntQuestion) =>
  q.type === "single" && !q.groupId && !/вариант|из перечисленн|какое из|какой из|какая из|какие из|выберите|укажите неверн|нұсқа|which of/i.test(q.stem) && (q.options[q.answer as number] ?? "").length <= 28;

async function pool(subject: EntSubject, lang: string): Promise<MasterItem[]> {
  const master = await all<{ id: string; topic: string; data: string }>("SELECT id, topic, data FROM ent_master_items WHERE subject = ? AND lang = ?", subject.id, lang);
  const bank = await all<{ data: string }>("SELECT data FROM ent_questions WHERE subject = ? AND lang = ? AND type = 'single'", subject.id, lang);
  return [
    ...master.map((m) => {
      const d = JSON.parse(m.data) as EntMasterDraft;
      return { id: m.id, subject: subject.id, topic: m.topic, stem: d.stem, accept: d.accept, unit: d.unit, solution: d.solution, level: d.level };
    }),
    ...bank
      .map((r) => JSON.parse(r.data) as EntQuestion)
      .filter(typable)
      .map((q) => ({ id: `t:${q.id}`, subject: subject.id, topic: q.topic, stem: q.stem, accept: [q.options[q.answer as number]!], unit: "", solution: q.explanation, level: q.difficulty })),
  ];
}

async function calibration(ids: string[]) {
  if (!ids.length) return new Map<string, { n: number; right: number }>();
  const rows = await all<{ item_id: string; n: number; right: number }>(
    `SELECT item_id, COUNT(*) n, SUM(correct) "right" FROM ent_master_resp WHERE item_id IN (${ids.map(() => "?").join(",")}) GROUP BY item_id`,
    ...ids,
  );
  return new Map(rows.map((r) => [r.item_id, { n: r.n, right: r.right ?? 0 }]));
}

const bOf = (it: MasterItem, cal: Map<string, { n: number; right: number }>) => calibratedB(it.level, cal.get(it.id)?.n ?? 0, cal.get(it.id)?.right ?? 0, 0.02);

/** Everything the student answered in this subject, as IRT responses and as BKT sequences per topic. */
async function history(u: UserRow, subject: EntSubject) {
  const typed = await all<{ item_id: string; topic: string; correct: number; at: number; data: string | null; qdata: string | null }>(
    `SELECT r.item_id, r.topic, r.correct, r.at, m.data, q.data qdata FROM ent_master_resp r
     LEFT JOIN ent_master_items m ON m.id = r.item_id
     LEFT JOIN ent_questions q ON q.id = substr(r.item_id, 3)
     WHERE r.user_id = ? AND r.subject = ? ORDER BY r.at`,
    u.id,
    subject.id,
  );
  const choice = await all<{ item_id: string; skill: string; correct: number; at: number; data: string | null }>(
    "SELECT a.item_id, a.skill, a.correct, a.at, q.data FROM attempts a LEFT JOIN ent_questions q ON q.id = a.item_id WHERE a.user_id = ? AND a.module = 'ent' AND a.skill LIKE ? ORDER BY a.at DESC LIMIT 400",
    u.id,
    `${subject.id}:%`,
  );
  const cal = await calibration(typed.map((t) => t.item_id));
  const responses: Response[] = [];
  const events: { topic: string; correct: boolean; typed: boolean; at: number }[] = [];
  for (const t of typed) {
    const level = (t.data ? (JSON.parse(t.data) as EntMasterDraft).level : t.qdata ? (JSON.parse(t.qdata) as EntQuestion).difficulty : "C") as MasterItem["level"];
    const c = cal.get(t.item_id);
    responses.push({ a: 1.2, b: calibratedB(level, c?.n ?? 0, c?.right ?? 0, 0.02), c: 0.02, correct: !!t.correct });
    events.push({ topic: t.topic, correct: !!t.correct, typed: true, at: t.at });
  }
  for (const a of choice) {
    const q = a.data ? (JSON.parse(a.data) as EntQuestion) : null;
    const twoPoint = q && (q.type === "multi" || q.type === "match");
    responses.push({ a: 1, b: { A: -1, B: 0, C: 1 }[q?.difficulty ?? "B"], c: twoPoint ? 0.05 : 0.25, correct: !!a.correct });
    events.push({ topic: a.skill.split(":").slice(1).join(":"), correct: !!a.correct, typed: false, at: a.at });
  }
  events.sort((x, y) => x.at - y.at);
  return { responses, events, typedCount: typed.length, seen: new Set(typed.map((t) => t.item_id)) };
}

function stateOf(subject: EntSubject, h: Awaited<ReturnType<typeof history>>) {
  const { theta, se } = eap(h.responses);
  const pts = (t: number) => Math.min(subject.max, expectedPoints(t, subject.plan));
  const topics = subject.topics.map((topic) => {
    const ev = h.events.filter((e) => e.topic === topic);
    return { topic, n: ev.length, mastery: ev.length ? Math.round(bktMastery(ev) * 100) : null };
  });
  return {
    subject: subject.id,
    name: subject.name,
    theta: Math.round(theta * 100) / 100,
    se: Math.round(se * 100) / 100,
    answers: h.responses.length,
    typed: h.typedCount,
    forecast: { points: Math.round(pts(theta)), lo: Math.round(pts(theta - 1.645 * se)), hi: Math.round(pts(theta + 1.645 * se)), max: subject.max, threshold: subject.threshold },
    topics,
  };
}

async function subjectFor(u: UserRow, raw: unknown) {
  const s = must(ENT_SUBJECT[str(raw, 40)], 404, "Предмет не найден");
  const p = await one<{ lang: string }>("SELECT lang FROM ent_profiles WHERE user_id = ?", u.id);
  return { subject: s, lang: s.fixedLang ?? p?.lang ?? "ru" };
}

entMasterRouter.post(
  "/next",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const { subject, lang } = await subjectFor(u, req.body?.subject);
    const h = await history(u, subject);
    let items = (await pool(subject, lang)).filter((x) => !h.seen.has(x.id));
    const state = stateOf(subject, h);
    // Keep a stock of hard problems on the student's weakest topics (unknown topics count as weak).
    if (items.filter((x) => x.id.startsWith("m-")).length < 4) {
      const weak = [...state.topics].sort((a, b) => (a.mastery ?? 30) - (b.mastery ?? 30))[Math.floor(Math.random() * 3)]?.topic ?? subject.topics[0]!;
      const made = await entMasterGenerate(subject, weak, 6, lang).catch((e) => {
        console.error("master generate", e);
        return [];
      });
      for (const d of made) await run("INSERT INTO ent_master_items (id, subject, topic, lang, data, created_at) VALUES (?, ?, ?, ?, ?, ?)", `m-${id()}`, subject.id, weak, lang, JSON.stringify(d), Date.now());
      items = (await pool(subject, lang)).filter((x) => !h.seen.has(x.id));
    }
    if (!items.length) throw new HttpError(503, "Задания для этого предмета ещё готовятся. Попробуйте через минуту");
    const cal = await calibration(items.map((x) => x.id));
    // Content balancing, as in real adaptive exams: candidates come from the topics this student has answered least,
    // then jsCAT picks the most informative of them (maximum Fisher information at the current θ).
    const used = new Map<string, number>();
    for (const e of h.events) used.set(e.topic, (used.get(e.topic) ?? 0) + 1);
    const byTopic = new Map<string, MasterItem[]>();
    for (const x of items) byTopic.set(x.topic, [...(byTopic.get(x.topic) ?? []), x]);
    const candidates: MasterItem[] = [];
    for (const t of [...byTopic.keys()].sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0) || Math.random() - 0.5)) {
      candidates.push(...byTopic.get(t)!);
      if (candidates.length >= 8) break;
    }
    const cat = new Cat({ method: "EAP", itemSelect: "MFI", theta: state.theta, minTheta: -4, maxTheta: 4 });
    const stimuli = candidates.map((x) => ({ a: 1.2, b: bOf(x, cal), c: 0.02, d: 1, id: x.id }));
    const pick = cat.findNextItem(stimuli as never).nextStimulus as unknown as { id: string; b: number; difficulty?: number };
    const it = items.find((x) => x.id === pick.id)!;
    res.json({ item: { id: it.id, topic: it.topic, stem: it.stem, unit: it.unit, level: it.level, b: Math.round(bOf(it, cal) * 100) / 100 }, state });
  }),
);

entMasterRouter.post(
  "/answer",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const { subject, lang } = await subjectFor(u, req.body?.subject);
    const itemId = str(req.body?.id, 60);
    const it = must(
      (await pool(subject, lang)).find((x) => x.id === itemId),
      404,
      "Задание не найдено",
    );
    if (await one("SELECT 1 FROM ent_master_resp WHERE user_id = ? AND item_id = ?", u.id, it.id)) throw new HttpError(409, "Это задание уже решено");
    const given = str(req.body?.answer, 200);
    const correct = sameAnswer(given, it.accept);
    await run(
      "INSERT INTO ent_master_resp (user_id, item_id, subject, topic, correct, given, ms, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      u.id,
      it.id,
      subject.id,
      it.topic,
      correct ? 1 : 0,
      given,
      Math.max(0, Math.min(num(req.body?.ms, 0), 3_600_000)),
      Date.now(),
    );
    if (it.id.startsWith("t:")) await reviewResult(u.id, "ent", it.id.slice(2), correct);
    if (correct) await addXp(u.id, it.level === "D" ? 8 : it.level === "C" ? 5 : 3, "ent");
    res.json({ correct, accept: it.accept, unit: it.unit, solution: it.solution, state: stateOf(subject, await history(u, subject)) });
  }),
);

/** The student's knowledge model: every subject of their ENT, ability, forecast and topic mastery. */
entMasterRouter.get(
  "/model",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const p = await one<{ pair: string }>("SELECT pair FROM ent_profiles WHERE user_id = ?", u.id);
    const ids = [...ENT_SUBJECTS.filter((s) => s.kind === "mandatory").map((s) => s.id), ...(p ? (ENT_PAIR[p.pair]?.subjects ?? []) : [])];
    const subjects = await Promise.all(ids.map(async (sid) => stateOf(ENT_SUBJECT[sid]!, await history(u, ENT_SUBJECT[sid]!))));
    const total = subjects.reduce((a, s) => ({ points: a.points + s.forecast.points, lo: a.lo + s.forecast.lo, hi: a.hi + s.forecast.hi }), { points: 0, lo: 0, hi: 0 });
    res.json({ subjects, total, max: subjects.reduce((a, s) => a + s.forecast.max, 0) });
  }),
);
