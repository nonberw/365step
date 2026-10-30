import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import { effectivePlan } from "./auth";
import { one, run } from "./db";
import { HttpError } from "./http";

/** Free accounts get a few AI answers a day; Pro is unlimited (fair use). */
export const FREE_AI_PER_DAY = Number(process.env.FREE_AI_PER_DAY) || 8;

interface Ctx {
  userId: string;
  pro: boolean;
}
const als = new AsyncLocalStorage<Ctx>();

/** Makes the signed-in user visible to ai.ts without threading it through every call. */
export function aiContext(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next();
  als.run({ userId: req.user.id, pro: effectivePlan(req.user) === "pro" }, next);
}

const today = () => new Date().toISOString().slice(0, 10);

export async function usedToday(userId: string) {
  return (await one<{ n: number }>("SELECT n FROM ai_usage WHERE user_id = ? AND day = ?", userId, today()))?.n ?? 0;
}

/** Called before every model request. Throws 402 when a free account is out of answers. */
export async function consumeAi() {
  const ctx = als.getStore();
  if (!ctx || ctx.pro) return;
  if ((await usedToday(ctx.userId)) >= FREE_AI_PER_DAY) {
    throw new HttpError(402, `Лимит бесплатных ИИ-ответов на сегодня исчерпан (${FREE_AI_PER_DAY}). Перейдите на Pro — без лимитов`);
  }
  await run(
    "INSERT INTO ai_usage (user_id, day, n) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET n = n + 1",
    ctx.userId,
    today(),
  );
}
