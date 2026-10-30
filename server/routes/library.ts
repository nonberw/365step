import express, { Router } from "express";
import type { BookMeta, BookNote } from "../../shared/types";
import { BOOK_BY_ID, BUILTIN_BOOKS, type Book } from "../../shared/textbooks";
import { requireTeacher, requireUser, type UserRow } from "../auth";
import { all, getCache, id, one, run, setCache } from "../db";
import { HttpError, must, num, str, wrap } from "../http";
import { bookStudy, HttpErrorLike, type BookAction } from "../ai";
import { MAX_UPLOAD, detect, extract, fileName, read, remove, save } from "../materials";

// School library: original built-in books plus textbooks teachers upload
// (only books the school has the rights to). Any page can be studied with AI.

export const libraryRouter = Router();

interface BookRow {
  id: string;
  owner_id: string;
  title: string;
  subject: string;
  grade: number | null;
  language: "ru" | "kk" | "en";
  author: string;
  description: string;
  kind: "pdf" | "docx" | "text" | "image";
  mime: string;
  file: string;
  size: number;
  pages: string;
  created_at: number;
}

const ACTIONS: BookAction[] = ["explain", "summary", "quiz", "cards", "ask", "interactive"];

async function progressOf(userId: string, bookId: string) {
  const p = await one<{ place: string; stamps: string }>("SELECT place, stamps FROM book_progress WHERE user_id = ? AND book_id = ?", userId, bookId);
  return p ? { place: p.place, stamps: (JSON.parse(p.stamps) as string[]).length } : null;
}

const builtinMeta = async (b: Book, userId: string): Promise<BookMeta> => ({
  id: b.id,
  title: b.title,
  subject: b.subject,
  grade: b.grade,
  language: b.language,
  author: b.author,
  description: b.description,
  source: "builtin",
  format: "chapters",
  places: b.chapters.length,
  interactive: b.chapters.filter((c) => c.explainer).length,
  ownerId: null,
  progress: await progressOf(userId, b.id),
});

const uploadMeta = async (b: BookRow, userId: string): Promise<BookMeta> => ({
  id: b.id,
  title: b.title,
  subject: b.subject,
  grade: b.grade,
  language: b.language,
  author: b.author,
  description: b.description,
  source: "upload",
  format: b.kind === "pdf" ? "pdf" : "text",
  places: (JSON.parse(b.pages) as string[]).length,
  interactive: 0,
  ownerId: b.owner_id,
  progress: await progressOf(userId, b.id),
});

/** Splits plain text into readable pages at paragraph boundaries. */
function paginate(text: string, size = 2800) {
  const pages: string[] = [];
  let cur = "";
  for (const para of text.split(/\n\s*\n/)) {
    if (cur && cur.length + para.length > size) {
      pages.push(cur.trim());
      cur = "";
    }
    cur += para + "\n\n";
  }
  if (cur.trim()) pages.push(cur.trim());
  return pages.length ? pages : [""];
}

async function findBook(bookId: string) {
  const builtin = BOOK_BY_ID[bookId] as Book | undefined;
  const upload = builtin ? undefined : await one<BookRow>("SELECT * FROM textbooks WHERE id = ?", bookId);
  if (!builtin && !upload) throw new HttpError(404, "Учебник не найден");
  return { builtin, upload };
}

/** Text of one place: a chapter id for built-in books, a 1-based page number for uploads. */
async function placeText(bookId: string, place: string) {
  const { builtin, upload } = await findBook(bookId);
  if (builtin) {
    const ch = must(
      builtin.chapters.find((c) => c.id === place),
      404,
      "Глава не найдена",
    );
    return { title: builtin.title, subject: builtin.subject, grade: builtin.grade, language: builtin.language, label: ch.title, text: ch.text };
  }
  const pages = JSON.parse(upload!.pages) as string[];
  const n = Math.round(num(place, 1));
  if (n < 1 || n > pages.length) throw new HttpError(404, "Страница не найдена");
  // Neighbouring pages help when a topic starts on the previous page.
  const text = [pages[n - 2] ? `[стр. ${n - 1}]\n${pages[n - 2].slice(-1500)}` : "", `[стр. ${n}]\n${pages[n - 1]}`, pages[n] ? `[стр. ${n + 1}]\n${pages[n].slice(0, 1500)}` : ""].filter(Boolean).join("\n\n");
  return { title: upload!.title, subject: upload!.subject, grade: upload!.grade, language: upload!.language, label: `страница ${n}`, text };
}

