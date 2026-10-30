import crypto from "node:crypto";
import { Router } from "express";
import type { LockEventType, Work } from "../../shared/types";
import { BLITZ, LESSONS } from "../../shared/content";
import { PROBLEMS, PROBLEM_BY_ID } from "../../shared/problems";
import { requireStudent } from "../auth";
import { addXp, all, getCache, one, run, setCache } from "../db";
import { HttpError, must, str, wrap } from "../http";
import { AiRefusal, codeHint, codeReview, interviewReply, review, vibe } from "../ai";
import { solvedProblems } from "../progress";

export const codingRouter = Router();

// ---------- problems ----------

codingRouter.get(
  "/problems",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const solved = await solvedProblems(u.id);
    const tried = new Set((await all<{ problem_id: string }>("SELECT DISTINCT problem_id FROM code_runs WHERE user_id = ?", u.id)).map((r) => r.problem_id));
    const stats = new Map(
      (
        await all<{ problem_id: string; users: number; solvers: number }>(
          `SELECT problem_id, COUNT(DISTINCT user_id) users, COUNT(DISTINCT CASE WHEN passed = total AND total > 0 THEN user_id END) solvers FROM code_runs GROUP BY problem_id`,
        )
      ).map((r) => [r.problem_id, r]),
    );
    res.json(
      PROBLEMS.map((p) => {
        const s = stats.get(p.id);
        return {
          id: p.id,
          title: p.title,
          difficulty: p.difficulty,
          pattern: p.pattern,
          tags: p.tags,
          status: solved.has(p.id) ? "solved" : tried.has(p.id) ? "tried" : "new",
          acceptance: s && s.users ? Math.round((s.solvers / s.users) * 100) : null,
        };
      }),
    );
  }),
);

codingRouter.get(
  "/problems/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const p = must(PROBLEM_BY_ID.get(String(req.params.id)), 404, "Задача не найдена");
    const last = await one<{ lang: string; code: string }>("SELECT lang, code FROM code_runs WHERE user_id = ? AND problem_id = ? ORDER BY at DESC LIMIT 1", u.id, p.id);
    const history = await all("SELECT lang, passed, total, ms, at FROM code_runs WHERE user_id = ? AND problem_id = ? ORDER BY at DESC LIMIT 10", u.id, p.id);
    // Tests travel to the browser because code runs there (Web Worker); see README.
    res.json({ problem: p, last, history, solved: (await solvedProblems(u.id)).has(p.id) });
  }),
);

codingRouter.post(
  "/problems/:id/submit",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const p = must(PROBLEM_BY_ID.get(String(req.params.id)), 404, "Задача не найдена");
    const lang = req.body?.lang === "python" ? "python" : "javascript";
    const passed = Math.max(0, Math.min(p.tests.length, Number(req.body?.passed) || 0));
    const wasSolved = (await solvedProblems(u.id)).has(p.id);
    await run(
      "INSERT INTO code_runs (user_id, problem_id, lang, code, passed, total, ms, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      u.id,
      p.id,
      lang,
      String(req.body?.code ?? "").slice(0, 50_000),
      passed,
      p.tests.length,
      Math.max(0, Number(req.body?.ms) || 0),
      Date.now(),
    );
    let xp = 0;
    if (passed === p.tests.length && !wasSolved) {
      xp = { Easy: 30, Medium: 60, Hard: 100 }[p.difficulty];
      await addXp(u.id, xp, "coding");
    }
    res.json({ accepted: passed === p.tests.length, xp });
  }),
);

codingRouter.post(
  "/problems/:id/hint",
  wrap(async (req, res) => {
    requireStudent(req);
    const p = must(PROBLEM_BY_ID.get(String(req.params.id)), 404, "Задача не найдена");
    try {
      res.json(await codeHint(p, str(req.body?.lang, 20), String(req.body?.code ?? "").slice(0, 8000), str(req.body?.failing, 600)));
    } catch (e) {
      if (e instanceof AiRefusal) throw new HttpError(422, "ИИ не смог дать подсказку. Посмотри встроенные подсказки к задаче");
      throw e;
    }
  }),
);

codingRouter.post(
  "/problems/:id/review",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const p = must(PROBLEM_BY_ID.get(String(req.params.id)), 404, "Задача не найдена");
    // A review makes sense for an accepted solution; it is the one last submitted.
    const run0 = must(
      await one<{ lang: string; code: string }>("SELECT lang, code FROM code_runs WHERE user_id = ? AND problem_id = ? AND passed = total AND total > 0 ORDER BY at DESC LIMIT 1", u.id, p.id),
      400,
      "Сначала реши задачу — разбор делается для принятого решения",
    );
    const key = `review:${p.id}:${crypto.createHash("sha1").update(run0.code).digest("hex")}`;
    const hit = await getCache(key);
    if (hit) return res.json(JSON.parse(hit));
    try {
      const out = await codeReview(p, run0.lang, run0.code);
      if (out.mode === "ai") await setCache(key, JSON.stringify(out));
      res.json(out);
    } catch (e) {
      if (e instanceof AiRefusal) throw new HttpError(422, "ИИ не смог разобрать решение");
      throw e;
    }
  }),
);

