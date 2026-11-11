import { bankCatalog, bankSeed, selectBank } from "../satBank";
import { selectAssessment, familyOf, fingerprint, normaliseText } from "../../shared/satQuality";
import { Router } from "express";
import type { Difficulty, SatDomain, SatModuleState, SatQuestion, SatQuestionPublic, SatQuestionSummary, SatSection, SatTestState } from "../../shared/types";
import { DOMAIN_RU, SAT_DOMAINS } from "../../shared/types";
import { SAT_ACTIVE_BANK, SAT_BY_ID, isCorrect, scaleSection } from "../../shared/sat";
import { VOCAB, VOCAB_BY_ID } from "../../shared/vocab";
import { reviewResult } from "../review";
import { requireStudent, toPublic } from "../auth";
import { addXp, all, dayKey, getCache, id, one, run, setCache } from "../db";
import { HttpError, must, str, wrap } from "../http";
import { AiRefusal, satExplain, satGenerate, satHint, satRemix, studyPlan } from "../ai";
import { SAT_LESSONS, SAT_LESSON_BY_ID } from "../../shared/satLessons";
import { satStats } from "../progress";

export const satRouter = Router();

// ---------- question lookup ----------

export async function getQuestion(qid: string): Promise<SatQuestion | undefined> {
  const bank = SAT_BY_ID.get(qid);
  if (bank) return bank;
  const row = await one<{ data: string }>("SELECT data FROM ai_questions WHERE id = ?", qid);
  return row ? (JSON.parse(row.data) as SatQuestion) : undefined;
}

/** Loads several questions at once; AI-generated ones come from the database. */
async function questionMap(ids: string[]) {
  const pairs = await Promise.all([...new Set(ids)].map(async (qid) => [qid, (await getQuestion(qid))!] as const));
  return new Map(pairs);
}

const toPublicQ = ({ answer: _a, explanation: _e, acceptedAnswers: _accepted, ...q }: SatQuestion): SatQuestionPublic => q;

async function lastResults(userId: string) {
  const map = new Map<string, boolean>();
  for (const r of await all<{ item_id: string; correct: number }>("SELECT item_id, correct FROM attempts WHERE user_id = ? AND module = 'sat' ORDER BY at ASC", userId)) {
    map.set(r.item_id, !!r.correct);
  }
  return map;
}

async function savedSet(userId: string) {
  return new Set((await all<{ item_id: string }>("SELECT item_id FROM saved WHERE user_id = ? AND module = 'sat'", userId)).map((r) => r.item_id));
}

async function record(userId: string, q: SatQuestion, correct: boolean, ms: number) {
  await run("INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, 'sat', ?, ?, ?, ?, ?)", userId, q.id, q.domain, correct ? 1 : 0, Math.max(0, Math.min(ms, 3_600_000)), Date.now());
  await addXp(userId, correct ? 3 + q.difficulty : 1, "sat");
  await reviewResult(userId, "sat", q.id, correct);
}

// ---------- bank ----------

async function bankState(userId: string) {
  const [results, saved] = await Promise.all([lastResults(userId), savedSet(userId)]);
  // History remains in the archive lookup/review; it cannot repopulate new practice.
  return { pool: SAT_ACTIVE_BANK, results, saved };
}

satRouter.get("/bank/catalog", wrap(async (req, res) => {
  const state = await bankState(requireStudent(req).id);
  res.json(bankCatalog(state.pool, state.results, state.saved, req.query));
}));

satRouter.get("/bank/sequence", wrap(async (req, res) => {
  const state = await bankState(requireStudent(req).id);
  const items = selectBank(state.pool, state.results, state.saved, req.query);
  res.json({ ids: items.map(q => q.id), total: items.length, seed: bankSeed(req.query) });
}));

satRouter.get("/bank", wrap(async (req, res) => {
  const state = await bankState(requireStudent(req).id);
  const items = selectBank(state.pool, state.results, state.saved, req.query);
  const requestedPage = Number(req.query.page);
  const page = Number.isFinite(requestedPage) ? Math.max(0, Math.floor(requestedPage)) : 0;
  res.json({ total: items.length, page, seed: bankSeed(req.query), items: items.slice(page * 40, page * 40 + 40) });
}));

