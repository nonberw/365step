import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Flame, Keyboard, Target, Timer, XCircle, Zap } from "lucide-react";
import type { SatQuestionPublic } from "@shared/types";
import { api } from "@/api";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card, Progress } from "@/components/ui/card";
import QuestionView, { type Response } from "./QuestionView";
import { CalculatorWorkspace, useSatTools } from "./SatTools";

// SAT drills: short focused sets on the real test's pace (R&W 71 s, Math 95 s per question). Each question shows a
// pace bar; the summary compares accuracy and time with the pace and lists mistakes to review.

const KINDS = [
  { kind: "hard-math", title: "Hard Math", text: "Up to 10 questions rated Hard by the editorial review. Set size depends on the available questions.", icon: Flame },
  { kind: "hard-rw", title: "Hard Reading & Writing", text: "Up to 10 original Hard Reading & Writing questions. Difficulty ratings are editorial estimates, not statistically calibrated.", icon: Flame },
  { kind: "spr", title: "Enter your answer", text: "10 student-produced response questions: enter a number or fraction without answer choices.", icon: Keyboard },
  { kind: "weak", title: "My weakest area", text: "The platform will find the domain with the lowest accuracy and collect 10 questions.", icon: Target },
  { kind: "sprint", title: "20-question sprint", text: "A timed mix of medium and hard questions to build test-taking pace.", icon: Zap },
] as const;

type Item = SatQuestionPublic & { pace: number };
interface Drill {
  title: string;
  note: string;
  items: Item[];
}

export default function SatDrills() {
  const [drill, setDrill] = useState<Drill | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  async function start(kind: string) {
    setLoading(kind);
    setError("");
    try {
      setDrill(await api<Drill>("/sat/drill", { body: { kind } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading("");
    }
  }

  if (drill) return <Run drill={drill} onExit={() => setDrill(null)} />;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">SAT</p>
        <h1 className="font-display text-3xl font-bold">Drills</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Short sets at Digital SAT pace: about 71 seconds per Reading &amp; Writing question and 95 seconds per Math question. Review your timing and revisit mistakes.
        </p>
      </div>
      {error && <ErrorBox message={error} />}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {KINDS.map((k) => (
          <Card key={k.kind} className="flex flex-col gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary/10">
              <k.icon className="size-5 text-primary" />
            </span>
            <p className="font-display text-lg font-semibold">{k.title}</p>
            <p className="flex-1 text-sm text-muted-foreground">{k.text}</p>
            <Button className="self-start" onClick={() => start(k.kind)} disabled={!!loading}>
              {loading === k.kind ? "Preparing…" : "Start"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Run({ drill, onExit }: { drill: Drill; onExit: () => void }) {
  const tools = useSatTools();
  const [i, setI] = useState(0);
  const [value, setValue] = useState<Response>(null);
  const [checked, setChecked] = useState<{ correct: boolean; answer: number | string; explanation: string } | null>(null);
  const [log, setLog] = useState<{ id: string; correct: boolean; sec: number; pace: number }[]>([]);
  const [start, setStart] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const q = drill.items[i];

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  if (!q) {
    const right = log.filter((l) => l.correct).length;
    const avg = log.reduce((a, l) => a + l.sec, 0) / Math.max(1, log.length);
    const pace = log.reduce((a, l) => a + l.pace, 0) / Math.max(1, log.length);
    return (
      <Card className="flex flex-col gap-4">
        <p className="font-display text-2xl font-bold">{drill.title}Results</p>
        <div className="grid grid-cols-3 gap-3">
          <Stat label={"Correct"} value={`${right} / ${log.length}`} />
          <Stat label={"Average time"} value={`${Math.round(avg)} s`} hot={avg > pace} />
          <Stat label={"SAT pace"} value={`${Math.round(pace)} s`} />
        </div>
        <p className="text-sm text-muted-foreground">
          {avg > pace ? `You are behind the target pace by ${Math.round(avg - pace)} seconds per question. At this pace, you may run out of time on the final questions.` : "You are on pace. Try a harder set when you are ready."}
        </p>
        <div className="flex flex-col gap-1">
          {log.map((l, k) => (
            <Link key={l.id} to={`/sat/q/${l.id}`} className="flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm hover:bg-muted">
              {l.correct ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
              <span className="flex-1">Question {k + 1}</span>
              <span className={cn("tabular", l.sec > l.pace ? "text-destructive" : "text-muted-foreground")}>
                {l.sec} s / {l.pace} s
              </span>
            </Link>
          ))}
        </div>
        <Button className="self-start" onClick={onExit}>
          Back to drills
        </Button>
      </Card>
    );
  }

  const sec = Math.round(((checked ? (log.at(-1)?.sec ?? 0) * 1000 : now - start) as number) / 1000);
  async function check() {
    setBusy(true);
    try {
      const ms = Date.now() - start;
      const r = await api<{ correct: boolean; answer: number | string; explanation: string }>("/sat/answer", { body: { id: q!.id, response: value, ms } });
      setChecked(r);
      setLog((l) => [...l, { id: q!.id, correct: r.correct, sec: Math.round(ms / 1000), pace: q!.pace }]);
    } finally {
      setBusy(false);
    }
  }
  const next = () => {
    setI(i + 1);
    setValue(null);
    setChecked(null);
    setStart(Date.now());
  };

  return (
    <div className="flex flex-col gap-4">
      {q.section === "math" && tools.panels}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-lg font-semibold">{drill.title}</span>
        {drill.note && <span className="text-sm text-muted-foreground">{drill.note}</span>}
        {q.section === "math" && <div className="ml-auto flex gap-1">{tools.buttons}</div>}
        <span className="ml-auto flex items-center gap-1.5 text-sm tabular">
          <Timer className="size-4" /> {sec} s of {q.pace}
        </span>
      </div>
      <Progress value={(i / drill.items.length) * 100} />
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full transition-all", sec > q.pace ? "bg-destructive" : sec > q.pace * 0.75 ? "bg-[#e0a100]" : "bg-success")} style={{ width: `${Math.min(100, (sec / q.pace) * 100)}%` }} />
      </div>
      <CalculatorWorkspace open={q.section === "math" && tools.desmosOpen} onClose={tools.closeDesmos} className="space-y-4">
        <Card>
          <QuestionView q={q} value={value} onChange={checked ? () => undefined : setValue} reveal={checked ? { answer: checked.answer, correct: checked.correct } : undefined} number={i + 1} />
        </Card>
        {checked && (
          <Card className={cn("flex flex-col gap-2 text-sm", checked.correct ? "border-success/50" : "border-destructive/50")}>
            <p className={cn("flex items-center gap-2 font-semibold", checked.correct ? "text-success" : "text-destructive")}>
              {checked.correct ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />} {checked.correct ? "Correct" : `Incorrect${q.choices ? "" : `: answer ${checked.answer}`}`}
            </p>
            <RichText text={checked.explanation} math={q.section === "math"} />
          </Card>
        )}
        <div className="flex gap-2">
          {checked ? (
            <Button onClick={next}>{i + 1 < drill.items.length ? "Next" : "Results"}</Button>
          ) : (
            <Button onClick={check} disabled={busy || value === null || value === ""}>
              Check answer
            </Button>
          )}
          <Button variant="outline" onClick={onExit}>
            Exit
          </Button>
        </div>
      </CalculatorWorkspace>
    </div>
  );
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className={cn("rounded-2xl px-3 py-2", hot ? "bg-destructive/10" : "bg-muted/60")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold tabular">{value}</p>
    </div>
  );
}
