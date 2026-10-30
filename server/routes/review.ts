import { Router } from "express";
import type { EntQuestion } from "../../shared/ent";
import { requireStudent } from "../auth";
import { all } from "../db";
import { wrap } from "../http";
import { reviewSummary } from "../review";

export const reviewRouter = Router();

reviewRouter.get(
  "/",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const s = await reviewSummary(u.id);
    const ids = s.due.ent.slice(0, 20);
    const rows = ids.length ? await all<{ data: string }>(`SELECT data FROM ent_questions WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids) : [];
    const ent = rows.map((r) => {
      const { answer: _a, explanation: _e, ...q } = JSON.parse(r.data) as EntQuestion;
      return q;
    });
    res.json({ ...s, entItems: ent });
  }),
);
