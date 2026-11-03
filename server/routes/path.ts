import { isUsableEnt } from "../../shared/entQuality";
import { Router } from "express";
import type { Goals, SatQuestion } from "../../shared/types";
import { DOMAIN_RU, SAT_DOMAINS } from "../../shared/types";
import { SAT_BANK, SAT_ACTIVE_BANK, SAT_BY_ID, isCorrect } from "../../shared/sat";
import { ENT_MANDATORY, ENT_PAIR, ENT_SUBJECT, type EntLang, type EntQuestion, type EntSubject } from "../../shared/ent";
import { PATTERNS, PROBLEMS } from "../../shared/problems";
import { BLITZ } from "../../shared/content";
import { COURSES, LESSON_SIZE, SKILL_RU, UNIT_COLORS, type AnswerResult, type CourseId, type LessonItem, type LessonResult, type LessonStart, type PathNode, type PathUnit, type PathView } from "../../shared/path";
import { READING, normalise } from "../content/ielts";
import { requireStudent } from "../auth";
import { addXp, all, dayKey, id, one, run, xpSummary } from "../db";
import { solvedProblems } from "../progress";
import { reviewResult } from "../review";
import { entGenerate, nuetGenerate, type NuetQuestion, type NuetSection } from "../ai";
import { store as storeEnt } from "./ent";
import { HttpError, str, wrap } from "../http";

// The learning path: the course structure is derived from the question banks; progress lives in path_progress,
// and each started lesson is a path_lessons row so XP is counted from answers the server checked itself.
// ENT lessons draw from the AI-written ENT bank and top it up per topic; coding problems are solved in the editor.

export const pathRouter = Router();

interface NodeDef {
  id: string;
  kind: PathNode["kind"];
  title: string;
  subtitle: string;
  maxLevel: number;
  /** SAT: skills the node draws from */
  skills?: string[];
  /** IELTS: the reading set */
  setId?: string;
  /** ENT: subject and topic */
  ent?: { subject: string; topic?: string };
  /** NUET: section and topic */
  nuet?: { section: NuetSection; topic?: string };
  /** coding warm-up from Bug Blitz */
  blitz?: boolean;
  /** coding problem solved in the editor */
  problem?: string;
}
interface UnitDef {
  id: string;
  title: string;
  description: string;
  color: string;
  nodes: NodeDef[];
}

const MIN_POOL = 6;
const slug = (s: string) => s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "");
const chest = (unitId: string): NodeDef => ({ id: `c-${unitId}`, kind: "chest", title: "Сундук", subtitle: "+20 XP за пройденный юнит", maxLevel: 1 });

function satCourse(section: "math" | "rw"): UnitDef[] {
  return SAT_DOMAINS[section].map((domain, ui) => {
    const counts = new Map<string, number>();
    for (const q of SAT_BANK) if (q.section === section && q.domain === domain) counts.set(q.skill, (counts.get(q.skill) ?? 0) + 1);
    const skills = [...counts].filter(([, n]) => n >= MIN_POOL).map(([s]) => s);
    const nodes: NodeDef[] = skills.map((s) => ({ id: `s-${slug(s)}`, kind: "lesson", title: SKILL_RU[s] ?? s, subtitle: s, maxLevel: 3, skills: [s] }));
    nodes.push({ id: `r-${slug(domain)}`, kind: "review", title: "Повторение юнита", subtitle: "Задания из всех тем юнита", maxLevel: 3, skills });
    nodes.push(chest(slug(domain)));
    return { id: slug(domain), title: DOMAIN_RU[domain], description: domain, color: UNIT_COLORS[(ui + (section === "rw" ? 4 : 0)) % UNIT_COLORS.length]!, nodes };
  });
}

function ieltsCourse(): UnitDef[] {
  const groups = new Map<string, typeof READING>();
  for (const r of READING) {
    const type = r.level.startsWith("Academic · Passage") ? "Разминка" : r.level.replace("Academic · ", "");
    groups.set(type, [...(groups.get(type) ?? []), r]);
  }
  return [...groups].map(([type, sets], ui) => ({
    id: slug(type),
    title: type,
    description: `${sets.length} наборов · ${new Set(sets.map((r) => r.passage.toLowerCase().replace(/\s+/g, " ").trim())).size} уникальных коротких текстов`,
    color: UNIT_COLORS[ui % UNIT_COLORS.length]!,
    nodes: [...sets.map((r) => ({ id: `t-${r.id}`, kind: "lesson" as const, title: r.title, subtitle: `${r.questions.length} вопросов`, maxLevel: 1, setId: r.id })), chest(slug(type))],
  }));
}

