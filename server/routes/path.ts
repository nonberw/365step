import { Router } from "express";
import type { Goals, SatQuestion } from "../../shared/types";
import { DOMAIN_RU, SAT_DOMAINS } from "../../shared/types";
import { SAT_BANK, SAT_BY_ID, isCorrect } from "../../shared/sat";
import { COURSES, LESSON_SIZE, SKILL_RU, UNIT_COLORS, type AnswerResult, type CourseId, type LessonItem, type LessonResult, type LessonStart, type PathNode, type PathUnit, type PathView } from "../../shared/path";
import { READING, normalise } from "../content/ielts";
import { requireStudent } from "../auth";
import { addXp, all, dayKey, id, one, run, xpSummary } from "../db";
import { reviewResult } from "../review";
import { HttpError, str, wrap } from "../http";

// The learning path: the course structure is derived from the question banks; progress lives in path_progress,
// and each started lesson is a path_lessons row so XP is counted from answers the server checked itself.

export const pathRouter = Router();

interface NodeDef {
  id: string;
  kind: PathNode["kind"];
  title: string;
  subtitle: string;
  maxLevel: number;
  /** SAT: skills the node draws from; IELTS: the reading set */
  skills?: string[];
  setId?: string;
}
interface UnitDef {
  id: string;
  title: string;
  description: string;
  color: string;
  nodes: NodeDef[];
}

const MIN_POOL = 6;

function satCourse(section: "math" | "rw"): UnitDef[] {
  return SAT_DOMAINS[section].map((domain, ui) => {
    const counts = new Map<string, number>();
    for (const q of SAT_BANK) if (q.section === section && q.domain === domain) counts.set(q.skill, (counts.get(q.skill) ?? 0) + 1);
    const skills = [...counts].filter(([, n]) => n >= MIN_POOL).map(([s]) => s);
    const nodes: NodeDef[] = skills.map((s) => ({ id: `s-${slug(s)}`, kind: "lesson", title: SKILL_RU[s] ?? s, subtitle: s, maxLevel: 3, skills: [s] }));
    nodes.push({ id: `r-${slug(domain)}`, kind: "review", title: "Повторение юнита", subtitle: "Задания из всех тем юнита", maxLevel: 3, skills });
    nodes.push({ id: `c-${slug(domain)}`, kind: "chest", title: "Сундук", subtitle: "+20 XP за пройденный юнит", maxLevel: 1 });
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
    description: `${sets.length} текстов`,
    color: UNIT_COLORS[ui % UNIT_COLORS.length]!,
    nodes: [
      ...sets.map((r) => ({ id: `t-${r.id}`, kind: "lesson" as const, title: r.title, subtitle: `${r.questions.length} вопросов`, maxLevel: 1, setId: r.id })),
      { id: `c-${slug(type)}`, kind: "chest" as const, title: "Сундук", subtitle: "+20 XP за пройденный юнит", maxLevel: 1 },
    ],
  }));
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "");

const STRUCTURE: Record<CourseId, UnitDef[]> = { "sat-math": satCourse("math"), "sat-rw": satCourse("rw"), "ielts-reading": ieltsCourse() };

function course(raw: unknown): CourseId {
  const c = String(raw) as CourseId;
  if (!(c in COURSES)) throw new HttpError(404, "Такого курса нет");
  return c;
}

function findNode(c: CourseId, nodeId: string) {
  for (const u of STRUCTURE[c]) {
    const n = u.nodes.find((x) => x.id === nodeId);
    if (n) return { unit: u, node: n };
  }
  throw new HttpError(404, "Такого уровня нет");
}

async function levels(userId: string, c: CourseId) {
  const rows = await all<{ node_id: string; level: number }>("SELECT node_id, level FROM path_progress WHERE user_id = ? AND course = ?", userId, c);
  return new Map(rows.map((r) => [r.node_id, r.level]));
}

/** Nodes are walked in order: a node opens once every node before it has at least one crown. */
function view(c: CourseId, lv: Map<string, number>): Pick<PathView, "units" | "currentNodeId" | "done" | "total"> {
  let current: string | null = null;
  let done = 0;
  let total = 0;
  const units: PathUnit[] = STRUCTURE[c].map((u) => ({
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
      return { id: n.id, kind: n.kind, title: n.title, subtitle: n.subtitle, level, maxLevel: n.maxLevel, status };
    }),
  }));
  return { units, currentNodeId: current, done, total };
}

