import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Campus, Goals, PlanId, PublicUser, Role, TeacherTitle } from "../shared/types";
import { all, id, one, run, xpSummary } from "./db";
import { PLANT_SPECIES, type PlantSpecies } from "../shared/plants";
import { HttpError } from "./http";

export interface UserRow {
  id: string;
  role: Role;
  email: string;
  pass_hash: string;
  salt: string;
  first_name: string;
  last_name: string;
  title: TeacherTitle | null;
  grade: number | null;
  class_letter: string | null;
  campus: Campus;
  subjects: string;
  goals: string;
  interests: string;
  created_at: number;
  plan: string;
  plan_until: number | null;
  trial_used: number;
  plant: string | null;
}

const SESSION_DAYS = 30;

/** Pro lasts until plan_until; afterwards the account falls back to free. */
export const effectivePlan = (u: Pick<UserRow, "plan" | "plan_until">): PlanId => (u.plan === "pro" && (u.plan_until ?? 0) > Date.now() ? "pro" : "free");

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function checkPassword(password: string, salt: string, hash: string) {
  const a = Buffer.from(crypto.scryptSync(password, salt, 64).toString("hex"));
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function createSession(userId: string) {
  const token = id(32);
  await run("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", token, userId, Date.now());
  return token;
}

export async function toPublic(u: UserRow): Promise<PublicUser> {
  const classCodes =
    u.role === "student"
      ? (await all<{ class_code: string }>("SELECT class_code FROM class_members WHERE user_id = ?", u.id)).map((r) => r.class_code)
      : (await all<{ code: string }>("SELECT code FROM classes WHERE teacher_id = ?", u.id)).map((r) => r.code);
  return {
    id: u.id,
    role: u.role,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    title: u.title,
    grade: u.grade,
    classLetter: u.class_letter,
    campus: u.campus,
    subjects: JSON.parse(u.subjects),
    goals: JSON.parse(u.goals) as Goals,
    interests: JSON.parse(u.interests),
    classCodes,
    createdAt: u.created_at,
    plan: effectivePlan(u),
    planUntil: u.plan_until,
    trialUsed: !!u.trial_used,
    plant: PLANT_SPECIES.includes(u.plant as PlantSpecies) ? (u.plant as PlantSpecies) : null,
    ...(await xpSummary(u.id).then((x) => ({ xp: x.total, streak: x.streak }))),
    isAdmin: u.role === "teacher" ? await isAdmin(u) : false,
  };
}

declare global {
  namespace Express {
    interface Request { user?: UserRow; }
  }
}

/** Reads the bearer token. Routes that need a user call requireUser. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    if (token) {
      const s = await one<{ user_id: string; created_at: number }>("SELECT user_id, created_at FROM sessions WHERE token = ?", token);
      if (s && Date.now() - s.created_at < SESSION_DAYS * 86_400_000) {
        req.user = await one<UserRow>("SELECT * FROM users WHERE id = ?", s.user_id);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireUser(req: Request): UserRow {
  if (!req.user) throw new HttpError(401, "Войдите в аккаунт");
  return req.user;
}

export function requireStudent(req: Request): UserRow {
  const u = requireUser(req);
  if (u.role !== "student") throw new HttpError(403, "Этот раздел для учеников");
  return u;
}

export function requireTeacher(req: Request): UserRow {
  const u = requireUser(req);
  if (u.role !== "teacher") throw new HttpError(403, "Этот раздел для учителей");
  return u;
}

export async function revokeSession(req: Request) {
  const header = req.header("authorization") ?? "";
  if (header.startsWith("Bearer ")) await run("DELETE FROM sessions WHERE token = ?", header.slice(7));
}

/** Head of studies (завуч): listed in school_admins or in SCHOOL_ADMIN_EMAILS. */
export async function isAdmin(u: UserRow) {
  if (u.role !== "teacher") return false;
  const emails = (process.env.SCHOOL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (emails.includes(u.email.toLowerCase())) return true;
  return !!(await one("SELECT 1 FROM school_admins WHERE user_id = ?", u.id));
}

export async function requireAdmin(req: Request): Promise<UserRow> {
  const u = requireTeacher(req);
  if (!(await isAdmin(u))) throw new HttpError(403, "Отчёт по школе доступен завучу");
  return u;
}
