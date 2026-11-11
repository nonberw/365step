import type { RequestHandler } from "express";
import { englishExamData } from "../shared/examEnglish";
/** Scope localization to SAT and IELTS responses; never rewrite student records. */
export const englishExamResponse: RequestHandler = (_req, res, next) => {
  const send = res.json.bind(res);
  res.json = (body: unknown) => send(englishExamData(body));
  next();
};
