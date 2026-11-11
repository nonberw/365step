import { IELTS_ACADEMIC } from "../content/ieltsAcademic";
import { checkReading, transcriptCriteria, type KeyedReadingQuestion } from "../../shared/ieltsAssessment";
import { Router } from "express";
import { requireStudent } from "../auth";
import { addXp, all, run, one, id } from "../db";
import { HttpError, must, str, wrap } from "../http";
import { AiRefusal, ieltsSpeaking, ieltsWriting } from "../ai";
import { LISTENING, READING, SPEAKING_PART1, SPEAKING_PART2, WRITING_TASK1, WRITING_TASK2 } from "../content/ielts";

export const ieltsRouter = Router();

const strip = <T extends { answer: string; why: string }>({ answer: _a, why: _w, evidence: _proof, ...q }: T & { evidence?: string }) => q;

ieltsRouter.get(
  "/content",
  wrap(async (req, res) => {
    requireStudent(req);
    res.json({
      speaking: { part1: SPEAKING_PART1, part2: SPEAKING_PART2 },
      writing: { task1: WRITING_TASK1, task2: WRITING_TASK2 },
      reading: READING.map((r) => ({ id: r.id, title: r.title, level: r.level, questions: r.questions.length })),
      readingStats: { sets: READING.length, uniquePassages: new Set(READING.map((r) => r.passage.toLowerCase().replace(/\s+/g, " ").trim())).size },
      academicReading: { id: IELTS_ACADEMIC.id, title: IELTS_ACADEMIC.title, minutes: 60, passages: 3, words: IELTS_ACADEMIC.passages.reduce((n, p) => n + p.passage.split(/\s+/).length, 0), questions: 40 },
      listening: LISTENING.map((l) => ({ id: l.id, title: l.title, section: l.section, questions: l.questions.length })),
    });
  }),
);

function aiErrors(e: unknown): never {
  if (e instanceof AiRefusal) throw new HttpError(422, "I.I. was unable to assess that response. Check that the text relates to the assignment");
  throw e;
}

ieltsRouter.post(
  "/writing",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const task = Number(req.body?.task) === 1 ? 1 : 2;
    const promptId = str(req.body?.promptId, 40);
    const text = String(req.body?.text ?? "").slice(0, 8000);
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words < 40) throw new HttpError(400, "Write at least 40 words so you have something to evaluate.");
    const prompt =
      task === 1
        ? must(
            WRITING_TASK1.find((p) => p.id === promptId),
            404,
            "Task not found",
          )
        : must(
            WRITING_TASK2.find((p) => p.id === promptId),
            404,
            "Task not found",
          );
    const chart =
      task === 1 && "series" in prompt ? `${prompt.title} (${prompt.unit}); categories: ${prompt.categories.join(", ")}; ${prompt.series.map((s) => `${s.name}: ${s.values.join(", ")}`).join("; ")}` : undefined;
    try {
      const result = await ieltsWriting(task, prompt.prompt, text, chart);
      await run(
        "INSERT INTO ielts_submissions (user_id, kind, prompt_id, text, result, overall, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        u.id,
        `writing${task}`,
        promptId,
        text,
        JSON.stringify(result),
        result.overall ?? 0,
        Date.now(),
      );
      await addXp(u.id, 25, "ielts-writing");
      res.json(result);
    } catch (e) {
      aiErrors(e);
    }
  }),
);

ieltsRouter.post(
  "/speaking",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const part = Math.min(3, Math.max(1, Number(req.body?.part) || 2));
    const prompt = str(req.body?.prompt, 600);
    const transcript = String(req.body?.transcript ?? "").slice(0, 6000);
    const seconds = Math.max(1, Math.min(600, Number(req.body?.seconds) || 0));
    if (transcript.trim().split(/\s+/).filter(Boolean).length < 10) throw new HttpError(400, "The answer is too short. At least say 20–30 seconds.");
    try {
      const result = await ieltsSpeaking(part, prompt, transcript, seconds);
      await run(
        "INSERT INTO ielts_submissions (user_id, kind, prompt_id, text, result, overall, at) VALUES (?, 'speaking', ?, ?, ?, ?, ?)",
        u.id,
        str(req.body?.promptId, 40) || `part${part}`,
        transcript,
        JSON.stringify(result),
        result.overall ?? 0,
        Date.now(),
      );
      await addXp(u.id, 20, "ielts-speaking");
      res.json(result);
    } catch (e) {
      aiErrors(e);
    }
  }),
);

ieltsRouter.get(
  "/history",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    res.json(
      (
        await all<{ id: number; kind: string; prompt_id: string; overall: number; at: number; result: string; text: string }>(
          "SELECT id, kind, prompt_id, overall, at, result, text FROM ielts_submissions WHERE user_id = ? ORDER BY at DESC LIMIT 30",
          u.id,
        )
      ).map((r) => {
        const result = JSON.parse(r.result);
        if (result.mode === "demo") return { ...r, overall: null, result: { ...result, overall: null, predicted: null, criteria: result.criteria?.map((c: { name: string }) => ({ name: c.name, band: null, comment: "Demonstration: The criterion was not evaluated." })) } };
        if (r.kind === "speaking") { const partial = transcriptCriteria(result.criteria ?? []); return { ...r, overall: partial.overall, result: { ...result, ...partial, predicted: null } }; }
        return { ...r, result };
      }),
    );
  }),
);