satRouter.get(
  "/question/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const q = must(await getQuestion(String(req.params.id)), 404, "Question not found");
    res.json({ question: toPublicQ(q), saved: (await savedSet(u.id)).has(q.id) });
  }),
);

satRouter.post(
  "/answer",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const q = must(await getQuestion(str(req.body?.id, 60)), 404, "Question not found");
    const correct = isCorrect(q, req.body?.response);
    await record(u.id, q, correct, Number(req.body?.ms) || 0);
    res.json({ correct, answer: q.answer, explanation: q.explanation });
  }),
);

satRouter.post(
  "/save",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const qid = str(req.body?.id, 60);
    must(await getQuestion(qid), 404, "Question not found");
    if (req.body?.saved) await run("INSERT OR IGNORE INTO saved (user_id, module, item_id, at) VALUES (?, 'sat', ?, ?)", u.id, qid, Date.now());
    else await run("DELETE FROM saved WHERE user_id = ? AND module = 'sat' AND item_id = ?", u.id, qid);
    res.json({ saved: !!req.body?.saved });
  }),
);

satRouter.post(
  "/explain",
  wrap(async (req, res) => {
    requireStudent(req);
    const q = must(await getQuestion(str(req.body?.id, 60)), 404, "Question not found");
    const given = req.body?.response ?? null;
    const key = `explain:en:${q.id}:${String(given)}`;
    const cached = await getCache(key);
    if (cached) return res.json(JSON.parse(cached));
    try {
      const out = await satExplain(q, given);
      if (out.mode === "ai") await setCache(key, JSON.stringify(out));
      res.json(out);
    } catch (e) {
      if (e instanceof AiRefusal) throw new HttpError(422, "I.E. couldn't explain it. Look at the short decision below.");
      throw e;
    }
  }),
);

satRouter.post(
  "/remix",
  wrap(async (req, res) => {
    requireStudent(req);
    const q = must(await getQuestion(str(req.body?.id, 60)), 404, "Question not found");
    try {
      const { mode, ...made } = await satRemix(q);
      const newId = mode === "ai" ? `ai-${id(6)}` : q.id;
      if (mode === "ai") await run("INSERT INTO ai_questions (id, data, created_at) VALUES (?, ?, ?)", newId, JSON.stringify({ ...made, id: newId }), Date.now());
      res.json({ question: toPublicQ({ ...made, id: newId } as SatQuestion), mode });
    } catch (e) {
      if (e instanceof AiRefusal) throw new HttpError(422, "I.E. couldn't make a similar question. Try another one.");
      throw e;
    }
  }),
);

satRouter.post(
  "/hint",
  wrap(async (req, res) => {
    requireStudent(req);
    const q = must(await getQuestion(str(req.body?.id, 60)), 404, "Question not found");
    const key = `hint:en:${q.id}`;
    const cached = await getCache(key);
    if (cached) return res.json(JSON.parse(cached));
    try {
      const out = await satHint(q);
      if (out.mode === "ai") await setCache(key, JSON.stringify(out));
      res.json(out);
    } catch (e) {
      if (e instanceof AiRefusal) throw new HttpError(422, "There's no clue.");
      throw e;
    }
  }),
);

