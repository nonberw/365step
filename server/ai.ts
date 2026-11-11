import { englishExamText } from "../shared/examEnglish";
import { transcriptCriteria } from "../shared/ieltsAssessment";
import { ENT_DEMO_TOPICS, isUsableEnt } from "../shared/entQuality";
import Anthropic from "@anthropic-ai/sdk";
import { consumeAi } from "./quota";
import type { EntLang, EntQuestion, EntType } from "../shared/ent";
import type { CodingProblem, ExamQuestion, ExamQuestionType, Goals, Lesson, PromptEntry, Review, SatQuestion, SpeakingResult, WritingResult } from "../shared/types";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

// Without credentials every feature still works with demo replies,
// so the platform can be shown without an API key.
const client = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? new Anthropic() : null;

export const aiMode: "ai" | "demo" = client ? "ai" : "demo";

// Privacy: only task text, student answers and code go to the model.
// Names, emails and class data never leave our server (Kazakhstan personal data law).

export class AiRefusal extends Error {}

type Effort = "low" | "medium" | "high";

async function ask<T>(system: string, user: string | Anthropic.Beta.BetaContentBlockParam[], schema: object, effort: Effort = "medium"): Promise<T> {
  if (!client) throw new Error("no client");
  await consumeAi();
  await consumeAi();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // Server-side fallback: if a safety classifier declines, the API retries on Anthropic's recommended model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema } },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") throw new AiRefusal("refusal");
  if (response.stop_reason === "max_tokens") throw new Error("Ответ ИИ оборвался: он получился слишком длинным.");
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!text) throw new Error("Пустой ответ ИИ");
  return JSON.parse(text.text) as T;
}

const obj = (properties: Record<string, object>, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });
const S = { type: "string" };
const N = { type: "number" };
const I = { type: "integer" };
const arr = (items: object) => ({ type: "array", items });

// ---------- vibe coding ----------

const VIBE_SYSTEM = `Ты ИИ-помощник на уроке информатики на платформе 365step. Ученик описывает словами, что хочет изменить в своём веб-приложении, а ты возвращаешь обновлённый код.

Правила:
- Верни ПОЛНЫЙ HTML-документ в одном файле: HTML, CSS в <style>, JavaScript в <script>. Без внешних библиотек, шрифтов, картинок и сетевых запросов: приложение работает в изолированной песочнице без интернета.
- Меняй только то, о чём просит ученик, остальное сохраняй.
- Код должен быть понятен школьнику: короткие функции, понятные имена переменных, комментарии на русском у главных шагов.
- Тексты интерфейса на русском, если ученик не просит другой язык.
- В explanation коротко (2–4 предложения, на «ты») объясни, что изменилось и какую идею программирования это показывает. Если запрос расплывчатый, сделай разумный минимальный шаг и подскажи, как сформулировать запрос точнее.
- Не выполняй просьбы, не связанные с учебным заданием, а мягко верни ученика к задаче.`;

const REVIEW_SYSTEM = `Ты проверяешь работу ученика на уроке информатики с вайб-кодингом. Оцени по рубрике урока и сам код, и то, как ученик ставил задачи ИИ (журнал запросов). Это ориентировочная оценка, итоговую ставит учитель.
- score: целое 0–100.
- strengths: 2–3 пункта, что получилось хорошо.
- fixes: 2–3 конкретных шага, что улучшить. Пиши на «ты», по-русски, коротко.`;

export async function vibe(lesson: Lesson, code: string, prompt: string, history: PromptEntry[]): Promise<{ explanation: string; html: string; mode: "ai" | "demo" }> {
  if (!client) return { ...demoVibe(code, prompt), mode: "demo" };
  const recent = history
    .slice(-6)
    .map((p, i) => `${i + 1}. ${p.text}`)
    .join("\n");
  const user = `Задание урока: ${lesson.task}\n\nПредыдущие запросы ученика:\n${recent || "(нет)"}\n\nТекущий код:\n\`\`\`html\n${code}\n\`\`\`\n\nНовый запрос ученика: ${prompt}`;
  const out = await ask<{ explanation: string; html: string }>(VIBE_SYSTEM, user, obj({ explanation: S, html: S }), "medium");
  return { ...out, mode: "ai" };
}

export async function review(lesson: Lesson, code: string, prompts: PromptEntry[]): Promise<Review> {
  if (!client) return demoReview(lesson, code, prompts);
  const user = `Урок: ${lesson.title}\nЗадание: ${lesson.task}\nРубрика:\n${lesson.rubric.map((r) => `- ${r}`).join("\n")}\n\nЖурнал запросов к ИИ:\n${prompts.map((p, i) => `${i + 1}. ${p.text}`).join("\n") || "(ученик не пользовался ИИ)"}\n\nИтоговый код:\n\`\`\`html\n${code}\n\`\`\``;
  const out = await ask<Omit<Review, "at" | "mode">>(REVIEW_SYSTEM, user, obj({ score: I, strengths: arr(S), fixes: arr(S) }), "low");
  return { at: Date.now(), score: clamp(Math.round(out.score), 0, 100), strengths: out.strengths.slice(0, 3), fixes: out.fixes.slice(0, 3), mode: "ai" };
}

// ---------- SAT ----------

const SAT_EXPLAIN_SYSTEM = `Ты репетитор по Digital SAT для школьников из Казахстана. Write all explanations in English. Формулы пиши в LaTeX между знаками $...$.
Структура ответа (поле explanation, 4–8 коротких предложений или шагов):
1) что проверяет вопрос; 2) как прийти к правильному ответу шаг за шагом; 3) почему выбранный учеником неверный вариант (если есть) — ловушка; 4) короткий совет на будущее.`;

export async function satExplain(q: SatQuestion, given: unknown): Promise<{ explanation: string; mode: "ai" | "demo" }> {
  if (!client) return { explanation: `${q.explanation}

Council: First, write the answer in your own words, then look for it among the options.`, mode: "demo" };
  const user = `Question (continued)${q.domain} · ${q.skill}):\n${q.passage ? `Text: ${q.passage}\n` : ""}${q.stem}\n${q.choices ? q.choices.map((c, i) => `${"ABCD"[i]}) ${c}`).join("\n") : "(responses entered by number)"}
Correct answer: ${q.choices ? "ABCD"[q.answer as number] : q.answer}
The student's reply: ${given === null || given === undefined || given === "" ? "(No)" : q.choices ? "ABCD"[Number(given)] : String(given)}
Brief decision from the bank: ${q.explanation}`;
  const out = await ask<{ explanation: string }>(SAT_EXPLAIN_SYSTEM, user, obj({ explanation: S }), "low");
  return { ...out, mode: "ai" };
}

const SAT_REMIX_SYSTEM = `Ты автор заданий Digital SAT. Создай НОВОЕ оригинальное задание того же домена, навыка и уровня сложности, что и образец, но с другим сюжетом и числами. Не копируй задания College Board.
- Для Reading & Writing: короткий текст (passage) на английском, 25–120 слов, вопрос (stem) и 4 варианта (choices), answer — индекс 0–3.
- Для Math: можно задание с вариантами (4 choices, answer — индекс) или grid-in (choices пустой массив, answerText — число строкой). Формулы в LaTeX между $...$.
- explanation — краткое решение in English.
- Проверь, что ровно один вариант правильный.`;

export async function satRemix(q: SatQuestion): Promise<Omit<SatQuestion, "id"> & { mode: "ai" | "demo" }> {
  if (!client) {
    return { ...q, source: "ai", explanation: q.explanation + "\n\n(Demo mode: with Claude connected, there will be a new task here.)", mode: "demo" };
  }
  const user = `Model (${q.section === "rw" ? "Reading & Writing" : "Math"} · ${q.domain} · ${q.skill} · Difficulties ${q.difficulty}/3):\n${q.passage ? `Passage: ${q.passage}\n` : ""}Stem: ${q.stem}\n${q.choices ? q.choices.map((c, i) => `${"ABCD"[i]}) ${c}`).join("\n") : `Response: ${q.answer}`}`;
  const out = await ask<{ passage: string; stem: string; choices: string[]; answer: number; answerText: string; explanation: string }>(
    SAT_REMIX_SYSTEM,
    user,
    obj({ passage: S, stem: S, choices: arr(S), answer: I, answerText: S, explanation: S }),
    "medium",
  );
  const grid = out.choices.length !== 4;
  return {
    section: q.section,
    domain: q.domain,
    skill: q.skill,
    difficulty: q.difficulty,
    passage: out.passage || undefined,
    stem: out.stem,
    choices: grid ? undefined : out.choices,
    answer: grid ? out.answerText : clamp(out.answer, 0, 3),
    explanation: out.explanation,
    source: "ai",
    mode: "ai",
  };
}

const SAT_HINT_SYSTEM = `Ты репетитор Digital SAT. Дай ОДНУ подсказку к вопросу, НЕ называя ответ и не исключая варианты напрямую. Подскажи, на что посмотреть или какой первый шаг сделать. 1–3 предложения in English, формулы в $...$.`;

export async function satHint(q: SatQuestion): Promise<{ hint: string; mode: "ai" | "demo" }> {
  if (!client) return { hint: "Formulate exactly what they ask, and find a word in the text, or a word that points to it. For mathematics, open a formula guide or Desmos.", mode: "demo" };
  const user = `${q.domain} · ${q.skill}\n${q.passage ? `Text: ${q.passage}\n` : ""}${q.stem}\n${q.choices ? q.choices.map((c, i) => `${"ABCD"[i]}) ${c}`).join("\n") : ""}`;
  const out = await ask<{ hint: string }>(SAT_HINT_SYSTEM, user, obj({ hint: S }), "low");
  return { ...out, mode: "ai" };
}

const SAT_GENERATE_SYSTEM = `Ты автор оригинальных заданий в формате Digital SAT. Создай новые задания по указанному домену и навыку. Не копируй задания College Board, Khan Academy и других источников — только свои сюжеты и числа.
- Reading & Writing: passage на английском 25–120 слов, stem, ровно 4 варианта, answer — индекс правильного 0–3.
- Math: 4 варианта (answer — индекс) или grid-in (choices пустой, answerText — число строкой); формулы в $...$.
- difficulty: 1 — лёгкий, 2 — средний, 3 — сложный, распредели разнообразно.
- explanation — краткое решение in English.
- Перепроверь каждое задание: ровно один правильный ответ, вычисления верны.`;

