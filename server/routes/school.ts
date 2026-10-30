import { Router } from "express";
import { requireAdmin } from "../auth";
import { all, getCache, one, setCache } from "../db";
import { wrap } from "../http";
import { schoolSummary } from "../ai";
import { satStats } from "../progress";

// School report for the head of studies: all classes and teachers on one page,
// with students who need attention and the reasons.

export const schoolRouter = Router();

const DAY = 86_400_000;
const teacherName = (t: { title: string | null; first_name: string; last_name: string }) => (t.title ? `${{ mr: "Mr", ms: "Ms", mrs: "Mrs" }[t.title] ?? ""} ${t.last_name}`.trim() : `${t.first_name} ${t.last_name}`);

async function build(days: number) {
  const since = Date.now() - days * DAY;
  const week = Date.now() - 7 * DAY;
  const classes = await all<{ code: string; name: string; teacher_id: string }>("SELECT code, name, teacher_id FROM classes ORDER BY name");
  const teachers = await all<{ id: string; first_name: string; last_name: string; title: string | null }>("SELECT id, first_name, last_name, title FROM users WHERE role = 'teacher'");
  const tName = new Map(teachers.map((t) => [t.id, teacherName(t)]));

  const risk: { id: string; name: string; className: string; reasons: string[] }[] = [];
  const classRows = [];
  for (const c of classes) {
    const students = await all<{ id: string; first_name: string; last_name: string }>("SELECT u.id, u.first_name, u.last_name FROM users u JOIN class_members m ON m.user_id = u.id WHERE m.class_code = ?", c.code);
    let active = 0;
    let entMocks = 0;
    const bests: number[] = [];
    let pass50 = 0;
    const sat: number[] = [];
    for (const s of students) {
      const last = (await one<{ at: number | null }>("SELECT MAX(at) at FROM xp_log WHERE user_id = ?", s.id))?.at ?? null;
      if (last && last >= week) active++;
      const full = (await all<{ result: string; finished_at: number }>("SELECT result, finished_at FROM ent_tests WHERE user_id = ? AND kind = 'full' AND finished_at IS NOT NULL ORDER BY finished_at", s.id)).map(
        (r) => ({ at: r.finished_at, ...(JSON.parse(r.result) as { total: number; passedAll: boolean }) }),
      );
      entMocks += (await one<{ n: number }>("SELECT COUNT(*) n FROM ent_tests WHERE user_id = ? AND finished_at >= ?", s.id, since))?.n ?? 0;
      const best = full.length ? Math.max(...full.map((f) => f.total)) : null;
      if (best !== null) bests.push(best);
      const lastFull = full.at(-1);
      if (lastFull && lastFull.passedAll && lastFull.total >= 50) pass50++;
      const st = await satStats(s.id);
      if (st.estimate && st.attempts >= 10) sat.push(st.estimate);

      const reasons: string[] = [];
      if (!last || last < Date.now() - 14 * DAY) reasons.push(last ? `не заходил ${Math.floor((Date.now() - last) / DAY)} дн.` : "ни разу не занимался");
      if (lastFull && (!lastFull.passedAll || lastFull.total < 50)) reasons.push(`последний пробный ЕНТ ${lastFull.total}/140${lastFull.passedAll ? "" : ", не прошёл порог блока"}`);
      const overdue = (await one<{ n: number }>("SELECT COUNT(*) n FROM assignments WHERE class_code = ? AND due_at IS NOT NULL AND due_at < ?", c.code, Date.now()))?.n ?? 0;
      if (overdue >= 2) {
        // assignmentDone would be exact but slow for the whole school: count finished work after the due date as a proxy.
        const exams = await one<{ n: number; low: number }>(
          "SELECT COUNT(*) n, SUM(CASE WHEN score * 1.0 / max_score < 0.5 THEN 1 ELSE 0 END) low FROM exam_attempts a JOIN exams e ON e.id = a.exam_id WHERE a.student_id = ? AND e.class_code = ? AND a.submitted_at IS NOT NULL",
          s.id,
          c.code,
        );
        if ((exams?.low ?? 0) >= 2) reasons.push(`${exams!.low} контрольных ниже 50%`);
      }
      if (reasons.length) risk.push({ id: s.id, name: `${s.last_name} ${s.first_name}`, className: c.name, reasons });
    }
    const exam = await one<{ n: number; avg: number | null }>(
      "SELECT COUNT(*) n, AVG(a.score * 1.0 / a.max_score) avg FROM exam_attempts a JOIN exams e ON e.id = a.exam_id WHERE e.class_code = ? AND a.submitted_at >= ?",
      c.code,
      since,
    );
    classRows.push({
      code: c.code,
      name: c.name,
      teacher: tName.get(c.teacher_id) ?? "",
      students: students.length,
      activePct: students.length ? Math.round((active / students.length) * 100) : 0,
      entMocks,
      entAvgBest: bests.length ? Math.round(bests.reduce((a, b) => a + b, 0) / bests.length) : null,
      pass50: bests.length ? Math.round((pass50 / bests.length) * 100) : null,
      satAvg: sat.length ? Math.round(sat.reduce((a, b) => a + b, 0) / sat.length / 10) * 10 : null,
      exams: exam?.n ?? 0,
      examAvg: exam?.avg !== null && exam?.avg !== undefined ? Math.round(exam.avg * 100) : null,
      risk: risk.filter((r) => r.className === c.name).length,
    });
  }

  const teacherRows = await Promise.all(
    teachers.map(async (t) => ({
      id: t.id,
      name: tName.get(t.id)!,
      classes: classes.filter((c) => c.teacher_id === t.id).length,
      exams: (await one<{ n: number }>("SELECT COUNT(*) n FROM exams WHERE teacher_id = ? AND created_at >= ?", t.id, since))?.n ?? 0,
      consultations: (await one<{ n: number }>("SELECT COUNT(*) n FROM consult_slots WHERE teacher_id = ? AND cancelled = 0 AND starts_at >= ? AND starts_at <= ?", t.id, since, Date.now()))?.n ?? 0,
      written: (await one<{ n: number }>("SELECT COUNT(*) n FROM written_checks WHERE teacher_id = ? AND created_at >= ?", t.id, since))?.n ?? 0,
      materials: (await one<{ n: number }>("SELECT COUNT(*) n FROM materials WHERE owner_id = ? AND created_at >= ?", t.id, since))?.n ?? 0,
    })),
  );

  const totalStudents = classRows.reduce((a, c) => a + c.students, 0);
  const totals = {
    classes: classes.length,
    teachers: teachers.length,
    students: totalStudents,
    activePct: totalStudents ? Math.round((classRows.reduce((a, c) => a + (c.activePct * c.students) / 100, 0) / totalStudents) * 100) : 0,
    entMocks: classRows.reduce((a, c) => a + c.entMocks, 0),
    exams: classRows.reduce((a, c) => a + c.exams, 0),
    risk: risk.length,
    consultations: teacherRows.reduce((a, t) => a + t.consultations, 0),
  };
  return { days, totals, classes: classRows, teachers: teacherRows, risk };
}