/** Mandatory subjects first, then the student's profile pair (chosen in the ENT section). */
function entCourse(pair: string | null): UnitDef[] {
  const ids = [...ENT_MANDATORY, ...(pair && ENT_PAIR[pair] ? ENT_PAIR[pair].subjects : [])];
  return ids.map((sid, ui) => {
    const s = ENT_SUBJECT[sid]!;
    const nodes: NodeDef[] = s.topics.map((t, ti) => ({ id: `e-${sid}-${ti}`, kind: "lesson", title: t, subtitle: s.name, maxLevel: 3, ent: { subject: sid, topic: t } }));
    nodes.push({ id: `er-${sid}`, kind: "review", title: "Повторение предмета", subtitle: "Задания по всем темам", maxLevel: 3, ent: { subject: sid } });
    nodes.push(chest(sid));
    return { id: sid, title: `${s.icon} ${s.name}`, description: s.kind === "mandatory" ? "Обязательный предмет" : "Профильный предмет", color: UNIT_COLORS[ui % UNIT_COLORS.length]!, nodes };
  });
}

/** NUET topics: Russian titles on the path, English names Claude writes questions for. */
const NUET_UNITS: { section: NuetSection; title: string; description: string; topics: [string, string][] }[] = [
  {
    section: "math",
    title: "📐 Mathematics",
    description: "На экзамене 30 вопросов за 60 минут",
    topics: [
      ["Арифметика и проценты", "Arithmetic, ratios and percentages"],
      ["Алгебра и уравнения", "Algebra, equations and inequalities"],
      ["Функции и графики", "Functions and graphs"],
      ["Геометрия", "Geometry: angles, areas, volumes, coordinates"],
      ["Вероятность и статистика", "Probability and statistics"],
      ["Текстовые задачи", "Word problems"],
    ],
  },
  {
    section: "ctps",
    title: "🧠 Critical Thinking",
    description: "Critical Thinking & Problem Solving: 30 вопросов за 60 минут",
    topics: [
      ["Аргументы и допущения", "Arguments: conclusions, assumptions, strengthen and weaken"],
      ["Логические выводы", "Logical deduction and ordering"],
      ["Таблицы и данные", "Reading data from tables and charts"],
      ["Закономерности", "Number and letter patterns and sequences"],
      ["Пространственное мышление", "Spatial reasoning described in words"],
      ["Числовые головоломки", "Numerical problem solving"],
    ],
  },
];

function nuetCourse(): UnitDef[] {
  return NUET_UNITS.map((u, ui) => ({
    id: u.section,
    title: u.title,
    description: u.description,
    color: UNIT_COLORS[(ui * 3 + 1) % UNIT_COLORS.length]!,
    nodes: [
      ...u.topics.map(([ru, en], ti) => ({ id: `n-${u.section}-${ti}`, kind: "lesson" as const, title: ru, subtitle: en, maxLevel: 3, nuet: { section: u.section, topic: en } })),
      { id: `nr-${u.section}`, kind: "review" as const, title: "Мини-пробник", subtitle: "Вопросы по всем темам раздела", maxLevel: 3, nuet: { section: u.section } },
      chest(u.section),
    ],
  }));
}

const DIFF_RU = { Easy: "Лёгкая", Medium: "Средняя", Hard: "Сложная" } as const;
const DIFF_ORDER = { Easy: 0, Medium: 1, Hard: 2 } as const;

