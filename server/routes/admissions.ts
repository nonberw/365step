import { Router } from "express";
import { requireStudent } from "../auth";
import { activityReview, essayBrainstorm, essayFeedback, type EssayKind } from "../ai";
import { addXp, all, id, one, run } from "../db";
import { HttpError, must, num, str, wrap } from "../http";
import type { Goals } from "../../shared/types";
import { REC_ROLES, REC_STATUSES, nuReadiness, upcomingDeadlines, type NuProfile, type Reminder } from "../../shared/admissions";

// Admissions workspace: the student's applications with deadlines and checklists, essay drafts with an AI coach,
// the activity list for Common App, which the portfolio fills from work done on the platform, recommenders,
// the Nazarbayev University readiness check and deadline reminders.

export const admissionsRouter = Router();

const SYSTEMS = ["us-ed", "us-ea", "us-rd", "ucas", "eu", "asia", "kz", "other"] as const;
const STATUSES = ["idea", "preparing", "submitted", "admitted", "waitlist", "rejected"] as const;
const KINDS: EssayKind[] = ["common-app", "why-us", "ucas", "motivation"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface AppRow {
  id: string;
  name: string;
  country: string;
  program: string;
  system: string;
  deadline: string | null;
  status: string;
  checklist: string;
  notes: string;
  tier: string | null;
  created_at: number;
}

const appOut = (r: AppRow) => ({ ...r, checklist: JSON.parse(r.checklist) as { id: string; label: string; done: boolean }[] });

/** Universities whose policies allow AI on application essays only for spelling and grammar. */
export const STRICT_AI = [/brown/i, /caltech|california institute of technology/i, /georgia tech|georgia institute of technology/i];
const TIERS = ["reach", "target", "likely"] as const;

/** Default checklist by application system. */
function checklistFor(system: string) {
  const base = [
    { id: "list", label: "Вуз в списке и требования проверены", done: false },
    { id: "tests", label: "Баллы SAT / IELTS отправлены", done: false },
    { id: "transcript", label: "Оценки (transcript) от школы", done: false },
  ];
  if (system.startsWith("us"))
    return [...base, { id: "essay", label: "Common App personal statement", done: false }, { id: "supp", label: "Supplements («Why us»)", done: false }, { id: "recs", label: "2 рекомендации учителей + counselor", done: false }, { id: "activities", label: "Activities list (10 позиций)", done: false }, { id: "aid", label: "CSS Profile / финансовая помощь", done: false }];
  if (system === "ucas") return [...base, { id: "essay", label: "UCAS personal statement (3 вопроса)", done: false }, { id: "recs", label: "Reference от школы", done: false }];
  if (system === "kz")
    return [
      { id: "list", label: "Категория приёма выбрана (NUET, SAT, олимпиада, NIS, IB)", done: false },
      { id: "nuet", label: "NUET: математика + Critical Thinking (по 30 вопросов за 60 мин)", done: false },
      { id: "ielts", label: "IELTS 6.0, Writing 6.0 (IELTS Online не принимается)", done: false },
      { id: "transcript", label: "Аттестат и оценки", done: false },
      { id: "essay", label: "Эссе / мотивационное письмо", done: false },
    ];
  if (system === "eu") return [...base, { id: "essay", label: "Мотивационное письмо", done: false }, { id: "cv", label: "CV", done: false }, { id: "recs", label: "Рекомендательное письмо", done: false }];
  return [...base, { id: "essay", label: "Эссе / мотивационное письмо", done: false }];
}

admissionsRouter.get(
  "/apps",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    res.json((await all<AppRow>("SELECT * FROM applications WHERE user_id = ? ORDER BY deadline IS NULL, deadline, created_at", u.id)).map(appOut));
  }),
);

admissionsRouter.post(
  "/apps",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const b = req.body ?? {};
    const name = str(b.name, 120);
    if (!name) throw new HttpError(400, "Укажи вуз или программу");
    const system = SYSTEMS.includes(b.system) ? (b.system as string) : "other";
    const n = (await one<{ n: number }>("SELECT COUNT(*) n FROM applications WHERE user_id = ?", u.id))?.n ?? 0;
    if (n >= 40) throw new HttpError(400, "В списке уже 40 вузов — этого точно хватит");
    const appId = id();
    await run(
      "INSERT INTO applications (id, user_id, name, country, program, system, deadline, status, checklist, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'idea', ?, '', ?)",
      appId,
      u.id,
      name,
      str(b.country, 60),
      str(b.program, 120),
      system,
      DATE.test(String(b.deadline)) ? String(b.deadline) : null,
      JSON.stringify(checklistFor(system)),
      Date.now(),
    );
    res.status(201).json(appOut((await one<AppRow>("SELECT * FROM applications WHERE id = ?", appId))!));
  }),
);

