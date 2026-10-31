import { ENT_SUBJECT } from "../shared/ent";
import { agentReply, type AgentTool, type BotTurn } from "./ai";
import { all, id, one, run } from "./db";
import { snapshot } from "./family";
import { assignmentsFor } from "./progress";

// The teacher's assistant in Telegram: lesson help, web search and deep research,
// and platform tools (classes, students, assignments, consultations, messages to parents).
// Messages to parents are only drafted here; the teacher sends them with a button.

const DAY = 86_400_000;

const SYSTEM = `Ты — ИИ-ассистент учителя на учебной платформе 365step в Telegram. Учитель: {teacher}. Сегодня {today}.

Чем помогаешь:
— уроки: планы уроков по обновлённому содержанию образования РК, цели обучения, критериальное оценивание (ФО, СОр, СОч, дескрипторы), задания разного уровня, рабочие листы, тесты, идеи активностей, дифференциация;
— подготовка учеников к ЕНТ, SAT, IELTS, олимпиадам;
— поиск и исследование в интернете (web_search, web_fetch): методики, статьи, официальные документы МОН РК и НЦТ;
— работа с платформой 365step через инструменты: классы, ученики, их результаты, задания классу, консультации, сообщения родителям.

Правила:
— Только учёба, преподавание и работа школы. На посторонние темы вежливо откажи одной фразой.
— Честность: не выдумывай факты, данные учеников, документы и ссылки. Данные об учениках бери только из инструментов. Факты из интернета давай со ссылкой на источник. Если не нашёл или не уверен — скажи прямо.
— Перед действием, которое меняет платформу (задание классу), убедись, что учитель именно этого хочет; если просьба однозначная — делай и сообщи, что сделал.
— Сообщение родителю: сначала посмотри данные ученика (student_overview), потом вызови draft_parent_message с готовым текстом. Текст — от лица учителя, на «вы», уважительно и тактично: конкретные факты (что не сдано, какие результаты), без ярлыков и без оценки личности ребёнка, и что можно сделать дома. 4–7 предложений. Сообщение НЕ уходит, пока учитель не нажмёт кнопку «Отправить» под черновиком — так и скажи, не пиши, что отправил.
— Ученика ищи через find_students; если подходят несколько — уточни у учителя.
Формат: обычный текст для Telegram без Markdown (без **, #, таблиц), короткие абзацы, списки через «—». Ссылки — просто URL. Язык — язык учителя.`;

const RESEARCH = `\n\nРежим глубокого исследования: сделай несколько поисков с разных сторон, открой ключевые источники через web_fetch, сопоставь их. Ответ: краткий вывод, затем основные находки по пунктам, практические рекомендации для школы и список источников (URL). До 3500 знаков.`;

