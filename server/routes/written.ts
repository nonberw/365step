import express, { Router } from "express";
import { requireTeacher, type UserRow } from "../auth";
import { all, id, one, run } from "../db";
import { HttpError, must, num, str, wrap } from "../http";
import { writtenGrade, type WrittenResult } from "../ai";
import { read, remove, save } from "../materials";

// Written work from photos: the teacher uploads notebook photos, Claude transcribes and grades them
// by the teacher's criteria, the teacher confirms the score and it goes to the gradebook.

export const writtenRouter = Router();

interface CheckRow {
  id: string;
  teacher_id: string;
  class_code: string;
  student_id: string;
  title: string;
  task: string;
  criteria: string;
  max_score: number;
  images: string;
  result: string | null;
  final_score: number | null;
  comment: string;
  created_at: number;
  checked_at: number | null;
}

const IMAGE = /^image\/(jpeg|png|webp)$/;

async function view(c: CheckRow) {
  const st = await one<{ first_name: string; last_name: string }>("SELECT first_name, last_name FROM users WHERE id = ?", c.student_id);
  return {
    id: c.id,
    classCode: c.class_code,
    studentId: c.student_id,
    student: st ? `${st.last_name} ${st.first_name}` : "",
    title: c.title,
    task: c.task,
    criteria: c.criteria,
    max: c.max_score,
    images: (JSON.parse(c.images) as string[]).length,
    result: c.result ? (JSON.parse(c.result) as WrittenResult) : null,
    finalScore: c.final_score,
    comment: c.comment,
    createdAt: c.created_at,
    checkedAt: c.checked_at,
  };
}

async function own(t: UserRow, checkId: string) {
  return must(await one<CheckRow>("SELECT * FROM written_checks WHERE id = ? AND teacher_id = ?", checkId, t.id), 404, "Работа не найдена");
}

async function grade(c: CheckRow) {
  const ids = JSON.parse(c.images) as string[];
  const images = await Promise.all(
    ids.map(async (img) => {
      const buf = must(await read(img), 404, "Фото не найдено");
      return { mime: buf[0] === 0x89 ? "image/png" : buf[0] === 0x52 ? "image/webp" : "image/jpeg", data: buf.toString("base64") };
    }),
  );
  const result = await writtenGrade({ title: c.title, task: c.task, criteria: c.criteria, max: c.max_score, images });
  await run("UPDATE written_checks SET result = ? WHERE id = ?", JSON.stringify(result), c.id);
}

writtenRouter.get(
  "/",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const classes = await all<{ code: string; name: string }>("SELECT code, name FROM classes WHERE teacher_id = ? ORDER BY created_at", t.id);
    const students = await all<{ id: string; first_name: string; last_name: string; class_code: string }>(
      `SELECT u.id, u.first_name, u.last_name, m.class_code FROM users u JOIN class_members m ON m.user_id = u.id WHERE m.class_code IN (${classes.map(() => "?").join(",") || "''"}) ORDER BY u.last_name`,
      ...classes.map((c) => c.code),
    );
    const checks = await all<CheckRow>("SELECT * FROM written_checks WHERE teacher_id = ? ORDER BY created_at DESC LIMIT 40", t.id);
    res.json({ classes, students: students.map((s) => ({ id: s.id, name: `${s.last_name} ${s.first_name}`, classCode: s.class_code })), checks: await Promise.all(checks.map(view)) });
  }),
);

writtenRouter.post(
  "/upload",
  express.raw({ type: () => true, limit: 4 * 1024 * 1024 }),
  wrap(async (req, res) => {
    requireTeacher(req);
    const buf = req.body as Buffer;
    const mime = String(req.header("content-type") ?? "");
    if (!Buffer.isBuffer(buf) || !buf.length) throw new HttpError(400, "Пустой файл");
    if (!IMAGE.test(mime)) throw new HttpError(415, "Нужна фотография (JPEG, PNG или WebP)");
    const fid = `written-${id()}`;
    await save(fid, buf, mime);
    res.json({ id: fid });
  }),
);

writtenRouter.post(
  "/",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const b = req.body ?? {};
    const classCode = str(b.classCode, 20).toUpperCase();
    must(await one("SELECT 1 FROM classes WHERE code = ? AND teacher_id = ?", classCode, t.id), 404, "Класс не найден");
    must(await one("SELECT 1 FROM class_members WHERE class_code = ? AND user_id = ?", classCode, str(b.studentId, 40)), 404, "Ученик не найден в классе");
    const title = str(b.title, 120);
    if (!title) throw new HttpError(400, "Назовите работу");
    const images = (Array.isArray(b.images) ? b.images : [])
      .map((x: unknown) => str(x, 60))
      .filter((x: string) => x.startsWith("written-"))
      .slice(0, 6);
    if (!images.length) throw new HttpError(400, "Добавьте хотя бы одно фото");
    const max = Math.min(100, Math.max(1, num(b.max, 10)));
    const cid = id();
    await run(
      "INSERT INTO written_checks (id, teacher_id, class_code, student_id, title, task, criteria, max_score, images, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      cid,
      t.id,
      classCode,
      str(b.studentId, 40),
      title,
      str(b.task, 3000),
      str(b.criteria, 3000),
      max,
      JSON.stringify(images),
      Date.now(),
    );
    const c = (await one<CheckRow>("SELECT * FROM written_checks WHERE id = ?", cid))!;
    await grade(c);
    res.json(await view((await one<CheckRow>("SELECT * FROM written_checks WHERE id = ?", cid))!));
  }),
);

writtenRouter.post(
  "/:id/regrade",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const c = await own(t, String(req.params.id));
    await grade(c);
    res.json(await view((await one<CheckRow>("SELECT * FROM written_checks WHERE id = ?", c.id))!));
  }),
);

writtenRouter.post(
  "/:id/confirm",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const c = await own(t, String(req.params.id));
    const score = Math.min(c.max_score, Math.max(0, Math.round(num(req.body?.score, 0) * 2) / 2));
    await run("UPDATE written_checks SET final_score = ?, comment = ?, checked_at = ? WHERE id = ?", score, str(req.body?.comment, 1000), Date.now(), c.id);
    res.json(await view((await one<CheckRow>("SELECT * FROM written_checks WHERE id = ?", c.id))!));
  }),
);

writtenRouter.get(
  "/:id/image/:n",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const c = await own(t, String(req.params.id));
    const img = must((JSON.parse(c.images) as string[])[Number(req.params.n)], 404, "Фото не найдено");
    const buf = must(await read(img), 404, "Фото не найдено");
    res.type(buf[0] === 0x89 ? "image/png" : "image/jpeg").send(buf);
  }),
);

writtenRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const c = await own(t, String(req.params.id));
    for (const img of JSON.parse(c.images) as string[]) await remove(img);
    await run("DELETE FROM written_checks WHERE id = ?", c.id);
    res.json({ ok: true });
  }),
);
