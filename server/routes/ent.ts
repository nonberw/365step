import { Router } from "express";
import {
  ENT_MANDATORY,
  ENT_MAX,
  ENT_PAIR,
  ENT_PAIRS,
  ENT_RESOURCES,
  ENT_SESSIONS_2026,
  ENT_SUBJECT,
  ENT_SUBJECTS,
  ENT_THRESHOLDS,
  entMinutes,
  entPoints,
  entScore,
  type EntAnswer,
  type EntLang,
  type EntQuestion,
  type EntQuestionPublic,
  type EntSubject,
  type EntType,
} from "../../shared/ent";
import { requireStudent, requireTeacher, type UserRow } from "../auth";
import { addXp, all, getCache, id, one, run, setCache } from "../db";
import { HttpError, must, str, wrap } from "../http";
import { entExplain, entGenerate, entPlan, type EntPlan } from "../ai";
import { reviewResult } from "../review";

// ЕНТ preparation: practice by subject and topic, full 240-minute mock tests in the ENT format
// and mini-tests for one subject. All questions are original (AI-written to the public НЦТ format)
// and stay in the bank, so every new test makes the bank bigger.

export const entRouter = Router();

const TYPES: EntType[] = ["single", "context", "multi", "match"];
const BATCH: Record<EntType, number> = { single: 10, context: 10, multi: 5, match: 5 };

const langFor = (s: EntSubject, lang: EntLang) => s.fixedLang ?? lang;
const toPublic = ({ answer: _a, explanation: _e, ...q }: EntQuestion): EntQuestionPublic => q;
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;
const shuffle = <T>(xs: T[]) =>
  xs
    .map((x) => [Math.random(), x] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, x]) => x);

async function profileOf(u: UserRow) {
  return one<{ pair: string; lang: EntLang; target: number | null }>("SELECT pair, lang, target FROM ent_profiles WHERE user_id = ?", u.id);
}

async function bankCount(subject: string, lang: string, type: EntType) {
  return (await one<{ n: number }>("SELECT COUNT(*) n FROM ent_questions WHERE subject = ? AND lang = ? AND type = ?", subject, lang, type))?.n ?? 0;
}

export async function store(items: Omit<EntQuestion, "id">[]) {
  const saved: EntQuestion[] = [];
  for (const q of items) {
    const full = { ...q, id: `ent-${id(6)}` } as EntQuestion;
    await run(
      "INSERT INTO ent_questions (id, subject, topic, type, lang, group_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      full.id,
      q.subject,
      q.topic,
      q.type,
      q.lang,
      q.groupId ?? null,
      JSON.stringify(full),
      Date.now(),
    );
    saved.push(full);
  }
  return saved;
}

/** Makes sure the bank has at least `need` questions of this kind, writing new ones with Claude in parallel. */
export async function fill(subject: EntSubject, lang: string, type: EntType, need: number, topic?: string) {
  const have = await bankCount(subject.id, lang, type);
  let missing = need - have;
  for (let round = 0; missing > 0 && round < 2; round++) {
    const calls = Math.ceil(missing / BATCH[type]);
    const results = await Promise.all(
      Array.from({ length: calls }, () =>
        entGenerate(subject, topic ?? pick(subject.topics), type, BATCH[type], lang as EntLang).catch((err) => {
          console.error("ent generate", subject.id, type, err);
          return [];
        }),
      ),
    );
    const saved = await store(results.flat());
    missing -= saved.length;
  }
}

