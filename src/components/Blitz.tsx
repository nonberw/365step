import { useEffect, useRef, useState, type ReactNode } from "react";
import { Heart, Zap } from "lucide-react";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface BlitzItem {
  id: string;
  tag: string;
  level: 1 | 2 | 3;
  prompt: ReactNode;
  options: string[];
  answer: number;
  why: string;
}

const LIVES = 3;

/**
 * Speed drill shared by SAT Blitz and Bug Blitz: three lives,
 * a shrinking timer per question and a streak multiplier (x1 → x3).
 */
export default function Blitz({
  title,
  intro,
  items,
  seconds,
  mono,
  onFinish,
}: {
  title: string;
  intro: ReactNode;
  items: BlitzItem[];
  seconds: (level: 1 | 2 | 3) => number;
  mono?: boolean;
  onFinish: (result: { answers: { id: string; tag: string; correct: boolean }[]; points: number }) => Promise<ReactNode>;
}) {
  const [phase, setPhase] = useState<"ready" | "q" | "answered" | "over">("ready");
  const [i, setI] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [streak, setStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [summary, setSummary] = useState<ReactNode>(null);
  const answers = useRef<{ id: string; tag: string; correct: boolean }[]>([]);
  const q = items[i];
  const mult = Math.min(3, 1 + Math.floor(streak / 2));

  useEffect(() => {
    if (phase !== "q") return;
    if (left <= 0) {
      choose(-1);
      return;
    }
    const t = setTimeout(() => setLeft((s) => +(s - 0.2).toFixed(1)), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, left]);

  function begin(k: number) {
    setI(k);
    setPicked(null);
    setLeft(seconds(items[k]!.level));
    setPhase("q");
  }

  function choose(opt: number) {
    if (phase !== "q" || !q) return;
    const correct = opt === q.answer;
    answers.current.push({ id: q.id, tag: q.tag, correct });
    setPicked(opt);
    if (correct) {
      const bonus = Math.round((left / seconds(q.level)) * 50);
      setPoints((p) => p + (100 + bonus) * mult);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
      setLives((l) => l - 1);
    }
    setPhase("answered");
  }

  async function next() {
    if (lives <= 0 || i + 1 >= items.length) {
      setPhase("over");
      setSummary(await onFinish({ answers: answers.current, points }).catch(() => null));
      return;
    }
    begin(i + 1);
  }

  function restart() {
    answers.current = [];
    setLives(LIVES);
    setStreak(0);
    setPoints(0);
    setSummary(null);
    setPhase("ready");
  }

  if (phase === "ready") {
    return (
      <Card className="flex flex-col gap-4 bg-secondary text-secondary-foreground">
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          <Zap className="size-4" /> {title}
        </p>
        <div className="text-sm text-white/75">{intro}</div>
        <Button size="lg" variant="accent" className="self-start" disabled={!items.length} onClick={() => begin(0)}>
          Старт
        </Button>
      </Card>
    );
  }

  if (phase === "over") {
    const right = answers.current.filter((a) => a.correct).length;
    return (
      <Card className="flex flex-col gap-3 bg-secondary text-secondary-foreground">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent">{lives <= 0 ? "Жизни закончились" : "Все вопросы пройдены"}</p>
        <p className="font-display text-5xl font-semibold tabular">{points}</p>
        <p className="text-sm text-white/70">
          Верно {right} из {answers.current.length}
        </p>
        {summary && <div className="text-sm text-white/80">{summary}</div>}
        <Button variant="accent" className="self-start" onClick={restart}>
          Ещё раз
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary px-5 py-3 text-secondary-foreground">
        <span className="flex gap-1" aria-label={`Жизни: ${lives}`}>
          {Array.from({ length: LIVES }, (_, k) => (
            <Heart key={k} className={cn("size-5", k < lives ? "fill-accent text-accent" : "text-white/25")} />
          ))}
        </span>
        <span className="text-sm text-white/70">
          {i + 1} · {q!.tag}
        </span>
        <span className="font-display font-semibold">
          <Badge tone="brand" className="mr-2">
            x{mult}
          </Badge>
          <span className="tabular">{points}</span>
        </span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-linear" style={{ width: `${(left / seconds(q!.level)) * 100}%` }} />
        </div>
      </div>
      <Card className="flex flex-col gap-4">
        <div className="text-[15px]">{q!.prompt}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {q!.options.map((o, k) => {
            const state = phase === "answered" ? (k === q!.answer ? "right" : k === picked ? "wrong" : "") : "";
            return (
              <button
                key={k}
                type="button"
                disabled={phase === "answered"}
                onClick={() => choose(k)}
                className={cn(
                  "rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors",
                  mono && "font-mono",
                  state === "right" ? "border-success bg-[#e3f3ea] dark:bg-success/15" : state === "wrong" ? "border-destructive bg-[#fde3e4] dark:bg-destructive/15" : "border-border hover:border-primary",
                )}
              >
                <RichText text={o} />
              </button>
            );
          })}
        </div>
        {phase === "answered" && (
          <>
            <div className="rounded-xl bg-muted px-4 py-3 text-sm">
              <b>{picked === q!.answer ? "Верно. " : picked === -1 ? "Время вышло. " : "Не то. "}</b>
              <RichText text={q!.why} className="inline [&>p]:inline" />
            </div>
            <Button onClick={next} autoFocus className="self-start">
              {lives <= 0 ? "Итоги" : "Дальше"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
