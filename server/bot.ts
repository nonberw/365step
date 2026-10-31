import { botReply, type BotTurn } from "./ai";
import { all, one, run } from "./db";
import { channels, reportText, snapshot, weeklyReport, type Snapshot } from "./family";
import { teacherReply } from "./teacherBot";

// Telegram study assistant. Students and teachers link their own chat from the site, parents through their parent link.
// It answers only study questions, using platform data, and keeps a short dialogue memory.
// Teachers get the extended assistant (web research, platform tools, messages to parents after their confirmation).

const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const DAY = 86_400_000;
const DAILY_LIMIT = 60;
const TEACHER_LIMIT = 150;
const RESEARCH_LIMIT = 15;
const HISTORY = 12;
const site = () => process.env.PUBLIC_URL || "https://rostok.vercel.app";

interface TgCallback {
  id: string;
  data?: string;
  message?: { message_id: number; chat: { id: number } };
}

interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  photo?: { file_id: string; file_size?: number; width: number }[];
  document?: { file_id: string; mime_type?: string; file_size?: number };
}

async function tg(method: string, body: object) {
  const res = await fetch(`${API()}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return res?.ok ? ((await res.json()) as { result: unknown }).result : null;
}

/** Telegram allows 4096 characters per message. */
async function say(chat: string, text: string, extra: object = {}) {
  for (let i = 0; i < text.length; i += 4000) await tg("sendMessage", { chat_id: chat, text: text.slice(i, i + 4000), disable_web_page_preview: true, ...(i + 4000 >= text.length ? extra : {}) });
}

const HELP = `Я ИИ-помощник школы BSTS. Отвечаю только на вопросы об учёбе: предметы, ЕНТ, SAT, IELTS, программирование, поступление.

Что умею:
— объяснить тему или разобрать задачу (можно прислать фото)
— подсказать, что подтянуть, по твоим данным на платформе
— родителям: рассказать, как идут дела у ребёнка, и прислать отчёт за неделю

Команды:
/report — отчёт за неделю (для родителей)
/new — начать разговор заново
/stop — отключить этот чат

Я ИИ и могу ошибаться: важное сверяй с учителем.`;

const HELP_TEACHER = `Я ИИ-ассистент учителя BSTS. Помогаю с уроками и работой с классом.

Что умею:
— план урока, цели, дескрипторы, СОр/СОч, задания разного уровня, рабочие листы
— искать в интернете и делать глубокое исследование: /research тема
— смотреть результаты класса и отдельных учеников
— задавать задания классу (ЕНТ, SAT, IELTS)
— показывать ваши консультации и кто записался
— готовить сообщение родителям: например, «Асылбек плохо справляется с заданиями, напиши родителям». Я покажу черновик, а отправлю только после вашей кнопки «Отправить»

Команды:
/research тема — глубокое исследование с источниками
/new — начать разговор заново
/stop — отключить этот чат

Я ИИ и могу ошибаться: проверяйте важное.`;

/** What the model may see: no surnames, emails or teacher names. */
function forAi(s: Snapshot) {
  return { ...s, child: { firstName: s.child.firstName, grade: s.child.grade }, consultations: s.consultations.map(({ teacher: _t, ...c }) => c) };
}

type Who = { kind: "student" | "teacher"; userId: string } | { kind: "parent"; students: string[] } | null;

async function whoIs(chat: string): Promise<Who> {
  const u = await one<{ user_id: string; role: string }>("SELECT c.user_id, u.role FROM tg_chats c JOIN users u ON u.id = c.user_id WHERE c.chat_id = ?", chat);
  if (u) return { kind: u.role === "teacher" ? "teacher" : "student", userId: u.user_id };
  const links = await all<{ student_id: string }>("SELECT DISTINCT student_id FROM parent_links WHERE telegram_chat_id = ? AND revoked = 0", chat);
  return links.length ? { kind: "parent", students: links.map((l) => l.student_id) } : null;
}

async function start(chat: string, arg: string) {
  if (arg.startsWith("s_")) {
    const c = await one<{ user_id: string; expires_at: number }>("SELECT user_id, expires_at FROM tg_codes WHERE code = ?", arg.slice(2, 40));
    if (!c || c.expires_at < Date.now()) return say(chat, "Ссылка устарела. Откройте на сайте карточку «ИИ-помощник в Telegram» и нажмите кнопку ещё раз.");
    await run("DELETE FROM tg_codes WHERE code = ?", arg.slice(2, 40));
    await run("DELETE FROM tg_chats WHERE user_id = ?", c.user_id);
    await run("INSERT INTO tg_chats (chat_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET user_id = excluded.user_id", chat, c.user_id, Date.now());
    const u = await one<{ first_name: string; role: string }>("SELECT first_name, role FROM users WHERE id = ?", c.user_id);
    if (u?.role === "teacher") return say(chat, `Здравствуйте, ${u.first_name}! Я подключён к вашему аккаунту учителя Росток.\n\n${HELP_TEACHER}`);
    return say(chat, `Привет, ${u?.first_name ?? ""}! Я подключён к твоему аккаунту Росток и вижу твои результаты.\n\n${HELP}`);
  }
  if (arg) {
    const l = await one<{ id: string; student_id: string }>("SELECT id, student_id FROM parent_links WHERE token = ? AND revoked = 0", arg.slice(0, 64));
    if (l) {
      await run("UPDATE parent_links SET telegram_chat_id = ? WHERE id = ?", chat, l.id);
      const s = await one<{ first_name: string }>("SELECT first_name FROM users WHERE id = ?", l.student_id);
      return say(chat, `Готово! По пятницам сюда будет приходить отчёт об учёбе: ${s?.first_name ?? "ребёнок"} в Росток. А ещё можно спрашивать меня об успехах ребёнка и о подготовке к экзаменам.\n\n${HELP}`);
    }
  }
  return say(
    chat,
    "Чтобы я знал, с кем говорю, откройте меня по кнопке с сайта Росток:\n— ученик: раздел «Для родителей» → «Мой ИИ-помощник в Telegram»\n— учитель: главная страница учителя → «ИИ-ассистент в Telegram»\n— родитель: страница по ссылке от ребёнка → «Получать в Telegram»",
  );
}

/** Biggest photo (or an image sent as a file), up to 5 MB, as base64. */
async function image(m: TgMessage) {
  const file = m.photo?.length ? m.photo.at(-1) : m.document?.mime_type?.startsWith("image/") ? m.document : null;
  if (!file || (file.file_size ?? 0) > 5 * 1024 * 1024) return null;
  const info = (await tg("getFile", { file_id: file.file_id })) as { file_path?: string } | null;
  if (!info?.file_path) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${info.file_path}`).catch(() => null);
  if (!res?.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = buf[0] === 0x89 ? "image/png" : buf[0] === 0x52 ? "image/webp" : "image/jpeg";
  return { mime, data: buf.toString("base64") };
}

export async function handleUpdate(update: { update_id?: number; message?: TgMessage; callback_query?: TgCallback }) {
  // Telegram retries a webhook that answers slowly: answer each update once.
  if (update.update_id !== undefined) {
    const fresh = await run("INSERT OR IGNORE INTO tg_updates (update_id, at) VALUES (?, ?)", update.update_id, Date.now());
    if (!fresh.changes) return;
    if (update.update_id % 50 === 0) await run("DELETE FROM tg_updates WHERE at < ?", Date.now() - 7 * DAY);
  }
  if (update.callback_query) return button(update.callback_query);
  const m = update.message;
  if (!m || m.chat.type !== "private") return;
  const chat = String(m.chat.id);
  const text = (m.text ?? m.caption ?? "").trim();

  if (text.startsWith("/start")) return start(chat, text.split(/\s+/)[1] ?? "");
  const who = await whoIs(chat);
  if (text === "/help") return say(chat, who?.kind === "teacher" ? HELP_TEACHER : HELP);
  if (!who) return start(chat, "");

  if (text === "/new") {
    await run("DELETE FROM tg_messages WHERE chat_id = ?", chat);
    return say(chat, "Начинаем заново. О чём поговорим?");
  }
  if (text === "/stop") {
    await run("DELETE FROM tg_chats WHERE chat_id = ?", chat);
    await run("UPDATE parent_links SET telegram_chat_id = NULL WHERE telegram_chat_id = ?", chat);
    await run("DELETE FROM tg_messages WHERE chat_id = ?", chat);
    return say(chat, "Чат отключён, история удалена. Подключиться снова можно с сайта.");
  }
  if (text === "/report") {
    if (who.kind !== "parent") return say(chat, "Отчёт за неделю приходит родителям. Свои результаты смотри на сайте или спроси меня, что подтянуть.");
    const links = await all<{ student_id: string; token: string }>("SELECT student_id, token FROM parent_links WHERE telegram_chat_id = ? AND revoked = 0", chat);
    for (const l of links) await say(chat, reportText(await weeklyReport(l.student_id), `${site()}/parent/${l.token}`));
    return;
  }

  const used = (await one<{ n: number }>("SELECT COUNT(*) n FROM tg_messages WHERE chat_id = ? AND role = 'user' AND at > ?", chat, Date.now() - DAY))?.n ?? 0;
  if (used >= (who.kind === "teacher" ? TEACHER_LIMIT : DAILY_LIMIT)) return say(chat, "На сегодня лимит вопросов исчерпан. Продолжим завтра.");
  if (who.kind === "teacher") return teacherTurn(chat, who.userId, m, text);

  const img = m.photo || m.document ? await image(m) : null;
  if ((m.photo || m.document) && !img) return say(chat, "Не смог открыть фото. Пришли его как обычное фото (не файлом больше 5 МБ).");
  if (!text && !img) return say(chat, "Я понимаю текст и фото. Напиши вопрос по учёбе.");

  await tg("sendChatAction", { chat_id: chat, action: "typing" });
  const context = who.kind === "parent" ? { children: await Promise.all(who.students.map(async (s) => forAi(await snapshot(s)))) } : { student: forAi(await snapshot(who.userId)) };

  let answer: string;
  try {
    answer = await botReply({ who: who.kind === "parent" ? "parent" : "student", context, history: await history(chat), text, images: img ? [img] : [] });
  } catch (err) {
    console.error("bot reply", err);
    return say(chat, "Что-то пошло не так, попробуй ещё раз через минуту.");
  }
  await remember(chat, (img ? "[фото] " : "") + text, answer);
  await say(chat, answer);
}

async function history(chat: string) {
  const h = (await all<BotTurn>("SELECT role, text FROM tg_messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?", chat, HISTORY)).reverse();
  while (h.length && h[0].role !== "user") h.shift();
  return h;
}

async function remember(chat: string, question: string, answer: string) {
  const now = Date.now();
  await run("INSERT INTO tg_messages (chat_id, role, text, at) VALUES (?, 'user', ?, ?)", chat, question.slice(0, 3000), now);
  await run("INSERT INTO tg_messages (chat_id, role, text, at) VALUES (?, 'assistant', ?, ?)", chat, answer.slice(0, 6000), now + 1);
}

async function teacherTurn(chat: string, teacherId: string, m: TgMessage, text: string) {
  const research = /^\/research\b/.test(text);
  const question = research ? text.replace(/^\/research\S*\s*/, "") : text;
  if (research) {
    if (!question) return say(chat, "Напишите тему после команды, например: /research как готовить 11 класс к ЕНТ по математике за 3 месяца");
    const n = (await one<{ n: number }>("SELECT COUNT(*) n FROM tg_messages WHERE chat_id = ? AND role = 'user' AND text LIKE '/research%' AND at > ?", chat, Date.now() - DAY))?.n ?? 0;
    if (n >= RESEARCH_LIMIT) return say(chat, "Лимит глубоких исследований на сегодня исчерпан. Обычный поиск по-прежнему работает.");
    await say(chat, "Начинаю исследование: ищу и читаю источники. Это займёт 1–4 минуты.");
  }
  const img = m.photo || m.document ? await image(m) : null;
  if ((m.photo || m.document) && !img) return say(chat, "Не смог открыть фото. Пришлите его как обычное фото (до 5 МБ).");
  if (!question && !img) return say(chat, "Напишите, чем помочь: урок, класс, ученик или поиск.");

  // Long answers: keep the "typing…" status alive while the assistant works.
  await tg("sendChatAction", { chat_id: chat, action: "typing" });
  const typing = setInterval(() => void tg("sendChatAction", { chat_id: chat, action: "typing" }), 4500);
  let out: { text: string; drafts: string[] };
  try {
    out = await teacherReply({ teacherId, history: await history(chat), text: question, images: img ? [img] : [], research });
  } catch (err) {
    console.error("teacher bot", err);
    return say(chat, "Что-то пошло не так, попробуйте ещё раз через минуту.");
  } finally {
    clearInterval(typing);
  }
  await remember(chat, (research ? "/research " : "") + (img ? "[фото] " : "") + question, out.text);
  await say(chat, out.text);
  for (const nid of out.drafts) await showDraft(chat, nid);
}

/** A draft to parents with the buttons that are the teacher's consent. */
async function showDraft(chat: string, noteId: string) {
  const n = await one<{ text: string; student_id: string }>("SELECT text, student_id FROM parent_notes WHERE id = ?", noteId);
  if (!n) return;
  const s = await one<{ first_name: string; last_name: string }>("SELECT first_name, last_name FROM users WHERE id = ?", n.student_id);
  const links = await all<{ telegram_chat_id: string | null; email: string }>("SELECT telegram_chat_id, email FROM parent_links WHERE student_id = ? AND revoked = 0", n.student_id);
  const reach = links.filter((l) => l.telegram_chat_id || (l.email && channels().email)).length;
  const where = reach
    ? `Получат: ${reach} ${reach === 1 ? "родитель" : "родителя"} (Telegram или почта) и страница родителя.`
    : "У родителей пока нет подключённого Telegram или почты: после «Отправить» сообщение появится на их странице, а текст можно переслать самим.";
  await say(chat, `Черновик для родителей: ${s?.first_name ?? ""} ${s?.last_name ?? ""}\n\n${n.text}\n\n${where}`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Отправить", callback_data: `pn:send:${noteId}` },
          { text: "Отмена", callback_data: `pn:cancel:${noteId}` },
        ],
      ],
    },
  });
}

