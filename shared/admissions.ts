// Admissions reference data shared by the server and the site: scholarships, Nazarbayev University thresholds,
// recommendation statuses and deadline reminders. Sources and caveats: docs/research/admissions-help.md.

import { SAT_DATES, daysTo } from "./examDates";

// ---------- scholarships ----------

export interface Scholarship {
  id: string;
  name: string;
  flag: string;
  /** where the student would study */
  where: string;
  covers: string;
  who: string;
  /** usual application window; exact dates change every year */
  window: string;
  url: string;
  tags: ("kz-citizen" | "olympiad" | "need-blind" | "full-need" | "government" | "fee")[];
  /** contests from the catalog that lead here */
  contests?: string[];
  note?: string;
}

/** Checked against official pages and press for the 2026–27 cycle; always confirm dates on the official site. */
export const SCHOLARSHIPS: Scholarship[] = [
  {
    id: "bolashak",
    name: "Болашак · бакалавриат",
    flag: "🇰🇿",
    where: "вузы QS Top-100 по предмету",
    covers: "обучение, проживание, перелёт; отработка в Казахстане после учёбы",
    who: "с 2026 года на бакалавриат берут только призёров (I–III места) международных олимпиад по школьным предметам и международных научных конкурсов за последние 3 года; в 2026 году 20 мест на бакалавриат из 635",
    window: "документы через eGov: 16 марта — 16 октября 2026 (окно 2026 года закрыто, следующее ожидается весной 2027)",
    url: "https://bolashak.gov.kz",
    tags: ["kz-citizen", "olympiad", "government"],
    contests: ["izho", "daryn-republican", "presidential-olympiad", "isef"],
    note: "Путь на международную олимпиаду в Казахстане идёт через республиканскую олимпиаду и отбор в сборную.",
  },
  {
    id: "nu-grant",
    name: "Государственный грант Nazarbayev University",
    flag: "🇰🇿",
    where: "Nazarbayev University, Астана",
    covers: "обучение и стипендия",
    who: "граждане Казахстана, прошедшие по категории NUET, SAT, олимпиад, NIS, IB или A-level",
    window: "приём обычно с конца сентября; для категории NUET ожидаемо до ~20 ноября 2026 (сроки цикла 2027–28 ещё не опубликованы)",
    url: "https://admissions.nu.edu.kz",
    tags: ["kz-citizen", "government"],
  },
  {
    id: "ent-grant",
    name: "Государственный грант по ЕНТ",
    flag: "🇰🇿",
    where: "вузы Казахстана",
    covers: "обучение и стипендия",
    who: "граждане Казахстана; конкурс по баллу ЕНТ и выбранной группе образовательных программ",
    window: "заявления обычно в июле, после основной сессии ЕНТ",
    url: "https://www.gov.kz/memleket/entities/edu",
    tags: ["kz-citizen", "government"],
  },
  {
    id: "need-blind",
    name: "Need-blind для иностранцев",
    flag: "🇺🇸",
    where: "Harvard, Yale, Princeton, MIT, Amherst, Dartmouth, Bowdoin",
    covers: "покрывают 100% доказанной потребности семьи; решение о приёме не зависит от того, нужна ли помощь",
    who: "все иностранные абитуриенты, включая Казахстан",
    window: "вместе с заявкой: EA/ED 1–15 ноября, RD 1–15 января; плюс CSS Profile",
    url: "https://cssprofile.collegeboard.org",
    tags: ["need-blind", "full-need"],
    note: "Список вузов меняется: проверяй страницу financial aid каждого вуза.",
  },
  {
    id: "nyuad",
    name: "NYU Abu Dhabi",
    flag: "🇦🇪",
    where: "NYU Abu Dhabi, ОАЭ",
    covers: "покрывает всю доказанную потребность каждого принятого студента",
    who: "все абитуриенты, включая иностранцев",
    window: "ED I обычно 1 ноября, ED II и RD обычно 1 января",
    url: "https://nyuad.nyu.edu/en/admissions/undergraduate/financial-aid.html",
    tags: ["full-need"],
  },
  {
    id: "kaist",
    name: "KAIST International Scholarship",
    flag: "🇰🇷",
    where: "KAIST, Южная Корея",
    covers: "полное обучение и ежемесячная стипендия при сохранении среднего балла",
    who: "иностранцы, принятые на бакалавриат",
    window: "несколько раундов приёма осенью и зимой",
    url: "https://admission.kaist.ac.kr/intl-undergraduate",
    tags: ["full-need"],
  },
  {
    id: "gks",
    name: "Global Korea Scholarship · бакалавриат",
    flag: "🇰🇷",
    where: "вузы Южной Кореи",
    covers: "обучение, стипендия, перелёт и год корейского языка",
    who: "иностранцы до 25 лет, Казахстан в списке стран",
    window: "обычно сентябрь — октябрь, через посольство или напрямую через вуз",
    url: "https://www.studyinkorea.go.kr",
    tags: ["government"],
  },
  {
    id: "mext",
    name: "MEXT · бакалавриат",
    flag: "🇯🇵",
    where: "вузы Японии",
    covers: "обучение, стипендия, перелёт и подготовительный год",
    who: "отбор через посольство Японии в Казахстане: письменные экзамены и интервью",
    window: "обычно весна — начало лета",
    url: "https://www.studyinjapan.go.jp/en/",
    tags: ["government"],
  },
  {
    id: "turkiye",
    name: "Türkiye Bursları",
    flag: "🇹🇷",
    where: "вузы Турции",
    covers: "обучение, стипендия, общежитие, перелёт и год турецкого языка",
    who: "иностранцы до 21 года на бакалавриат",
    window: "обычно январь — февраль",
    url: "https://www.turkiyeburslari.gov.tr",
    tags: ["government"],
  },
  {
    id: "hungaricum",
    name: "Stipendium Hungaricum",
    flag: "🇭🇺",
    where: "вузы Венгрии",
    covers: "обучение, стипендия, жильё",
    who: "граждане стран-партнёров, Казахстан в их числе",
    window: "обычно до середины января",
    url: "https://stipendiumhungaricum.hu",
    tags: ["government"],
  },
  {
    id: "csc",
    name: "Стипендия правительства Китая (CSC)",
    flag: "🇨🇳",
    where: "вузы Китая",
    covers: "обучение, жильё, стипендия",
    who: "иностранцы; подача через посольство Китая или через вуз",
    window: "обычно январь — апрель",
    url: "https://www.campuschina.org",
    tags: ["government"],
  },
  {
    id: "fee-waiver",
    name: "Common App fee waiver",
    flag: "🧾",
    where: "вузы на Common App",
    covers: "освобождение от сбора за заявку",
    who: "по финансовым критериям; в 2026–27 Common App показывает, принимает ли вуз waiver от иностранцев (all / US only / no)",
    window: "отмечается в профиле Common App до отправки заявки",
    url: "https://www.commonapp.org",
    tags: ["fee"],
  },
];

