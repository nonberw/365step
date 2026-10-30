import crypto from "node:crypto";
import express, { Router } from "express";
import type { ExamFull, ExamGrade, ExamLiveRow, ExamQuestion, ExamQuestionType, ExamStatus, ExamSummary, ExamTake, MaterialInfo } from "../../shared/types";
import { requireStudent, requireTeacher, type UserRow } from "../auth";
import { all, id, one, run } from "../db";
import { HttpError, must, num, str, wrap } from "../http";
import { examGenerate, gradeOpen, type ExamRequest, type ExamSource } from "../ai";
import { MAX_UPLOAD, detect, extract, fileName, read, remove, save } from "../materials";

// Контрольные: the teacher uploads materials, Claude drafts the questions,
// the teacher edits and launches the exam for a class. Launch creates a short code;
// students enter it and the teacher watches progress live.

export const examsRouter = Router();

const ONLINE_MS = 20_000;
const GRACE_MS = 30_000;
const TYPES: ExamQuestionType[] = ["mcq", "tf", "short", "open"];

interface MaterialRow {
  id: string;
  owner_id: string;
  title: string;
  kind: MaterialInfo["kind"];
  mime: string;
  file: string;
  size: number;
  pages: number | null;
  text: string;
  created_at: number;
}

interface ExamRow {
  id: string;
  teacher_id: string;
  class_code: string;
  title: string;
  subject: string;
  instructions: string;
  items: string;
  material_ids: string;
  duration_min: number;
  lock: number;
  show_results: number;
  status: ExamStatus;
  code: string | null;
  mode: "ai" | "demo";
  created_at: number;
  started_at: number | null;
  ends_at: number | null;
  finished_at: number | null;
}

interface AttemptRow {
  exam_id: string;
  student_id: string;
  answers: string;
  current: number;
  away: number;
  away_count: number;
  started_at: number;
  last_seen: number;
  submitted_at: number | null;
  score: number | null;
  max_score: number | null;
  grades: string | null;
}

const materialInfo = (m: MaterialRow): MaterialInfo => ({ id: m.id, title: m.title, kind: m.kind, size: m.size, pages: m.pages, chars: m.text.length, createdAt: m.created_at });

const items = (e: ExamRow) => JSON.parse(e.items) as ExamQuestion[];
const maxScore = (qs: ExamQuestion[]) => qs.reduce((s, q) => s + q.points, 0);

async function ownExam(t: UserRow, examId: string) {
  return await settle(must(await one<ExamRow>("SELECT * FROM exams WHERE id = ? AND teacher_id = ?", examId, t.id), 404, "Контрольная не найдена"));
}

async function summary(e: ExamRow): Promise<ExamSummary> {
  const c = await one<{ name: string }>("SELECT name FROM classes WHERE code = ?", e.class_code);
  const students = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM class_members WHERE class_code = ?", e.class_code))?.n ?? 0;
  const submitted = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM exam_attempts WHERE exam_id = ? AND submitted_at IS NOT NULL", e.id))?.n ?? 0;
  return {
    id: e.id,
    title: e.title,
    subject: e.subject,
    classCode: e.class_code,
    className: c?.name ?? e.class_code,
    status: e.status,
    code: e.code,
    questions: items(e).length,
    durationMin: e.duration_min,
    createdAt: e.created_at,
    startedAt: e.started_at,
    submitted,
    students,
  };
}

async function full(e: ExamRow): Promise<ExamFull> {
  return { ...(await summary(e)), instructions: e.instructions, lock: !!e.lock, showResults: !!e.show_results, materialIds: JSON.parse(e.material_ids), items: items(e), endsAt: e.ends_at, mode: e.mode };
}

// ---------- grading ----------

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .replace(/[.!?;:]+$/, "")
    .trim();

function shortCorrect(given: string, accepted: string) {
  const g = norm(given);
  if (!g) return false;
  return accepted.split("|").some((a) => {
    const want = norm(a);
    const gn = Number(g);
    const wn = Number(want);
    if (want !== "" && Number.isFinite(gn) && Number.isFinite(wn)) return Math.abs(gn - wn) < 1e-9;
    return g === want;
  });
}

