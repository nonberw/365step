import { Router } from "express";
import type { Goals } from "../../shared/types";
import { entSessionById, entTargetFor, isEntYear } from "../../shared/entSchedule";
import { PLANT_SPECIES, type PlantSpecies } from "../../shared/plants";
import { checkPassword, createSession, hashPassword, requireUser, revokeSession, toPublic, type UserRow } from "../auth";
import { id, one, run } from "../db";
import { HttpError, str, wrap } from "../http";

export const authRouter = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function validateCommon(body: Record<string, unknown>) {
  const email = str(body.email, 120).toLowerCase();
  const password = String(body.password ?? "");
  const firstName = str(body.firstName, 40);
  const lastName = str(body.lastName, 40);
  if (!firstName || !lastName) throw new HttpError(400, "Укажите имя и фамилию");
  if (!EMAIL.test(email)) throw new HttpError(400, "Проверьте адрес почты");
  if (password.length < 8) throw new HttpError(400, "Пароль должен быть не короче 8 символов");
  if (!/[0-9]/.test(password) || !/[A-Za-zА-Яа-я]/.test(password)) throw new HttpError(400, "В пароле нужны и буквы, и цифры");
  if (await one("SELECT 1 FROM users WHERE email = ?", email)) throw new HttpError(409, "Аккаунт с такой почтой уже есть. Войдите в него");
  return { email, password, firstName, lastName };
}

function sanitizeGoals(raw: unknown, grade: number | null = null): Goals {
  const g = (raw ?? {}) as Goals;
  const out: Goals = {};
  const satNum = (v: unknown) => (Number(v) >= 400 && Number(v) <= 1600 ? Math.round(Number(v) / 10) * 10 : undefined);
  const band = (v: unknown) => (Number(v) >= 1 && Number(v) <= 9 ? Math.round(Number(v) * 2) / 2 : undefined);
  if (g.sat && satNum(g.sat.target)) out.sat = { target: satNum(g.sat.target)!, date: str(g.sat.date, 10), current: satNum(g.sat.current) };
  if (g.ielts && band(g.ielts.target)) out.ielts = { target: band(g.ielts.target)!, date: str(g.ielts.date, 10), current: band(g.ielts.current) };
  if (g.coding) out.coding = true;
  if ([10, 20, 30, 45, 60, 90].includes(Number(g.dailyMinutes))) out.dailyMinutes = Number(g.dailyMinutes);
  if (g.hardest) out.hardest = str(g.hardest, 60);
  if (g.university) out.university = str(g.university, 80);
  if (g.country) out.country = str(g.country, 40);
  if (g.major) out.major = str(g.major, 60);
  if (g.ent && Number(g.ent.target) >= 50 && Number(g.ent.target) <= 140) {
    const { year, session, date } = g.ent;
    if (year !== undefined && !isEntYear(year)) throw new HttpError(400, "Проверьте год сдачи ЕНТ");
    if (session !== undefined && !entSessionById(session)) throw new HttpError(400, "Проверьте сессию ЕНТ");
    if (date !== undefined && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || !isEntYear(Number(date.slice(0, 4))))) throw new HttpError(400, "Проверьте дату ЕНТ");
    const years = [year, session ? Number(session.slice(0, 4)) : undefined, date ? Number(date.slice(0, 4)) : undefined].filter((v) => v !== undefined);
    if (new Set(years).size > 1) throw new HttpError(400, "Год, дата и сессия ЕНТ должны совпадать");
    const exam = entTargetFor(g, grade);
    out.ent = { target: Math.round(Number(g.ent.target)), year: exam.year, date: exam.date, tentative: g.ent.tentative !== false, ...(session || !date ? { session: exam.session } : {}) };
  }
  if (g.level && ["beginner", "middle", "advanced"].includes(g.level)) out.level = g.level;
  return out;
}

const TRIAL_DAYS = 7;

authRouter.post(
  "/register",
  wrap(async (req, res) => {
    const b = req.body ?? {};
    const common = await validateCommon(b);
    const grade = b.grade === null || b.grade === undefined || b.grade === "" ? null : Number(b.grade);
    if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 12)) throw new HttpError(400, "Класс от 1 до 12");
    if (!b.consent) throw new HttpError(400, "Нужно согласие на обработку данных (для младше 18 лет — согласие родителя)");
    const interests = Array.isArray(b.interests) ? b.interests.map((x: unknown) => str(x, 30)).slice(0, 10) : [];
    const { hash, salt } = hashPassword(common.password);
    const userId = id();
    // Everyone starts with a free week of Pro.
    await run(
      `INSERT INTO users (id, role, email, pass_hash, salt, first_name, last_name, grade, campus, goals, interests, created_at, plan, plan_until, trial_used, plant)
       VALUES (?, 'student', ?, ?, ?, ?, ?, ?, 'online', ?, ?, ?, 'pro', ?, 1, ?)`,
      userId,
      common.email,
      hash,
      salt,
      common.firstName,
      common.lastName,
      grade,
      JSON.stringify(sanitizeGoals(b.goals, grade)),
      JSON.stringify(interests),
      Date.now(),
      Date.now() + TRIAL_DAYS * 86_400_000,
      PLANT_SPECIES.includes(b.plant) ? (b.plant as PlantSpecies) : null,
    );
    const user = (await one<UserRow>("SELECT * FROM users WHERE id = ?", userId))!;
    res.status(201).json({ token: await createSession(userId), user: await toPublic(user) });
  }),
);

authRouter.post(
  "/login",
  wrap(async (req, res) => {
    const email = str(req.body?.email, 120).toLowerCase();
    const password = String(req.body?.password ?? "");
    const user = await one<UserRow>("SELECT * FROM users WHERE email = ?", email);
    if (!user || !checkPassword(password, user.salt, user.pass_hash)) throw new HttpError(401, "Неверная почта или пароль");
    res.json({ token: await createSession(user.id), user: await toPublic(user) });
  }),
);

authRouter.post(
  "/logout",
  wrap(async (req, res) => {
    await revokeSession(req);
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  wrap(async (req, res) => {
    res.json(await toPublic(requireUser(req)));
  }),
);

authRouter.patch(
  "/me",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const b = req.body ?? {};
    if (b.goals !== undefined && u.role === "student") {
      const goals = sanitizeGoals(b.goals, u.grade);
      await run("UPDATE users SET goals = ? WHERE id = ?", JSON.stringify(goals), u.id);
      if (JSON.stringify(goals.ent) !== JSON.stringify(JSON.parse(u.goals).ent)) await run("UPDATE ent_profiles SET plan_stale = 1 WHERE user_id = ?", u.id);
    }
    if (b.plant !== undefined) {
      if (!PLANT_SPECIES.includes(b.plant)) throw new HttpError(400, "Выберите растение из списка");
      await run("UPDATE users SET plant = ? WHERE id = ?", b.plant, u.id);
    }
    if (Array.isArray(b.interests)) await run("UPDATE users SET interests = ? WHERE id = ?", JSON.stringify(b.interests.map((x: unknown) => str(x, 30)).slice(0, 10)), u.id);
    res.json(await toPublic((await one<UserRow>("SELECT * FROM users WHERE id = ?", u.id))!));
  }),
);