/** Claude writes new original questions for a skill; the bank grows with every request. */
satRouter.post(
  "/generate",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const lesson = must(SAT_LESSON_BY_ID.get(str(req.body?.lessonId, 40)), 404, "Skill not found");
    const count = Math.max(1, Math.min(8, Number(req.body?.count) || 5));
    const since = Date.now() - 3600_000;
    const recent = (await one<{ n: number }>("SELECT COUNT(*) n FROM ai_cache WHERE key LIKE ? AND created_at >= ?", `gen:${u.id}:%`, since))?.n ?? 0;
    if (recent >= 10) throw new HttpError(429, "Generator restriction: 10 sets per hour. So far, solve the issues that have already been set up.");
    try {
      const { items, mode } = await satGenerate(lesson.section, lesson.domain, lesson.bankSkills[0]!, count);
      if (mode === "demo") throw new HttpError(503, "New question generation only works with Claude connected");
      const ids: string[] = [];
      for (const item of items) {
        const qid = `ai-${id(6)}`;
        await run("INSERT INTO ai_questions (id, data, created_at) VALUES (?, ?, ?)", qid, JSON.stringify({ ...item, id: qid }), Date.now());
        ids.push(qid);
      }
      await setCache(`gen:${u.id}:${Date.now()}`, String(ids.length));
      res.json({ ids });
    } catch (e) {
      if (e instanceof AiRefusal) throw new HttpError(422, "I.E. wasn't able to ask questions. Try again.");
      throw e;
    }
  }),
);

satRouter.get(
  "/lessons",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const bySkill = new Map<string, { right: number; total: number }>();
    for (const r of await all<{ item_id: string; correct: number }>("SELECT item_id, correct FROM attempts WHERE user_id = ? AND module = 'sat'", u.id)) {
      const skill = (await getQuestion(r.item_id))?.skill;
      if (!skill) continue;
      const v = bySkill.get(skill) ?? { right: 0, total: 0 };
      v.total++;
      v.right += r.correct;
      bySkill.set(skill, v);
    }
    res.json(
      SAT_LESSONS.map((l) => {
        const stats = l.bankSkills.reduce((acc, s) => ({ right: acc.right + (bySkill.get(s)?.right ?? 0), total: acc.total + (bySkill.get(s)?.total ?? 0) }), { right: 0, total: 0 });
        const questions = SAT_ACTIVE_BANK.filter((q) => l.bankSkills.includes(q.skill)).length;
        return { ...l, questions, right: stats.right, total: stats.total };
      }),
    );
  }),
);

satRouter.get(
  "/review",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const results = await lastResults(u.id);
    const wrong = (await Promise.all([...results].filter(([, ok]) => !ok).map(([qid]) => getQuestion(qid)))).filter(Boolean) as SatQuestion[];
    res.json(
      wrong.map((q) => ({ id: q.id, section: q.section, domain: q.domain, skill: q.skill, difficulty: q.difficulty, preview: (q.passage ?? q.stem).replace(/\$/g, "").slice(0, 110), status: "wrong", saved: false })),
    );
  }),
);

// ---------- stats ----------

satRouter.get(
  "/stats",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const s = await satStats(u.id);
    const domains = (["rw", "math"] as const).flatMap((section) =>
      SAT_DOMAINS[section].map((d) => {
        const v = s.byDomain.get(d) ?? { right: 0, total: 0 };
        return { section, domain: d, label: DOMAIN_RU[d], right: v.right, total: v.total, pct: v.total ? Math.round((v.right / v.total) * 100) : null };
      }),
    );
    const since = Date.now() - 30 * 86_400_000;
    const byDay = new Map<string, { total: number; right: number }>();
    for (const r of await all<{ correct: number; at: number }>("SELECT correct, at FROM attempts WHERE user_id = ? AND module = 'sat' AND at >= ?", u.id, since)) {
      const k = dayKey(r.at);
      const v = byDay.get(k) ?? { total: 0, right: 0 };
      v.total++;
      v.right += r.correct;
      byDay.set(k, v);
    }
    const tests = await all<{ id: string; started_at: number; finished_at: number; rw_score: number; math_score: number }>(
      "SELECT id, started_at, finished_at, rw_score, math_score FROM sat_tests WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 10",
      u.id,
    );
    const avgMs = (await one<{ m: number | null }>("SELECT AVG(ms) m FROM attempts WHERE user_id = ? AND module = 'sat' AND ms > 0", u.id))?.m ?? null;
    res.json({
      attempts: s.attempts,
      right: s.right,
      accuracy: s.accuracy,
      estimate: s.estimate,
      fromTest: s.fromTest,
      goal: (await toPublic(u)).goals.sat ?? null,
      avgSeconds: avgMs ? Math.round(avgMs / 1000) : null,
      domains,
      byDay: [...byDay].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
      tests,
      reviewCount: [...(await lastResults(u.id)).values()].filter((ok) => !ok).length,
      savedCount: (await savedSet(u.id)).size,
    });
  }),
);