async function grade(qs: ExamQuestion[], answers: Record<string, string | number>) {
  const grades: Record<string, ExamGrade> = {};
  const open: { q: ExamQuestion; answer: string }[] = [];
  for (const q of qs) {
    const a = answers[q.id];
    if (q.type === "mcq" || q.type === "tf") {
      const ok = a !== undefined && a !== "" && Number(a) === Number(q.answer);
      grades[q.id] = { points: ok ? q.points : 0, max: q.points, correct: ok };
    } else if (q.type === "short") {
      const ok = shortCorrect(String(a ?? ""), String(q.answer));
      grades[q.id] = { points: ok ? q.points : 0, max: q.points, correct: ok };
    } else if (String(a ?? "").trim()) {
      open.push({ q, answer: String(a) });
    } else {
      grades[q.id] = { points: 0, max: q.points, correct: false, feedback: "Ответа нет." };
    }
  }
  const ai = await gradeOpen(open.map(({ q, answer }) => ({ prompt: q.prompt, model: String(q.answer), answer, max: q.points })));
  open.forEach(({ q }, i) => {
    grades[q.id] = { points: ai[i].points, max: q.points, correct: null, feedback: ai[i].feedback };
  });
  const score = Object.values(grades).reduce((s, g) => s + g.points, 0);
  return { grades, score, max: maxScore(qs) };
}

async function submitAttempt(e: ExamRow, a: AttemptRow, answers?: Record<string, string | number>) {
  const final = answers ?? (JSON.parse(a.answers) as Record<string, string | number>);
  const g = await grade(items(e), final);
  await run(
    "UPDATE exam_attempts SET answers = ?, submitted_at = ?, score = ?, max_score = ?, grades = ?, away = 0 WHERE exam_id = ? AND student_id = ? AND submitted_at IS NULL",
    JSON.stringify(final),
    Date.now(),
    g.score,
    g.max,
    JSON.stringify(g.grades),
    a.exam_id,
    a.student_id,
  );
}

async function finishExam(e: ExamRow) {
  await run("UPDATE exams SET status = 'finished', finished_at = ? WHERE id = ? AND status = 'live'", Date.now(), e.id);
  const open = await all<AttemptRow>("SELECT * FROM exam_attempts WHERE exam_id = ? AND submitted_at IS NULL", e.id);
  for (const a of open) await submitAttempt(e, a);
}

/** Time is up: close the exam lazily on the next request that touches it. */
async function settle(e: ExamRow): Promise<ExamRow> {
  if (e.status === "live" && e.ends_at && Date.now() > e.ends_at + GRACE_MS) {
    // Awaited: on Vercel work left running after the response may be stopped.
    await finishExam(e);
    return { ...e, status: "finished", finished_at: Date.now() };
  }
  return e;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
async function newCode() {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join("");
    if (!(await one("SELECT 1 FROM exams WHERE code = ?", code))) return code;
  }
}

// ---------- materials ----------

examsRouter.get(
  "/materials",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    res.json((await all<MaterialRow>("SELECT * FROM materials WHERE owner_id = ? ORDER BY created_at DESC", t.id)).map(materialInfo));
  }),
);

examsRouter.post(
  "/materials",
  express.raw({ type: () => true, limit: MAX_UPLOAD }),
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || !buf.length) throw new HttpError(400, "Файл пустой");
    const name = fileName(req);
    const { mime, kind } = detect(name, String(req.header("content-type") ?? ""));
    let parsed: { text: string; pages: number | null };
    try {
      parsed = await extract(kind, buf);
    } catch {
      throw new HttpError(422, "Не получилось прочитать файл. Проверьте, что он не повреждён и не защищён паролем");
    }
    const mid = id();
    await save(mid, buf, mime);
    await run(
      "INSERT INTO materials (id, owner_id, title, kind, mime, file, size, pages, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      mid,
      t.id,
      name.replace(/\.[a-z0-9]+$/i, ""),
      kind,
      mime,
      mid,
      buf.length,
      parsed.pages,
      parsed.text.slice(0, 2_000_000),
      Date.now(),
    );
    res.json(materialInfo((await one<MaterialRow>("SELECT * FROM materials WHERE id = ?", mid))!));
  }),
);

