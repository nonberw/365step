import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient, type InValue } from "@libsql/client";

// libSQL: the same SQLite dialect locally (a file in data/) and in production
// (Turso, connected to Vercel through TURSO_DATABASE_URL and TURSO_AUTH_TOKEN).
// For a real rollout keep students' personal data on a server in Kazakhstan.

const REMOTE = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const FILE = process.env.DB_FILE || (process.env.VERCEL ? "/tmp/bsts.sqlite" : path.resolve("data", "bsts.sqlite"));
if (!REMOTE) fs.mkdirSync(path.dirname(FILE), { recursive: true });

export const db = createClient(REMOTE ? { url: REMOTE, authToken: process.env.TURSO_AUTH_TOKEN } : { url: `file:${FILE}` });
export const storage: "turso" | "file" = REMOTE ? "turso" : "file";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('student','teacher')),
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  grade INTEGER,
  class_letter TEXT,
  campus TEXT NOT NULL,
  subjects TEXT NOT NULL DEFAULT '[]',
  goals TEXT NOT NULL DEFAULT '{}',
  interests TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unlock_code TEXT NOT NULL,
  active_lesson_id TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  ai_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS class_members (
  class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (class_code, user_id)
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  item_id TEXT NOT NULL,
  skill TEXT NOT NULL DEFAULT '',
  correct INTEGER NOT NULL,
  ms INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_user ON attempts(user_id, module, item_id);
CREATE TABLE IF NOT EXISTS saved (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  item_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, module, item_id)
);
CREATE TABLE IF NOT EXISTS xp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS xp_user ON xp_log(user_id, at);
CREATE TABLE IF NOT EXISTS sat_tests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  rw_score INTEGER,
  math_score INTEGER
);
CREATE TABLE IF NOT EXISTS ai_questions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS study_plans (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ielts_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  text TEXT NOT NULL,
  result TEXT NOT NULL,
  overall REAL NOT NULL,
  at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS code_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  lang TEXT NOT NULL,
  code TEXT NOT NULL,
  passed INTEGER NOT NULL,
  total INTEGER NOT NULL,
  ms INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS code_runs_user ON code_runs(user_id, problem_id);
CREATE TABLE IF NOT EXISTS lesson_works (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  code TEXT NOT NULL,
  prompts TEXT NOT NULL DEFAULT '[]',
  submitted_at INTEGER,
  review TEXT,
  teacher_grade INTEGER,
  teacher_comment TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS lock_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  due_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  file TEXT NOT NULL,
  size INTEGER NOT NULL,
  pages INTEGER,
  text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_code TEXT NOT NULL REFERENCES classes(code) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  material_ids TEXT NOT NULL DEFAULT '[]',
  duration_min INTEGER NOT NULL DEFAULT 30,
  lock INTEGER NOT NULL DEFAULT 1,
  show_results INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  code TEXT UNIQUE,
  mode TEXT NOT NULL DEFAULT 'demo',
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  ends_at INTEGER,
  finished_at INTEGER
);
CREATE TABLE IF NOT EXISTS exam_attempts (
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers TEXT NOT NULL DEFAULT '{}',
  current INTEGER NOT NULL DEFAULT 0,
  away INTEGER NOT NULL DEFAULT 0,
  away_count INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  submitted_at INTEGER,
  score REAL,
  max_score REAL,
  grades TEXT,
  PRIMARY KEY (exam_id, student_id)
);
CREATE TABLE IF NOT EXISTS textbooks (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER,
  language TEXT NOT NULL DEFAULT 'ru',
  author TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  file TEXT NOT NULL,
  size INTEGER NOT NULL,
  pages TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS consult_slots (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('lesson','consultation')),
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  place TEXT NOT NULL DEFAULT '',
  online_url TEXT NOT NULL DEFAULT '',
  class_code TEXT,
  cancelled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS consult_slots_time ON consult_slots (starts_at);
CREATE TABLE IF NOT EXISTS consult_bookings (
  slot_id TEXT NOT NULL REFERENCES consult_slots(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (slot_id, student_id)
);
CREATE TABLE IF NOT EXISTS presence (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen INTEGER NOT NULL,
  lesson_id TEXT,
  away INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS book_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  place TEXT NOT NULL,
  stamps TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, book_id)
);
CREATE TABLE IF NOT EXISTS book_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  place TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS book_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER,
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ent_questions (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  type TEXT NOT NULL,
  lang TEXT NOT NULL,
  group_id TEXT,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ent_questions_pick ON ent_questions (subject, lang, type);
CREATE TABLE IF NOT EXISTS ent_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pair TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ru',
  target INTEGER,
  updated_at INTEGER NOT NULL,
  plan TEXT,
  plan_stale INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS ent_tests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  subjects TEXT NOT NULL,
  items TEXT NOT NULL,
  answers TEXT NOT NULL DEFAULT '{}',
  lang TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  finished_at INTEGER,
  result TEXT
);
CREATE TABLE IF NOT EXISTS review_queue (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  item_id TEXT NOT NULL,
  stage INTEGER NOT NULL DEFAULT 0,
  due_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, module, item_id)
);
CREATE TABLE IF NOT EXISTS duels (
  id TEXT PRIMARY KEY,
  class_code TEXT NOT NULL,
  challenger_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  items TEXT NOT NULL,
  challenger_result TEXT,
  opponent_result TEXT,
  winner_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE TABLE IF NOT EXISTS parent_links (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  parent_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  telegram_chat_id TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS parent_reports (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start INTEGER NOT NULL,
  data TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (student_id, week_start)
);
CREATE TABLE IF NOT EXISTS written_checks (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_code TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  task TEXT NOT NULL DEFAULT '',
  criteria TEXT NOT NULL DEFAULT '',
  max_score REAL NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  result TEXT,
  final_score REAL,
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  checked_at INTEGER
);
CREATE TABLE IF NOT EXISTS tg_chats (
  chat_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tg_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tg_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tg_messages_chat ON tg_messages(chat_id, at);
CREATE TABLE IF NOT EXISTS tg_updates (
  update_id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS parent_notes (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  channels TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS parent_notes_student ON parent_notes(student_id, sent_at);
CREATE TABLE IF NOT EXISTS eng_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  score INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item)
);
CREATE TABLE IF NOT EXISTS work_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  code TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS work_versions_work ON work_versions(user_id, lesson_id, at);
CREATE TABLE IF NOT EXISTS shared_apps (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ent_master_items (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  lang TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ent_master_items_subject ON ent_master_items(subject, lang);
CREATE TABLE IF NOT EXISTS ent_master_resp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  correct INTEGER NOT NULL,
  given TEXT NOT NULL,
  ms INTEGER NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ent_master_resp_user ON ent_master_resp(user_id, subject, at);
CREATE INDEX IF NOT EXISTS ent_master_resp_item ON ent_master_resp(item_id);
CREATE TABLE IF NOT EXISTS cad_designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  code TEXT NOT NULL,
  bbox TEXT NOT NULL,
  volume REAL NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS school_admins (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
`;

/** Resolves once the schema exists; the API waits for it before the first request. */
export const ready = (async () => {
  if (!REMOTE) await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA foreign_keys = ON");
  await db.executeMultiple(SCHEMA);
  // Columns added after the first release: ALTER fails harmlessly when they already exist.
  for (const sql of ["ALTER TABLE ent_profiles ADD COLUMN plan TEXT", "ALTER TABLE ent_profiles ADD COLUMN plan_stale INTEGER NOT NULL DEFAULT 1", "ALTER TABLE review_queue ADD COLUMN card TEXT"]) await db.execute(sql).catch(() => {});
})();

export type Row = Record<string, unknown>;

const args = (params: unknown[]) => params.map((p) => (p === undefined ? null : (p as InValue)));

async function query(sql: string, params: unknown[]) {
  const rs = await db.execute({ sql, args: args(params) });
  return rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
}

export const one = async <T = Row>(sql: string, ...params: unknown[]) => (await query(sql, params))[0] as T | undefined;
export const all = async <T = Row>(sql: string, ...params: unknown[]) => (await query(sql, params)) as T[];
export const run = async (sql: string, ...params: unknown[]) => {
  const rs = await db.execute({ sql, args: args(params) });
  return { changes: rs.rowsAffected };
};

export const id = (bytes = 9) => crypto.randomBytes(bytes).toString("base64url");
export const digits = (n: number) => Array.from({ length: n }, () => crypto.randomInt(10)).join("");

// Kazakhstan is UTC+5 all year.
const KZ_OFFSET = 5 * 3600_000;
export const dayKey = (t = Date.now()) => new Date(t + KZ_OFFSET).toISOString().slice(0, 10);
export const monthStart = (t = Date.now()) => {
  const d = new Date(t + KZ_OFFSET);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - KZ_OFFSET;
};

export async function addXp(userId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  await run("INSERT INTO xp_log (user_id, amount, reason, at) VALUES (?, ?, ?, ?)", userId, Math.round(amount), reason, Date.now());
}

export async function xpSummary(userId: string) {
  const total = (await one<{ s: number | null }>("SELECT SUM(amount) s FROM xp_log WHERE user_id = ?", userId))?.s ?? 0;
  const month = (await one<{ s: number | null }>("SELECT SUM(amount) s FROM xp_log WHERE user_id = ? AND at >= ?", userId, monthStart()))?.s ?? 0;
  const days = new Set((await all<{ at: number }>("SELECT at FROM xp_log WHERE user_id = ?", userId)).map((r) => dayKey(r.at)));
  let streak = 0;
  let cursor = Date.now();
  if (!days.has(dayKey(cursor))) cursor -= 86_400_000; // today not started yet: count from yesterday
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor -= 86_400_000;
  }
  const sorted = [...days].sort();
  let best = 0;
  let cur = 0;
  let prev = "";
  for (const d of sorted) {
    const expected = prev ? dayKey(Date.parse(prev + "T12:00:00Z") + 86_400_000 - KZ_OFFSET) : "";
    cur = prev && d === expected ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return { total, month, streak, best: Math.max(best, streak) };
}

export async function getCache(key: string): Promise<string | null> {
  return (await one<{ value: string }>("SELECT value FROM ai_cache WHERE key = ?", key))?.value ?? null;
}
export async function setCache(key: string, value: string) {
  await run("INSERT OR REPLACE INTO ai_cache (key, value, created_at) VALUES (?, ?, ?)", key, value, Date.now());
}