// ---------- adaptive practice test ----------

type Mode = NonNullable<SatTestState["mode"]>;
// Full mode matches the real Digital SAT: R&W 27 questions in 32 min, Math 22 in 35 min per module.
const MODULE_SIZE: Record<Mode, Record<SatSection, number>> = { short: { rw: 12, math: 11 }, full: { rw: 27, math: 22 } };
const MODULE_SECONDS: Record<Mode, Record<SatSection, number>> = {
  short: { rw: Math.round((32 * 60 * 12) / 27), math: Math.round((35 * 60 * 11) / 22) },
  full: { rw: 32 * 60, math: 35 * 60 },
};
const RW_ORDER: SatDomain[] = ["Craft and Structure", "Information and Ideas", "Standard English Conventions", "Expression of Ideas"];

/** Difficulty mix per module level, as shares of easy / medium / hard. */
const MIX: Record<SatModuleState["level"], [number, number, number]> = { base: [0.34, 0.41, 0.25], easy: [0.5, 0.42, 0.08], hard: [0, 0.34, 0.66] };

/** Digital SAT math blueprint (College Board): share of each domain in a module, and about a quarter typed answers. */
const MATH_BLUEPRINT: Record<string, number> = { Algebra: 0.35, "Advanced Math": 0.35, "Problem-Solving and Data Analysis": 0.15, "Geometry and Trigonometry": 0.15 };

function pickQuestions(section: SatSection, level: SatModuleState["level"], exclude: Set<string>, mode: Mode = "short"): string[] {
  const size = MODULE_SIZE[mode][section];
  const [e, m] = MIX[level];
  const plan: Difficulty[] = Array.from({ length: size }, (_, i) => i < Math.round(size * e) ? 1 : i < Math.round(size * (e + m)) ? 2 : 3);
  const previous = [...exclude].map((id) => SAT_BY_ID.get(id)).filter((q): q is SatQuestion => !!q && q.section === section);
  const chosen = selectAssessment(SAT_ACTIVE_BANK.filter((q) => q.section === section), size, previous, plan);
  if (chosen.length !== size) throw new HttpError(503, "There are not enough different checklists for this module");
  return chosen.sort((a, b) => section === "rw" ? RW_ORDER.indexOf(a.domain) - RW_ORDER.indexOf(b.domain) : a.difficulty - b.difficulty).map((q) => q.id);
}

async function loadTest(userId: string, testId: string): Promise<SatTestState> {
  const row = must(await one<{ state: string }>("SELECT state FROM sat_tests WHERE id = ? AND user_id = ?", testId, userId), 404, "No test found.");
  return JSON.parse(row.state) as SatTestState;
}

async function saveTest(userId: string, t: SatTestState) {
  await run("UPDATE sat_tests SET state = ?, finished_at = ?, rw_score = ?, math_score = ? WHERE id = ? AND user_id = ?", JSON.stringify(t), t.finishedAt, t.rwScore, t.mathScore, t.id, userId);
}

async function testView(t: SatTestState) {
  const m = t.modules[t.current];
  const qs = await questionMap(t.modules.flatMap((mod) => mod.questionIds));
  if (t.finishedAt || !m) {
    return {
      test: t,
      review: t.modules.map((mod) => ({
        section: mod.section,
        module: mod.module,
        level: mod.level,
        items: mod.questionIds.map((qid) => {
          const q = qs.get(qid)!;
          return { question: toPublicQ(q), given: mod.answers[qid] ?? null, answer: q.answer, explanation: q.explanation, correct: isCorrect(q, mod.answers[qid]) };
        }),
      })),
    };
  }
  return { test: t, questions: m.questionIds.map((qid) => toPublicQ(qs.get(qid)!)), seconds: MODULE_SECONDS[t.mode ?? "short"][m.section] };
}