function codeCourse(): UnitDef[] {
  const warmup: UnitDef = {
    id: "warmup",
    title: "Разминка: найди баг",
    description: "Что выведет код и где ошибка",
    color: UNIT_COLORS[3]!,
    nodes: [{ id: "b-blitz", kind: "lesson", title: "Найди баг", subtitle: "Короткие задачи на чтение кода", maxLevel: 3, blitz: true }, chest("warmup")],
  };
  const units = PATTERNS.map((p, ui) => {
    const probs = PROBLEMS.filter((x) => x.pattern === p.id).sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]);
    return {
      id: p.id,
      title: p.title,
      description: p.blurb,
      color: UNIT_COLORS[(ui + 4) % UNIT_COLORS.length]!,
      nodes: [...probs.map((x) => ({ id: `p-${x.id}`, kind: "lesson" as const, title: x.title, subtitle: `${DIFF_RU[x.difficulty]} · задача с тестами`, maxLevel: 1, problem: x.id })), chest(p.id)],
    };
  }).filter((u) => u.nodes.length > 1);
  return [warmup, ...units];
}

const STATIC: Partial<Record<CourseId, UnitDef[]>> = { "sat-math": satCourse("math"), "sat-rw": satCourse("rw"), "ielts-reading": ieltsCourse(), nuet: nuetCourse(), code: codeCourse() };

async function entProfile(userId: string) {
  return one<{ pair: string; lang: EntLang }>("SELECT pair, lang FROM ent_profiles WHERE user_id = ?", userId);
}

async function structure(c: CourseId, userId: string): Promise<UnitDef[]> {
  if (c === "ent") return entCourse((await entProfile(userId))?.pair ?? null);
  return STATIC[c]!;
}

function course(raw: unknown): CourseId {
  const c = String(raw) as CourseId;
  if (!(c in COURSES)) throw new HttpError(404, "Такого курса нет");
  return c;
}

function findNode(units: UnitDef[], nodeId: string) {
  for (const u of units) {
    const n = u.nodes.find((x) => x.id === nodeId);
    if (n) return { unit: u, node: n };
  }
  throw new HttpError(404, "Такого уровня нет");
}

/** Crowns per node; coding problems count as done once the editor has passed all their tests. */
async function levels(userId: string, c: CourseId) {
  const rows = await all<{ node_id: string; level: number }>("SELECT node_id, level FROM path_progress WHERE user_id = ? AND course = ?", userId, c);
  const lv = new Map(rows.map((r) => [r.node_id, r.level]));
  if (c === "code") for (const p of await solvedProblems(userId)) lv.set(`p-${p}`, 1);
  return lv;
}

/** Nodes are walked in order: a node opens once every node before it has at least one crown. */
function view(c: CourseId, defs: UnitDef[], lv: Map<string, number>): Pick<PathView, "units" | "currentNodeId" | "done" | "total"> {
  let current: string | null = null;
  let done = 0;
  let total = 0;
  const units: PathUnit[] = defs.map((u) => ({
    id: u.id,
    title: u.title,
    description: u.description,
    color: u.color,
    nodes: u.nodes.map((n) => {
      total++;
      const level = Math.min(n.maxLevel, lv.get(n.id) ?? 0);
      let status: PathNode["status"];
      if (level > 0 && !current) status = "done";
      else if (!current) {
        status = "current";
        current = n.id;
      } else status = "locked";
      if (level > 0) done++;
      return { id: n.id, kind: n.kind, title: n.title, subtitle: n.subtitle, level, maxLevel: n.maxLevel, status, ...(n.problem ? { href: `/coding/problems/${n.problem}` } : {}) };
    }),
  }));
  return { units, currentNodeId: current, done, total };
}

function assertOpen(c: CourseId, defs: UnitDef[], lv: Map<string, number>, nodeId: string) {
  const n = view(c, defs, lv)
    .units.flatMap((u) => u.nodes)
    .find((x) => x.id === nodeId);
  if (!n) throw new HttpError(404, "Такого уровня нет");
  if (n.status === "locked") throw new HttpError(403, "Сначала пройди предыдущие уровни");
  return n;
}

const dayStart = () => Date.parse(`${dayKey()}T00:00:00Z`) - 5 * 3600_000;