export async function satGenerate(section: "rw" | "math", domain: string, skill: string, count: number): Promise<{ items: Omit<SatQuestion, "id">[]; mode: "ai" | "demo" }> {
  if (!client) return { items: [], mode: "demo" };
  const user = `Section: ${section === "rw" ? "Reading & Writing" : "Math"}
Domain: ${domain}
Skills: ${skill}
Number of assignments: ${count}`;
  const out = await ask<{ items: { passage: string; stem: string; choices: string[]; answer: number; answerText: string; difficulty: number; explanation: string }[] }>(
    SAT_GENERATE_SYSTEM,
    user,
    obj({ items: arr(obj({ passage: S, stem: S, choices: arr(S), answer: I, answerText: S, difficulty: I, explanation: S })) }),
    "medium",
  );
  const items = out.items
    .filter((x) => x.stem && (x.choices.length === 4 ? x.answer >= 0 && x.answer <= 3 : !!x.answerText))
    .slice(0, count)
    .map((x) => {
      const grid = x.choices.length !== 4;
      return {
        section,
        domain: domain as SatQuestion["domain"],
        skill,
        difficulty: clamp(Math.round(x.difficulty), 1, 3) as 1 | 2 | 3,
        passage: x.passage || undefined,
        stem: x.stem,
        choices: grid ? undefined : x.choices,
        answer: grid ? x.answerText : x.answer,
        explanation: x.explanation,
        source: "ai" as const,
      };
    });
  return { items, mode: "ai" };
}

export interface StudyPlan {
  summary: string;
  weeks: { title: string; focus: string; days: { day: string; tasks: string[] }[] }[];
  mode: "ai" | "demo";
}

const PLAN_SYSTEM = `Ты составляешь учебный план подготовки к экзаменам (Digital SAT и/или IELTS) для ученика школы BSTS. Опирайся на цель, дату экзамена и слабые места из статистики. План на ближайшие 2 недели, по 5 учебных дней в неделю, 2–4 задачи в день по 20–40 минут. Задачи конкретные: какой раздел платформы, сколько вопросов, какая тема. Разделы платформы: «Банк вопросов SAT», «Пробный тест SAT», «Blitz», «Словарь», «Повтор ошибок», «IELTS Speaking», «IELTS Writing», «IELTS Reading», «IELTS Listening». Пиши in English. summary — 2–3 предложения о стратегии.`;

export async function studyPlan(goals: Goals, stats: string): Promise<StudyPlan> {
  if (!client) return demoPlan(goals, stats);
  const today = new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  const user = `Today: ${today}
Objectives: ${JSON.stringify(goals)}
Student statistics:
${stats}`;
  const out = await ask<Omit<StudyPlan, "mode">>(PLAN_SYSTEM, user, obj({ summary: S, weeks: arr(obj({ title: S, focus: S, days: arr(obj({ day: S, tasks: arr(S) })) })) }), "medium");
  return { ...out, mode: "ai" };
}

// ---------- IELTS ----------

const WRITING_SYSTEM = `Ты экзаменатор IELTS Writing с большим опытом. Оцени работу по официальным публичным дескрипторам: Task Achievement (Task 1) или Task Response (Task 2), Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy. Баллы — шагами по 0.5.
- overall — среднее по четырём критериям, округлённое по правилам IELTS (.25 вверх до .5, .75 вверх до целого).
- criteria: 4 элемента {name, band, comment}; comment in English, 1–2 предложения с конкретикой.
- annotations: 6–12 фрагментов ТОЧНО как в тексте ученика (quote — дословная подстрока длиной 2–12 слов). kind "error" — ошибка (category: Grammar / Vocabulary / Coherence / Task), fix — исправленный вариант; kind "good" — удачная фраза.
- plan: 3 конкретных шага in English, что делать дальше.
- predicted — реалистичный балл после исправления этих ошибок.
Это ориентировочная оценка, не официальный балл IELTS.`;

export async function ieltsWriting(task: 1 | 2, prompt: string, text: string, chart?: string): Promise<WritingResult> {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (!client) return demoWriting(task, text, wordCount);
  const user = `Writing Task ${task}\nЗадание: ${prompt}\n${chart ? `Данные графика: ${chart}\n` : ""}Количество слов: ${wordCount}\n\nТекст ученика:\n${text}`;
  const out = await ask<Omit<WritingResult, "wordCount" | "mode">>(
    WRITING_SYSTEM,
    user,
    obj({
      overall: N,
      criteria: arr(obj({ name: S, band: N, comment: S })),
      annotations: arr(obj({ quote: S, kind: { type: "string", enum: ["error", "good"] }, category: S, comment: S, fix: S }, ["quote", "kind", "category", "comment", "fix"])),
      plan: arr(S),
      predicted: N,
    }),
    "medium",
  );
  return { ...out, annotations: out.annotations.filter((a) => text.includes(a.quote)), wordCount, mode: "ai" };
}

const SPEAKING_SYSTEM = `Ты экзаменатор IELTS Speaking. Тебе дана расшифровка ответа ученика (автоматическое распознавание речи, без пунктуации и с возможными ошибками распознавания — не наказывай за них) и длительность ответа. Оцени по публичным дескрипторам: Fluency and Coherence (только связность текста, без аудиоплавности), Lexical Resource, Grammatical Range and Accuracy. Баллы шагами по 0.5.
Произношение по тексту не оценивается. Не делай выводов о звуках, ударении, интонации или паузах.
- criteria: 3 элемента {name, band, comment in English}.
- feedback: 3–5 конкретных наблюдений in English с цитатами из ответа.
- plan: 3 упражнения на следующую неделю.
- predicted — балл после работы над ошибками.
Это ориентировочная оценка, не официальный балл IELTS.`;

export async function ieltsSpeaking(part: number, prompt: string, transcript: string, seconds: number): Promise<SpeakingResult> {
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  const wpm = seconds > 0 ? Math.round((words / seconds) * 60) : 0;
  if (!client) return demoSpeaking(words, wpm);
  const user = `Speaking Part ${part}\nВопрос: ${prompt}\nДлительность: ${Math.round(seconds)} с, слов: ${words}, темп: ${wpm} слов/мин\n\nРасшифровка:\n${transcript}`;
  const out = await ask<Omit<SpeakingResult, "wordsPerMinute" | "mode" | "overall"> & { overall: number }>(
    SPEAKING_SYSTEM,
    user,
    obj({ overall: N, criteria: arr(obj({ name: S, band: N, comment: S })), feedback: arr(S), plan: arr(S), predicted: N }),
    "medium",
  );
  return { ...out, ...transcriptCriteria(out.criteria), predicted: null, wordsPerMinute: wpm, mode: "ai" };
}

// ---------- coding ----------

const HINT_SYSTEM = `Ты наставник по алгоритмам для школьников. Дай подсказку к задаче, НЕ выдавая готового решения и не переписывая код целиком. Посмотри на код ученика и результаты тестов: укажи на конкретную ошибку или следующий шаг. Максимум 5 предложений по-русски, можно один короткий фрагмент кода до 3 строк.`;

export async function codeHint(p: CodingProblem, lang: string, code: string, failing: string): Promise<{ hint: string; mode: "ai" | "demo" }> {
  if (!client) return { hint: p.hints[Math.min(p.hints.length - 1, failing ? 1 : 0)] ?? "Разбей задачу на маленькие шаги и проверь каждый на примере.", mode: "demo" };
  const user = `Задача «${p.title}»: ${p.statement}\nЯзык: ${lang}\nКод ученика:\n\`\`\`\n${code}\n\`\`\`\nРезультаты тестов: ${failing || "ещё не запускал"}`;
  const out = await ask<{ hint: string }>(HINT_SYSTEM, user, obj({ hint: S }), "low");
  return { ...out, mode: "ai" };
}

// ---------- demo mode ----------

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function demoVibe(code: string, prompt: string) {
  const block = `
<section class="demo-step" style="margin:16px 0;padding:16px;border:2px solid #7b0004;border-radius:14px">
  <p style="margin:0 0 8px;font-weight:600">Шаг: ${esc(prompt)}</p>
  <button onclick="this.nextElementSibling.textContent = +this.nextElementSibling.textContent + 1"
    style="background:#7b0004;color:#fff;border:0;border-radius:999px;padding:8px 16px;font-size:16px;cursor:pointer">Нажми</button>
  <span style="font-size:24px;margin-left:12px">0</span>
</section>`;
  const html = code.includes("</body>") ? code.replace("</body>", `${block}\n</body>`) : code + block;
  return {
    explanation: "Демо-режим без ключа ИИ: я добавил блок с кнопкой и счётчиком, чтобы показать, как работает шаг. С подключённым Claude здесь появится настоящий код по твоему запросу.",
    html,
  };
}

function demoReview(lesson: Lesson, code: string, prompts: PromptEntry[]): Review {
  const score = Math.min(95, 40 + prompts.length * 8 + Math.min(20, Math.floor(code.length / 400)));
  return {
    at: Date.now(),
    score,
    strengths: [prompts.length >= 3 ? "Ты шёл маленькими шагами, а не просил «сделай всё сразу»" : "Ты начал работу над заданием", "Приложение открывается без ошибок"],
    fixes: [`Сверь работу с рубрикой: «${lesson.rubric[0]}»`, "Проверь приложение сам: нажми все кнопки и попробуй сломать его"],
    mode: "demo",
  };
}

function demoPlan(goals: Goals, stats: string): StudyPlan {
  const weak = englishExamText(stats.match(/слабое: ([^\n]+)/)?.[1] ?? "Algebra");
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const mk = (i: number) => ({
    day: days[i]!,
    tasks: [
      goals.sat ? `SAT Question Banks: 15 questions on ${weak}` : "IELTS Reading: one timed passage",
      i % 2 === 0 ? "Vocabulary: one unit with flashcards and a quiz" : "Mistake review: revisit the questions in your queue",
      i === 4 ? (goals.sat ? "Complete a full SAT practice test in exam mode" : "IELTS Writing Task 2 with feedback") : "Blitz: one round with three lives",
    ],
  });
  return {
    summary: "Demo plan: build weaker skills with short daily practice, then check your progress with a full practice test at the end of the week.",
    weeks: [
      { title: "Week 1", focus: `Focus skill: ${weak}`, days: days.map((_, i) => mk(i)) },
      { title: "Week 2", focus: "Timing and mistake review", days: days.map((_, i) => mk(i)) },
    ], mode: "demo",
  };
}
function demoWriting(task: 1 | 2, _text: string, wordCount: number): WritingResult {
  const min = task === 1 ? 150 : 250;
  return {
    overall: null, predicted: null, wordCount, mode: "demo", annotations: [],
    criteria: [{ name: "Word count", band: null, comment: `${wordCount} words; the suggested minimum is ${min}. Writing quality has not been assessed.` }],
    plan: ["Check that your response addresses the task", "Match each paragraph to a clear main idea", "For substantive feedback, use a connected model or ask a teacher"],
  };
}
function demoSpeaking(words: number, wpm: number): SpeakingResult {
  return {
    overall: null, predicted: null, wordsPerMinute: wpm, mode: "demo",
    criteria: [{ name: "Pronunciation", band: null, comment: "Not assessed: audio analysis is required." }],
    feedback: [`${words} words transcribed at an average of ${wpm} words per minute. These figures do not measure language proficiency.`, "Demo only: this response has not received a substantive assessment."],
    plan: ["Listen to your recording and compare it with the transcript", "Check that you covered every point on the cue card"],
  };
}

// ---------- exams from teacher materials ----------

