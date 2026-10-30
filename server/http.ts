import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Handler = (req: Request, res: Response) => unknown;

/** Async-safe route handler: rejected promises go to the error middleware. */
export const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);

export const str = (v: unknown, max = 200) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
export const num = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

export function must<T>(value: T | undefined | null, status: number, message: string): T {
  if (value === undefined || value === null) throw new HttpError(status, message);
  return value;
}
