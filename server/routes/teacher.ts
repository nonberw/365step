import { Router } from "express";
import type { Assignment } from "../../shared/types";
import { LESSONS } from "../../shared/content";
import { ENT_SUBJECT } from "../../shared/ent";
import { PROBLEMS } from "../../shared/problems";
import { requireTeacher, toPublic, type UserRow } from "../auth";
import { all, digits, id, one, run, xpSummary } from "../db";
import { HttpError, must, str, wrap } from "../http";
import { assignmentDone, ieltsEstimate, satStats, solvedProblems, weakSpots } from "../progress";
import { getWork, presenceOf } from "./coding";

export const teacherRouter = Router();

const ONLINE_MS = 15_000;

async function ownClass(teacher: UserRow, code: string) {
  return must(
    await one<{ code: string; name: string; unlock_code: string; active_lesson_id: string | null; locked: number; ai_enabled: number; created_at: number }>(
      "SELECT * FROM classes WHERE code = ? AND teacher_id = ?",
      code.toUpperCase(),
      teacher.id,
    ),
    404,
    "Класс не найден",
  );
}

async function ownStudent(teacher: UserRow, studentId: string) {
  return must(
    await one<UserRow>(
      `SELECT u.* FROM users u JOIN class_members m ON m.user_id = u.id JOIN classes c ON c.code = m.class_code
       WHERE u.id = ? AND c.teacher_id = ? LIMIT 1`,
      studentId,
      teacher.id,
    ),
    404,
    "Ученик не найден в ваших классах",
  );
}

const members = async (code: string) => await all<UserRow>("SELECT u.* FROM users u JOIN class_members m ON m.user_id = u.id WHERE m.class_code = ? ORDER BY u.last_name", code);

const assignmentsOf = async (code: string) =>
  (
    await all<{ id: string; class_code: string; title: string; kind: Assignment["kind"]; ref: string; due_at: number | null; created_at: number }>(
      "SELECT * FROM assignments WHERE class_code = ? ORDER BY created_at DESC",
      code,
    )
  ).map((r) => ({ id: r.id, classCode: r.class_code, title: r.title, kind: r.kind, ref: r.ref, dueAt: r.due_at, createdAt: r.created_at }) as Assignment);

teacherRouter.get(
  "/overview",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const classes = await all<{ code: string; name: string; active_lesson_id: string | null; locked: number }>("SELECT code, name, active_lesson_id, locked FROM classes WHERE teacher_id = ? ORDER BY created_at", t.id);
    const now = Date.now();
    res.json({
      teacher: await toPublic(t),
      classes: await Promise.all(
        classes.map(async (c) => {
          const ms = await members(c.code);
          const xp = await Promise.all(ms.map((m) => xpSummary(m.id)));
          const seen = await presenceOf(ms.map((m) => m.id));
          const active = await one<{ n: number }>("SELECT COUNT(DISTINCT x.user_id) n FROM xp_log x JOIN class_members m ON m.user_id = x.user_id WHERE m.class_code = ? AND x.at >= ?", c.code, now - 7 * 86_400_000);
          return {
            ...c,
            students: ms.length,
            online: ms.filter((m) => now - (seen.get(m.id)?.lastSeen ?? 0) < ONLINE_MS).length,
            activeThisWeek: active?.n ?? 0,
            monthXp: xp.reduce((s, x) => s + x.month, 0),
            assignments: (await assignmentsOf(c.code)).length,
          };
        }),
      ),
    });
  }),
);

teacherRouter.post(
  "/classes",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const name = str(req.body?.name, 60);
    if (!name) throw new HttpError(400, "Назовите класс, например «7Б · Информатика»");
    let code = "";
    do code = "BSTS" + digits(3);
    while (await one("SELECT 1 FROM classes WHERE code = ?", code));
    await run("INSERT INTO classes (code, name, teacher_id, unlock_code, created_at) VALUES (?, ?, ?, ?, ?)", code, name, t.id, digits(4), Date.now());
    res.status(201).json({ code });
  }),
);