admissionsRouter.patch(
  "/apps/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const row = must(await one<AppRow>("SELECT * FROM applications WHERE id = ? AND user_id = ?", String(req.params.id), u.id), 404, "Заявка не найдена");
    const b = req.body ?? {};
    const status = STATUSES.includes(b.status) ? (b.status as string) : row.status;
    const checklist = Array.isArray(b.checklist) ? JSON.stringify(b.checklist.slice(0, 20).map((c: { id: unknown; label: unknown; done: unknown }) => ({ id: str(c.id, 30), label: str(c.label, 120), done: !!c.done }))) : row.checklist;
    const deadline = b.deadline === null ? null : DATE.test(String(b.deadline)) ? String(b.deadline) : row.deadline;
    const tier = b.tier === null ? null : TIERS.includes(b.tier) ? (b.tier as string) : row.tier;
    await run("UPDATE applications SET status = ?, checklist = ?, deadline = ?, notes = ?, tier = ? WHERE id = ?", status, checklist, deadline, b.notes !== undefined ? str(b.notes, 2000) : row.notes, tier, row.id);
    // Sending an application is a milestone: it grows the plant like a finished lesson.
    if (status === "submitted" && row.status !== "submitted") await addXp(u.id, 30, "application");
    res.json(appOut((await one<AppRow>("SELECT * FROM applications WHERE id = ?", row.id))!));
  }),
);

admissionsRouter.delete(
  "/apps/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    await run("DELETE FROM applications WHERE id = ? AND user_id = ?", String(req.params.id), u.id);
    res.json({ ok: true });
  }),
);

// ---------- essays ----------

interface EssayRow {
  id: string;
  kind: EssayKind;
  title: string;
  prompt: string;
  text: string;
  feedback: string | null;
  updated_at: number;
}

const essayOut = (r: EssayRow) => ({ ...r, feedback: r.feedback ? JSON.parse(r.feedback) : null });

admissionsRouter.get(
  "/essays",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    res.json((await all<EssayRow>("SELECT * FROM essays WHERE user_id = ? ORDER BY updated_at DESC", u.id)).map(essayOut));
  }),
);

admissionsRouter.post(
  "/essays",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const b = req.body ?? {};
    const kind = KINDS.includes(b.kind) ? (b.kind as EssayKind) : "common-app";
    if (b.id) {
      const row = must(await one<EssayRow>("SELECT * FROM essays WHERE id = ? AND user_id = ?", str(b.id, 40), u.id), 404, "Эссе не найдено");
      await run("UPDATE essays SET title = ?, prompt = ?, text = ?, kind = ?, updated_at = ? WHERE id = ?", str(b.title, 120) || row.title, str(b.prompt, 1500), String(b.text ?? "").slice(0, 20000), kind, Date.now(), row.id);
      return res.json(essayOut((await one<EssayRow>("SELECT * FROM essays WHERE id = ?", row.id))!));
    }
    const essayId = id();
    await run("INSERT INTO essays (id, user_id, kind, title, prompt, text, feedback, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)", essayId, u.id, kind, str(b.title, 120) || "Новое эссе", str(b.prompt, 1500), String(b.text ?? "").slice(0, 20000), Date.now());
    res.status(201).json(essayOut((await one<EssayRow>("SELECT * FROM essays WHERE id = ?", essayId))!));
  }),
);

admissionsRouter.delete(
  "/essays/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    await run("DELETE FROM essays WHERE id = ? AND user_id = ?", String(req.params.id), u.id);
    res.json({ ok: true });
  }),
);

