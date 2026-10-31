import { Router } from "express";
import { ENT_SUBJECT, type EntLang, type EntQuestion } from "../../shared/ent";
import { requireStudent, type UserRow } from "../auth";
import { addXp, all, id, one, run } from "../db";
import { HttpError, must, str, wrap } from "../http";
import { fill } from "./ent";

// ЕНТ duels: 10 single-answer questions of one subject, both classmates answer the same ones.
// More right answers wins, a tie goes to the faster player. The weekly class league ranks ENT XP.

export const duelsRouter = Router();

export const DUEL_SUBJECTS = ["math-lit", "history-kz", "math", "physics", "informatics", "chemistry", "biology", "geography", "world-history", "law", "english"];
const SIZE = 10;
const KZ = 5 * 3600_000;

interface DuelRow {
  id: string;
  class_code: string;
  challenger_id: string;
  opponent_id: string;
  subject: string;
  items: string;
  challenger_result: string | null;
  opponent_result: string | null;
  winner_id: string | null;
  status: "open" | "finished";
  created_at: number;
  finished_at: number | null;
}

interface DuelResult {
  score: number;
  ms: number;
  answers: Record<string, number>;
}

const weekStart = () => {
  const d = new Date(Date.now() + KZ);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) - KZ;
};

/** Students without a class (everyone in the B2C product) play in one shared league. */
const GLOBAL = "global";

async function classOf(u: UserRow) {
  return (await one<{ class_code: string }>("SELECT class_code FROM class_members WHERE user_id = ? ORDER BY joined_at LIMIT 1", u.id))?.class_code ?? GLOBAL;
}

/** League members: the class, or the most recently active students of the shared league (and the student). */
async function members(code: string, userId: string) {
  if (code !== GLOBAL) return all<{ id: string; first_name: string; last_name: string }>("SELECT u.id, u.first_name, u.last_name FROM users u JOIN class_members m ON m.user_id = u.id WHERE m.class_code = ?", code);
  return all<{ id: string; first_name: string; last_name: string }>(
    `SELECT u.id, u.first_name, u.last_name FROM users u LEFT JOIN (SELECT user_id, MAX(at) last FROM xp_log GROUP BY user_id) x ON x.user_id = u.id
     WHERE u.role = 'student' ORDER BY (u.id = ?) DESC, x.last DESC LIMIT 40`,
    userId,
  );
}

const nameOf = (u: { first_name: string; last_name: string }) => `${u.first_name} ${u.last_name}`;

async function load(qids: string[]) {
  const rows = await all<{ data: string }>(`SELECT data FROM ent_questions WHERE id IN (${qids.map(() => "?").join(",")})`, ...qids);
  const map = new Map(rows.map((r) => [JSON.parse(r.data).id as string, JSON.parse(r.data) as EntQuestion]));
  return qids.map((q) => map.get(q)).filter((q): q is EntQuestion => !!q);
}

function view(d: DuelRow, me: string, users: Map<string, string>) {
  const mine = d.challenger_id === me ? d.challenger_result : d.opponent_result;
  const theirs = d.challenger_id === me ? d.opponent_result : d.challenger_result;
  const r = (x: string | null) => (x ? (JSON.parse(x) as DuelResult) : null);
  return {
    id: d.id,
    subject: d.subject,
    subjectName: ENT_SUBJECT[d.subject]?.name ?? d.subject,
    status: d.status,
    createdAt: d.created_at,
    iChallenged: d.challenger_id === me,
    opponent: users.get(d.challenger_id === me ? d.opponent_id : d.challenger_id) ?? "",
    myScore: r(mine)?.score ?? null,
    myMs: r(mine)?.ms ?? null,
    theirScore: d.status === "finished" ? (r(theirs)?.score ?? null) : null,
    theirMs: d.status === "finished" ? (r(theirs)?.ms ?? null) : null,
    played: !!mine,
    result: d.status !== "finished" ? null : d.winner_id === null ? "draw" : d.winner_id === me ? "win" : "loss",
  };
}

duelsRouter.get(
  "/",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const code = await classOf(u);
    const people = await members(code, u.id);
    const names = new Map(people.map((p) => [p.id, nameOf(p)]));
    const duels = await all<DuelRow>("SELECT * FROM duels WHERE (challenger_id = ? OR opponent_id = ?) ORDER BY created_at DESC LIMIT 30", u.id, u.id);
    const since = weekStart();
    const xp = await all<{ user_id: string; s: number }>(
      `SELECT user_id, SUM(amount) s FROM xp_log WHERE at >= ? AND reason IN ('ent', 'ent-test', 'duel') AND user_id IN (${people.map(() => "?").join(",")}) GROUP BY user_id`,
      since,
      ...people.map((p) => p.id),
    );
    const wins = await all<{ winner_id: string; n: number }>("SELECT winner_id, COUNT(*) n FROM duels WHERE class_code = ? AND finished_at >= ? AND winner_id IS NOT NULL GROUP BY winner_id", code, since);
    const league = people
      .map((p) => ({ id: p.id, name: nameOf(p), xp: xp.find((x) => x.user_id === p.id)?.s ?? 0, wins: wins.find((w) => w.winner_id === p.id)?.n ?? 0, me: p.id === u.id }))
      .sort((a, b) => b.xp - a.xp || b.wins - a.wins);
    res.json({
      classCode: code,
      weekStart: since,
      classmates: people.filter((p) => p.id !== u.id).map((p) => ({ id: p.id, name: nameOf(p) })),
      duels: duels.map((d) => view(d, u.id, names)),
      league,
      subjects: DUEL_SUBJECTS.map((s) => ({ id: s, name: ENT_SUBJECT[s]!.name })),
    });
  }),
);

