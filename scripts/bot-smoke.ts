import "dotenv/config";
import { handleUpdate } from "../server/bot";
import { one, ready, run } from "../server/db";

// Local check of the Telegram assistant: Telegram calls are intercepted and printed, Claude is real.
// Run: npx tsx scripts/bot-smoke.ts

process.env.TELEGRAM_BOT_TOKEN = "test";
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  if (!u.startsWith("https://api.telegram.org/")) return realFetch(url, init);
  const method = u.split("/").pop();
  if (method === "sendMessage") console.log(`\n<< ${JSON.parse(String(init?.body)).text}\n`);
  return new Response(JSON.stringify({ ok: true, result: true }), { headers: { "content-type": "application/json" } });
}) as typeof fetch;

let updateId = Math.floor(Date.now() / 1000);
const send = async (chat: number, text: string, id = ++updateId) => {
  console.log(`>> [${chat}] ${text}`);
  const t = Date.now();
  await handleUpdate({ update_id: id, message: { message_id: id, chat: { id: chat, type: "private" }, text } });
  console.log(`   (${((Date.now() - t) / 1000).toFixed(1)} s)`);
};

await ready;
const student = (await one<{ id: string }>("SELECT id FROM users WHERE email = 'student@demo.nurbek.app'"))!.id;
const STUDENT_CHAT = 900000001;
const PARENT_CHAT = 900000002;

await send(STUDENT_CHAT, "привет");
await run("INSERT INTO tg_codes (code, user_id, expires_at) VALUES ('smoke', ?, ?)", student, Date.now() + 60_000);
await send(STUDENT_CHAT, "/start s_smoke");
await send(STUDENT_CHAT, "Объясни, как решать квадратные уравнения через дискриминант, коротко");
await send(STUDENT_CHAT, "А какой у меня сейчас лучший балл пробного ЕНТ и что подтянуть?");
await send(STUDENT_CHAT, "Посоветуй сериал на вечер");
const dup = ++updateId;
await send(STUDENT_CHAT, "/help", dup);
await send(STUDENT_CHAT, "/help (повтор того же update — ответа быть не должно)", dup);

await run("INSERT INTO parent_links (id, student_id, token, parent_name, created_at) VALUES ('smoke-link', ?, 'smoke-token', 'Мама', ?)", student, Date.now());
await send(PARENT_CHAT, "/start smoke-token");
await send(PARENT_CHAT, "Как у дочки дела с учёбой? Только честно");

// clean up
await run("DELETE FROM tg_messages WHERE chat_id IN (?, ?)", String(STUDENT_CHAT), String(PARENT_CHAT));
await run("DELETE FROM tg_chats WHERE chat_id = ?", String(STUDENT_CHAT));
await run("DELETE FROM tg_updates WHERE update_id > ?", updateId - 100);
await run("DELETE FROM parent_links WHERE id = 'smoke-link'");
console.log("cleaned up");