async function loadQuestions(ids: string[]) {
  if (!ids.length) return new Map<string, EntQuestion>();
  const rows = await all<{ data: string }>(`SELECT data FROM ent_questions WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids);
  return new Map(rows.map((r) => [JSON.parse(r.data).id as string, JSON.parse(r.data) as EntQuestion]));
}

/** Picks questions for one block, preferring ones the student has not seen yet. */
async function pickBlock(u: UserRow, subject: EntSubject, lang: string): Promise<string[]> {
  const seen = new Set((await all<{ item_id: string }>("SELECT item_id FROM attempts WHERE user_id = ? AND module = 'ent'", u.id)).map((r) => r.item_id));
  const ids: string[] = [];
  for (const part of subject.plan) {
    const rows = await all<{ id: string; group_id: string | null }>("SELECT id, group_id FROM ent_questions WHERE subject = ? AND lang = ? AND type = ?", subject.id, lang, part.type);
    if (part.type === "context") {
      const groups = new Map<string, string[]>();
      for (const r of rows) groups.set(r.group_id ?? r.id, [...(groups.get(r.group_id ?? r.id) ?? []), r.id]);
      const full = [...groups.values()].filter((g) => g.length >= 5);
      const ordered = [...shuffle(full.filter((g) => !g.some((x) => seen.has(x)))), ...shuffle(full.filter((g) => g.some((x) => seen.has(x))))];
      const take: string[] = [];
      for (const g of ordered) {
        if (take.length >= part.count) break;
        take.push(...g.slice(0, Math.min(5, part.count - take.length)));
      }
      ids.push(...take);
    } else {
      const fresh = shuffle(rows.filter((r) => !seen.has(r.id)));
      const old = shuffle(rows.filter((r) => seen.has(r.id)));
      ids.push(...[...fresh, ...old].slice(0, part.count).map((r) => r.id));
    }
  }
  return ids;
}

async function buildBlock(u: UserRow, subject: EntSubject, lang: string) {
  await Promise.all(subject.plan.map((p) => fill(subject, lang, p.type, p.count)));
  return pickBlock(u, subject, lang);
}

// ---------- overview ----------

entRouter.get(
  "/meta",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const profile = await profileOf(u);
    const stats = await all<{ skill: string; total: number; ok: number }>("SELECT skill, COUNT(*) total, SUM(correct) ok FROM attempts WHERE user_id = ? AND module = 'ent' GROUP BY skill", u.id);
    const bySubject = new Map<string, { total: number; right: number }>();
    for (const s of stats) {
      const subject = s.skill.split(":")[0]!;
      const cur = bySubject.get(subject) ?? { total: 0, right: 0 };
      bySubject.set(subject, { total: cur.total + s.total, right: cur.right + (s.ok ?? 0) });
    }
    const tests = await all<{ id: string; kind: string; subjects: string; started_at: number; finished_at: number | null; result: string | null }>(
      "SELECT id, kind, subjects, started_at, finished_at, result FROM ent_tests WHERE user_id = ? ORDER BY started_at DESC LIMIT 12",
      u.id,
    );
    res.json({
      profile: profile ?? null,
      subjects: ENT_SUBJECTS.map(({ id, name, kind, count, max, topics, threshold, icon, plan }) => ({ id, name, kind, count, max, topics, threshold, icon, plan })),
      pairs: ENT_PAIRS,
      thresholds: ENT_THRESHOLDS,
      resources: ENT_RESOURCES,
      sessions: ENT_SESSIONS_2026,
      stats: Object.fromEntries(bySubject),
      topicStats: Object.fromEntries(stats.map((s) => [s.skill, { total: s.total, right: s.ok ?? 0 }])),
      tests: tests.map((t) => {
        const r = t.result ? (JSON.parse(t.result) as { total: number; max: number }) : null;
        return { id: t.id, kind: t.kind, subjects: JSON.parse(t.subjects) as string[], startedAt: t.started_at, finishedAt: t.finished_at, total: r?.total ?? null, max: r?.max ?? null };
      }),
    });
  }),
);

entRouter.post(
  "/profile",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const pair = must(ENT_PAIR[str(req.body?.pair, 40)], 400, "Выберите профильные предметы");
    const lang: EntLang = req.body?.lang === "kk" ? "kk" : "ru";
    const target = Math.round(Number(req.body?.target)) || null;
    await run(
      "INSERT INTO ent_profiles (user_id, pair, lang, target, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET pair = excluded.pair, lang = excluded.lang, target = excluded.target, updated_at = excluded.updated_at, plan_stale = 1",
      u.id,
      pair.id,
      lang,
      target && target > 0 && target <= ENT_MAX ? target : null,
      Date.now(),
    );
    res.json(await profileOf(u));
  }),
);

// ---------- practice ----------

entRouter.post(
  "/practice",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const subject = must(ENT_SUBJECT[str(req.body?.subject, 40)], 404, "Предмет не найден");
    const topic = str(req.body?.topic, 120);
    if (topic && !subject.topics.includes(topic)) throw new HttpError(404, "Тема не найдена");
    const type: EntType = TYPES.includes(req.body?.type) && subject.plan.some((p) => p.type === req.body.type) ? req.body.type : subject.plan[0]!.type;
    const lang = langFor(subject, (await profileOf(u))?.lang ?? "ru");
    const count = type === "single" || type === "context" ? 10 : 5;
    const seen = new Set((await all<{ item_id: string }>("SELECT item_id FROM attempts WHERE user_id = ? AND module = 'ent'", u.id)).map((r) => r.item_id));
    const query = () =>
      all<{ id: string; group_id: string | null; data: string }>(
        `SELECT id, group_id, data FROM ent_questions WHERE subject = ? AND lang = ? AND type = ?${topic ? " AND topic = ?" : ""} ORDER BY created_at`,
        ...[subject.id, lang, type, ...(topic ? [topic] : [])],
      );
    let rows = (await query()).filter((r) => !seen.has(r.id));
    if (rows.length < count || req.body?.fresh) {
      const made = await entGenerate(subject, topic || pick(subject.topics), type, count, lang as EntLang);
      if (!made.length && !rows.length) throw new HttpError(503, "Не получилось составить задания. Попробуйте ещё раз через минуту");
      await store(made);
      rows = (await query()).filter((r) => !seen.has(r.id));
    }
    // Context questions stay together with their text.
    let chosen = rows;
    if (type === "context") {
      const groups = new Map<string, typeof rows>();
      for (const r of rows) groups.set(r.group_id ?? r.id, [...(groups.get(r.group_id ?? r.id) ?? []), r]);
      chosen = [...groups.values()].slice(-2).flat();
    } else chosen = rows.slice(-count);
    res.json({ items: chosen.map((r) => toPublic(JSON.parse(r.data) as EntQuestion)) });
  }),
);

entRouter.post(
  "/check",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const q = must((await loadQuestions([str(req.body?.id, 40)])).values().next().value, 404, "Задание не найдено");
    const given = (req.body?.answer ?? null) as EntAnswer;
    const points = entScore(q, given);
    const max = entPoints(q.type);
    await run(
      "INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, 'ent', ?, ?, ?, ?, ?)",
      u.id,
      q.id,
      `${q.subject}:${q.topic}`,
      points === max ? 1 : 0,
      Math.max(0, Math.min(Number(req.body?.ms) || 0, 3_600_000)),
      Date.now(),
    );
    await reviewResult(u.id, "ent", q.id, points === max);
    await addXp(u.id, points ? points * 2 : 1, "ent");
    res.json({ points, max, answer: q.answer, explanation: q.explanation });
  }),
);

entRouter.post(
  "/explain",
  wrap(async (req, res) => {
    requireStudent(req);
    const q = must((await loadQuestions([str(req.body?.id, 40)])).values().next().value, 404, "Задание не найдено");
    const given = req.body?.answer ?? null;
    const key = `ent-explain:${q.id}:${JSON.stringify(given)}`;
    const hit = await getCache(key);
    if (hit) return res.json(JSON.parse(hit));
    const out = await entExplain(q, given);
    if (out.mode === "ai") await setCache(key, JSON.stringify(out));
    res.json(out);
  }),
);

// ---------- mock tests ----------

interface TestRow {
  id: string;
  user_id: string;
  kind: "full" | "subject";
  subjects: string;
  items: string;
  answers: string;
  lang: string;
  started_at: number;
  ends_at: number;
  finished_at: number | null;
  result: string | null;
}

interface EntResult {
  total: number;
  max: number;
  subjects: { id: string; name: string; points: number; max: number; threshold: number; passed: boolean }[];
  thresholds: { label: string; points: number; passed: boolean }[];
  passedAll: boolean;
}

entRouter.post(
  "/test/start",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const profile = await profileOf(u);
    const kind = req.body?.kind === "subject" ? "subject" : "full";
    let subjects: string[];
    if (kind === "full") {
      const pair = must(profile && ENT_PAIR[profile.pair], 400, "Сначала выберите профильные предметы");
      subjects = [...ENT_MANDATORY, ...pair.subjects];
    } else subjects = [must(ENT_SUBJECT[str(req.body?.subject, 40)], 404, "Предмет не найден").id];
    const lang = profile?.lang ?? "ru";
    const blocks = await Promise.all(subjects.map(async (sid) => ({ subject: sid, ids: await buildBlock(u, ENT_SUBJECT[sid]!, langFor(ENT_SUBJECT[sid]!, lang)) })));
    const short = blocks.find((b) => b.ids.length < ENT_SUBJECT[b.subject]!.count * 0.8);
    if (short) throw new HttpError(503, `Не хватило заданий по предмету «${ENT_SUBJECT[short.subject]!.name}». Попробуйте ещё раз через минуту`);
    const testId = id();
    const now = Date.now();
    await run(
      "INSERT INTO ent_tests (id, user_id, kind, subjects, items, lang, started_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      testId,
      u.id,
      kind,
      JSON.stringify(subjects),
      JSON.stringify(blocks),
      lang,
      now,
      now + entMinutes(subjects) * 60_000,
    );
    res.json({ id: testId });
  }),
);

async function ownTest(u: UserRow, testId: string) {
  return must(await one<TestRow>("SELECT * FROM ent_tests WHERE id = ? AND user_id = ?", testId, u.id), 404, "Пробник не найден");
}

async function finish(t: TestRow, answers: Record<string, EntAnswer>) {
  const blocks = JSON.parse(t.items) as { subject: string; ids: string[] }[];
  const qs = await loadQuestions(blocks.flatMap((b) => b.ids));
  const subjects = blocks.map((b) => {
    const s = ENT_SUBJECT[b.subject]!;
    const points = b.ids.reduce((sum, qid) => sum + (qs.has(qid) ? entScore(qs.get(qid)!, answers[qid] ?? null) : 0), 0);
    const max = b.ids.reduce((sum, qid) => sum + (qs.has(qid) ? entPoints(qs.get(qid)!.type) : 0), 0);
    return { id: s.id, name: s.name, points, max, threshold: s.threshold, passed: points >= s.threshold };
  });
  const total = subjects.reduce((s, x) => s + x.points, 0);
  const max = subjects.reduce((s, x) => s + x.max, 0);
  const passedAll = subjects.every((s) => s.passed);
  const result: EntResult = { total, max, subjects, passedAll, thresholds: t.kind === "full" ? ENT_THRESHOLDS.map((th) => ({ ...th, passed: passedAll && total >= th.points })) : [] };
  const now = Date.now();
  await run("UPDATE ent_tests SET answers = ?, finished_at = ?, result = ? WHERE id = ? AND finished_at IS NULL", JSON.stringify(answers), now, JSON.stringify(result), t.id);
  for (const [qid, q] of qs) {
    await run(
      "INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, 'ent', ?, ?, ?, 0, ?)",
      t.user_id,
      qid,
      `${q.subject}:${q.topic}`,
      entScore(q, answers[qid] ?? null) === entPoints(q.type) ? 1 : 0,
      now,
    );
    await reviewResult(t.user_id, "ent", qid, entScore(q, answers[qid] ?? null) === entPoints(q.type));
  }
  await addXp(t.user_id, total, "ent-test");
  // The adaptive plan is rebuilt after every finished test.
  await run("UPDATE ent_profiles SET plan_stale = 1 WHERE user_id = ?", t.user_id);
  return result;
}

entRouter.get(
  "/test/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    let t = await ownTest(u, String(req.params.id));
    // Time is up: finish with what was saved.
    if (!t.finished_at && Date.now() > t.ends_at + 30_000) {
      await finish(t, JSON.parse(t.answers));
      t = await ownTest(u, t.id);
    }
    const blocks = JSON.parse(t.items) as { subject: string; ids: string[] }[];
    const qs = await loadQuestions(blocks.flatMap((b) => b.ids));
    const done = !!t.finished_at;
    res.json({
      id: t.id,
      kind: t.kind,
      endsAt: t.ends_at,
      minutes: Math.round((t.ends_at - t.started_at) / 60_000),
      finished: done,
      answers: JSON.parse(t.answers),
      result: t.result ? JSON.parse(t.result) : null,
      blocks: blocks.map((b) => ({
        subject: b.subject,
        name: ENT_SUBJECT[b.subject]!.name,
        icon: ENT_SUBJECT[b.subject]!.icon,
        items: b.ids.filter((qid) => qs.has(qid)).map((qid) => (done ? qs.get(qid)! : toPublic(qs.get(qid)!))),
      })),
    });
  }),
);

entRouter.post(
  "/test/:id/save",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const t = await ownTest(u, String(req.params.id));
    if (t.finished_at) return res.json({ ok: false, finished: true });
    await run("UPDATE ent_tests SET answers = ? WHERE id = ?", JSON.stringify(req.body?.answers ?? {}).slice(0, 200_000), t.id);
    res.json({ ok: true, endsAt: t.ends_at });
  }),
);

entRouter.post(
  "/test/:id/submit",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const t = await ownTest(u, String(req.params.id));
    if (t.finished_at) return res.json(JSON.parse(t.result!));
    const answers = (Date.now() > t.ends_at + 30_000 ? JSON.parse(t.answers) : (req.body?.answers ?? JSON.parse(t.answers))) as Record<string, EntAnswer>;
    res.json(await finish(t, answers));
  }),
);

// ---------- teacher: ENT of a class ----------

entRouter.get(
  "/teacher/:code",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const c = must(await one<{ code: string; name: string }>("SELECT code, name FROM classes WHERE code = ? AND teacher_id = ?", String(req.params.code).toUpperCase(), t.id), 404, "Класс не найден");
    const users = await all<UserRow>("SELECT u.* FROM users u JOIN class_members m ON m.user_id = u.id WHERE m.class_code = ? ORDER BY u.last_name", c.code);
    const ids = users.map((u) => u.id);
    const marks = ids.map(() => "?").join(",") || "''";
    const profiles = new Map(
      (await all<{ user_id: string; pair: string; lang: string; target: number | null }>(`SELECT user_id, pair, lang, target FROM ent_profiles WHERE user_id IN (${marks})`, ...ids)).map((p) => [p.user_id, p]),
    );
    const tests = await all<{ user_id: string; kind: string; subjects: string; finished_at: number; result: string }>(
      `SELECT user_id, kind, subjects, finished_at, result FROM ent_tests WHERE finished_at IS NOT NULL AND user_id IN (${marks}) ORDER BY finished_at`,
      ...ids,
    );
    const topics = await all<{ skill: string; total: number; ok: number }>(`SELECT skill, COUNT(*) total, SUM(correct) ok FROM attempts WHERE module = 'ent' AND user_id IN (${marks}) GROUP BY skill`, ...ids);
    const practice = new Map(
      (await all<{ user_id: string; n: number; last: number }>(`SELECT user_id, COUNT(*) n, MAX(at) last FROM attempts WHERE module = 'ent' AND user_id IN (${marks}) GROUP BY user_id`, ...ids)).map((r) => [
        r.user_id,
        r,
      ]),
    );

    const students = users.map((u) => {
      const p = profiles.get(u.id);
      const mine = tests.filter((x) => x.user_id === u.id);
      const full = mine.filter((x) => x.kind === "full").map((x) => ({ at: x.finished_at, ...(JSON.parse(x.result) as EntResult) }));
      const last = full.at(-1) ?? null;
      return {
        id: u.id,
        name: `${u.last_name} ${u.first_name}`,
        pair: p?.pair ?? null,
        target: p?.target ?? null,
        best: full.length ? Math.max(...full.map((f) => f.total)) : null,
        last: last ? { total: last.total, at: last.at, passedAll: last.passedAll, subjects: last.subjects } : null,
        trend: full.slice(-8).map((f) => f.total),
        fullTests: full.length,
        miniTests: mine.length - full.length,
        practiced: practice.get(u.id)?.n ?? 0,
        lastActive: Math.max(practice.get(u.id)?.last ?? 0, mine.at(-1)?.finished_at ?? 0) || null,
      };
    });

    // Average share of points per block over each student's latest full test.
    const blocks = new Map<string, { got: number; max: number; passed: number; n: number }>();
    for (const s of students)
      for (const b of s.last?.subjects ?? []) {
        const cur = blocks.get(b.id) ?? { got: 0, max: 0, passed: 0, n: 0 };
        blocks.set(b.id, { got: cur.got + b.points, max: cur.max + b.max, passed: cur.passed + (b.passed ? 1 : 0), n: cur.n + 1 });
      }

    const bests = students.map((s) => s.best).filter((x): x is number => x !== null);
    const pairs = new Map<string, number>();
    for (const s of students) if (s.pair) pairs.set(s.pair, (pairs.get(s.pair) ?? 0) + 1);

    const entAssignments = await all<{ id: string; title: string; kind: string; ref: string; due_at: number | null; created_at: number }>(
      "SELECT * FROM assignments WHERE class_code = ? AND kind IN ('ent-full', 'ent-subject') ORDER BY created_at DESC",
      c.code,
    );
    const assignments = await Promise.all(
      entAssignments.map(async (a) => {
        const done = (
          await all<{ user_id: string }>(
            `SELECT DISTINCT user_id FROM ent_tests WHERE finished_at >= ? AND kind = ? ${a.kind === "ent-subject" ? "AND subjects = ?" : ""} AND user_id IN (${marks})`,
            ...[a.created_at, a.kind === "ent-full" ? "full" : "subject", ...(a.kind === "ent-subject" ? [JSON.stringify([a.ref])] : []), ...ids],
          )
        ).length;
        return { id: a.id, title: a.title, kind: a.kind, ref: a.ref, dueAt: a.due_at, createdAt: a.created_at, done, total: users.length };
      }),
    );

    res.json({
      classRoom: c,
      summary: {
        students: users.length,
        withProfile: profiles.size,
        fullTests: students.reduce((s, x) => s + x.fullTests, 0),
        miniTests: students.reduce((s, x) => s + x.miniTests, 0),
        avgBest: bests.length ? Math.round(bests.reduce((a, b) => a + b, 0) / bests.length) : null,
        topBest: bests.length ? Math.max(...bests) : null,
        passed: ENT_THRESHOLDS.map((th) => ({ ...th, count: students.filter((s) => s.last && s.last.passedAll && s.last.total >= th.points).length })),
      },
      students,
      blocks: [...blocks].map(([id, b]) => ({ id, name: ENT_SUBJECT[id]?.name ?? id, pct: b.max ? Math.round((b.got / b.max) * 100) : 0, passed: b.passed, n: b.n })),
      weakTopics: topics
        .filter((x) => x.total >= 3)
        .map((x) => {
          const [subject, topic] = x.skill.split(":");
          return { subject: subject!, name: ENT_SUBJECT[subject!]?.name ?? subject!, topic: topic ?? "", total: x.total, pct: Math.round(((x.ok ?? 0) / x.total) * 100) };
        })
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 8),
      pairs: [...pairs].map(([pair, count]) => ({ pair, count, subjects: ENT_PAIR[pair]?.subjects.map((sid) => ENT_SUBJECT[sid]?.name ?? sid) ?? [] })),
      assignments,
      subjects: ENT_SUBJECTS.map(({ id, name, count }) => ({ id, name, count })),
    });
  }),
);

// ---------- adaptive plan until the main session ----------

const WEEK = 7 * 86_400_000;
const MAIN_SESSION = Date.UTC(2027, 4, 10) - 5 * 3600_000;

async function buildPlan(u: UserRow, profile: { pair: string; target: number | null }) {
  const pair = ENT_PAIR[profile.pair]!;
  const subjects = [...ENT_MANDATORY, ...pair.subjects].map((sid) => ENT_SUBJECT[sid]!);
  const stats = await all<{ skill: string; total: number; ok: number }>("SELECT skill, COUNT(*) total, SUM(correct) ok FROM attempts WHERE user_id = ? AND module = 'ent' GROUP BY skill", u.id);
  const accuracy: Record<string, number | null> = {};
  for (const s of subjects) {
    const rows = stats.filter((x) => x.skill.startsWith(`${s.id}:`));
    const total = rows.reduce((a, r) => a + r.total, 0);
    accuracy[s.id] = total ? Math.round((rows.reduce((a, r) => a + (r.ok ?? 0), 0) / total) * 100) : null;
  }
  const weak = stats
    .filter((x) => x.total >= 3)
    .map((x) => ({ subject: x.skill.split(":")[0]!, topic: x.skill.split(":")[1] ?? "", pct: Math.round(((x.ok ?? 0) / x.total) * 100) }))
    .filter((x) => subjects.some((s) => s.id === x.subject))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 8);
  const full = (await all<{ result: string }>("SELECT result FROM ent_tests WHERE user_id = ? AND kind = 'full' AND finished_at IS NOT NULL ORDER BY finished_at", u.id)).map((r) => JSON.parse(r.result) as EntResult);
  const last = full.at(-1);
  return entPlan({
    subjects: subjects.map((s) => ({ id: s.id, name: s.name, max: s.max, topics: s.topics })),
    target: profile.target ?? 100,
    daysLeft: Math.max(0, Math.ceil((MAIN_SESSION - Date.now()) / 86_400_000)),
    best: full.length ? Math.max(...full.map((f) => f.total)) : null,
    last: last ? last.subjects.map((b) => ({ id: b.id, points: b.points, max: b.max })) : null,
    accuracy,
    weak,
    fullTests: full.length,
  });
}

/** How far the student got with each task of the current week, from their real activity. */
export async function planProgress(userId: string, plan: EntPlan, createdAt: number) {
  const week = Math.min(plan.weeks.length - 1, Math.max(0, Math.floor((Date.now() - createdAt) / WEEK)));
  const from = createdAt + week * WEEK;
  const to = from + WEEK;
  const tasks = await Promise.all(
    (plan.weeks[week]?.tasks ?? []).map(async (t) => {
      if (t.kind === "practice") {
        const n =
          (
            await one<{ n: number }>(
              "SELECT COUNT(*) n FROM attempts WHERE user_id = ? AND module = 'ent' AND skill LIKE ? AND at >= ? AND at < ?",
              userId,
              t.topic ? `${t.subject}:${t.topic}` : `${t.subject}:%`,
              from,
              to,
            )
          )?.n ?? 0;
        return { done: Math.min(n, t.count), of: t.count };
      }
      if (t.kind === "mini" || t.kind === "full") {
        const n =
          (
            await one<{ n: number }>(
              `SELECT COUNT(*) n FROM ent_tests WHERE user_id = ? AND kind = ? ${t.kind === "mini" ? "AND subjects = ?" : ""} AND finished_at >= ? AND finished_at < ?`,
              ...[userId, t.kind === "mini" ? "subject" : "full", ...(t.kind === "mini" ? [JSON.stringify([t.subject])] : []), from, to],
            )
          )?.n ?? 0;
        return { done: Math.min(n, 1), of: 1 };
      }
      const due = (await one<{ n: number }>("SELECT COUNT(*) n FROM review_queue WHERE user_id = ? AND module = 'ent' AND due_at <= ?", userId, Date.now()))?.n ?? 0;
      const reviewed = (await one<{ n: number }>("SELECT COUNT(*) n FROM attempts WHERE user_id = ? AND module = 'ent' AND at >= ? AND at < ?", userId, from, to))?.n ?? 0;
      return { done: due === 0 && reviewed > 0 ? 1 : 0, of: 1 };
    }),
  );
  return { week, from, tasks };
}

entRouter.get(
  "/plan",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const p = must(
      await one<{ pair: string; target: number | null; plan: string | null; plan_stale: number }>("SELECT pair, target, plan, plan_stale FROM ent_profiles WHERE user_id = ?", u.id),
      400,
      "Сначала выберите профильные предметы",
    );
    let stored = p.plan ? (JSON.parse(p.plan) as { plan: EntPlan; createdAt: number }) : null;
    const old = stored && Date.now() - stored.createdAt > 4 * WEEK;
    if (!stored || p.plan_stale || old || req.query.rebuild) {
      const plan = await buildPlan(u, p);
      stored = { plan, createdAt: Date.now() };
      await run("UPDATE ent_profiles SET plan = ?, plan_stale = 0 WHERE user_id = ?", JSON.stringify(stored), u.id);
    }
    res.json({ ...stored, progress: await planProgress(u.id, stored.plan, stored.createdAt), mainSession: MAIN_SESSION });
  }),
);
