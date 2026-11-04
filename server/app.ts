import "dotenv/config";
import { learningRouter } from "./routes/learning";
import express, { type NextFunction, type Request, type Response } from "express";
import { attachUser } from "./auth";
import { aiContext } from "./quota";
import { billingRouter } from "./routes/billing";
import { pathRouter } from "./routes/path";
import { admissionsRouter } from "./routes/admissions";
import { HttpError } from "./http";
import { aiMode } from "./ai";
import { ready, storage } from "./db";
import { seedDemo } from "./seed";
import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { satRouter } from "./routes/sat";
import { ieltsRouter } from "./routes/ielts";
import { codingRouter } from "./routes/coding";
import { libraryRouter } from "./routes/library";
import { entRouter } from "./routes/ent";
import { reviewRouter } from "./routes/review";
import { duelsRouter } from "./routes/duels";
import { cronRouter, familyRouter, telegramRouter } from "./routes/family";
import { engRouter } from "./routes/eng";
import { entMasterRouter } from "./routes/entMaster";
import { sharedRouter } from "./routes/coding";

// The API without listen(): server/index.ts runs it locally, api/index.mjs on Vercel.

// Schema and demo data are created once per process; requests wait for them.
const boot = ready.then(seedDemo);

export const app = express();
app.use((_req, _res, next) => {
  boot.then(() => next(), next);
});
// A photo of a CAD sketch travels as base64 JSON; it is compressed in the browser first.
app.use("/api/eng/cad-ai", express.json({ limit: "6mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(attachUser);
app.use(aiContext);

app.get("/api/health", (_req, res) => res.json({ ok: true, ai: aiMode, storage }));
app.use("/api/auth", authRouter);
app.use("/api/learning", learningRouter);
app.use("/api/me", meRouter);
app.use("/api/billing", billingRouter);
app.use("/api/path", pathRouter);
app.use("/api/admissions", admissionsRouter);
app.use("/api/sat", satRouter);
app.use("/api/ielts", ieltsRouter);
app.use("/api/coding", codingRouter);
app.use("/api/library", libraryRouter);
app.use("/api/ent/master", entMasterRouter);
app.use("/api/ent", entRouter);
app.use("/api/review", reviewRouter);
app.use("/api/duels", duelsRouter);
app.use("/api/family", familyRouter);
app.use("/api/cron", cronRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/eng", engRouter);
app.use("/api/shared", sharedRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "Такого адреса API нет" }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Что-то пошло не так на сервере. Попробуйте ещё раз" });
});

export default app;