codingRouter.post(
  "/problems/:id/interview",
  wrap(async (req, res) => {
    requireStudent(req);
    const p = must(PROBLEM_BY_ID.get(String(req.params.id)), 404, "Задача не найдена");
    const history = (Array.isArray(req.body?.messages) ? req.body.messages : [])
      .slice(-20)
      .map((m: { role?: string; text?: unknown }) => ({ role: m.role === "assistant" ? "assistant" : "user", text: String(m.text ?? "").slice(0, 2000) }))
      .filter((m: { text: string }) => m.text);
    res.json(await interviewReply(p, str(req.body?.lang, 20), String(req.body?.code ?? ""), history, Math.max(0, Math.round(Number(req.body?.minutes) || 0))));
  }),
);

// ---------- vibe coding: versions and sharing ----------

codingRouter.get(
  "/lessons/:id/versions",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const lesson = lessonById(String(req.params.id));
    res.json(await all("SELECT id, note, at, LENGTH(code) size FROM work_versions WHERE user_id = ? AND lesson_id = ? ORDER BY id DESC LIMIT 60", u.id, lesson.id));
  }),
);

codingRouter.get(
  "/lessons/:id/versions/:v",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const v = must(await one<{ code: string }>("SELECT code FROM work_versions WHERE id = ? AND user_id = ? AND lesson_id = ?", Number(req.params.v), u.id, String(req.params.id)), 404, "Версия не найдена");
    res.json(v);
  }),
);

codingRouter.post(
  "/lessons/:id/restore",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const w = await getWork(u.id, String(req.params.id));
    if (w.submittedAt) throw new HttpError(409, "Работа уже сдана");
    const v = must(await one<{ code: string; at: number }>("SELECT code, at FROM work_versions WHERE id = ? AND user_id = ? AND lesson_id = ?", Number(req.body?.version), u.id, w.lessonId), 404, "Версия не найдена");
    await run("UPDATE lesson_works SET code = ? WHERE user_id = ? AND lesson_id = ?", v.code, u.id, w.lessonId);
    await addVersion(u.id, w.lessonId, v.code, `Возврат к версии от ${new Date(v.at + 5 * 3600_000).toISOString().slice(11, 16)}`);
    res.json({ ...w, code: v.code });
  }),
);

/** A public read-only link to the app as it is now (a snapshot; later edits need a new link). */
codingRouter.post(
  "/lessons/:id/share",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const lesson = lessonById(String(req.params.id));
    const w = await getWork(u.id, lesson.id);
    if (!w.code.trim()) throw new HttpError(400, "Приложение пока пустое");
    const token = crypto.randomBytes(9).toString("base64url");
    await run("INSERT INTO shared_apps (token, user_id, lesson_id, title, code, created_at) VALUES (?, ?, ?, ?, ?, ?)", token, u.id, lesson.id, lesson.title, w.code, Date.now());
    res.json({ token });
  }),
);

export const sharedRouter = Router();

sharedRouter.get(
  "/:token",
  wrap(async (req, res) => {
    const a = must(
      await one<{ title: string; code: string; user_id: string; created_at: number }>("SELECT title, code, user_id, created_at FROM shared_apps WHERE token = ?", String(req.params.token).slice(0, 40)),
      404,
      "Ссылка недействительна",
    );
    await run("UPDATE shared_apps SET views = views + 1 WHERE token = ?", String(req.params.token));
    const author = await one<{ first_name: string; grade: number | null }>("SELECT first_name, grade FROM users WHERE id = ?", a.user_id);
    res.json({ title: a.title, code: a.code, author: author ? `${author.first_name}${author.grade ? `, ${author.grade} класс` : ""}` : "", createdAt: a.created_at });
  }),
);

// ---------- Bug Blitz ----------

codingRouter.get(
  "/blitz",
  wrap(async (req, res) => {
    requireStudent(req);
    res.json([...BLITZ].sort(() => Math.random() - 0.5).sort((a, b) => a.level - b.level));
  }),
);

codingRouter.post(
  "/blitz/result",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const answers: { id: string; correct: boolean }[] = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const points = Math.max(0, Math.min(5000, Number(req.body?.points) || 0));
    for (const a of answers) {
      const q = BLITZ.find((b) => b.id === a.id);
      if (q) await run("INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, 'code-blitz', ?, ?, ?, 0, ?)", u.id, q.id, q.skill, a.correct ? 1 : 0, Date.now());
    }
    await addXp(u.id, Math.round(points / 10), "code-blitz");
    res.json({ xp: Math.round(points / 10) });
  }),
);