satRouter.post(
  "/test/start",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const mode: Mode = req.body?.mode === "full" ? "full" : "short";
    const t: SatTestState = {
      id: id(),
      mode,
      startedAt: Date.now(),
      finishedAt: null,
      modules: [{ section: "rw", module: 1, level: "base", questionIds: pickQuestions("rw", "base", new Set(), mode), answers: {}, correct: null, seconds: 0 }],
      current: 0,
      rwScore: null,
      mathScore: null,
    };
    await run("INSERT INTO sat_tests (id, user_id, state, started_at) VALUES (?, ?, ?, ?)", t.id, u.id, JSON.stringify(t), t.startedAt);
    res.json(await testView(t));
  }),
);

satRouter.get(
  "/test/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    res.json(await testView(await loadTest(u.id, String(req.params.id))));
  }),
);

satRouter.get(
  "/tests",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    res.json(await all("SELECT id, started_at, finished_at, rw_score, math_score FROM sat_tests WHERE user_id = ? ORDER BY started_at DESC LIMIT 20", u.id));
  }),
);

satRouter.post(
  "/test/:id/submit",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const t = await loadTest(u.id, String(req.params.id));
    if (t.finishedAt) throw new HttpError(409, "Test's already finished.");
    const m = t.modules[t.current]!;
    const answers = (req.body?.answers ?? {}) as Record<string, string | number | null>;
    m.answers = Object.fromEntries(m.questionIds.map((qid) => [qid, answers[qid] ?? null]));
    m.seconds = Math.max(0, Math.min(Number(req.body?.seconds) || 0, 7200));
    const qs = await questionMap(m.questionIds);
    m.correct = m.questionIds.filter((qid) => isCorrect(qs.get(qid)!, m.answers[qid])).length;
    for (const qid of m.questionIds) {
      const q = (await getQuestion(qid))!;
      if (m.answers[qid] !== null && m.answers[qid] !== "") await record(u.id, q, isCorrect(q, m.answers[qid]), 0);
    }
    const used = new Set(t.modules.flatMap((x) => x.questionIds));
    if (m.module === 1) {
      // Adaptive: a strong first module unlocks the harder second module, as on the Digital SAT.
      const level = m.correct / m.questionIds.length >= 0.6 ? "hard" : "easy";
      t.modules.push({ section: m.section, module: 2, level, questionIds: pickQuestions(m.section, level, used, t.mode), answers: {}, correct: null, seconds: 0 });
    } else if (m.section === "rw") {
      t.modules.push({ section: "math", module: 1, level: "base", questionIds: pickQuestions("math", "base", used, t.mode), answers: {}, correct: null, seconds: 0 });
    }
    t.current++;
    if (t.current >= t.modules.length) {
      const score = (section: SatSection) => {
        const [m1, m2] = t.modules.filter((x) => x.section === section);
        return scaleSection(m1!.correct ?? 0, m1!.questionIds.length, m2!.correct ?? 0, m2!.questionIds.length, m2!.level === "hard" ? "hard" : "easy");
      };
      t.rwScore = score("rw");
      t.mathScore = score("math");
      t.finishedAt = Date.now();
      await addXp(u.id, 60, "sat-test");
    }
    await saveTest(u.id, t);
    res.json(await testView(t));
  }),
);

// ---------- Blitz ----------

satRouter.get(
  "/blitz",
  wrap(async (req, res) => {
    requireStudent(req);
    const section = String(req.query.section ?? "mixed");
    const math = SAT_ACTIVE_BANK.filter(q => q.section === "math" && q.choices).sort(() => Math.random() - 0.5).slice(0, 30);
    const rw = SAT_ACTIVE_BANK.filter(q => q.section === "rw").sort(() => Math.random() - 0.5);
    const pool = section === "math" ? math : section === "rw" ? rw : [...math.slice(0, 15), ...rw.slice(0, 15)].sort(() => Math.random() - 0.5);
    res.json(pool.slice(0, 30).sort((a, b) => a.difficulty - b.difficulty));
  }),
);