duelsRouter.post(
  "/",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const code = await classOf(u);
    const opponentId = str(req.body?.opponentId, 40);
    const opponent = must(
      code === GLOBAL
        ? await one<{ id: string }>("SELECT id FROM users WHERE id = ? AND role = 'student' AND id <> ?", opponentId, u.id)
        : await one<{ id: string }>("SELECT user_id id FROM class_members WHERE class_code = ? AND user_id = ? AND user_id <> ?", code, opponentId, u.id),
      404,
      "Соперник не найден",
    );
    const subject = str(req.body?.subject, 40);
    if (!DUEL_SUBJECTS.includes(subject)) throw new HttpError(400, "Выбери предмет");
    const open = await one<{ n: number }>("SELECT COUNT(*) n FROM duels WHERE challenger_id = ? AND status = 'open'", u.id);
    if ((open?.n ?? 0) >= 5) throw new HttpError(429, "У тебя уже 5 незавершённых дуэлей — сыграй их сначала");
    const s = ENT_SUBJECT[subject]!;
    const lang = s.fixedLang ?? (await one<{ lang: EntLang }>("SELECT lang FROM ent_profiles WHERE user_id = ?", u.id))?.lang ?? "ru";
    await fill(s, lang, "single", SIZE * 2);
    const pool = await all<{ id: string }>("SELECT id FROM ent_questions WHERE subject = ? AND lang = ? AND type = 'single'", subject, lang);
    if (pool.length < SIZE) throw new HttpError(503, "Не хватило заданий, попробуй через минуту");
    const ids = pool
      .map((p) => [Math.random(), p.id] as const)
      .sort((a, b) => a[0] - b[0])
      .slice(0, SIZE)
      .map(([, x]) => x);
    const did = id();
    await run("INSERT INTO duels (id, class_code, challenger_id, opponent_id, subject, items, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", did, code, u.id, opponent.id, subject, JSON.stringify(ids), Date.now());
    res.json({ id: did });
  }),
);

async function ownDuel(u: UserRow, duelId: string) {
  return must(await one<DuelRow>("SELECT * FROM duels WHERE id = ? AND (challenger_id = ? OR opponent_id = ?)", duelId, u.id, u.id), 404, "Дуэль не найдена");
}

duelsRouter.get(
  "/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const d = await ownDuel(u, String(req.params.id));
    const people = await all<{ id: string; first_name: string; last_name: string }>("SELECT id, first_name, last_name FROM users WHERE id IN (?, ?)", d.challenger_id, d.opponent_id);
    const names = new Map(people.map((p) => [p.id, nameOf(p)]));
    const v = view(d, u.id, names);
    const qs = await load(JSON.parse(d.items));
    const reveal = v.played;
    const mine = JSON.parse((d.challenger_id === u.id ? d.challenger_result : d.opponent_result) ?? "null") as DuelResult | null;
    res.json({
      ...v,
      me: names.get(u.id),
      items: qs.map(({ answer, explanation, ...q }) => (reveal ? { ...q, answer, explanation, given: mine?.answers[q.id] ?? null } : q)),
    });
  }),
);

duelsRouter.post(
  "/:id/submit",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const d = await ownDuel(u, String(req.params.id));
    const col = d.challenger_id === u.id ? "challenger_result" : "opponent_result";
    if ((d.challenger_id === u.id ? d.challenger_result : d.opponent_result) !== null) throw new HttpError(409, "Ты уже сыграл эту дуэль");
    const qs = await load(JSON.parse(d.items));
    const answers: Record<string, number> = {};
    for (const q of qs) {
      const v = Number(req.body?.answers?.[q.id]);
      if (Number.isInteger(v)) answers[q.id] = v;
    }
    const score = qs.filter((q) => answers[q.id] === q.answer).length;
    const ms = Math.max(1000, Math.min(Number(req.body?.ms) || 600_000, 1_800_000));
    await run(`UPDATE duels SET ${col} = ? WHERE id = ?`, JSON.stringify({ score, ms, answers }), d.id);
    await addXp(u.id, score * 2, "duel");
    const fresh = (await one<DuelRow>("SELECT * FROM duels WHERE id = ?", d.id))!;
    if (fresh.challenger_result && fresh.opponent_result) {
      const a = JSON.parse(fresh.challenger_result) as DuelResult;
      const b = JSON.parse(fresh.opponent_result) as DuelResult;
      const winner = a.score !== b.score ? (a.score > b.score ? fresh.challenger_id : fresh.opponent_id) : a.ms !== b.ms ? (a.ms < b.ms ? fresh.challenger_id : fresh.opponent_id) : null;
      await run("UPDATE duels SET status = 'finished', winner_id = ?, finished_at = ? WHERE id = ?", winner, Date.now(), d.id);
      if (winner) await addXp(winner, 20, "duel");
    }
    res.json({ score });
  }),
);
