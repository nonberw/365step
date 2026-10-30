import { Router, type Request } from "express";
import { LESSONS } from "../../shared/content";
import { requireTeacher } from "../auth";
import { all, one } from "../db";
import { must, wrap } from "../http";

// Class gradebook: every graded piece of work in one table, with a 5-point mark
// from percentage thresholds the teacher can change, and CSV export for Kundelik.

export const journalRouter = Router();

interface Column {
  id: string;
  kind: "exam" | "lesson" | "written";
  title: string;
  at: number;
}

interface Cell {
  pct: number | null;
  mark: number | null;
  raw: string;
}

function scale(req: Request) {
  const n = (k: string, d: number) => Math.min(100, Math.max(1, Number(req.query[k]) || d));
  return { t5: n("t5", 85), t4: n("t4", 70), t3: n("t3", 50) };
}

const markOf = (pct: number, s: { t5: number; t4: number; t3: number }) => (pct >= s.t5 ? 5 : pct >= s.t4 ? 4 : pct >= s.t3 ? 3 : 2);

async function build(code: string, teacherId: string, s: { t5: number; t4: number; t3: number }) {
  const c = must(await one<{ code: string; name: string }>("SELECT code, name FROM classes WHERE code = ? AND teacher_id = ?", code.toUpperCase(), teacherId), 404, "Класс не найден");
  const students = await all<{ id: string; first_name: string; last_name: string }>(
    "SELECT u.id, u.first_name, u.last_name FROM users u JOIN class_members m ON m.user_id = u.id WHERE m.class_code = ? ORDER BY u.last_name, u.first_name",
    c.code,
  );
  const ids = students.map((x) => x.id);
  const marks = ids.map(() => "?").join(",") || "''";
  const columns: Column[] = [];
  const cells = new Map<string, Cell>(); // `${column}|${student}`

  const exams = await all<{ id: string; title: string; started_at: number | null; created_at: number }>(
    "SELECT id, title, started_at, created_at FROM exams WHERE class_code = ? AND status <> 'draft' ORDER BY COALESCE(started_at, created_at)",
    c.code,
  );
  for (const e of exams) {
    columns.push({ id: `exam:${e.id}`, kind: "exam", title: e.title, at: e.started_at ?? e.created_at });
    const rows = await all<{ student_id: string; score: number | null; max_score: number | null }>(
      `SELECT student_id, score, max_score FROM exam_attempts WHERE exam_id = ? AND submitted_at IS NOT NULL AND student_id IN (${marks})`,
      e.id,
      ...ids,
    );
    for (const r of rows) {
      if (r.score === null || !r.max_score) continue;
      const pct = Math.round((r.score / r.max_score) * 100);
      cells.set(`exam:${e.id}|${r.student_id}`, { pct, mark: markOf(pct, s), raw: `${r.score}/${r.max_score}` });
    }
  }

  const lessons = await all<{ lesson_id: string; user_id: string; teacher_grade: number; submitted_at: number | null }>(
    `SELECT lesson_id, user_id, teacher_grade, submitted_at FROM lesson_works WHERE teacher_grade IS NOT NULL AND user_id IN (${marks})`,
    ...ids,
  );
  for (const lid of [...new Set(lessons.map((l) => l.lesson_id))]) {
    const rows = lessons.filter((l) => l.lesson_id === lid);
    columns.push({ id: `lesson:${lid}`, kind: "lesson", title: `Урок: ${LESSONS.find((l) => l.id === lid)?.title ?? lid}`, at: Math.min(...rows.map((r) => r.submitted_at ?? Date.now())) });
    for (const r of rows) cells.set(`lesson:${lid}|${r.user_id}`, { pct: null, mark: r.teacher_grade, raw: String(r.teacher_grade) });
  }

  const written = await all<{ title: string; student_id: string; final_score: number | null; max_score: number; created_at: number }>(
    `SELECT title, student_id, final_score, max_score, created_at FROM written_checks WHERE class_code = ? AND final_score IS NOT NULL AND student_id IN (${marks})`,
    c.code,
    ...ids,
  );
  for (const title of [...new Set(written.map((w) => w.title))]) {
    const rows = written.filter((w) => w.title === title);
    const colId = `written:${title}`;
    columns.push({ id: colId, kind: "written", title: `Письменная: ${title}`, at: Math.min(...rows.map((r) => r.created_at)) });
    for (const r of rows) {
      const pct = Math.round((r.final_score! / r.max_score) * 100);
      cells.set(`${colId}|${r.student_id}`, { pct, mark: markOf(pct, s), raw: `${r.final_score}/${r.max_score}` });
    }
  }

  columns.sort((a, b) => a.at - b.at);
  const rows = students.map((st) => {
    const row = columns.map((col) => cells.get(`${col.id}|${st.id}`) ?? null);
    const got = row.filter((x): x is Cell => !!x && x.mark !== null);
    return { id: st.id, name: `${st.last_name} ${st.first_name}`, cells: row, average: got.length ? Math.round((got.reduce((a, x) => a + x.mark!, 0) / got.length) * 100) / 100 : null };
  });
  return { classRoom: c, scale: s, columns, rows };
}

journalRouter.get(
  "/:code",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    res.json(await build(String(req.params.code), t.id, scale(req)));
  }),
);

journalRouter.get(
  "/:code/export.csv",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const j = await build(String(req.params.code), t.id, scale(req));
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const date = (ms: number) => new Date(ms + 5 * 3600_000).toISOString().slice(0, 10).split("-").reverse().join(".");
    let lines: unknown[][];
    if (req.query.format === "wide") {
      lines = [["ФИО", ...j.columns.map((c) => `${c.title} (${date(c.at)})`), "Средний балл"], ...j.rows.map((r) => [r.name, ...r.cells.map((c) => c?.mark ?? ""), r.average ?? ""])];
    } else {
      // Long format: one line per mark — easy to paste into Kundelik column by column.
      lines = [["ФИО", "Класс", "Дата", "Работа", "Результат", "Процент", "Оценка"]];
      for (const r of j.rows)
        r.cells.forEach((c, i) => {
          if (c) lines.push([r.name, j.classRoom.name, date(j.columns[i]!.at), j.columns[i]!.title, c.raw, c.pct ?? "", c.mark ?? ""]);
        });
    }
    const csv = "﻿" + lines.map((l) => l.map(cell).join(";")).join("\r\n");
    res.type("text/csv; charset=utf-8").setHeader("Content-Disposition", `attachment; filename="journal-${j.classRoom.code}-${req.query.format === "wide" ? "table" : "kundelik"}.csv"`);
    res.send(csv);
  }),
);