satRouter.post(
  "/blitz/result",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const answers: { id: string; domain: string; correct: boolean }[] = Array.isArray(req.body?.answers) ? req.body.answers.slice(0, 60) : [];
    const points = Math.max(0, Math.min(20_000, Number(req.body?.points) || 0));
    for (const a of answers) {
      await run("INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, 'sat', ?, ?, ?, 0, ?)", u.id, str(a.id, 60), str(a.domain, 60), a.correct ? 1 : 0, Date.now());
    }
    await addXp(u.id, Math.round(points / 20), "sat-blitz");
    const best = (await one<{ b: number | null }>("SELECT MAX(amount) b FROM xp_log WHERE user_id = ? AND reason = 'sat-blitz'", u.id))?.b ?? 0;
    res.json({ xp: Math.round(points / 20), bestXp: best });
  }),
);

// ---------- AI study plan ----------

satRouter.get(
  "/plan",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const row = await one<{ plan: string; created_at: number }>("SELECT plan, created_at FROM study_plans WHERE user_id = ?", u.id);
    res.json(row ? { ...JSON.parse(row.plan), createdAt: row.created_at } : null);
  }),
);

satRouter.post(
  "/plan",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const user = await toPublic(u);
    const s = await satStats(u.id);
    const weak = [...s.byDomain].filter(([, v]) => v.total >= 3).sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total);
    const stats = [
      `SAT: Questions ${s.attempts}the accuracy ${s.accuracy === null ? "No data" : Math.round(s.accuracy * 100) + "%"}the assessment ${s.estimate ?? "None"}`,
      weak.length
        ? `weak: ${weak
            .slice(0, 2)
            .map(([d]) => d)
            .join(", ")}`
        : "Weak: Algebra",
      `Subjects for accuracy: ${weak.map(([d, v]) => `${d} ${Math.round((v.right / v.total) * 100)}%`).join("; ") || "Not enough data"}`,
    ].join("\n");
    try {
      const plan = await studyPlan(user.goals, stats);
      await run("INSERT OR REPLACE INTO study_plans (user_id, plan, created_at) VALUES (?, ?, ?)", u.id, JSON.stringify(plan), Date.now());
      res.json({ ...plan, createdAt: Date.now() });
    } catch (e) {
      if (e instanceof AiRefusal) throw new HttpError(422, "EI couldn't make a plan. Try again.");
      throw e;
    }
  }),
);

// ---------- vocabulary ----------

satRouter.get(
  "/vocab",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    res.json(
      await Promise.all(
        VOCAB.map(async (unit) => {
          const rows = await all<{ item_id: string; correct: number }>("SELECT item_id, correct FROM attempts WHERE user_id = ? AND module = 'vocab' AND item_id LIKE ?", u.id, `${unit.id}-%`);
          const known = new Set(rows.filter((r) => r.correct).map((r) => r.item_id));
          return { id: unit.id, title: unit.title, topic: unit.topic, words: unit.words.length, known: known.size };
        }),
      ),
    );
  }),
);

satRouter.get(
  "/vocab/:id",
  wrap(async (req, res) => {
    requireStudent(req);
    res.json(must(VOCAB_BY_ID.get(String(req.params.id)), 404, "Unith not found"));
  }),
);

satRouter.post(
  "/vocab/:id/result",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const unit = must(VOCAB_BY_ID.get(String(req.params.id)), 404, "Unith not found");
    const answers: { wordId: string; correct: boolean }[] = Array.isArray(req.body?.answers) ? req.body.answers : [];
    let right = 0;
    for (const a of answers) {
      if (!unit.words.some((w) => w.id === a.wordId)) continue;
      await run("INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, 'vocab', ?, ?, ?, 0, ?)", u.id, a.wordId, unit.id, a.correct ? 1 : 0, Date.now());
      if (a.correct) right++;
    }
    await addXp(u.id, right * 2, "vocab");
    res.json({ right, total: answers.length });
  }),
);

