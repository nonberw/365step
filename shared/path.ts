// Duolingo-style learning path: courses split into units, units into nodes the student walks through.

export type CourseId = "sat-math" | "sat-rw" | "ielts-reading" | "ent" | "nuet" | "code";

export const COURSES: Record<CourseId, { title: string; short: string; emoji: string }> = {
  "sat-math": { title: "SAT Math", short: "Math", emoji: "📐" },
  "sat-rw": { title: "SAT Reading & Writing", short: "R&W", emoji: "📖" },
  "ielts-reading": { title: "IELTS Reading", short: "IELTS", emoji: "🎧" },
  ent: { title: "ЕНТ", short: "ЕНТ", emoji: "🏛️" },
  nuet: { title: "NUET · Nazarbayev University", short: "NUET", emoji: "🎯" },
  code: { title: "Программирование", short: "Код", emoji: "💻" },
};

export type NodeKind = "lesson" | "review" | "chest";
export type NodeStatus = "done" | "current" | "locked";

export interface PathNode {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle: string;
  /** crowns earned: 0–3 for lessons and reviews, 0–1 for chests */
  level: number;
  maxLevel: number;
  status: NodeStatus;
  /** set for nodes done outside the lesson screen (coding problems in the editor) */
  href?: string;
}

export interface PathUnit {
  id: string;
  title: string;
  description: string;
  color: string;
  nodes: PathNode[];
}

export interface PathQuest {
  id: string;
  title: string;
  value: number;
  goal: number;
}

export interface PathView {
  course: CourseId;
  units: PathUnit[];
  /** shown above the path, e.g. how to pick ENT profile subjects */
  note?: string;
  currentNodeId: string | null;
  done: number;
  total: number;
  todayXp: number;
  dailyGoal: number;
  streak: number;
  quests: PathQuest[];
}

/** What the client sees of a lesson item before answering. */
export interface LessonItem {
  id: string;
  kind: "choice" | "input";
  passage?: string;
  passageTitle?: string;
  stem: string;
  /** code snippet shown under the question (coding warm-ups) */
  code?: string;
  choices?: string[];
}

export interface LessonStart {
  lessonId: string;
  title: string;
  level: number;
  items: LessonItem[];
}

export interface AnswerResult {
  correct: boolean;
  /** the right answer as text, shown in the red sheet */
  answer: string;
  explanation: string;
}

export interface LessonResult {
  xp: number;
  firstTry: number;
  total: number;
  perfect: boolean;
  level: number;
  maxLevel: number;
}

export const UNIT_COLORS = ["#2f5bc8", "#9b5cf6", "#ff9600", "#1cb0f6", "#ff4b4b", "#2bb673", "#ce82ff", "#ff6fb1"];

/** Russian names for SAT skills (the bank keeps the College Board names). */
export const SKILL_RU: Record<string, string> = {
  Boundaries: "Границы предложений",
  "Central Ideas and Details": "Главная мысль и детали",
  "Cross-Text Connections": "Связь двух текстов",
  "Form, Structure, and Sense": "Форма и согласование",
  Inferences: "Выводы из текста",
  "Command of Evidence (Quantitative)": "Данные: графики и таблицы",
  "Command of Evidence (Textual)": "Доказательства в тексте",
  "Rhetorical Synthesis": "Синтез заметок",
  "Text Structure and Purpose": "Структура и цель текста",
  Transitions: "Связки",
  "Words in Context": "Слова в контексте",
  "Area and volume": "Площадь и объём",
  Circles: "Окружности",
  "Equivalent expressions": "Равносильные выражения",
  "Linear inequalities": "Линейные неравенства",
  "Linear equations in one variable": "Уравнения с одной переменной",
  "Linear equations in two variables": "Уравнения с двумя переменными",
  "Linear functions": "Линейные функции",
  "Lines, angles, and triangles": "Прямые, углы, треугольники",
  "Nonlinear equations": "Нелинейные уравнения",
  "Nonlinear functions": "Нелинейные функции",
  "One-variable data": "Данные одной переменной",
  Percentages: "Проценты",
  Probability: "Вероятность",
  "Ratios, rates, and units": "Пропорции и единицы",
  "Right triangles": "Прямоугольные треугольники",
  "Right triangle trigonometry": "Тригонометрия",
  "Sample statistics": "Выборка и погрешность",
  "Statistical claims": "Статистические выводы",
  "Systems of linear equations": "Системы уравнений",
  "Two-variable data": "Данные двух переменных",
  "Quadratic functions": "Квадратичные функции",
  "Exponential models": "Экспоненциальные модели",
  "Linear models": "Линейные модели",
  "Subject-Verb Agreement": "Согласование подлежащего",
};

export const LESSON_SIZE = 8;
