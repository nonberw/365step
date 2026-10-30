import { Router } from "express";
import type { ConsultKind, ConsultSlot } from "../../shared/types";
import { requireStudent, requireTeacher, requireUser, type UserRow } from "../auth";
import { all, id, one, run } from "../db";
import { HttpError, must, num, str, wrap } from "../http";
import { teacherName } from "./exams";

// Extra lessons and consultations: a teacher opens time slots (once or weekly),
// students sign up while seats last and the teacher sees who is coming.

export const consultRouter = Router();

const DAY = 86_400_000;
const KINDS: ConsultKind[] = ["lesson", "consultation"];

interface SlotRow {
  id: string;
  teacher_id: string;
  series_id: string | null;
  kind: ConsultKind;
  title: string;
  subject: string;
  description: string;
  starts_at: number;
  duration_min: number;
  capacity: number;
  place: string;
  online_url: string;
  class_code: string | null;
  cancelled: number;
  created_at: number;
  booked: number;
  t_title: string | null;
  t_first: string;
  t_last: string;
}

const SELECT = `SELECT s.*, (SELECT COUNT(*) FROM consult_bookings b WHERE b.slot_id = s.id) AS booked,
  t.title AS t_title, t.first_name AS t_first, t.last_name AS t_last
  FROM consult_slots s JOIN users t ON t.id = s.teacher_id`;

const view = (s: SlotRow): ConsultSlot => ({
  id: s.id,
  seriesId: s.series_id,
  kind: s.kind,
  title: s.title,
  subject: s.subject,
  description: s.description,
  startsAt: s.starts_at,
  durationMin: s.duration_min,
  capacity: s.capacity,
  booked: s.booked,
  place: s.place,
  onlineUrl: s.online_url,
  classCode: s.class_code,
  cancelled: !!s.cancelled,
  teacher: teacherName(s.t_title, s.t_first, s.t_last),
});

/** Slots a student may see: open to the whole school or to one of their classes. */
const VISIBLE = "(s.class_code IS NULL OR s.class_code IN (SELECT class_code FROM class_members WHERE user_id = ?))";

// ---------- student ----------

consultRouter.get(
  "/",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const now = Date.now();
    const rows = await all<SlotRow & { my_note: string | null }>(
      `SELECT s.*, (SELECT COUNT(*) FROM consult_bookings b WHERE b.slot_id = s.id) AS booked,
        t.title AS t_title, t.first_name AS t_first, t.last_name AS t_last, mb.note AS my_note
       FROM consult_slots s JOIN users t ON t.id = s.teacher_id
       LEFT JOIN consult_bookings mb ON mb.slot_id = s.id AND mb.student_id = ?
       WHERE s.cancelled = 0 AND s.starts_at > ? AND s.starts_at < ? AND ${VISIBLE}
       ORDER BY s.starts_at`,
      u.id,
      now,
      now + 60 * DAY,
      u.id,
    );
    res.json(rows.map((r) => ({ ...view(r), mine: r.my_note !== null, myNote: r.my_note ?? undefined })));
  }),
);

consultRouter.get(
  "/mine",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const rows = await all<SlotRow & { my_note: string }>(
      `${SELECT.replace("FROM consult_slots s", ", mb.note AS my_note FROM consult_slots s")} JOIN consult_bookings mb ON mb.slot_id = s.id AND mb.student_id = ?
       WHERE s.starts_at + s.duration_min * 60000 > ? ORDER BY s.starts_at`,
      u.id,
      Date.now() - 30 * DAY,
    );
    res.json(rows.map((r) => ({ ...view(r), mine: true, myNote: r.my_note })));
  }),
);

consultRouter.post(
  "/:id/book",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const slotId = String(req.params.id);
    const s = must(await one<SlotRow>(`${SELECT} WHERE s.id = ? AND ${VISIBLE}`, slotId, u.id), 404, "Запись не найдена");
    if (s.cancelled) throw new HttpError(409, "Учитель отменил это занятие");
    if (s.starts_at <= Date.now()) throw new HttpError(409, "Занятие уже началось");
    // One statement checks the seats and inserts, so two students cannot take the last seat at once.
    const r = await run(
      `INSERT INTO consult_bookings (slot_id, student_id, note, created_at)
       SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM consult_bookings WHERE slot_id = ?) < (SELECT capacity FROM consult_slots WHERE id = ?)
       ON CONFLICT (slot_id, student_id) DO NOTHING`,
      slotId,
      u.id,
      str(req.body?.note, 500),
      Date.now(),
      slotId,
      slotId,
    );
    if (!r.changes) {
      const already = await one("SELECT 1 FROM consult_bookings WHERE slot_id = ? AND student_id = ?", slotId, u.id);
      throw new HttpError(409, already ? "Ты уже записан(а) на это занятие" : "Мест больше нет");
    }
    const fresh = (await one<SlotRow>(`${SELECT} WHERE s.id = ?`, slotId))!;
    res.status(201).json({ ...view(fresh), mine: true, myNote: str(req.body?.note, 500) });
  }),
);

