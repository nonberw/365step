import type { Assignment, PlanTask, SatDomain, WeakSpot } from "../shared/types";
import { DOMAIN_RU, SAT_DOMAINS } from "../shared/types";
import { LESSONS } from "../shared/content";
import { PROBLEMS } from "../shared/problems";
import { VOCAB } from "../shared/vocab";
import { all, dayKey, one } from "./db";
import { SAT_BY_ID } from "../shared/sat";

// Read-only progress queries shared by the student dashboard and the teacher views.

export async function satStats(userId: string) {
  // attempts.skill holds the SAT domain, so AI-made questions are counted too
  const rows = await all<{ item_id: string; skill: string; correct: number; at: number }>("SELECT item_id, skill, correct, at FROM attempts WHERE user_id = ? AND module = 'sat'", userId);
  const byDomain = new Map<SatDomain, { right: number; total: number }>();
  for (const r of rows) {
    const domain = (r.skill || SAT_BY_ID.get(r.item_id)?.domain || "Algebra") as SatDomain;
    const s = byDomain.get(domain) ?? { right: 0, total: 0 };
    s.total++;
    s.right += r.correct;
    byDomain.set(domain, s);
  }
  const right = rows.reduce((n, r) => n + r.correct, 0);
  const lastTest = await one<{ rw_score: number; math_score: number }>("SELECT rw_score, math_score FROM sat_tests WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1", userId);
  let estimate: number | null = lastTest ? lastTest.rw_score + lastTest.math_score : null;
  if (estimate === null && rows.length >= 15) estimate = Math.round((400 + (right / rows.length) * 1100) / 10) * 10;
  return { attempts: rows.length, right, accuracy: rows.length ? right / rows.length : null, byDomain, estimate, fromTest: !!lastTest };
}

export async function ieltsEstimate(userId: string): Promise<number | null> {
  const subs = await all<{ overall: number }>("SELECT overall FROM ielts_submissions WHERE user_id = ? ORDER BY at DESC LIMIT 6", userId);
  if (!subs.length) return null;
  const avg = subs.reduce((s, r) => s + r.overall, 0) / subs.length;
  return Math.round(avg * 2) / 2;
}

export async function solvedProblems(userId: string): Promise<Set<string>> {
  return new Set((await all<{ problem_id: string }>("SELECT DISTINCT problem_id FROM code_runs WHERE user_id = ? AND passed = total AND total > 0", userId)).map((r) => r.problem_id));
}

export async function weakSpots(userId: string): Promise<WeakSpot[]> {
  const { byDomain } = await satStats(userId);
  const out: WeakSpot[] = [];
  for (const section of ["rw", "math"] as const) {
    for (const d of SAT_DOMAINS[section]) {
      const s = byDomain.get(d);
      if (s && s.total >= 3) out.push({ area: "sat", label: DOMAIN_RU[d], pct: Math.round((s.right / s.total) * 100), attempts: s.total, href: `/sat/bank?domain=${encodeURIComponent(d)}` });
    }
  }
  const reading = await all<{ correct: number }>("SELECT correct FROM attempts WHERE user_id = ? AND module IN ('ielts-reading','ielts-listening')", userId);
  if (reading.length >= 5) {
    out.push({ area: "ielts", label: "IELTS Reading и Listening", pct: Math.round((reading.reduce((n, r) => n + r.correct, 0) / reading.length) * 100), attempts: reading.length, href: "/ielts/reading" });
  }
  const blitz = await all<{ skill: string; correct: number }>("SELECT skill, correct FROM attempts WHERE user_id = ? AND module = 'code-blitz'", userId);
  const bySkill = new Map<string, { right: number; total: number }>();
  for (const b of blitz) {
    const s = bySkill.get(b.skill) ?? { right: 0, total: 0 };
    s.total++;
    s.right += b.correct;
    bySkill.set(b.skill, s);
  }
  for (const [skill, s] of bySkill) if (s.total >= 2) out.push({ area: "coding", label: `Код: ${skill}`, pct: Math.round((s.right / s.total) * 100), attempts: s.total, href: "/coding/blitz" });
  return out.sort((a, b) => a.pct - b.pct).slice(0, 4);
}

export async function assignmentDone(userId: string, a: Assignment): Promise<boolean> {
  const after = a.createdAt;
  switch (a.kind) {
    case "sat-test":
      return !!(await one("SELECT 1 FROM sat_tests WHERE user_id = ? AND finished_at >= ?", userId, after));
    case "sat-practice":
      return ((await one<{ n: number }>("SELECT COUNT(*) n FROM attempts WHERE user_id = ? AND module = 'sat' AND at >= ?", userId, after))?.n ?? 0) >= Number(a.ref || 10);
    case "ielts-writing":
      return !!(await one("SELECT 1 FROM ielts_submissions WHERE user_id = ? AND kind LIKE 'writing%' AND at >= ? AND (? = '' OR prompt_id = ?)", userId, after, a.ref, a.ref));
    case "ielts-speaking":
      return !!(await one("SELECT 1 FROM ielts_submissions WHERE user_id = ? AND kind = 'speaking' AND at >= ?", userId, after));
    case "coding":
      return !!(await one("SELECT 1 FROM code_runs WHERE user_id = ? AND problem_id = ? AND passed = total AND total > 0", userId, a.ref));
    case "lesson":
      return !!(await one("SELECT 1 FROM lesson_works WHERE user_id = ? AND lesson_id = ? AND submitted_at IS NOT NULL", userId, a.ref));
    case "vocab":
      return !!(await one("SELECT 1 FROM attempts WHERE user_id = ? AND module = 'vocab' AND item_id LIKE ? AND at >= ?", userId, `${a.ref}-%`, after));
    case "ent-full":
      return !!(await one("SELECT 1 FROM ent_tests WHERE user_id = ? AND kind = 'full' AND finished_at >= ?", userId, after));
    case "ent-subject":
      return !!(await one("SELECT 1 FROM ent_tests WHERE user_id = ? AND kind = 'subject' AND subjects = ? AND finished_at >= ?", userId, JSON.stringify([a.ref]), after));
    default:
      return false;
  }
}

