import type { Goals } from "./types";

export interface EntSession {
  id: string;
  name: string;
  /** Approximate planning anchor inside the seasonal window; never an official appointment. */
  date: string;
  dates: string;
  note: string;
  tentative: true;
}
const KZ = 5 * 3600_000;
const local = (now: Date) => new Date(now.getTime() + KZ);
export const isEntYear = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 2000 && value <= 2100;
/** In an eleven-grade school, grade 10 in 2026/27 graduates in spring 2028. */
export function suggestEntYear(grade: string | number | null | undefined, now = new Date()): number {
  const date = local(now), year = date.getUTCFullYear(), month = date.getUTCMonth();
  const schoolStart = year - (month < 8 ? 1 : 0);
  const n = Number(grade);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? schoolStart + Math.max(1, 12 - n) : year + (month >= 7 ? 1 : 0);
}
export function entSessionsForYear(year: number): EntSession[] {
  if (!isEntYear(year)) throw new Error("Invalid ENT exam year");
  return [
    { key: "jan", name: "Январская", anchor: "01-10", window: "январь — февраль", note: "ориентир для платного обучения" },
    { key: "mar", name: "Мартовская", anchor: "03-01", window: "март — апрель", note: "ориентир для платного обучения" },
    { key: "main", name: "Основная", anchor: "05-10", window: "май — июль", note: "подготовка к сессии для грантов и платного обучения" },
    { key: "aug", name: "Августовская", anchor: "08-10", window: "август", note: "ориентир для платного обучения" },
  ].map((s) => ({ id: `${year}-${s.key}`, name: s.name, date: `${year}-${s.anchor}`, dates: `${s.window} ${year}`, note: s.note, tentative: true }));
}
export function entSessionById(id: unknown): EntSession | undefined {
  const match = typeof id === "string" ? /^(\d{4})-(jan|mar|main|aug)$/.exec(id) : null;
  if (!match || !isEntYear(Number(match[1]))) return undefined;
  return entSessionsForYear(Number(match[1])).find((s) => s.id === id);
}
export function entYearChoices(grade: string | number | null | undefined, selected?: number | null, now = new Date()) {
  const first = local(now).getUTCFullYear();
  const years = Array.from({ length: Math.max(6, suggestEntYear(grade, now) - first + 1) }, (_, i) => first + i);
  if (isEntYear(selected) && !years.includes(selected)) years.push(selected);
  return years.sort((a, b) => a - b);
}
/** Migrate old drafts forced to 2027; a year explicitly chosen in the new UI is preserved. */
export function normaliseEntDraft<T extends { grade?: string | number | null; entYear?: number | null; entSession?: string | null }>(draft: T, now = new Date()): T & { entYear: number; entSession: string | null } {
  const year = isEntYear(draft.entYear) ? draft.entYear : suggestEntYear(draft.grade, now);
  const previous = entSessionById(draft.entSession);
  return { ...draft, entYear: year, entSession: previous ? `${year}-${previous.id.split("-")[1]}` : null };
}
const validDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && isEntYear(Number(s.slice(0, 4))) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
/** Saved dates override grade inference. Never silently move an existing student's explicit goal. */
export function entTargetFor(goals: Pick<Goals, "ent">, grade: string | number | null | undefined, now = new Date()) {
  const goal = goals.ent, saved = entSessionById(goal?.session);
  const date = validDate(goal?.date) ? goal.date : undefined;
  const year = date ? Number(date.slice(0, 4)) : saved ? Number(saved.id.slice(0, 4)) : isEntYear(goal?.year) ? goal.year : suggestEntYear(grade, now);
  const session = saved && saved.id.startsWith(`${year}-`) ? saved : entSessionsForYear(year)[2]!;
  return { year, date: date ?? session.date, session: session.id, name: date && !saved ? "Выбранная дата" : session.name, tentative: goal?.tentative !== false };
}
export const entTargetTime = (date: string) => Date.parse(`${date}T00:00:00+05:00`);
