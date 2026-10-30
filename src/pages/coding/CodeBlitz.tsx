import { useMemo, useState } from "react";
import type { BlitzQuestion } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import Blitz, { type BlitzItem } from "@/components/Blitz";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";

export default function CodeBlitz() {
  const [round, setRound] = useState(0);
  const { data, error, loading } = useApi<BlitzQuestion[]>(`/coding/blitz?r=${round}`);
  const items = useMemo<BlitzItem[]>(
    () =>
      (data ?? []).map((q) => ({
        id: q.id,
        tag: q.skill,
        level: q.level,
        prompt: (
          <div className="space-y-3">
            <p className="font-medium">{q.question}</p>
            {q.code && <pre className="overflow-x-auto rounded-xl bg-[#141212] p-4 font-mono text-[13px] text-[#f3eeee]">{q.code}</pre>}
          </div>
        ),
        options: q.options,
        answer: q.answer,
        why: q.why,
      })),
    [data],
  );
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader eyebrow="Кодинг" title="Bug Blitz" description="Найди ошибку или предскажи результат кода быстрее таймера. Слабые навыки появятся на главной." />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <Blitz
          key={round}
          title="Bug Blitz"
          intro={<p>{items.length} задач от простых к сложным, три жизни. Две правильных подряд — множитель x2, четыре — x3.</p>}
          items={items}
          mono
          seconds={(l) => [0, 15, 20, 25][l]!}
          onFinish={async ({ answers, points }) => {
            const r = await api<{ xp: number }>("/coding/blitz/result", { body: { answers, points } });
            return (
              <p>
                +{r.xp} XP в рейтинг месяца ·{" "}
                <button type="button" className="underline" onClick={() => setRound((x) => x + 1)}>
                  новый набор
                </button>
              </p>
            );
          }}
        />
      )}
    </div>
  );
}
