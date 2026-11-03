// ЕНТ (Единое национальное тестирование) — format of the 2026 exam, kept for 2027.
// Sources: НЦТ (testcenter.kz) specifications and rules (Приказ МОН № 204, ред. 2026), МНВО order of 1 July 2026
// on thresholds, coverage in zakon.kz / informburo / postupi.kz. Questions on the platform are original:
// ENT items are confidential, so we only reproduce the public format and topic lists.

export type EntLang = "ru" | "kk";
export type EntType = "single" | "context" | "multi" | "match";

export interface EntSubject {
  id: string;
  name: string;
  kind: "mandatory" | "profile";
  count: number;
  max: number;
  /** Composition of the block by question type */
  plan: { type: EntType; count: number }[];
  topics: string[];
  /** Minimum points in the subject (МНВО order of 1 July 2026) */
  threshold: number;
  /** Generated in Kazakh even when the student studies in Russian, and vice versa */
  fixedLang?: EntLang | "en";
  icon: string;
}

const PROFILE_PLAN: EntSubject["plan"] = [
  { type: "single", count: 25 },
  { type: "context", count: 5 },
  { type: "multi", count: 5 },
  { type: "match", count: 5 },
];

const profile = (id: string, name: string, icon: string, topics: string[], fixedLang?: EntSubject["fixedLang"]): EntSubject => ({ id, name, kind: "profile", count: 40, max: 50, plan: PROFILE_PLAN, topics, threshold: 5, fixedLang, icon });

export const ENT_SUBJECTS: EntSubject[] = [
  {
    id: "history-kz",
    name: "История Казахстана",
    kind: "mandatory",
    count: 20,
    max: 20,
    plan: [{ type: "single", count: 20 }],
    threshold: 5,
    icon: "🏛️",
    topics: [
      "Древнейшая история Казахстана",
      "Саки, усуни, канглы, гунны",
      "Тюркские каганаты",
      "Государства IX–XII веков: карлуки, Караханиды, кимаки, кыпчаки",
      "Монгольское завоевание и улусы",
      "Казахское ханство в XV–XVII веках",
      "Казахско-джунгарские войны",
      "Присоединение к Российской империи и реформы XIX века",
      "Национально-освободительные движения",
      "Культура и просвещение XIX — начала XX века",
      "Алаш и события 1917–1920 годов",
      "Индустриализация, коллективизация и голод 1930-х",
      "Казахстан в годы Великой Отечественной войны",
      "Послевоенный период, целина, 1960–1980-е",
      "Независимый Казахстан",
    ],
  },
  {
    id: "reading",
    name: "Грамотность чтения",
    kind: "mandatory",
    count: 10,
    max: 10,
    plan: [{ type: "context", count: 10 }],
    threshold: 3,
    icon: "📖",
    topics: ["Главная мысль текста", "Поиск информации", "Интерпретация и выводы", "Оценка аргументов и позиции автора", "Таблицы, схемы и несплошные тексты"],
  },
  {
    id: "math-lit",
    name: "Математическая грамотность",
    kind: "mandatory",
    count: 10,
    max: 10,
    plan: [{ type: "single", count: 10 }],
    threshold: 3,
    icon: "🧮",
    topics: ["Проценты, доли и пропорции", "Графики, диаграммы и таблицы", "Логические задачи", "Вероятность и комбинаторика", "Финансовая грамотность", "Измерения и геометрия в жизни"],
  },
  profile("math", "Математика", "📐", ["Числа и выражения", "Уравнения", "Системы уравнений", "Неравенства", "Системы неравенств", "Последовательности и прогрессии", "Функции и производная", "Математическое моделирование и анализ", "Планиметрия", "Стереометрия", "Векторы"]),
  profile("physics", "Физика", "⚛️", ["Кинематика", "Динамика", "Законы сохранения", "Молекулярная физика и термодинамика", "Электростатика", "Постоянный ток", "Магнетизм и электромагнитная индукция", "Колебания и волны", "Оптика", "Атомная и квантовая физика"]),
  profile("informatics", "Информатика", "💻", ["Информация и системы счисления", "Логика и логические выражения", "Алгоритмы", "Программирование на Python", "Базы данных и электронные таблицы", "Компьютерные сети и интернет", "Аппаратное и программное обеспечение", "Информационная безопасность и ИИ"]),
  profile("chemistry", "Химия", "🧪", ["Строение атома и периодический закон", "Химическая связь", "Классы неорганических веществ", "Химические реакции и ОВР", "Растворы и электролитическая диссоциация", "Металлы", "Неметаллы", "Углеводороды", "Кислород- и азотсодержащие органические вещества", "Расчётные задачи"]),
  profile("biology", "Биология", "🧬", ["Клетка", "Обмен веществ и энергии", "Размножение и развитие", "Генетика", "Эволюция", "Растения", "Животные", "Анатомия и физиология человека", "Экология"]),
  profile("geography", "География", "🌍", ["Картография", "Литосфера и рельеф", "Атмосфера и климат", "Гидросфера", "Биосфера и природные зоны", "Население мира", "Экономическая география мира", "Физическая география Казахстана", "Экономическая география Казахстана"]),
  profile("world-history", "Всемирная история", "🗺️", ["Древний мир", "Средние века", "Новое время", "Первая мировая война", "Межвоенный период", "Вторая мировая война", "Холодная война", "Современный мир"]),
  profile("law", "Основы права", "⚖️", ["Теория государства и права", "Конституция Республики Казахстан", "Гражданское право", "Трудовое право", "Семейное право", "Административное право", "Уголовное право и процесс", "Права человека"]),
  profile("english", "Английский язык", "🇬🇧", ["Grammar: tenses", "Grammar: modal verbs and conditionals", "Grammar: passive and reported speech", "Vocabulary and word formation", "Reading comprehension", "Use of English"], "en"),
  profile("kazakh", "Казахский язык", "🔤", ["Фонетика", "Лексика", "Сөзжасам", "Морфология", "Синтаксис", "Емле және тыныс белгілері", "Мәтінмен жұмыс"], "kk"),
  profile("kazakh-lit", "Казахская литература", "📜", ["Ауыз әдебиеті", "Ежелгі және хандық дәуір әдебиеті", "XIX ғасыр әдебиеті", "XX ғасыр әдебиеті", "Қазіргі әдебиет", "Әдебиет теориясы"], "kk"),
  profile("russian", "Русский язык", "✍️", ["Фонетика и орфоэпия", "Лексика", "Состав слова и словообразование", "Морфология", "Синтаксис", "Орфография", "Пунктуация", "Работа с текстом"], "ru"),
  profile("russian-lit", "Русская литература", "📚", ["Древнерусская литература и XVIII век", "Литература XIX века", "Литература XX века", "Современная литература", "Теория литературы"], "ru"),
];