// ---------- vibe-coding lessons with the locked lesson mode ----------

// Live presence is kept in the database: on Vercel every request may hit a different instance.
type Presence = { lastSeen: number; lessonId: string | null; away: boolean };

async function setPresence(userId: string, patch: { lessonId?: string | null; away: boolean }) {
  if (patch.lessonId === undefined) {
    await run(
      "INSERT INTO presence (user_id, last_seen, lesson_id, away) VALUES (?, ?, NULL, ?) ON CONFLICT (user_id) DO UPDATE SET last_seen = excluded.last_seen, away = excluded.away",
      userId,
      Date.now(),
      patch.away ? 1 : 0,
    );
  } else {
    await run(
      "INSERT INTO presence (user_id, last_seen, lesson_id, away) VALUES (?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET last_seen = excluded.last_seen, lesson_id = excluded.lesson_id, away = excluded.away",
      userId,
      Date.now(),
      patch.lessonId,
      patch.away ? 1 : 0,
    );
  }
}

export async function presenceOf(userIds: string[]): Promise<Map<string, Presence>> {
  if (!userIds.length) return new Map();
  const rows = await all<{ user_id: string; last_seen: number; lesson_id: string | null; away: number }>(`SELECT * FROM presence WHERE user_id IN (${userIds.map(() => "?").join(",")})`, ...userIds);
  return new Map(rows.map((r) => [r.user_id, { lastSeen: r.last_seen, lessonId: r.lesson_id, away: !!r.away }]));
}

const PROMPT_XP = 2;
const PROMPT_XP_CAP = 20;

async function addVersion(userId: string, lessonId: string, code: string, note: string) {
  const last = await one<{ code: string }>("SELECT code FROM work_versions WHERE user_id = ? AND lesson_id = ? ORDER BY id DESC LIMIT 1", userId, lessonId);
  if (last?.code === code) return;
  await run("INSERT INTO work_versions (user_id, lesson_id, code, note, at) VALUES (?, ?, ?, ?, ?)", userId, lessonId, code, note, Date.now());
  // keep the 60 newest versions of a work
  await run("DELETE FROM work_versions WHERE user_id = ? AND lesson_id = ? AND id NOT IN (SELECT id FROM work_versions WHERE user_id = ? AND lesson_id = ? ORDER BY id DESC LIMIT 60)", userId, lessonId, userId, lessonId);
}

function lessonById(lessonId: string) {
  return must(
    LESSONS.find((l) => l.id === lessonId),
    404,
    "Урок не найден",
  );
}

export async function getWork(userId: string, lessonId: string): Promise<Work> {
  const row = await one<{ code: string; prompts: string; submitted_at: number | null; review: string | null; teacher_grade: number | null; teacher_comment: string }>(
    "SELECT * FROM lesson_works WHERE user_id = ? AND lesson_id = ?",
    userId,
    lessonId,
  );
  if (!row) {
    const lesson = lessonById(lessonId);
    await run("INSERT INTO lesson_works (user_id, lesson_id, code) VALUES (?, ?, ?)", userId, lessonId, lesson.starter);
    return { lessonId, code: lesson.starter, prompts: [], submittedAt: null, review: null, teacherGrade: null, teacherComment: "" };
  }
  return {
    lessonId,
    code: row.code,
    prompts: JSON.parse(row.prompts),
    submittedAt: row.submitted_at,
    review: row.review ? JSON.parse(row.review) : null,
    teacherGrade: row.teacher_grade,
    teacherComment: row.teacher_comment,
  };
}

async function classOf(userId: string) {
  return await one<{ code: string; active_lesson_id: string | null; locked: number; ai_enabled: number; unlock_code: string }>(
    `SELECT c.code, c.active_lesson_id, c.locked, c.ai_enabled, c.unlock_code FROM classes c JOIN class_members m ON m.class_code = c.code
     WHERE m.user_id = ? ORDER BY (c.active_lesson_id IS NOT NULL) DESC LIMIT 1`,
    userId,
  );
}

codingRouter.get(
  "/lessons",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const works = new Map(
      (
        await all<{ lesson_id: string; submitted_at: number | null; review: string | null; teacher_grade: number | null }>(
          "SELECT lesson_id, submitted_at, review, teacher_grade FROM lesson_works WHERE user_id = ?",
          u.id,
        )
      ).map((w) => [w.lesson_id, w]),
    );
    const c = await classOf(u.id);
    res.json({
      lessons: LESSONS.map((l) => {
        const w = works.get(l.id);
        return { ...l, submitted: !!w?.submitted_at, score: w?.review ? JSON.parse(w.review).score : null, teacherGrade: w?.teacher_grade ?? null };
      }),
      classRoom: c ? { code: c.code, activeLessonId: c.active_lesson_id, locked: !!c.locked, aiEnabled: !!c.ai_enabled } : null,
    });
  }),
);

