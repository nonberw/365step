import { Router } from "express";
import { effectivePlan, requireUser, toPublic, type UserRow } from "../auth";
import { one, run } from "../db";
import { HttpError, wrap } from "../http";
import { FREE_AI_PER_DAY, usedToday } from "../quota";

export const billingRouter = Router();

const DAY = 86_400_000;
const TRIAL_DAYS = 7;

export const PLANS = [
  { id: "free", name: "Старт", priceKzt: 0, period: null, features: ["Банк SAT и IELTS", "Пробные тесты", `${FREE_AI_PER_DAY} ИИ-ответов в день`, "Рейтинг и дуэли", "Подготовка к ЕНТ"] },
  { id: "pro", name: "Pro", priceKzt: 4990, period: "month", features: ["ИИ без лимита: разборы, Speaking, Writing", "Личный план до экзамена", "Мастер-режим ЕНТ (IRT)", "Кодинг с ИИ-наставником", "Инженерная лаборатория", "Отчёты родителям"] },
  { id: "pro-year", name: "Pro на год", priceKzt: 39900, period: "year", features: ["Всё из Pro", "Два месяца в подарок"] },
] as const;

billingRouter.get(
  "/",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const plan = effectivePlan(u);
    res.json({
      plan,
      planUntil: u.plan_until,
      trialUsed: !!u.trial_used,
      trialDays: TRIAL_DAYS,
      ai: { used: await usedToday(u.id), limit: plan === "pro" ? null : FREE_AI_PER_DAY },
      plans: PLANS,
      // Real payments need a provider; until BILLING_MODE=demo is set the checkout is closed.
      checkout: process.env.BILLING_MODE === "demo" ? "demo" : "closed",
    });
  }),
);

billingRouter.post(
  "/trial",
  wrap(async (req, res) => {
    const u = requireUser(req);
    if (u.trial_used) throw new HttpError(409, "Пробный период уже был использован");
    if (effectivePlan(u) === "pro") throw new HttpError(409, "У вас уже подключён Pro");
    await run("UPDATE users SET plan = 'pro', plan_until = ?, trial_used = 1 WHERE id = ?", Date.now() + TRIAL_DAYS * DAY, u.id);
    res.json(await toPublic((await one<UserRow>("SELECT * FROM users WHERE id = ?", u.id))!));
  }),
);

billingRouter.post(
  "/checkout",
  wrap(async (req, res) => {
    const u = requireUser(req);
    if (process.env.BILLING_MODE !== "demo") throw new HttpError(503, "Оплата ещё не подключена. Попробуйте 7 дней Pro бесплатно");
    const plan = PLANS.find((p) => p.id === req.body?.plan && p.id !== "free");
    if (!plan) throw new HttpError(400, "Выберите тариф");
    const base = Math.max(Date.now(), u.plan_until ?? 0);
    await run("UPDATE users SET plan = 'pro', plan_until = ? WHERE id = ?", base + (plan.period === "year" ? 365 : 30) * DAY, u.id);
    res.json(await toPublic((await one<UserRow>("SELECT * FROM users WHERE id = ?", u.id))!));
  }),
);