// ---------- reading & listening ----------

async function recordReading(module: "ielts-reading" | "ielts-listening", userId: string, setId: string, result: ReturnType<typeof checkReading>) {
  for (const it of result.items) await run("INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, ?, ?, ?, ?, 0, ?)", userId, module, `${setId}-${it.id}`, setId, it.correct ? 1 : 0, Date.now());
  await addXp(userId, result.right * 3, module);
}
async function check(module: "ielts-reading" | "ielts-listening", userId: string, setId: string, questions: KeyedReadingQuestion[], given: Record<string, string>) {
  const result = checkReading(questions, given);
  await recordReading(module, userId, setId, result);
  return result;
}

// Full original Academic Reading: persisted server deadline and answers, independently of browser reloads.
type ReadingRun = { id: string; user_id: string; ends_at: number; answers: string; result: string | null };
const examPublic = () => ({ ...IELTS_ACADEMIC, passages: IELTS_ACADEMIC.passages.map((p) => ({ ...p, questions: p.questions.map(strip) })) });
const runView = (r: ReadingRun) => ({ id: r.id, endsAt: r.ends_at, answers: JSON.parse(r.answers), result: r.result ? JSON.parse(r.result) : null, exam: examPublic() });
ieltsRouter.get("/reading-exam/active", wrap(async (req, res) => {
  const u = requireStudent(req);
  const r = await one<ReadingRun>("SELECT * FROM ielts_reading_runs WHERE user_id = ? AND result IS NULL ORDER BY started_at DESC LIMIT 1", u.id);
  res.json(r ? runView(r) : null);
}));
ieltsRouter.post("/reading-exam/start", wrap(async (req, res) => {
  const u = requireStudent(req);
  let r = await one<ReadingRun>("SELECT * FROM ielts_reading_runs WHERE user_id = ? AND result IS NULL ORDER BY started_at DESC LIMIT 1", u.id);
  if (!r) {
    const runId = id(), now = Date.now();
    await run("INSERT INTO ielts_reading_runs (id, user_id, exam_id, started_at, ends_at) VALUES (?, ?, ?, ?, ?)", runId, u.id, IELTS_ACADEMIC.id, now, now + 3600000);
    r = (await one<ReadingRun>("SELECT * FROM ielts_reading_runs WHERE id = ?", runId))!;
  }
  res.json(runView(r));
}));
ieltsRouter.post("/reading-exam/:id/answer", wrap(async (req, res) => {
  const u = requireStudent(req);
  const qid = str(req.body?.questionId, 3);
  if (!IELTS_ACADEMIC.passages.some((p) => p.questions.some((q) => q.id === qid))) throw new HttpError(400, "Unknown question");
  const updated = await run("UPDATE ielts_reading_runs SET answers = json_set(answers, ?, ?) WHERE id = ? AND user_id = ? AND result IS NULL AND ends_at > ?", `$."${qid}"`, str(req.body?.value, 120), String(req.params.id), u.id, Date.now());
  if (!updated.changes) throw new HttpError(409, "Time is up or the package is up.");
  res.json({ ok: true });
}));
ieltsRouter.post("/reading-exam/:id/finish", wrap(async (req, res) => {
  const u = requireStudent(req);
  const r = must(await one<ReadingRun>("SELECT * FROM ielts_reading_runs WHERE id = ? AND user_id = ?", String(req.params.id), u.id), 404, "No attempt found.");
  if (r.result) return res.json(JSON.parse(r.result));
  const given = Date.now() <= r.ends_at && req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : JSON.parse(r.answers);
  const result = checkReading(IELTS_ACADEMIC.passages.flatMap((p) => p.questions), given);
  const saved = await run("UPDATE ielts_reading_runs SET result = ?, answers = ? WHERE id = ? AND result IS NULL", JSON.stringify(result), JSON.stringify(Object.fromEntries(result.items.map((i) => [i.id, i.given]))), r.id);
  if (saved.changes) await recordReading("ielts-reading", u.id, IELTS_ACADEMIC.id, result);
  const stored = (await one<ReadingRun>("SELECT * FROM ielts_reading_runs WHERE id = ?", r.id))!;
  res.json(JSON.parse(stored.result!));
}));

ieltsRouter.get(
  "/reading/:id",
  wrap(async (req, res) => {
    requireStudent(req);
    const r = must(
      READING.find((x) => x.id === req.params.id),
      404,
      "Text not found",
    );
    res.json({ ...r, questions: r.questions.map(strip) });
  }),
);

ieltsRouter.post(
  "/reading/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const r = must(
      READING.find((x) => x.id === req.params.id),
      404,
      "Text not found",
    );
    res.json(await check("ielts-reading", u.id, r.id, r.questions, req.body?.answers ?? {}));
  }),
);

ieltsRouter.get(
  "/listening/:id",
  wrap(async (req, res) => {
    requireStudent(req);
    const l = must(
      LISTENING.find((x) => x.id === req.params.id),
      404,
      "Record not found",
    );
    // The script is sent because the browser reads it aloud; the page hides it until the answers are checked.
    res.json({ ...l, questions: l.questions.map(strip) });
  }),
);

ieltsRouter.post(
  "/listening/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const l = must(
      LISTENING.find((x) => x.id === req.params.id),
      404,
      "Record not found",
    );
    res.json(await check("ielts-listening", u.id, l.id, l.questions, req.body?.answers ?? {}));
  }),
);