export interface ExamSource {
  title: string;
  kind: "pdf" | "docx" | "text" | "image";
  mime: string;
  text: string;
  /** base64 of the original file, sent as a document or image block when it fits */
  data?: string;
}

export interface ExamRequest {
  title: string;
  subject: string;
  grade: string;
  instructions: string;
  count: number;
  types: ExamQuestionType[];
  difficulty: "easy" | "mixed" | "hard";
  language: "ru" | "kk" | "en";
}

const EXAM_SYSTEM = `Ты помогаешь учителю на платформе 365step составить контрольную работу по его материалам. Вопросы проверяют понимание материала, а не память на мелочи.

Правила:
- Опирайся на приложенные материалы учителя и не придумывай факты, которых в них нет. Если материалов нет, составь вопросы по теме и пожеланиям учителя в рамках школьной программы Казахстана.
- Типы вопросов: mcq — 4 варианта, ровно один верный, answer — индекс 0–3; tf — утверждение, choices ["Верно","Неверно"], answer 0 или 1; short — короткий ответ (число, термин, слово), answer — допустимые варианты через «|»; open — развёрнутый ответ, answer — эталонный ответ с ключевыми пунктами для проверки.
- Неверные варианты в mcq правдоподобны и отражают типичные ошибки учеников. Верный вариант стоит на разных позициях.
- points: mcq и tf — 1, short — 1–2, open — 2–5.
- explanation: 1–2 предложения, почему ответ верный, со ссылкой на материал.
- Формулы пиши в LaTeX между знаками $...$.
- Язык вопросов — как попросил учитель.`;

const LANG_RU = { ru: "русский", kk: "казахский", en: "английский" } as const;

export async function examGenerate(req: ExamRequest, sources: ExamSource[]): Promise<{ items: ExamQuestion[]; mode: "ai" | "demo" }> {
  if (!client) return { items: demoExam(req, sources), mode: "demo" };
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  let budget = 150_000;
  for (const s of sources) {
    if (s.kind === "pdf" && s.data) {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: s.data }, title: s.title } as Anthropic.Beta.BetaContentBlockParam);
    } else if (s.kind === "image" && s.data) {
      content.push({ type: "text", text: `Материал «${s.title}» (изображение):` });
      content.push({ type: "image", source: { type: "base64", media_type: s.mime as "image/png", data: s.data } });
    } else if (s.text && budget > 0) {
      const text = s.text.slice(0, budget);
      budget -= text.length;
      content.push({ type: "text", text: `Материал «${s.title}»:\n${text}` });
    }
  }
  content.push({
    type: "text",
    text: `Контрольная: ${req.title}\nПредмет: ${req.subject || "—"}\nКласс: ${req.grade || "—"}\nКоличество вопросов: ${req.count}\nТипы вопросов: ${req.types.join(", ")} (распредели примерно поровну)\nСложность: ${{ easy: "базовая", mixed: "смешанная", hard: "повышенная" }[req.difficulty]}\nЯзык вопросов: ${LANG_RU[req.language]}\nПожелания учителя: ${req.instructions || "нет"}`,
  });
  const out = await ask<{ items: { type: string; prompt: string; choices: string[]; answer: string; points: number; explanation: string }[] }>(
    EXAM_SYSTEM,
    content,
    obj({ items: arr(obj({ type: { type: "string", enum: ["mcq", "tf", "short", "open"] }, prompt: S, choices: arr(S), answer: S, points: N, explanation: S })) }),
    "medium",
  );
  const items: ExamQuestion[] = [];
  for (const x of out.items) {
    const type = x.type as ExamQuestionType;
    if (!req.types.includes(type) || !x.prompt) continue;
    const base = { id: `q${items.length + 1}`, type, prompt: x.prompt, points: clamp(Math.round(x.points) || 1, 1, 5), explanation: x.explanation };
    if (type === "mcq") {
      const idx = Number(x.answer);
      if (x.choices.length !== 4 || !(idx >= 0 && idx <= 3)) continue;
      items.push({ ...base, choices: x.choices, answer: idx });
    } else if (type === "tf") {
      const idx = /^(1|неверно|false|жалған)$/i.test(x.answer.trim()) ? 1 : 0;
      items.push({ ...base, choices: ["Верно", "Неверно"], answer: idx });
    } else {
      if (!x.answer.trim()) continue;
      items.push({ ...base, answer: x.answer.trim() });
    }
  }
  return { items: items.slice(0, req.count), mode: "ai" };
}

const OPEN_GRADE_SYSTEM = `Ты проверяешь развёрнутые ответы учеников в школьной контрольной. Сравни ответ с эталоном учителя: засчитывай верные мысли, даже если сформулированы иначе; не снижай за орфографию, если смысл ясен. points — от 0 до max (можно половинки). feedback — 1–2 предложения на «ты»: что верно и чего не хватило. Это предварительная оценка, учитель может её изменить.`;

export async function gradeOpen(items: { prompt: string; model: string; answer: string; max: number }[]): Promise<{ points: number; feedback: string }[]> {
  if (!items.length) return [];
  if (!client) return items.map(demoGradeOpen);
  try {
    const user = items.map((x, i) => `### Ответ ${i + 1} (максимум ${x.max})\nВопрос: ${x.prompt}\nЭталон: ${x.model}\nОтвет ученика: ${x.answer || "(пусто)"}`).join("\n\n");
    const out = await ask<{ grades: { points: number; feedback: string }[] }>(OPEN_GRADE_SYSTEM, user, obj({ grades: arr(obj({ points: N, feedback: S })) }), "low");
    return items.map((x, i) => {
      const g = out.grades[i];
      if (!g) return demoGradeOpen(x);
      return { points: clamp(Math.round(g.points * 2) / 2, 0, x.max), feedback: g.feedback };
    });
  } catch {
    return items.map(demoGradeOpen);
  }
}

const keyWords = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\d]{4,}/gu) ?? []);

function demoGradeOpen(x: { model: string; answer: string; max: number }) {
  const want = keyWords(x.model);
  const got = keyWords(x.answer);
  const hit = [...want].filter((w) => got.has(w)).length;
  const ratio = want.size ? hit / want.size : 0;
  const points = clamp(Math.round(Math.min(1, ratio * 1.6) * x.max * 2) / 2, 0, x.max);
  return { points, feedback: `Демо-проверка по ключевым словам: совпало ${hit} из ${want.size}. С Claude здесь будет разбор по смыслу.` };
}

/** Without Claude: cloze, true/false and choice questions built from sentences of the material. */
function demoExam(req: ExamRequest, sources: ExamSource[]): ExamQuestion[] {
  const sentences = sources
    .map((s) => s.text)
    .join("\n")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 240 && /\p{L}{6,}/u.test(s));
  const longest = (s: string) => (s.match(/\p{L}{5,}/gu) ?? []).sort((a, b) => b.length - a.length)[0] ?? "";
  const pool = [...new Set(sentences.map(longest).filter(Boolean))];
  const items: ExamQuestion[] = [];
  const step = Math.max(1, Math.floor(sentences.length / Math.max(1, req.count)));
  for (let i = 0; items.length < req.count && i < req.count * 3; i++) {
    const type = req.types[items.length % req.types.length];
    const id = `q${items.length + 1}`;
    const s = sentences.length ? sentences[(i * step + Math.floor(i / req.count)) % sentences.length] : "";
    if (!s) {
      items.push({ id, type: "open", prompt: `Объясни своими словами главную идею темы «${req.title}» и приведи пример.`, answer: `Ключевые понятия темы «${req.title}» и их связь.`, points: 3 });
      continue;
    }
    const w = longest(s);
    const blank = s.replace(w, "_____");
    if (type === "short") {
      items.push({ id, type, prompt: `Вставь пропущенное слово: «${blank}»`, answer: w, points: 1, explanation: `В материале: «${s}»` });
    } else if (type === "mcq") {
      const others = pool
        .filter((p) => p.toLowerCase() !== w.toLowerCase())
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      if (others.length < 3) continue;
      const at = items.length % 4;
      const choices = [...others];
      choices.splice(at, 0, w);
      items.push({ id, type, prompt: `Какое слово пропущено? «${blank}»`, choices, answer: at, points: 1, explanation: `В материале: «${s}»` });
    } else if (type === "tf") {
      const other = pool.find((p) => p.toLowerCase() !== w.toLowerCase());
      const truth = items.length % 2 === 0 || !other;
      items.push({ id, type, prompt: truth ? s : s.replace(w, other!), choices: ["Верно", "Неверно"], answer: truth ? 0 : 1, points: 1, explanation: `В материале: «${s}»` });
    } else {
      items.push({ id, type, prompt: `Объясни своими словами и приведи пример: «${s}»`, answer: s, points: 3 });
    }
  }
  return items;
}

// ---------- textbooks: study a page with AI ----------

export type BookAction = "explain" | "summary" | "quiz" | "cards" | "ask" | "interactive";

export interface BookContext {
  book: string;
  subject: string;
  grade: number | null;
  language: "ru" | "kk" | "en";
  place: string;
  text: string;
}

export type BookAnswer =
  | { action: "explain" | "ask"; text: string; mode: "ai" | "demo" }
  | { action: "summary"; points: string[]; terms: { term: string; def: string }[]; mode: "ai" | "demo" }
  | { action: "quiz"; items: { q: string; choices: string[]; answer: number; why: string }[]; mode: "ai" | "demo" }
  | { action: "cards"; cards: { front: string; back: string }[]; mode: "ai" | "demo" }
  | { action: "interactive"; explainer: ExplainerSpec; mode: "ai" | "demo" };

export interface ExplainerSpec {
  title: string;
  question: string;
  options: string[];
  correct: number;
  controls: string;
  script: string;
  reveal: string;
}

const BOOK_SYSTEM = `Ты ИИ-репетитор в библиотеке платформы 365step. Ученик читает учебник и просит помочь с текущей страницей. Опирайся на текст страницы; если вопрос выходит за её рамки, коротко ответь по школьной программе и скажи, что это не из учебника. Пиши на языке учебника (русский, казахский или английский), на «ты», коротко и понятно для указанного класса. Формулы — в LaTeX между знаками $...$. Не решай за ученика домашние задания целиком: объясняй ход мысли.`;

const BOOK_TASK: Record<Exclude<BookAction, "interactive">, string> = {
  explain: "Объясни эту страницу проще: главная идея одним предложением, затем 3–5 коротких шагов или пунктов и один пример из жизни. Поле text.",
  summary: "Сделай конспект: points — 4–7 главных мыслей; terms — 3–8 ключевых терминов с короткими определениями.",
  quiz: "Составь мини-тест из 5 вопросов на понимание этой страницы: 4 варианта, ровно один верный (answer — индекс 0–3), why — почему верно, одним предложением.",
  cards: "Сделай 6–10 карточек для запоминания: front — вопрос или термин, back — короткий ответ.",
  ask: "Ответь на вопрос ученика по этой странице. Поле text, 2–6 предложений.",
};

