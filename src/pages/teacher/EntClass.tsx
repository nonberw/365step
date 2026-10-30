import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarClock, CheckCircle2, ClipboardList, Medal, Send, Sparkles, Target, Users } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card, Empty, Segmented } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import NumberTicker from "@/components/ui/basic-number-ticker";
import { AnimatedRadialChart } from "@/components/ui/animated-radial-chart";
import { CircleProgress } from "@/components/ui/circle-progress";
import { Spotlight, Tilt } from "@/components/ui/tilt";
import { Aurora } from "@/pages/ent/EntHome";
import { ENT_IMAGE } from "@/pages/ent/visuals";

interface Student {
  id: string;
  name: string;
  pair: string | null;
  target: number | null;
  best: number | null;
  last: { total: number; at: number; passedAll: boolean; subjects: { id: string; name: string; points: number; max: number; passed: boolean }[] } | null;
  trend: number[];
  fullTests: number;
  miniTests: number;
  practiced: number;
  lastActive: number | null;
}

interface ClassEnt {
  classRoom: { code: string; name: string };
  summary: { students: number; withProfile: number; fullTests: number; miniTests: number; avgBest: number | null; topBest: number | null; passed: { label: string; points: number; count: number }[] };
  students: Student[];
  blocks: { id: string; name: string; pct: number; passed: number; n: number }[];
  weakTopics: { subject: string; name: string; topic: string; total: number; pct: number }[];
  pairs: { pair: string; count: number; subjects: string[] }[];
  assignments: { id: string; title: string; kind: string; ref: string; dueAt: number | null; createdAt: number; done: number; total: number }[];
  subjects: { id: string; name: string; count: number }[];
}

const ease = [0.22, 1, 0.36, 1] as const;

export default function EntClass() {
  const overview = useApi<{ classes: { code: string; name: string; students: number }[] }>("/teacher/overview");
  const [params, setParams] = useSearchParams();
  const code = params.get("class") ?? overview.data?.classes[0]?.code ?? null;
  const ent = useApi<ClassEnt>(code ? `/ent/teacher/${code}` : null);

  if (overview.loading) return <Loading />;
  if (!overview.data?.classes.length)
    return (
      <Empty title="Сначала создайте класс">
        <Link to="/teacher/classes" className="font-semibold text-primary">
          Мои классы
        </Link>{" "}
        — ученики вступят по коду, и здесь появится их подготовка к ЕНТ.
      </Empty>
    );

  const data = ent.data;
  const empty = data && data.summary.fullTests === 0 && data.summary.miniTests === 0 && data.students.every((s) => s.practiced === 0);

  return (
    <div className="flex flex-col gap-8">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#120d0d] text-white">
        <Aurora />
        <div className="relative grid grid-cols-1 items-center gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/80">
              <Medal className="size-3.5 text-[#ff8562]" /> ЕНТ класса
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
              {data?.classRoom.name ?? "Подготовка класса"}
              <span className="block bg-gradient-to-r from-[#ff8562] to-[#ff3b3b] bg-clip-text text-transparent">к ЕНТ</span>
            </h1>
            <p className="max-w-xl text-white/70">Кто выбрал профильные предметы, сколько пробников прошёл каждый, какие блоки и темы проседают у класса — и задание на пробник в один клик.</p>
            <div className="flex flex-wrap gap-1.5">
              {overview.data.classes.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setParams({ class: c.code })}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", c.code === code ? "bg-white text-[#120d0d]" : "bg-white/10 text-white/80 hover:bg-white/20")}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          {data && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex justify-center rounded-3xl border border-white/10 bg-white/[0.05] p-4">
                <AnimatedRadialChart
                  value={data.summary.avgBest ?? 0}
                  max={140}
                  size={Math.min(260, typeof window !== "undefined" ? window.innerWidth - 110 : 260)}
                  dark
                  label={data.summary.avgBest !== null ? "средний лучший результат класса" : "пробников ещё нет"}
                />
              </div>
              <HeroStat icon={<Users className="size-4" />} value={data.summary.withProfile} suffix={` из ${data.summary.students}`} label="выбрали профиль" />
              <HeroStat icon={<ClipboardList className="size-4" />} value={data.summary.fullTests + data.summary.miniTests} label="пробников пройдено" />
            </div>
          )}
        </div>
      </section>

      {ent.loading ? <Loading /> : ent.error ? <ErrorBox message={ent.error} /> : null}

      {data && (
        <>
          {empty && <EmptyState students={data.summary.students} />}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
            <AssignCard code={data.classRoom.code} subjects={data.subjects} onDone={ent.reload} />
            <AssignmentsCard data={data} />
          </div>

          {!empty && (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <ThresholdsCard data={data} />
                <BlocksCard data={data} />
                <WeakTopicsCard data={data} />
              </div>
              <PairsCard data={data} />
            </>
          )}

          <StudentsCard data={data} />
        </>
      )}
    </div>
  );
}