export async function assignmentsFor(userId: string): Promise<Assignment[]> {
  const rows = await all<{ id: string; class_code: string; title: string; kind: Assignment["kind"]; ref: string; due_at: number | null; created_at: number }>(
    `SELECT a.* FROM assignments a JOIN class_members m ON m.class_code = a.class_code WHERE m.user_id = ? ORDER BY COALESCE(a.due_at, a.created_at) ASC`,
    userId,
  );
  return Promise.all(
    rows.map(async (r) => {
      const a: Assignment = { id: r.id, classCode: r.class_code, title: r.title, kind: r.kind, ref: r.ref, dueAt: r.due_at, createdAt: r.created_at };
      return { ...a, done: await assignmentDone(userId, a) };
    }),
  );
}

export function assignmentHref(a: Assignment): string {
  switch (a.kind) {
    case "sat-test":
      return "/sat/test";
    case "sat-practice":
      return "/sat/bank";
    case "ielts-writing":
      return "/ielts/writing";
    case "ielts-speaking":
      return "/ielts/speaking";
    case "coding":
      return `/coding/problems/${a.ref}`;
    case "lesson":
      return `/coding/lessons/${a.ref}`;
    case "vocab":
      return `/sat/vocab/${a.ref}`;
    case "ent-full":
    case "ent-subject":
      return "/ent";
  }
}

/** Today's plan: open assignments first, then goal-driven defaults. */
export async function todayPlan(userId: string, goals: { sat?: unknown; ielts?: unknown; coding?: boolean }, weak: WeakSpot[], assignments: Assignment[]): Promise<PlanTask[]> {
  const since = Date.parse(dayKey() + "T00:00:00+05:00");
  const count = async (sql: string, ...p: unknown[]) => (await one<{ n: number }>(sql, ...p))?.n ?? 0;
  const tasks: PlanTask[] = [];
  for (const a of assignments.filter((x) => !x.done).slice(0, 2)) {
    tasks.push({
      id: `as-${a.id}`,
      title: a.title,
      detail: a.dueAt ? `Задание учителя · до ${new Date(a.dueAt).toLocaleDateString("ru-RU")}` : "Задание учителя",
      href: assignmentHref(a),
      done: false,
      kind: "assignment",
    });
  }
  if (goals.sat || (!goals.ielts && !goals.coding)) {
    const satToday = await count("SELECT COUNT(*) n FROM attempts WHERE user_id = ? AND module = 'sat' AND at >= ?", userId, since);
    const satWeak = weak.find((w) => w.area === "sat");
    tasks.push({
      id: "sat",
      title: satWeak ? `SAT: ${satWeak.label}` : "SAT: 15 вопросов из банка",
      detail: `${Math.min(satToday, 15)}/15 вопросов сегодня`,
      href: satWeak?.href ?? "/sat/bank",
      done: satToday >= 15,
      kind: "sat",
    });
    const vocabToday = await count("SELECT COUNT(*) n FROM attempts WHERE user_id = ? AND module = 'vocab' AND at >= ?", userId, since);
    let nextUnit = VOCAB[0]!;
    for (const u of VOCAB) {
      if (!(await count("SELECT COUNT(*) n FROM attempts WHERE user_id = ? AND module = 'vocab' AND item_id LIKE ?", userId, `${u.id}-%`))) {
        nextUnit = u;
        break;
      }
    }
    tasks.push({ id: "vocab", title: `Словарь: «${nextUnit.title}»`, detail: "Карточки, текст и квиз на 10 вопросов", href: `/sat/vocab/${nextUnit.id}`, done: vocabToday >= 10, kind: "vocab" });
  }
  if (goals.ielts) {
    const sp = await count("SELECT COUNT(*) n FROM ielts_submissions WHERE user_id = ? AND kind = 'speaking' AND at >= ?", userId, since);
    tasks.push({ id: "ielts", title: "IELTS Speaking: одна карточка Part 2", detail: "2 минуты речи, оценка ИИ по 4 критериям", href: "/ielts/speaking", done: sp > 0, kind: "ielts" });
  }
  const solved = await solvedProblems(userId);
  const nextProblem = PROBLEMS.find((p) => !solved.has(p.id));
  if (nextProblem) {
    const codeToday = await count("SELECT COUNT(*) n FROM code_runs WHERE user_id = ? AND passed = total AND total > 0 AND at >= ?", userId, since);
    tasks.push({
      id: "code",
      title: `Задача: «${nextProblem.title}»`,
      detail: `${nextProblem.difficulty} · ${nextProblem.tags.join(", ")}`,
      href: `/coding/problems/${nextProblem.id}`,
      done: codeToday > 0,
      kind: "coding",
    });
  }
  return tasks.slice(0, 5);
}

export async function heatmap(userId: string) {
  const from = Date.now() - 366 * 86_400_000;
  const map = new Map<string, number>();
  for (const r of await all<{ amount: number; at: number }>("SELECT amount, at FROM xp_log WHERE user_id = ? AND at >= ?", userId, from)) {
    const k = dayKey(r.at);
    map.set(k, (map.get(k) ?? 0) + r.amount);
  }
  return [...map].map(([date, value]) => ({ date, value }));
}

export const lessonTitle = (id: string) => LESSONS.find((l) => l.id === id)?.title ?? id;
