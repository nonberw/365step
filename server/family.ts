import type { Assignment } from "../shared/types";
import { ENT_PAIR, ENT_SUBJECT } from "../shared/ent";
import { parentSummary, type EntPlan } from "./ai";
import { all, id, one, run, xpSummary } from "./db";
import { assignmentsFor, ieltsEstimate, satStats } from "./progress";
import { planProgress } from "./routes/ent";

// Everything a parent sees about one child, and the Friday report built from it.

const DAY = 86_400_000;
const KZ = 5 * 3600_000;

export const weekStart = (t = Date.now()) => {
  const d = new Date(t + KZ);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) - KZ;
};

const teacherName = (r: { first_name: string; last_name: string; title_t: string | null }) =>
  r.title_t ? `${{ mr: "Mr", ms: "Ms", mrs: "Mrs" }[r.title_t] ?? ""} ${r.last_name}`.trim() : `${r.first_name} ${r.last_name}`;
const share = (r: { n: number; ok: number | null } | undefined) => (r?.n ? Math.round(((r.ok ?? 0) / r.n) * 100) : null);

export async function snapshot(studentId: string) {
  const since = Date.now() - 7 * DAY;
  const u = (await one<{ first_name: string; last_name: string; grade: number | null; class_letter: string | null }>("SELECT first_name, last_name, grade, class_letter FROM users WHERE id = ?", studentId))!;
  const cls = await one<{ name: string }>("SELECT c.name FROM classes c JOIN class_members m ON m.class_code = c.code WHERE m.user_id = ? LIMIT 1", studentId);

  const profile = await one<{ pair: string; target: number | null; plan: string | null }>("SELECT pair, target, plan FROM ent_profiles WHERE user_id = ?", studentId);
  const entTests = await all<{ kind: string; finished_at: number; result: string }>("SELECT kind, finished_at, result FROM ent_tests WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY finished_at", studentId);
  const full = entTests
    .filter((t) => t.kind === "full")
    .map((t) => ({ at: t.finished_at, ...(JSON.parse(t.result) as { total: number; max: number; passedAll: boolean; subjects: { id: string; name: string; points: number; max: number; passed: boolean }[] }) }));
  const entWeek = await one<{ n: number; ok: number | null }>("SELECT COUNT(*) n, SUM(correct) ok FROM attempts WHERE user_id = ? AND module = 'ent' AND at >= ?", studentId, since);
  let plan: { week: number; done: number; of: number; focus: string } | null = null;
  if (profile?.plan) {
    const stored = JSON.parse(profile.plan) as { plan: EntPlan; createdAt: number };
    const p = await planProgress(studentId, stored.plan, stored.createdAt);
    plan = { week: p.week + 1, done: p.tasks.filter((t) => t.done >= t.of).length, of: p.tasks.length, focus: stored.plan.weeks[p.week]?.focus ?? "" };
  }

  const sat = await satStats(studentId);
  const satWeek = await one<{ n: number; ok: number | null }>("SELECT COUNT(*) n, SUM(correct) ok FROM attempts WHERE user_id = ? AND module = 'sat' AND at >= ?", studentId, since);
  const ielts = await ieltsEstimate(studentId);

  const consult = await all<{ title: string; kind: string; starts_at: number; first_name: string; last_name: string; title_t: string | null }>(
    `SELECT s.title, s.kind, s.starts_at, t.first_name, t.last_name, t.title AS title_t FROM consult_bookings b JOIN consult_slots s ON s.id = b.slot_id JOIN users t ON t.id = s.teacher_id
     WHERE b.student_id = ? AND s.cancelled = 0 AND s.starts_at >= ? ORDER BY s.starts_at`,
    studentId,
    since,
  );
  const assignments: Assignment[] = await assignmentsFor(studentId);
  const exams = await all<{ title: string; score: number | null; max_score: number | null; submitted_at: number }>(
    "SELECT e.title, a.score, a.max_score, a.submitted_at FROM exam_attempts a JOIN exams e ON e.id = a.exam_id WHERE a.student_id = ? AND a.submitted_at >= ? AND e.show_results = 1 ORDER BY a.submitted_at DESC",
    studentId,
    since - 21 * DAY,
  );
  const xp = await xpSummary(studentId);
  const log = await all<{ at: number; amount: number }>("SELECT at, amount FROM xp_log WHERE user_id = ? AND at >= ?", studentId, weekStart());
  const activity = Array.from({ length: 7 }, (_, i) => {
    const from = weekStart() + i * DAY;
    return log.filter((d) => d.at >= from && d.at < from + DAY).reduce((s, d) => s + d.amount, 0);
  });
  const review = await one<{ n: number }>("SELECT COUNT(*) n FROM review_queue WHERE user_id = ?", studentId);

  return {
    child: { name: `${u.first_name} ${u.last_name}`, firstName: u.first_name, grade: u.grade ? `${u.grade}${u.class_letter ?? ""}` : "", className: cls?.name ?? null },
    ent: profile
      ? {
          pair: ENT_PAIR[profile.pair]?.subjects.map((s) => ENT_SUBJECT[s]?.name ?? s) ?? [],
          target: profile.target,
          best: full.length ? Math.max(...full.map((f) => f.total)) : null,
          tests: full.slice(-6).map((f) => ({ at: f.at, total: f.total, passedAll: f.passedAll })),
          last: full.at(-1)?.subjects ?? null,
          mini: entTests.filter((t) => t.kind === "subject" && t.finished_at >= since).length,
          weekAnswers: entWeek?.n ?? 0,
          weekAccuracy: share(entWeek),
          plan,
        }
      : null,
    sat: { estimate: sat.estimate, accuracy: sat.accuracy, weekAnswers: satWeek?.n ?? 0, weekAccuracy: share(satWeek) },
    ielts,
    consultations: consult.map((c) => ({ title: c.title, kind: c.kind, at: c.starts_at, teacher: teacherName(c), past: c.starts_at < Date.now() })),
    assignments: assignments.slice(0, 10).map((a) => ({ title: a.title, done: !!a.done, dueAt: a.dueAt })),
    exams: exams.map((e) => ({ title: e.title, score: e.score, max: e.max_score, at: e.submitted_at })),
    activity,
    weekXp: activity.reduce((a, b) => a + b, 0),
    streak: xp.streak,
    reviewQueue: review?.n ?? 0,
  };
}

