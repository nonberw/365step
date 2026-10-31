import { Router } from "express";
import type { LeaderRow, StudentDashboard } from "../../shared/types";
import { requireStudent, requireUser, toPublic } from "../auth";
import { addXp, all, dayKey, monthStart, one, run, xpSummary } from "../db";
import { HttpError, str, wrap } from "../http";
import { aiMode } from "../ai";
import { assignmentsFor, heatmap, ieltsEstimate, lessonTitle, satStats, solvedProblems, todayPlan, weakSpots } from "../progress";

export const meRouter = Router();

meRouter.get(
  "/dashboard",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const user = await toPublic(u);
    const xp = await xpSummary(u.id);
    const sat = await satStats(u.id);
    const weak = await weakSpots(u.id);
    const assignments = await assignmentsFor(u.id);
    const lesson = await one<{ code: string; active_lesson_id: string; locked: number }>(
      `SELECT c.code, c.active_lesson_id, c.locked FROM classes c JOIN class_members m ON m.class_code = c.code
       WHERE m.user_id = ? AND c.active_lesson_id IS NOT NULL LIMIT 1`,
      u.id,
    );
    const dash: StudentDashboard = {
      user,
      xp: xp.total,
      monthXp: xp.month,
      streak: xp.streak,
      bestStreak: xp.best,
      satEstimate: sat.estimate,
      ieltsEstimate: await ieltsEstimate(u.id),
      solvedProblems: (await solvedProblems(u.id)).size,
      questionsDone: sat.attempts,
      accuracy: sat.accuracy,
      heatmap: await heatmap(u.id),
      weak,
      today: await todayPlan(u.id, user.goals, weak, assignments),
      assignments,
      activeLesson: lesson ? { classCode: lesson.code, lessonId: lesson.active_lesson_id, title: lessonTitle(lesson.active_lesson_id), locked: !!lesson.locked } : null,
      aiMode,
    };
    res.json(dash);
  }),
);

meRouter.post(
  "/join-class",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const code = str(req.body?.code, 12).toUpperCase();
    if (!(await one("SELECT 1 FROM classes WHERE code = ?", code))) throw new HttpError(404, "Класс с таким кодом не найден. Спросите код у учителя");
    await run("INSERT OR IGNORE INTO class_members (class_code, user_id, joined_at) VALUES (?, ?, ?)", code, u.id, Date.now());
    res.json({ ok: true });
  }),
);

/** Mini-games award a little XP, capped per day so they can't replace real practice. */
meRouter.post(
  "/game-score",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const game = str(req.body?.game, 30);
    const score = Math.max(0, Math.min(10_000, Number(req.body?.score) || 0));
    const since = Date.parse(dayKey() + "T00:00:00+05:00");
    const today = (await one<{ s: number | null }>("SELECT SUM(amount) s FROM xp_log WHERE user_id = ? AND reason LIKE 'game:%' AND at >= ?", u.id, since))?.s ?? 0;
    const award = Math.max(0, Math.min(Math.round(score / 10), 60 - today));
    await addXp(u.id, award, `game:${game}`);
    res.json({ xp: award });
  }),
);

meRouter.get(
  "/leaderboard",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const scope = req.query.scope === "school" ? "school" : "class";
    const since = monthStart();
    let users: { id: string; first_name: string; last_name: string; grade: number | null; class_letter: string | null }[];
    if (scope === "class" && u.role === "student") {
      users = await all(
        `SELECT DISTINCT u.id, u.first_name, u.last_name, u.grade, u.class_letter FROM users u
         JOIN class_members m ON m.user_id = u.id
         WHERE m.class_code IN (SELECT class_code FROM class_members WHERE user_id = ?)`,
        u.id,
      );
      // No class (B2C): rank against every student.
      if (!users.length) users = await all("SELECT id, first_name, last_name, grade, class_letter FROM users WHERE role = 'student'");
    } else {
      users = await all("SELECT id, first_name, last_name, grade, class_letter FROM users WHERE role = 'student'");
    }
    const rows: LeaderRow[] = (
      await Promise.all(
        users.map(async (x) => {
          const month = (await one<{ s: number | null }>("SELECT SUM(amount) s FROM xp_log WHERE user_id = ? AND at >= ?", x.id, since))?.s ?? 0;
          return {
            name: `${x.first_name} ${x.last_name.slice(0, 1)}.`,
            meta: x.grade ? `${x.grade}${x.class_letter ?? ""}` : "",
            monthXp: month,
            streak: (await xpSummary(x.id)).streak,
            isMe: x.id === u.id,
          };
        }),
      )
    )
      .sort((a, b) => b.monthXp - a.monthXp)
      .slice(0, 30);
    res.json(rows);
  }),
);
