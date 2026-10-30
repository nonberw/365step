import { Router } from "express";
import { requireStudent } from "../auth";
import { addXp, all, run } from "../db";
import { HttpError, must, str, wrap } from "../http";
import { AiRefusal, ieltsSpeaking, ieltsWriting } from "../ai";
import { LISTENING, READING, SPEAKING_PART1, SPEAKING_PART2, WRITING_TASK1, WRITING_TASK2, bandFromRatio, normalise } from "../content/ielts";

export const ieltsRouter = Router();

const strip = <T extends { answer: string; why: string }>({ answer: _a, why: _w, ...q }: T) => q;

ieltsRouter.get(
  "/content",
  wrap(async (req, res) => {
    requireStudent(req);
    res.json({
      speaking: { part1: SPEAKING_PART1, part2: SPEAKING_PART2 },
      writing: { task1: WRITING_TASK1, task2: WRITING_TASK2 },
      reading: READING.map((r) => ({ id: r.id, title: r.title, level: r.level, questions: r.questions.length })),
      listening: LISTENING.map((l) => ({ id: l.id, title: l.title, section: l.section, questions: l.questions.length })),
    });
  }),
);

function aiErrors(e: unknown): never {
  if (e instanceof AiRefusal) throw new HttpError(422, "ИИ не смог оценить этот ответ. Проверь, что текст относится к заданию");
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
    if (words < 40) throw new HttpError(400, "Напиши хотя бы 40 слов, чтобы было что оценивать");
    const prompt =
      task === 1
        ? must(
            WRITING_TASK1.find((p) => p.id === promptId),
            404,
            "Задание не найдено",
          )
        : must(
            WRITING_TASK2.find((p) => p.id === promptId),
            404,
            "Задание не найдено",
          );
    const chart =
      task === 1 && "series" in prompt ? `${prompt.title} (${prompt.unit}); категории: ${prompt.categories.join(", ")}; ${prompt.series.map((s) => `${s.name}: ${s.values.join(", ")}`).join("; ")}` : undefined;
    try {
      const result = await ieltsWriting(task, prompt.prompt, text, chart);
      await run(
        "INSERT INTO ielts_submissions (user_id, kind, prompt_id, text, result, overall, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        u.id,
        `writing${task}`,
        promptId,
        text,
        JSON.stringify(result),
        result.overall,
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
    if (transcript.trim().split(/\s+/).filter(Boolean).length < 10) throw new HttpError(400, "Ответ слишком короткий. Говори хотя бы 20–30 секунд");
    try {
      const result = await ieltsSpeaking(part, prompt, transcript, seconds);
      await run(
        "INSERT INTO ielts_submissions (user_id, kind, prompt_id, text, result, overall, at) VALUES (?, 'speaking', ?, ?, ?, ?, ?)",
        u.id,
        str(req.body?.promptId, 40) || `part${part}`,
        transcript,
        JSON.stringify(result),
        result.overall,
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
      ).map((r) => ({ ...r, result: JSON.parse(r.result) })),
    );
  }),
);

// ---------- reading & listening ----------

async function check(module: "ielts-reading" | "ielts-listening", userId: string, setId: string, questions: { id: string; answer: string; why: string; kind: string }[], given: Record<string, string>) {
  const items = questions.map((q) => {
    const answer = normalise(String(given[q.id] ?? ""));
    const accepted = q.answer.split("|").map(normalise);
    const correct = !!answer && accepted.includes(answer);
    return { id: q.id, given: given[q.id] ?? "", answer: q.answer.split("|")[0], why: q.why, correct };
  });
  for (const it of items) await run("INSERT INTO attempts (user_id, module, item_id, skill, correct, ms, at) VALUES (?, ?, ?, ?, ?, 0, ?)", userId, module, `${setId}-${it.id}`, setId, it.correct ? 1 : 0, Date.now());
  const right = items.filter((i) => i.correct).length;
  await addXp(userId, right * 3, module);
  return { items, right, total: items.length, band: bandFromRatio(right, items.length) };
}

ieltsRouter.get(
  "/reading/:id",
  wrap(async (req, res) => {
    requireStudent(req);
    const r = must(
      READING.find((x) => x.id === req.params.id),
      404,
      "Текст не найден",
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
      "Текст не найден",
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
      "Запись не найдена",
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
      "Запись не найдена",
    );
    res.json(await check("ielts-listening", u.id, l.id, l.questions, req.body?.answers ?? {}));
  }),
);