export const ENT_SUBJECT = Object.fromEntries(ENT_SUBJECTS.map((s) => [s.id, s])) as Record<string, EntSubject>;
export const ENT_MANDATORY = ["history-kz", "reading", "math-lit"];

/** Profile subject pairs (aggregators list 12–14 pairs; the creative exam is not a test and is left out). */
export const ENT_PAIRS: { id: string; subjects: [string, string]; fields: string }[] = [
  { id: "math-physics", subjects: ["math", "physics"], fields: "инженерия, IT, энергетика, архитектура" },
  { id: "math-informatics", subjects: ["math", "informatics"], fields: "IT, программирование, кибербезопасность" },
  { id: "math-geography", subjects: ["math", "geography"], fields: "экономика, финансы, менеджмент" },
  { id: "biology-chemistry", subjects: ["biology", "chemistry"], fields: "медицина, фармация, биотехнологии" },
  { id: "biology-geography", subjects: ["biology", "geography"], fields: "экология, агрономия, туризм" },
  { id: "chemistry-physics", subjects: ["chemistry", "physics"], fields: "химическая технология, металлургия, нефтегаз" },
  { id: "worldhistory-geography", subjects: ["world-history", "geography"], fields: "международные отношения, туризм" },
  { id: "worldhistory-law", subjects: ["world-history", "law"], fields: "юриспруденция, госуправление" },
  { id: "english-worldhistory", subjects: ["english", "world-history"], fields: "международные отношения, переводческое дело" },
  { id: "geography-english", subjects: ["geography", "english"], fields: "туризм, востоковедение, переводческое дело" },
  { id: "kazakh-kazakhlit", subjects: ["kazakh", "kazakh-lit"], fields: "казахская филология, журналистика" },
  { id: "russian-russianlit", subjects: ["russian", "russian-lit"], fields: "русская филология, журналистика" },
];
export const ENT_PAIR = Object.fromEntries(ENT_PAIRS.map((p) => [p.id, p]));

export const ENT_TOTAL_MINUTES = 240;
export const ENT_MAX = 140;

