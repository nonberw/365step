import { useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play } from "lucide-react";
import type { IeltsChoiceQuestion } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, Progress, Segmented } from "@/components/ui/card";
import { CircleProgress } from "@/components/ui/circle-progress";
import Questions, { type CheckResult } from "./Questions";
import type { IeltsContent } from "./content";

type Line = { voice: "a" | "b"; text: string };

export default function Listening() {
  const content = useApi<IeltsContent>("/ielts/content");
  const [id, setId] = useState("");
  const list = content.data?.listening ?? [];
  const current = id || list[0]?.id || "";
  if (content.loading) return <Loading />;
  if (!content.data) return <ErrorBox message={content.error} />;
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader eyebrow="IELTS" title="Listening" description="Запись читает голосовой движок браузера, поэтому аудиофайлы не нужны. Как на экзамене, прослушать можно один раз; для тренировки разрешён второй." />
      <Segmented
        value={current}
        onChange={(v) => {
          speechSynthesis.cancel();
          setId(v);
        }}
        options={list.map((l) => ({ value: l.id, label: l.title }))}
      />
      {current && <Recording key={current} id={current} />}
    </div>
  );
}

function pickVoices() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const gb = voices.filter((v) => v.lang === "en-GB");
  const pool = gb.length >= 2 ? gb : voices;
  return { a: pool[0], b: pool[1] ?? pool[0] };
}

function Recording({ id }: { id: string }) {
  const { data, error, loading } = useApi<{ title: string; section: string; script: Line[]; questions: IeltsChoiceQuestion[] }>(`/ielts/listening/${id}`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CheckResult | null>(null);
  const [line, setLine] = useState(-1);
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState("");
  const stopped = useRef(false);

  useEffect(() => () => speechSynthesis.cancel(), []);

  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;

  function play() {
    if (!("speechSynthesis" in window)) return setErr("Браузер не умеет озвучивать текст. Попробуй Chrome или Safari.");
    speechSynthesis.cancel();
    stopped.current = false;
    const v = pickVoices();
    setPlays((p) => p + 1);
    setPlaying(true);
    const say = (k: number) => {
      if (stopped.current || k >= data!.script.length) {
        setPlaying(false);
        setLine(-1);
        return;
      }
      const l = data!.script[k]!;
      const u = new SpeechSynthesisUtterance(l.text);
      u.lang = "en-GB";
      const voice = l.voice === "a" ? v.a : v.b;
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.pitch = l.voice === "b" && v.a === v.b ? 1.25 : 1;
      u.onend = () => setTimeout(() => say(k + 1), 350);
      setLine(k);
      speechSynthesis.speak(u);
    };
    say(0);
  }

  function stop() {
    stopped.current = true;
    speechSynthesis.cancel();
    setPlaying(false);
  }

  async function check() {
    stop();
    try {
      setResult(await api<CheckResult>(`/ielts/listening/${id}`, { body: { answers } }));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <Card className="flex flex-col gap-4 bg-secondary text-secondary-foreground">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-primary">
            <Headphones className="size-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">{data.title}</p>
            <p className="text-sm text-white/60">{data.section}</p>
          </div>
          <Badge tone="brand" className="ml-auto">
            Прослушиваний: {plays}/2
          </Badge>
        </div>
        <Progress value={line < 0 ? (plays ? 100 : 0) : ((line + 1) / data.script.length) * 100} tone="accent" className="bg-white/15" />
        <div className="flex gap-2">
          {playing ? (
            <Button variant="accent" onClick={stop}>
              <Pause /> Стоп
            </Button>
          ) : (
            <Button variant="accent" onClick={play} disabled={plays >= 2 || !!result}>
              <Play /> {plays ? "Прослушать ещё раз" : "Слушать"}
            </Button>
          )}
        </div>
      </Card>
      {result && (
        <Card className="flex items-center gap-4">
          <CircleProgress value={result.band} max={9} size={90} stroke={9}>
            <p className="font-display text-2xl font-semibold">{result.band}</p>
          </CircleProgress>
          <p className="font-display text-lg font-semibold">
            {result.right} из {result.total} верно
          </p>
        </Card>
      )}
      <Questions questions={data.questions} answers={answers} onChange={setAnswers} result={result} />
      <ErrorBox message={err} />
      {!result ? (
        <Button size="lg" className="self-start" onClick={check}>
          Проверить ответы
        </Button>
      ) : (
        <Card>
          <p className="mb-2 font-display font-semibold">Текст записи</p>
          <div className="flex flex-col gap-1.5 text-sm">
            {data.script.map((l, k) => (
              <p key={k}>
                <b className="text-primary">{l.voice === "a" ? "A" : "B"}:</b> {l.text}
              </p>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
