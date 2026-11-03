/** Grade/year regressions and API checks use only a disposable database and no AI credentials. */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { entSessionsForYear, entTargetFor, entTargetTime, entYearChoices, normaliseEntDraft, suggestEntYear } from "../shared/entSchedule";

let checks = 0;
function eq(actual: unknown, expected: unknown, message: string) { assert.deepEqual(actual, expected, message); checks++; }
const now = new Date("2026-11-02T12:00:00Z");
for (const [grade, year] of [[8, 2030], [9, 2029], [10, 2028], [11, 2027]]) eq(suggestEntYear(grade, now), year, `grade ${grade}`);
for (const date of ["2027-01-15", "2027-06-15", "2027-08-15"]) eq(suggestEntYear(10, new Date(date)), 2028, `school year ${date}`);
eq(suggestEntYear(10, new Date("2026-08-31T18:59:59Z")), 2027, "before September in Kazakhstan");
eq(suggestEntYear(10, new Date("2026-08-31T19:00:00Z")), 2028, "September boundary in Kazakhstan");
eq(entYearChoices(10, undefined, now).includes(2028), true, "suggested year selectable");
eq(entYearChoices(10, 2025, now).includes(2025), true, "saved older explicit year remains selectable");
eq(normaliseEntDraft({ grade: "10", entSession: "2027-mar", entYear: null }, now), { grade: "10", entSession: "2028-mar", entYear: 2028 }, "old forced-2027 draft migration");
eq(normaliseEntDraft({ grade: "10", entSession: "2029-main", entYear: 2029 }, now).entSession, "2029-main", "manual year survives reopening");
eq(entSessionsForYear(2028).every((s) => s.id.startsWith("2028-") && s.date.startsWith("2028-") && s.dates.includes("2028") && s.tentative), true, "all sessions use selected year and tentative status");
eq(entTargetFor({}, 10, now).year, 2028, "missing ENT goal falls back to grade");
eq(entTargetFor({ ent: { target: 120, year: 2029 } }, 10, now).year, 2029, "manual goal year beats grade");
eq(entTargetFor({ ent: { target: 120, date: "2027-06-14" } }, 10, now).date, "2027-06-14", "explicit legacy appointment preserved");
eq(entTargetFor({ ent: { target: 120, session: "2028-mar" } }, 10, now).date, "2028-03-01", "selected session controls countdown");
eq(entTargetTime("2028-05-10"), Date.parse("2028-05-09T19:00:00Z"), "countdown timezone");

const folder = mkdtempSync(join(tmpdir(), "365step-ent-year-"));
const port = 22000 + process.pid % 10000, base = `http://127.0.0.1:${port}/api`;
const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], { env: { ...process.env, DB_FILE: join(folder, "test.sqlite"), API_PORT: String(port), ANTHROPIC_API_KEY: "", TURSO_DATABASE_URL: "", DATABASE_URL: "", TELEGRAM_BOT_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "", token = "";
child.stdout.on("data", (s) => logs += s); child.stderr.on("data", (s) => logs += s);
async function request(path: string, method = "GET", body?: unknown, status = 200) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json() as any;
  eq(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
try {
  let ready = false;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + "/health")).ok) { ready = true; break; } } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  assert.ok(ready, logs);
  eq((await request("/health")).ai, "demo", "no paid AI");
  const ent = { target: 120, year: 2028, session: "2028-main", date: "2028-05-10", tentative: true };
  const account = await request("/auth/register", "POST", { email: "ent-year@example.test", password: "ExamYear2028", firstName: "Year", lastName: "QA", grade: 10, consent: true, goals: { ent } }, 201);
  token = account.token;
  eq((await request("/auth/me")).goals.ent, ent, "registration saves 2028");
  const meta = await request("/ent/meta");
  eq(meta.exam.year, 2028, "overview year");
  eq(meta.sessions.every((s: any) => s.id.startsWith("2028-")), true, "overview sessions");
  await request("/ent/profile", "POST", { pair: meta.pairs[0].id, target: 120, lang: "ru" });
  const plan = await request("/ent/plan");
  eq(plan.exam.year, 2028, "plan year");
  eq(plan.mainSession, entTargetTime(ent.date), "plan countdown");
  eq(plan.plan.summary.includes("10-й класс") && plan.plan.summary.includes("2028"), true, "plan respects grade and year");
  if (entTargetTime(ent.date) - Date.now() > 365 * 86400000) eq(plan.plan.weeks.every((w: any) => w.tasks.every((t: any) => t.kind !== "full")), true, "long horizon starts with foundation and mini tests");
  const changed = { ...ent, year: 2029, session: "2029-mar", date: "2029-03-01" };
  await request("/auth/me", "PATCH", { goals: { ent: changed } });
  const rebuilt = await request("/ent/plan");
  eq(rebuilt.exam.year, 2029, "changing year invalidates cached plan");
  eq(rebuilt.mainSession, entTargetTime(changed.date), "changing session changes countdown");
  eq(rebuilt.plan.summary.includes("2029") && rebuilt.plan.summary.includes("мартовская"), true, "rebuilt plan uses manual session");
  eq((await request("/auth/me")).goals.ent, changed, "manual override survives reopening");
  await request("/auth/me", "PATCH", { goals: { ent: { ...ent, year: 2029 } } }, 400);
  await request("/auth/me", "PATCH", { goals: { ent: { target: 120, date: "2028-02-30" } } }, 400);
  eq((await request("/auth/me")).goals.ent, changed, "invalid update preserves previous goal");
  await request("/auth/me", "PATCH", { goals: { ent: { target: 120, date: "2027-06-14" } } });
  eq((await request("/auth/me")).goals.ent.date, "2027-06-14", "explicit date not coerced by grade");
  console.log(`${checks} ENT year assertions passed on disposable database`);
} finally { child.kill("SIGTERM"); }
