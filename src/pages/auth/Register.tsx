import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { Goals, PublicUser } from "@shared/types";
import { api } from "@/api";
import { useAuth } from "@/lib/auth";
import { ART } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorBox } from "@/components/Page";
import { PlantPicker } from "@/components/Plant";
import type { PlantSpecies } from "@shared/plants";
import AuthLayout from "./AuthLayout";

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

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.22 } };

type Aim = "sat" | "ielts" | "ent" | "coding";
type Who = "school" | "student" | "adult";

const COUNTRIES = ["США", "Великобритания", "Канада", "Европа", "Азия", "Пока не решил"];
const MAJORS = ["Медицина и биология", "Инженерия", "IT", "Бизнес и экономика", "Социальные и гуманитарные", "Естественные науки", "Пока не решил"];

export default function Register() {
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
    who: "school" as Who,
    grade: 11,
    aims: ["sat"] as Aim[],
    satTarget: 1400,
    satCurrent: "",
    satDate: "",
    ieltsTarget: 7,
    ieltsCurrent: "",
    ieltsDate: "",
    dailyMinutes: 30,
    hardest: "",
    country: "",
    major: "",
    interests: [] as string[],
    plant: "sunflower" as PlantSpecies,
    consent: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const checks: (() => string)[] = [
    () => (!f.firstName.trim() || !f.lastName.trim() ? "Укажи имя и фамилию" : !/^\S+@\S+\.\S+$/.test(f.email) ? "Проверь почту" : f.password.length < 8 || !/[0-9]/.test(f.password) ? "Пароль: от 8 символов, с цифрой" : ""),
    () => (!f.aims.length ? "Выбери хотя бы одну цель" : ""),
    () => "",
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
    const goals: Goals = { dailyMinutes: f.dailyMinutes, hardest: f.hardest || undefined, country: f.country || undefined, major: f.major || undefined };
    if (f.aims.includes("sat")) goals.sat = { target: f.satTarget, date: f.satDate, current: f.satCurrent ? Number(f.satCurrent) : undefined };
    if (f.aims.includes("ielts")) goals.ielts = { target: f.ieltsTarget, date: f.ieltsDate, current: f.ieltsCurrent ? Number(f.ieltsCurrent) : undefined };
    if (f.aims.includes("coding")) goals.coding = true;
    try {
      const r = await api<{ token: string; user: PublicUser }>("/auth/register", {
        body: { firstName: f.firstName, lastName: f.lastName, email: f.email, password: f.password, grade: f.who === "school" ? f.grade : null, goals, interests: f.interests, plant: f.plant, consent: f.consent },
      });
      signIn(r.token, r.user);
      navigate("/learn");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const labels = ["Аккаунт", "Цель", "Ритм", "Почти всё"];

  return (
    <AuthLayout image={ART.athens} quote={{ text: "Начни с цели — и платформа построит путь к ней.", by: "Росток" }}>
      <p className="eyebrow">7 дней Pro в подарок</p>
      <h1 className="mb-6 mt-2 font-display text-3xl font-semibold">{["Создай аккаунт", "К чему готовишься?", "Твой ритм", "Последний шаг"][step]}</h1>
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
                <Question title="Кто ты?">
                  <Chips<Who>
                    value={[f.who]}
                    onChange={(v) => set("who", v[0]!)}
                    options={[
                      { value: "school", label: "Школьник" },
                      { value: "student", label: "Студент" },
                      { value: "adult", label: "Взрослый" },
                    ]}
                  />
                  {f.who === "school" && (
                    <Field label="Класс" htmlFor="grade">
                      <Select id="grade" value={f.grade} onChange={(e) => set("grade", Number(e.target.value))}>
                        {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                          <option key={g} value={g}>
                            {g} класс
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </Question>
                <Question title="К чему готовишься?">
                  <Chips<Aim>
                    multi
                    value={f.aims}
                    onChange={(v) => set("aims", v)}
                    options={[
                      { value: "sat", label: "Digital SAT" },
                      { value: "ielts", label: "IELTS" },
                      { value: "ent", label: "ЕНТ" },
                      { value: "coding", label: "Программирование" },
                    ]}
                  />
                </Question>
                {f.aims.includes("sat") && (
                  <Question title={`Цель по SAT: ${f.satTarget}`}>
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
                  <Question title={`Цель по IELTS: ${f.ieltsTarget}`}>
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
              </>
            )}
            {step === 2 && (
              <>
                <Question title="Сколько времени в день готов заниматься?">
                  <Chips<number> value={[f.dailyMinutes]} onChange={(v) => set("dailyMinutes", v[0]!)} options={[20, 30, 45, 60, 90].map((m) => ({ value: m, label: m === 20 ? "до 20 минут" : `${m} минут` }))} />
                </Question>
                <Question title="Что даётся труднее всего?">
                  <Chips<string> value={[f.hardest]} onChange={(v) => set("hardest", v[0]!)} options={["Математика", "Чтение на английском", "Грамматика", "Говорение", "Эссе", "Тайм-менеджмент", "Алгоритмы"].map((x) => ({ value: x, label: x }))} />
                </Question>
                <Question title="Куда поступаешь? (необязательно)">
                  <Chips<string> value={[f.country]} onChange={(v) => set("country", v[0]!)} options={COUNTRIES.map((x) => ({ value: x, label: x }))} />
                </Question>
                <Question title="Направление (необязательно)">
                  <Chips<string> value={[f.major]} onChange={(v) => set("major", v[0]!)} options={MAJORS.map((x) => ({ value: x, label: x }))} />
                </Question>
              </>
            )}
            {step === 3 && (
              <>
                <Question title="Выбери растение-спутника: оно растёт вместе с тобой">
                  <PlantPicker value={f.plant} onChange={(v) => set("plant", v)} />
                </Question>
                <Question title="Что ещё интересно? (по желанию)">
                  <Chips<string> multi value={f.interests} onChange={(v) => set("interests", v)} options={["Робототехника", "Олимпиады", "Стартапы", "Дизайн", "Наука", "Дебаты", "Шахматы", "Музыка"].map((x) => ({ value: x, label: x }))} />
                </Question>
                <div className="rounded-2xl bg-muted p-4 text-sm">
                  <p className="font-semibold">Как мы обращаемся с данными</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>Имя и почта хранятся на нашем сервере и не передаются в ИИ.</li>
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
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Уже есть аккаунт
            </Link>
          )}
          <Button type="submit" disabled={busy}>
            {step < 3 ? (
              <>
                Дальше <ArrowRight />
              </>
            ) : busy ? (
              "Создаём…"
            ) : (
              "Начать с Pro на 7 дней"
            )}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
