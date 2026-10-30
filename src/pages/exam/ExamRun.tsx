import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Flag, Lock, ShieldAlert, X } from "lucide-react";
import type { ExamTake } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useLockMode } from "@/hooks/useLockMode";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading } from "@/components/Page";
import { Logo } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Textarea, Input } from "@/components/ui/input";
import { clock } from "@/pages/teacher/ExamPage";

type Answers = Record<string, string | number>;

export default function ExamRun() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useApi<ExamTake>(`/exams/student/take/${id}`);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error || "Контрольная не найдена"} className="m-6" />;
  return data.submitted ? <Result take={data} /> : <Run take={data} onDone={reload} />;
}

function Run({ take, onDone }: { take: ExamTake; onDone: () => void }) {
  const lock = useLockMode(take.lock);
  const [answers, setAnswers] = useState<Answers>(take.answers);
  const [current, setCurrent] = useState(Math.min(take.current, take.items.length - 1));
  const [flags, setFlags] = useState<string[]>([]);
  const [endsAt, setEndsAt] = useState(take.endsAt);
  const [now, setNow] = useState(Date.now());
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [submitting, setSubmitting] = useState(false);
  const state = useRef({ answers, current, away: lock.away });
  state.current = { answers, current, away: lock.away };
  // Stable callbacks: the lock helpers and onDone change identity every render.
  const finish = useRef(async () => {});
  finish.current = async () => {
    await lock.release();
    onDone();
  };

  const sync = useCallback(async () => {
    setSaving("saving");
    try {
      const r = await api<{ ok: boolean; closed?: boolean; endsAt: number | null }>(`/exams/student/take/${take.id}/progress`, { body: state.current });
      if (r.endsAt) setEndsAt(r.endsAt);
      if (r.closed) await finish.current();
      setSaving("saved");
    } catch {
      setSaving("offline");
    }
  }, [take.id]);

  // Autosave shortly after every change, plus a heartbeat so the teacher sees who is online.
  useEffect(() => {
    if (!lock.started) return;
    const t = setTimeout(sync, 700);
    return () => clearTimeout(t);
  }, [answers, current, lock.away, lock.started, sync]);
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    const hb = setInterval(sync, 10_000);
    return () => {
      clearInterval(t);
      clearInterval(hb);
    };
  }, [sync]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      await api(`/exams/student/take/${take.id}/submit`, { body: { answers: state.current.answers } });
      await finish.current();
    } catch {
      setSubmitting(false);
    }
  }, [take.id]);

  const left = endsAt - now;
  const submitted = useRef(false);
  useEffect(() => {
    if (left <= 0 && !submitted.current) {
      submitted.current = true;
      submit();
    }
  }, [left, submit]);

  const q = take.items[current];
  const answered = take.items.filter((x) => answers[x.id] !== undefined && answers[x.id] !== "").length;
  const set = (v: string | number) => setAnswers((a) => ({ ...a, [q.id]: v }));

  if (!lock.started) {
    return (
      <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
        <Card className="flex w-full max-w-md flex-col gap-4 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
            <Lock className="size-6" />
          </span>
          <CardTitle>{take.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {take.teacher} · {take.items.length} вопросов · осталось {clock(left)}
          </p>
          <ul className="flex flex-col gap-1.5 rounded-xl bg-muted/60 p-3 text-left text-sm">
            <li>• Контрольная откроется на весь экран.</li>
            <li>• Выход из окна или переключение вкладок увидит учитель.</li>
            <li>• Ответы сохраняются сами, по времени работа отправится автоматически.</li>
          </ul>
          <Button size="lg" onClick={lock.start}>
            Начать контрольную
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5" style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}>
        <div className="min-w-0">
          <Logo className="hidden text-sm sm:inline" />
          <p className="truncate font-display text-sm font-semibold">{take.title}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 font-display text-lg font-bold tabular", left < 5 * 60_000 ? "bg-primary text-primary-foreground" : "bg-muted")}>{clock(left)}</span>
        <span className="hidden text-xs text-muted-foreground sm:block">{{ idle: "", saving: "сохраняю…", saved: "сохранено", offline: "нет связи — ответы сохранятся позже" }[saving]}</span>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6">
        {review ? (
          <Card className="flex flex-col gap-4">
            <CardTitle>Проверь перед отправкой</CardTitle>
            <p className="text-sm text-muted-foreground">
              Отвечено {answered} из {take.items.length}. {flags.length > 0 && `Отмечено для проверки: ${flags.length}.`}
            </p>
            <Nav take={take} answers={answers} flags={flags} current={current} go={(i) => (setCurrent(i), setReview(false))} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setReview(false)}>
                <ArrowLeft /> Вернуться к вопросам
              </Button>
              <Button size="lg" onClick={submit} disabled={submitting}>
                <Check /> {submitting ? "Отправляю и проверяю…" : "Сдать работу"}
              </Button>
            </div>
          </Card>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={q.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-secondary px-2.5 py-1 font-display text-sm font-bold text-secondary-foreground">
                  {current + 1} / {take.items.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  {q.points} {q.points === 1 ? "балл" : q.points < 5 ? "балла" : "баллов"}
                </span>
                <button
                  type="button"
                  onClick={() => setFlags(flags.includes(q.id) ? flags.filter((f) => f !== q.id) : [...flags, q.id])}
                  className={cn("ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", flags.includes(q.id) ? "border-primary text-primary" : "border-border text-muted-foreground")}
                >
                  <Flag className={cn("size-3.5", flags.includes(q.id) && "fill-primary")} /> Проверить позже
                </button>
              </div>
              <RichText text={q.prompt} className="text-lg" />
              {q.choices ? (
                <div className="flex flex-col gap-2">
                  {q.choices.map((c, i) => {
                    const on = answers[q.id] === i;
                    return (
                      <button key={i} type="button" onClick={() => set(i)} className={cn("flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors", on ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30")}>
                        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-bold", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{String.fromCharCode(65 + i)}</span>
                        <RichText text={c} className="min-w-0" />
                      </button>
                    );
                  })}
                </div>
              ) : q.type === "short" ? (
                <Input value={String(answers[q.id] ?? "")} onChange={(e) => set(e.target.value)} placeholder="Короткий ответ" className="h-12 max-w-sm text-lg" autoFocus />
              ) : (
                <Textarea rows={8} value={String(answers[q.id] ?? "")} onChange={(e) => set(e.target.value)} placeholder="Развёрнутый ответ" autoFocus />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {!review && (
        <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-card px-4 py-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <Nav take={take} answers={answers} flags={flags} current={current} go={setCurrent} />
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0}>
              <ArrowLeft /> Назад
            </Button>
            {current < take.items.length - 1 ? (
              <Button onClick={() => setCurrent(current + 1)}>
                Далее <ArrowRight />
              </Button>
            ) : (
              <Button variant="dark" onClick={() => setReview(true)}>
                К отправке <ArrowRight />
              </Button>
            )}
          </div>
        </footer>
      )}

      {lock.away && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-secondary/95 p-4 text-secondary-foreground">
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <ShieldAlert className="size-12 text-primary" />
            <p className="font-display text-xl font-semibold">Ты вышел из контрольной</p>
            <p className="text-sm text-white/70">Учитель видит это в журнале. Время идёт — вернись, чтобы продолжить.</p>
            <Button size="lg" onClick={lock.comeBack}>
              Вернуться к контрольной
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Nav({ take, answers, flags, current, go }: { take: ExamTake; answers: Answers; flags: string[]; current: number; go: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {take.items.map((x, i) => {
        const done = answers[x.id] !== undefined && answers[x.id] !== "";
        return (
          <button
            key={x.id}
            type="button"
            aria-label={`Вопрос ${i + 1}`}
            onClick={() => go(i)}
            className={cn(
              "relative grid size-9 place-items-center rounded-lg border font-display text-sm font-semibold",
              done ? "border-secondary bg-secondary text-secondary-foreground" : "border-dashed border-border",
              i === current && "ring-2 ring-primary ring-offset-2 ring-offset-card",
            )}
          >
            {i + 1}
            {flags.includes(x.id) && <Flag className="absolute -right-1 -top-1 size-3.5 fill-primary text-primary" />}
          </button>
        );
      })}
    </div>
  );
}

function Result({ take }: { take: ExamTake }) {
  const r = take.result;
  const pct = r ? Math.round((r.score / Math.max(1, r.max)) * 100) : null;
  return (
    <div className="min-h-dvh bg-sidebar px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <Link to="/exam" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> К контрольным
        </Link>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3 rounded-3xl bg-secondary px-6 py-10 text-center text-secondary-foreground">
          <CheckCircle2 className="size-12 text-success" />
          <p className="font-display text-2xl font-semibold">Работа сдана</p>
          <p className="text-white/70">{take.title}</p>
          {r ? (
            <p className="font-display text-5xl font-bold tabular">
              {pct}% <span className="text-xl text-white/60">· {r.score} из {r.max}</span>
            </p>
          ) : (
            <p className="text-sm text-white/70">Результат покажет учитель.</p>
          )}
          {r && !r.reveal && <p className="text-xs text-white/60">Правильные ответы откроются, когда учитель завершит контрольную для всего класса. Оценка развёрнутых ответов от ИИ предварительная.</p>}
        </motion.div>
        {r?.reveal &&
          take.items.map((q, i) => {
            const g = r.grades[q.id];
            const a = take.answers[q.id];
            const rv = r.reveal![q.id];
            return (
              <Card key={q.id} className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  {g?.correct === true ? <Check className="size-5 shrink-0 text-success" /> : g?.correct === false ? <X className="size-5 shrink-0 text-destructive" /> : <span className="font-display text-sm font-semibold">{i + 1}.</span>}
                  <RichText text={q.prompt} className="flex-1" />
                  <span className="font-display text-sm font-semibold tabular">
                    {g?.points ?? 0}/{q.points}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Твой ответ: {a === undefined ? "нет ответа" : q.choices ? q.choices[Number(a)] : String(a)}</p>
                {q.type !== "open" && g?.correct === false && <p className="text-sm">Верно: {q.choices ? q.choices[Number(rv.answer)] : String(rv.answer).split("|")[0]}</p>}
                {g?.feedback && <p className="text-sm text-muted-foreground">{g.feedback}</p>}
                {rv.explanation && <RichText text={rv.explanation} className="text-xs text-muted-foreground" />}
              </Card>
            );
          })}
      </div>
    </div>
  );
}