examsRouter.delete(
  "/materials/:id",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const m = must(await one<MaterialRow>("SELECT * FROM materials WHERE id = ? AND owner_id = ?", String(req.params.id), t.id), 404, "Материал не найден");
    await run("DELETE FROM materials WHERE id = ?", m.id);
    await remove(m.file);
    res.json({ ok: true });
  }),
);

examsRouter.get(
  "/materials/:id/file",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const m = must(await one<MaterialRow>("SELECT * FROM materials WHERE id = ? AND owner_id = ?", String(req.params.id), t.id), 404, "Материал не найден");
    const buf = must(await read(m.file), 404, "Файл не найден на сервере");
    res.type(m.mime).send(buf);
  }),
);

// ---------- teacher: exams ----------

examsRouter.get(
  "/",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const exams = await all<ExamRow>("SELECT * FROM exams WHERE teacher_id = ? ORDER BY created_at DESC", t.id);
    res.json(await Promise.all(exams.map(async (e) => summary(await settle(e)))));
  }),
);

examsRouter.post(
  "/generate",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const b = req.body ?? {};
    const classCode = str(b.classCode, 20).toUpperCase();
    must(await one("SELECT 1 FROM classes WHERE code = ? AND teacher_id = ?", classCode, t.id), 404, "Выберите свой класс");
    const title = str(b.title, 120);
    if (!title) throw new HttpError(400, "Введите название контрольной");
    const types = (Array.isArray(b.types) ? b.types : TYPES).filter((x: string): x is ExamQuestionType => TYPES.includes(x as ExamQuestionType));
    if (!types.length) throw new HttpError(400, "Выберите хотя бы один тип вопросов");
    const materialIds: string[] = (Array.isArray(b.materialIds) ? b.materialIds : []).map(String).slice(0, 8);
    const mats = await Promise.all(materialIds.map(async (m) => must(await one<MaterialRow>("SELECT * FROM materials WHERE id = ? AND owner_id = ?", m, t.id), 404, "Материал не найден")));
    const notes = str(b.notes, 20_000);
    if (!mats.length && !notes && !str(b.instructions)) throw new HttpError(400, "Загрузите материалы или опишите тему контрольной");

    const sources: ExamSource[] = await Promise.all(
      mats.map(async (m) => {
        const fits = (m.kind === "pdf" && m.size <= 20 * 1024 * 1024 && (m.pages ?? 0) <= 100) || (m.kind === "image" && m.size <= 5 * 1024 * 1024);
        return { title: m.title, kind: m.kind, mime: m.mime, text: m.text, data: fits ? (await read(m.file))?.toString("base64") : undefined };
      }),
    );
    if (notes) sources.push({ title: "Заметки учителя", kind: "text", mime: "text/plain", text: notes });

    const request: ExamRequest = {
      title,
      subject: str(b.subject, 60),
      grade: str(b.grade, 20),
      instructions: str(b.instructions, 2000),
      count: Math.min(30, Math.max(3, Math.round(num(b.count, 10)))),
      types,
      difficulty: (["easy", "mixed", "hard"] as const).includes(b.difficulty) ? b.difficulty : "mixed",
      language: (["ru", "kk", "en"] as const).includes(b.language) ? b.language : "ru",
    };
    const out = await examGenerate(request, sources);
    if (!out.items.length) throw new HttpError(422, "Не получилось составить вопросы: в материалах мало текста. Добавьте заметки по теме или другой файл");

    const eid = id();
    await run(
      "INSERT INTO exams (id, teacher_id, class_code, title, subject, instructions, items, material_ids, duration_min, lock, show_results, status, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
      eid,
      t.id,
      classCode,
      title,
      request.subject,
      request.instructions,
      JSON.stringify(out.items),
      JSON.stringify(materialIds),
      Math.min(240, Math.max(5, Math.round(num(b.durationMin, 30)))),
      b.lock === false ? 0 : 1,
      b.showResults === false ? 0 : 1,
      out.mode,
      Date.now(),
    );
    res.json(await full((await one<ExamRow>("SELECT * FROM exams WHERE id = ?", eid))!));
  }),
);

