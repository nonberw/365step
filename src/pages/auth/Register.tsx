import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import type { Goals, PublicUser } from "@shared/types";
import { PLANTS, type PlantSpecies } from "@shared/plants";
import { api } from "@/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Plant, PlantPicker, type PlantMood } from "@/components/Plant";
import { ErrorBox } from "@/components/Page";
import { Sky } from "@/pages/landing/Showcase";

// Sign-up as an onboarding quiz (grader-style): a welcome screen with the mascot, one question per screen
// with a progress bar and the plant reacting to each answer, a sample task, a "building your plan" pause,
// the plan itself, and only then the account form.

type Exam = "sat" | "ielts" | "ent" | "code";
type Timeline = "1" | "3" | "6" | "12" | "?";

interface Answers {
  exams: Exam[];
  sat: number | null;
  ielts: number | null;
  ent: number | null;
  timeline: Timeline | null;
  level: "beginner" | "middle" | "advanced" | null;
  hardest: string | null;
  minutes: number | null;
  plant: PlantSpecies | null;
  sampleOk: boolean | null;
  cards: number[];
}

const EMPTY: Answers = { exams: [], sat: null, ielts: null, ent: null, timeline: null, level: null, hardest: null, minutes: null, plant: null, sampleOk: null, cards: [] };
const STORE = "365step-onboarding";

type StepId = "hello" | "goal" | "exams" | "sat" | "ielts" | "ent" | "timeline" | "level" | "hardest" | "minutes" | "plant" | "sample" | "cards" | "loading" | "plan" | "account";

const EXAM_LABEL: Record<Exam, string> = { sat: "Digital SAT", ielts: "IELTS", ent: "ЕНТ", code: "Программирование" };
const TIMELINE_LABEL: Record<Timeline, string> = { "1": "Меньше месяца", "3": "1–3 месяца", "6": "3–6 месяцев", "12": "Больше полугода", "?": "Ещё не знаю" };

/** A ready-made task per exam, checked right in the browser. */
const SAMPLES: Record<Exam, { q: string; choices: string[]; answer: number; why: string }> = {
  sat: { q: "Если 3x + 5 = 20, чему равен x?", choices: ["3", "5", "15", "25/3"], answer: 1, why: "3x = 20 − 5 = 15, значит x = 5." },
  ielts: { q: "Выбери синоним к слову «meticulous».", choices: ["careless", "very careful", "quick", "noisy"], answer: 1, why: "Meticulous — очень внимательный к деталям." },
  ent: { q: "В каком году было образовано Казахское ханство?", choices: ["1465", "1731", "1917", "1991"], answer: 0, why: "Керей и Жанибек основали Казахское ханство в 1465 году." },
  code: { q: "Что выведет print(len([1, 2, 3]) * 2)?", choices: ["3", "6", "[1, 2, 3, 1, 2, 3]", "Ошибка"], answer: 1, why: "len([1, 2, 3]) = 3, а 3 · 2 = 6." },
};

const CARDS: Record<Exam, { front: string; back: string }[]> = {
  sat: [
    { front: "Системы уравнений", back: "Решать за 30 секунд, в том числе в Desmos" },
    { front: "Words in Context", back: "Угадывать значение слова по контексту" },
    { front: "Данные и графики", back: "Читать таблицы без ловушек" },
    { front: "Связки", back: "However, therefore, moreover — где что" },
  ],
  ielts: [
    { front: "meticulous", back: "очень внимательный к деталям · Band 7+" },
    { front: "alleviate", back: "облегчать, смягчать проблему · Band 7+" },
    { front: "prevalent", back: "широко распространённый · Band 6.5+" },
    { front: "True / False / Not Given", back: "Отличать «нет в тексте» от «неверно»" },
  ],
  ent: [
    { front: "Казахское ханство", back: "Ключевые даты и правители" },
    { front: "Грамотность чтения", back: "Главная мысль и выводы из текста" },
    { front: "Мат. грамотность", back: "Проценты, графики, задачи на логику" },
    { front: "Профильные предметы", back: "Темы по твоей паре предметов" },
  ],
  code: [
    { front: "Хеш-таблицы", back: "Из O(n²) в O(n) одним словарём" },
    { front: "Два указателя", back: "Классика собеседований" },
    { front: "Рекурсия", back: "Деревья и перебор без паники" },
    { front: "Динамика", back: "Большая задача из маленьких" },
  ],
};