// ---------- drills: focused timed sets ----------

/** Seconds per question on the real Digital SAT: R&W 32 min / 27, Math 35 min / 22. */
const PACE = { rw: 71, math: 95 } as const;
const DRILLS = {
  "hard-math": { title: "Hard Math", size: 10 },
  "hard-rw": { title: "Hard Reading & Writing", size: 10 },
  spr: { title: "Write Answer (grid-in))", size: 10 },
  weak: { title: "My weakest area", size: 10 },
  sprint: { title: "20-question sprint", size: 20 },
} as const;
type DrillKind = keyof typeof DRILLS;

satRouter.post(
  "/drill",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const kind = (Object.keys(DRILLS).includes(req.body?.kind) ? req.body.kind : "sprint") as DrillKind;
    const done = await all<{ item_id: string; correct: number }>("SELECT item_id, correct FROM attempts WHERE user_id = ? AND module = 'sat'", u.id);
    const solved = new Set(done.filter((d) => d.correct).map((d) => d.item_id));
    let pool: SatQuestion[];
    let note = "";
    if (kind === "hard-math") pool = SAT_ACTIVE_BANK.filter((q) => q.section === "math" && q.difficulty === 3);
    else if (kind === "hard-rw") pool = SAT_ACTIVE_BANK.filter((q) => q.section === "rw" && q.difficulty === 3);
    else if (kind === "spr") pool = SAT_ACTIVE_BANK.filter((q) => q.section === "math" && !q.choices && q.difficulty >= 2);
    else if (kind === "weak") {
      // the domain with the lowest smoothed accuracy (unseen domains count as 50 %)
      const acc = new Map<string, { n: number; ok: number }>();
      for (const d of done) {
        const q = SAT_BY_ID.get(d.item_id);
        if (!q) continue;
        const a = acc.get(q.domain) ?? { n: 0, ok: 0 };
        acc.set(q.domain, { n: a.n + 1, ok: a.ok + d.correct });
      }
      const domains = [...new Set(SAT_ACTIVE_BANK.map((q) => q.domain))];
      const score = (dom: string) => ((acc.get(dom)?.ok ?? 0) + 1) / ((acc.get(dom)?.n ?? 0) + 2);
      const weakest = domains.sort((a, b) => score(a) - score(b))[0]!;
      pool = SAT_ACTIVE_BANK.filter((q) => q.domain === weakest);
      note = `${DOMAIN_RU[weakest as SatDomain] ?? weakest}Accuracy ${Math.round(score(weakest) * 100)} %`;
    } else pool = SAT_ACTIVE_BANK.filter((q) => q.difficulty >= 2);
    // Unsolved first, then shuffled.
    const candidates = [...pool].sort((a, b) => Number(solved.has(a.id)) - Number(solved.has(b.id)) || Math.random() - 0.5);
    const pick: SatQuestion[] = [], seen = new Set<string>(), passages = new Set<string>(), families = new Map<string, number>();
    for (const q of candidates) {
      const condition = fingerprint(q), family = familyOf(q);
      const passage = q.section === "rw" && q.passage ? normaliseText(q.passage) : null;
      if (seen.has(condition) || (families.get(family) ?? 0) >= 2 || (passage && passages.has(passage))) continue;
      pick.push(q); seen.add(condition); families.set(family, (families.get(family) ?? 0) + 1);
      if(passage)passages.add(passage);
      if (pick.length >= DRILLS[kind].size) break;
    }
    if (pick.length < DRILLS[kind].size) note = `${note ? note + ". " : ""}Available ${pick.length} Various assignments after the editorial audit. The recruitment is limited to actual availability; complexity is not calibrated.`;
    res.json({ kind, title: DRILLS[kind].title, note, items: pick.map((q) => ({ ...toPublicQ(q), pace: PACE[q.section] })) });
  }),
);
