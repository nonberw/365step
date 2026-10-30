import { hashPassword } from "./auth";
import { SAT_BANK } from "../shared/sat";
import { PROBLEMS } from "../shared/problems";
import { VOCAB } from "../shared/vocab";
import type { InStatement, InValue } from "@libsql/client";
import { db, id, one } from "./db";

// Demo data so a fresh install shows full dashboards. Every name is marked as demo.
// Logins are listed in README.md. All inserts go to the database as one transaction:
// over the network to Turso thousands of separate queries would take minutes.

const batch: InStatement[] = [];
const run = (sql: string, ...args: unknown[]) => void batch.push({ sql, args: args.map((a) => (a === undefined ? null : a)) as InValue[] });

export const DEMO = {
  password: process.env.DEMO_PASSWORD || "Demo2026bsts",
  teacher: "teacher@demo.bsts.kz",
  student: "student@demo.bsts.kz",
  classCode: "BSTS7B",
  unlockCode: "4815",
};

function user(role: "student" | "teacher", email: string, first: string, last: string, extra: Record<string, unknown> = {}) {
  const { hash, salt } = hashPassword(DEMO.password);
  const userId = id();
  run(
    `INSERT INTO users (id, role, email, pass_hash, salt, first_name, last_name, title, grade, class_letter, campus, subjects, goals, interests, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'zhandosov', ?, ?, ?, ?)`,
    userId,
    role,
    email,
    hash,
    salt,
    first,
    last,
    extra.title ?? null,
    extra.grade ?? null,
    extra.classLetter ?? null,
    JSON.stringify(extra.subjects ?? []),
    JSON.stringify(extra.goals ?? {}),
    JSON.stringify(extra.interests ?? []),
    Date.now() - 60 * 86_400_000,
  );
  return userId;
}

/** Plausible practice history over the last `days` days. */
function history(userId: string, days: number, skill: number, seed: number) {
  let s = seed;
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const now = Date.now();
  for (let d = days; d >= 0; d--) {
    if (rand() > 0.72 && d > 3) continue;
    const at = now - d * 86_400_000 - Math.floor(rand() * 8) * 3600_000;
    const n = 4 + Math.floor(rand() * 10);
    for (let i = 0; i < n; i++) {
      const q = SAT_BANK[Math.floor(rand() * SAT_BANK.length)]!;
      const p = skill - (q.difficulty - 2) * 0.15 + (q.section === "math" ? 0.05 : -0.05);
      const correct = rand() < p;
      run("INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, 'sat', ?, ?, ?, ?, ?)", userId, q.id, q.domain, correct ? 1 : 0, 40_000 + Math.floor(rand() * 60_000), at + i * 90_000);
      run("INSERT INTO xp_log (user_id, amount, reason, at) VALUES (?, ?, 'sat', ?)", userId, correct ? 3 + q.difficulty : 1, at + i * 90_000);
    }
    if (rand() > 0.7) {
      const unit = VOCAB[Math.floor(rand() * VOCAB.length)]!;
      for (const w of unit.words.slice(0, 6)) run("INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, 'vocab', ?, ?, ?, 0, ?)", userId, w.id, unit.id, rand() < skill ? 1 : 0, at);
      run("INSERT INTO xp_log (user_id, amount, reason, at) VALUES (?, 10, 'vocab', ?)", userId, at);
    }
  }
}

export async function seedDemo() {
  // Databases seeded before the school report existed: make the demo teacher head of studies once.
  await db.execute({
    sql: "INSERT INTO school_admins (user_id, created_at) SELECT id, ? FROM users WHERE email = ? AND NOT EXISTS (SELECT 1 FROM school_admins)",
    args: [Date.now(), DEMO.teacher],
  });
  if (await one("SELECT 1 FROM users LIMIT 1")) return;
  batch.length = 0;
  const teacherId = user("teacher", DEMO.teacher, "Айгерим", "Демо", { title: "ms", subjects: ["Информатика", "SAT Math"] });
  run("INSERT INTO school_admins (user_id, created_at) VALUES (?, ?)", teacherId, Date.now());
  run(
    "INSERT INTO classes (code, name, teacher_id, unlock_code, active_lesson_id, locked, ai_enabled, created_at) VALUES (?, ?, ?, ?, NULL, 0, 1, ?)",
    DEMO.classCode,
    "7Б · Информатика (демо)",
    teacherId,
    DEMO.unlockCode,
    Date.now(),
  );

  const students: [string, string, string, number, number, Record<string, unknown>][] = [
    [DEMO.student, "Айым", "Демо", 10, 0.68, { goals: { sat: { target: 1450, date: "2027-03-13" }, ielts: { target: 7, date: "2027-02-20" }, coding: true }, interests: ["robotics", "design"] }],
    ["arman@demo.bsts.kz", "Арман", "Демо", 10, 0.74, { goals: { sat: { target: 1500, date: "2027-03-13" } } }],
    ["aliya@demo.bsts.kz", "Алия", "Демо", 10, 0.81, { goals: { ielts: { target: 7.5, date: "2027-01-15" } } }],
    ["daniyar@demo.bsts.kz", "Данияр", "Демо", 10, 0.55, { goals: { coding: true } }],
  ];
  students.forEach(([email, first, last, grade, skill, extra], i) => {
    const sid = user("student", email, first, last, { grade, classLetter: "А", ...extra });
    run("INSERT INTO class_members (class_code, user_id, joined_at) VALUES (?, ?, ?)", DEMO.classCode, sid, Date.now());
    history(sid, 75, skill, 1000 + i * 77);
    const solved = PROBLEMS.slice(0, 2 + i * 2);
    for (const p of solved) {
      run("INSERT INTO code_runs (user_id, problem_id, lang, code, passed, total, ms, at) VALUES (?, ?, 'python', '# demo', ?, ?, 120, ?)", sid, p.id, p.tests.length, p.tests.length, Date.now() - (10 - i) * 86_400_000);
      run("INSERT INTO xp_log (user_id, amount, reason, at) VALUES (?, 30, 'coding', ?)", sid, Date.now() - (10 - i) * 86_400_000);
    }
  });

  const now = Date.now();
  run(
    "INSERT INTO assignments (id, class_code, title, kind, ref, due_at, created_at) VALUES (?, ?, ?, 'sat-practice', '20', ?, ?)",
    id(),
    DEMO.classCode,
    "20 вопросов SAT из банка",
    now + 3 * 86_400_000,
    now - 86_400_000,
  );
  run(
    "INSERT INTO assignments (id, class_code, title, kind, ref, due_at, created_at) VALUES (?, ?, ?, 'coding', 'valid-brackets', ?, ?)",
    id(),
    DEMO.classCode,
    "Решить «Правильные скобки»",
    now + 5 * 86_400_000,
    now - 86_400_000,
  );
  run(
    "INSERT INTO assignments (id, class_code, title, kind, ref, due_at, created_at) VALUES (?, ?, ?, 'ielts-writing', '', ?, ?)",
    id(),
    DEMO.classCode,
    "IELTS Writing Task 2 — любое задание",
    now + 7 * 86_400_000,
    now - 86_400_000,
  );
  try {
    await db.batch(batch, "write");
  } catch (err) {
    // Another instance seeded at the same moment: its data is already there.
    if (!(await one("SELECT 1 FROM users LIMIT 1"))) throw err;
  }
}