libraryRouter.get(
  "/",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const uploads = await all<BookRow>("SELECT * FROM textbooks ORDER BY created_at DESC");
    res.json(await Promise.all([...BUILTIN_BOOKS.map((b) => builtinMeta(b, u.id)), ...uploads.map((b) => uploadMeta(b, u.id))]));
  }),
);

libraryRouter.post(
  "/",
  express.raw({ type: () => true, limit: MAX_UPLOAD }),
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || !buf.length) throw new HttpError(400, "Файл пустой");
    const name = fileName(req);
    const { mime, kind } = detect(name, String(req.header("content-type") ?? ""));
    if (kind === "image") throw new HttpError(415, "Учебник загружается как PDF, DOCX или TXT");
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(decodeURIComponent(req.header("x-book-meta") ?? "{}"));
    } catch {
      // defaults below
    }
    let parsed: { text: string; pageTexts?: string[] };
    try {
      parsed = await extract(kind, buf);
    } catch {
      throw new HttpError(422, "Не получилось прочитать файл. Проверьте, что он не повреждён и не защищён паролем");
    }
    const pages = kind === "pdf" ? (parsed.pageTexts ?? []) : paginate(parsed.text);
    const bid = id();
    await save(bid, buf, mime);
    const grade = Math.round(num(meta.grade, 0));
    await run(
      "INSERT INTO textbooks (id, owner_id, title, subject, grade, language, author, description, kind, mime, file, size, pages, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      bid,
      t.id,
      str(meta.title, 160) || name.replace(/\.[a-z0-9]+$/i, ""),
      str(meta.subject, 60) || "Другое",
      grade >= 1 && grade <= 11 ? grade : null,
      ["ru", "kk", "en"].includes(String(meta.language)) ? String(meta.language) : "ru",
      str(meta.author, 160),
      str(meta.description, 600),
      kind,
      mime,
      bid,
      buf.length,
      JSON.stringify(pages),
      Date.now(),
    );
    res.json(await uploadMeta((await one<BookRow>("SELECT * FROM textbooks WHERE id = ?", bid))!, t.id));
  }),
);

libraryRouter.get(
  "/requests",
  wrap(async (req, res) => {
    requireTeacher(req);
    res.json(
      await all<{ id: string; title: string; subject: string; grade: number | null; comment: string; created_at: number; first_name: string; last_name: string }>(
        "SELECT r.*, u.first_name, u.last_name FROM book_requests r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 50",
      ),
    );
  }),
);

libraryRouter.post(
  "/requests",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const title = str(req.body?.title, 160);
    if (!title) throw new HttpError(400, "Напишите название учебника");
    const grade = Math.round(num(req.body?.grade, 0));
    await run(
      "INSERT INTO book_requests (id, user_id, title, subject, grade, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id(),
      u.id,
      title,
      str(req.body?.subject, 60),
      grade >= 1 && grade <= 11 ? grade : null,
      str(req.body?.comment, 600),
      Date.now(),
    );
    res.json({ ok: true });
  }),
);

libraryRouter.get(
  "/:id",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const { builtin, upload } = await findBook(String(req.params.id));
    const notes: BookNote[] = (
      await all<{ id: string; place: string; text: string; created_at: number }>("SELECT * FROM book_notes WHERE user_id = ? AND book_id = ? ORDER BY created_at DESC", u.id, String(req.params.id))
    ).map((n) => ({ id: n.id, place: n.place, text: n.text, createdAt: n.created_at }));
    const p = await one<{ place: string; stamps: string }>("SELECT place, stamps FROM book_progress WHERE user_id = ? AND book_id = ?", u.id, String(req.params.id));
    const progress = { place: p?.place ?? null, stamps: p ? (JSON.parse(p.stamps) as string[]) : [] };
    if (builtin) return res.json({ meta: await builtinMeta(builtin, u.id), chapters: builtin.chapters, pages: null, notes, progress });
    const pages = JSON.parse(upload!.pages) as string[];
    res.json({ meta: await uploadMeta(upload!, u.id), chapters: null, pages: upload!.kind === "pdf" ? null : pages, notes, progress });
  }),
);

