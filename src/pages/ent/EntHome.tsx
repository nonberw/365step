import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, Flag, Pencil, Timer } from "lucide-react";
import type { EntLang, EntType } from "@shared/ent";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HeroPill, StarIcon } from "@/components/ui/hero-pill";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { AnimatedCountdown } from "@/components/ui/animated-countdown";
import { AnimatedRadialChart } from "@/components/ui/animated-radial-chart";
import { CircleProgress } from "@/components/ui/circle-progress";
import { Spotlight, Tilt } from "@/components/ui/tilt";
import { ENT_COLOR, ENT_IMAGE, PROFILE_COLORS } from "./visuals";
import { EntPlan } from "./EntPlan";

export interface EntMeta {
  profile: { pair: string; lang: EntLang; target: number | null } | null;
  subjects: { id: string; name: string; kind: "mandatory" | "profile"; count: number; max: number; topics: string[]; threshold: number; icon: string; plan: { type: EntType; count: number }[] }[];
  pairs: { id: string; subjects: [string, string]; fields: string }[];
  thresholds: { label: string; points: number }[];
  resources: { title: string; url: string; text: string }[];
  sessions: { name: string; dates: string; note: string }[];
  stats: Record<string, { total: number; right: number }>;
  topicStats: Record<string, { total: number; right: number }>;
  tests: { id: string; kind: string; subjects: string[]; startedAt: number; finishedAt: number | null; total: number | null; max: number | null }[];
}

