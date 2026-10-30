import crypto from "node:crypto";
import { Router, type Request } from "express";
import { requireStudent, requireUser } from "../auth";
import { all, id, one, run } from "../db";
import { HttpError, must, str, wrap } from "../http";
import { channels, deliver, snapshot, weeklyReport } from "../family";
import { handleUpdate, setupBot } from "../bot";

// Parent access: a student creates a private link for a parent (no account needed).
// The parent sees the child's progress and gets a report every Friday by email or Telegram.

export const familyRouter = Router();

interface LinkRow {
  id: string;
  student_id: string;
  token: string;
  parent_name: string;
  email: string;
  telegram_chat_id: string | null;
  revoked: number;
  last_sent_at: number | null;
  created_at: number;
}

/** The site address as the browser sees it (the dev proxy changes Host, so Origin/Referer come first). */
function origin(req: Request) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  const from = req.get("origin") || req.get("referer");
  if (from) {
    try {
      return new URL(from).origin;
    } catch {
      // fall back to Host
    }
  }
  return `${req.get("x-forwarded-proto") ?? req.protocol}://${req.get("x-forwarded-host") ?? req.get("host")}`;
}

const linkInfo = (l: LinkRow, req: Request) => ({
  id: l.id,
  parentName: l.parent_name,
  email: l.email,
  telegram: !!l.telegram_chat_id,
  url: `${origin(req)}/parent/${l.token}`,
  telegramUrl: channels().telegramBot ? `https://t.me/${channels().telegramBot}?start=${l.token}` : null,
  lastSentAt: l.last_sent_at,
  createdAt: l.created_at,
});

familyRouter.get(
  "/",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const links = await all<LinkRow>("SELECT * FROM parent_links WHERE student_id = ? AND revoked = 0 ORDER BY created_at", u.id);
    res.json({ links: links.map((l) => linkInfo(l, req)), channels: channels() });
  }),
);

familyRouter.post(
  "/",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    const name = str(req.body?.parentName, 80);
    if (!name) throw new HttpError(400, "Как зовут родителя?");
    const email = str(req.body?.email, 120);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Проверь адрес почты");
    const count = await one<{ n: number }>("SELECT COUNT(*) n FROM parent_links WHERE student_id = ? AND revoked = 0", u.id);
    if ((count?.n ?? 0) >= 4) throw new HttpError(400, "Можно добавить до 4 родителей");
    const lid = id();
    await run("INSERT INTO parent_links (id, student_id, token, parent_name, email, created_at) VALUES (?, ?, ?, ?, ?, ?)", lid, u.id, crypto.randomBytes(18).toString("base64url"), name, email, Date.now());
    res.json(linkInfo((await one<LinkRow>("SELECT * FROM parent_links WHERE id = ?", lid))!, req));
  }),
);

familyRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const u = requireStudent(req);
    await run("UPDATE parent_links SET revoked = 1 WHERE id = ? AND student_id = ?", String(req.params.id), u.id);
    res.json({ ok: true });
  }),
);

// ---------- the parent's page: by token, without an account ----------

async function byToken(token: string) {
  return must(await one<LinkRow>("SELECT * FROM parent_links WHERE token = ? AND revoked = 0", token.slice(0, 64)), 404, "Ссылка недействительна. Попросите ребёнка создать новую в разделе «Для родителей»");
}

familyRouter.get(
  "/view/:token",
  wrap(async (req, res) => {
    const l = await byToken(String(req.params.token));
    const reports = await all<{ week_start: number; summary: string; created_at: number }>(
      "SELECT week_start, summary, created_at FROM parent_reports WHERE student_id = ? ORDER BY week_start DESC LIMIT 8",
      l.student_id,
    );
    res.json({
      parentName: l.parent_name,
      data: await snapshot(l.student_id),
      reports,
      notes: await all(
        "SELECT n.text, n.sent_at sentAt, u.first_name, u.last_name, u.title FROM parent_notes n JOIN users u ON u.id = n.teacher_id WHERE n.student_id = ? AND n.status = 'sent' ORDER BY n.sent_at DESC LIMIT 10",
        l.student_id,
      ),
      telegram: !!l.telegram_chat_id,
      telegramUrl: channels().telegramBot ? `https://t.me/${channels().telegramBot}?start=${l.token}` : null,
    });
  }),
);