examsRouter.get(
  "/:id",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    res.json(await full(await ownExam(t, String(req.params.id))));
  }),
);

function cleanItems(raw: unknown): ExamQuestion[] {
  if (!Array.isArray(raw) || !raw.length) throw new HttpError(400, "В контрольной должен быть хотя бы один вопрос");
  return raw.slice(0, 60).map((x, i) => {
    const type = TYPES.includes(x?.type) ? (x.type as ExamQuestionType) : "short";
    const prompt = str(x?.prompt, 4000);
    if (!prompt) throw new HttpError(400, `Вопрос ${i + 1}: пустой текст`);
    const points = Math.min(10, Math.max(0.5, num(x?.points, 1)));
    const q: ExamQuestion = { id: str(x?.id, 20) || `q${i + 1}`, type, prompt, points, explanation: str(x?.explanation, 2000) || undefined, answer: "" };
    if (type === "mcq") {
      const choices = (Array.isArray(x.choices) ? x.choices : []).map((c: unknown) => str(c, 500)).filter(Boolean);
      if (choices.length < 2) throw new HttpError(400, `Вопрос ${i + 1}: нужно минимум 2 варианта`);
      q.choices = choices.slice(0, 6);
      q.answer = Math.min(choices.slice(0, 6).length - 1, Math.max(0, Math.round(num(x.answer))));
    } else if (type === "tf") {
      q.choices = ["Верно", "Неверно"];
      q.answer = num(x.answer) === 1 ? 1 : 0;
    } else {
      q.answer = str(x?.answer, 4000);
      if (!q.answer) throw new HttpError(400, `Вопрос ${i + 1}: укажите ${type === "short" ? "правильный ответ" : "эталонный ответ"}`);
    }
    return q;
  });
}

examsRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const e = await ownExam(t, String(req.params.id));
    const b = req.body ?? {};
    if (e.status !== "draft" && b.items) throw new HttpError(409, "Вопросы можно менять только до запуска");
    const next = {
      title: b.title !== undefined ? str(b.title, 120) || e.title : e.title,
      items: b.items !== undefined ? JSON.stringify(cleanItems(b.items)) : e.items,
      duration: b.durationMin !== undefined ? Math.min(240, Math.max(5, Math.round(num(b.durationMin, e.duration_min)))) : e.duration_min,
      lock: b.lock !== undefined ? (b.lock ? 1 : 0) : e.lock,
      show: b.showResults !== undefined ? (b.showResults ? 1 : 0) : e.show_results,
    };
    await run("UPDATE exams SET title = ?, items = ?, duration_min = ?, lock = ?, show_results = ? WHERE id = ?", next.title, next.items, next.duration, next.lock, next.show, e.id);
    res.json(await full((await one<ExamRow>("SELECT * FROM exams WHERE id = ?", e.id))!));
  }),
);

examsRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const e = await ownExam(t, String(req.params.id));
    if (e.status === "live") throw new HttpError(409, "Сначала завершите контрольную");
    // Explicit: foreign key cascades are not guaranteed on the hosted database.
    await run("DELETE FROM exam_attempts WHERE exam_id = ?", e.id);
    await run("DELETE FROM exams WHERE id = ?", e.id);
    res.json({ ok: true });
  }),
);

examsRouter.post(
  "/:id/launch",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const e = await ownExam(t, String(req.params.id));
    if (e.status !== "draft") throw new HttpError(409, "Контрольная уже запускалась. Создайте копию, чтобы провести её ещё раз");
    if (await one("SELECT 1 FROM exams WHERE class_code = ? AND status = 'live' AND id <> ?", e.class_code, e.id)) throw new HttpError(409, "В этом классе уже идёт другая контрольная");
    const now = Date.now();
    await run("UPDATE exams SET status = 'live', code = ?, started_at = ?, ends_at = ? WHERE id = ?", await newCode(), now, now + e.duration_min * 60_000, e.id);
    res.json(await full((await one<ExamRow>("SELECT * FROM exams WHERE id = ?", e.id))!));
  }),
);