schoolRouter.get(
  "/report",
  wrap(async (req, res) => {
    await requireAdmin(req);
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    res.json(await build(days));
  }),
);

schoolRouter.post(
  "/report/summary",
  wrap(async (req, res) => {
    await requireAdmin(req);
    const days = [7, 30, 90].includes(Number(req.body?.days)) ? Number(req.body.days) : 30;
    const key = `school-summary:${days}:${new Date().toISOString().slice(0, 10)}`;
    const hit = await getCache(key);
    if (hit && !req.body?.fresh) return res.json(JSON.parse(hit));
    const r = await build(days);
    const out = await schoolSummary({ ...r, risk: r.risk.map((x) => ({ className: x.className, reasons: x.reasons })) });
    if (out.mode === "ai") await setCache(key, JSON.stringify(out));
    res.json(out);
  }),
);

schoolRouter.get(
  "/report.csv",
  wrap(async (req, res) => {
    await requireAdmin(req);
    const r = await build([7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30);
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines: unknown[][] = [
      ["Класс", "Учитель", "Учеников", "Активны за 7 дней, %", "Пробников ЕНТ", "Средний лучший ЕНТ", "Проходят порог 50, %", "Средний SAT", "Контрольных", "Средний % контрольных", "В зоне риска"],
      ...r.classes.map((c) => [c.name, c.teacher, c.students, c.activePct, c.entMocks, c.entAvgBest, c.pass50, c.satAvg, c.exams, c.examAvg, c.risk]),
      [],
      ["Ученик", "Класс", "Причины"],
      ...r.risk.map((x) => [x.name, x.className, x.reasons.join("; ")]),
    ];
    res.type("text/csv; charset=utf-8").setHeader("Content-Disposition", `attachment; filename="school-report-${r.days}d.csv"`);
    res.send("﻿" + lines.map((l) => l.map(cell).join(";")).join("\r\n"));
  }),
);
