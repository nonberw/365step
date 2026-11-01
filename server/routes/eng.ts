import { Router } from "express";
import { requireTeacher, requireUser } from "../auth";
import { datasetJsonl, saveDesign, similarDesigns } from "../cadLibrary";
import { addXp, all, getCache, one, run, setCache } from "../db";
import { HttpError, num, str, wrap } from "../http";
import { AiRefusal, arduinoHelp, cadDesign } from "../ai";
import { MISSIONS } from "../../shared/droneMissions";
import { CAD_LESSONS } from "../../shared/cadLessons";
import { ARDUINO_LESSONS } from "../../src/lib/athena/lessons";
import { INTENTS, extractParams, predict, type IntentModel } from "../../shared/cadIntent";
import intentModel from "../../shared/models/cad-intent.json";

/** Below this confidence the school model hands the request to Claude (96.6 % accurate above it on held-out data). */
const LOCAL_THRESHOLD = 0.8;

// Engineering labs: best score per drone mission, CAD and Arduino lesson. XP is given once, on the first success.

export const engRouter = Router();

function xpFor(item: string) {
  const [kind, id] = item.split(":");
  if (kind === "drone") return MISSIONS.find((m) => m.id === id)?.xp;
  if (kind === "cad") return CAD_LESSONS.find((l) => l.id === id)?.xp;
  if (kind === "arduino") return ARDUINO_LESSONS.find((l) => l.id === id)?.xp;
  // robot descriptions from the URDF designer (one per robot type)
  if (kind === "robot") return ["manipulator", "mobile", "legged"].includes(id ?? "") ? 25 : undefined;
  return undefined;
}

engRouter.get(
  "/progress",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const rows = await all<{ item: string; score: number; at: number }>("SELECT item, score, at FROM eng_progress WHERE user_id = ?", u.id);
    res.json({ items: Object.fromEntries(rows.map((r) => [r.item, { score: r.score, at: r.at }])) });
  }),
);

engRouter.post(
  "/progress",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const item = str(req.body?.item, 60);
    const xp = xpFor(item);
    if (xp === undefined) throw new HttpError(400, "Неизвестное задание");
    const score = Math.round(Math.min(100, Math.max(0, num(req.body?.score, 0))));
    const had = await one<{ score: number }>("SELECT score FROM eng_progress WHERE user_id = ? AND item = ?", u.id, item);
    if (!had) {
      await run("INSERT INTO eng_progress (user_id, item, score, at) VALUES (?, ?, ?, ?)", u.id, item, score, Date.now());
      await addXp(u.id, xp, "eng");
      return res.json({ xp, best: score });
    }
    if (score > had.score) await run("UPDATE eng_progress SET score = ?, at = ? WHERE user_id = ? AND item = ?", score, Date.now(), u.id, item);
    res.json({ xp: 0, best: Math.max(score, had.score) });
  }),
);

/** Words or a photo of a sketch → replicad code; the browser builds it and sends back an error for a fix. */
engRouter.post(
  "/cad-ai",
  wrap(async (req, res) => {
    requireUser(req);
    const b = req.body ?? {};
    const image =
      b.image && typeof b.image.data === "string" && /^image\/(jpeg|png|webp)$/.test(String(b.image.mime)) && b.image.data.length < 6_000_000 ? { mime: String(b.image.mime), data: String(b.image.data) } : undefined;
    const prompt = str(b.prompt, 1500);
    if (!prompt && !image) throw new HttpError(400, "Опиши деталь или приложи фото эскиза");
    const code = typeof b.code === "string" ? b.code : undefined;
    const error = str(b.error, 800) || undefined;
    // A fresh text request that someone already made is answered from cache in milliseconds.
    const key = !code && !error && !image ? `cad:${prompt.toLowerCase().replace(/\s+/g, " ").trim()}` : "";
    const hit = key ? await getCache(key) : null;
    if (hit) return res.json({ ...JSON.parse(hit), cached: true });
    // The school's own model: a typical part is recognised and built from a verified template in milliseconds.
    let guess: { label: string; p: number } | null = null;
    if (key && b.local !== false) {
      const t0 = performance.now();
      const g = predict(intentModel as IntentModel, prompt);
      guess = { label: g.label, p: Math.round(g.p * 1000) / 1000 };
      const made = g.p >= LOCAL_THRESHOLD ? INTENTS.find((i) => i.id === g.label)?.build?.(extractParams(prompt)) : null;
      if (made) return res.json({ ...made, mode: "local", model: { ...guess, ms: Math.round((performance.now() - t0) * 10) / 10 } });
    }
    try {
      const examples = error ? [] : await similarDesigns(prompt);
      const out = await cadDesign({ prompt, code, error, image, examples });
      if (key && out.mode === "ai") await setCache(key, JSON.stringify(out));
      // `guess`: what the school model thought when it was not sure enough to answer itself
      res.json({ ...out, examples: examples.length, guess });
    } catch (e) {
      if (e instanceof AiRefusal) throw new HttpError(422, "ИИ не смог сделать эту деталь");
      throw e;
    }
  }),
);

engRouter.post(
  "/arduino-help",
  wrap(async (req, res) => {
    requireUser(req);
    const b = req.body ?? {};
    res.json(await arduinoHelp({ lesson: str(b.lesson, 100), task: str(b.task, 600), code: String(b.code ?? "").slice(0, 8000), status: str(b.status, 800), question: str(b.question, 600) }));
  }),
);

/** The browser reports how the generated part built: verified pairs feed the school's design library. */
engRouter.post(
  "/cad-library",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const b = req.body ?? {};
    const bbox = Array.isArray(b.bbox) ? b.bbox.slice(0, 3).map((x: unknown) => num(x, 0)) : [];
    if (bbox.length !== 3) throw new HttpError(400, "Нет габаритов");
    await saveDesign(u.id, str(b.prompt, 1500), String(b.code ?? ""), bbox, num(b.volume, 0), !!b.verified);
    res.json({ ok: true });
  }),
);

/** Teachers download the verified designs as a fine-tuning dataset (JSONL, chat format). */
engRouter.get(
  "/cad-dataset.jsonl",
  wrap(async (req, res) => {
    requireTeacher(req);
    res.type("application/jsonl; charset=utf-8").setHeader("Content-Disposition", 'attachment; filename="bsts-cad-dataset.jsonl"');
    res.send(await datasetJsonl());
  }),
);

engRouter.get(
  "/cad-library/stats",
  wrap(async (req, res) => {
    requireUser(req);
    res.json((await one<{ total: number; verified: number }>("SELECT COUNT(*) total, SUM(verified) verified FROM cad_designs")) ?? { total: 0, verified: 0 });
  }),
);
