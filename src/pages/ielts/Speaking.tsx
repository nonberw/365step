import { useEffect, useRef, useState } from "react";
import { Mic, Square, Shuffle } from "lucide-react";
import type { SpeakingResult } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useSpeech } from "@/hooks/useSpeech";
import { mmss } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, Segmented } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { BandHeader, PlanList } from "./Results";
import type { IeltsContent } from "./content";

type Part = "1" | "2" | "3";
const LIMIT: Record<Part, number> = { "1": 60, "2": 120, "3": 90 };

export default function Speaking() {
  const { data, error, loading } = useApi<IeltsContent>("/ielts/content");
  const [part, setPart] = useState<Part>("2");
  const [idx, setIdx] = useState(0);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;

  const p2 = data.speaking.part2;
  const p1 = data.speaking.part1;
  const prompts =
    part === "1"
      ? p1.map((t) => ({ id: t.id, title: t.topic, text: t.questions.join(" "), lines: t.questions }))
      : part === "2"
        ? p2.map((c) => ({ id: c.id, title: c.topic, text: `${c.topic} You should say: ${c.points.join("; ")}.`, lines: c.points.map((x) => `• ${x}`) }))
        : p2.map((c) => ({ id: `${c.id}-p3`, title: `По теме: ${c.topic}`, text: c.part3.join(" "), lines: c.part3 }));
  const prompt = prompts[idx % prompts.length]!;

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader eyebrow="IELTS" title="Speaking" description="Браузер расшифрует речь. Подключённая модель разбирает связность, лексику и грамматику текста; произношение и аудиоплавность без анализа аудио не оцениваются." />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={part}
          onChange={(v) => {
            setPart(v);
            setIdx(0);
          }}
          options={[
            { value: "1", label: "Part 1 · вопросы" },
            { value: "2", label: "Part 2 · карточка" },
            { value: "3", label: "Part 3 · дискуссия" },
          ]}
        />
        <Button variant="outline" size="sm" onClick={() => setIdx(idx + 1 + Math.floor(Math.random() * 3))}>
          <Shuffle /> Другая тема
        </Button>
      </div>
      <Session key={`${part}-${prompt.id}`} part={part} prompt={prompt} />
    </div>
  );
}

function Session({ part, prompt }: { part: Part; prompt: { id: string; title: string; text: string; lines: string[] } }) {
  const speech = useSpeech("en-US");
  const [phase, setPhase] = useState<"idle" | "prep" | "talk" | "done">("idle");
  const [prep, setPrep] = useState(60);
  const [elapsed, setElapsed] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<SpeakingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(0);

  useEffect(() => {
    if (phase === "prep") {
      if (prep <= 0) return startTalking();
      const t = setTimeout(() => setPrep((s) => s - 1), 1000);
      return () => clearTimeout(t);
    }
    if (phase === "talk") {
      const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, prep]);

  useEffect(() => {
    if (phase === "talk" && elapsed >= LIMIT[part]) finishTalking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  function startTalking() {
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase("talk");
    if (speech.supported) speech.start();
  }

  function finishTalking() {
    speech.stop();
    setPhase("done");
  }

  const transcript = (speech.text + " " + typed).trim();

  async function submit() {
    setBusy(true);
    setError("");
    try {
      setResult(await api<SpeakingResult>("/ielts/speaking", { body: { part: Number(part), prompt: prompt.text, promptId: prompt.id, transcript, seconds: Math.max(elapsed, transcript.split(/\s+/).length / 2.2) } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="flex flex-col gap-3 bg-secondary text-secondary-foreground">
        <Badge tone="brand" className="self-start">
          Part {part}
        </Badge>
        <p className="font-display text-xl font-semibold">{prompt.title}</p>
        <ul className="flex flex-col gap-1 text-sm text-white/80">
          {prompt.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Card>

      {!result && (
        <Card className="flex flex-col items-center gap-4 text-center">
          {phase === "idle" && (
            <>
              <p className="text-sm text-muted-foreground">
                {part === "2" ? "Сначала минута на подготовку, затем до 2 минут речи." : `Ответь на вопросы подряд, до ${LIMIT[part]} секунд.`}
                {!speech.supported && " Твой браузер не распознаёт речь — ответ можно напечатать."}
              </p>
              <Button size="lg" onClick={() => (part === "2" ? setPhase("prep") : startTalking())}>
                <Mic /> {part === "2" ? "Начать подготовку" : "Начать отвечать"}
              </Button>
            </>
          )}
          {phase === "prep" && (
            <>
              <p className="font-display text-5xl font-semibold tabular">{mmss(prep)}</p>
              <p className="text-sm text-muted-foreground">Подготовка: набросай 3–4 ключевых слова для каждого пункта.</p>
              <Button onClick={startTalking}>Я готов(а), начать</Button>
            </>
          )}
          {phase === "talk" && (
            <>
              <div className="relative grid size-24 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
                <span className="grid size-20 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Mic className="size-8" />
                </span>
              </div>
              <p className="font-display text-3xl font-semibold tabular">
                {mmss(elapsed)} <span className="text-base text-muted-foreground">/ {mmss(LIMIT[part])}</span>
              </p>
              <Button variant="dark" onClick={finishTalking}>
                <Square /> Закончить
              </Button>
            </>
          )}
          {(phase === "talk" || phase === "done") && (
            <div className="w-full text-left">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Расшифровка {speech.listening && "(слушаю…)"}</p>
              <p className={cn("min-h-16 rounded-xl bg-muted/60 p-3 text-sm", !transcript && "text-muted-foreground")}>
                {speech.text || (phase === "talk" ? "Говори — текст появится здесь" : "")} <span className="text-muted-foreground">{speech.interim}</span>
              </p>
              {(phase === "done" || !speech.supported || speech.error) && (
                <Textarea id="typed-answer" className="mt-3" rows={4} placeholder="Можно дописать или напечатать ответ, если распознавание не сработало" value={typed} onChange={(e) => setTyped(e.target.value)} />
              )}
            </div>
          )}
          <ErrorBox message={speech.error || error} className="w-full text-left" />
          {phase === "done" && (
            <Button size="lg" onClick={submit} disabled={busy || transcript.split(/\s+/).length < 10}>
              {busy ? "Оцениваю…" : "Получить оценку"}
            </Button>
          )}
        </Card>
      )}

      {result && (
        <>
          <BandHeader overall={result.overall} predicted={result.predicted} criteria={result.criteria} mode={result.mode} extra={`Темп: ${result.wordsPerMinute} слов/мин`} />
          <PlanList title="Что заметил экзаменатор" items={result.feedback} />
          <PlanList title="План на неделю" items={result.plan} />
          <Card>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Твой ответ</p>
            <p className="text-sm">{transcript}</p>
          </Card>
        </>
      )}
    </>
  );
}