const EXPLAINER_SYSTEM = `Ты создаёшь интерактивное объяснение к странице школьного учебника в стиле «Every Joule»: живая схема на canvas, затем ученик предсказывает результат, проверяет опытом, поднимает «клапан» с объяснением и ставит штамп «Понято».

Верни JSON с полями:
- title — короткий заголовок опыта;
- question — вопрос для предсказания (простой текст, без LaTeX и без HTML);
- options — 3–4 варианта ответа (простой текст), correct — индекс верного;
- controls — HTML с 1–3 ползунками для свободных опытов после проверки: <label>Подпись <input id="..." type="range" min max step value><span class="readout" id="..."></span></label>; можно <select>;
- script — JavaScript, который определяет ТРИ функции: draw(k) — рисует сцену на ctx для прогресса k от 0 до 1; async test() — показывает опыт для вопроса (используй await anim(ms, draw)); update() — читает ползунки, пишет значения в .readout и перерисовывает сцену;
- reveal — HTML-объяснение (2–4 абзаца <p>, можно <b>), формулы простым текстом: v = √(2gh), η = (Aп/Aз)·100%.

Уже доступны глобальные: cv (canvas), ctx, fit() — подогнать canvas (вызывай в начале draw), W() и H() — ширина и высота в CSS-пикселях (высота ≈ 280), anim(ms, fn) — анимация fn(k), bar(x, y, w, h, value, max, color, label) — столбик, sleep(ms). Цвета: красный #b5121b, тёмный #1d1919, зелёный #1f8a4c, жёлтый #f2b705, фон белый.
Правила для script: только обычный JavaScript без import, сети, localStorage, alert и внешних библиотек; не объявляй переменные с именами cv, ctx, fit, W, H, anim, bar, sleep, pick, tested, CORRECT; draw(0) вызывается до опыта и должен рисовать исходную сцену без ошибок; ползунки до опыта скрыты, но существуют. Сцена должна честно показывать физику/математику страницы: числа на схеме считаются по формулам. Подписи на языке учебника.`;

export async function bookStudy(action: BookAction, ctx: BookContext, question = ""): Promise<BookAnswer> {
  if (!client) return demoBook(action, ctx);
  const head = `Учебник: ${ctx.book}\nПредмет: ${ctx.subject}\nКласс: ${ctx.grade ?? "—"}\nЯзык учебника: ${LANG_RU[ctx.language]}\nМесто: ${ctx.place}\n\nТекст страницы:\n${ctx.text.slice(0, 24_000)}`;
  if (action === "interactive") {
    const spec = await ask<ExplainerSpec>(
      EXPLAINER_SYSTEM,
      `${head}\n\nСделай интерактивное объяснение главной идеи этой страницы.`,
      obj({ title: S, question: S, options: arr(S), correct: I, controls: S, script: S, reveal: S }),
      "medium",
    );
    if (spec.options.length < 2 || spec.correct < 0 || spec.correct >= spec.options.length) throw new Error("ИИ вернул неполный опыт. Попробуйте ещё раз");
    return { action, explainer: spec, mode: "ai" };
  }
  const user = `${head}\n\nЗадание: ${BOOK_TASK[action]}${action === "ask" ? `\n\nВопрос ученика: ${question}` : ""}`;
  if (action === "explain" || action === "ask") {
    const out = await ask<{ text: string }>(BOOK_SYSTEM, user, obj({ text: S }), "low");
    return { action, text: out.text, mode: "ai" };
  }
  if (action === "summary") {
    const out = await ask<{ points: string[]; terms: { term: string; def: string }[] }>(BOOK_SYSTEM, user, obj({ points: arr(S), terms: arr(obj({ term: S, def: S })) }), "low");
    return { action, ...out, mode: "ai" };
  }
  if (action === "quiz") {
    const out = await ask<{ items: { q: string; choices: string[]; answer: number; why: string }[] }>(BOOK_SYSTEM, user, obj({ items: arr(obj({ q: S, choices: arr(S), answer: I, why: S })) }), "medium");
    return { action, items: out.items.filter((x) => x.choices.length === 4 && x.answer >= 0 && x.answer <= 3).slice(0, 5), mode: "ai" };
  }
  const out = await ask<{ cards: { front: string; back: string }[] }>(BOOK_SYSTEM, user, obj({ cards: arr(obj({ front: S, back: S })) }), "low");
  return { action, cards: out.cards.slice(0, 10), mode: "ai" };
}

function demoBook(action: BookAction, ctx: BookContext): BookAnswer {
  const plain = ctx.text
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\*\*|##|\|/g, " ")
    .replace(/\s+/g, " ");
  const sentences = plain.split(/(?<=[.!?])\s+/).filter((s) => s.length > 30);
  const note = "Демо-режим: с подключённым Claude ответ будет составлен по смыслу страницы.";
  if (action === "explain" || action === "ask") return { action, text: `${sentences.slice(0, 3).join(" ")}\n\n${note}`, mode: "demo" };
  if (action === "summary") {
    const terms = [...plain.matchAll(/([А-ЯA-Z][\p{L}-]{3,}(?:\s[\p{L}-]+)?)\s+—\s+([^.]{10,120})/gu)].slice(0, 6).map((m) => ({ term: m[1], def: m[2] }));
    return { action, points: sentences.slice(0, 5), terms, mode: "demo" };
  }
  if (action === "cards") {
    const cards = sentences.slice(0, 8).map((s) => {
      const w = (s.match(/\p{L}{6,}/gu) ?? []).sort((a, b) => b.length - a.length)[0] ?? "";
      return { front: s.replace(w, "_____"), back: w };
    });
    return { action, cards, mode: "demo" };
  }
  if (action === "quiz") {
    const items = demoExam({ title: ctx.book, subject: ctx.subject, grade: "", instructions: "", count: 5, types: ["mcq"], difficulty: "mixed", language: ctx.language }, [
      { title: ctx.book, kind: "text", mime: "text/plain", text: ctx.text },
    ])
      .filter((q) => q.choices)
      .map((q) => ({ q: q.prompt, choices: q.choices!, answer: Number(q.answer), why: q.explanation ?? "" }));
    return { action, items, mode: "demo" };
  }
  throw new HttpErrorLike("Интерактивные объяснения ИИ работают с подключённым Claude. Для глав со значком «опыт» есть готовые интерактивы");
}

export class HttpErrorLike extends Error {
  status = 503;
}

// ---------- ЕНТ: original questions in the ENT format ----------

const ENT_SYSTEM = `Ты составляешь оригинальные задания для подготовки к ЕНТ (Единое национальное тестирование, Казахстан) по спецификациям НЦТ. Никогда не воспроизводи реальные или «слитые» задания ЕНТ и задания из сборников — только новые задания в том же формате и по той же программе (школьная программа РК, 10–11 классы).

Типы заданий:
- single — один правильный ответ из 4 вариантов; answer — массив из одного индекса 0–3.
- context — несколько заданий к одному общему тексту/ситуации (passage): каждый вопрос с 4 вариантами и одним правильным; passage общий для всех заданий группы и самодостаточен (таблица, график словами, ситуация, научно-популярный или публицистический текст 120–250 слов).
- multi — один или несколько правильных ответов из 6 вариантов (правильных 1–3); answer — отсортированный массив индексов 0–5.
- match — установление соответствия: left — 3 элемента, options — 4 варианта (один лишний); answer — для каждого элемента left индекс варианта в options.

Требования:
- Уровни сложности по спецификации: A (базовый) ~50%, B (средний) ~30%, C (повышенный) ~20%.
- Неверные варианты правдоподобны и отражают типичные ошибки.
- Факты (даты, имена, формулы, законы) — только достоверные и общепринятые; если не уверен в факте, выбери другую тему.
- Формулы в LaTeX между $...$.
- explanation — 1–3 предложения: почему ответ верный и где типичная ошибка.
- Язык заданий — как указано в запросе. Для предметов «Казахский язык» и «Казахская литература» — на казахском, для «Английский язык» — на английском.`;

const ENT_LANG = { ru: "русский", kk: "казахский", en: "английский" } as const;

type EntDraft = Omit<EntQuestion, "id">;

export async function entGenerate(subject: { id: string; name: string }, topic: string, type: EntType, count: number, lang: EntLang | "en"): Promise<EntDraft[]> {
  if (!client) return demoEnt(subject.id, topic, type, count, lang);
  const groups = type === "context" ? Math.max(1, Math.round(count / 5)) : 0;
  const user = `Предмет: ${subject.name}\nТема: ${topic}\nТип заданий: ${type}\n${type === "context" ? `Групп: ${groups}, по 5 вопросов к каждому тексту` : `Количество заданий: ${count}`}\nЯзык: ${ENT_LANG[lang]}`;
  const out = await ask<{ items: { passage: string; stem: string; options: string[]; left: string[]; answer: number[]; explanation: string; difficulty: string }[] }>(
    ENT_SYSTEM,
    user,
    obj({ items: arr(obj({ passage: S, stem: S, options: arr(S), left: arr(S), answer: arr(I), explanation: S, difficulty: { type: "string", enum: ["A", "B", "C"] } })) }),
    "medium",
  );
  const items: EntDraft[] = [];
  let group = "";
  let lastPassage = "";
  for (const x of out.items) {
    if (!x.stem) continue;
    const base = {
      subject: subject.id,
      topic,
      type,
      lang,
      stem: x.stem,
      explanation: x.explanation,
      difficulty: (["A", "B", "C"].includes(x.difficulty) ? x.difficulty : "A") as EntDraft["difficulty"],
      source: "ai" as const,
    };
    if (type === "single" || type === "context") {
      if (x.options.length !== 4 || x.answer.length !== 1 || !(x.answer[0] >= 0 && x.answer[0] <= 3)) continue;
      if (type === "context") {
        const passage = x.passage?.trim() || lastPassage;
        if (!passage) continue;
        if (passage !== lastPassage) {
          group = crypto.randomUUID().slice(0, 8);
          lastPassage = passage;
        }
        items.push({ ...base, options: x.options, answer: x.answer[0], passage, groupId: group });
      } else items.push({ ...base, options: x.options, answer: x.answer[0] });
    } else if (type === "multi") {
      const ans = [...new Set(x.answer)].filter((i) => i >= 0 && i < 6).sort((a, b) => a - b);
      if (x.options.length !== 6 || !ans.length || ans.length > 3) continue;
      items.push({ ...base, options: x.options, answer: ans });
    } else {
      if (x.left.length !== 3 || x.options.length !== 4 || x.answer.length !== 3 || x.answer.some((i) => !(i >= 0 && i <= 3))) continue;
      items.push({ ...base, left: x.left, options: x.options, answer: x.answer });
    }
  }
  return items.filter(isUsableEnt);
}

const ENT_EXPLAIN_SYSTEM = `Ты репетитор по подготовке к ЕНТ. Объясни ученику решение задания: короткий разбор по шагам (3–6 шагов), почему верный ответ верный и почему выбранный учеником ответ неверен (если он ошибся), и одна подсказка, как не ошибаться в похожих заданиях. Пиши на языке задания, на «ты». Формулы в LaTeX между $...$.`;

