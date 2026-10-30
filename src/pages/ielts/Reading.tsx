import { useEffect, useState } from "react";
import type { IeltsChoiceQuestion } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { mmss } from "@/lib/format";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, Segmented } from "@/components/ui/card";
import { CircleProgress } from "@/components/ui/circle-progress";
import Questions, { type CheckResult } from "./Questions";
import type { IeltsContent } from "./content";

export default function Reading() {
  const content = useApi<IeltsContent>("/ielts/content");
  const [id, setId] = useState("");
  const list = content.data?.reading ?? [];
  const current = id || list[0]?.id || "";
  if (content.loading) return <Loading />;
  if (!content.data) return <ErrorBox message={content.error} />;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="IELTS" title="Reading" description="Академические тексты с вопросами как на экзамене. На каждый текст 20 минут." />
      <Segmented value={current} onChange={setId} options={list.map((r) => ({ value: r.id, label: r.title }))} />
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
