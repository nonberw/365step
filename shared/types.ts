// Shared between server and client.

export type Role = "student" | "teacher";
export type Campus = "online" | "zhandosov" | "campus2" | "campus3";
import type { PlantSpecies } from "./plants";
export type PlanId = "free" | "pro";
export type TeacherTitle = "mr" | "ms" | "mrs";

export const CAMPUSES: Record<Campus, string> = {
  online: "Онлайн",
  zhandosov: "Главный кампус",
  campus2: "Второй кампус",
  campus3: "Третий кампус",
};

export const TITLES: Record<TeacherTitle, string> = {
  mr: "Мистер",
  ms: "Мисс",
  mrs: "Миссис",
};

export interface Goals {
  sat?: { target: number; date: string; current?: number };
  ielts?: { target: number; date: string; current?: number };
  coding?: boolean;
  nuet?: boolean;
  /** Answers from the onboarding questions. */
  dailyMinutes?: number;
  hardest?: string;
  university?: string;
  /** Where the student applies and what to study (B2C onboarding). */
  country?: string;
  major?: string;
  /** ENT target score out of 140 */
  ent?: { target: number; date?: string; session?: string; year?: number; tentative?: boolean };
  /** self-assessed level from the onboarding quiz */
  level?: "beginner" | "middle" | "advanced";
}

export interface PublicUser {
  learningProfile: import("./directions").LearningProfile;
  id: string;
  role: Role;
  email: string;
  firstName: string;
  lastName: string;
  title: TeacherTitle | null;
  grade: number | null;
  classLetter: string | null;
  campus: Campus;
  subjects: string[];
  goals: Goals;
  interests: string[];
  classCodes: string[];
  createdAt: number;
  /** Subscription: free, or pro while planUntil is in the future */
  plan: PlanId;
  planUntil: number | null;
  trialUsed: boolean;
  /** The chosen study companion and the XP that grows it */
  plant: PlantSpecies | null;
  xp: number;
  /** days in a row with XP */
  streak: number;
  /** Head of studies: sees the school report */
  isAdmin?: boolean;
}

// ---------- lessons (vibe coding) ----------

export type Grade = "1-4" | "5-6" | "7-8" | "9-10" | "11";

export type LessonTrack = "games" | "web" | "science" | "engineering" | "product" | "critical";

export interface Lesson {
  id: string;
  order: number;
  grade: Grade;
  track?: LessonTrack;
  /** suggested small steps to build the app with the AI */
  steps?: string[];
  title: string;
  task: string;
  objective: string;
  skills: string[];
  starter: string;
  rubric: string[];
  xp: number;
}

export interface PromptEntry {
  at: number;
  text: string;
  reply: string;
  mode: "ai" | "demo";
}

export interface Review {
  at: number;
  score: number;
  strengths: string[];
  fixes: string[];
  mode: "ai" | "demo";
}

export interface Work {
  lessonId: string;
  code: string;
  prompts: PromptEntry[];
  submittedAt: number | null;
  review: Review | null;
  teacherGrade: number | null;
  teacherComment: string;
}

export type LockEventType = "left" | "returned" | "unlocked";
export interface LockEvent {
  at: number;
  type: LockEventType;
}

export interface BlitzQuestion {
  id: string;
  skill: string;
  level: 1 | 2 | 3;
  question: string;
  code: string;
  options: string[];
  answer: number;
  why: string;
}

// ---------- SAT ----------

export type SatSection = "rw" | "math";
export type SatDomain =
  | "Information and Ideas"
  | "Craft and Structure"
  | "Expression of Ideas"
  | "Standard English Conventions"
  | "Algebra"
  | "Advanced Math"
  | "Problem-Solving and Data Analysis"
  | "Geometry and Trigonometry";

export const SAT_DOMAINS: Record<SatSection, SatDomain[]> = {
  rw: ["Information and Ideas", "Craft and Structure", "Expression of Ideas", "Standard English Conventions"],
  math: ["Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry"],
};

export const DOMAIN_RU: Record<SatDomain, string> = {
  "Information and Ideas": "Информация и идеи",
  "Craft and Structure": "Структура и лексика",
  "Expression of Ideas": "Выражение идей",
  "Standard English Conventions": "Грамматика и пунктуация",
  Algebra: "Алгебра",
  "Advanced Math": "Продвинутая математика",
  "Problem-Solving and Data Analysis": "Задачи и анализ данных",
  "Geometry and Trigonometry": "Геометрия и тригонометрия",
};

