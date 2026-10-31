import { useEffect, useState } from "react";
import type { IeltsChoiceQuestion } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { mmss } from "@/lib/format";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CircleProgress } from "@/components/ui/circle-progress";
import Questions, { type CheckResult } from "./Questions";
import type { IeltsContent } from "./content";

export default function Reading() {
  const content = useApi<IeltsContent>("/ielts/content");
  const [id, setId] = useState("");
  const [type, setType] = useState("");
  const list = content.data?.reading ?? [];
  if (content.loading) return <Loading />;
  if (!content.data) return <ErrorBox message={content.error} />;
  const types = [...new Set(list.map((r) => r.level))];
  const shown = list.filter((r) => !type || r.level === type);
  const current = shown.find((r) => r.id === id)?.id ?? shown[0]?.id ?? "";
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="IELTS" title="Reading" description={`Банк академических текстов: ${list.length} текстов, ${list.reduce((n, r) => n + r.questions, 0)} вопросов. На каждый текст 20 минут.`} />
      <div className="flex flex-wrap items-center gap-3">
        <Select aria-label="Тип заданий" value={type} onChange={(e) => setType(e.target.value)} className="max-w-xs">
          <option value="">Все типы ({list.length})</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t} ({list.filter((r) => r.level === t).length})
            </option>
          ))}
        </Select>
      </div>
      <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3" role="listbox" aria-label="Тексты">
        {shown.map((r) => (
          <button
            key={r.id}
            type="button"
            role="option"
            aria-selected={r.id === current}
            onClick={() => setId(r.id)}
            className={cn("flex flex-col gap-1 rounded-xl border-2 px-3 py-2 text-left text-sm", r.id === current ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30")}
          >
            <span className="font-semibold leading-snug">{r.title}</span>
            <span className="text-xs text-muted-foreground">
              {r.level} · {r.questions} вопр.
            </span>
          </button>
        ))}
      </div>
      {current && <Passage key={current} id={current} />}
    </div>
  );
}

function Passage({ id }: { id: string }) {
  const { data, error, loading } = useApi<{ title: string; level: string; passage: string; questions: IeltsChoiceQuestion[] }>(`/ielts/reading/${id}`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CheckResult | null>(null);
  const [left, setLeft] = useState(20 * 60);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (result || left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, result]);

  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;

  async function check() {
    try {
      setResult(await api<CheckResult>(`/ielts/reading/${id}`, { body: { answers } }));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-120px)] lg:overflow-y-auto">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Badge>{data.level}</Badge>
          <Badge tone={left < 180 ? "bad" : "dark"} className="tabular">
            {mmss(left)}
          </Badge>
        </div>
        <h2 className="font-display text-xl font-semibold">{data.title}</h2>
        <div className="mt-3 space-y-4 font-serif text-[16px] leading-7">
          {data.passage.split("\n\n").map((p) => (
            <p key={p.slice(0, 20)}>
              <b className="mr-1 font-display text-primary">{p.slice(0, 1)}</b>
              {p.slice(2)}
            </p>
          ))}
        </div>
      </Card>
      <div className="flex flex-col gap-4">
        {result && (
          <Card className="flex items-center gap-4">
            <CircleProgress value={result.band} max={9} size={90} stroke={9}>
              <p className="font-display text-2xl font-semibold">{result.band}</p>
            </CircleProgress>
            <div>
              <p className="font-display text-lg font-semibold">
                {result.right} из {result.total} верно
              </p>
              <p className="text-xs text-muted-foreground">Балл пересчитан на шкалу из 40 вопросов — это ориентир.</p>
            </div>
          </Card>
        )}
        <Questions questions={data.questions} answers={answers} onChange={setAnswers} result={result} />
        <ErrorBox message={err} />
        {!result && (
          <Button size="lg" className="self-start" onClick={check}>
            Проверить ответы
          </Button>
        )}
      </div>
    </div>
  );
}