function HeroStat({ icon, value, suffix, label }: { icon: React.ReactNode; value: number; suffix?: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
      <span className="flex items-center gap-1.5 text-xs text-white/60">
        {icon} {label}
      </span>
      <span className="mt-1 block font-display text-3xl font-bold tabular">
        <NumberTicker from={0} target={value} transition={{ duration: 1.2, ease: "easeOut" }} />
        {suffix && <span className="text-base font-semibold text-white/50">{suffix}</span>}
      </span>
    </div>
  );
}

function Title({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <h2 className="mt-1 font-display text-xl font-semibold">{title}</h2>
    </div>
  );
}

// ---------- empty state: a preview of what will appear ----------

function EmptyState({ students }: { students: number }) {
  const steps = [
    {
      icon: <Users className="size-5" />,
      title: "Ученики выбирают предметы",
      text: students ? `В классе ${students} учеников. Каждый в разделе «Подготовка к ЕНТ» выбирает профильную пару и цель.` : "Дайте ученикам код класса — они вступят и выберут профильную пару.",
    },
    { icon: <Send className="size-5" />, title: "Вы задаёте пробник", text: "Полный ЕНТ на 240 минут или мини-пробник по предмету — со сроком. Задание сразу появится у учеников." },
    { icon: <Sparkles className="size-5" />, title: "Здесь появится аналитика", text: "Средний балл, пороги, слабые блоки и темы класса, прогресс каждого ученика." },
  ];
  const preview = [62, 71, 68, 84, 79, 93];
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card className="flex flex-col gap-4">
        <Title eyebrow="Пока данных нет" title="Как начать подготовку класса" />
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <motion.li key={s.title} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.1, ease }} className="flex gap-3 rounded-2xl bg-muted/50 p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">{s.icon}</span>
              <span>
                <span className="block font-display font-semibold">
                  {i + 1}. {s.title}
                </span>
                <span className="text-sm text-muted-foreground">{s.text}</span>
              </span>
            </motion.li>
          ))}
        </ol>
      </Card>
      <Tilt rotationFactor={5} isReverse springOptions={{ stiffness: 220, damping: 22 }}>
        <div className="relative h-full overflow-hidden rounded-3xl border border-border bg-card p-5">
          <Spotlight size={260} />
          <span className="absolute right-4 top-4 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">так это будет выглядеть</span>
          <p className="font-display text-sm font-semibold">Средний балл класса</p>
          <div className="mt-6 flex h-36 items-end gap-2" aria-hidden="true">
            {preview.map((v, i) => (
              <motion.span
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${(v / 140) * 100 + 20}%` }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.6, ease }}
                className="flex-1 rounded-t-lg bg-gradient-to-t from-primary/40 to-[#ff8562]/70"
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 opacity-60 blur-[1.5px]" aria-hidden="true">
            {["История 14/20", "Математика 38/50", "Физика 31/50", "Порог 50 — 18 из 24"].map((x) => (
              <span key={x} className="rounded-full bg-muted px-3 py-1 text-xs">
                {x}
              </span>
            ))}
          </div>
        </div>
      </Tilt>
    </motion.section>
  );
}

// ---------- assign a mock test ----------

function AssignCard({ code, subjects, onDone }: { code: string; subjects: ClassEnt["subjects"]; onDone: () => void }) {
  const [kind, setKind] = useState<"ent-full" | "ent-subject">("ent-full");
  const [subject, setSubject] = useState("math");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const name = subjects.find((s) => s.id === subject)?.name ?? "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/teacher/classes/${code}/assignments`, {
        body: { kind, ref: kind === "ent-subject" ? subject : "", title: kind === "ent-full" ? "Пробный ЕНТ (240 минут)" : `Мини-пробник ЕНТ: ${name}`, dueAt: due || null },
      });
      setSent(true);
      onDone();
      setTimeout(() => setSent(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="relative flex flex-col gap-4 overflow-hidden">
      <img src={ENT_IMAGE[kind === "ent-full" ? "math" : subject]} alt="" className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full object-cover opacity-15" />
      <Title eyebrow="Задание классу" title="Задать пробник" />
      <form onSubmit={submit} className="relative flex flex-col gap-3">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "ent-full", label: "Полный ЕНТ · 240 мин" },
            { value: "ent-subject", label: "Мини-пробник по предмету" },
          ]}
        />
        {kind === "ent-subject" && (
          <Select aria-label="Предмет" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10">
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.count} заданий
              </option>
            ))}
          </Select>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Срок
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-10" />
        </label>
        <p className="text-xs text-muted-foreground">Полный пробник каждый ученик проходит по своей профильной паре. Выполнение отмечается само, когда ученик завершит пробник.</p>
        <ErrorBox message={error} />
        <Button disabled={busy} className="self-start">
          {sent ? <CheckCircle2 /> : <Send />} {sent ? "Задание выдано" : busy ? "Выдаю…" : "Выдать классу"}
        </Button>
      </form>
    </Card>
  );
}