admissionsRouter.post(
  "/essays/:id/feedback",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const row = must(await one<EssayRow>("SELECT * FROM essays WHERE id = ? AND user_id = ?", String(req.params.id), u.id), 404, "Эссе не найдено");
    if (row.text.trim().split(/\s+/).filter(Boolean).length < 60) throw new HttpError(400, "Напиши хотя бы 60 слов — так отзыв будет полезным");
    // The strictest policy among the student's universities applies: the personal statement goes to all of them.
    const apps = await all<{ name: string }>("SELECT name FROM applications WHERE user_id = ?", u.id);
    const grammarOnly = row.kind === "common-app" && apps.some((a) => STRICT_AI.some((re) => re.test(a.name)));
    const fb = await essayFeedback(row.kind, row.prompt, row.text, grammarOnly);
    await run("UPDATE essays SET feedback = ? WHERE id = ?", JSON.stringify(fb), row.id);
    await addXp(u.id, 15, "essay");
    res.json(fb);
  }),
);

admissionsRouter.post(
  "/brainstorm",
  wrap(async (req, res) => {
    requireStudent(req);
    const b = req.body ?? {};
    res.json(await essayBrainstorm(KINDS.includes(b.kind) ? b.kind : "common-app", str(b.prompt, 1500), str(b.notes, 3000)));
  }),
);

// ---------- activity list ----------

interface ActRow {
  id: string;
  source: string;
  position: string;
  organization: string;
  description: string;
  hours: number;
  weeks: number;
  created_at: number;
}

admissionsRouter.get(
  "/activities",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    res.json(await all<ActRow>("SELECT * FROM activities WHERE user_id = ? ORDER BY created_at", u.id));
  }),
);

admissionsRouter.post(
  "/activities",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const b = req.body ?? {};
    const n = (await one<{ n: number }>("SELECT COUNT(*) n FROM activities WHERE user_id = ?", u.id))?.n ?? 0;
    const existing = b.id ? await one<ActRow>("SELECT * FROM activities WHERE id = ? AND user_id = ?", str(b.id, 40), u.id) : undefined;
    if (!existing && n >= 10) throw new HttpError(400, "В Common App помещается 10 активностей — убери одну, чтобы добавить новую");
    const fields = [str(b.position, 50), str(b.organization, 100), str(b.description, 150), Math.max(0, Math.min(80, Number(b.hours) || 0)), Math.max(0, Math.min(52, Number(b.weeks) || 0))] as const;
    if (!fields[0] && !fields[2]) throw new HttpError(400, "Заполни роль или описание");
    if (existing) {
      await run("UPDATE activities SET position = ?, organization = ?, description = ?, hours = ?, weeks = ? WHERE id = ?", ...fields, existing.id);
      return res.json(await one<ActRow>("SELECT * FROM activities WHERE id = ?", existing.id));
    }
    const actId = id();
    await run("INSERT INTO activities (id, user_id, source, position, organization, description, hours, weeks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", actId, u.id, str(b.source, 60) || "custom", ...fields, Date.now());
    res.status(201).json(await one<ActRow>("SELECT * FROM activities WHERE id = ?", actId));
  }),
);

admissionsRouter.delete(
  "/activities/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    await run("DELETE FROM activities WHERE id = ? AND user_id = ?", String(req.params.id), u.id);
    res.json({ ok: true });
  }),
);

admissionsRouter.post(
  "/activities/review",
  wrap(async (req, res) => {
    requireStudent(req);
    const description = str(req.body?.description, 400);
    if (description.length < 10) throw new HttpError(400, "Сначала напиши описание сам — я подскажу, что улучшить");
    res.json(await activityReview(str(req.body?.facts, 2000), str(req.body?.position, 100), description));
  }),
);

admissionsRouter.get(
  "/policy",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const apps = await all<{ name: string }>("SELECT name FROM applications WHERE user_id = ?", u.id);
    res.json({ strict: apps.filter((a) => STRICT_AI.some((re) => re.test(a.name))).map((a) => a.name) });
  }),
);

// ---------- recommenders ----------

interface RecRow {
  id: string;
  name: string;
  role: string;
  subject: string;
  status: string;
  due: string | null;
  asked_at: number | null;
  notes: string;
}

const recOf = async (userId: string, recId: string) => must(await one<RecRow>("SELECT * FROM recommenders WHERE id = ? AND user_id = ?", recId, userId), 404, "Рекомендатель не найден");

admissionsRouter.get(
  "/recs",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    res.json(await all<RecRow>("SELECT id, name, role, subject, status, due, asked_at, notes FROM recommenders WHERE user_id = ? ORDER BY due IS NULL, due, created_at", u.id));
  }),
);

