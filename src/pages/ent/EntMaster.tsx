import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Activity, Brain, CheckCircle2, Cpu, Gauge, Loader2, Play, Send, Sigma, Target, XCircle } from "lucide-react";
import { ENT_SUBJECTS } from "@shared/ent";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Aurora } from "./EntHome";

// ENT master mode: an adaptive test (item response theory) with typed answers. Each next problem is the one that
// tells the most about the student at their current level; the ability estimate, its error and the ENT forecast
// update after every answer. Stops when the measurement is precise enough (SE < 0.35) or after 25 problems.

interface State {
  subject: string;
  name: string;
  theta: number;
  se: number;
  answers: number;
  typed: number;
  forecast: { points: number; lo: number; hi: number; max: number; threshold: number };
  topics: { topic: string; n: number; mastery: number | null }[];
}
interface Item {
  id: string;
  topic: string;
  stem: string;
  unit: string;
  level: "A" | "B" | "C" | "D";
  b: number;
}
interface Model {
  subjects: State[];
  total: { points: number; lo: number; hi: number };
  max: number;
}

const STOP_SE = 0.35;
const MAX_ITEMS = 25;
const LEVEL = { A: "базовый", B: "средний", C: "повышенный", D: "олимпиадный" };

export default function EntMaster() {
  const model = useApi<Model>("/ent/master/model");
  const [subject, setSubject] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#0d1117] text-white">
        <Aurora />
        <div className="relative flex flex-col gap-3 px-6 py-8 sm:px-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/80">
            <Cpu className="size-3.5 text-[#ff8562]" /> ЕНТ · мастер-режим
          </span>
          <h1 className="max-w-3xl font-display text-4xl font-bold sm:text-5xl">Адаптивный тест без вариантов ответа</h1>
          <p className="max-w-2xl text-white/70">
            Ответ нужно вписать самому — угадать не получится. Каждое следующее задание подбирает модель теории тестирования (IRT) так, чтобы точнее измерить твой уровень: решил — будет труднее, ошибся — проще. После
            каждого ответа пересчитываются уровень, погрешность и прогноз баллов ЕНТ.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-white/60">
            {["IRT 3PL + EAP", "Адаптивный подбор (jsCAT, MFI)", "Калибровка заданий по ответам школы", "Модель знаний BKT", "FSRS-повторение ошибок"].map((t) => (
              <span key={t} className="rounded-full border border-white/10 px-3 py-1">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {subject ? (
        <Session
          subject={subject}
          onExit={() => {
            setSubject(null);
            model.reload();
          }}
        />
      ) : model.loading ? (
        <Loading />
      ) : !model.data ? (
        <ErrorBox message={model.error} />
      ) : (
        <KnowledgeModel model={model.data} onStart={setSubject} />
      )}
    </div>
  );
}

function ForecastBar({ f, compact }: { f: State["forecast"]; compact?: boolean }) {
  const pct = (v: number) => `${(v / f.max) * 100}%`;
  return (
    <div className="flex flex-col gap-1">
      <div className={cn("relative overflow-hidden rounded-full bg-muted", compact ? "h-2.5" : "h-4")}>
        <motion.span initial={{ width: 0 }} animate={{ left: pct(f.lo), width: `${((f.hi - f.lo) / f.max) * 100}%` }} className="absolute inset-y-0 rounded-full bg-primary/25" />
        <motion.span initial={{ left: 0 }} animate={{ left: pct(f.points) }} className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-primary" />
        <span className="absolute inset-y-0 w-px bg-destructive" style={{ left: pct(f.threshold) }} title="Порог" />
      </div>
      {!compact && (
        <span className="flex justify-between text-[11px] text-muted-foreground">
          <span>0</span>
          <span className="text-destructive">порог {f.threshold}</span>
          <span>{f.max}</span>
        </span>
      )}
    </div>
  );
}

function KnowledgeModel({ model, onStart }: { model: Model; onStart: (s: string) => void }) {
  const others = ENT_SUBJECTS.filter((s) => !model.subjects.some((m) => m.subject === s.id));
  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <Brain className="size-3.5" /> Модель знаний · прогноз ЕНТ
            </p>
            <p className="mt-1 font-display text-4xl font-bold tabular">
              {model.total.points} <span className="text-lg font-medium text-muted-foreground">из {model.max}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              С вероятностью 90 % сейчас ты набрал бы от {model.total.lo} до {model.total.hi}. Чем больше ответов — тем уже интервал.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {model.subjects.map((s) => (
          <Card key={s.subject} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-lg font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  уровень θ = {s.theta.toFixed(2)} ± {s.se.toFixed(2)} · ответов {s.answers} (вписано {s.typed})
                </p>
              </div>
              <span className="font-display text-2xl font-bold tabular">
                {s.forecast.points}
                <span className="text-sm text-muted-foreground">/{s.forecast.max}</span>
              </span>
            </div>
            <ForecastBar f={s.forecast} />
            <div className="flex flex-wrap gap-1">
              {s.topics.map((t) => (
                <span
                  key={t.topic}
                  title={`${t.topic}: ${t.mastery === null ? "нет данных" : `освоено на ${t.mastery} %`} (${t.n} ответов)`}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px]",
                    t.mastery === null ? "bg-muted text-muted-foreground" : t.mastery >= 80 ? "bg-success/20 text-success" : t.mastery >= 50 ? "bg-[#ffb020]/20 text-[#a36b00]" : "bg-destructive/15 text-destructive",
                  )}
                >
                  {t.topic}
                  {t.mastery !== null && ` ${t.mastery}%`}
                </span>
              ))}
            </div>
            <Button className="self-start" onClick={() => onStart(s.subject)}>
              <Play /> Адаптивная сессия
            </Button>
          </Card>
        ))}
      </div>

      {others.length > 0 && (
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Другие предметы:</p>
          <div className="flex flex-wrap gap-2">
            {others.map((s) => (
              <button key={s.id} type="button" onClick={() => onStart(s.id)} className="rounded-full bg-muted px-3 py-1.5 text-sm hover:bg-muted/70">
                {s.name}
              </button>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Session({ subject, onExit }: { subject: string; onExit: () => void }) {
  const [item, setItem] = useState<Item | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ correct: boolean; accept: string[]; unit: string; solution: string } | null>(null);
  const [trace, setTrace] = useState<{ theta: number; se: number; correct: boolean; b: number }[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [t0, setT0] = useState(Date.now());
  const input = useRef<HTMLInputElement>(null);
  const finished = trace.length >= MAX_ITEMS || (trace.length >= 8 && (state?.se ?? 1) < STOP_SE);

  async function next() {
    if (busy) return;
    setBusy("Подбираю задание под твой уровень…");
    setError("");
    setResult(null);
    setAnswer("");
    try {
      const r = await api<{ item: Item; state: State }>("/ent/master/next", { body: { subject } });
      setItem(r.item);
      setState(r.state);
      setT0(Date.now());
      setTimeout(() => input.current?.focus(), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  // One first item per session even when React runs effects twice (StrictMode in development).
  const started = useRef("");
  useEffect(() => {
    if (started.current === subject) return;
    started.current = subject;
    void next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  async function submit() {
    if (!item || !answer.trim()) return;
    setBusy("Проверяю…");
    try {
      const r = await api<{ correct: boolean; accept: string[]; unit: string; solution: string; state: State }>("/ent/master/answer", { body: { subject, id: item.id, answer, ms: Date.now() - t0 } });
      setResult(r);
      setState(r.state);
      setTrace((t) => [...t, { theta: r.state.theta, se: r.state.se, correct: r.correct, b: item.b }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-3">
        {error && <ErrorBox message={error} />}
        {busy && !item && (
          <Card className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {busy} Первый раз ИИ готовит трудные задачи по твоим слабым темам — до минуты.
          </Card>
        )}
        {finished && state ? (
          <Card className="flex flex-col items-center gap-3 py-8 text-center">
            <Target className="size-10 text-primary" />
            <p className="font-display text-2xl font-bold">Измерение готово</p>
            <p className="max-w-md text-sm text-muted-foreground">
              За {trace.length} заданий модель измерила твой уровень по предмету «{state.name}» с погрешностью ±{state.se.toFixed(2)}. Прогноз: {state.forecast.points} из {state.forecast.max} (90 %: {state.forecast.lo}–
              {state.forecast.hi}).
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setTrace([])}>Продолжить тренировку</Button>
              <Button variant="outline" onClick={onExit}>
                К модели знаний
              </Button>
            </div>
          </Card>
        ) : (
          item && (
            <Card className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="rounded-md bg-secondary px-2.5 py-1 font-display text-sm font-bold text-secondary-foreground">
                  {trace.length + (result ? 0 : 1)} / до {MAX_ITEMS}
                </span>
                <span>
                  {item.topic} · {LEVEL[item.level]} · сложность b = {item.b.toFixed(2)}
                </span>
              </div>
              <RichText text={item.stem} className="text-[15px]" />
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (result) void next();
                  else void submit();
                }}
              >
                <input
                  ref={input}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={!!result}
                  placeholder="Впиши ответ: число, дробь 3/4 или слово"
                  className={cn("h-12 min-w-0 flex-1 rounded-2xl border bg-card px-4 font-mono text-lg", result ? (result.correct ? "border-success" : "border-destructive") : "border-border")}
                />
                {item.unit && <span className="text-sm text-muted-foreground">{item.unit}</span>}
                <Button type="submit" size="lg" disabled={!!busy || (!result && !answer.trim())}>
                  {result ? (
                    "Дальше"
                  ) : (
                    <>
                      <Send /> Ответить
                    </>
                  )}
                </Button>
              </form>
              {result && (
                <div className={cn("flex flex-col gap-2 rounded-2xl p-4 text-sm", result.correct ? "bg-success/10" : "bg-destructive/10")}>
                  <p className={cn("flex items-center gap-2 font-semibold", result.correct ? "text-success" : "text-destructive")}>
                    {result.correct ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                    {result.correct ? "Верно" : `Неверно. Ответ: `}
                    {!result.correct && <RichText text={result.accept.join(" или ")} className="inline" />}
                  </p>
                  <RichText text={result.solution} />
                </div>
              )}
            </Card>
          )
        )}
      </div>

      <div className="flex flex-col gap-3">
        {state && (
          <Card className="flex flex-col gap-3">
            <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <Activity className="size-3.5" /> Измерение в реальном времени · {state.name}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Metric icon={<Sigma className="size-3.5" />} label="Уровень θ" value={state.theta.toFixed(2)} />
              <Metric icon={<Gauge className="size-3.5" />} label="Погрешность" value={`±${state.se.toFixed(2)}`} hot={state.se < STOP_SE} />
              <Metric icon={<Target className="size-3.5" />} label="Прогноз" value={`${state.forecast.points}/${state.forecast.max}`} />
            </div>
            <ForecastBar f={state.forecast} />
            <ThetaChart trace={trace} />
            <p className="text-[11px] text-muted-foreground">
              Красная линия — твой уровень после каждого ответа, полоса — погрешность. Точки — сложность заданий: зелёные решены, красные нет. Тест подбирает задания рядом с твоим уровнем — там каждое решение даёт больше
              всего информации.
            </p>
          </Card>
        )}
        <Button variant="outline" onClick={onExit}>
          Завершить и вернуться к модели знаний
        </Button>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, hot }: { icon: React.ReactNode; label: string; value: string; hot?: boolean }) {
  return (
    <div className={cn("rounded-2xl px-3 py-2", hot ? "bg-success/15" : "bg-muted/60")}>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon} {label}
      </span>
      <span className="font-display text-xl font-bold tabular">{value}</span>
    </div>
  );
}

function ThetaChart({ trace }: { trace: { theta: number; se: number; correct: boolean; b: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    const W = (c.width = c.clientWidth * devicePixelRatio);
    const H = (c.height = c.clientHeight * devicePixelRatio);
    g.clearRect(0, 0, W, H);
    const x = (i: number) => 20 * devicePixelRatio + (i / Math.max(MAX_ITEMS - 1, 1)) * (W - 30 * devicePixelRatio);
    const y = (t: number) => H / 2 - (t / 3.5) * (H / 2 - 6 * devicePixelRatio);
    g.strokeStyle = "rgba(128,128,128,.3)";
    for (const t of [-3, -2, -1, 0, 1, 2, 3]) {
      g.beginPath();
      g.moveTo(0, y(t));
      g.lineTo(W, y(t));
      g.stroke();
    }
    if (!trace.length) return;
    g.fillStyle = "rgba(239,68,68,.15)";
    g.beginPath();
    trace.forEach((p, i) => (i ? g.lineTo(x(i), y(p.theta + p.se)) : g.moveTo(x(i), y(p.theta + p.se))));
    [...trace].reverse().forEach((p, k) => g.lineTo(x(trace.length - 1 - k), y(p.theta - p.se)));
    g.fill();
    g.strokeStyle = "#ef4444";
    g.lineWidth = 2 * devicePixelRatio;
    g.beginPath();
    trace.forEach((p, i) => (i ? g.lineTo(x(i), y(p.theta)) : g.moveTo(x(i), y(p.theta))));
    g.stroke();
    trace.forEach((p, i) => {
      g.fillStyle = p.correct ? "#16a34a" : "#dc2626";
      g.beginPath();
      g.arc(x(i), y(p.b), 3.5 * devicePixelRatio, 0, Math.PI * 2);
      g.fill();
    });
  }, [trace]);
  return <canvas ref={ref} className="h-40 w-full" />;
}