pathRouter.get(
  "/",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const goals = JSON.parse(u.goals) as Goals;
    const out = await Promise.all(
      (Object.keys(COURSES) as CourseId[]).map(async (c) => {
        const v = view(c, await structure(c, u.id), await levels(u.id, c));
        return { id: c, ...COURSES[c], done: v.done, total: v.total };
      }),
    );
    const suggested: CourseId = goals.sat ? "sat-math" : goals.ielts ? "ielts-reading" : goals.coding ? "code" : (await entProfile(u.id)) ? "ent" : "sat-math";
    res.json({ courses: out, suggested });
  }),
);

pathRouter.get(
  "/:course",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const c = course(req.params.course);
    const goals = JSON.parse(u.goals) as Goals;
    const since = dayStart();
    const todayXp = (await one<{ s: number | null }>("SELECT SUM(amount) s FROM xp_log WHERE user_id = ? AND at >= ?", u.id, since))?.s ?? 0;
    const lessons = await all<{ perfect: number }>("SELECT perfect FROM path_lessons WHERE user_id = ? AND done = 1 AND created_at >= ?", u.id, since);
    const dailyGoal = goals.dailyMinutes ?? 30;
    const note =
      c === "ent" && !(await entProfile(u.id))
        ? "Здесь три обязательных предмета. Выбери профильную пару в разделе «Подготовка к ЕНТ» — её предметы появятся на пути."
        : c === "code"
          ? "Задачи решаются в редакторе: уровень засчитывается, когда пройдены все тесты."
          : undefined;
    const body: PathView = {
      course: c,
      ...view(c, await structure(c, u.id), await levels(u.id, c)),
      ...(note ? { note } : {}),
      todayXp,
      dailyGoal,
      streak: (await xpSummary(u.id)).streak,
      quests: [
        { id: "xp", title: `Заработай ${dailyGoal} XP`, value: Math.min(todayXp, dailyGoal), goal: dailyGoal },
        { id: "lessons", title: "Пройди 2 урока", value: Math.min(lessons.length, 2), goal: 2 },
        { id: "perfect", title: "Урок без ошибок", value: Math.min(lessons.filter((l) => l.perfect).length, 1), goal: 1 },
      ],
    };
    res.json(body);
  }),
);

// ---------- lesson content ----------

function satItem(q: SatQuestion): LessonItem {
  return { id: q.id, kind: q.choices ? "choice" : "input", ...(q.passage ? { passage: q.passage } : {}), stem: q.stem, ...(q.choices ? { choices: q.choices } : {}) };
}

function readingItems(setId: string): LessonItem[] {
  const r = READING.find((x) => x.id === setId)!;
  return r.questions.map((q) => ({
    id: `${setId}#${q.id}`,
    kind: q.kind === "gap" ? "input" : "choice",
    passage: r.passage,
    passageTitle: r.title,
    stem: q.text,
    ...(q.kind === "tfng" ? { choices: ["TRUE", "FALSE", "NOT GIVEN"] } : q.kind === "mcq" ? { choices: q.options!.map((o) => o.replace(/^[A-H]\s+/, "")) } : {}),
  }));
}

