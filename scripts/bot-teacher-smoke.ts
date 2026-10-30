import "dotenv/config";
import { handleUpdate } from "../server/bot";
import { all, one, ready, run } from "../server/db";

// Local check of the teacher's Telegram assistant: Telegram calls are intercepted and printed, Claude is real.
// Run: npx tsx scripts/bot-teacher-smoke.ts [--research]

process.env.TELEGRAM_BOT_TOKEN = "test";
const realFetch = globalThis.fetch;
let lastButtons: string[] = [];
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  if (!u.startsWith("https://api.telegram.org/")) return realFetch(url, init);
  const method = u.split("/").pop();
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (method === "sendMessage") {
    console.log(`\n<< [to ${body.chat_id}] ${body.text}\n`);
    const kb = body.reply_markup?.inline_keyboard?.[0];
    if (kb) lastButtons = kb.map((b: { callback_data: string }) => b.callback_data);
  }
  if (method === "answerCallbackQuery") console.log(`   [button toast] ${body.text}`);
  return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { headers: { "content-type": "application/json" } });
}) as typeof fetch;

let updateId = Math.floor(Date.now() / 1000);
const TEACHER_CHAT = 900000011;
const PARENT_CHAT = 900000012;
const send = async (text: string) => {
  console.log(`>> [teacher] ${text}`);
  const t = Date.now();
  await handleUpdate({ update_id: ++updateId, message: { message_id: updateId, chat: { id: TEACHER_CHAT, type: "private" }, text } });
  console.log(`   (${((Date.now() - t) / 1000).toFixed(1)} s)`);
};
const press = async (data: string) => {
  console.log(`>> [teacher presses] ${data}`);
  await handleUpdate({ update_id: ++updateId, callback_query: { id: "cb", data, message: { message_id: 1, chat: { id: TEACHER_CHAT } } } });
};

await ready;
const teacher = (await one<{ id: string }>("SELECT id FROM users WHERE email = 'teacher@demo.bsts.kz'"))!.id;
const arman = (await one<{ id: string }>("SELECT id FROM users WHERE email = 'arman@demo.bsts.kz'"))!.id;
await run("INSERT INTO tg_codes (code, user_id, expires_at) VALUES ('tsmoke', ?, ?)", teacher, Date.now() + 60_000);
await run("INSERT INTO parent_links (id, student_id, token, parent_name, telegram_chat_id, created_at) VALUES ('tsmoke-link', ?, 'tsmoke-token', 'Папа', ?, ?)", arman, String(PARENT_CHAT), Date.now());

try {
  await send("/start s_tsmoke");
  await send("Как дела у моего класса? Кто отстаёт?");
  await send("Арман плохо справляется с заданиями, напиши его родителям предупреждение");
  if (lastButtons[0]) await press(lastButtons[0]);
  if (lastButtons[0]) await press(lastButtons[0]); // a second tap must not send twice
  await send("Составь план урока на 40 минут по теме «Фотосинтез» для 7 класса с целями обучения и дескрипторами, коротко");
  await send("Посоветуй, какой фильм посмотреть");
  if (process.argv.includes("--research")) await send("/research эффективные методы подготовки к ЕНТ по математике в Казахстане");
  console.log("notes:", await all("SELECT status, channels FROM parent_notes WHERE teacher_id = ? AND student_id = ?", teacher, arman));
} finally {
  await run("DELETE FROM tg_messages WHERE chat_id = ?", String(TEACHER_CHAT));
  await run("DELETE FROM tg_chats WHERE chat_id = ?", String(TEACHER_CHAT));
  await run("DELETE FROM tg_codes WHERE code = 'tsmoke'");
  await run("DELETE FROM parent_links WHERE id = 'tsmoke-link'");
  await run("DELETE FROM parent_notes WHERE teacher_id = ? AND student_id = ?", teacher, arman);
  await run("DELETE FROM tg_updates WHERE update_id > ?", updateId - 100);
  console.log("cleaned up");
}