familyRouter.post(
  "/view/:token/report",
  wrap(async (req, res) => {
    const l = await byToken(String(req.params.token));
    res.json(await weeklyReport(l.student_id));
  }),
);

// ---------- a student's or teacher's own assistant chat ----------

familyRouter.get(
  "/assistant",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const chat = await one("SELECT 1 FROM tg_chats WHERE user_id = ?", u.id);
    res.json({ connected: !!chat, bot: channels().telegramBot });
  }),
);

familyRouter.post(
  "/assistant",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const bot = must(channels().telegramBot, 400, "Telegram-бот ещё не подключён школой");
    const code = crypto.randomBytes(12).toString("base64url");
    await run("DELETE FROM tg_codes WHERE user_id = ? OR expires_at < ?", u.id, Date.now());
    await run("INSERT INTO tg_codes (code, user_id, expires_at) VALUES (?, ?, ?)", code, u.id, Date.now() + 30 * 60_000);
    res.json({ url: `https://t.me/${bot}?start=s_${code}` });
  }),
);

familyRouter.delete(
  "/assistant",
  wrap(async (req, res) => {
    const u = requireUser(req);
    const chats = await all<{ chat_id: string }>("SELECT chat_id FROM tg_chats WHERE user_id = ?", u.id);
    for (const c of chats) await run("DELETE FROM tg_messages WHERE chat_id = ?", c.chat_id);
    await run("DELETE FROM tg_chats WHERE user_id = ?", u.id);
    res.json({ ok: true });
  }),
);

// ---------- Friday cron (Vercel Cron) and Telegram bot ----------

function cronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.header("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Нет доступа");
}

export const cronRouter = Router();

cronRouter.get(
  "/weekly",
  wrap(async (req, res) => {
    cronAuth(req);
    const links = await all<LinkRow>("SELECT * FROM parent_links WHERE revoked = 0 AND (email <> '' OR telegram_chat_id IS NOT NULL)");
    const done: { student: string; sent: string[] }[] = [];
    const started = Date.now();
    for (const l of links) {
      if (l.last_sent_at && Date.now() - l.last_sent_at < 5 * 86_400_000) continue;
      if (Date.now() - started > 240_000) break; // the rest goes on the next run
      try {
        const r = await weeklyReport(l.student_id);
        const sent = await deliver(l, r, origin(req));
        if (sent.length) await run("UPDATE parent_links SET last_sent_at = ? WHERE id = ?", Date.now(), l.id);
        done.push({ student: l.student_id, sent });
      } catch (err) {
        console.error("weekly report", l.id, err);
      }
    }
    res.json({ links: links.length, processed: done.length, sent: done.filter((d) => d.sent.length).length });
  }),
);

/** Registers the Telegram webhook once the bot token is configured. */
cronRouter.post(
  "/telegram-setup",
  wrap(async (req, res) => {
    cronAuth(req);
    const token = must(process.env.TELEGRAM_BOT_TOKEN, 400, "Нет TELEGRAM_BOT_TOKEN");
    const hook = `${origin(req)}/api/telegram/webhook/${process.env.CRON_SECRET}`;
    const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: hook, allowed_updates: ["message", "callback_query"], max_connections: 20 }),
    });
    await setupBot();
    const info = (await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json()) as { result?: { allowed_updates?: string[]; pending_update_count?: number; last_error_message?: string } };
    res.json({ ...((await r.json()) as object), allowedUpdates: info.result?.allowed_updates ?? null, pending: info.result?.pending_update_count, lastError: info.result?.last_error_message ?? null });
  }),
);

export const telegramRouter = Router();

telegramRouter.post(
  "/webhook/:secret",
  wrap(async (req, res) => {
    if (!process.env.CRON_SECRET || req.params.secret !== process.env.CRON_SECRET) throw new HttpError(401, "Нет доступа");
    try {
      await handleUpdate(req.body ?? {});
    } catch (err) {
      console.error("telegram update", err);
    }
    res.json({ ok: true });
  }),
);
