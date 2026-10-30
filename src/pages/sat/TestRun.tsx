import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, ChevronUp, Eye, EyeOff, Lock } from "lucide-react";
import type { SatQuestionPublic, SatTestState } from "@shared/types";
import { api } from "@/api";
import { useLockMode } from "@/hooks/useLockMode";
import { mmss } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/AppShell";
import { ErrorBox, Loading } from "@/components/Page";
import { RichText } from "@/components/RichText";
import { Button, buttonVariants } from "@/components/ui/button";
import { CircleProgress } from "@/components/ui/circle-progress";
import QuestionView, { type Response } from "./QuestionView";
import { EXAM_KEY } from "./TestHome";
import { useSatTools } from "./SatTools";

type View =
  | { test: SatTestState; questions: SatQuestionPublic[]; seconds: number }
  | { test: SatTestState; review: { section: "rw" | "math"; module: number; level: string; items: { question: SatQuestionPublic; given: Response; answer: number | string; explanation: string; correct: boolean }[] }[] };

const SECTION = { rw: "Reading and Writing", math: "Math" };

export default function TestRun() {
  const { id = "" } = useParams();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<View>(`/sat/test/${id}`).then(setView).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <div className="p-6"><ErrorBox message={error} /></div>;
  if (!view) return <Loading />;
  if ("review" in view) return <Results view={view} />;
  return <Module key={`${view.test.id}-${view.test.current}`} view={view} onSubmitted={setView} />;
}

