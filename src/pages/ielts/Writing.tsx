import { useEffect, useMemo, useState } from "react";
import type { WritingAnnotation, WritingResult } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { mmss } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Segmented } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { BandHeader, PlanList } from "./Results";
import Chart from "./Chart";
import type { IeltsContent } from "./content";

export default function Writing() {
  const { data, error, loading } = useApi<IeltsContent>("/ielts/content");
  const [task, setTask] = useState<"1" | "2">("2");
  const [promptId, setPromptId] = useState("");
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const list = task === "1" ? data.writing.task1 : data.writing.task2;
  const current = list.find((p) => p.id === promptId) ?? list[0]!;

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHeader eyebrow="IELTS" title="Writing" description="Напиши ответ: подключённая модель даёт ориентировочный разбор текста. В деморежиме показывается объём без оценки языкового уровня." />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={task}
          onChange={(v) => {
            setTask(v);
            setPromptId("");
          }}
          options={[
            { value: "1", label: "Task 1 · график" },
            { value: "2", label: "Task 2 · эссе" },
          ]}
        />
        <Select aria-label="Задание" className="h-9 w-auto max-w-full text-xs" value={current.id} onChange={(e) => setPromptId(e.target.value)}>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {"type" in p ? `${p.type}: ${p.prompt.slice(0, 60)}…` : p.title}
            </option>
          ))}
        </Select>
      </div>
      <Editor key={current.id} task={task} prompt={current} />
    </div>
  );
}

function Editor({ task, prompt }: { task: "1" | "2"; prompt: IeltsContent["writing"]["task1"][number] | IeltsContent["writing"]["task2"][number] }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<WritingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const limit = task === "1" ? 20 * 60 : 40 * 60;
  const minWords = task === "1" ? 150 : 250;
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    if (!started || result) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [started, result]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      setResult(await api<WritingResult>("/ielts/writing", { body: { task: Number(task), promptId: prompt.id, text } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const left = started ? limit - (now - started) / 1000 : limit;

  return (
    <>
      <Card className="flex flex-col gap-4">
        <p className="text-[15px] font-medium leading-relaxed">{prompt.prompt}</p>
        {"series" in prompt && <Chart {...prompt} />}
      </Card>

      {!result ? (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className={cn("font-semibold tabular", words < minWords ? "text-muted-foreground" : "text-success")}>
              {words} / {minWords}+ слов
            </span>
            <Badge tone={left < 300 ? "bad" : "dark"} className="tabular">
              {started ? mmss(left) : `${limit / 60} минут`}
            </Badge>
          </div>
          <Textarea
            id="essay"
            rows={16}
            spellCheck={false}
            className="font-serif text-[16px] leading-7"
            placeholder="Начни писать — таймер запустится сам. Проверка орфографии браузера выключена, как на экзамене."
            value={text}
            onChange={(e) => {
              if (!started) setStarted(Date.now());
              setText(e.target.value);
            }}
          />
          <ErrorBox message={error} />
          <Button size="lg" className="self-start" onClick={submit} disabled={busy || words < 40}>
            {busy ? "Проверяю… (до минуты)" : "Проверить работу"}
          </Button>
        </Card>
      ) : (
        <>
          <BandHeader overall={result.overall} predicted={result.predicted} criteria={result.criteria} mode={result.mode} extra={`${result.wordCount} слов`} />
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <CardTitle>Твой текст</CardTitle>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <i className="inline-block h-1 w-5 rounded bg-destructive" /> ошибка
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <i className="inline-block h-1 w-5 rounded bg-success" /> удачная фраза
              </span>
            </div>
            <Annotated text={text} notes={result.annotations} />
          </Card>
          <PlanList title="Что делать дальше" items={result.plan} />
          <Button variant="outline" className="self-start" onClick={() => setResult(null)}>
            Исправить и проверить снова
          </Button>
        </>
      )}
    </>
  );
}

/** Highlights each quoted fragment in place; tap/hover shows the comment and the fix. */
function Annotated({ text, notes }: { text: string; notes: WritingAnnotation[] }) {
  const [active, setActive] = useState<number | null>(null);
  const parts = useMemo(() => {
    const spans: { start: number; end: number; i: number }[] = [];
    notes.forEach((n, i) => {
      const start = text.indexOf(n.quote);
      if (start >= 0 && !spans.some((s) => start < s.end && start + n.quote.length > s.start)) spans.push({ start, end: start + n.quote.length, i });
    });
    spans.sort((a, b) => a.start - b.start);
    const out: { text: string; i: number | null }[] = [];
    let pos = 0;
    for (const s of spans) {
      if (s.start > pos) out.push({ text: text.slice(pos, s.start), i: null });
      out.push({ text: text.slice(s.start, s.end), i: s.i });
      pos = s.end;
    }
    out.push({ text: text.slice(pos), i: null });
    return out;
  }, [text, notes]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
      <p className="whitespace-pre-wrap font-serif text-[16px] leading-8">
        {parts.map((p, k) =>
          p.i === null ? (
            <span key={k}>{p.text}</span>
          ) : (
            <button
              key={k}
              type="button"
              onClick={() => setActive(p.i)}
              onMouseEnter={() => setActive(p.i)}
              className={cn(
                "rounded-sm text-left underline decoration-2 underline-offset-4",
                notes[p.i]!.kind === "error" ? "decoration-destructive bg-destructive/8" : "decoration-success bg-success/10",
                active === p.i && "ring-2 ring-ring",
              )}
            >
              {p.text}
            </button>
          ),
        )}
      </p>
      <ul className="flex flex-col gap-2">
        {notes.map((n, i) => (
          <li key={i}>
            <button type="button" onClick={() => setActive(i)} className={cn("w-full rounded-xl border p-3 text-left text-sm", active === i ? "border-primary" : "border-border")}>
              <span className="flex items-center gap-2">
                <Badge tone={n.kind === "error" ? "bad" : "ok"}>{n.category}</Badge>
                <span className="truncate font-serif italic">“{n.quote}”</span>
              </span>
              <span className="mt-1 block text-muted-foreground">{n.comment}</span>
              {n.fix && n.kind === "error" && <span className="mt-1 block font-medium text-success">→ {n.fix}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
