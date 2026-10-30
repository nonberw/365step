import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Presentation } from "lucide-react";
import type { Campus, Goals, PublicUser, TeacherTitle } from "@shared/types";
import { CAMPUSES, TITLES } from "@shared/types";
import { api } from "@/api";
import { useAuth } from "@/lib/auth";
import { ART } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorBox } from "@/components/Page";
import AuthLayout from "./AuthLayout";

export default function Register() {
  const { role } = useParams();
  if (role === "student") return <StudentWizard />;
  if (role === "teacher") return <TeacherForm />;
  return (
    <AuthLayout image={ART.wanderer} quote={{ text: "Дорогу осилит идущий.", by: "Пословица" }}>
      <p className="eyebrow">Регистрация</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Кто вы?</h1>
      <p className="mt-2 text-sm text-muted-foreground">У учеников и учителей разные формы и разные кабинеты.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <RoleCard to="/register/student" icon={<GraduationCap />} title="Я ученик" text="SAT, IELTS, кодинг, рейтинг класса и личный план подготовки." />
        <RoleCard to="/register/teacher" icon={<Presentation />} title="Я учитель" text="Классы, задания, живой урок в закрытом режиме и аналитика. Нужен код сотрудника." />
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Войти
        </Link>
      </p>
    </AuthLayout>
  );
}

function RoleCard({ to, icon, title, text }: { to: string; icon: ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary">
      <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground [&_svg]:size-5">{icon}</span>
      <span className="font-display text-xl font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{text}</span>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-primary">
        Продолжить <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

// ---------- shared pieces ----------

function Steps({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="mb-8 flex items-center gap-2" aria-label="Шаги регистрации">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 flex-col gap-1.5">
          <span className={cn("h-1.5 rounded-full bg-muted transition-colors", i <= step && "bg-primary")} />
          <span className={cn("text-[11px] font-semibold", i === step ? "text-foreground" : "text-muted-foreground")}>{l}</span>
        </li>
      ))}
    </ol>
  );
}

function Chips<T extends string | number>({ value, onChange, options, multi }: { value: T[]; onChange: (v: T[]) => void; options: { value: T; label: string }[]; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60")}
          >
            {on && <Check className="size-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  const rules = [
    { ok: password.length >= 8, label: "Не короче 8 символов" },
    { ok: /[0-9]/.test(password), label: "Есть цифра" },
    { ok: /[A-Za-zА-Яа-я]/.test(password), label: "Есть буква" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {rules.map((r) => (
        <li key={r.label} className={cn("flex items-center gap-1", r.ok ? "text-success" : "text-muted-foreground")}>
          <Check className={cn("size-3", !r.ok && "opacity-30")} /> {r.label}
        </li>
      ))}
    </ul>
  );
}

const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.22 } };

// ---------- student ----------

type Aim = "sat" | "ielts" | "coding";