function AssignmentsCard({ data }: { data: ClassEnt }) {
  return (
    <Card className="flex flex-col gap-3">
      <Title eyebrow="Выполнение" title="Задания по ЕНТ" />
      {!data.assignments.length ? (
        <p className="text-sm text-muted-foreground">Заданий по ЕНТ ещё не было. Выдайте первый пробник — здесь будет видно, кто его прошёл.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.assignments.map((a, i) => (
            <motion.li key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <CircleProgress value={a.total ? (a.done / a.total) * 100 : 0} size={52} stroke={5}>
                <span className="text-[11px] font-bold tabular">
                  {a.done}/{a.total}
                </span>
              </CircleProgress>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.title}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="size-3" /> выдано {fmtDate(a.createdAt)}
                  {a.dueAt ? ` · срок ${fmtDate(a.dueAt)}` : ""}
                </span>
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------- analytics ----------

function ThresholdsCard({ data }: { data: ClassEnt }) {
  const n = Math.max(1, data.summary.students);
  return (
    <Card className="flex flex-col gap-4">
      <Title eyebrow="По последнему пробнику" title="Проходят пороги" />
      {data.summary.passed.map((t, i) => (
        <div key={t.label} className="flex flex-col gap-1">
          <span className="flex justify-between text-sm">
            <span>
              {t.label} · <b className="font-display">{t.points}</b>
            </span>
            <span className="tabular text-muted-foreground">
              {t.count} из {data.summary.students}
            </span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${(t.count / n) * 100}%` }}
              transition={{ delay: i * 0.1, duration: 0.7, ease }}
              className="block h-full rounded-full bg-gradient-to-r from-[#ff8562] to-primary"
            />
          </span>
        </div>
      ))}
    </Card>
  );
}

function BlocksCard({ data }: { data: ClassEnt }) {
  return (
    <Card className="flex flex-col gap-4">
      <Title eyebrow="Средний % баллов" title="Блоки экзамена" />
      {!data.blocks.length ? (
        <p className="text-sm text-muted-foreground">Появится после первых полных пробников.</p>
      ) : (
        data.blocks
          .sort((a, b) => a.pct - b.pct)
          .map((b, i) => (
            <div key={b.id} className="flex items-center gap-3">
              <img src={ENT_IMAGE[b.id]} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span className="flex justify-between text-sm">
                  <span className="truncate">{b.name}</span>
                  <b className={cn("font-display tabular", b.pct < 40 && "text-primary")}>{b.pct}%</b>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${b.pct}%` }}
                    transition={{ delay: i * 0.08, duration: 0.6, ease }}
                    className={cn("block h-full rounded-full", b.pct < 40 ? "bg-primary" : "bg-success")}
                  />
                </span>
              </span>
            </div>
          ))
      )}
    </Card>
  );
}

function WeakTopicsCard({ data }: { data: ClassEnt }) {
  return (
    <Card className="flex flex-col gap-3 bg-secondary text-secondary-foreground">
      <div>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Где класс ошибается</p>
        <h2 className="mt-1 font-display text-xl font-semibold">Слабые темы</h2>
      </div>
      {!data.weakTopics.length ? (
        <p className="text-sm text-white/60">Появятся, когда ученики решат хотя бы по 3 задания темы.</p>
      ) : (
        data.weakTopics.map((t, i) => (
          <motion.div
            key={`${t.subject}:${t.topic}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2"
          >
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg font-display text-sm font-bold", t.pct < 40 ? "bg-primary" : t.pct < 70 ? "bg-[#ff8562] text-[#120d0d]" : "bg-emerald-600")}>
              {t.pct}%
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-medium">{t.topic}</span>
              <span className="text-xs text-white/55">
                {t.name} · {t.total} ответов
              </span>
            </span>
          </motion.div>
        ))
      )}
    </Card>
  );
}

function PairsCard({ data }: { data: ClassEnt }) {
  if (!data.pairs.length) return null;
  const total = data.pairs.reduce((s, p) => s + p.count, 0);
  const colors = ["#7b0004", "#b5121b", "#ff8562", "#1d1919", "#5f5a5a", "#a8a2a2"];
  return (
    <Card className="flex flex-col gap-4">
      <Title eyebrow="Куда поступают" title="Профильные пары класса" />
      <div className="flex h-4 overflow-hidden rounded-full">
        {data.pairs.map((p, i) => (
          <motion.span
            key={p.pair}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{ width: `${(p.count / total) * 100}%`, background: colors[i % colors.length], transformOrigin: "left" }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {data.pairs.map((p, i) => (
          <span key={p.pair} className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
            <span className="size-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />
            {p.subjects.join(" + ")} · <b>{p.count}</b>
          </span>
        ))}
      </div>
    </Card>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">{values.length ? "1 пробник" : "—"}</span>;
  const w = 90;
  const h = 28;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / 140) * h}`).join(" ");
  return (
    <svg width={w} height={h} aria-label="Динамика полных пробников">
      <motion.polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
    </svg>
  );
}

function StudentsCard({ data }: { data: ClassEnt }) {
  const [sort, setSort] = useState<"name" | "best">("best");
  const rows = [...data.students].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "ru") : (b.best ?? -1) - (a.best ?? -1)));
  const pairName = (id: string | null) => (id ? (data.pairs.find((p) => p.pair === id)?.subjects.join(" + ") ?? id) : null);
  return (
    <Card className="flex flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Title eyebrow="Каждый ученик" title="Результаты класса" />
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: "best", label: "По баллу" },
            { value: "name", label: "По фамилии" },
          ]}
        />
      </div>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">В классе пока нет учеников.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Ученик</th>
                <th className="px-2 py-2 font-medium">Лучший</th>
                <th className="px-2 py-2 font-medium">Динамика</th>
                <th className="px-2 py-2 font-medium">Последний пробник по блокам</th>
                <th className="px-2 py-2 font-medium">Активность</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-border transition-colors hover:bg-muted/40">
                  <td className="px-2 py-3">
                    <Link to={`/teacher/students/${s.id}`} className="font-medium hover:text-primary">
                      {s.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{pairName(s.pair) ?? "профиль не выбран"}</span>
                  </td>
                  <td className="px-2 py-3">
                    {s.best !== null ? (
                      <span className="flex items-center gap-1.5">
                        <b className="font-display text-lg tabular">{s.best}</b>
                        {s.target ? (
                          <span className={cn("inline-flex items-center gap-0.5 text-xs", s.best >= s.target ? "text-success" : "text-muted-foreground")}>
                            <Target className="size-3" />
                            {s.target}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <Spark values={s.trend} />
                  </td>
                  <td className="px-2 py-3">
                    {s.last ? (
                      <span className="flex flex-wrap gap-1">
                        {s.last.subjects.map((b) => (
                          <span
                            key={b.id}
                            title={`${b.name}: ${b.points} из ${b.max}`}
                            className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular", b.passed ? "bg-success/15 text-success" : "bg-primary/15 text-primary")}
                          >
                            {b.points}/{b.max}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">полного пробника ещё нет</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">
                    {s.fullTests + s.miniTests} пробн. · {s.practiced} отв.
                    {s.lastActive ? <span className="block">{fmtDate(s.lastActive)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