export function useStartTest() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function start(kind: "full" | "subject", subject?: string) {
    setBusy(subject ?? "full");
    setError("");
    try {
      const r = await api<{ id: string }>("/ent/test/start", { body: { kind, subject } });
      navigate(`/ent/test/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }
  return { start, busy, error };
}

const MAIN_SESSION = Date.UTC(2027, 4, 10) - 5 * 3600_000;
const SHORT: Record<string, string> = { "Большинство вузов": "вузы", "Национальные вузы": "нац. вузы", Здравоохранение: "медицина", "Педагогика и право": "педагогика, право" };
const ease = [0.22, 1, 0.36, 1] as const;

export default function EntHome() {
  const { data, error, loading, setData } = useApi<EntMeta>("/ent/meta");
  const { start, busy, error: startError } = useStartTest();
  const [editing, setEditing] = useState(false);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const sub = (id: string) => data.subjects.find((s) => s.id === id)!;
  const pair = data.profile ? data.pairs.find((p) => p.id === data.profile!.pair) : null;
  const mine = pair ? ["history-kz", "reading", "math-lit", ...pair.subjects].map(sub) : [];
  const best = data.tests.filter((t) => t.kind === "full" && t.total !== null).reduce((m, t) => Math.max(m, t.total!), 0);

  return (
    <div className="flex flex-col gap-8">
      <Hero meta={data} best={best} hasPair={!!pair} busy={busy === "full"} onStart={() => start("full")} onPick={() => setEditing(true)} />
      <ErrorBox message={busy ? "" : startError} />

      <AnimatePresence initial={false}>
        {(!pair || editing) && (
          <motion.section key="pairs" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease }} className="overflow-hidden">
            <PairPicker
              meta={data}
              onSaved={(profile) => {
                setData({ ...data, profile });
                setEditing(false);
              }}
            />
          </motion.section>
        )}
      </AnimatePresence>

      {pair && !editing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <div className="flex -space-x-3">
            {pair.subjects.map((s) => (
              <img key={s} src={ENT_IMAGE[s]} alt="" className="size-10 rounded-full border-2 border-card object-cover" />
            ))}
          </div>
          <span className="min-w-[11rem] flex-1">
            <span className="block font-display font-semibold">
              {sub(pair.subjects[0]).name} + {sub(pair.subjects[1]).name}
            </span>
            <span className="text-xs text-muted-foreground">
              {pair.fields} · {data.profile!.lang === "kk" ? "на казахском" : "на русском"}
              {data.profile!.target ? ` · цель ${data.profile!.target}` : ""}
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Изменить
          </Button>
        </motion.div>
      )}

      {pair && !editing && <EntPlan meta={data} onStart={start} busy={busy} />}

      {pair && <ScoreBar mine={mine} thresholds={data.thresholds} best={best} />}

      {pair && (
        <section className="flex flex-col gap-4">
          <SectionTitle eyebrow="Тренировка и мини-пробники" title="Мои предметы" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            {mine.map((s, i) => (
              <SubjectCard key={s.id} s={s} stat={data.stats[s.id]} index={i} wide={s.kind === "profile"} busy={busy === s.id} disabled={!!busy} onMini={() => start("subject", s.id)} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        <FormatCard meta={data} />
        <Resources meta={data} />
      </div>

      {data.tests.length > 0 && <History meta={data} />}
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-semibold">{title}</h2>
    </div>
  );
}

// ---------- hero: aurora, countdown and score gauge ----------

import { Aurora } from "@/components/Aurora";
export { Aurora };

function Hero({ meta, best, hasPair, busy, onStart, onPick }: { meta: EntMeta; best: number; hasPair: boolean; busy: boolean; onStart: () => void; onPick: () => void }) {
  const words = ["Сдай", "ЕНТ", "на", "свой", "максимум"];
  const gauge = typeof window !== "undefined" ? Math.min(300, window.innerWidth - 130) : 300;
  const strip = [...meta.subjects, ...meta.subjects];
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#2f69cf_0%,#4f8ae0_55%,#8ab7ef_100%)] text-white">
      <Aurora />
      <div className="relative grid grid-cols-1 items-center gap-8 px-6 pb-6 pt-8 sm:px-10 sm:pt-10 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-5">
          <HeroPill tone="glass" icon={<StarIcon />} text="ЕНТ 2027 · основная сессия с 10 мая" />
          <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-6xl">
            {words.map((w, i) => (
              <motion.span
                key={w}
                initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.08 * i, duration: 0.6, ease }}
                className={cn("mr-3 inline-block", w === "максимум" && "font-medium italic text-white/85")}
              >
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="max-w-xl text-white/70">
            Пробники в точном формате: 120 заданий, 140 баллов, 240 минут, калькулятор и таблица Менделеева. После каждого — карта анализа и разбор ошибок от ИИ, которого нет в официальном пробнике.
          </motion.p>
          <AnimatedCountdown target={MAIN_SESSION} dark />
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="flex flex-wrap gap-2">
            {hasPair ? (
              <Button size="lg" onClick={onStart} disabled={busy} className="shadow-lg shadow-primary/30">
                <Timer /> {busy ? "Собираю вариант… до 2 минут" : "Начать пробный ЕНТ"}
              </Button>
            ) : (
              <Button size="lg" onClick={onPick}>
                Выбрать профильные предметы <ArrowRight />
              </Button>
            )}
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6, ease }}
          className="mx-auto flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/35 bg-white/15 p-4 backdrop-blur sm:p-5"
        >
          <AnimatedRadialChart
            value={best}
            max={140}
            target={meta.profile?.target}
            size={gauge}
            dark
            label={best ? `лучший пробник${meta.profile?.target ? ` · цель ${meta.profile.target}` : ""}` : "пройди первый пробник"}
          />
          <div className="mt-4 grid w-full grid-cols-4 gap-1.5 text-center text-[11px]">
            {meta.thresholds.map((t) => (
              <span key={t.label} className={cn("rounded-lg px-1 py-1.5", best >= t.points ? "bg-emerald-500/20 text-emerald-200" : "bg-white/[0.06] text-white/60")}>
                <b className="block font-display text-base text-white">{t.points}</b>
                {SHORT[t.label] ?? t.label}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
      <div className="relative border-t border-white/10 py-3 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-3">
          {strip.map((s, i) => (
            <span key={i} className="flex items-center gap-2 rounded-full border border-white/40 bg-white/25 py-1 pl-1 pr-3 text-xs font-semibold text-white">
              <img src={ENT_IMAGE[s.id]} alt="" className="size-6 rounded-full object-cover" loading="lazy" />
              {s.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- profile pair picker ----------

function PairPicker({ meta, onSaved }: { meta: EntMeta; onSaved: (p: EntMeta["profile"]) => void }) {
  const [pair, setPair] = useState(meta.profile?.pair ?? "math-physics");
  const [lang, setLang] = useState<EntLang>(meta.profile?.lang ?? "ru");
  const [target, setTarget] = useState(meta.profile?.target ?? 100);
  const [busy, setBusy] = useState(false);
  const name = (id: string) => meta.subjects.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="flex flex-col gap-4 pb-1">
      <SectionTitle eyebrow="Шаг 1" title="Выбери профильные предметы" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {meta.pairs.map((p, i) => {
          const on = pair === p.id;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Tilt rotationFactor={6} isReverse springOptions={{ stiffness: 260, damping: 20 }} className="h-full">
                <button
                  type="button"
                  onClick={() => setPair(p.id)}
                  className={cn(
                    "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 bg-card text-left transition-colors",
                    on ? "border-primary shadow-lg shadow-primary/15" : "border-border hover:border-foreground/30",
                  )}
                >
                  <Spotlight size={220} />
                  <div className="relative flex h-28">
                    {p.subjects.map((s, k) => (
                      <img
                        key={s}
                        src={ENT_IMAGE[s]}
                        alt=""
                        loading="lazy"
                        className={cn(
                          "h-full w-1/2 object-cover grayscale transition duration-500 group-hover:grayscale-0",
                          on && "grayscale-0",
                          k === 1 && "[clip-path:polygon(12%_0,100%_0,100%_100%,0_100%)] -ml-[6%] w-[56%]",
                        )}
                      />
                    ))}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    {on && (
                      <motion.span layoutId="pair-check" className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-4" />
                      </motion.span>
                    )}
                    <span className="absolute bottom-2 left-3 right-3 font-display text-sm font-semibold text-white drop-shadow">
                      {name(p.subjects[0])} + {name(p.subjects[1])}
                    </span>
                  </div>
                  <span className="px-3 py-2.5 text-xs text-muted-foreground">{p.fields}</span>
                </button>
              </Tilt>
            </motion.div>
          );
        })}
      </div>
      <Card className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Язык теста
          <Select value={lang} onChange={(e) => setLang(e.target.value as EntLang)} className="h-10 w-44">
            <option value="ru">Русский</option>
            <option value="kk">Қазақша</option>
          </Select>
        </label>
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium">
          Цель: <span className="font-display text-xl font-bold text-primary">{target} баллов</span>
          <input type="range" min={50} max={140} step={5} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="accent-[var(--primary)]" />
        </label>
        <Button
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              onSaved(await api<EntMeta["profile"]>("/ent/profile", { body: { pair, lang, target } }));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Check /> Сохранить
        </Button>
      </Card>
    </div>
  );
}

// ---------- 140 points, split by blocks, with threshold marks ----------

function ScoreBar({ mine, thresholds, best }: { mine: EntMeta["subjects"]; thresholds: EntMeta["thresholds"]; best: number }) {
  let profileIdx = 0;
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle eyebrow="Из чего складываются 140 баллов" title="Карта экзамена" />
      <div className="relative pt-7">
        {thresholds.map((t) => (
          <span key={t.label} className="absolute top-0 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground" style={{ left: `${(t.points / 140) * 100}%` }}>
            <span className={cn(t.points !== 50 && t.points !== 75 && "hidden sm:inline")}>{t.points}</span>
            <span className="absolute left-1/2 top-4 h-[70px] w-px -translate-x-1/2 bg-foreground/25" />
          </span>
        ))}
        <div className="flex h-14 overflow-hidden rounded-2xl">
          {mine.map((s, i) => {
            const color = ENT_COLOR[s.id] ?? PROFILE_COLORS[profileIdx++];
            return (
              <motion.div
                key={s.id}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6, ease }}
                style={{ width: `${(s.max / 140) * 100}%`, background: color, transformOrigin: "left" }}
                className="flex items-center justify-center border-r border-white/20 px-1 text-center text-[11px] font-semibold leading-tight text-white last:border-r-0"
              >
                <span className="truncate">
                  {s.name} · {s.max}
                </span>
              </motion.div>
            );
          })}
        </div>
        {best > 0 && (
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${(best / 140) * 100}%` }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 0.8, ease }}
            className="mt-2 h-2 rounded-full bg-gradient-to-r from-[#8fb0ff] to-primary"
          />
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Вертикальные линии — пороги 2026 года: 50 (большинство вузов), 65 (национальные), 70 (медицина), 75 (педагогика и право). {best > 0 && `Полоса снизу — твой лучший результат: ${best}.`}
        </p>
      </div>
    </section>
  );
}