examsRouter.post(
  "/:id/copy",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const e = await ownExam(t, String(req.params.id));
    const eid = id();
    await run(
      "INSERT INTO exams (id, teacher_id, class_code, title, subject, instructions, items, material_ids, duration_min, lock, show_results, status, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
      eid,
      t.id,
      str(req.body?.classCode, 20).toUpperCase() || e.class_code,
      `${e.title} (копия)`,
      e.subject,
      e.instructions,
      e.items,
      e.material_ids,
      e.duration_min,
      e.lock,
      e.show_results,
      e.mode,
      Date.now(),
    );
    res.json({ id: eid });
  }),
);

examsRouter.post(
  "/:id/extend",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const e = await ownExam(t, String(req.params.id));
    if (e.status !== "live") throw new HttpError(409, "Контрольная не идёт");
    const minutes = Math.min(60, Math.max(1, Math.round(num(req.body?.minutes, 5))));
    await run("UPDATE exams SET ends_at = ends_at + ?, duration_min = duration_min + ? WHERE id = ?", minutes * 60_000, minutes, e.id);
    res.json(await full((await one<ExamRow>("SELECT * FROM exams WHERE id = ?", e.id))!));
  }),
);

examsRouter.post(
  "/:id/finish",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const e = await ownExam(t, String(req.params.id));
    if (e.status === "live") await finishExam(e);
    res.json(await full((await one<ExamRow>("SELECT * FROM exams WHERE id = ?", e.id))!));
  }),
);

examsRouter.get(
  "/:id/live",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const e = await ownExam(t, String(req.params.id));
    const qs = items(e);
    const max = maxScore(qs);
    const attempts = new Map((await all<AttemptRow>("SELECT * FROM exam_attempts WHERE exam_id = ?", e.id)).map((a) => [a.student_id, a]));
    const now = Date.now();
    const rows: ExamLiveRow[] = (await all<UserRow>("SELECT u.* FROM users u JOIN class_members m ON m.user_id = u.id WHERE m.class_code = ? ORDER BY u.last_name", e.class_code)).map((u) => {
      const a = attempts.get(u.id);
      const answers = a ? (JSON.parse(a.answers) as Record<string, unknown>) : {};
      const state: ExamLiveRow["state"] = !a ? "waiting" : a.submitted_at ? "submitted" : a.away ? "away" : now - a.last_seen < ONLINE_MS ? "working" : "waiting";
      return {
        studentId: u.id,
        name: `${u.last_name} ${u.first_name}`,
        state,
        answered: qs.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "").length,
        current: a?.current ?? 0,
        awayCount: a?.away_count ?? 0,
        lastSeen: a?.last_seen ?? null,
        score: a?.score ?? null,
        maxScore: max,
      };
    });
    res.json({ exam: await full(e), rows, now });
  }),
);

async function resultsTable(e: ExamRow) {
  const qs = items(e);
  const attempts = await all<AttemptRow & { first_name: string; last_name: string }>(
    "SELECT a.*, u.first_name, u.last_name FROM exam_attempts a JOIN users u ON u.id = a.student_id WHERE a.exam_id = ? ORDER BY u.last_name",
    e.id,
  );
  return {
    questions: qs,
    rows: attempts.map((a) => ({
      studentId: a.student_id,
      name: `${a.last_name} ${a.first_name}`,
      score: a.score,
      max: a.max_score ?? maxScore(qs),
      awayCount: a.away_count,
      submittedAt: a.submitted_at,
      answers: JSON.parse(a.answers) as Record<string, string | number>,
      grades: a.grades ? (JSON.parse(a.grades) as Record<string, ExamGrade>) : {},
    })),
  };
}

examsRouter.get(
  "/:id/results",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const e = await ownExam(t, String(req.params.id));
    res.json(await resultsTable(e));
  }),
);

