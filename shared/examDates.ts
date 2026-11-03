// Exam sessions students pick at sign-up.
// SAT: College Board "SAT Weekend test dates" (same for U.S. and international students), checked 1 Nov 2026:
//   https://satsuite.collegeboard.org/sat/dates-deadlines — 2027–28 dates are marked "anticipated" there.
// ENT: year-specific seasonal planning windows; not a published appointment calendar.
// IELTS: computer-delivered IELTS runs several times a week in Almaty and Astana, so students pick a month.

export interface SatDate {
  date: string;
  /** registration deadline; null when not announced yet */
  deadline: string | null;
  tentative?: boolean;
}

export const SAT_DATES: SatDate[] = [
  { date: "2026-10-03", deadline: "2026-09-18" },
  { date: "2026-11-07", deadline: "2026-10-23" },
  { date: "2026-12-05", deadline: "2026-11-20" },
  { date: "2027-03-06", deadline: "2027-02-19" },
  { date: "2027-05-01", deadline: "2027-04-16" },
  { date: "2027-06-05", deadline: "2027-05-21" },
  { date: "2027-08-28", deadline: null, tentative: true },
  { date: "2027-09-18", deadline: null, tentative: true },
  { date: "2027-10-09", deadline: null, tentative: true },
  { date: "2027-11-06", deadline: null, tentative: true },
  { date: "2027-12-04", deadline: null, tentative: true },
];

// Kept for compatibility with older imports; new flows select the year explicitly.
export { entSessionsForYear, suggestEntYear } from "./entSchedule";
export type { EntSession } from "./entSchedule";
import { entSessionsForYear } from "./entSchedule";
export const ENT_SESSIONS_2027 = entSessionsForYear(2027);

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** "2026-12-05" → "5 декабря 2026" */
export function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_GEN[m! - 1]} ${y}`;
}

/** Next 14 months starting from the current one, as "YYYY-MM". */
export function ieltsMonths(from = new Date()): { value: string; label: string }[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
  });
}

/** Whole days from today to an ISO date (negative when it has passed). */
export function daysTo(iso: string, now = new Date()) {
  const t = Date.parse(`${iso}T09:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil((t - today) / 86_400_000);
}

/** "2026-12-15" → "декабрь 2026" */
export function monthLabel(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m! - 1]} ${y}`;
}