codingRouter.get(
  "/lessons/:id/work",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    lessonById(String(req.params.id));
    res.json(await getWork(u.id, String(req.params.id)));
  }),
);

codingRouter.put(
  "/lessons/:id/work",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const w = await getWork(u.id, String(req.params.id));
    if (w.submittedAt) throw new HttpError(409, "Работа уже сдана");
    const code = String(req.body?.code ?? "").slice(0, 200_000);
    await run("UPDATE lesson_works SET code = ? WHERE user_id = ? AND lesson_id = ?", code, u.id, w.lessonId);
    const lastV = await one<{ at: number; note: string }>("SELECT at, note FROM work_versions WHERE user_id = ? AND lesson_id = ? ORDER BY id DESC LIMIT 1", u.id, w.lessonId);
    if (!lastV || lastV.note !== "Правка вручную" || Date.now() - lastV.at > 120_000) await addVersion(u.id, w.lessonId, code, "Правка вручную");
    else await run("UPDATE work_versions SET code = ?, at = ? WHERE id = (SELECT MAX(id) FROM work_versions WHERE user_id = ? AND lesson_id = ?)", code, Date.now(), u.id, w.lessonId);
    res.json({ ...w, code });
  }),
);

codingRouter.post(
  "/lessons/:id/vibe",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const lesson = lessonById(String(req.params.id));
    const c = await classOf(u.id);
    if (c && !c.ai_enabled) throw new HttpError(403, "Учитель выключил ИИ-помощника для класса. Пиши код сам");
    const prompt = str(req.body?.prompt, 800);
    if (!prompt) throw new HttpError(400, "Напиши, что нужно сделать");
    const w = await getWork(u.id, lesson.id);
    if (w.submittedAt) throw new HttpError(409, "Работа уже сдана");
    try {
      const out = await vibe(lesson, w.code, prompt, w.prompts);
      w.code = out.html;
      w.prompts.push({ at: Date.now(), text: prompt, reply: out.explanation, mode: out.mode });
      await run("UPDATE lesson_works SET code = ?, prompts = ? WHERE user_id = ? AND lesson_id = ?", w.code, JSON.stringify(w.prompts), u.id, lesson.id);
      await addVersion(u.id, lesson.id, w.code, `ИИ: ${prompt.slice(0, 120)}`);
      if (w.prompts.length * PROMPT_XP <= PROMPT_XP_CAP) await addXp(u.id, PROMPT_XP, "vibe");
      res.json({ work: w, explanation: out.explanation });
    } catch (e) {
      if (e instanceof AiRefusal) throw new HttpError(422, "ИИ не стал выполнять этот запрос. Переформулируй его ближе к заданию урока");
      throw e;
    }
  }),
);

codingRouter.post(
  "/lessons/:id/submit",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const lesson = lessonById(String(req.params.id));
    const w = await getWork(u.id, lesson.id);
    if (w.submittedAt) throw new HttpError(409, "Работа уже сдана");
    w.review = await review(lesson, w.code, w.prompts);
    w.submittedAt = Date.now();
    await run("UPDATE lesson_works SET submitted_at = ?, review = ? WHERE user_id = ? AND lesson_id = ?", w.submittedAt, JSON.stringify(w.review), u.id, lesson.id);
    await addXp(u.id, Math.round((lesson.xp * w.review.score) / 100), "lesson");
    res.json(w);
  }),
);

codingRouter.post(
  "/presence",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    await setPresence(u.id, { lessonId: req.body?.lessonId ?? null, away: !!req.body?.away });
    const c = await classOf(u.id);
    res.json(c ? { locked: !!c.locked, activeLessonId: c.active_lesson_id, aiEnabled: !!c.ai_enabled } : { locked: false, activeLessonId: null, aiEnabled: true });
  }),
);

codingRouter.post(
  "/lock-event",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const type = req.body?.type as LockEventType;
    if (type !== "left" && type !== "returned") throw new HttpError(400, "Неизвестное событие");
    await run("INSERT INTO lock_events (user_id, type, at) VALUES (?, ?, ?)", u.id, type, Date.now());
    await setPresence(u.id, { away: type === "left" });
    res.json({ ok: true });
  }),
);

codingRouter.post(
  "/unlock",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const c = must(await classOf(u.id), 404, "Вы не состоите в классе");
    if (str(req.body?.code, 10) !== c.unlock_code) throw new HttpError(403, "Неверный код учителя");
    await run("INSERT INTO lock_events (user_id, type, at) VALUES (?, 'unlocked', ?)", u.id, Date.now());
    await setPresence(u.id, { away: false });
    res.json({ ok: true });
  }),
);
