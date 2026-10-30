import { Router } from "express";
import type { Campus, Goals, TeacherTitle } from "../../shared/types";
import { CAMPUSES, TITLES } from "../../shared/types";
import { checkPassword, createSession, hashPassword, requireUser, revokeSession, toPublic, type UserRow } from "../auth";
import { id, one, run } from "../db";
import { HttpError, str, wrap } from "../http";

export const authRouter = Router();

// Teachers register with a staff code from the school administration.
const TEACHER_INVITE_CODE = process.env.TEACHER_INVITE_CODE || "BSTS-TEACHER-2026";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function validateCommon(body: Record<string, unknown>) {
  const email = str(body.email, 120).toLowerCase();
  const password = String(body.password ?? "");
  const firstName = str(body.firstName, 40);
  const lastName = str(body.lastName, 40);
  const campus = str(body.campus, 20) as Campus;
  if (!firstName || !lastName) throw new HttpError(400, "Укажите имя и фамилию");
  if (!EMAIL.test(email)) throw new HttpError(400, "Проверьте адрес почты");
  if (password.length < 8) throw new HttpError(400, "Пароль должен быть не короче 8 символов");
  if (!/[0-9]/.test(password) || !/[A-Za-zА-Яа-я]/.test(password)) throw new HttpError(400, "В пароле нужны и буквы, и цифры");
  if (!(campus in CAMPUSES)) throw new HttpError(400, "Выберите кампус");
  if (await one("SELECT 1 FROM users WHERE email = ?", email)) throw new HttpError(409, "Аккаунт с такой почтой уже есть. Войдите в него");
  return { email, password, firstName, lastName, campus };
}

function sanitizeGoals(raw: unknown): Goals {
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
  return out;
}

authRouter.post(
  "/register/student",
  wrap(async (req, res) => {
    const b = req.body ?? {};
    const common = await validateCommon(b);
    const grade = Number(b.grade);
    if (!Number.isInteger(grade) || grade < 1 || grade > 11) throw new HttpError(400, "Выберите класс от 1 до 11");
    const classLetter = str(b.classLetter, 2).toUpperCase() || null;
    const classCode = str(b.classCode, 12).toUpperCase();
    if (classCode && !(await one("SELECT 1 FROM classes WHERE code = ?", classCode))) throw new HttpError(404, "Класс с таким кодом не найден. Код можно ввести позже");
    if (!b.consent) throw new HttpError(400, "Нужно согласие на обработку данных (для младше 18 лет — согласие родителя)");
    const interests = Array.isArray(b.interests) ? b.interests.map((x: unknown) => str(x, 30)).slice(0, 10) : [];
    const { hash, salt } = hashPassword(common.password);
    const userId = id();
    await run(
      `INSERT INTO users (id, role, email, pass_hash, salt, first_name, last_name, grade, class_letter, campus, goals, interests, created_at)
       VALUES (?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userId,
      common.email,
      hash,
      salt,
      common.firstName,
      common.lastName,
      grade,
      classLetter,
      common.campus,
      JSON.stringify(sanitizeGoals(b.goals)),
      JSON.stringify(interests),
      Date.now(),
    );
    if (classCode) await run("INSERT OR IGNORE INTO class_members (class_code, user_id, joined_at) VALUES (?, ?, ?)", classCode, userId, Date.now());
    const user = (await one<UserRow>("SELECT * FROM users WHERE id = ?", userId))!;
    res.status(201).json({ token: await createSession(userId), user: await toPublic(user) });
  }),
);

authRouter.post(
  "/register/teacher",
  wrap(async (req, res) => {
    const b = req.body ?? {};
    if (str(b.inviteCode, 40) !== TEACHER_INVITE_CODE) throw new HttpError(403, "Неверный код сотрудника. Его выдаёт администрация школы");
    const common = await validateCommon(b);
    const title = str(b.title, 4) as TeacherTitle;
    if (!(title in TITLES)) throw new HttpError(400, "Выберите обращение");
    const subjects = Array.isArray(b.subjects)
      ? b.subjects
          .map((x: unknown) => str(x, 40))
          .filter(Boolean)
          .slice(0, 8)
      : [];
    if (!subjects.length) throw new HttpError(400, "Выберите хотя бы один предмет");
    const { hash, salt } = hashPassword(common.password);
    const userId = id();
    await run(
      `INSERT INTO users (id, role, email, pass_hash, salt, first_name, last_name, title, campus, subjects, created_at)
       VALUES (?, 'teacher', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userId,
      common.email,
      hash,
      salt,
      common.firstName,
      common.lastName,
      title,
      common.campus,
      JSON.stringify(subjects),
      Date.now(),
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
    if (b.goals !== undefined && u.role === "student") await run("UPDATE users SET goals = ? WHERE id = ?", JSON.stringify(sanitizeGoals(b.goals)), u.id);
    if (Array.isArray(b.interests)) await run("UPDATE users SET interests = ? WHERE id = ?", JSON.stringify(b.interests.map((x: unknown) => str(x, 30)).slice(0, 10)), u.id);
    res.json(await toPublic((await one<UserRow>("SELECT * FROM users WHERE id = ?", u.id))!));
  }),
);