export type Difficulty = 1 | 2 | 3;
export const DIFFICULTY_RU: Record<Difficulty, string> = { 1: "Лёгкий", 2: "Средний", 3: "Сложный" };

export interface SatQuestion {
  id: string;
  section: SatSection;
  domain: SatDomain;
  skill: string;
  difficulty: Difficulty;
  passage?: string;
  stem: string;
  /** Multiple choice. Absent for student-produced response (grid-in). */
  choices?: string[];
  /** Index for multiple choice, string value for grid-in. */
  answer: number | string;
  explanation: string;
  source: "bank" | "generated" | "ai";
  attribution?: { sourceId: string; locator: string; changes: string; license?: string; licenseUrl?: string; download?: string; sourceUrl?: string };
  numericRule?: import("./numeric").NumericRule;
  acceptedAnswers?: string[];
  subjectHead?: string;
  familyId?: string;
  canonicalId?: string;
  purpose?: "warmup" | "reinforcement" | "assessment";
  difficultyReview?: { basis: "editorial"; previous: Difficulty; reason: string };
}

/** What the client sees before answering. */
export type SatQuestionPublic = Omit<SatQuestion, "answer" | "explanation" | "acceptedAnswers">;

export interface SatQuestionSummary {
  id: string;
  section: SatSection;
  domain: SatDomain;
  skill: string;
  difficulty: Difficulty;
  purpose?: SatQuestion["purpose"];
  preview: string;
  status: "new" | "correct" | "wrong";
  saved: boolean;
}

export interface SatModuleState {
  section: SatSection;
  module: 1 | 2;
  level: "base" | "easy" | "hard";
  questionIds: string[];
  answers: Record<string, string | number | null>;
  correct: number | null;
  seconds: number;
}

export interface SatTestState {
  id: string;
  startedAt: number;
  finishedAt: number | null;
  modules: SatModuleState[];
  /** short: 46 questions; full: 98, like the real test. */
  mode?: "short" | "full";
  current: number;
  rwScore: number | null;
  mathScore: number | null;
}

// ---------- vocabulary ----------

export interface VocabWord {
  id: string;
  word: string;
  pos: string;
  definition: string;
  ru: string;
  example: string;
  similar: string[];
}

export interface VocabUnit {
  id: string;
  title: string;
  topic: string;
  text: string;
  words: VocabWord[];
}

// ---------- IELTS ----------

export interface IeltsCriterion {
  name: string;
  band: number | null;
  comment: string;
}

export interface WritingAnnotation {
  quote: string;
  kind: "error" | "good";
  category: string;
  comment: string;
  fix?: string;
}

export interface WritingResult {
  overall: number | null;
  criteria: IeltsCriterion[];
  annotations: WritingAnnotation[];
  plan: string[];
  predicted: number | null;
  wordCount: number;
  mode: "ai" | "demo";
}

export interface SpeakingResult {
  overall: number | null;
  criteria: IeltsCriterion[];
  feedback: string[];
  plan: string[];
  predicted: number | null;
  wordsPerMinute: number;
  mode: "ai" | "demo";
}

export interface IeltsChoiceQuestion {
  id: string;
  kind: "tfng" | "mcq" | "gap" | "headings";
  text: string;
  options?: string[];
  maxWords?: number;
  headingGroup?: { id: string; instruction: string; options: { value: string; text: string }[]; reuse: boolean };
}

// ---------- coding ----------

export type CodeLang = "javascript" | "python";

export type ProblemPattern = "arrays" | "pointers" | "window" | "stack" | "binsearch" | "intervals" | "trees" | "graphs" | "backtracking" | "dp" | "greedy" | "math";

export interface CodingProblem {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  pattern: ProblemPattern;
  tags: string[];
  statement: string;
  examples: { input: string; output: string; explain?: string }[];
  constraints: string[];
  fn: { js: string; py: string };
  params: string[];
  starter: Record<CodeLang, string>;
  tests: { args: unknown[]; expected: unknown }[];
  /** How many of `tests` are shown as public examples. */
  visible: number;
  hints: string[];
  /** Compare ignoring order of the top-level array. */
  unordered?: boolean;
  unorderedInner?: boolean;
}

// ---------- dashboards ----------

export interface Assignment {
  id: string;
  classCode: string;
  title: string;
  kind: "sat-test" | "sat-practice" | "ielts-writing" | "ielts-speaking" | "coding" | "lesson" | "vocab" | "ent-full" | "ent-subject";
  ref: string;
  dueAt: number | null;
  createdAt: number;
  done?: boolean;
}