// ---------- Nazarbayev University ----------

export type NuCategory = "nuet" | "sat" | "olympiad";

export interface NuProfile {
  category: NuCategory;
  nuetMath?: number;
  nuetCtps?: number;
  sat?: number;
  ieltsOverall?: number;
  ieltsWriting?: number;
  /** lowest of Listening, Reading, Speaking */
  ieltsOther?: number;
  ieltsOnline?: boolean;
  olympiad?: string;
}

/** NU Admission Policy and Procedures (ed. 30.11.2025): NUET 120 total and 50 per subject; press reports 130 / 60 for the 2025 cycle. */
export const NU = { nuetTotal: 120, nuetEach: 50, nuetTotalReported: 130, nuetEachReported: 60, sat: 1240, ielts: 6, ieltsWriting: 6, ieltsOther: 5.5 } as const;

export interface NuCheck {
  label: string;
  ok: boolean | null;
  detail: string;
}

export function nuReadiness(p: NuProfile): NuCheck[] {
  const out: NuCheck[] = [];
  if (p.category === "nuet") {
    const m = p.nuetMath;
    const c = p.nuetCtps;
    const known = m !== undefined && c !== undefined;
    const total = (m ?? 0) + (c ?? 0);
    out.push({
      label: "NUET",
      ok: known ? total >= NU.nuetTotal && m! >= NU.nuetEach && c! >= NU.nuetEach : null,
      detail: known
        ? `${m} + ${c} = ${total}. Минимум по правилам ${NU.nuetTotal} и ${NU.nuetEach} по каждому предмету${total < NU.nuetTotalReported || Math.min(m!, c!) < NU.nuetEachReported ? `; в 2025 году, по сообщениям, порог был ${NU.nuetTotalReported} и ${NU.nuetEachReported} — целься выше` : ""}`
        : "впиши баллы пробника: математика и Critical Thinking, по 0–120",
    });
  }
  if (p.category === "sat") out.push({ label: "SAT", ok: p.sat === undefined ? null : p.sat >= NU.sat, detail: p.sat === undefined ? `нужно от ${NU.sat}, без суперскоринга` : `${p.sat} из нужных ${NU.sat}, суперскоринг не принимают` });
  if (p.category === "olympiad")
    out.push({ label: "Олимпиада", ok: p.olympiad ? true : null, detail: p.olympiad ? `${p.olympiad}. Подходит золото или серебро республиканской олимпиады текущего года или I–III место международной за 3 года` : "золото или серебро республиканской олимпиады текущего года или I–III место международной за 3 года" });
  if (p.category === "olympiad") {
    out.push({ label: "Английский", ok: true, detail: "для олимпиадников минимум по английскому не требуется" });
    return out;
  }
  if (p.ieltsOnline) out.push({ label: "IELTS", ok: false, detail: "IELTS Online и IELTS Indicator NU не принимает: нужен тест в центре" });
  else if (p.ieltsOverall === undefined) out.push({ label: "IELTS", ok: null, detail: `нужно ${NU.ielts.toFixed(1)}, Writing ${NU.ieltsWriting.toFixed(1)}, остальные от ${NU.ieltsOther}` });
  else {
    const gaps = [
      p.ieltsOverall < NU.ielts && `общий ${p.ieltsOverall} < ${NU.ielts.toFixed(1)}`,
      p.ieltsWriting !== undefined && p.ieltsWriting < NU.ieltsWriting && `Writing ${p.ieltsWriting} < ${NU.ieltsWriting.toFixed(1)}`,
      p.ieltsOther !== undefined && p.ieltsOther < NU.ieltsOther && `один из навыков ${p.ieltsOther} < ${NU.ieltsOther}`,
    ].filter(Boolean);
    out.push({ label: "IELTS", ok: gaps.length === 0, detail: gaps.length ? `не хватает: ${gaps.join(", ")}` : `${p.ieltsOverall} — проходит (Writing от ${NU.ieltsWriting.toFixed(1)}, остальные от ${NU.ieltsOther})` });
  }
  return out;
}