async function button(q: TgCallback) {
  const [ns, action, noteId] = String(q.data ?? "").split(":");
  const chat = q.message ? String(q.message.chat.id) : "";
  const who = chat ? await whoIs(chat) : null;
  if (ns !== "pn" || !who || who.kind !== "teacher") return tg("answerCallbackQuery", { callback_query_id: q.id, text: "Кнопка устарела" });
  const n = await one<{ id: string; teacher_id: string; student_id: string; text: string; status: string }>("SELECT * FROM parent_notes WHERE id = ? AND teacher_id = ?", noteId, who.userId);
  if (!n || n.status !== "draft") return tg("answerCallbackQuery", { callback_query_id: q.id, text: n ? "Уже обработано" : "Черновик не найден" });
  // Mark first so a double tap cannot send twice.
  const claimed = await run("UPDATE parent_notes SET status = ? WHERE id = ? AND status = 'draft'", action === "send" ? "sending" : "cancelled", n.id);
  if (!claimed.changes) return tg("answerCallbackQuery", { callback_query_id: q.id, text: "Уже обработано" });
  await tg("editMessageReplyMarkup", { chat_id: chat, message_id: q.message!.message_id, reply_markup: { inline_keyboard: [] } });
  if (action !== "send") {
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Отменено" });
    return say(chat, "Черновик отменён, родителям ничего не ушло.");
  }
  const sent = await sendNote(n);
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Отправлено" });
  return say(
    chat,
    sent.length
      ? `Отправлено родителям: ${sent.join(", ")}. Сообщение также видно на их странице.`
      : "Сообщение сохранено на странице родителей. Telegram и почта у них не подключены — перешлите текст сами, если нужно срочно.",
  );
}