export type Snapshot = Awaited<ReturnType<typeof snapshot>>;
export type WeeklyReport = { week: number; data: Snapshot; summary: string; createdAt: number };

/** One report per child per week: built on Friday by cron, or on demand from the parent page. */
export async function weeklyReport(studentId: string): Promise<WeeklyReport> {
  const week = weekStart();
  const have = await one<{ data: string; summary: string; created_at: number }>("SELECT data, summary, created_at FROM parent_reports WHERE student_id = ? AND week_start = ?", studentId, week);
  if (have) return { week, data: JSON.parse(have.data) as Snapshot, summary: have.summary, createdAt: have.created_at };
  const data = await snapshot(studentId);
  const { child: _child, ...forAi } = data;
  const summary = await parentSummary(forAi, data.child.firstName);
  const now = Date.now();
  await run("INSERT OR IGNORE INTO parent_reports (id, student_id, week_start, data, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)", id(), studentId, week, JSON.stringify(data), summary, now);
  return { week, data, summary, createdAt: now };
}

// ---------- delivery: email (Resend) and Telegram, each only when configured ----------

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function reportText(r: WeeklyReport, url: string) {
  const d = r.data;
  const lines = [
    `Отчёт BSTS AI Lab за неделю: ${d.child.name}`,
    "",
    r.summary,
    "",
    d.ent
      ? `ЕНТ: лучший пробник ${d.ent.best ?? "—"} из 140${d.ent.target ? ` (цель ${d.ent.target})` : ""}, заданий за неделю ${d.ent.weekAnswers}${d.ent.weekAccuracy !== null ? `, верно ${d.ent.weekAccuracy}%` : ""}.`
      : null,
    `SAT: оценка ${d.sat.estimate ?? "—"}, заданий за неделю ${d.sat.weekAnswers}.`,
    `Задания учителя: выполнено ${d.assignments.filter((a) => a.done).length} из ${d.assignments.length}.`,
    d.consultations.length ? `Консультации: ${d.consultations.map((c) => c.title).join("; ")}.` : null,
    "",
    `Подробнее: ${url}`,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

export const channels = () => ({ email: !!(process.env.RESEND_API_KEY && process.env.REPORT_FROM), telegram: !!process.env.TELEGRAM_BOT_TOKEN, telegramBot: process.env.TELEGRAM_BOT_USERNAME ?? null });

export async function deliver(link: { email: string; telegram_chat_id: string | null; token: string }, r: WeeklyReport, origin: string) {
  const url = `${origin}/parent/${link.token}`;
  const text = reportText(r, url);
  const sent: string[] = [];
  if (link.email && channels().email) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.REPORT_FROM,
        to: link.email,
        subject: `Неделя ${r.data.child.firstName} в BSTS AI Lab`,
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;max-width:560px">${esc(text)
          .replace(/\n/g, "<br>")
          .replace(esc(url), `<a href="${url}">${esc(url)}</a>`)}</div>`,
      }),
    });
    if (res.ok) sent.push("email");
    else console.error("report email", res.status, await res.text().catch(() => ""));
  }
  if (link.telegram_chat_id && channels().telegram) {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: link.telegram_chat_id, text, disable_web_page_preview: true }),
    });
    if (res.ok) sent.push("telegram");
    else console.error("report telegram", res.status);
  }
  return sent;
}