// ---------- recommendations ----------

export const REC_STATUSES = {
  idea: { label: "думаю попросить", emoji: "💭" },
  asked: { label: "попросил лично", emoji: "🗣️" },
  agreed: { label: "согласился", emoji: "🤝" },
  invited: { label: "приглашение отправлено", emoji: "📧" },
  submitted: { label: "отправил", emoji: "✅" },
} as const;
export type RecStatus = keyof typeof REC_STATUSES;

export const REC_ROLES = { teacher: "учитель", counselor: "школьный консультант", other: "другой рекомендатель" } as const;
export type RecRole = keyof typeof REC_ROLES;

/** Teachers need about a month; asking later than this before the deadline is a risk. */
export const REC_LEAD_DAYS = 28;

// ---------- reminders ----------

export interface Reminder {
  id: string;
  title: string;
  date: string;
  days: number;
  href: string;
}

/** Days before a deadline when Telegram reminders go out. */
export const REMIND_AT = [30, 14, 7, 1, 0];

interface ReminderInput {
  apps: { id: string; name: string; deadline: string | null; status: string }[];
  recs: { id: string; name: string; due: string | null; status: string }[];
  satDate?: string;
  now?: Date;
}

/** Deadlines in the next 30 days (and recommendations up to a week overdue), nearest first. */
export function upcomingDeadlines({ apps, recs, satDate, now = new Date() }: ReminderInput): Reminder[] {
  const out: Reminder[] = [];
  for (const a of apps) if (a.deadline && (a.status === "idea" || a.status === "preparing")) out.push({ id: `app:${a.id}`, title: `Дедлайн: ${a.name}`, date: a.deadline, days: daysTo(a.deadline, now), href: "/admissions?tab=apps" });
  for (const r of recs) if (r.due && r.status !== "submitted") out.push({ id: `rec:${r.id}`, title: `Рекомендация: ${r.name}`, date: r.due, days: daysTo(r.due, now), href: "/admissions?tab=recs" });
  const sat = satDate ? SAT_DATES.find((d) => d.date === satDate) : undefined;
  if (sat?.deadline) out.push({ id: `sat-reg:${sat.date}`, title: "Регистрация на SAT закрывается", date: sat.deadline, days: daysTo(sat.deadline, now), href: "/sat" });
  return out.filter((r) => r.days <= 30 && (r.days >= 0 || (r.id.startsWith("rec:") && r.days >= -7))).sort((a, b) => a.days - b.days);
}