/** Overall thresholds for grants and admission, МНВО order of 1 July 2026. */
export const ENT_THRESHOLDS = [
  { label: "Большинство вузов", points: 50 },
  { label: "Национальные вузы", points: 65 },
  { label: "Здравоохранение", points: 70 },
  { label: "Педагогика и право", points: 75 },
];

/** Practice / mini-test time for one subject block, proportional to the real 240 minutes. */
export const entMinutes = (subjectIds: string[]) => Math.round((ENT_TOTAL_MINUTES * subjectIds.reduce((s, id) => s + (ENT_SUBJECT[id]?.count ?? 0), 0)) / 120);

// ---------- questions ----------

export interface EntQuestion {
  id: string;
  subject: string;
  topic: string;
  type: EntType;
  lang: EntLang | "en";
  /** Shared text for context questions */
  passage?: string;
  groupId?: string;
  stem: string;
  /** single/context: 4 options; multi: 6 options; match: the right column */
  options: string[];
  /** match: the left column */
  left?: string[];
  /** single/context: index; multi: sorted indexes; match: for each left item, index in options */
  answer: number | number[];
  explanation: string;
  difficulty: "A" | "B" | "C";
  source: "ai" | "seed" | "open";
  /** Same learning item across translations. Parameter variants share a family. */
  contentId?: string;
  familyId?: string;
  variant?: boolean;
  attribution?: {
    sourceId: string;
    title: string;
    authors: string;
    url: string;
    locator: string;
    sourceLicense: string;
    sourceLicenseUrl: string;
    license: string;
    licenseUrl: string;
    changes: string;
    checkedAt: string;
  };
}

export type EntQuestionPublic = Omit<EntQuestion, "answer" | "explanation">;
export type EntAnswer = number | number[] | null;

export const entPoints = (type: EntType) => (type === "multi" || type === "match" ? 2 : 1);

/**
 * Scoring as described for the ENT: 1 point for single and context questions;
 * multi and match give 2 points when fully right, 1 point with one mistake, 0 otherwise.
 */
export function entScore(q: Pick<EntQuestion, "type" | "answer">, given: EntAnswer): number {
  if (given === null || given === undefined) return 0;
  if (q.type === "single" || q.type === "context") return given === q.answer ? 1 : 0;
  const right = q.answer as number[];
  const g = given as number[];
  if (!Array.isArray(g) || !g.length) return 0;
  if(g.some(i=>!Number.isInteger(i)||i<0))return 0;
  if(q.type==="match"&&(g.length!==right.length||g.some(i=>i>3)))return 0;
  if(q.type==="multi"&&(g.length>3||new Set(g).size!==g.length||g.some(i=>i>5)))return 0;
  let mistakes: number;
  if (q.type === "multi") {
    const want = new Set(right);
    const got = new Set(g);
    mistakes = [...want].filter((x) => !got.has(x)).length + [...got].filter((x) => !want.has(x)).length;
  } else {
    mistakes = right.filter((r, i) => g[i] !== r).length;
  }
  return mistakes === 0 ? 2 : mistakes === 1 ? 1 : 0;
}

/** Official free resources of НЦТ to link instead of copying their items. */
export const ENT_RESOURCES = [
  { title: "Подготовка к тестированию — НЦТ", url: "https://testcenter.kz/?page_id=15094", text: "Спецификации тестов по каждому предмету, образцы вариантов, списки учебников и «100 дат» по истории. Бесплатно, PDF." },
  { title: "Пробное ЕНТ — НЦТ", url: "https://app.testcenter.kz/", text: "Официальный пробный тест в интерфейсе НЦТ. Вход по ИИН, попытки платные (около 600 ₸ по данным 2025 года)." },
  { title: "Пробное тестирование по ИИН", url: "https://prob-ent.testcenter.kz/", text: "Бесплатный пробник НЦТ с калькулятором и таблицами (запущен в 2023 году, проверьте, обновлены ли варианты)." },
  { title: "О ЕНТ — НЦТ", url: "https://testcenter.kz/?page_id=22722", text: "Правила, сроки сессий, регистрация, апелляция." },
];

export const ENT_SESSIONS_2026 = [
  { name: "Январская", dates: "10 января — 10 февраля", note: "только платное обучение" },
  { name: "Мартовская", dates: "1 марта — 6 апреля", note: "только платное обучение" },
  { name: "Основная", dates: "10 мая — 10 июля", note: "гранты и платное, 2 попытки, засчитывается лучшая" },
  { name: "Августовская", dates: "10–20 августа", note: "только платное обучение" },
];