function assertOpen(c: CourseId, lv: Map<string, number>, nodeId: string) {
  const v = view(c, lv);
  const n = v.units.flatMap((u) => u.nodes).find((x) => x.id === nodeId);
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
        const v = view(c, await levels(u.id, c));
        return { id: c, ...COURSES[c], done: v.done, total: v.total };
      }),
    );
    res.json({ courses: out, suggested: goals.ielts && !goals.sat ? "ielts-reading" : "sat-math" });
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
    const body: PathView = {
      course: c,
      ...view(c, await levels(u.id, c)),
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

// ---------- lessons ----------

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
  const pool = SAT_BANK.filter((q) => skills.includes(q.skill) && q.source !== "ai")
    .map((q) => ({ q, score: (solved.has(q.id) ? 2 : 0) + Math.abs(q.difficulty - target) + Math.random() * 0.9 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, LESSON_SIZE)
    .map((x) => x.q);
  return pool.sort((a, b) => a.difficulty - b.difficulty);
}

pathRouter.post(
  "/:course/:node/start",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const c = course(req.params.course);
    const { node } = findNode(c, String(req.params.node));
    if (node.kind === "chest") throw new HttpError(400, "Сундук открывается кнопкой, без урока");
    const pn = assertOpen(c, await levels(u.id, c), node.id);
    const items = node.setId ? readingItems(node.setId) : (await pickSat(u.id, node.skills ?? [], pn.level)).map(satItem);
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

function check(itemId: string, response: unknown): AnswerResult & { skill: string; module: "sat" | "ielts-reading" } {
  if (itemId.includes("#")) {
    const [setId, qid] = itemId.split("#") as [string, string];
    const set = READING.find((r) => r.id === setId);
    const q = set?.questions.find((x) => x.id === qid);
    if (!set || !q) throw new HttpError(404, "Вопрос не найден");
    let given = "";
    if (q.kind === "tfng") given = ["TRUE", "FALSE", "NOT GIVEN"][Number(response)] ?? "";
    else if (q.kind === "mcq") given = q.options![Number(response)]?.slice(0, 1) ?? "";
    else given = String(response ?? "");
    const accepted = q.answer.split("|").map(normalise);
    const correct = !!given && accepted.includes(normalise(given));
    const answer = q.kind === "mcq" ? (q.options!.find((o) => o.startsWith(q.answer)) ?? q.answer).replace(/^[A-H]\s+/, "") : q.answer.split("|")[0]!;
    return { correct, answer, explanation: q.why, skill: setId, module: "ielts-reading" };
  }
  const q = SAT_BY_ID.get(itemId);
  if (!q) throw new HttpError(404, "Вопрос не найден");
  const correct = isCorrect(q, q.choices ? Number(response) : response);
  const answer = q.choices ? q.choices[q.answer as number]! : String(q.answer);
  return { correct, answer, explanation: q.explanation, skill: q.domain, module: "sat" };
}

pathRouter.post(
  "/answer",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const l = await lesson(u.id, str(req.body?.lessonId, 40));
    const itemId = str(req.body?.itemId, 120);
    if (!(JSON.parse(l.items) as string[]).includes(itemId)) throw new HttpError(400, "Этого вопроса нет в уроке");
    const r = check(itemId, req.body?.response);
    const answers = JSON.parse(l.answers) as Record<string, { first: boolean; ok: boolean }>;
    // Only the first try counts for XP and analytics; retries just have to reach the right answer.
    if (!answers[itemId]) {
      answers[itemId] = { first: r.correct, ok: r.correct };
      await run("INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, ?, ?, ?, ?, 0, ?)", u.id, r.module, itemId.replace("#", "-"), r.skill, r.correct ? 1 : 0, Date.now());
      if (r.module === "sat") await reviewResult(u.id, "sat", itemId, r.correct);
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
    const { node } = findNode(l.course, l.node_id);
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
    const { node } = findNode(c, String(req.params.node));
    if (node.kind !== "chest") throw new HttpError(400, "Это не сундук");
    const lv = await levels(u.id, c);
    const pn = assertOpen(c, lv, node.id);
    if (pn.level > 0) throw new HttpError(409, "Сундук уже открыт");
    await run("INSERT INTO path_progress (user_id, course, node_id, level, updated_at) VALUES (?, ?, ?, 1, ?)", u.id, c, node.id, Date.now());
    await addXp(u.id, 20, "chest");
    res.json({ xp: 20 });
  }),
);