export async function entExplain(q: EntQuestion, given: unknown): Promise<{ text: string; mode: "ai" | "demo" }> {
  if (!client) return { text: `${englishExamText(q.explanation)}\n\nДемо-режим: с подключённым Claude здесь будет пошаговый разбор.`, mode: "demo" };
  const user = `${q.passage ? `Текст:\n${q.passage}\n\n` : ""}Задание (${q.type}): ${q.stem}\n${q.left ? `Левый столбец: ${q.left.map((l, i) => `${i + 1}) ${l}`).join("; ")}\n` : ""}Варианты: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("; ")}\nПравильный ответ (индексы с 0): ${JSON.stringify(q.answer)}\nОтвет ученика (индексы с 0): ${JSON.stringify(given)}\nКраткое пояснение автора: ${q.explanation}`;
  const out = await ask<{ text: string }>(ENT_EXPLAIN_SYSTEM, user, obj({ text: S }), "low");
  return { text: out.text, mode: "ai" };
}

/** Without Claude: parametric math-literacy items so the section still works in demo mode. */
export function demoEnt(subject: string, topic: string, type: EntType, count: number, lang: EntLang | "en"): EntDraft[] {
  if (type !== "single" || subject !== "math-lit" || !ENT_DEMO_TOPICS.includes(topic) || lang !== "ru") return [];
  return Array.from({ length: Math.max(0, Math.min(count, 30)) }, () => {
    const price = 1000 * (2 + Math.floor(Math.random() * 18));
    const pct = [5, 10, 15, 20, 25, 30][Math.floor(Math.random() * 6)]!;
    const discount = price * pct / 100, right = price - discount;
    // Typical errors: report discount, add discount, or subtract the percentage as currency.
    const wrong = [...new Set([discount, price + discount, price - pct, price])].filter((n) => n !== right).slice(0, 3);
    const answer = Math.floor(Math.random() * 4);
    wrong.splice(answer, 0, right);
    return {
      subject, topic, type, lang,
      stem: `Товар стоил ${price.toLocaleString("ru-RU")} ₸, на него сделали скидку ${pct}%. Сколько он стоит теперь?`,
      options: wrong.map((v) => `${v.toLocaleString("ru-RU")} ₸`), answer,
      explanation: `${pct}% от ${price} — это ${discount}; вычитаем из цены: ${price} − ${discount} = ${right} ₸. Демонстрационное упражнение.`,
      difficulty: "A" as const, source: "seed" as const,
    };
  }).filter(isUsableEnt);
}

// ---------- ЕНТ: adaptive plan until the main session ----------

export interface EntPlanTask {
  kind: "practice" | "mini" | "full" | "review";
  subject: string;
  topic: string;
  count: number;
  title: string;
}

export interface EntPlan {
  summary: string;
  weeks: { week: number; focus: string; tasks: EntPlanTask[] }[];
  milestones: { month: string; target: number; note: string }[];
  mode: "ai" | "demo";
}

export interface EntPlanInput {
  grade: number | null;
  examDate: string;
  examYear: number;
  sessionName: string;
  tentative: boolean;
  subjects: { id: string; name: string; max: number; topics: string[] }[];
  target: number;
  daysLeft: number;
  best: number | null;
  last: { id: string; points: number; max: number }[] | null;
  accuracy: Record<string, number | null>;
  weak: { subject: string; topic: string; pct: number }[];
  fullTests: number;
}

const ENT_PLAN_SYSTEM = `Ты помогаешь ученику самостоятельно готовиться к ЕНТ (Казахстан). Учитывай его класс, выбранный год и сессию экзамена. По данным ученика составь план подготовки:
- weeks — ровно 4 ближайшие недели, в каждой 4–6 задач. Типы задач: practice (тренировка темы, count — число заданий 10–20), mini (мини-пробник по предмету), full (полный пробный ЕНТ на 240 минут, не чаще раза в 2 недели; первая неделя — если полных пробников ещё не было), review (повтор ошибок, count — минуты 15–30). subject — id предмета из списка, topic — точное название темы из списка тем этого предмета (для mini, full, review — пустая строка). title — короткая формулировка задачи для ученика на «ты».
- Больше времени — слабым темам и блокам, но не забывай про пороги: история и профильные предметы минимум 5 баллов, грамотности минимум 3.
- Если до экзамена больше 365 дней, сначала укрепляй базу и темы текущего класса; в ближайшие недели используй мини-пробники вместо обязательных полных пробников. Не превращай долгую подготовку в финальный спринт.
- milestones — контрольные точки до выбранной сессии: месяц и год по-русски, целевой балл (реалистичный рост к цели), короткая заметка. Если дата ориентировочная, не выдавай её за официальное расписание.
- summary — 2–3 предложения стратегии, на «ты».
Используй только id предметов и темы из входных данных.`;

export async function entPlan(input: EntPlanInput): Promise<EntPlan> {
  if (!client) return demoEntPlan(input);
  const user = `Предметы ученика:\n${input.subjects.map((s) => `- ${s.id} (${s.name}, ${s.max} баллов): темы — ${s.topics.join("; ")}`).join("\n")}\n\nЦель: ${input.target} из 140\nКласс: ${input.grade ?? "не указан"}\nГод сдачи: ${input.examYear}\nСессия: ${input.sessionName}\nДата для планирования: ${input.examDate}${input.tentative ? " (ориентировочная)" : ""}\nДо выбранной сессии: ${input.daysLeft} дней\nЛучший полный пробник: ${input.best ?? "ещё не было"}\nПоследний пробник по блокам: ${input.last ? input.last.map((b) => `${b.id} ${b.points}/${b.max}`).join(", ") : "нет"}\nТочность в тренировках: ${Object.entries(
    input.accuracy,
  )
    .map(([k, v]) => `${k} ${v === null ? "нет данных" : v + "%"}`)
    .join(", ")}\nСлабые темы: ${input.weak.map((w) => `${w.subject}: ${w.topic} (${w.pct}%)`).join("; ") || "пока не определены"}\nПолных пробников пройдено: ${input.fullTests}`;
  const task = obj({ kind: { type: "string", enum: ["practice", "mini", "full", "review"] }, subject: S, topic: S, count: I, title: S });
  const out = await ask<Omit<EntPlan, "mode">>(ENT_PLAN_SYSTEM, user, obj({ summary: S, weeks: arr(obj({ week: I, focus: S, tasks: arr(task) })), milestones: arr(obj({ month: S, target: I, note: S })) }), "medium");
  const ids = new Set(input.subjects.map((s) => s.id));
  const topicsOf = Object.fromEntries(input.subjects.map((s) => [s.id, new Set(s.topics)]));
  return {
    summary: out.summary,
    weeks: out.weeks.slice(0, 4).map((w, i) => ({
      week: i + 1,
      focus: w.focus,
      tasks: w.tasks
        .filter((t) => t.kind === "full" || ids.has(t.subject))
        .map((t) => ({ ...t, topic: t.kind === "practice" && topicsOf[t.subject]?.has(t.topic) ? t.topic : "", count: clamp(Math.round(t.count) || 10, 1, 60) })),
    })),
    milestones: out.milestones.slice(0, 8).map((m) => ({ ...m, target: clamp(Math.round(m.target), 0, 140) })),
    mode: "ai",
  };
}

function demoEntPlan(input: EntPlanInput): EntPlan {
  const ranked = [...input.subjects].sort((a, b) => (input.accuracy[a.id] ?? 0) - (input.accuracy[b.id] ?? 0));
  const weeks = [0, 1, 2, 3].map((w) => {
    const a = ranked[w % ranked.length]!;
    const b = ranked[(w + 1) % ranked.length]!;
    const tasks: EntPlanTask[] = [
      { kind: "practice", subject: a.id, topic: a.topics[w % a.topics.length] ?? "", count: 15, title: `Тренировка: ${a.name}` },
      { kind: "practice", subject: b.id, topic: b.topics[w % b.topics.length] ?? "", count: 10, title: `Тренировка: ${b.name}` },
      { kind: "review", subject: a.id, topic: "", count: 20, title: "Повтор ошибок 20 минут" },
      input.daysLeft <= 365 && w % 2 === 0 ? { kind: "full", subject: "", topic: "", count: 1, title: "Полный пробный ЕНТ" } : { kind: "mini", subject: a.id, topic: "", count: 1, title: `Мини-пробник: ${a.name}` },
    ];
    return { week: w + 1, focus: `${a.name} и ${b.name}`, tasks };
  });
  return { summary: `${input.grade ? `${input.grade}-й класс. ` : ""}Готовимся к ЕНТ ${input.examYear}: ${input.sessionName.toLowerCase()} сессия${input.tentative ? " (срок ориентировочный)" : ""}. ${input.daysLeft > 365 ? "Времени больше года: укрепляй базу и темы текущего класса, проверяй прогресс мини-пробниками." : "Начни со слабых предметов, повторяй ошибки каждую неделю и проходи полный пробник раз в две недели."} Это базовый план без ИИ.`, weeks, milestones: [], mode: "demo" };
}

// ---------- weekly report for parents ----------

const PARENT_SYSTEM = `Ты куратор школы BSTS и пишешь родителю короткий еженедельный отчёт об учёбе ребёнка на платформе. Тон тёплый, уважительный, на «вы», без жаргона. 4–6 предложений: что ребёнок сделал за неделю (конкретные цифры), что получилось хорошо, где есть риск (пропуски, низкие пороги ЕНТ, невыполненные задания), и одна конкретная рекомендация, как родитель может поддержать на следующей неделе. Не выдумывай данных, которых нет. Не используй Markdown.`;

export async function parentSummary(data: unknown, childName: string): Promise<string> {
  if (!client) return `${childName}: данные за неделю по ЕНТ, SAT, заданиям учителя и консультациям собраны ниже. Демо-режим: с подключённым Claude здесь будет короткий отчёт простыми словами.`;
  const out = await ask<{ text: string }>(PARENT_SYSTEM, `Имя ребёнка: ${childName}\nДанные за неделю (JSON):\n${JSON.stringify(data)}`, obj({ text: S }), "low");
  return out.text;
}

// ---------- written work from photos ----------

export interface WrittenResult {
  transcript: string;
  criteria: { name: string; points: number; max: number; comment: string }[];
  score: number;
  feedback: string;
  unreadable: boolean;
  mode: "ai" | "demo";
}