teacherRouter.get(
  "/classes/:code",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const c = await ownClass(t, String(req.params.code));
    const as = await assignmentsOf(c.code);
    const ms = await members(c.code);
    const students = await Promise.all(
      ms.map(async (m) => {
        const sat = await satStats(m.id);
        const xp = await xpSummary(m.id);
        return {
          id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          grade: m.grade ? `${m.grade}${m.class_letter ?? ""}` : "",
          satEstimate: sat.estimate,
          satAccuracy: sat.accuracy,
          ieltsEstimate: await ieltsEstimate(m.id),
          solved: (await solvedProblems(m.id)).size,
          monthXp: xp.month,
          streak: xp.streak,
          lastActive: (await one<{ at: number }>("SELECT at FROM xp_log WHERE user_id = ? ORDER BY at DESC LIMIT 1", m.id))?.at ?? null,
          done: await Promise.all(as.map((a) => assignmentDone(m.id, a))),
        };
      }),
    );
    res.json({
      classRoom: { code: c.code, name: c.name, unlockCode: c.unlock_code, activeLessonId: c.active_lesson_id, locked: !!c.locked, aiEnabled: !!c.ai_enabled },
      students: students.map(({ done, ...st }) => ({ ...st, assignmentsDone: done.filter(Boolean).length })),
      assignments: as.map((a, i) => ({ ...a, doneCount: students.filter((st) => st.done[i]).length })),
      lessons: LESSONS.map((l) => ({ id: l.id, title: l.title, grade: l.grade, task: l.task })),
      problems: PROBLEMS.map((p) => ({ id: p.id, title: p.title, difficulty: p.difficulty })),
    });
  }),
);

teacherRouter.post(
  "/classes/:code/settings",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const c = await ownClass(t, String(req.params.code));
    const b = req.body ?? {};
    if ("activeLessonId" in b) {
      if (b.activeLessonId !== null && !LESSONS.some((l) => l.id === b.activeLessonId)) throw new HttpError(404, "Урок не найден");
      await run("UPDATE classes SET active_lesson_id = ? WHERE code = ?", b.activeLessonId, c.code);
      if (b.activeLessonId === null) await run("UPDATE classes SET locked = 0 WHERE code = ?", c.code);
    }
    if ("locked" in b) await run("UPDATE classes SET locked = ? WHERE code = ?", b.locked ? 1 : 0, c.code);
    if ("aiEnabled" in b) await run("UPDATE classes SET ai_enabled = ? WHERE code = ?", b.aiEnabled ? 1 : 0, c.code);
    res.json({ ok: true });
  }),
);

teacherRouter.get(
  "/classes/:code/live",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const c = await ownClass(t, String(req.params.code));
    const now = Date.now();
    const ms = await members(c.code);
    const seen = await presenceOf(ms.map((m) => m.id));
    const rows = (
      await Promise.all(
        ms.map(async (m) => {
          const p = seen.get(m.id);
          const w = c.active_lesson_id ? await getWork(m.id, c.active_lesson_id) : null;
          return {
            id: m.id,
            name: `${m.first_name} ${m.last_name}`,
            online: now - (p?.lastSeen ?? 0) < ONLINE_MS,
            away: !!p?.away,
            inLesson: !!p?.lessonId,
            leftCount: (await one<{ n: number }>("SELECT COUNT(*) n FROM lock_events WHERE user_id = ? AND type = 'left' AND at >= ?", m.id, now - 6 * 3600_000))?.n ?? 0,
            promptCount: w?.prompts.length ?? 0,
            lastPrompt: w?.prompts.at(-1)?.text ?? null,
            submitted: !!w?.submittedAt,
            score: w?.review?.score ?? null,
            teacherGrade: w?.teacherGrade ?? null,
          };
        }),
      )
    ).sort((a, b) => Number(b.away && b.online) - Number(a.away && a.online) || a.name.localeCompare(b.name, "ru"));
    res.json({ classRoom: { code: c.code, name: c.name, unlockCode: c.unlock_code, activeLessonId: c.active_lesson_id, locked: !!c.locked, aiEnabled: !!c.ai_enabled }, rows });
  }),
);