admissionsRouter.post(
  "/recs",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const b = req.body ?? {};
    const name = str(b.name, 80);
    if (!name) throw new HttpError(400, "Как зовут рекомендателя?");
    const n = (await one<{ n: number }>("SELECT COUNT(*) n FROM recommenders WHERE user_id = ?", u.id))?.n ?? 0;
    if (n >= 8) throw new HttpError(400, "Обычно нужно 2–3 рекомендателя, 8 — это предел");
    const recId = id();
    await run(
      "INSERT INTO recommenders (id, user_id, name, role, subject, status, due, notes, created_at) VALUES (?, ?, ?, ?, ?, 'idea', ?, '', ?)",
      recId,
      u.id,
      name,
      b.role in REC_ROLES ? String(b.role) : "teacher",
      str(b.subject, 60),
      DATE.test(String(b.due)) ? String(b.due) : null,
      Date.now(),
    );
    res.status(201).json(await recOf(u.id, recId));
  }),
);

admissionsRouter.patch(
  "/recs/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const row = await recOf(u.id, String(req.params.id));
    const b = req.body ?? {};
    const status = b.status in REC_STATUSES ? String(b.status) : row.status;
    const due = b.due === null ? null : DATE.test(String(b.due)) ? String(b.due) : row.due;
    const askedAt = row.asked_at ?? (status !== "idea" ? Date.now() : null);
    await run("UPDATE recommenders SET status = ?, due = ?, asked_at = ?, notes = ? WHERE id = ?", status, due, askedAt, b.notes !== undefined ? str(b.notes, 3000) : row.notes, row.id);
    if (status === "submitted" && row.status !== "submitted") await addXp(u.id, 10, "recommendation");
    res.json(await recOf(u.id, row.id));
  }),
);

admissionsRouter.delete(
  "/recs/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    await run("DELETE FROM recommenders WHERE id = ? AND user_id = ?", String(req.params.id), u.id);
    res.json({ ok: true });
  }),
);

// ---------- Nazarbayev University readiness ----------

const score = (v: unknown, min: number, max: number, step = 1) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Math.round(num(v, NaN) / step) * step;
  return n >= min && n <= max ? n : undefined;
};

function cleanNu(b: Record<string, unknown>): NuProfile {
  const category = b.category === "sat" || b.category === "olympiad" ? b.category : "nuet";
  return {
    category,
    nuetMath: score(b.nuetMath, 0, 120),
    nuetCtps: score(b.nuetCtps, 0, 120),
    sat: score(b.sat, 400, 1600, 10),
    ieltsOverall: score(b.ieltsOverall, 0, 9, 0.5),
    ieltsWriting: score(b.ieltsWriting, 0, 9, 0.5),
    ieltsOther: score(b.ieltsOther, 0, 9, 0.5),
    ieltsOnline: !!b.ieltsOnline,
    olympiad: str(b.olympiad, 120) || undefined,
  };
}

admissionsRouter.get(
  "/nu",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const row = await one<{ nu: string }>("SELECT nu FROM adm_profiles WHERE user_id = ?", u.id);
    const goals = JSON.parse(u.goals) as Goals;
    // Until the student fills it in, start from what onboarding already knows.
    const profile: NuProfile = row ? (JSON.parse(row.nu) as NuProfile) : { category: goals.sat ? "sat" : "nuet", sat: goals.sat?.current, ieltsOverall: goals.ielts?.current };
    res.json({ profile, checks: nuReadiness(profile), saved: !!row });
  }),
);

admissionsRouter.put(
  "/nu",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const profile = cleanNu(req.body ?? {});
    await run("INSERT INTO adm_profiles (user_id, nu, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET nu = excluded.nu, updated_at = excluded.updated_at", u.id, JSON.stringify(profile), Date.now());
    res.json({ profile, checks: nuReadiness(profile), saved: true });
  }),
);

// ---------- reminders ----------

export async function remindersFor(userId: string, goals: Goals): Promise<Reminder[]> {
  const apps = await all<{ id: string; name: string; deadline: string | null; status: string }>("SELECT id, name, deadline, status FROM applications WHERE user_id = ?", userId);
  const recs = await all<{ id: string; name: string; due: string | null; status: string }>("SELECT id, name, due, status FROM recommenders WHERE user_id = ?", userId);
  return upcomingDeadlines({ apps, recs, satDate: goals.sat?.date });
}

admissionsRouter.get(
  "/reminders",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    res.json(await remindersFor(u.id, JSON.parse(u.goals) as Goals));
  }),
);
