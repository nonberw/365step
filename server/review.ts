import { isUsableEnt } from "../shared/entQuality";
import { DefaultScheduler, Rating } from "ts-fsrs";
import { all, one, run } from "./db";

// Spaced review of mistakes on FSRS (Free Spaced Repetition Scheduler, the algorithm of modern Anki, via the open-source
// ts-fsrs library). Each mistake becomes a memory card: its stability (how long it stays remembered) and difficulty are
// estimated from the student's own answers, and the next review is set for when recall drops to 90 %.
// Reviews are daily, so an interval is never shorter than a day. A card whose stability reaches three weeks is learned
// and leaves the queue.

export type ReviewModule = "ent" | "sat";
const DAY = 86_400_000;
const LEARNED_DAYS = 21;

type Card = Record<string, unknown> & { dueAt: Date; stability: number; reps: number };
let scheduler: Awaited<ReturnType<typeof DefaultScheduler>> | null = null;
const fsrs = async () => (scheduler ??= await DefaultScheduler({ desiredRetention: 0.9, enableFuzz: false, enableShortTerm: false, learningSteps: [], relearningSteps: [] }));
const revive = (json: string) => JSON.parse(json, (k, v) => (/At$/.test(k) && typeof v === "string" ? new Date(v) : v)) as Card;

export async function reviewResult(userId: string, module: ReviewModule, itemId: string, correct: boolean) {
  const now = new Date();
  const row = await one<{ card: string | null; due_at: number }>("SELECT card, due_at FROM review_queue WHERE user_id = ? AND module = ? AND item_id = ?", userId, module, itemId);
  if (!row && correct) return; // only mistakes enter the queue
  // A right answer only counts once the item is due, so the spacing is real.
  if (row && correct && row.due_at > now.getTime()) return;
  const s = await fsrs();
  const card = row?.card ? revive(row.card) : (s.newCard({ now }) as unknown as Card);
  const next = (s.review({ card: card as never, grade: correct ? Rating.Good : Rating.Again, now }) as unknown as { card: Card }).card;
  if (correct && next.stability >= LEARNED_DAYS) {
    await run("DELETE FROM review_queue WHERE user_id = ? AND module = ? AND item_id = ?", userId, module, itemId);
    return;
  }
  const due = Math.max(new Date(next.dueAt).getTime(), now.getTime() + DAY);
  // `stage` keeps the old meaning for the UI: how many due reviews in a row were right (0–2).
  const stage = correct ? Math.min(2, next.reps > 1 ? Math.floor(Math.log2(Math.max(1, next.stability))) : 0) : 0;
  await run(
    "INSERT INTO review_queue (user_id, module, item_id, stage, due_at, updated_at, card) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, module, item_id) DO UPDATE SET stage = excluded.stage, due_at = excluded.due_at, updated_at = excluded.updated_at, card = excluded.card",
    userId,
    module,
    itemId,
    stage,
    due,
    now.getTime(),
    JSON.stringify(next),
  );
}

export async function reviewSummary(userId: string) {
  const now = Date.now();
  const rows = await all<{ module: ReviewModule; item_id: string; stage: number; due_at: number; card: string | null; ent_data: string | null }>(
    "SELECT r.module, r.item_id, r.stage, r.due_at, r.card, q.data ent_data FROM review_queue r LEFT JOIN ent_questions q ON r.module = 'ent' AND q.id = r.item_id WHERE r.user_id = ? ORDER BY r.due_at",
    userId,
  ).then((rows) => rows.filter((r) => r.module !== "ent" || (r.ent_data && isUsableEnt(JSON.parse(r.ent_data)))));
  const due = rows.filter((r) => r.due_at <= now);
  const days = Array.from({ length: 7 }, (_, i) => {
    const from = now + i * DAY;
    return { day: i, ent: rows.filter((r) => r.module === "ent" && r.due_at > from && r.due_at <= from + DAY).length, sat: rows.filter((r) => r.module === "sat" && r.due_at > from && r.due_at <= from + DAY).length };
  });
  const stability = rows.map((r) => (r.card ? revive(r.card).stability : 0));
  return {
    due: { ent: due.filter((r) => r.module === "ent").map((r) => r.item_id), sat: due.filter((r) => r.module === "sat").map((r) => r.item_id) },
    total: rows.length,
    stages: [0, 1, 2].map((s) => rows.filter((r) => r.stage === s).length),
    days,
    /** average FSRS stability of the queue, days: how long mistakes stay remembered */
    memoryDays: stability.length ? Math.round((stability.reduce((a, b) => a + b, 0) / stability.length) * 10) / 10 : 0,
  };
}