// ---------- subject cards (bento) ----------

function SubjectCard({
  s,
  stat,
  index,
  wide,
  busy,
  disabled,
  onMini,
}: {
  s: EntMeta["subjects"][number];
  stat?: { total: number; right: number };
  index: number;
  wide: boolean;
  busy: boolean;
  disabled: boolean;
  onMini: () => void;
}) {
  const pct = stat?.total ? Math.round((stat.right / stat.total) * 100) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, duration: 0.5, ease }}
      className={cn(wide ? "md:col-span-3" : "md:col-span-2")}
    >
      <Tilt rotationFactor={4} isReverse springOptions={{ stiffness: 220, damping: 22 }} className="h-full">
        <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card">
          <Spotlight size={260} className="z-10" />
          <div className={cn("relative overflow-hidden", wide ? "h-40" : "h-32")}>
            <img src={ENT_IMAGE[s.id]} alt="" loading="lazy" className="h-full w-full scale-105 object-cover grayscale-[60%] transition duration-700 group-hover:scale-100 group-hover:grayscale-0" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2 text-white">
              <span>
                <span className="block font-display text-lg font-semibold leading-tight">{s.name}</span>
                <span className="text-xs text-white/75">
                  {s.count} заданий · {s.max} баллов · порог {s.threshold}
                </span>
              </span>
              {s.kind === "profile" && <Badge tone="brand">профиль</Badge>}
            </div>
          </div>
          <div className="flex flex-1 items-center gap-4 p-4">
            <CircleProgress value={pct} size={64} stroke={6}>
              <span className="font-display text-sm font-bold tabular">{stat?.total ? `${pct}%` : "—"}</span>
            </CircleProgress>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-xs text-muted-foreground">{stat?.total ? `${stat.total} ответов в тренировках` : "ещё не решал"}</span>
              <div className="flex flex-wrap gap-2">
                <Link to={`/ent/practice/${s.id}`} className="group/btn inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
                  Тренировка <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
                </Link>
                <Button variant="outline" size="sm" className="h-9" onClick={onMini} disabled={disabled}>
                  {busy ? "Собираю…" : `Мини-пробник · ${Math.round((240 * s.count) / 120)} мин`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Tilt>
    </motion.div>
  );
}