function Module({ view, onSubmitted }: { view: Extract<View, { questions: unknown }>; onSubmitted: (v: View) => void }) {
  const { test, questions } = view;
  const m = test.modules[test.current]!;
  const storeKey = `bsts-sat-${test.id}-${test.current}`;
  const exam = (() => {
    try {
      return sessionStorage.getItem(EXAM_KEY) !== "0";
    } catch {
      return true;
    }
  })();
  const lock = useLockMode(exam);
  const tools = useSatTools();
  const [answers, setAnswers] = useState<Record<string, Response>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storeKey) ?? "{}");
    } catch {
      return {};
    }
  });
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [left, setLeft] = useState(view.seconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(Date.now());
  const submitted = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey, JSON.stringify(answers));
    } catch {
      // resume is a convenience
    }
  }, [answers, storeKey]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      const next = await api<View>(`/sat/test/${test.id}/submit`, { body: { answers, seconds: Math.round((Date.now() - started.current) / 1000) } });
      try {
        sessionStorage.removeItem(storeKey);
      } catch {
        // nothing to clean
      }
      if ("review" in next) await lock.release();
      onSubmitted(next);
    } catch (e) {
      submitted.current = false;
      setError((e as Error).message);
      setBusy(false);
    }
  }, [answers, lock, onSubmitted, storeKey, test.id]);

  useEffect(() => {
    if (exam && !lock.started) return;
    if (left <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, submit, exam, lock.started]);

  const q = questions[index]!;
  const answered = (qid: string) => answers[qid] !== undefined && answers[qid] !== null && answers[qid] !== "";

  return (
    <div className="flex min-h-dvh flex-col bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-dashed border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold sm:text-base">
            Section {m.section === "rw" ? 1 : 2}, Module {m.module}: {SECTION[m.section]}
          </p>
          {exam && <p className="flex items-center gap-1 text-xs text-primary"><Lock className="size-3" /> Режим экзамена</p>}
        </div>
        <div className="flex flex-col items-center">
          {!hideTimer && <span className={cn("font-display text-xl font-semibold tabular", left < 300 && "text-destructive")}>{mmss(left)}</span>}
          <button type="button" onClick={() => setHideTimer(!hideTimer)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px]">
            {hideTimer ? <Eye className="size-3" /> : <EyeOff className="size-3" />} {hideTimer ? "Показать" : "Скрыть"}
          </button>
        </div>
        {m.section === "math" ? <div className="flex gap-1">{tools.buttons}</div> : <Logo className="hidden sm:inline" />}
      </header>
      {m.section === "math" && tools.panels}

      <main className="flex-1 px-4 py-6 sm:px-8">
        {reviewing ? (
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-2xl font-semibold">Проверь ответы</h1>
            <p className="mt-1 text-sm text-muted-foreground">Нажми на номер, чтобы вернуться к вопросу. После отправки модуль изменить нельзя.</p>
            <Grid questions={questions} answered={answered} marked={marked} current={-1} onPick={(i) => { setIndex(i); setReviewing(false); }} />
            <ErrorBox message={error} className="mt-4" />
          </div>
        ) : (
          <div className="mx-auto max-w-6xl">
            <QuestionView
              q={q}
              number={index + 1}
              showMeta={false}
              value={answers[q.id] ?? null}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              marked={marked.has(q.id)}
              onMark={() => setMarked((s) => {
                const n = new Set(s);
                if (n.has(q.id)) n.delete(q.id);
                else n.add(q.id);
                return n;
              })}
            />
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-dashed border-border bg-card px-4 py-3 sm:px-6" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <span className="hidden text-sm text-muted-foreground sm:inline">{questions.filter((x) => answered(x.id)).length} из {questions.length} отвечено</span>
        {!reviewing && (
          <div className="relative">
            <button type="button" onClick={() => setNavOpen(!navOpen)} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 font-display text-sm font-semibold text-secondary-foreground">
              Вопрос {index + 1} из {questions.length} <ChevronUp className={cn("size-4 transition-transform", !navOpen && "rotate-180")} />
            </button>
            {navOpen && (
              <div className="absolute bottom-12 left-1/2 z-20 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-border bg-card p-4 shadow-2xl">
                <Grid questions={questions} answered={answered} marked={marked} current={index} onPick={(i) => { setIndex(i); setNavOpen(false); }} />
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => { setReviewing(true); setNavOpen(false); }}>
                  Перейти к проверке
                </Button>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2">
          {(index > 0 || reviewing) && (
            <Button variant="outline" onClick={() => (reviewing ? setReviewing(false) : setIndex(index - 1))}>
              Назад
            </Button>
          )}
          {reviewing ? (
            <Button onClick={submit} disabled={busy}>
              {busy ? "Отправляю…" : test.current === 3 ? "Завершить тест" : "Отправить модуль"}
            </Button>
          ) : index < questions.length - 1 ? (
            <Button onClick={() => setIndex(index + 1)}>Дальше</Button>
          ) : (
            <Button onClick={() => setReviewing(true)}>К проверке</Button>
          )}
        </div>
      </footer>

      {exam && !lock.started && (
        <Overlay title={`Модуль ${test.current + 1} из 4`} text={`${SECTION[m.section]}: ${questions.length} вопросов, ${mmss(view.seconds)} минут. Экран перейдёт в полноэкранный режим, а таймер пойдёт после нажатия.`} action="Начать модуль" onAction={lock.start} />
      )}
      {exam && lock.started && lock.away && <Overlay title="Тест на паузе" text="Ты вышел из теста. Выход записан. Вернись, чтобы продолжить: таймер не останавливается." action="Вернуться в тест" onAction={lock.comeBack} />}
    </div>
  );
}

function Grid({ questions, answered, marked, current, onPick }: { questions: SatQuestionPublic[]; answered: (id: string) => boolean; marked: Set<string>; current: number; onPick: (i: number) => void }) {
  return (
    <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8">
      {questions.map((x, i) => (
        <button
          key={x.id}
          type="button"
          onClick={() => onPick(i)}
          className={cn(
            "relative grid aspect-square place-items-center rounded-lg border-2 font-display text-sm font-semibold",
            answered(x.id) ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-foreground/40",
            current === i && "ring-2 ring-accent ring-offset-2",
          )}
        >
          {i + 1}
          {marked.has(x.id) && <Bookmark className="absolute -right-1.5 -top-1.5 size-4 fill-accent text-accent" />}
        </button>
      ))}
    </div>
  );
}

function Overlay({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6">
      <div className="w-full max-w-md rounded-3xl bg-secondary p-7 text-white">
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          <Lock className="size-3.5" /> Режим экзамена
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-white/70">{text}</p>
        <Button className="mt-5 w-full" size="lg" onClick={onAction}>
          {action}
        </Button>
      </div>
    </div>
  );
}

function Results({ view }: { view: Extract<View, { review: unknown }> }) {
  const { test, review } = view;
  const total = (test.rwScore ?? 0) + (test.mathScore ?? 0);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link to="/sat" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> К обзору SAT
      </Link>
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-secondary px-6 py-8 text-white sm:flex-row sm:px-10">
        <CircleProgress value={total} max={1600} size={150} stroke={12} tone="var(--accent)">
          <div>
            <p className="font-display text-4xl font-semibold tabular">{total}</p>
            <p className="text-xs text-white/60">из 1600</p>
          </div>
        </CircleProgress>
        <div className="grid flex-1 grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-white/60">Reading & Writing</p>
            <p className="font-display text-3xl font-semibold tabular">{test.rwScore}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Math</p>
            <p className="font-display text-3xl font-semibold tabular">{test.mathScore}</p>
          </div>
          <p className="col-span-2 text-xs text-white/60">Ориентировочная оценка по точности в модулях и уровню второго модуля, не официальный балл College Board.</p>
        </div>
      </div>

      {review.map((mod) => (
        <section key={`${mod.section}-${mod.module}`} className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-semibold">
            {SECTION[mod.section]} · модуль {mod.module}
            {mod.module === 2 && <span className="ml-2 text-sm font-normal text-muted-foreground">({mod.level === "hard" ? "сложный" : "базовый"} уровень)</span>}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {mod.items.filter((i) => i.correct).length}/{mod.items.length}
            </span>
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-border">
            {mod.items.map((it, i) => {
              const key = `${mod.section}-${mod.module}-${i}`;
              return (
                <li key={key} className="border-b border-border last:border-b-0">
                  <button type="button" onClick={() => setOpen(open === key ? null : key)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-md font-display text-sm font-bold text-white", it.correct ? "bg-success" : "bg-destructive")}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{(it.question.passage ?? it.question.stem).replace(/\$/g, "")}</span>
                    <span className="text-xs text-muted-foreground">{it.question.skill}</span>
                  </button>
                  {open === key && (
                    <div className="border-t border-border bg-background/50 p-4 sm:p-6">
                      <QuestionView q={it.question} value={it.given} onChange={() => undefined} reveal={{ answer: it.answer, correct: it.correct }} />
                      <div className="mt-4 rounded-xl bg-muted p-4">
                        <RichText text={it.explanation} className="text-sm" />
                        <Link to={`/sat/q/${it.question.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>
                          Разобрать с ИИ
                        </Link>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