export interface LeaderRow {
  name: string;
  meta: string;
  monthXp: number;
  streak: number;
  isMe: boolean;
}

export interface WeakSpot {
  area: "sat" | "ielts" | "coding";
  label: string;
  pct: number;
  attempts: number;
  href: string;
}

export interface PlanTask {
  id: string;
  title: string;
  detail: string;
  href: string;
  done: boolean;
  kind: "sat" | "ielts" | "coding" | "vocab" | "assignment";
}

export interface StudentDashboard {
  user: PublicUser;
  xp: number;
  monthXp: number;
  streak: number;
  bestStreak: number;
  satEstimate: number | null;
  ieltsEstimate: number | null;
  solvedProblems: number;
  questionsDone: number;
  accuracy: number | null;
  heatmap: { date: string; value: number }[];
  weak: WeakSpot[];
  today: PlanTask[];
  assignments: Assignment[];
  activeLesson: { classCode: string; lessonId: string; title: string; locked: boolean } | null;
  aiMode: "ai" | "demo";
}

// ---------- exams (контрольные) ----------

export type ExamQuestionType = "mcq" | "tf" | "short" | "open";

export interface ExamQuestion {
  id: string;
  type: ExamQuestionType;
  prompt: string;
  /** mcq: 4 options; tf: ["Верно", "Неверно"] */
  choices?: string[];
  /** mcq/tf: index of the right choice; short: accepted answers separated by "|"; open: model answer */
  answer: number | string;
  points: number;
  explanation?: string;
}

export type ExamStatus = "draft" | "live" | "finished";

export interface MaterialInfo {
  id: string;
  title: string;
  kind: "pdf" | "docx" | "text" | "image";
  size: number;
  pages: number | null;
  chars: number;
  createdAt: number;
}

export interface ExamSummary {
  id: string;
  title: string;
  subject: string;
  classCode: string;
  className: string;
  status: ExamStatus;
  code: string | null;
  questions: number;
  durationMin: number;
  createdAt: number;
  startedAt: number | null;
  submitted: number;
  students: number;
}

export interface ExamFull extends ExamSummary {
  instructions: string;
  lock: boolean;
  showResults: boolean;
  materialIds: string[];
  items: ExamQuestion[];
  endsAt: number | null;
  mode: "ai" | "demo";
}

export interface ExamLiveRow {
  studentId: string;
  name: string;
  state: "waiting" | "working" | "away" | "submitted";
  answered: number;
  current: number;
  awayCount: number;
  lastSeen: number | null;
  score: number | null;
  maxScore: number;
}

export interface ExamGrade {
  points: number;
  max: number;
  correct: boolean | null;
  feedback?: string;
}

export interface ExamTake {
  id: string;
  title: string;
  subject: string;
  teacher: string;
  durationMin: number;
  endsAt: number;
  lock: boolean;
  items: Omit<ExamQuestion, "answer" | "explanation">[];
  answers: Record<string, string | number>;
  current: number;
  submitted: boolean;
  result: null | { score: number; max: number; grades: Record<string, ExamGrade>; reveal: Record<string, { answer: number | string; explanation?: string }> | null };
}

// ---------- library ----------

export interface BookMeta {
  id: string;
  title: string;
  subject: string;
  grade: number | null;
  language: "ru" | "kk" | "en";
  author: string;
  description: string;
  source: "builtin" | "upload";
  format: "chapters" | "pdf" | "text";
  places: number;
  interactive: number;
  ownerId: string | null;
  progress: { place: string; stamps: number } | null;
}

export interface BookNote {
  id: string;
  place: string;
  text: string;
  createdAt: number;
}

// ---------- extra lessons and consultations ----------

export type ConsultKind = "lesson" | "consultation";

export interface ConsultSlot {
  id: string;
  seriesId: string | null;
  kind: ConsultKind;
  title: string;
  subject: string;
  description: string;
  startsAt: number;
  durationMin: number;
  capacity: number;
  booked: number;
  place: string;
  onlineUrl: string;
  classCode: string | null;
  cancelled: boolean;
  teacher: string;
  /** Student view: this student is signed up */
  mine?: boolean;
  /** Student view: the student's note to the teacher */
  myNote?: string;
  /** Teacher view: who signed up */
  attendees?: { id: string; name: string; grade: string; note: string; at: number }[];
}

/** English labels for the English-language exams; ENT keeps the Russian labels. */
export const DIFFICULTY_EN: Record<Difficulty, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };
export const DOMAIN_EN = Object.fromEntries(Object.keys(DOMAIN_RU).map(domain => [domain, domain])) as Record<SatDomain, string>;