libraryRouter.get(
  "/:id/file",
  wrap(async (req, res) => {
    requireUser(req);
    const b = must(await one<BookRow>("SELECT * FROM textbooks WHERE id = ?", String(req.params.id)), 404, "Учебник не найден");
    res.type(b.mime).send(must(await read(b.file), 404, "Файл не найден на сервере"));
  }),
);

libraryRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const t = requireTeacher(req);
    const b = must(await one<BookRow>("SELECT * FROM textbooks WHERE id = ? AND owner_id = ?", String(req.params.id), t.id), 404, "Удалять можно только свои учебники");
    await run("DELETE FROM textbooks WHERE id = ?", b.id);
    await run("DELETE FROM book_progress WHERE book_id = ?", b.id);
    await run("DELETE FROM book_notes WHERE book_id = ?", b.id);
    await remove(b.file);
    res.json({ ok: true });
  }),
);

libraryRouter.post(
  "/:id/progress",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const bookId = String(req.params.id);
    await findBook(bookId);
    const place = str(req.body?.place, 40);
    const prev = await one<{ stamps: string }>("SELECT stamps FROM book_progress WHERE user_id = ? AND book_id = ?", u.id, bookId);
    const stamps = new Set<string>(prev ? JSON.parse(prev.stamps) : []);
    if (req.body?.stamp) stamps.add(place);
    await run(
      "INSERT INTO book_progress (user_id, book_id, place, stamps, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, book_id) DO UPDATE SET place = excluded.place, stamps = excluded.stamps, updated_at = excluded.updated_at",
      u.id,
      bookId,
      place,
      JSON.stringify([...stamps]),
      Date.now(),
    );
    res.json({ stamps: [...stamps] });
  }),
);

libraryRouter.post(
  "/:id/notes",
  wrap(async (req, res) => {
    const u = requireUser(req);
    await findBook(String(req.params.id));
    const text = str(req.body?.text, 2000);
    if (!text) throw new HttpError(400, "Пустая заметка");
    const nid = id();
    await run("INSERT INTO book_notes (id, user_id, book_id, place, text, created_at) VALUES (?, ?, ?, ?, ?, ?)", nid, u.id, String(req.params.id), str(req.body?.place, 40), text, Date.now());
    res.json({ id: nid, place: str(req.body?.place, 40), text, createdAt: Date.now() } satisfies BookNote);
  }),
);

libraryRouter.delete(
  "/:id/notes/:noteId",
  wrap(async (req, res) => {
    const u = requireUser(req);
    await run("DELETE FROM book_notes WHERE id = ? AND user_id = ?", String(req.params.noteId), u.id);
    res.json({ ok: true });
  }),
);

// A student can run up to 40 AI requests an hour in the library (cached answers are free).
const usage = new Map<string, number[]>();
function limit(u: UserRow) {
  const now = Date.now();
  const recent = (usage.get(u.id) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= 40) throw new HttpError(429, "Слишком много запросов к ИИ за час. Сделай перерыв и вернись позже");
  recent.push(now);
  usage.set(u.id, recent);
}

libraryRouter.post(
  "/:id/ai",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const bookId = String(req.params.id);
    const action = req.body?.action as BookAction;
    if (!ACTIONS.includes(action)) throw new HttpError(400, "Неизвестное действие");
    const place = str(req.body?.place, 40);
    const question = str(req.body?.question, 1000);
    if (action === "ask" && !question) throw new HttpError(400, "Напиши вопрос");
    const fresh = !!req.body?.fresh;
    const key = `book:${bookId}:${place}:${action}`;
    if (action !== "ask" && !fresh) {
      const hit = await getCache(key);
      if (hit) return res.json(JSON.parse(hit));
    }
    const ctx = await placeText(bookId, place);
    if (!ctx.text.trim()) throw new HttpError(422, "На этой странице нет текста (возможно, это скан). ИИ пока не видит её содержимое");
    limit(u);
    try {
      const out = await bookStudy(action, { book: ctx.title, subject: ctx.subject, grade: ctx.grade, language: ctx.language, place: ctx.label, text: ctx.text }, question);
      if (action !== "ask" && out.mode === "ai") await setCache(key, JSON.stringify(out));
      res.json(out);
    } catch (e) {
      if (e instanceof HttpErrorLike) throw new HttpError(e.status, e.message);
      throw e;
    }
  }),
);