examsRouter.get(
  "/:id/results.csv",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const e = await ownExam(t, String(req.params.id));
    const { questions, rows } = await resultsTable(e);
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Ученик", "Баллы", "Максимум", "%", "Выходы из экзамена", ...questions.map((_, i) => `В${i + 1}`)];
    const body = rows.map((r) => [r.name, r.score ?? "", r.max, r.score !== null ? Math.round((r.score / r.max) * 100) : "", r.awayCount, ...questions.map((q) => r.grades[q.id]?.points ?? "")]);
    const csv = "﻿" + [head, ...body].map((line) => line.map(cell).join(";")).join("\r\n");
    res.type("text/csv; charset=utf-8").setHeader("Content-Disposition", `attachment; filename="exam-${e.id}.csv"`);
    res.send(csv);
  }),
);

/** The teacher overrides the points for one answer (AI grading of open answers is only a draft). */
examsRouter.post(
  "/:id/grade",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const e = await ownExam(t, String(req.params.id));
    const a = must(await one<AttemptRow>("SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?", e.id, str(req.body?.studentId, 40)), 404, "Работа не найдена");
    if (!a.submitted_at || !a.grades) throw new HttpError(409, "Работа ещё не сдана");
    const q = must(
      items(e).find((x) => x.id === str(req.body?.questionId, 20)),
      404,
      "Вопрос не найден",
    );
    const grades = JSON.parse(a.grades) as Record<string, ExamGrade>;
    const points = Math.min(q.points, Math.max(0, num(req.body?.points)));
    grades[q.id] = { ...(grades[q.id] ?? { max: q.points, correct: null }), points, feedback: str(req.body?.feedback, 1000) || grades[q.id]?.feedback };
    const score = Object.values(grades).reduce((s, g) => s + g.points, 0);
    await run("UPDATE exam_attempts SET grades = ?, score = ? WHERE exam_id = ? AND student_id = ?", JSON.stringify(grades), score, e.id, a.student_id);
    res.json({ ok: true, score });
  }),
);

// ---------- student ----------

async function studentExam(u: UserRow, examId: string) {
  const e = must(await one<ExamRow>("SELECT e.* FROM exams e JOIN class_members m ON m.class_code = e.class_code WHERE e.id = ? AND m.user_id = ?", examId, u.id), 404, "Контрольная не найдена");
  return await settle(e);
}

/** Live exams for the student's classes: the app shows a banner so nobody misses the start. */
examsRouter.get(
  "/student/active",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const rows = await all<ExamRow & { submitted_at: number | null; joined: number | null; t_first: string; t_last: string; t_title: string | null }>(
      `SELECT e.*, a.submitted_at, a.started_at AS joined, t.first_name AS t_first, t.last_name AS t_last, t.title AS t_title
       FROM exams e JOIN class_members m ON m.class_code = e.class_code JOIN users t ON t.id = e.teacher_id
       LEFT JOIN exam_attempts a ON a.exam_id = e.id AND a.student_id = ?
       WHERE m.user_id = ? AND e.status = 'live'`,
      u.id,
      u.id,
    );
    const settled = await Promise.all(rows.map(async (r) => ({ row: r, e: await settle(r) })));
    res.json(
      settled
        .filter(({ row, e }) => e.status === "live" && !row.submitted_at)
        .map(({ row, e }) => ({ id: e.id, title: e.title, subject: e.subject, endsAt: e.ends_at, joined: !!row.joined, teacher: teacherName(row.t_title, row.t_first, row.t_last) })),
    );
  }),
);

examsRouter.get(
  "/student/history",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    res.json(
      await all<{ id: string; title: string; subject: string; status: ExamStatus; submitted_at: number | null; score: number | null; max_score: number | null }>(
        "SELECT e.id, e.title, e.subject, e.status, a.submitted_at, CASE WHEN e.show_results THEN a.score END AS score, a.max_score FROM exam_attempts a JOIN exams e ON e.id = a.exam_id WHERE a.student_id = ? ORDER BY a.started_at DESC LIMIT 30",
        u.id,
      ),
    );
  }),
);

export const teacherName = (title: string | null, first: string, last: string) => (title ? `${{ mr: "Mr", ms: "Ms", mrs: "Mrs" }[title] ?? ""} ${last}`.trim() : `${first} ${last}`);

