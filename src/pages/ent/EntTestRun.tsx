import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Lock, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import type { EntAnswer, EntQuestion as EntQuestionFull, EntQuestionPublic } from "@shared/ent";
import { entPoints, entScore } from "@shared/ent";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useLockMode } from "@/hooks/useLockMode";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading } from "@/components/Page";
import { Logo } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EntQuestion, Passage, answered } from "./EntQuestion";
import { useEntTools } from "./EntTools";
import { ENT_IMAGE } from "./visuals";
import { AnimatedRadialChart } from "@/components/ui/animated-radial-chart";

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

interface Block<Q> {
  subject: string;
  name: string;
  icon: string;
  items: Q[];
}

interface Result {
  total: number;
  max: number;
  subjects: { id: string; name: string; points: number; max: number; threshold: number; passed: boolean }[];
  thresholds: { label: string; points: number; passed: boolean }[];
  passedAll: boolean;
}

interface TestView {
  id: string;
  kind: "full" | "subject";
  endsAt: number;
  minutes: number;
  finished: boolean;
  answers: Record<string, EntAnswer>;
  result: Result | null;
  blocks: Block<EntQuestionPublic | EntQuestionFull>[];
}

export default function EntTestRun() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useApi<TestView>(`/ent/test/${id}`);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error || "Пробник не найден"} className="m-6" />;
  return data.finished && data.result ? <Results test={data as TestView & { result: Result; blocks: Block<EntQuestionFull>[] }} /> : <Run test={data} onDone={reload} />;
}