const REACT: Partial<Record<StepId, (a: Answers) => string>> = {
  exams: (a) => (a.exams.length > 1 ? "Отлично, совмещать можно — я разложу всё по дням." : a.exams[0] === "code" ? "Код — суперсила. Начнём с основ!" : "Хороший выбор, разберёмся вместе!"),
  sat: (a) => ((a.sat ?? 0) >= 1450 ? "Амбициозно! 1450+ реально при регулярной практике." : "Отличная цель, дойдём до неё шаг за шагом."),
  ielts: (a) => ((a.ielts ?? 0) >= 7 ? "Амбициозно! Band 7+ вполне достижим." : "Хорошая цель — сделаем упор на сильные стороны."),
  ent: (a) => ((a.ent ?? 0) >= 110 ? "Это уровень грантов — работаем!" : "Хорошая цель, разложим по предметам."),
  timeline: (a) => (a.timeline === "1" ? "Времени мало — сделаю план плотнее." : a.timeline === "?" ? "Не страшно, начнём спокойно и уточним позже." : "Отлично, успеем без спешки."),
  level: () => "Понял — начнём с того, что ты уже знаешь!",
  hardest: (a) => `«${a.hardest}» — сделаем на этом упор.`,
  minutes: () => "Напомню, чтобы это стало привычкой!",
  plant: (a) => (a.plant ? `${PLANTS[a.plant].name} будет расти с каждым заданием!` : ""),
};

function load(): Answers {
  try {
    return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(STORE) ?? "{}") };
  } catch {
    return EMPTY;
  }
}

function addMonths(m: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 10);
}

// ---------- building blocks ----------

function Choice({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-[15px] font-semibold transition-[transform,box-shadow] active:translate-y-[2px]",
        on ? "border-[#3bb8f5] bg-[#e8f6fe] text-[#0c6fa3] shadow-[0_4px_0_0_#3bb8f5]" : "border-[#e5e7eb] bg-[#f8fafc] text-[#334155] shadow-[0_4px_0_0_#e5e7eb] hover:bg-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

function BigButton({ children, onClick, disabled, type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-14 w-full rounded-2xl font-sans text-base font-bold uppercase tracking-wide transition-[transform,box-shadow] active:translate-y-1",
        disabled ? "bg-[#e5e7eb] text-[#9ca3af]" : "bg-[#3bb8f5] text-white shadow-[0_5px_0_0_#1a98d5] active:shadow-none",
      )}
    >
      {children}
    </button>
  );
}