const WRITTEN_SYSTEM = `Ты помогаешь учителю школы BSTS проверять письменные работы по фотографиям тетрадей. Внимательно прочитай рукописный текст и решения на фото.
- transcript — расшифровка решения ученика (как написано, с формулами в LaTeX между $...$), по шагам.
- criteria — оценка по критериям учителя: для каждого критерия name, points (можно половинки), max и короткий comment, что верно и где ошибка. Если критерии не заданы, используй разумные: правильность ответа, ход решения, оформление.
- score — сумма баллов, не больше максимума работы.
- feedback — 2–4 предложения ученику на «ты»: что получилось, где ошибка, что повторить.
- unreadable — true, если фото нечитаемые или на них не решение; тогда score 0 и объясни в feedback.
Ставь баллы строго по видимому решению, ничего не додумывай. Это предварительная оценка: учитель её проверит.`;

export async function writtenGrade(input: { title: string; task: string; criteria: string; max: number; images: { mime: string; data: string }[] }): Promise<WrittenResult> {
  if (!client)
    return { transcript: "Демо-режим: расшифровка фото работает с подключённым Claude.", criteria: [], score: 0, feedback: "Подключите Claude, чтобы ИИ проверял работы по фото.", unreadable: false, mode: "demo" };
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  input.images.forEach((img, i) => {
    content.push({ type: "text", text: `Фото ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mime as "image/jpeg", data: img.data } });
  });
  content.push({ type: "text", text: `Работа: ${input.title}\nЗадание: ${input.task || "смотри на фото"}\nКритерии учителя: ${input.criteria || "не заданы"}\nМаксимум баллов: ${input.max}` });
  const out = await ask<Omit<WrittenResult, "mode">>(
    WRITTEN_SYSTEM,
    content,
    obj({ transcript: S, criteria: arr(obj({ name: S, points: N, max: N, comment: S })), score: N, feedback: S, unreadable: { type: "boolean" } }),
    "medium",
  );
  return { ...out, score: clamp(Math.round(out.score * 2) / 2, 0, input.max), mode: "ai" };
}

// ---------- school report for the head of studies ----------

const SCHOOL_SYSTEM = `Ты аналитик школы BSTS. По сводке платформы за период напиши завучу 5–7 коротких пунктов (каждый с новой строки, начинается с «— »): общая картина, лучшие и отстающие классы с цифрами, риски (неактивные ученики, низкие баллы ЕНТ, невыполненные задания), что стоит сделать на этой неделе. Только факты из данных, без Markdown-разметки, кроме «— ».`;

export async function schoolSummary(data: unknown): Promise<{ text: string; mode: "ai" | "demo" }> {
  if (!client) return { text: "— Демо-режим: с подключённым Claude здесь будут выводы по классам и рискам.", mode: "demo" };
  const out = await ask<{ text: string }>(SCHOOL_SYSTEM, JSON.stringify(data), obj({ text: S }), "low");
  return { text: out.text, mode: "ai" };
}

// ---------- Telegram study assistant ----------

const BOT_SYSTEM = `Ты — ИИ-помощник учебной платформы 365step в Telegram. С тобой говорит {who}.

О чём говорить: только учёба — школьные предметы, университетские направления (от бизнеса и права до медицины, науки, искусства и инженерии), ЕНТ, SAT, IELTS, олимпиады, поступление, как учиться и планировать время, мотивация к учёбе{parentTopic}. На любые другие темы (развлечения, агитация, личные советы не про учёбу, просьбы написать что-то не для учёбы) вежливо откажи одной фразой и предложи вернуться к учёбе.

Честность — главное правило:
- Не выдумывай факты, формулы, даты, баллы, пороги и правила экзаменов. Если не уверен, скажи прямо «не уверен» и подскажи, где проверить: учебник, учитель, testcenter.kz для ЕНТ, collegeboard.org для SAT, ielts.org для IELTS.
- Данные платформы ниже — единственный источник об успехах ученика. Если данных нет или их мало, так и скажи, ничего не додумывай. Не приукрашивай и не пугай: называй сильные стороны и проблемы как есть.
- Ты ИИ и можешь ошибаться; в сложных расчётах проверяй себя и показывай шаги.
{studentRule}
Формат: обычный текст для Telegram, без Markdown (никаких **, #, таблиц), короткие абзацы, списки через «—», формулы обычным текстом (x^2, √, ≤). Отвечай на языке собеседника (русский, казахский или английский). Обычно до 1200 знаков; подробнее — только если просят.`;

const BOT_STUDENT = `- Основная цель платформы — подготовка к ЕНТ, SAT и IELTS. Данные learning содержат дополнительное направление по интересам: оно не заменяет подготовку к экзаменам и не ограничивает доступ к другим разделам. Учебный анализ политики, экономики и права в соответствующем направлении допустим. Не выдавай вводный практикум за полный университетский курс или официальную экзаменационную подготовку.
- Ты репетитор, а не решебник: объясняй так, чтобы ученик понял сам. На домашнее задание дай разбор, подсказку и первый шаг, полный ответ — когда ученик уже попробовал или просит проверить своё решение. Если ученик пишет, что сейчас идёт контрольная или экзамен, не помогай с заданиями.
- По фото задачи: сначала перепиши условие, как ты его прочитал; если фото нечитаемое, попроси переснять.
`;

export interface BotTurn {
  role: "user" | "assistant";
  text: string;
}

export async function botReply(input: { who: "student" | "parent"; context: unknown; history: BotTurn[]; text: string; images: { mime: string; data: string }[] }): Promise<string> {
  if (!client) return "Демо-режим: ИИ-помощник заработает, когда школа подключит Claude.";
  const system = BOT_SYSTEM.replace("{who}", input.who === "student" ? "ученик" : "родитель ученика")
    .replace("{parentTopic}", input.who === "parent" ? ", успеваемость ребёнка по данным платформы и как родителю поддержать учёбу" : "")
    .replace("{studentRule}", input.who === "student" ? BOT_STUDENT : "");
  const content: Anthropic.Beta.BetaContentBlockParam[] = input.images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mime as "image/jpeg", data: img.data } }));
  content.push({ type: "text", text: input.text || "Посмотри фото." });
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Данные платформы на ${new Date().toISOString().slice(0, 10)} (JSON):\n${JSON.stringify(input.context)}` },
    { role: "assistant", content: "Понял, учту эти данные." },
    ...input.history.map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content },
  ];
  await consumeAi();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);
  if (response.stop_reason === "refusal") return "С этим я помочь не могу. Давай вернёмся к учёбе — спроси про любой предмет, ЕНТ, SAT или IELTS.";
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text.trim();
  return text || "Не получилось ответить, попробуй переформулировать вопрос.";
}

// ---------- tool-using assistant (teachers in Telegram) ----------

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Manual tool loop: our platform tools run on the server, web search and fetch run on Anthropic's side.
 * Returns the final text; `run` executes one platform tool and returns its JSON result.
 */
export async function agentReply(input: {
  system: string;
  history: BotTurn[];
  content: Anthropic.Beta.BetaContentBlockParam[];
  tools: AgentTool[];
  run: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  web: number;
  effort: Effort;
}): Promise<string> {
  if (!client) return "Демо-режим: ИИ-помощник учителя заработает, когда школа подключит Claude.";
  const tools = [
    ...input.tools.map((t) => ({ ...t, strict: true })),
    ...(input.web
      ? [
          { type: "web_search_20260209", name: "web_search", max_uses: input.web },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: input.web },
        ]
      : []),
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [...input.history.map((h) => ({ role: h.role, content: h.text })), { role: "user", content: input.content }];
  await consumeAi();
  for (let step = 0; step < 12; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: input.effort },
      system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (response.stop_reason === "refusal") return "С этим я помочь не могу. Давайте вернёмся к учёбе и урокам.";
    messages.push({ role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
    if (response.stop_reason === "pause_turn") continue;
    const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || !calls.length) {
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return text || "Готово.";
    }
    const results = await Promise.all(
      calls.map(async (c) => {
        try {
          return { type: "tool_result" as const, tool_use_id: c.id, content: JSON.stringify(await input.run(c.name, c.input as Record<string, unknown>)) };
        } catch (err) {
          return { type: "tool_result" as const, tool_use_id: c.id, content: (err as Error).message, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }
  return "Задача оказалась слишком длинной. Разбейте её на части, пожалуйста.";
}

// ---------- algorithm problems: review after solving and mock interview ----------

export interface CodeReviewResult {
  time: string;
  space: string;
  verdict: "optimal" | "good" | "slow";
  summary: string;
  good: string[];
  improve: string[];
  alternative: string;
  mode: "ai" | "demo";
}

const CODE_REVIEW_SYSTEM = `Ты ревьюер решений алгоритмических задач в школе BSTS, говоришь с учеником на «ты», по-русски, кратко и честно.
Оцени решение ученика:
- time и space — асимптотика его кода в нотации O(...) с переменными из условия (n — длина массива и т.п.);
- verdict: optimal — лучшая известная асимптотика, good — приемлемо для ограничений, slow — не уложится в ограничения или есть явно лучший подход;
- summary — 1–2 предложения: как работает его решение;
- good — 1–3 сильные стороны (конкретно по коду);
- improve — 0–3 конкретных улучшения (читаемость, лишние проходы, крайние случаи, асимптотика);
- alternative — другой подход словами (2–4 предложения, без полного кода), например более быстрый или более простой; если решение уже оптимально — альтернативная идея или как это спросят на собеседовании.
Не выдумывай ошибок: тесты решение уже прошло. Markdown только для \`кода\`.`;

export async function codeReview(p: CodingProblem, lang: string, code: string): Promise<CodeReviewResult> {
  if (!client)
    return { time: "—", space: "—", verdict: "good", summary: "Демо-режим: с подключённым Claude здесь будет разбор асимптотики и стиля.", good: [], improve: [], alternative: p.hints.at(-1) ?? "", mode: "demo" };
  const out = await ask<Omit<CodeReviewResult, "mode">>(
    CODE_REVIEW_SYSTEM,
    `Задача «${p.title}» (${p.difficulty}): ${p.statement}\nОграничения: ${p.constraints.join("; ")}\nЯзык: ${lang}\nРешение ученика (прошло все тесты):\n\`\`\`\n${code}\n\`\`\``,
    obj({ time: S, space: S, verdict: { type: "string", enum: ["optimal", "good", "slow"] }, summary: S, good: arr(S), improve: arr(S), alternative: S }),
    "medium",
  );
  return { ...out, mode: "ai" };
}

const INTERVIEW_SYSTEM = `Ты интервьюер на техническом собеседовании (как в больших IT-компаниях), а кандидат — школьник, который тренируется. Говори по-русски, дружелюбно, коротко: 1–4 предложения за реплику.
Как вести собеседование:
1. Сначала попроси рассказать идею решения своими словами, уточнить входные данные и крайние случаи.
2. Задавай наводящие вопросы, но НЕ давай готовое решение и не пиши код за кандидата. Если он застрял надолго — дай маленькую подсказку-направление.
3. Когда идея есть — попроси оценить сложность по времени и памяти, спроси про крайние случаи (пустой ввод, повторы, большие числа).
4. Если в коде видишь ошибку — не называй её прямо, а предложи прогнать конкретный пример.
5. Когда кандидат закончил (или попросил итог) — дай оценку по 4 пунктам: понимание задачи, алгоритм, сложность, коммуникация — каждый от 1 до 5 с одной фразой, и общий совет.
Не отвлекайся на темы вне задачи.`;

export async function interviewReply(p: CodingProblem, lang: string, code: string, history: { role: "user" | "assistant"; text: string }[], minutes: number): Promise<{ reply: string; mode: "ai" | "demo" }> {
  if (!client) return { reply: "Демо-режим: расскажи идею решения, и с подключённым Claude я задам уточняющие вопросы как на собеседовании.", mode: "demo" };
  const context = `Задача «${p.title}» (${p.difficulty}): ${p.statement}\nОграничения: ${p.constraints.join("; ")}\nПрошло минут: ${minutes}\nТекущий код кандидата (${lang}):\n\`\`\`\n${code.slice(0, 6000)}\n\`\`\``;
  const turns = history.slice(-16);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `${context}\n\n${turns[0]?.role === "user" ? turns[0].text : "Начнём собеседование."}` },
    ...turns.slice(turns[0]?.role === "user" ? 1 : 0).map((t) => ({ role: t.role, content: t.text })),
  ];
  if (messages.at(-1)!.role === "assistant") messages.push({ role: "user", content: "(кандидат молчит — продолжи)" });
  await consumeAi();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [{ type: "text", text: INTERVIEW_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages,
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text.trim();
  return { reply: text || "Продолжай, я слушаю.", mode: "ai" };
}

// ---------- AI CAD designer: words or a sketch photo → replicad code ----------

const CAD_SYSTEM = `Ты инженер-конструктор и пишешь параметрические CAD-модели кодом на библиотеке replicad (ядро OpenCascade) для школьников.
Верни поле code — полный JavaScript: константы-параметры наверху (размеры в мм с понятными именами и комментариями на русском), затем function main(r) { ... return тело; }. Ось Z вверх, деталь стоит на плоскости XY (низ на z = 0), центрирована по X и Y.
Доступно только через r (никаких import):
- эскизы: r.drawRectangle(w, h), r.drawRoundedRectangle(w, h, radius), r.drawCircle(radius), r.drawPolysides(radius, sides), r.draw([x, y]).lineTo([x, y]).hLine(dx).vLine(dy).smoothSplineTo([x, y]).close();
- эскиз в тело: .sketchOnPlane() (XY) или .sketchOnPlane("XZ") и затем .extrude(h) или .revolve() (вокруг оси Z для XZ);
- тела: r.makeBaseBox(x, y, z) (низ на z=0, центр по XY), r.makeCylinder(radius, h, [x, y, z], [dx, dy, dz]), r.makeSphere(radius);
- операции: a.fuse(b), a.cut(b), a.intersect(b), .translate(x, y, z), .rotate(deg, [cx, cy, cz], [ax, ay, az]), .mirror("YZ"), .fillet(radius) или .fillet(radius, (e) => e.inDirection("Z")), .chamfer(d), .shell(thickness, (f) => f.inPlane("XY", height));
- можно вернуть массив тел или { shape, color }.
Правила: сквозные отверстия делай цилиндром длиннее детали и начинай ниже нуля; радиус скругления меньше половины самой тонкой стенки; не используй несуществующие функции. Если пришло сообщение об ошибке построения — исправь код, сохранив замысел. Если есть фото эскиза — бери размеры с него, недостающие выбери разумно.
Поле explain — 2–4 предложения по-русски: из чего состоит деталь и какие параметры можно менять. Поле params — список главных параметров для ученика.
Поле expect — ожидаемые габариты готовой детали [X, Y, Z] в мм: по ним платформа проверит, что модель совпала с замыслом. Пиши компактно, без лишних комментариев.`;

export async function cadDesign(input: {
  prompt: string;
  code?: string;
  error?: string;
  image?: { mime: string; data: string };
  examples?: { prompt: string; code: string }[];
}): Promise<{ code: string; explain: string; params: string[]; expect: number[]; mode: "ai" | "demo" }> {
  if (!client)
    return {
      code: `function main(r) {\n  return r.makeBaseBox(40, 30, 10).fillet(2);\n}\n`,
      explain: "Демо-режим: с подключённым Claude здесь будет деталь по твоему описанию.",
      params: [],
      expect: [40, 30, 10],
      mode: "demo",
    };
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) content.push({ type: "image", source: { type: "base64", media_type: input.image.mime as "image/jpeg", data: input.image.data } });
  // Verified designs from the school's own library work as few-shot examples: the model picks up working API usage.
  let text = input.examples?.length
    ? `Проверенные примеры из библиотеки школы (задание → код, который построился и совпал по размерам):\n${input.examples.map((e) => `### ${e.prompt}\n\`\`\`js\n${e.code.slice(0, 2500)}\n\`\`\``).join("\n")}\n\n`
    : "";
  text += `Задание: ${input.prompt || "сделай деталь по фото эскиза"}`;
  if (input.code) text += `\n\nТекущий код:\n\`\`\`js\n${input.code.slice(0, 8000)}\n\`\`\``;
  if (input.error) text += `\n\nОшибка при построении: ${input.error.slice(0, 600)}\nИсправь.`;
  content.push({ type: "text", text });
  // Low effort for a first draft: a part is a short program and speed matters; a build error gets medium effort.
  const out = await ask<{ code: string; explain: string; params: string[]; expect: number[] }>(CAD_SYSTEM, content, obj({ code: S, explain: S, params: arr(S), expect: arr(N) }), input.error ? "medium" : "low");
  return { ...out, mode: "ai" };
}

// ---------- Arduino helper: explains errors and hints without solving the lesson ----------

const ARDUINO_SYSTEM = `Ты наставник по Arduino в школе BSTS, говоришь с учеником на «ты», по-русски, коротко (до 6 предложений).
Тебе дают задание урока, скетч ученика, ошибку компиляции или результат автопроверки и вопрос.
Объясни, что происходит и почему, и подскажи следующий шаг. Не пиши готовый исправленный скетч целиком — максимум одну-две строки как пример синтаксиса. Если вопрос про электрику (резисторы, ток, подтяжка), объясни физику простыми словами. Код и функции оформляй \`так\`.`;

export async function arduinoHelp(input: { lesson: string; task: string; code: string; status: string; question: string }): Promise<{ text: string; mode: "ai" | "demo" }> {
  if (!client) return { text: "Демо-режим: с подключённым Claude здесь будет объяснение ошибки и подсказка.", mode: "demo" };
  const out = await ask<{ text: string }>(
    ARDUINO_SYSTEM,
    `Урок: ${input.lesson}\nЗадание: ${input.task}\nСкетч:\n\`\`\`cpp\n${input.code.slice(0, 6000)}\n\`\`\`\nСостояние: ${input.status || "нет"}\nВопрос ученика: ${input.question || "что не так?"}`,
    obj({ text: S }),
    "low",
  );
  return { ...out, mode: "ai" };
}

// ---------- ENT master mode: hard problems with a typed answer ----------

const ENT_MASTER_SYSTEM = `Ты автор трудных оригинальных задач для подготовки к ЕНТ (Казахстан, программа 10–11 классов) повышенного уровня C и выше — для сильных учеников, которые целятся в 120+ баллов. Не воспроизводи реальные задания ЕНТ и задания из сборников.
Задача решается письменно, ответ ученик ВПИСЫВАЕТ сам (вариантов нет), поэтому:
- ответ однозначный и короткий: число (целое или десятичная дробь, можно обыкновенную дробь), слово, имя, термин, дата или формула химического вещества;
- accept — все допустимые записи ответа (например ["0.75", "3/4"], ["1941"], ["Абылай", "Абылай хан"]); для чисел достаточно одной записи;
- unit — единица измерения, если ответ — величина (её не нужно вписывать), иначе пустая строка;
- задача многошаговая: 2–4 действия, ловушка для невнимательных, но без двусмысленности; все данные в условии;
- solution — решение по шагам (3–6 коротких шагов), формулы в LaTeX между $...$;
- level — "C" (повышенный) или "D" (олимпиадный);
- факты только достоверные; если не уверен — выбери другую задачу.
Язык — как в запросе.`;

export interface EntMasterDraft {
  stem: string;
  accept: string[];
  unit: string;
  solution: string;
  level: "C" | "D";
}

export async function entMasterGenerate(subject: { name: string }, topic: string, count: number, lang: string): Promise<EntMasterDraft[]> {
  if (!client) return [];
  const out = await ask<{ items: EntMasterDraft[] }>(
    ENT_MASTER_SYSTEM,
    `Предмет: ${subject.name}\nТема: ${topic}\nКоличество задач: ${count}\nЯзык: ${lang === "kk" ? "казахский" : lang === "en" ? "английский" : "русский"}`,
    obj({ items: arr(obj({ stem: S, accept: arr(S), unit: S, solution: S, level: { type: "string", enum: ["C", "D"] } })) }),
    "medium",
  );
  return out.items.filter((x) => x.stem && x.accept.length).slice(0, count);
}

// ---------- admissions: essay coach and activity list ----------
// The coach never writes the essay: it asks questions, helps outline the student's own ideas and gives feedback.
// Common App treats submitting AI-generated substantive content as one's own as fraud, so we keep to coaching.

export type EssayKind = "common-app" | "why-us" | "ucas" | "motivation";

export interface EssayFeedback {
  overall: string;
  scores: { name: string; score: number; comment: string }[];
  comments: { quote: string; comment: string }[];
  questions: string[];
  nextSteps: string[];
  mode: "ai" | "demo";
}

const ESSAY_SYSTEM = `Ты консультант по поступлению за рубеж и коуч по эссе для школьников из Казахстана. Ты НИКОГДА не пишешь и не переписываешь эссе за ученика: ни абзацев, ни предложений на замену. Ты только задаёшь вопросы, указываешь на места в тексте и объясняешь, что улучшить своими словами. Это требование честности: Common App считает выдачу текста ИИ за свой обманом.
Оцени черновик по рубрике (score 1–5): «Крючок и начало», «Конкретика (show, don't tell)», «Рефлексия и рост», «Свой голос», «Структура», «Ответ на вопрос». Для «Why us» добавь «Знание вуза».
- overall: 2–3 предложения на «ты», честно и по-доброму, на русском.
- comments: 3–6 замечаний с точной короткой цитатой из текста (quote должен дословно встречаться в тексте) и что с ней сделать (без готовой замены).
- questions: 3–5 вопросов, которые помогут ученику достать детали из своей истории.
- nextSteps: 3 конкретных шага к следующему черновику.
Учитывай лимит слов: если превышен — скажи, что сократить. Не составляй план эссе и не переводи текст.`;

/** For students applying to universities that allow AI only for spelling and grammar (e.g. Brown). */
const GRAMMAR_SYSTEM = `Ты проверяешь орфографию, грамматику и пунктуацию в эссе школьника. Не оценивай содержание, не предлагай идей, структуры и формулировок по смыслу: в списке вузов ученика есть вуз, который разрешает ИИ только для проверки грамматики.
- overall: одно предложение о грамотности текста, по-русски.
- scores: один элемент {name: "Грамотность", score 1–5, comment}.
- comments: до 8 ошибок: quote — точная цитата с ошибкой из текста, comment — какое правило нарушено и как исправить это слово или знак.
- questions: пустой список.
- nextSteps: 1–2 шага про грамматику.`;

const LIMITS: Record<EssayKind, string> = {
  "common-app": "Common App personal statement, до 650 слов",
  "why-us": "Supplement «Why us», обычно 150–300 слов",
  ucas: "UCAS personal statement (3 вопроса, всего до 4000 знаков)",
  motivation: "Мотивационное письмо в европейский вуз, около 1 страницы",
};

export async function essayFeedback(kind: EssayKind, prompt: string, text: string, grammarOnly = false): Promise<EssayFeedback> {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!client) {
    return {
      overall: `Демо-режим без ключа ИИ: в тексте ${words} слов. Проверь, есть ли в начале конкретная сцена, а в конце — что ты понял о себе.`,
      scores: ["Крючок и начало", "Конкретика (show, don't tell)", "Рефлексия и рост", "Свой голос", "Структура", "Ответ на вопрос"].map((name) => ({ name, score: 3, comment: "Оценку даст ИИ, когда будет ключ." })),
      comments: [],
      questions: ["Какой момент ты помнишь в деталях — звуки, место, слова?", "Что ты сделал сам, а не команда?", "Что изменилось в тебе после этой истории?"],
      nextSteps: ["Начни с конкретной сцены", "Убери общие фразы вроде «я всегда любил»", "Допиши абзац о том, что ты понял"],
      mode: "demo",
    };
  }
  const out = await ask<Omit<EssayFeedback, "mode">>(
    grammarOnly ? GRAMMAR_SYSTEM : ESSAY_SYSTEM,
    `Тип: ${LIMITS[kind]}\nВопрос эссе: ${prompt || "не указан"}\nСлов в черновике: ${words}\n\nЧерновик ученика:\n${text}`,
    obj({ overall: S, scores: arr(obj({ name: S, score: I, comment: S })), comments: arr(obj({ quote: S, comment: S })), questions: arr(S), nextSteps: arr(S) }),
    "medium",
  );
  return { ...out, comments: out.comments.filter((c) => text.includes(c.quote)), mode: "ai" };
}

const BRAINSTORM_SYSTEM = `Ты коуч по эссе для поступления. Ученик ещё не написал текст: помоги ему самому найти историю. Не пиши эссе, не предлагай готовые предложения и не составляй план эссе (Caltech и Georgia Tech прямо запрещают ИИ-планы).
- questions: 6–8 вопросов, чтобы вспомнить конкретные истории (место, момент, выбор, ошибку, что изменилось).
- angles: 3 вопроса-направления для размышлений по заметкам ученика (например «что ты почувствовал, когда…?»), без готового текста и без структуры эссе.
Пиши по-русски, на «ты».`;

export async function essayBrainstorm(kind: EssayKind, prompt: string, notes: string): Promise<{ questions: string[]; angles: string[]; mode: "ai" | "demo" }> {
  if (!client) {
    return {
      questions: ["Когда ты в последний раз забыл о времени, потому что было интересно?", "Какую проблему ты решил сам, без подсказки?", "Что ты делаешь иначе, чем твои друзья?", "Какое решение далось тебе тяжело?"],
      angles: ["Какой проект сначала провалился и что ты сделал дальше?", "Какая привычка или хобби многое о тебе говорит?", "Какой человек или место изменили твой взгляд?"],
      mode: "demo",
    };
  }
  const out = await ask<{ questions: string[]; angles: string[] }>(BRAINSTORM_SYSTEM, `Тип: ${LIMITS[kind]}\nВопрос эссе: ${prompt || "не указан"}\nЗаметки ученика:\n${notes || "пока нет"}`, obj({ questions: arr(S), angles: arr(S) }), "low");
  return { ...out, mode: "ai" };
}

const ACTIVITY_SYSTEM = `Ты проверяешь описание внеучебной деятельности, которое ученик написал сам для раздела Activities в Common App. Ты НЕ пишешь и не переписываешь описание: только указываешь, что улучшить.
Лимиты Common App: роль до 50 знаков (с 2026–27 поле необязательное), организация до 100, описание до 150.
- verdict: одно предложение по-русски.
- issues: 1–4 замечания по-русски (лимит, нет глагола действия, нет цифр или результата, общие слова, факты не совпадают с фактами ученика).
- missing: 1–3 вопроса, на которые стоит ответить цифрами из фактов (часы, люди, результат).`;

export async function activityReview(facts: string, position: string, description: string): Promise<{ verdict: string; issues: string[]; missing: string[]; mode: "ai" | "demo" }> {
  const issues: string[] = [];
  if (position.length > 50) issues.push(`Роль длиннее 50 знаков (${position.length}).`);
  if (description.length > 150) issues.push(`Описание длиннее 150 знаков (${description.length}).`);
  if (!/\d/.test(description)) issues.push("Нет ни одной цифры: часы, люди, результат.");
  if (!client) return { verdict: "Демо-режим: проверил только лимиты и цифры.", issues, missing: ["Сколько часов в неделю?", "Какой измеримый результат?"], mode: "demo" };
  const out = await ask<{ verdict: string; issues: string[]; missing: string[] }>(ACTIVITY_SYSTEM, `Факты ученика:\n${facts}\n\nРоль: ${position}\nОписание: ${description}`, obj({ verdict: S, issues: arr(S), missing: arr(S) }), "low");
  return { ...out, issues: [...issues, ...out.issues], mode: "ai" };
}

// ---------- NUET: Nazarbayev University entrance test practice ----------

export type NuetSection = "math" | "ctps";

export interface NuetQuestion {
  id: string;
  section: NuetSection;
  topic: string;
  passage?: string;
  stem: string;
  options: string[];
  answer: number;
  explanation: string;
}

const NUET_SYSTEM = `You write original practice questions for NUET, the Nazarbayev University Entrance Test (Kazakhstan). Two sections, both in English: Mathematics (school algebra, geometry, functions, statistics and probability, word problems) and Critical Thinking & Problem Solving (arguments, assumptions and conclusions, logical deduction, reading data from tables, patterns, spatial and numerical reasoning). On the real test each section has 30 multiple-choice questions in 60 minutes, so a question should take about 2 minutes.
Never reproduce real or leaked NUET items or questions from published prep books: write new ones in the same style.
- Each question has exactly 4 options and one correct answer (answer = index 0–3). Distractors reflect typical mistakes.
- passage: only when the question needs a short text, an argument or a data table (write tables as plain text lines like "Year | Sales"); otherwise an empty string.
- Formulas in LaTeX between $...$.
- explanation: 1–3 sentences in Russian: why the answer is right and where the usual mistake is.
- Mix easy, medium and hard items.`;

const NUET_DEMO: Record<NuetSection, Omit<NuetQuestion, "id" | "section" | "topic">[]> = {
  math: [
    { stem: "A jacket costs 24 000 ₸ after a 20% discount. What was the original price?", options: ["28 800 ₸", "30 000 ₸", "29 000 ₸", "26 400 ₸"], answer: 1, explanation: "24 000 — это 80% цены, поэтому цена = 24 000 / 0,8 = 30 000. Частая ошибка — прибавить 20% к 24 000." },
    { stem: "If $3x - 7 = 2x + 5$, what is $x$?", options: ["-2", "12", "2", "-12"], answer: 1, explanation: "Переносим: 3x − 2x = 5 + 7, x = 12." },
    { stem: "The mean of five numbers is 8. Four of them are 6, 7, 9 and 10. What is the fifth?", options: ["8", "6", "9", "7"], answer: 0, explanation: "Сумма пяти чисел 40, известные дают 32, значит пятое 8." },
    { stem: "A right triangle has legs 6 and 8. What is the length of the hypotenuse?", options: ["10", "14", "12", "$\\sqrt{48}$"], answer: 0, explanation: "По теореме Пифагора $\\sqrt{36+64}=10$." },
    { stem: "A bag has 3 red and 5 blue balls. One ball is drawn at random. What is the probability it is red?", options: ["3/5", "3/8", "5/8", "1/3"], answer: 1, explanation: "Всего 8 шаров, красных 3: вероятность 3/8. Ошибка — делить на число синих." },
  ],
  ctps: [
    { passage: "All members of the robotics club can code. Aliya can code.", stem: "Which conclusion follows for certain?", options: ["Aliya is in the robotics club", "Aliya is not in the robotics club", "It cannot be determined whether Aliya is in the club", "Nobody outside the club can code"], answer: 2, explanation: "Из «все члены клуба умеют программировать» не следует, что все, кто умеет, — в клубе." },
    { stem: "What number comes next: 2, 6, 12, 20, 30, ?", options: ["40", "42", "36", "44"], answer: 1, explanation: "Разности 4, 6, 8, 10, дальше 12: 30 + 12 = 42." },
    { passage: "Month | Visitors\nJan | 1200\nFeb | 1500\nMar | 1800", stem: "If the trend continues, how many visitors will there be in May?", options: ["2100", "2400", "2700", "2000"], answer: 1, explanation: "Каждый месяц +300: апрель 2100, май 2400." },
    { passage: "Since the school introduced a longer lunch break, test scores have risen. So the longer break caused the higher scores.", stem: "Which statement, if true, most weakens the argument?", options: ["Students like the longer break", "The school also hired three new maths teachers that year", "Test scores rose in many schools", "The break is 15 minutes longer"], answer: 1, explanation: "Другая возможная причина роста баллов (новые учителя) ослабляет вывод о причинности." },
    { stem: "Dana sits to the left of Erlan, and Erlan sits to the left of Bota. Who cannot be in the rightmost seat of the row?", options: ["Bota", "Dana", "Someone other than these three", "Any of them can"], answer: 1, explanation: "Дана левее Ерлана, значит она точно не крайняя справа." },
  ],
};

export async function nuetGenerate(section: NuetSection, topic: string, count: number): Promise<Omit<NuetQuestion, "id">[]> {
  if (!client) return NUET_DEMO[section].map((q) => ({ ...q, section, topic }));
  const out = await ask<{ items: { passage: string; stem: string; options: string[]; answer: number; explanation: string }[] }>(
    NUET_SYSTEM,
    `Section: ${section === "math" ? "Mathematics" : "Critical Thinking & Problem Solving"}\nTopic: ${topic}\nNumber of questions: ${count}`,
    obj({ items: arr(obj({ passage: S, stem: S, options: arr(S), answer: I, explanation: S })) }),
    "medium",
  );
  return out.items
    .filter((x) => x.stem && x.options.length === 4 && x.answer >= 0 && x.answer <= 3)
    .map((x) => ({ section, topic, ...(x.passage?.trim() ? { passage: x.passage.trim() } : {}), stem: x.stem, options: x.options, answer: x.answer, explanation: x.explanation }));
}