// ---------- format, sessions, resources, history ----------

function FormatCard({ meta }: { meta: EntMeta }) {
  const parts = [
    { label: "Один ответ", count: 25, pts: "по 1 баллу", color: "#1d1919" },
    { label: "Контекстные", count: 5, pts: "по 1 баллу", color: "#1f48b0" },
    { label: "Несколько ответов", count: 5, pts: "до 2 баллов", color: "#b5121b" },
    { label: "Соответствие", count: 5, pts: "до 2 баллов", color: "#8fb0ff" },
  ];
  return (
    <Card className="flex flex-col gap-5">
      <SectionTitle eyebrow="Формат 2026–2027" title="Профильный предмет: 40 заданий, 50 баллов" />
      <div className="flex h-3 overflow-hidden rounded-full">
        {parts.map((p, i) => (
          <motion.span
            key={p.label}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{ width: `${(p.count / 40) * 100}%`, background: p.color, transformOrigin: "left" }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2">
            <span className="size-3 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 text-sm">
              <b className="font-display">{p.count}</b> · {p.label}
              <span className="block text-xs text-muted-foreground">{p.pts}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        В заданиях на 2 балла одна ошибка даёт 1 балл, две и больше — 0. Обязательные блоки (история, грамотность чтения, математическая грамотность) — по 1 баллу за задание.
      </p>
      <ol className="relative flex flex-col gap-3 border-l border-border pl-5">
        {meta.sessions.map((s, i) => (
          <motion.li key={s.name} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="relative">
            <span className={cn("absolute -left-[26px] top-1 size-3 rounded-full border-2 border-card", s.name === "Основная" ? "bg-primary ring-4 ring-primary/20" : "bg-muted-foreground/50")} />
            <p className="text-sm font-semibold">
              {s.name} сессия · <span className="font-normal text-muted-foreground">{s.dates}</span>
            </p>
            <p className="text-xs text-muted-foreground">{s.note}</p>
          </motion.li>
        ))}
      </ol>
    </Card>
  );
}

function Resources({ meta }: { meta: EntMeta }) {
  return (
    <Card className="flex flex-col gap-4 bg-secondary text-secondary-foreground">
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-accent">Официально и бесплатно</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Материалы НЦТ</h2>
      </div>
      <p className="text-sm text-white/65">
        Задания ЕНТ закрыты, поэтому мы их не копируем: на платформе только оригинальные задания в формате ЕНТ. Спецификации, образцы и официальный пробник — у Национального центра тестирования.
      </p>
      {meta.resources.map((r, i) => (
        <motion.a
          key={r.url}
          href={r.url}
          target="_blank"
          rel="noreferrer"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06 }}
          className="group flex items-start gap-3 rounded-2xl border border-white/35 bg-white/15 p-3 transition-colors hover:border-[#8fb0ff]/60 hover:bg-white/[0.07]"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-display font-semibold">{r.title}</span>
            <span className="text-xs text-white/60">{r.text}</span>
          </span>
          <ArrowUpRight className="size-5 shrink-0 text-white/50 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#ffd84d]" />
        </motion.a>
      ))}
    </Card>
  );
}

function History({ meta }: { meta: EntMeta }) {
  const name = (id: string) => meta.subjects.find((s) => s.id === id)?.name ?? id;
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle eyebrow="Прогресс" title="Мои пробники" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {meta.tests.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
            <Link to={`/ent/test/${t.id}`} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display font-semibold">{t.kind === "full" ? "Полный пробный ЕНТ" : `Мини-пробник: ${name(t.subjects[0]!)}`}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(t.startedAt)}</span>
                {t.total !== null && (
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-gradient-to-r from-[#8fb0ff] to-primary" style={{ width: `${(t.total / Math.max(1, t.max ?? 1)) * 100}%` }} />
                  </span>
                )}
              </span>
              {t.total !== null ? (
                <span className="font-display text-2xl font-bold tabular">
                  {t.total}
                  <span className="text-sm text-muted-foreground">/{t.max}</span>
                </span>
              ) : (
                <Badge tone="warn">
                  <Flag className="size-3" /> продолжить
                </Badge>
              )}
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