const obj = (properties: Record<string, object>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const S = { type: "string" };

const TOOLS: AgentTool[] = [
  { name: "list_classes", description: "Классы учителя: код, название, число учеников.", input_schema: obj({}) },
  { name: "find_students", description: "Найти учеников в классах учителя по имени или фамилии (часть слова тоже подходит).", input_schema: obj({ query: S }) },
  { name: "student_overview", description: "Результаты ученика за неделю: ЕНТ, SAT, IELTS, задания учителей, контрольные, активность по дням, подключены ли родители.", input_schema: obj({ student_id: S }) },
  { name: "class_overview", description: "Сводка по классу: по каждому ученику активность за 7 дней, выполненные задания, лучший пробный ЕНТ, последняя контрольная.", input_schema: obj({ class_code: S }) },
  {
    name: "create_assignment",
    description: `Задать задание классу. kind: ent-full (полный пробный ЕНТ, ref пустой), ent-subject (мини-пробник ЕНТ, ref — id предмета: ${Object.keys(ENT_SUBJECT).join(", ")}), sat-practice (ref — число вопросов SAT), sat-test (пробный SAT, ref пустой), ielts-writing, ielts-speaking (ref пустой). due_date — YYYY-MM-DD или пусто.`,
    input_schema: obj({ class_code: S, kind: { type: "string", enum: ["ent-full", "ent-subject", "sat-practice", "sat-test", "ielts-writing", "ielts-speaking"] }, title: S, ref: S, due_date: S }),
  },
  { name: "upcoming_consultations", description: "Ближайшие консультации и доп. уроки учителя на 14 дней: время, тема, кто записался.", input_schema: obj({}) },
  {
    name: "draft_parent_message",
    description: "Подготовить черновик сообщения родителям ученика. Учитель увидит его с кнопками «Отправить» и «Отмена»; без нажатия ничего не уходит.",
    input_schema: obj({ student_id: S, text: S }),
  },
];

const short = (u: { first_name: string; last_name: string }) => `${u.first_name} ${u.last_name.slice(0, 1)}.`;

async function ownStudent(teacherId: string, studentId: string) {
  const s = await one<{ first_name: string; last_name: string; class_code: string }>(
    "SELECT u.first_name, u.last_name, m.class_code FROM users u JOIN class_members m ON m.user_id = u.id JOIN classes c ON c.code = m.class_code WHERE u.id = ? AND c.teacher_id = ? LIMIT 1",
    studentId,
    teacherId,
  );
  if (!s) throw new Error("Этот ученик не в ваших классах");
  return s;
}

function tools(teacherId: string, drafts: string[]) {
  return async (name: string, a: Record<string, unknown>): Promise<unknown> => {
    switch (name) {
      case "list_classes":
        return all("SELECT c.code, c.name, (SELECT COUNT(*) FROM class_members m WHERE m.class_code = c.code) students FROM classes c WHERE c.teacher_id = ? ORDER BY c.created_at", teacherId);
      case "find_students": {
        const q = `%${String(a.query).trim().toLowerCase()}%`;
        const rows = await all<{ id: string; first_name: string; last_name: string; name: string }>(
          "SELECT u.id, u.first_name, u.last_name, c.name FROM users u JOIN class_members m ON m.user_id = u.id JOIN classes c ON c.code = m.class_code WHERE c.teacher_id = ? AND (LOWER(u.first_name) LIKE ? OR LOWER(u.last_name) LIKE ? OR LOWER(u.first_name || ' ' || u.last_name) LIKE ?) LIMIT 10",
          teacherId,
          q,
          q,
          q,
        );
        return rows.map((r) => ({ student_id: r.id, name: short(r), class: r.name }));
      }
      case "student_overview": {
        const s = await ownStudent(teacherId, String(a.student_id));
        const snap = await snapshot(String(a.student_id));
        const parents = await one<{ n: number; tg: number; mail: number }>(
          "SELECT COUNT(*) n, SUM(CASE WHEN telegram_chat_id IS NOT NULL THEN 1 ELSE 0 END) tg, SUM(CASE WHEN email <> '' THEN 1 ELSE 0 END) mail FROM parent_links WHERE student_id = ? AND revoked = 0",
          String(a.student_id),
        );
        return {
          name: short(s),
          ...snap,
          child: undefined,
          activity: undefined,
          xpByDayThisWeekMonToSun: snap.activity,
          consultations: snap.consultations.map(({ teacher: _t, ...c }) => c),
          parents: { links: parents?.n ?? 0, telegram: parents?.tg ?? 0, email: parents?.mail ?? 0 },
        };
      }
      case "class_overview": {
        const c = await one<{ code: string; name: string }>("SELECT code, name FROM classes WHERE code = ? AND teacher_id = ?", String(a.class_code).toUpperCase(), teacherId);
        if (!c) throw new Error("Класс не найден среди ваших");
        const students = await all<{ id: string; first_name: string; last_name: string }>(
          "SELECT u.id, u.first_name, u.last_name FROM users u JOIN class_members m ON m.user_id = u.id WHERE m.class_code = ? ORDER BY u.last_name",
          c.code,
        );
        return {
          class: c.name,
          students: await Promise.all(
            students.map(async (s) => {
              const days = (await one<{ n: number }>("SELECT COUNT(DISTINCT date((at + 18000000) / 1000, 'unixepoch')) n FROM xp_log WHERE user_id = ? AND at >= ?", s.id, Date.now() - 7 * DAY))?.n ?? 0;
              const tasks = (await assignmentsFor(s.id)).filter((x) => x.classCode === c.code);
              const ent = await one<{ best: number | null }>("SELECT MAX(json_extract(result, '$.total')) best FROM ent_tests WHERE user_id = ? AND kind = 'full' AND finished_at IS NOT NULL", s.id);
              const exam = await one<{ title: string; score: number; max_score: number }>(
                "SELECT e.title, a.score, a.max_score FROM exam_attempts a JOIN exams e ON e.id = a.exam_id WHERE a.student_id = ? AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC LIMIT 1",
                s.id,
              );
              return {
                student_id: s.id,
                name: short(s),
                activeDaysLast7: days,
                assignments: `${tasks.filter((x) => x.done).length}/${tasks.length}`,
                overdue: tasks.filter((x) => !x.done && x.dueAt && x.dueAt < Date.now()).map((x) => x.title),
                entBest: ent?.best ?? null,
                lastExam: exam ? `${exam.title}: ${Math.round((exam.score / exam.max_score) * 100)}%` : null,
              };
            }),
          ),
        };
      }
      case "create_assignment": {
        const c = await one<{ code: string }>("SELECT code FROM classes WHERE code = ? AND teacher_id = ?", String(a.class_code).toUpperCase(), teacherId);
        if (!c) throw new Error("Класс не найден среди ваших");
        const kind = String(a.kind);
        const title = String(a.title).trim().slice(0, 120);
        if (!title) throw new Error("Нужно название задания");
        let ref = String(a.ref ?? "").trim();
        if (kind === "ent-subject" && !ENT_SUBJECT[ref]) throw new Error(`Неизвестный предмет ЕНТ. Доступные id: ${Object.keys(ENT_SUBJECT).join(", ")}`);
        if (kind === "sat-practice") ref = String(Math.min(100, Math.max(5, Number(ref) || 20)));
        if (!["ent-subject", "sat-practice"].includes(kind)) ref = "";
        const due = a.due_date ? Date.parse(`${a.due_date}T23:59:00+05:00`) : NaN;
        await run("INSERT INTO assignments (id, class_code, title, kind, ref, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id(), c.code, title, kind, ref, Number.isFinite(due) ? due : null, Date.now());
        return { ok: true, class: c.code, title, due: Number.isFinite(due) ? String(a.due_date) : null };
      }
      case "upcoming_consultations": {
        const slots = await all<{ id: string; title: string; kind: string; starts_at: number; capacity: number }>(
          "SELECT id, title, kind, starts_at, capacity FROM consult_slots WHERE teacher_id = ? AND cancelled = 0 AND starts_at BETWEEN ? AND ? ORDER BY starts_at",
          teacherId,
          Date.now(),
          Date.now() + 14 * DAY,
        );
        return Promise.all(
          slots.map(async (s) => ({
            title: s.title,
            kind: s.kind,
            at: new Date(s.starts_at + 5 * 3600_000).toISOString().slice(0, 16).replace("T", " "),
            capacity: s.capacity,
            booked: (
              await all<{ first_name: string; last_name: string; note: string }>("SELECT u.first_name, u.last_name, b.note FROM consult_bookings b JOIN users u ON u.id = b.student_id WHERE b.slot_id = ?", s.id)
            ).map((b) => ({ name: short(b), question: b.note })),
          })),
        );
      }
      case "draft_parent_message": {
        await ownStudent(teacherId, String(a.student_id));
        const text = String(a.text).trim().slice(0, 2500);
        if (!text) throw new Error("Пустой текст");
        const nid = id();
        await run("INSERT INTO parent_notes (id, teacher_id, student_id, text, created_at) VALUES (?, ?, ?, ?, ?)", nid, teacherId, String(a.student_id), text, Date.now());
        drafts.push(nid);
        return { draft_id: nid, status: "черновик показан учителю с кнопками; ещё не отправлен" };
      }
      default:
        throw new Error(`Нет инструмента ${name}`);
    }
  };
}

export async function teacherReply(input: { teacherId: string; history: BotTurn[]; text: string; images: { mime: string; data: string }[]; research: boolean }) {
  const t = (await one<{ first_name: string; last_name: string; title: string | null }>("SELECT first_name, last_name, title FROM users WHERE id = ?", input.teacherId))!;
  const name = t.title ? `${{ mr: "Mr", ms: "Ms", mrs: "Mrs" }[t.title] ?? ""} ${t.last_name}`.trim() : `${t.first_name} ${t.last_name}`;
  const system = SYSTEM.replace("{teacher}", name).replace("{today}", new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10)) + (input.research ? RESEARCH : "");
  const drafts: string[] = [];
  const text = await agentReply({
    system,
    history: input.history,
    content: [
      ...input.images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.mime as "image/jpeg", data: img.data } })),
      { type: "text", text: input.text || "Посмотри фото." },
    ],
    tools: TOOLS,
    run: tools(input.teacherId, drafts),
    web: input.research ? 15 : 4,
    effort: input.research ? "high" : "medium",
  });
  return { text, drafts };
}