function StudentWizard() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    campus: "zhandosov" as Campus,
    grade: 10,
    classLetter: "А",
    classCode: "",
    aims: ["sat"] as Aim[],
    satTarget: 1400,
    satCurrent: "",
    satDate: "",
    ieltsTarget: 7,
    ieltsCurrent: "",
    ieltsDate: "",
    dailyMinutes: 30,
    hardest: "",
    university: "",
    interests: [] as string[],
    consent: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const checks: (() => string)[] = [
    () => (!f.firstName.trim() || !f.lastName.trim() ? "Укажи имя и фамилию" : !/^\S+@\S+\.\S+$/.test(f.email) ? "Проверь почту" : f.password.length < 8 || !/[0-9]/.test(f.password) ? "Пароль: от 8 символов, с цифрой" : ""),
    () => "",
    () => (!f.aims.length ? "Выбери хотя бы одну цель" : ""),
    () => (!f.consent ? "Нужно согласие на обработку данных" : ""),
  ];

  function next(e?: FormEvent) {
    e?.preventDefault();
    const msg = checks[step]!();
    setError(msg);
    if (msg) return;
    if (step < 3) setStep(step + 1);
    else submit();
  }

  async function submit() {
    setBusy(true);
    setError("");
    const goals: Goals = { dailyMinutes: f.dailyMinutes, hardest: f.hardest || undefined, university: f.university || undefined };
    if (f.aims.includes("sat")) goals.sat = { target: f.satTarget, date: f.satDate, current: f.satCurrent ? Number(f.satCurrent) : undefined };
    if (f.aims.includes("ielts")) goals.ielts = { target: f.ieltsTarget, date: f.ieltsDate, current: f.ieltsCurrent ? Number(f.ieltsCurrent) : undefined };
    if (f.aims.includes("coding")) goals.coding = true;
    try {
      const r = await api<{ token: string; user: PublicUser }>("/auth/register/student", {
        body: { firstName: f.firstName, lastName: f.lastName, email: f.email, password: f.password, campus: f.campus, grade: f.grade, classLetter: f.classLetter, classCode: f.classCode, goals, interests: f.interests, consent: f.consent },
      });
      signIn(r.token, r.user);
      navigate("/app?welcome=1");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const labels = ["Аккаунт", "Школа", "Вопросы о целях", "Почти всё"];

  return (
    <AuthLayout image={ART.athens} quote={{ text: "Начни с цели — и платформа построит путь к ней.", by: "BSTS AI Lab" }}>
      <p className="eyebrow">Регистрация ученика</p>
      <h1 className="mb-6 mt-2 font-display text-3xl font-semibold">{["Создай аккаунт", "Где ты учишься?", "Пара вопросов о тебе", "Последний шаг"][step]}</h1>
      <Steps step={step} labels={labels} />
      <form onSubmit={next} className="flex flex-col gap-5">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide} className="flex flex-col gap-4">
            {step === 0 && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Имя" htmlFor="firstName">
                    <Input id="firstName" autoComplete="given-name" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} />
                  </Field>
                  <Field label="Фамилия" htmlFor="lastName">
                    <Input id="lastName" autoComplete="family-name" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
                  </Field>
                </div>
                <Field label="Почта" htmlFor="email" hint="На неё придут итоги пробных тестов">
                  <Input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Пароль" htmlFor="password">
                  <Input id="password" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} />
                </Field>
                <PasswordChecklist password={f.password} />
              </>
            )}
            {step === 1 && (
              <>
                <Field label="Кампус" htmlFor="campus">
                  <Select id="campus" value={f.campus} onChange={(e) => set("campus", e.target.value as Campus)}>
                    {Object.entries(CAMPUSES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Класс" htmlFor="grade">
                    <Select id="grade" value={f.grade} onChange={(e) => set("grade", Number(e.target.value))}>
                      {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                        <option key={g} value={g}>
                          {g} класс
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Буква" htmlFor="classLetter">
                    <Select id="classLetter" value={f.classLetter} onChange={(e) => set("classLetter", e.target.value)}>
                      {["А", "Б", "В", "Г", "Д", "Е"].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Код класса от учителя (можно позже)" htmlFor="classCode" hint="Учитель увидит твой прогресс и сможет давать задания">
                  <Input id="classCode" value={f.classCode} onChange={(e) => set("classCode", e.target.value.toUpperCase())} placeholder="BSTS123" />
                </Field>
              </>
            )}
            {step === 2 && (
              <>
                <Question title="1. К чему готовишься?">
                  <Chips<Aim>
                    multi
                    value={f.aims}
                    onChange={(v) => set("aims", v)}
                    options={[
                      { value: "sat", label: "Digital SAT" },
                      { value: "ielts", label: "IELTS" },
                      { value: "coding", label: "Программирование" },
                    ]}
                  />
                </Question>
                {f.aims.includes("sat") && (
                  <Question title={`2. Цель по SAT: ${f.satTarget}`}>
                    <input id="satTarget" type="range" min={900} max={1600} step={10} value={f.satTarget} onChange={(e) => set("satTarget", Number(e.target.value))} className="w-full accent-[var(--primary)]" aria-label="Цель по SAT" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Текущий балл, если сдавал" htmlFor="satCurrent">
                        <Input id="satCurrent" inputMode="numeric" value={f.satCurrent} onChange={(e) => set("satCurrent", e.target.value.replace(/\D/g, ""))} placeholder="Например, 1250" />
                      </Field>
                      <Field label="Дата экзамена" htmlFor="satDate">
                        <Input id="satDate" type="date" value={f.satDate} onChange={(e) => set("satDate", e.target.value)} />
                      </Field>
                    </div>
                  </Question>
                )}
                {f.aims.includes("ielts") && (
                  <Question title={`${f.aims.includes("sat") ? 3 : 2}. Цель по IELTS: ${f.ieltsTarget}`}>
                    <Chips<number> value={[f.ieltsTarget]} onChange={(v) => set("ieltsTarget", v[0]!)} options={[5.5, 6, 6.5, 7, 7.5, 8, 8.5].map((b) => ({ value: b, label: String(b) }))} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Текущий балл, если знаешь" htmlFor="ieltsCurrent">
                        <Input id="ieltsCurrent" inputMode="decimal" value={f.ieltsCurrent} onChange={(e) => set("ieltsCurrent", e.target.value.replace(/[^\d.]/g, ""))} placeholder="Например, 6" />
                      </Field>
                      <Field label="Дата экзамена" htmlFor="ieltsDate">
                        <Input id="ieltsDate" type="date" value={f.ieltsDate} onChange={(e) => set("ieltsDate", e.target.value)} />
                      </Field>
                    </div>
                  </Question>
                )}
                <Question title="Сколько времени в день готов заниматься?">
                  <Chips<number> value={[f.dailyMinutes]} onChange={(v) => set("dailyMinutes", v[0]!)} options={[15, 30, 45, 60, 90].map((m) => ({ value: m === 15 ? 20 : m, label: m === 15 ? "до 20 минут" : `${m} минут` }))} />
                </Question>
                <Question title="Что даётся труднее всего?">
                  <Chips<string>
                    value={[f.hardest]}
                    onChange={(v) => set("hardest", v[0]!)}
                    options={["Математика", "Чтение на английском", "Грамматика", "Говорение", "Эссе", "Тайм-менеджмент", "Алгоритмы"].map((x) => ({ value: x, label: x }))}
                  />
                </Question>
                <Field label="Куда хочешь поступить? (необязательно)" htmlFor="university">
                  <Input id="university" value={f.university} onChange={(e) => set("university", e.target.value)} placeholder="Например, NU, KAIST, Purdue" />
                </Field>
              </>
            )}
            {step === 3 && (
              <>
                <Question title="Что ещё интересно? (по желанию)">
                  <Chips<string>
                    multi
                    value={f.interests}
                    onChange={(v) => set("interests", v)}
                    options={["Робототехника", "Олимпиады", "Стартапы", "Дизайн", "Наука", "Дебаты", "Шахматы", "Музыка"].map((x) => ({ value: x, label: x }))}
                  />
                </Question>
                <div className="rounded-2xl bg-muted p-4 text-sm">
                  <p className="font-semibold">Как мы обращаемся с данными</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>Имя и почта хранятся на сервере школы и не передаются в ИИ.</li>
                    <li>ИИ получает только тексты ответов, эссе и код — без имени.</li>
                    <li>Ответы ИИ помечены как сгенерированные.</li>
                  </ul>
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <input id="consent" type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
                  <span>Я согласен(на) на обработку персональных данных. Если мне меньше 18 лет, согласие дал мой родитель или законный представитель.</span>
                </label>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        <ErrorBox message={error} />
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft /> Назад
            </Button>
          ) : (
            <Link to="/register" className="text-sm text-muted-foreground hover:text-foreground">
              Я учитель
            </Link>
          )}
          <Button size="lg" disabled={busy}>
            {step < 3 ? (
              <>
                Дальше <ArrowRight />
              </>
            ) : busy ? (
              "Создаю аккаунт…"
            ) : (
              "Создать аккаунт"
            )}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 font-display text-base font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

// ---------- teacher ----------

const SUBJECTS = ["Информатика", "Математика", "SAT Math", "SAT Reading & Writing", "IELTS", "Английский язык", "Робототехника", "Физика", "Химия", "Биология"];

function TeacherForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: "ms" as TeacherTitle, firstName: "", lastName: "", email: "", password: "", subjects: [] as string[], campus: "zhandosov" as Campus, inviteCode: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 0) {
      const msg = !f.firstName.trim() || !f.lastName.trim() ? "Укажите имя и фамилию" : !/^\S+@\S+\.\S+$/.test(f.email) ? "Проверьте почту" : f.password.length < 8 || !/[0-9]/.test(f.password) ? "Пароль: от 8 символов, с цифрой" : "";
      setError(msg);
      if (!msg) setStep(1);
      return;
    }
    if (!f.subjects.length) return setError("Выберите хотя бы один предмет");
    setBusy(true);
    setError("");
    try {
      const r = await api<{ token: string; user: PublicUser }>("/auth/register/teacher", { body: f });
      signIn(r.token, r.user);
      navigate("/teacher?welcome=1");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout image={ART.astronomer} quote={{ text: "Учитель открывает дверь, но войти ученик должен сам.", by: "Пословица" }}>
      <p className="eyebrow">Регистрация учителя</p>
      <h1 className="mb-6 mt-2 font-display text-3xl font-semibold">
        {step === 0 ? "Добро пожаловать" : `${TITLES[f.title]} ${f.lastName || "…"}, что вы преподаёте?`}
      </h1>
      <Steps step={step} labels={["Профиль", "Предметы и доступ"]} />
      <form onSubmit={submit} className="flex flex-col gap-5">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide} className="flex flex-col gap-4">
            {step === 0 ? (
              <>
                <Question title="Как к вам обращаться на платформе?">
                  <Chips<TeacherTitle> value={[f.title]} onChange={(v) => set("title", v[0]!)} options={(Object.keys(TITLES) as TeacherTitle[]).map((t) => ({ value: t, label: TITLES[t] }))} />
                </Question>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Имя" htmlFor="t-first">
                    <Input id="t-first" autoComplete="given-name" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} />
                  </Field>
                  <Field label="Фамилия" htmlFor="t-last">
                    <Input id="t-last" autoComplete="family-name" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
                  </Field>
                </div>
                <Field label="Рабочая почта" htmlFor="t-email">
                  <Input id="t-email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Пароль" htmlFor="t-password">
                  <Input id="t-password" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} />
                </Field>
                <PasswordChecklist password={f.password} />
              </>
            ) : (
              <>
                <Question title="Предметы">
                  <Chips<string> multi value={f.subjects} onChange={(v) => set("subjects", v)} options={SUBJECTS.map((s) => ({ value: s, label: s }))} />
                </Question>
                <Field label="Кампус" htmlFor="t-campus">
                  <Select id="t-campus" value={f.campus} onChange={(e) => set("campus", e.target.value as Campus)}>
                    {Object.entries(CAMPUSES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Код сотрудника" htmlFor="t-invite" hint="Выдаёт администрация школы. Без него аккаунт учителя не создаётся">
                  <Input id="t-invite" value={f.inviteCode} onChange={(e) => set("inviteCode", e.target.value)} autoComplete="off" />
                </Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        <ErrorBox message={error} />
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              <ArrowLeft /> Назад
            </Button>
          ) : (
            <Link to="/register" className="text-sm text-muted-foreground hover:text-foreground">
              Я ученик
            </Link>
          )}
          <Button size="lg" disabled={busy}>
            {step === 0 ? (
              <>
                Дальше <ArrowRight />
              </>
            ) : busy ? (
              "Создаю…"
            ) : (
              "Создать аккаунт учителя"
            )}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