async function sendNote(n: { id: string; teacher_id: string; student_id: string; text: string }) {
  const t = await one<{ first_name: string; last_name: string; title: string | null }>("SELECT first_name, last_name, title FROM users WHERE id = ?", n.teacher_id);
  const s = await one<{ first_name: string }>("SELECT first_name FROM users WHERE id = ?", n.student_id);
  const teacher = t ? (t.title ? `${{ mr: "Mr", ms: "Ms", mrs: "Mrs" }[t.title] ?? ""} ${t.last_name}`.trim() : `${t.first_name} ${t.last_name}`) : "учитель";
  const text = `Сообщение от учителя (${teacher}, BSTS) об учёбе: ${s?.first_name ?? "ребёнок"}\n\n${n.text}`;
  const links = await all<{ telegram_chat_id: string | null; email: string; token: string }>("SELECT telegram_chat_id, email, token FROM parent_links WHERE student_id = ? AND revoked = 0", n.student_id);
  const sent = new Set<string>();
  for (const l of links) {
    if (l.telegram_chat_id && (await tg("sendMessage", { chat_id: l.telegram_chat_id, text }))) sent.add("Telegram");
    if (l.email && channels().email) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: process.env.REPORT_FROM, to: l.email, subject: `Сообщение от учителя: ${s?.first_name ?? ""}`, text: `${text}\n\n${site()}/parent/${l.token}` }),
      }).catch(() => null);
      if (res?.ok) sent.add("почта");
    }
  }
  await run("UPDATE parent_notes SET status = 'sent', channels = ?, sent_at = ? WHERE id = ?", [...sent].join(","), Date.now(), n.id);
  return [...sent];
}

/** Menu and description shown in Telegram; called from /api/cron/telegram-setup. */
export async function setupBot() {
  await tg("setMyCommands", {
    commands: [
      { command: "help", description: "Что умеет помощник" },
      { command: "report", description: "Отчёт за неделю (для родителей)" },
      { command: "research", description: "Глубокое исследование (для учителей)" },
      { command: "new", description: "Начать разговор заново" },
      { command: "stop", description: "Отключить чат" },
    ],
  });
  await tg("setMyShortDescription", { short_description: "ИИ-помощник школы BSTS: учёба, ЕНТ, SAT, IELTS и отчёты родителям." });
  await tg("setMyDescription", {
    description:
      "ИИ-помощник учебной платформы Росток. Ученикам объясняет темы и задачи (можно по фото) и помогает готовиться к ЕНТ, SAT и IELTS. Учителям помогает с уроками, ищет и исследует в интернете, работает с классом на платформе. Родителям честно рассказывает об успехах ребёнка. Только учёба. Подключение — с сайта Росток.",
  });
}