function Bubble({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative mx-auto w-fit max-w-[320px] rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-3 text-center text-[15px] font-semibold text-[#1f2a2f] shadow-[0_8px_24px_-12px_rgba(24,61,154,0.45)]">
      {children}
      <span aria-hidden className="absolute -bottom-[9px] left-1/2 size-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-[#e5e7eb] bg-white" />
    </motion.div>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <h2 className="text-center font-display text-[26px] font-bold leading-tight text-[#1f2a2f]">{title}</h2>
      {hint ? <p className="mb-5 mt-1 text-center text-sm text-[#94a3b8]">{hint}</p> : <div className="mb-5" />}
      {children}
    </div>
  );
}

function Field({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string; autoComplete?: string }) {
  return (
    <input
      {...rest}
      aria-label={rest.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-2xl border-2 border-[#e5e7eb] bg-[#f8fafc] px-4 text-[15px] text-[#1f2a2f] outline-none focus:border-[#3bb8f5] focus:bg-white"
    />
  );
}

function Building({ species }: { species: PlantSpecies }) {
  const lines = ["Анализирую твою цель…", "Подбираю темы под слабые места…", "Раскладываю задания по дням…"];
  const [k, setK] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setK((x) => Math.min(x + 1, lines.length - 1)), 1000);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-12 text-center">
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-32">
        <Plant species={species} stage={4} mood="happy" />
      </motion.div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#94a3b8]">Загрузка…</p>
      <p className="font-display text-xl font-bold text-[#1f2a2f]">{lines[k]}</p>
    </div>
  );
}

function PlanReady({ a, species }: { a: Answers; species: PlantSpecies }) {
  const goal = [a.sat && `SAT ${a.sat}`, a.ielts && `IELTS ${a.ielts.toFixed(1)}`, a.ent && `ЕНТ ${a.ent}`, a.exams.includes("code") && "Кодинг"].filter(Boolean).join(" · ") || "Подготовка";
  const weak = a.hardest ?? "сложные темы";
  const roadmap =
    a.timeline === "1"
      ? [
          ["Неделя 1", "База и диагностика", "Короткие уроки по каждой теме и первый пробник."],
          ["Неделя 2", "Слабые места", `Упор на «${weak}» с разбором ошибок.`],
          ["Неделя 3", "Скорость", "Задания на время и стратегии формата экзамена."],
          ["Неделя 4", "Пробный экзамен", "Полный пробник и финальное повторение."],
        ]
      : [
          ["Недели 1–2", "Создаём базу", "Ежедневные уроки на пути и мгновенный разбор от ИИ."],
          ["Недели 3–4", "Укрепляем навыки", `Больше практики: «${weak}».`],
          ["Недели 5–6", "Закрываем пробелы", "Повторение ошибок и стратегии экзамена."],
          ["Недели 7–8", "Пробный экзамен", "Полные тесты и финальная подготовка."],
        ];
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="mx-auto w-24">
        <Plant species={species} stage={4} mood="happy" />
      </div>
      <h2 className="text-center font-display text-[28px] font-bold leading-tight text-[#1f2a2f]">Твой персональный план готов!</h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Цель", goal],
          ["Срок", a.timeline ? TIMELINE_LABEL[a.timeline] : "—"],
          ["Каждый день", `${a.minutes ?? 30} минут`],
          ["Спутник", a.plant ? PLANTS[a.plant].name : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-[#f1f5f9] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">{k}</p>
            <p className="font-display text-base font-bold text-[#1f2a2f]">{v}</p>
          </div>
        ))}
      </div>
      <ol className="flex flex-col gap-2">
        {roadmap.map(([when, title, text], k) => (
          <li key={when} className="flex gap-3 rounded-2xl border-2 border-[#e5e7eb] px-4 py-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#3bb8f5] text-sm font-bold text-white">{k + 1}</span>
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">{when}</span>
              <span className="block font-bold text-[#1f2a2f]">{title}</span>
              <span className="block text-sm text-[#64748b]">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="rounded-2xl bg-[#e8f6fe] px-4 py-3 text-center text-sm font-semibold text-[#0c6fa3]">7 дней Pro в подарок: ИИ без лимитов и сердечки без ограничений</p>
    </div>
  );
}

// ---------- page ----------

export default function Register() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [a, setA] = useState<Answers>(load);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", consent: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [samplePick, setSamplePick] = useState<number | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(a));
    } catch {
      // per-viewer convenience only
    }
  }, [a]);

  const steps = useMemo<StepId[]>(() => {
    const s: StepId[] = ["hello", "goal", "exams"];
    if (a.exams.includes("sat")) s.push("sat");
    if (a.exams.includes("ielts")) s.push("ielts");
    if (a.exams.includes("ent")) s.push("ent");
    s.push("timeline", "level", "hardest", "minutes", "plant", "sample", "cards", "loading", "plan", "account");
    return s;
  }, [a.exams]);
  const step = steps[Math.min(i, steps.length - 1)]!;
  const main: Exam = a.exams[0] ?? "sat";
  const set = (patch: Partial<Answers>) => setA((x) => ({ ...x, ...patch }));

  const answered: Record<StepId, boolean> = {
    hello: true,
    goal: true,
    exams: a.exams.length > 0,
    sat: a.sat !== null,
    ielts: a.ielts !== null,
    ent: a.ent !== null,
    timeline: a.timeline !== null,
    level: a.level !== null,
    hardest: a.hardest !== null,
    minutes: a.minutes !== null,
    plant: a.plant !== null,
    sample: a.sampleOk !== null,
    cards: a.cards.length >= 4,
    loading: false,
    plan: true,
    account: true,
  };

  // "Building your plan" pause, then the plan.
  useEffect(() => {
    if (step !== "loading") return;
    const t = setTimeout(() => setI((x) => x + 1), 3200);
    return () => clearTimeout(t);
  }, [step]);

  const next = () => setI((x) => Math.min(x + 1, steps.length - 1));
  const back = () => {
    if (i === 0) return setStarted(false);
    setI((x) => Math.max(0, x - (steps[x - 1] === "loading" ? 2 : 1)));
  };
  const reaction = answered[step] ? REACT[step]?.(a) : undefined;
  const mood: PlantMood = step === "sample" && a.sampleOk === false ? "sad" : reaction ? "happy" : "idle";
  const species = a.plant ?? "sunflower";
  const progress = (i + 1) / steps.length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return setError("Укажи имя и фамилию");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError("Проверь почту");
    if (form.password.length < 8 || !/[0-9]/.test(form.password) || !/[A-Za-zА-Яа-я]/.test(form.password)) return setError("Пароль: от 8 символов, с буквой и цифрой");
    if (!form.consent) return setError("Нужно согласие на обработку данных");
    setBusy(true);
    setError("");
    const months = a.timeline && a.timeline !== "?" ? Number(a.timeline) : 6;
    const date = addMonths(months);
    const goals: Goals = { dailyMinutes: a.minutes ?? 30, hardest: a.hardest ?? undefined, level: a.level ?? undefined };
    if (a.sat) goals.sat = { target: a.sat, date };
    if (a.ielts) goals.ielts = { target: a.ielts, date };
    if (a.ent) goals.ent = { target: a.ent };
    if (a.exams.includes("code")) goals.coding = true;
    try {
      const r = await api<{ token: string; user: PublicUser }>("/auth/register", {
        body: { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, grade: null, goals, plant: a.plant ?? "sunflower", consent: form.consent },
      });
      try {
        sessionStorage.removeItem(STORE);
        localStorage.setItem("nc-course", main === "ielts" ? "ielts-reading" : main === "ent" ? "ent" : main === "code" ? "code" : "sat-math");
      } catch {
        // per-viewer convenience only
      }
      signIn(r.token, r.user);
      navigate("/learn");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ---------- welcome ----------
  if (!started)
    return (
      <div className="relative isolate flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center text-white">
        <Sky deep />
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 16 }} className="relative w-56 sm:w-64">
          {["left-0 top-10", "right-2 top-2", "-right-2 top-1/2", "left-2 bottom-16"].map((pos, k) => (
            <Sparkles key={k} className={cn("animate-float absolute size-6 fill-[#ffd84d] text-[#ffd84d]", pos)} style={{ animationDelay: `${k * 0.7}s` }} />
          ))}
          <div className="sticker">
            <Plant species={species} stage={4} mood="happy" />
          </div>
        </motion.div>
        <h1 className="mt-4 font-display text-6xl font-bold tracking-tight [text-shadow:0_4px_24px_rgba(24,61,154,0.4)] sm:text-7xl">365step</h1>
        <p className="mt-3 max-w-md text-lg font-semibold text-white/95 [text-shadow:0_2px_12px_rgba(24,61,154,0.4)]">Умный способ подготовиться к SAT, IELTS, ЕНТ и коду — шаг за шагом.</p>
        <div className="mt-8 flex w-full max-w-md flex-col gap-3">
          <BigButton onClick={() => setStarted(true)}>Начать</BigButton>
          <Link to="/login" className="glass flex h-14 w-full items-center justify-center rounded-2xl text-base font-bold uppercase tracking-wide text-white hover:bg-white/30">
            У меня уже есть аккаунт
          </Link>
        </div>
      </div>
    );

  // ---------- quiz ----------
  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center px-3 py-6 sm:py-10">
      <Sky deep />
      <div className="flex w-full max-w-xl flex-col rounded-[28px] bg-white p-5 shadow-[0_30px_80px_-30px_rgba(24,61,154,0.55)] sm:p-7">
        <div className="h-2.5 overflow-hidden rounded-full bg-[#e5e7eb]" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Прогресс">
          <motion.div className="h-full rounded-full bg-[#3bb8f5]" animate={{ width: `${progress * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
        {step !== "loading" && (
          <button type="button" onClick={back} aria-label="Назад" className="mt-3 w-fit text-[#94a3b8] hover:text-[#334155]">
            <ArrowLeft className="size-5" />
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} className="flex flex-1 flex-col">
            {(step === "hello" || step === "goal") && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10">
                <Bubble>{step === "hello" ? "Привет! Я твой спутник в 365step 👋" : "Давай найдём твою цель и соберём план!"}</Bubble>
                <div className="w-40">
                  <Plant species={species} stage={4} mood="happy" />
                </div>
              </div>
            )}

            {!["hello", "goal", "loading", "plan", "account"].includes(step) && (
              <div className="mx-auto mb-2 mt-1 w-20">
                <Plant species={species} stage={step === "plant" ? 4 : 3} mood={mood} />
              </div>
            )}

            {step === "exams" && (
              <Question title="К чему готовишься?" hint="Можно выбрать несколько">
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(EXAM_LABEL) as Exam[]).map((e) => (
                    <Choice key={e} on={a.exams.includes(e)} onClick={() => set({ exams: a.exams.includes(e) ? a.exams.filter((x) => x !== e) : [...a.exams, e] })}>
                      {a.exams.includes(e) && <Check className="size-4" />} {EXAM_LABEL[e]}
                    </Choice>
                  ))}
                </div>
              </Question>
            )}
            {step === "sat" && (
              <Question title="Какой балл SAT хочешь?" hint="Нажми на цель">
                <div className="grid grid-cols-4 gap-3">
                  {[1200, 1300, 1350, 1400, 1450, 1500, 1550, 1600].map((v) => (
                    <Choice key={v} on={a.sat === v} onClick={() => set({ sat: v })} className="h-16 text-lg">
                      {v}
                    </Choice>
                  ))}
                </div>
              </Question>
            )}
            {step === "ielts" && (
              <Question title="Какой балл IELTS хочешь?" hint="Нажми на цель">
                <div className="grid grid-cols-4 gap-3">
                  {[5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((v) => (
                    <Choice key={v} on={a.ielts === v} onClick={() => set({ ielts: v })} className="h-16 text-lg">
                      {v.toFixed(1)}
                    </Choice>
                  ))}
                </div>
              </Question>
            )}
            {step === "ent" && (
              <Question title="Сколько баллов ЕНТ хочешь?" hint="Из 140">
                <div className="grid grid-cols-4 gap-3">
                  {[70, 80, 90, 100, 110, 120, 130, 140].map((v) => (
                    <Choice key={v} on={a.ent === v} onClick={() => set({ ent: v })} className="h-16 text-lg">
                      {v}
                    </Choice>
                  ))}
                </div>
              </Question>
            )}
            {step === "timeline" && (
              <Question title="Когда экзамен?">
                <div className="grid gap-3">
                  {(Object.keys(TIMELINE_LABEL) as Timeline[]).map((t) => (
                    <Choice key={t} on={a.timeline === t} onClick={() => set({ timeline: t })}>
                      {TIMELINE_LABEL[t]}
                    </Choice>
                  ))}
                </div>
              </Question>
            )}
            {step === "level" && (
              <Question title="Как оцениваешь свой уровень сейчас?">
                <div className="grid gap-3">
                  {(
                    [
                      ["beginner", "🌱 Только начинаю"],
                      ["middle", "🌿 Кое-что уже умею"],
                      ["advanced", "🌳 Уже хороший уровень"],
                    ] as const
                  ).map(([v, l]) => (
                    <Choice key={v} on={a.level === v} onClick={() => set({ level: v })}>
                      {l}
                    </Choice>
                  ))}
                </div>
              </Question>
            )}
            {step === "hardest" && (
              <Question title="Что даётся труднее всего?">
                <div className="grid grid-cols-2 gap-3">
                  {["Математика", "Чтение", "Грамматика", "Говорение", "Эссе", "Тайм-менеджмент", "Запоминание дат", "Алгоритмы"].map((v) => (
                    <Choice key={v} on={a.hardest === v} onClick={() => set({ hardest: v })}>
                      {v}
                    </Choice>
                  ))}
                </div>
              </Question>
            )}
            {step === "minutes" && (
              <Question title="Сколько времени в день готов заниматься?">
                <div className="grid gap-3">
                  {(
                    [
                      [10, "10 минут", "Легко"],
                      [20, "20 минут", "Нормально"],
                      [30, "30 минут", "Серьёзно"],
                      [60, "60 минут", "Интенсивно"],
                    ] as const
                  ).map(([v, l, tag]) => (
                    <Choice key={v} on={a.minutes === v} onClick={() => set({ minutes: v })} className="justify-between">
                      <span>{l}</span>
                      <span className="text-sm font-medium text-[#94a3b8]">{tag}</span>
                    </Choice>
                  ))}
                </div>
              </Question>
            )}
            {step === "plant" && (
              <Question title="Выбери своего спутника" hint="Он растёт, пока ты учишься">
                <PlantPicker value={a.plant} onChange={(v) => set({ plant: v })} />
              </Question>
            )}
            {step === "sample" && (
              <Question title="Попробуй одно задание" hint={EXAM_LABEL[main]}>
                <p className="mb-4 rounded-2xl bg-[#f1f5f9] px-4 py-3 text-center text-[15px] font-semibold text-[#1f2a2f]">{SAMPLES[main].q}</p>
                <div className="grid grid-cols-2 gap-3">
                  {SAMPLES[main].choices.map((c, k) => {
                    const checked = a.sampleOk !== null;
                    const right = k === SAMPLES[main].answer;
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={checked}
                        onClick={() => {
                          setSamplePick(k);
                          set({ sampleOk: right });
                        }}
                        className={cn(
                          "rounded-2xl border-2 px-4 py-3 text-[15px] font-semibold shadow-[0_4px_0_0_#e5e7eb]",
                          checked && right ? "border-[#58cc02] bg-[#d7ffb8] text-[#3c7a00] shadow-[0_4px_0_0_#58cc02]" : checked && samplePick === k ? "border-[#ff4b4b] bg-[#ffdfe0] text-[#b42318] shadow-[0_4px_0_0_#ff4b4b]" : "border-[#e5e7eb] bg-[#f8fafc] text-[#334155]",
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                {a.sampleOk !== null && <p className={cn("mt-4 text-center text-sm font-semibold", a.sampleOk ? "text-[#3c7a00]" : "text-[#b42318]")}>{(a.sampleOk ? "Верно! " : "Почти! ") + SAMPLES[main].why}</p>}
              </Question>
            )}
            {step === "cards" && (
              <Question title="Твой план научит тебя такому" hint="Открой все 4 карточки">
                <div className="grid grid-cols-2 gap-3">
                  {CARDS[main].map((c, k) => {
                    const open = a.cards.includes(k);
                    return (
                      <button key={c.front} type="button" onClick={() => !open && set({ cards: [...a.cards, k] })} className="h-28 [perspective:800px]" aria-label={open ? `${c.front}: ${c.back}` : `Открыть карточку ${c.front}`}>
                        <motion.span animate={{ rotateY: open ? 180 : 0 }} transition={{ duration: 0.45 }} className="relative block size-full [transform-style:preserve-3d]">
                          <span className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-[#e5e7eb] bg-white p-3 [backface-visibility:hidden]">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Нажми</span>
                            <span className="mt-1 text-center font-display text-base font-bold text-[#1f2a2f]">{c.front}</span>
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-[#3bb8f5] bg-[#e8f6fe] p-3 text-center text-sm font-semibold text-[#0c6fa3] [backface-visibility:hidden] [transform:rotateY(180deg)]">{c.back}</span>
                        </motion.span>
                      </button>
                    );
                  })}
                </div>
              </Question>
            )}
            {step === "loading" && <Building species={species} />}
            {step === "plan" && <PlanReady a={a} species={species} />}
            {step === "account" && (
              <form onSubmit={submit} className="flex flex-col gap-3 pt-2">
                <div className="mx-auto w-20">
                  <Plant species={species} stage={3} mood="happy" />
                </div>
                <h2 className="text-center font-display text-2xl font-bold text-[#1f2a2f]">Сохрани свой план</h2>
                <p className="text-center text-sm text-[#64748b]">Создай аккаунт — и 7 дней Pro в подарок.</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Field placeholder="Имя" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} autoComplete="given-name" />
                  <Field placeholder="Фамилия" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} autoComplete="family-name" />
                </div>
                <Field placeholder="Почта" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" />
                <Field placeholder="Пароль (от 8 символов, буквы и цифры)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} autoComplete="new-password" />
                <label className="flex items-start gap-3 text-xs text-[#64748b]">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[#3bb8f5]" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                  <span>Согласен(на) на обработку персональных данных. Если мне меньше 18 лет, согласие дал родитель или законный представитель. Имя и почта не передаются в ИИ.</span>
                </label>
                <ErrorBox message={error} />
                <div className="mt-2">
                  <BigButton type="submit" disabled={busy}>
                    {busy ? "Создаю…" : "Создать аккаунт"}
                  </BigButton>
                </div>
                <Link to="/login" className="text-center text-sm font-semibold text-[#3bb8f5]">
                  У меня уже есть аккаунт
                </Link>
              </form>
            )}
          </motion.div>
        </AnimatePresence>

        {/* the plant's reaction to the answer and the continue button */}
        {!["loading", "account"].includes(step) && (
          <div className="mt-5 flex flex-col gap-3">
            <div className="min-h-[24px] text-center text-sm font-semibold text-[#0c6fa3]">
              <AnimatePresence mode="wait">
                {reaction && (
                  <motion.p key={reaction} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    {reaction}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <BigButton onClick={next} disabled={!answered[step]}>
              {step === "plan" ? "Получить план" : "Продолжить"}
            </BigButton>
          </div>
        )}
      </div>
    </div>
  );
}