teacherRouter.post(
  "/classes/:code/assignments",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const c = await ownClass(t, String(req.params.code));
    const kinds: Assignment["kind"][] = ["sat-test", "sat-practice", "ielts-writing", "ielts-speaking", "coding", "lesson", "vocab", "ent-full", "ent-subject"];
    const kind = req.body?.kind as Assignment["kind"];
    if (!kinds.includes(kind)) throw new HttpError(400, "Выберите тип задания");
    const title = str(req.body?.title, 120);
    if (!title) throw new HttpError(400, "Назовите задание");
    if (kind === "ent-subject" && !ENT_SUBJECT[str(req.body?.ref, 60)]) throw new HttpError(400, "Выберите предмет ЕНТ");
    const dueAt = req.body?.dueAt ? Date.parse(String(req.body.dueAt)) : null;
    await run(
      "INSERT INTO assignments (id, class_code, title, kind, ref, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id(),
      c.code,
      title,
      kind,
      str(req.body?.ref, 60),
      Number.isFinite(dueAt) ? dueAt : null,
      Date.now(),
    );
    res.status(201).json({ ok: true });
  }),
);

teacherRouter.delete(
  "/assignments/:id",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const a = must(await one<{ class_code: string }>("SELECT class_code FROM assignments WHERE id = ?", String(req.params.id)), 404, "Задание не найдено");
    await ownClass(t, a.class_code);
    await run("DELETE FROM assignments WHERE id = ?", String(req.params.id));
    res.json({ ok: true });
  }),
);

teacherRouter.get(
  "/students/:id",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const s = await ownStudent(t, String(req.params.id));
    const sat = await satStats(s.id);
    const xp = await xpSummary(s.id);
    res.json({
      student: await toPublic(s),
      xp,
      sat: { estimate: sat.estimate, accuracy: sat.accuracy, attempts: sat.attempts, domains: [...sat.byDomain].map(([d, v]) => ({ domain: d, ...v })) },
      ielts: await all<{ kind: string; overall: number; at: number }>("SELECT kind, overall, at FROM ielts_submissions WHERE user_id = ? ORDER BY at DESC LIMIT 10", s.id),
      ieltsEstimate: await ieltsEstimate(s.id),
      coding: { solved: [...(await solvedProblems(s.id))], total: PROBLEMS.length },
      lessons: (
        await all<{ lesson_id: string; submitted_at: number | null; review: string | null; teacher_grade: number | null }>(
          "SELECT lesson_id, submitted_at, review, teacher_grade FROM lesson_works WHERE user_id = ?",
          s.id,
        )
      ).map((w) => ({
        lessonId: w.lesson_id,
        title: LESSONS.find((l) => l.id === w.lesson_id)?.title ?? w.lesson_id,
        submitted: !!w.submitted_at,
        score: w.review ? JSON.parse(w.review).score : null,
        teacherGrade: w.teacher_grade,
      })),
      weak: await weakSpots(s.id),
      tests: await all("SELECT rw_score, math_score, finished_at FROM sat_tests WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 5", s.id),
    });
  }),
);

teacherRouter.get(
  "/students/:id/work/:lessonId",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const s = await ownStudent(t, String(req.params.id));
    const lessonId = String(req.params.lessonId);
    if (!LESSONS.some((l) => l.id === lessonId)) throw new HttpError(404, "Урок не найден");
    res.json({
      name: `${s.first_name} ${s.last_name}`,
      work: await getWork(s.id, lessonId),
      events: await all("SELECT type, at FROM lock_events WHERE user_id = ? ORDER BY at DESC LIMIT 20", s.id),
    });
  }),
);

teacherRouter.post(
  "/students/:id/grade/:lessonId",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const s = await ownStudent(t, String(req.params.id));
    const grade = Number(req.body?.grade);
    if (![2, 3, 4, 5].includes(grade)) throw new HttpError(400, "Оценка от 2 до 5");
    const lessonId = String(req.params.lessonId);
    await getWork(s.id, lessonId);
    await run("UPDATE lesson_works SET teacher_grade = ?, teacher_comment = ? WHERE user_id = ? AND lesson_id = ?", grade, str(req.body?.comment, 500), s.id, lessonId);
    res.json(await getWork(s.id, lessonId));
  }),
);
