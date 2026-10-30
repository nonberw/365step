import { useMemo, useState } from "react";
import type { SatQuestion } from "@shared/types";
import { DOMAIN_RU } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import Blitz, { type BlitzItem } from "@/components/Blitz";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { Segmented } from "@/components/ui/card";

export default function SatBlitz() {
  const [section, setSection] = useState<"mixed" | "math" | "rw">("math");
  const [round, setRound] = useState(0);
  const { data, error, loading } = useApi<SatQuestion[]>(`/sat/blitz?section=${section}&r=${round}`);

  const items = useMemo<BlitzItem[]>(
    () =>
      (data ?? [])
        .filter((q) => q.choices)
        .map((q) => ({
          id: q.id,
          tag: DOMAIN_RU[q.domain],
          level: q.difficulty,
          prompt: (
            <div className="space-y-3">
              {q.passage && <RichText text={q.passage} className="rounded-xl bg-muted/60 p-3 font-serif text-[15px]" />}
              <RichText text={q.stem} className="font-medium" />
            </div>
          ),
          options: q.choices!,
          answer: q.answer as number,
          why: q.explanation,
        })),
    [data],
  );

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader eyebrow="SAT" title="Blitz" description="Тренировка под давлением: каждый вопрос на время, три жизни, серия правильных ответов поднимает множитель до x3." />
      <Segmented
        value={section}
        onChange={(v) => {
          setSection(v);
          setRound((r) => r + 1);
        }}
        options={[
          { value: "math", label: "Math" },
          { value: "rw", label: "Reading & Writing" },
          { value: "mixed", label: "Смешанный" },
        ]}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <Blitz
          key={`${section}-${round}`}
          title="SAT Blitz"
          intro={<p>{items.length} вопросов от простых к сложным. Время на вопрос: 35 секунд для лёгких, до 75 для сложных. Ответы засчитываются в статистику по доменам.</p>}
          items={items}
          seconds={(l) => (section === "rw" ? [0, 45, 60, 75][l]! : [0, 35, 55, 75][l]!)}
          onFinish={async ({ answers, points }) => {
            const domainOf = new Map((data ?? []).map((q) => [q.id, q.domain]));
            const r = await api<{ xp: number }>("/sat/blitz/result", { body: { answers: answers.map((a) => ({ id: a.id, domain: domainOf.get(a.id), correct: a.correct })), points } });
            return <p>+{r.xp} XP в рейтинг месяца</p>;
          }}
        />
      )}
    </div>
  );
}