examsRouter.post(
  "/student/join",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const code = str(req.body?.code, 12)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (code.length !== 6) throw new HttpError(400, "Код состоит из 6 символов");
    const e = await settle(must(await one<ExamRow>("SELECT * FROM exams WHERE code = ?", code), 404, "Контрольная с таким кодом не найдена"));
    if (!(await one("SELECT 1 FROM class_members WHERE class_code = ? AND user_id = ?", e.class_code, u.id))) throw new HttpError(403, "Эта контрольная для другого класса. Проверьте код или вступите в класс в профиле");
    const a = await one<AttemptRow>("SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?", e.id, u.id);
    if (e.status !== "live" && !a) throw new HttpError(409, e.status === "draft" ? "Учитель ещё не запустил контрольную" : "Контрольная уже закончилась");
    if (!a) await run("INSERT INTO exam_attempts (exam_id, student_id, started_at, last_seen) VALUES (?, ?, ?, ?)", e.id, u.id, Date.now(), Date.now());
    res.json({ id: e.id });
  }),
);

async function attemptOf(u: UserRow, e: ExamRow) {
  return must(await one<AttemptRow>("SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?", e.id, u.id), 403, "Сначала введите код контрольной");
}

examsRouter.get(
  "/student/take/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const e = await studentExam(u, String(req.params.id));
    const a = await attemptOf(u, e);
    const qs = items(e);
    const t = (await one<UserRow>("SELECT * FROM users WHERE id = ?", e.teacher_id))!;
    const reveal = e.status === "finished" && e.show_results ? Object.fromEntries(qs.map((q) => [q.id, { answer: q.answer, explanation: q.explanation }])) : null;
    const take: ExamTake = {
      id: e.id,
      title: e.title,
      subject: e.subject,
      teacher: teacherName(t.title, t.first_name, t.last_name),
      durationMin: e.duration_min,
      endsAt: e.ends_at ?? Date.now(),
      lock: !!e.lock,
      items: qs.map(({ answer: _a, explanation: _e, ...q }) => q),
      answers: JSON.parse(a.answers),
      current: a.current,
      submitted: !!a.submitted_at || e.status === "finished",
      result: a.submitted_at && e.show_results ? { score: a.score ?? 0, max: a.max_score ?? maxScore(qs), grades: a.grades ? JSON.parse(a.grades) : {}, reveal } : null,
    };
    res.json(take);
  }),
);

examsRouter.post(
  "/student/take/:id/progress",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const e = await studentExam(u, String(req.params.id));
    const a = await attemptOf(u, e);
    if (a.submitted_at || e.status !== "live") return res.json({ ok: false, closed: true, endsAt: e.ends_at });
    const answers = sanitizeAnswers(req.body?.answers, items(e));
    const away = req.body?.away ? 1 : 0;
    await run(
      "UPDATE exam_attempts SET answers = ?, current = ?, away = ?, away_count = away_count + ?, last_seen = ? WHERE exam_id = ? AND student_id = ?",
      JSON.stringify(answers),
      Math.max(0, Math.round(num(req.body?.current))),
      away,
      away && !a.away ? 1 : 0,
      Date.now(),
      e.id,
      u.id,
    );
    res.json({ ok: true, endsAt: e.ends_at });
  }),
);

function sanitizeAnswers(raw: unknown, qs: ExamQuestion[]) {
  const out: Record<string, string | number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const q of qs) {
    const v = (raw as Record<string, unknown>)[q.id];
    if (v === undefined || v === null || v === "") continue;
    out[q.id] = q.type === "mcq" || q.type === "tf" ? Math.round(num(v, -1)) : str(v, 8000);
  }
  return out;
}

examsRouter.post(
  "/student/take/:id/submit",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const e = await studentExam(u, String(req.params.id));
    const a = await attemptOf(u, e);
    if (!a.submitted_at) {
      const late = e.status !== "live";
      await submitAttempt(e, a, late ? undefined : sanitizeAnswers(req.body?.answers, items(e)));
    }
    res.json({ ok: true });
  }),
);