function Run({ test, onDone }: { test: TestView; onDone: () => void }) {
  const lock = useLockMode(true);
  const tools = useEntTools();
  const [answers, setAnswers] = useState<Record<string, EntAnswer>>(test.answers);
  const [b, setB] = useState(0);
  const [i, setI] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef(answers);
  ref.current = answers;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const lockRef = useRef(lock);
  lockRef.current = lock;

  const save = useCallback(() => api(`/ent/test/${test.id}/save`, { body: { answers: ref.current } }).catch(() => {}), [test.id]);
  useEffect(() => {
    const t = setTimeout(save, 800);
    return () => clearTimeout(t);
  }, [answers, save]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const s = setInterval(save, 20_000);
    return () => {
      clearInterval(t);
      clearInterval(s);
    };
  }, [save]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      await api(`/ent/test/${test.id}/submit`, { body: { answers: ref.current } });
      await lockRef.current.release();
      doneRef.current();
    } catch {
      setSubmitting(false);
    }
  }, [test.id]);

  const left = test.endsAt - now;
  const fired = useRef(false);
  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true;
      submit();
    }
  }, [left, submit]);

  const block = test.blocks[b]!;
  const q = block.items[i]!;
  const total = test.blocks.reduce((s, x) => s + x.items.length, 0);
  const done = test.blocks.reduce((s, x) => s + x.items.filter((it) => answered(answers[it.id])).length, 0);

  if (!lock.started)
    return (
      <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
        <Card className="flex w-full max-w-md flex-col gap-4 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
            <Lock className="size-6" />
          </span>
          <CardTitle>{test.kind === "full" ? "Пробный ЕНТ" : `Мини-пробник: ${block.name}`}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {total} заданий · {test.minutes} минут · осталось {clock(left)}
          </p>
          <ul className="flex flex-col gap-1.5 rounded-xl bg-muted/60 p-3 text-left text-sm">
            <li>• Тест откроется на весь экран, как в компьютерном ЕНТ.</li>
            <li>• Между предметами можно переключаться в любой момент.</li>
            <li>• Калькулятор и таблица Менделеева — кнопки сверху.</li>
            <li>• Ответы сохраняются сами, по времени тест завершится автоматически.</li>
          </ul>
          <Button size="lg" onClick={lock.start}>
            Начать
          </Button>
        </Card>
      </div>
    );

  const go = (bi: number, qi: number) => {
    setB(bi);
    setI(qi);
  };
  const next = () => (i < block.items.length - 1 ? go(b, i + 1) : b < test.blocks.length - 1 ? go(b + 1, 0) : setConfirm(true));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {tools.panels}
      <header className="sticky top-0 z-20 flex flex-col gap-2 border-b border-border bg-card px-3 py-2" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
        <div className="flex items-center justify-between gap-3">
          <Logo className="hidden text-sm sm:inline" />
          <div className="flex flex-wrap gap-1.5">{tools.buttons}</div>
          <span className={cn("rounded-full px-3 py-1 font-display text-lg font-bold tabular", left < 10 * 60_000 ? "bg-primary text-primary-foreground" : "bg-muted")}>{clock(left)}</span>
          <Button variant="dark" size="sm" onClick={() => setConfirm(true)}>
            Завершить
          </Button>
        </div>
        {test.blocks.length > 1 && (
          <nav className="flex gap-1 overflow-x-auto" aria-label="Предметы">
            {test.blocks.map((x, bi) => {
              const a = x.items.filter((it) => answered(answers[it.id])).length;
              return (
                <button
                  key={x.subject}
                  type="button"
                  onClick={() => go(bi, 0)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                    bi === b ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{x.icon}</span>
                  {x.name}
                  <span className="tabular opacity-70">
                    {a}/{x.items.length}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-5 px-4 py-5 lg:grid-cols-[1fr_260px]">
        <div className={cn("grid grid-cols-1 gap-4", q.passage && "xl:grid-cols-2")}>
          {q.passage && <Passage text={q.passage} />}
          <AnimatePresence mode="wait">
            <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="rounded-md bg-secondary px-2.5 py-1 font-display text-sm font-bold text-secondary-foreground">
                  {block.icon} {i + 1} / {block.items.length}
                </span>
                <span>
                  {entPoints(q.type)} {entPoints(q.type) === 1 ? "балл" : "балла"}
                </span>
              </div>
              <EntQuestion q={q} value={answers[q.id] ?? null} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => (i > 0 ? go(b, i - 1) : b > 0 ? go(b - 1, test.blocks[b - 1]!.items.length - 1) : undefined)} disabled={b === 0 && i === 0}>
                  <ArrowLeft /> Назад
                </Button>
                <Button onClick={next}>
                  Далее <ArrowRight />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <aside className="flex flex-col gap-3 lg:sticky lg:top-28 lg:self-start">
          <Card className="flex flex-col gap-2 p-4">
            <p className="text-xs font-semibold text-muted-foreground">
              {block.name}: отвечено {block.items.filter((it) => answered(answers[it.id])).length} из {block.items.length}
            </p>
            <div className="grid grid-cols-8 gap-1">
              {block.items.map((it, qi) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => go(b, qi)}
                  aria-label={`Задание ${qi + 1}`}
                  className={cn(
                    "grid aspect-square place-items-center rounded-md border text-[11px] font-semibold",
                    answered(answers[it.id]) ? "border-secondary bg-secondary text-secondary-foreground" : "border-dashed border-border",
                    qi === i && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                  )}
                >
                  {qi + 1}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Всего отвечено {done} из {total}
            </p>
          </Card>
        </aside>
      </main>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <Card className="flex max-w-sm flex-col gap-3 text-center">
            <CardTitle>Завершить тест?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Отвечено {done} из {total}. После завершения изменить ответы нельзя.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => setConfirm(false)}>
                Вернуться
              </Button>
              <Button onClick={submit} disabled={submitting}>
                <Check /> {submitting ? "Считаю баллы…" : "Завершить"}
              </Button>
            </div>
          </Card>
        </div>
      )}
      {lock.away && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-secondary/95 p-4 text-secondary-foreground">
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <ShieldAlert className="size-12 text-primary" />
            <p className="font-display text-xl font-semibold">Ты вышел из теста</p>
            <p className="text-sm text-white/70">На настоящем ЕНТ это нарушение. Время идёт — вернись, чтобы продолжить.</p>
            <Button size="lg" onClick={lock.comeBack}>
              Вернуться к тесту
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Results({ test }: { test: TestView & { result: Result; blocks: Block<EntQuestionFull>[] } }) {
  const r = test.result;
  const [open, setOpen] = useState<EntQuestionFull | null>(null);
  const [ai, setAi] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-dvh bg-sidebar px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <Link to="/ent" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Подготовка к ЕНТ
        </Link>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2rem] bg-[#120d0d] p-6 text-white sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/40 blur-3xl" />
          <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-accent">{test.kind === "full" ? "Пробный ЕНТ" : "Мини-пробник"}</p>
          <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:items-end sm:gap-6">
            <AnimatedRadialChart value={r.total} max={r.max} size={Math.min(280, typeof window !== "undefined" ? window.innerWidth - 100 : 280)} dark label="баллов" />
          </div>
          <p className="mt-2 text-sm text-white/70">{r.passedAll ? "Пороги по всем предметам пройдены." : "Порог пройден не по всем предметам — смотри разбор ниже."} Это тренировочный результат, не сертификат ЕНТ.</p>
          {r.thresholds.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {r.thresholds.map((t) => (
                <span key={t.label} className={cn("rounded-full px-3 py-1 text-xs font-semibold", t.passed ? "bg-success text-white" : "bg-white/10 text-white/70")}>
                  {t.passed ? "✓" : "✗"} {t.label} · {t.points}
                </span>
              ))}
            </div>
          )}
        </motion.div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {r.subjects.map((s, si) => {
            const block = (test.blocks as Block<EntQuestionFull>[]).find((x) => x.subject === s.id)!;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + si * 0.08 }}
                className="flex flex-col gap-3 overflow-hidden rounded-3xl border border-border bg-card"
              >
                <div className="relative h-20">
                  <img src={ENT_IMAGE[s.id]} alt="" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                </div>
                <div className="flex flex-col gap-3 px-5 pb-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-semibold">{s.name}</span>
                    <span className={cn("font-display text-lg font-semibold tabular", !s.passed && "text-primary")}>
                      {s.points}/{s.max}
                    </span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.points / s.max) * 100}%` }}
                      transition={{ delay: 0.1 + si * 0.08, duration: 0.6 }}
                      className={cn("h-full rounded-full", s.passed ? "bg-success" : "bg-primary")}
                    />
                    <span className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${(s.threshold / s.max) * 100}%` }} title={`Порог ${s.threshold}`} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Порог {s.threshold} · {s.passed ? "пройден" : "не пройден"}
                  </p>
                  <div className="grid grid-cols-10 gap-1">
                    {block.items.map((q, qi) => {
                      const p = entScore(q, test.answers[q.id] ?? null);
                      const m = entPoints(q.type);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setOpen(q)}
                          aria-label={`Задание ${qi + 1}`}
                          className={cn("grid aspect-square place-items-center rounded text-[10px] font-semibold", p === m ? "bg-success/80 text-white" : p > 0 ? "bg-warning text-white" : "bg-primary/70 text-white")}
                        >
                          {qi + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Карта анализа: нажми на номер задания, чтобы увидеть свой ответ, правильный и разбор.</p>
        {open && (
          <Card className="flex flex-col gap-4">
            {open.passage && <Passage text={open.passage} />}
            <EntQuestion q={open} value={test.answers[open.id] ?? null} onChange={() => {}} reveal={open.answer} disabled />
            <div className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
              <p className="flex items-center gap-1.5 font-display font-semibold">
                {entScore(open, test.answers[open.id] ?? null) === entPoints(open.type) ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-primary" />}
                {entScore(open, test.answers[open.id] ?? null)} из {entPoints(open.type)}
              </p>
              <RichText text={open.explanation} className="mt-1" />
              {ai[open.id] && <RichText text={ai[open.id]!} className="mt-3 border-t border-border pt-3" />}
            </div>
            {!ai[open.id] && (
              <Button
                variant="outline"
                className="self-start"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const x = await api<{ text: string }>("/ent/explain", { body: { id: open.id, answer: test.answers[open.id] ?? null } });
                    setAi({ ...ai, [open.id]: x.text });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Sparkles /> {busy ? "ИИ разбирает…" : "Подробный разбор от ИИ"}
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