/** Target difficulty rises with the node's crowns: easy first, hard at the third crown. */
async function pickSat(userId: string, skills: string[], level: number): Promise<SatQuestion[]> {
  const target = [1.3, 2, 2.6, 3][Math.min(level, 3)]!;
  const solved = new Set((await all<{ item_id: string }>("SELECT DISTINCT item_id FROM attempts WHERE user_id = ? AND module = 'sat' AND correct = 1", userId)).map((r) => r.item_id));
  return SAT_ACTIVE_BANK.filter((q) => skills.includes(q.skill) && q.source !== "ai")
    .map((q) => ({ q, score: (solved.has(q.id) ? 2 : 0) + Math.abs(q.difficulty - target) + Math.random() * 0.9 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, LESSON_SIZE)
    .map((x) => x.q)
    .sort((a, b) => a.difficulty - b.difficulty);
}

const BLITZ_PREFIX = "blitz#";

function blitzItems(level: number): LessonItem[] {
  const target = Math.min(3, level + 1);
  return BLITZ.map((b) => ({ b, score: Math.abs(b.level - target) + Math.random() }))
    .sort((a, b) => a.score - b.score)
    .slice(0, LESSON_SIZE)
    .map(({ b }) => ({ id: `${BLITZ_PREFIX}${b.id}`, kind: "choice" as const, stem: b.question, code: b.code, choices: b.options }));
}

/** ENT reading literacy works on texts with five questions; the other subjects on single-choice questions. */
const entType = (s: EntSubject) => (s.plan.some((p) => p.type === "single") ? "single" : "context");
const ENT_DIFF: EntQuestion["difficulty"][] = ["A", "B", "C"];

async function entItems(userId: string, subjectId: string, topic: string | undefined, level: number): Promise<LessonItem[]> {
  const s = ENT_SUBJECT[subjectId]!;
  const lang = s.fixedLang ?? (await entProfile(userId))?.lang ?? "ru";
  const type = entType(s);
  const load = async () =>
    (await all<{ data: string }>(`SELECT data FROM ent_questions WHERE subject = ? AND lang = ? AND type = ?${topic ? " AND topic = ?" : ""}`, s.id, lang, type, ...(topic ? [topic] : []))).map((r) => JSON.parse(r.data) as EntQuestion).filter(isUsableEnt);
  let pool = await load();
  // Top the topic up with Claude when the bank is thin (or with demo items when there is no API key).
  if (pool.length < LESSON_SIZE && topic) {
    const made = await entGenerate(s, topic, type, type === "context" ? 5 : LESSON_SIZE, lang);
    await storeEnt(made);
    pool = await load();
  }
  if (!pool.length) throw new HttpError(503, "По этой теме и языку пока нет проверенных материалов");
  const seen = new Set((await all<{ item_id: string }>("SELECT item_id FROM attempts WHERE user_id = ? AND module = 'ent'", userId)).map((r) => r.item_id));
  let picked: EntQuestion[];
  if (type === "context") {
    const groups = new Map<string, EntQuestion[]>();
    for (const q of pool) groups.set(q.groupId ?? q.id, [...(groups.get(q.groupId ?? q.id) ?? []), q]);
    const ordered = [...groups.values()].sort((a, b) => Number(a.some((q) => seen.has(q.id))) - Number(b.some((q) => seen.has(q.id))) || Math.random() - 0.5);
    picked = ordered[0]!.slice(0, 5);
  } else {
    const want = ENT_DIFF[Math.min(level, 2)]!;
    picked = pool
      .map((q) => ({ q, score: (seen.has(q.id) ? 2 : 0) + (q.difficulty === want ? 0 : 0.8) + Math.random() * 0.9 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, LESSON_SIZE)
      .map((x) => x.q);
  }
  return picked.map((q) => ({ id: q.id, kind: "choice" as const, ...(q.passage ? { passage: q.passage } : {}), stem: q.stem, choices: q.options }));
}

/** NUET lessons draw from Claude-written questions per topic and top the topic up when it runs thin. */
async function nuetItems(userId: string, section: NuetSection, topic: string | undefined): Promise<LessonItem[]> {
  const load = async () =>
    (await all<{ data: string }>(`SELECT data FROM nuet_questions WHERE section = ?${topic ? " AND topic = ?" : ""}`, section, ...(topic ? [topic] : []))).map((r) => JSON.parse(r.data) as NuetQuestion);
  let pool = await load();
  if (pool.length < LESSON_SIZE && topic) {
    for (const q of await nuetGenerate(section, topic, LESSON_SIZE + 2)) {
      const full: NuetQuestion = { ...q, id: `nuet-${id(6)}` };
      await run("INSERT INTO nuet_questions (id, section, topic, data, created_at) VALUES (?, ?, ?, ?, ?)", full.id, section, topic, JSON.stringify(full), Date.now());
    }
    pool = await load();
  }
  if (!pool.length) throw new HttpError(503, topic ? "По этой теме и языку пока нет проверенных материалов" : "Мини-пробник собирается из вопросов пройденных тем: сначала пройди хотя бы одну тему");
  const seen = new Set((await all<{ item_id: string }>("SELECT item_id FROM attempts WHERE user_id = ? AND module = 'nuet'", userId)).map((r) => r.item_id));
  return pool
    .map((q) => ({ q, score: (seen.has(q.id) ? 2 : 0) + Math.random() }))
    .sort((a, b) => a.score - b.score)
    .slice(0, LESSON_SIZE)
    .map(({ q }) => ({ id: q.id, kind: "choice" as const, ...(q.passage ? { passage: q.passage } : {}), stem: q.stem, choices: q.options }));
}

pathRouter.post(
  "/:course/:node/start",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const c = course(req.params.course);
    const defs = await structure(c, u.id);
    const { node } = findNode(defs, String(req.params.node));
    if (node.kind === "chest") throw new HttpError(400, "Сундук открывается кнопкой, без урока");
    if (node.problem) throw new HttpError(400, "Эта задача решается в редакторе кода");
    const pn = assertOpen(c, defs, await levels(u.id, c), node.id);
    const items = node.setId
      ? readingItems(node.setId)
      : node.blitz
        ? blitzItems(pn.level)
        : node.ent
          ? await entItems(u.id, node.ent.subject, node.ent.topic, pn.level)
          : node.nuet
            ? await nuetItems(u.id, node.nuet.section, node.nuet.topic)
            : (await pickSat(u.id, node.skills ?? [], pn.level)).map(satItem);
    if (!items.length) throw new HttpError(404, "Для этого уровня пока нет заданий");
    const lessonId = id();
    await run(
      "INSERT INTO path_lessons (id, user_id, course, node_id, items, answers, created_at, done, perfect) VALUES (?, ?, ?, ?, ?, '{}', ?, 0, 0)",
      lessonId,
      u.id,
      c,
      node.id,
      JSON.stringify(items.map((i) => i.id)),
      Date.now(),
    );
    const body: LessonStart = { lessonId, title: node.title, level: pn.level, items };
    res.json(body);
  }),
);

interface LessonRow {
  id: string;
  user_id: string;
  course: CourseId;
  node_id: string;
  items: string;
  answers: string;
  done: number;
}

async function lesson(userId: string, lessonId: string) {
  const l = await one<LessonRow>("SELECT * FROM path_lessons WHERE id = ? AND user_id = ?", lessonId, userId);
  if (!l) throw new HttpError(404, "Урок не найден. Начни его заново");
  return l;
}

type Checked = AnswerResult & { skill: string; module: "sat" | "ielts-reading" | "ent" | "nuet" | "code"; review?: "sat" | "ent" };

async function check(itemId: string, response: unknown): Promise<Checked> {
  if (itemId.startsWith(BLITZ_PREFIX)) {
    const b = BLITZ.find((x) => x.id === itemId.slice(BLITZ_PREFIX.length));
    if (!b) throw new HttpError(404, "Вопрос не найден");
    return { correct: Number(response) === b.answer, answer: b.options[b.answer]!, explanation: b.why, skill: b.skill, module: "code" };
  }
  if (itemId.startsWith("nuet-")) {
    const row = await one<{ data: string }>("SELECT data FROM nuet_questions WHERE id = ?", itemId);
    if (!row) throw new HttpError(404, "Вопрос не найден");
    const q = JSON.parse(row.data) as NuetQuestion;
    return { correct: Number(response) === q.answer, answer: q.options[q.answer] ?? "", explanation: q.explanation, skill: `${q.section}:${q.topic}`, module: "nuet" };
  }
  if (itemId.startsWith("ent-")) {
    const row = await one<{ data: string }>("SELECT data FROM ent_questions WHERE id = ?", itemId);
    if (!row) throw new HttpError(404, "Вопрос не найден");
    const q = JSON.parse(row.data) as EntQuestion;
    const right = q.answer as number;
    return { correct: Number(response) === right, answer: q.options[right] ?? "", explanation: q.explanation, skill: `${q.subject}:${q.topic}`, module: "ent", review: "ent" };
  }
  if (itemId.includes("#")) {
    const [setId, qid] = itemId.split("#") as [string, string];
    const set = READING.find((r) => r.id === setId);
    const q = set?.questions.find((x) => x.id === qid);
    if (!set || !q) throw new HttpError(404, "Вопрос не найден");
    let given = "";
    if (q.kind === "tfng") given = ["TRUE", "FALSE", "NOT GIVEN"][Number(response)] ?? "";
    else if (q.kind === "mcq") given = q.options![Number(response)]?.slice(0, 1) ?? "";
    else given = String(response ?? "");
    const correct = !!given && q.answer.split("|").map(normalise).includes(normalise(given));
    const answer = q.kind === "mcq" ? (q.options!.find((o) => o.startsWith(q.answer)) ?? q.answer).replace(/^[A-H]\s+/, "") : q.answer.split("|")[0]!;
    return { correct, answer, explanation: q.why, skill: setId, module: "ielts-reading" };
  }
  const q = SAT_BY_ID.get(itemId);
  if (!q) throw new HttpError(404, "Вопрос не найден");
  const correct = isCorrect(q, response);
  const answer = q.choices ? q.choices[q.answer as number]! : String(q.answer);
  return { correct, answer, explanation: q.explanation, skill: q.domain, module: "sat", review: "sat" };
}

pathRouter.post(
  "/answer",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const l = await lesson(u.id, str(req.body?.lessonId, 40));
    const itemId = str(req.body?.itemId, 120);
    if (!(JSON.parse(l.items) as string[]).includes(itemId)) throw new HttpError(400, "Этого вопроса нет в уроке");
    if (req.body?.response === null || req.body?.response === undefined || req.body?.response === "") throw new HttpError(400, "Сначала введи или выбери ответ");
    const r = await check(itemId, req.body?.response);
    const answers = JSON.parse(l.answers) as Record<string, { first: boolean; ok: boolean }>;
    // Only the first try counts for XP and analytics; retries just have to reach the right answer.
    if (!answers[itemId]) {
      answers[itemId] = { first: r.correct, ok: r.correct };
      await run("INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, ?, ?, ?, ?, 0, ?)", u.id, r.module, itemId.replace("#", "-"), r.skill, r.correct ? 1 : 0, Date.now());
      if (r.review) await reviewResult(u.id, r.review, itemId, r.correct);
    } else if (r.correct) answers[itemId]!.ok = true;
    await run("UPDATE path_lessons SET answers = ? WHERE id = ?", JSON.stringify(answers), l.id);
    const body: AnswerResult = { correct: r.correct, answer: r.answer, explanation: r.explanation };
    res.json(body);
  }),
);

