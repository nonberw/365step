import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Heart, Target, Timer, X, XCircle, Zap } from "lucide-react";
import type { AnswerResult, LessonResult, LessonStart } from "@shared/path";
import { plantGrowth } from "@shared/plants";
import { api } from "@/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { Plant, type PlantMood } from "@/components/Plant";
import { Loading } from "@/components/Page";
import { comfort, lessonMeme, praise } from "@/lib/vibe";

// One lesson of the path, Duolingo-style: a progress bar, hearts, one task at a time,
// a check button and a green or red sheet; mistakes come back at the end of the lesson.

const HEARTS = 5;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type Phase = "answering" | "checked" | "done" | "failed";

export default function Lesson() {
  const { course = "", node = "" } = useParams();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const pro = user?.plan === "pro";
  const [lesson, setLesson] = useState<LessonStart | null>(null);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<number[]>([]);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [retry, setRetry] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [hearts, setHearts] = useState(HEARTS);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<LessonResult | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [why, setWhy] = useState(false);
  const started = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const once = useRef(false);

  const start = useCallback(async () => {
    setError("");
    try {
      const l = await api<LessonStart>(`/path/${course}/${node}/start`, { body: {} });
      setLesson(l);
      setQueue(l.items.map((_, i) => i));
      setSolved(new Set());
      setRetry(new Set());
      setHearts(HEARTS);
      setPhase("answering");
      setSummary(null);
      setChoice(null);
      setText("");
      setResult(null);
      started.current = Date.now();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [course, node]);

  useEffect(() => {
    // StrictMode runs effects twice in development; one lesson is enough.
    if (once.current) return;
    once.current = true;
    void start();
  }, [start]);

  const item = lesson && queue.length ? lesson.items[queue[0]!] : null;
  const ready = item ? (item.kind === "choice" ? choice !== null : text.trim().length > 0) : false;

  const check = useCallback(async () => {
    if (!lesson || !item || !ready || busy || phase !== "answering") return;
    setBusy(true);
    try {
      const r = await api<AnswerResult>("/path/answer", { body: { lessonId: lesson.lessonId, itemId: item.id, response: item.kind === "choice" ? choice : text } });
      setResult(r);
      setWhy(false);
      setPhase("checked");
      if (r.correct) setSolved((s) => new Set(s).add(item.id));
      else {
        setRetry((s) => new Set(s).add(item.id));
        if (!pro) setHearts((h) => h - 1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [lesson, item, ready, busy, phase, choice, text, pro]);

  const next = useCallback(async () => {
    if (!lesson || !result || phase !== "checked") return;
    if (!pro && hearts <= 0) {
      setPhase("failed");
      return;
    }
    const rest = queue.slice(1);
    const q = result.correct ? rest : [...rest, queue[0]!];
    setChoice(null);
    setText("");
    setResult(null);
    if (q.length) {
      setQueue(q);
      setPhase("answering");
      return;
    }
    setBusy(true);
    try {
      const s = await api<LessonResult>("/path/complete", { body: { lessonId: lesson.lessonId } });
      setElapsed(Math.round((Date.now() - started.current) / 1000));
      setSummary(s);
      setQueue([]);
      setPhase("done");
      void refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [lesson, result, phase, pro, hearts, queue, refresh]);

  // Keyboard: 1–9 pick a choice, Enter checks or continues.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (leaving) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (phase === "answering") void check();
        else if (phase === "checked") void next();
        return;
      }
      if (phase === "answering" && item?.kind === "choice" && /^[1-9]$/.test(e.key) && !(e.target instanceof HTMLInputElement)) {
        const i = Number(e.key) - 1;
        if (item.choices && i < item.choices.length) setChoice(i);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [phase, item, check, next, leaving]);

  const stage = user ? plantGrowth(user.xp).stage : 1;
  const species = user?.plant ?? "sunflower";
  const mood: PlantMood = phase === "checked" ? (result?.correct ? "happy" : "sad") : phase === "done" ? "happy" : phase === "failed" ? "sad" : "idle";

  if (error && !lesson)
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4">
        <div className="max-w-sm text-center">
          <Plant species={species} stage={stage} mood="sad" className="mx-auto w-36" />
          <p className="mt-4 font-display text-xl font-bold">{error}</p>
          <Link to="/learn" className="mt-6 inline-block font-bold text-primary">
            Вернуться на путь
          </Link>
        </div>
      </div>
    );
  if (!lesson) return <Loading label={course === "ent" || course === "nuet" ? "ИИ составляет задания по теме, это может занять до минуты…" : "Готовлю урок…"} />;

  // ---------- finished ----------
  if (phase === "done" && summary) {
    const acc = Math.round((summary.firstTry / summary.total) * 100);
    const meme = lessonMeme(summary.perfect);
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
            <div className="relative">
              <Plant species={species} stage={stage} mood="happy" className="w-48" />
              <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: -12 }} transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 12 }} className="sticker absolute -right-6 top-2 text-6xl">
                {meme.sticker}
              </motion.span>
            </div>
          </motion.div>
          <h1 className="mt-4 font-display text-4xl font-bold text-[#ff9600]">{summary.perfect ? "Без единой ошибки!" : "Урок пройден!"}</h1>
          <p className="mt-1 rounded-full bg-[#fff4e0] px-4 py-1 text-sm font-bold text-[#c56a00]">{meme.caption}</p>
          <p className="mt-2 text-muted-foreground">
            {summary.level >= summary.maxLevel ? "Уровень пройден полностью" : `Уровень ${summary.level} из ${summary.maxLevel}`} · {lesson.title}
          </p>
          <div className="mt-8 grid w-full grid-cols-3 gap-3">
            {[
              { label: "Всего XP", value: `+${summary.xp}`, color: "#ff9600", icon: Zap },
              { label: "Точность", value: `${acc}%`, color: "#2bb673", icon: Target },
              { label: "Время", value: mmss(elapsed), color: "#1cb0f6", icon: Timer },
            ].map((t) => (
              <div key={t.label} className="overflow-hidden rounded-2xl border-2" style={{ borderColor: t.color, background: t.color }}>
                <p className="py-1 text-[11px] font-bold uppercase tracking-wide text-white">{t.label}</p>
                <p className="flex items-center justify-center gap-1 rounded-t-xl bg-card py-3 font-display text-xl font-bold" style={{ color: t.color }}>
                  <t.icon className="size-4" /> {t.value}
                </p>
              </div>
            ))}
          </div>
        </main>
        <footer className="border-t-2 border-border px-4 py-5">
          <div className="mx-auto flex max-w-5xl justify-end">
            <button type="button" onClick={() => navigate("/learn")} className="h-12 w-full rounded-2xl bg-primary font-display text-base font-bold uppercase tracking-wide text-white shadow-[0_4px_0_0_var(--primary-edge)] active:translate-y-1 active:shadow-none sm:w-56">
              Продолжить
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // ---------- out of hearts ----------
  if (phase === "failed")
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4">
        <div className="max-w-sm text-center">
          <Plant species={species} stage={stage} mood="sad" className="mx-auto w-44" />
          <h1 className="mt-4 font-display text-3xl font-bold">Сердечки закончились</h1>
          <p className="mt-2 text-muted-foreground">Растение немного загрустило, но ничего страшного: разбери ошибки и попробуй ещё раз.</p>
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" onClick={() => void start()} className="h-12 rounded-2xl bg-primary font-display font-bold uppercase text-white shadow-[0_4px_0_0_var(--primary-edge)] active:translate-y-1 active:shadow-none">
              Попробовать ещё раз
            </button>
            <Link to="/pricing" className="h-12 content-center rounded-2xl border-2 border-border font-display font-bold uppercase text-primary">
              Pro — без ограничений
            </Link>
            <Link to="/learn" className="font-bold text-muted-foreground">
              На путь
            </Link>
          </div>
        </div>
      </div>
    );

  // ---------- answering ----------
  const progress = solved.size / lesson.items.length;
  const isRetry = item ? retry.has(item.id) : false;
  const checked = phase === "checked" && result;
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 pb-2 pt-5">
        <button type="button" onClick={() => setLeaving(true)} aria-label="Выйти из урока" className="text-muted-foreground hover:text-foreground">
          <X className="size-7" />
        </button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Прогресс урока">
          <motion.div className="relative h-full rounded-full bg-[#58cc02]" animate={{ width: `${Math.max(progress * 100, 3)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }}>
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" />
          </motion.div>
        </div>
        <span className="flex items-center gap-1 font-bold text-[#ff4b4b]" aria-label={pro ? "Сердечки без ограничений" : `Сердечек: ${hearts}`}>
          <Heart className="size-6 fill-current" /> {pro ? "∞" : hearts}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        {item && (
          <div className={cn("mx-auto grid gap-6", item.passage ? "max-w-5xl lg:grid-cols-2" : "max-w-2xl")}>
            {item.passage && (
              <section className="max-h-[38vh] overflow-y-auto rounded-3xl border-2 border-border bg-card p-5 lg:max-h-[66vh]">
                {item.passageTitle && <h2 className="mb-2 font-display text-lg font-bold">{item.passageTitle}</h2>}
                <RichText text={item.passage} className="whitespace-pre-line font-serif text-[15px] leading-7" />
              </section>
            )}
            <section>
              {isRetry && <p className="mb-2 text-sm font-bold uppercase tracking-wide text-[#ff9600]">Ошибка из этого урока</p>}
              <h1 className="font-display text-2xl font-bold">{item.kind === "choice" ? "Выбери правильный ответ" : "Впиши ответ"}</h1>
              <div className="mt-5 flex items-end gap-3">
                <div className="w-24 shrink-0">
                  <Plant species={species} stage={stage} mood={mood} />
                </div>
                <div className="relative mb-6 min-w-0 flex-1 rounded-2xl border-2 border-border bg-card px-4 py-3 text-[15px] leading-relaxed">
                  <span aria-hidden className="absolute -left-[9px] bottom-4 size-4 rotate-45 border-b-2 border-l-2 border-border bg-card" />
                  <RichText text={item.stem} />
                  {item.code && <pre className="mt-2 overflow-x-auto rounded-xl bg-[#0b1014] p-3 font-mono text-[13px] leading-6 text-[#e8edf6]">{item.code}</pre>}
                </div>
              </div>

              {item.kind === "choice" ? (
                <div className="mt-2 grid gap-3" role="radiogroup" aria-label="Варианты ответа">
                  {item.choices!.map((c, i) => {
                    const picked = choice === i;
                    const isAnswer = checked && result!.answer === c;
                    const wrongPick = checked && picked && !result!.correct;
                    return (
                      <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={picked}
                        disabled={phase !== "answering"}
                        onClick={() => setChoice(i)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] transition-[transform,box-shadow] active:translate-y-[2px]",
                          isAnswer ? "border-[#58cc02] bg-[#d7ffb8] shadow-[0_4px_0_0_#58cc02]" : wrongPick ? "border-[#ff4b4b] bg-[#ffdfe0] shadow-[0_4px_0_0_#ff4b4b]" : picked ? "border-primary bg-primary/10 shadow-[0_4px_0_0_var(--primary)]" : "border-border bg-card shadow-[0_4px_0_0_var(--border)] hover:bg-muted",
                        )}
                      >
                        <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg border-2 text-xs font-bold", picked ? "border-primary text-primary" : "border-border text-muted-foreground")}>{i + 1}</span>
                        <span className="min-w-0">
                          <RichText text={c} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  autoFocus
                  value={text}
                  disabled={phase !== "answering"}
                  onChange={(e) => setText(e.target.value)}
                  aria-label="Ответ"
                  placeholder="Ответ"
                  className="mt-2 h-14 w-full rounded-2xl border-2 border-border bg-card px-4 text-lg outline-none focus:border-primary"
                />
              )}
              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            </section>
          </div>
        )}
      </main>

      <footer className={cn("border-t-2 px-4 py-5 transition-colors", checked ? (result!.correct ? "border-transparent bg-[#d7ffb8]" : "border-transparent bg-[#ffdfe0]") : "border-border")}>
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <AnimatePresence mode="wait">
            {checked ? (
              <motion.div key="fb" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cn("flex min-w-0 gap-3", result!.correct ? "text-[#58a700]" : "text-[#ea2b2b]")}>
                {result!.correct ? <CheckCircle2 className="mt-0.5 size-9 shrink-0" /> : <XCircle className="mt-0.5 size-9 shrink-0" />}
                <div className="min-w-0">
                  <p className="font-display text-2xl font-bold">{result!.correct ? praise(solved.size) : comfort(retry.size)}</p>
                  {!result!.correct && (
                    <p className="text-sm font-semibold">
                      Правильный ответ: <RichText text={result!.answer} className="inline" />
                    </p>
                  )}
                  {result!.explanation && (
                    <>
                      <button type="button" onClick={() => setWhy((w) => !w)} className="mt-1 text-sm font-bold underline underline-offset-2">
                        {why ? "Скрыть разбор" : "Почему так?"}
                      </button>
                      {why && <RichText text={result!.explanation} className="mt-1 max-h-32 overflow-y-auto text-sm text-[#3c3c3c]" />}
                    </>
                  )}
                </div>
              </motion.div>
            ) : (
              <span key="empty" className="hidden sm:block" />
            )}
          </AnimatePresence>
          {checked ? (
            <button type="button" onClick={() => void next()} disabled={busy} className={cn("h-12 shrink-0 rounded-2xl px-10 font-display text-base font-bold uppercase tracking-wide text-white active:translate-y-1 active:shadow-none sm:w-48", result!.correct ? "bg-[#58cc02] shadow-[0_4px_0_0_#58a700]" : "bg-[#ff4b4b] shadow-[0_4px_0_0_#ea2b2b]")}>
              Далее
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void check()}
              disabled={!ready || busy}
              className={cn("h-12 shrink-0 rounded-2xl px-10 font-display text-base font-bold uppercase tracking-wide sm:w-48", ready ? "bg-[#58cc02] text-white shadow-[0_4px_0_0_#58a700] active:translate-y-1 active:shadow-none" : "bg-muted text-muted-foreground")}
            >
              Проверить
            </button>
          )}
        </div>
      </footer>

      {leaving && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center" onClick={() => setLeaving(false)}>
          <div className="w-full rounded-t-3xl bg-card p-6 text-center sm:max-w-sm sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <Plant species={species} stage={stage} mood="sad" className="mx-auto w-28" />
            <p className="mt-3 font-display text-xl font-bold">Подожди, не уходи!</p>
            <p className="mt-1 text-sm text-muted-foreground">Если выйдешь сейчас, прогресс урока не сохранится.</p>
            <button type="button" onClick={() => setLeaving(false)} className="mt-5 h-12 w-full rounded-2xl bg-primary font-display font-bold uppercase text-white shadow-[0_4px_0_0_var(--primary-edge)] active:translate-y-1 active:shadow-none">
              Продолжить урок
            </button>
            <button type="button" onClick={() => navigate("/learn")} className="mt-3 h-11 w-full font-display font-bold uppercase text-destructive">
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