consultRouter.delete(
  "/:id/book",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    await run("DELETE FROM consult_bookings WHERE slot_id = ? AND student_id = ?", String(req.params.id), u.id);
    res.json({ ok: true });
  }),
);

// ---------- teacher ----------

consultRouter.get(
  "/teacher",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const slots = await all<SlotRow>(`${SELECT} WHERE s.teacher_id = ? AND s.starts_at > ? ORDER BY s.starts_at`, t.id, Date.now() - 14 * DAY);
    const people = slots.length
      ? await all<{ slot_id: string; student_id: string; note: string; created_at: number; first_name: string; last_name: string; grade: number | null; class_letter: string | null }>(
          `SELECT b.*, u.first_name, u.last_name, u.grade, u.class_letter FROM consult_bookings b JOIN users u ON u.id = b.student_id
           WHERE b.slot_id IN (${slots.map(() => "?").join(",")}) ORDER BY b.created_at`,
          ...slots.map((s) => s.id),
        )
      : [];
    const classes = await all<{ code: string; name: string }>("SELECT code, name FROM classes WHERE teacher_id = ? ORDER BY created_at", t.id);
    res.json({
      classes,
      slots: slots.map((s) => ({
        ...view(s),
        attendees: people
          .filter((p) => p.slot_id === s.id)
          .map((p) => ({ id: p.student_id, name: `${p.first_name} ${p.last_name}`, grade: p.grade ? `${p.grade}${p.class_letter ?? ""}` : "", note: p.note, at: p.created_at })),
      })),
    });
  }),
);

consultRouter.post(
  "/teacher",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const b = req.body ?? {};
    const kind = KINDS.includes(b.kind) ? (b.kind as ConsultKind) : "consultation";
    const title = str(b.title, 120);
    if (!title) throw new HttpError(400, "Напишите тему занятия");
    const startsAt = Math.round(num(b.startsAt));
    if (!startsAt || startsAt < Date.now()) throw new HttpError(400, "Выберите дату и время в будущем");
    const classCode = str(b.classCode, 20).toUpperCase() || null;
    if (classCode) must(await one("SELECT 1 FROM classes WHERE code = ? AND teacher_id = ?", classCode, t.id), 404, "Класс не найден");
    const repeat = Math.min(12, Math.max(0, Math.round(num(b.repeatWeeks))));
    const series = repeat ? id() : null;
    const capacity = Math.min(200, Math.max(1, Math.round(num(b.capacity, kind === "consultation" ? 1 : 15))));
    const duration = Math.min(240, Math.max(10, Math.round(num(b.durationMin, kind === "consultation" ? 20 : 45))));
    const url = str(b.onlineUrl, 300);
    if (url && !/^https:\/\//i.test(url)) throw new HttpError(400, "Ссылка на онлайн-встречу должна начинаться с https://");
    for (let w = 0; w <= repeat; w++) {
      await run(
        `INSERT INTO consult_slots (id, teacher_id, series_id, kind, title, subject, description, starts_at, duration_min, capacity, place, online_url, class_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id(),
        t.id,
        series,
        kind,
        title,
        str(b.subject, 60),
        str(b.description, 1000),
        startsAt + w * 7 * DAY,
        duration,
        capacity,
        str(b.place, 120),
        url,
        classCode,
        Date.now(),
      );
    }
    res.status(201).json({ created: repeat + 1 });
  }),
);

async function ownSlot(t: UserRow, slotId: string) {
  return must(await one<{ id: string; series_id: string | null; starts_at: number }>("SELECT id, series_id, starts_at FROM consult_slots WHERE id = ? AND teacher_id = ?", slotId, t.id), 404, "Занятие не найдено");
}

/** Cancel keeps the slot so signed-up students see «отменено» in their list. */
consultRouter.post(
  "/teacher/:id/cancel",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const s = await ownSlot(t, String(req.params.id));
    if (req.body?.series && s.series_id) await run("UPDATE consult_slots SET cancelled = 1 WHERE series_id = ? AND teacher_id = ? AND starts_at >= ?", s.series_id, t.id, s.starts_at);
    else await run("UPDATE consult_slots SET cancelled = 1 WHERE id = ?", s.id);
    res.json({ ok: true });
  }),
);

consultRouter.delete(
  "/teacher/:id",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const s = await ownSlot(t, String(req.params.id));
    // Explicit: foreign key cascades are not guaranteed on the hosted database.
    await run("DELETE FROM consult_bookings WHERE slot_id = ?", s.id);
    await run("DELETE FROM consult_slots WHERE id = ?", s.id);
    res.json({ ok: true });
  }),
);

/** Anyone signed in can see the next session they are part of (student home widget). */
consultRouter.get(
  "/next",
  wrap(async (req, res) => {
    const u = requireUser(req);
    if (u.role !== "student") return res.json(null);
    const r = await one<SlotRow>(
      `${SELECT} JOIN consult_bookings mb ON mb.slot_id = s.id AND mb.student_id = ? WHERE s.cancelled = 0 AND s.starts_at + s.duration_min * 60000 > ? ORDER BY s.starts_at LIMIT 1`,
      u.id,
      Date.now(),
    );
    res.json(r ? { ...view(r), mine: true } : null);
  }),
);