pathRouter.post(
  "/complete",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const l = await lesson(u.id, str(req.body?.lessonId, 40));
    if (l.done) throw new HttpError(409, "Урок уже засчитан");
    const items = JSON.parse(l.items) as string[];
    const answers = JSON.parse(l.answers) as Record<string, { first: boolean; ok: boolean }>;
    if (items.some((i) => !answers[i]?.ok)) throw new HttpError(400, "Сначала ответь верно на все вопросы урока");
    const firstTry = items.filter((i) => answers[i]!.first).length;
    const perfect = firstTry === items.length;
    const { node } = findNode(await structure(l.course, u.id), l.node_id);
    const prev = (await levels(u.id, l.course)).get(node.id) ?? 0;
    const level = Math.min(node.maxLevel, prev + 1);
    await run(
      "INSERT INTO path_progress (user_id, course, node_id, level, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, course, node_id) DO UPDATE SET level = excluded.level, updated_at = excluded.updated_at",
      u.id,
      l.course,
      node.id,
      level,
      Date.now(),
    );
    const xp = 10 + firstTry + (perfect ? 5 : 0);
    await addXp(u.id, xp, "path");
    await run("UPDATE path_lessons SET done = 1, perfect = ? WHERE id = ?", perfect ? 1 : 0, l.id);
    const body: LessonResult = { xp, firstTry, total: items.length, perfect, level, maxLevel: node.maxLevel };
    res.json(body);
  }),
);

pathRouter.post(
  "/:course/:node/chest",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const c = course(req.params.course);
    const defs = await structure(c, u.id);
    const { node } = findNode(defs, String(req.params.node));
    if (node.kind !== "chest") throw new HttpError(400, "Это не сундук");
    const pn = assertOpen(c, defs, await levels(u.id, c), node.id);
    if (pn.level > 0) throw new HttpError(409, "Сундук уже открыт");
    await run("INSERT INTO path_progress (user_id, course, node_id, level, updated_at) VALUES (?, ?, ?, 1, ?)", u.id, c, node.id, Date.now());
    await addXp(u.id, 20, "chest");
    res.json({ xp: 20 });
  }),
);

