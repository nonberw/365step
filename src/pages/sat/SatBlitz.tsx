import { useMemo, useState } from "react";
import type { SatQuestion } from "@shared/types";
import { DOMAIN_EN } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import Blitz, { type BlitzItem } from "@/components/Blitz";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { Segmented } from "@/components/ui/card";
import { CalculatorWorkspace, useSatTools } from "./SatTools";

export default function SatBlitz() {
  const tools = useSatTools();
  const [section, setSection] = useState<"mixed" | "math" | "rw">("math");
  const [round, setRound] = useState(0);
  const { data, error, loading } = useApi<SatQuestion[]>(`/sat/blitz?section=${section}&r=${round}`);

  const items = useMemo<BlitzItem[]>(
    () =>
      (data ?? [])
        .filter((q) => q.choices)
        .map((q) => ({
          id: q.id,
          tag: DOMAIN_EN[q.domain],
          level: q.difficulty,
          math: q.section === "math",
          prompt: (
            <div className="space-y-3">
              {q.passage && <RichText text={q.passage} math={q.section === "math"} className="rounded-xl bg-muted/60 p-3 font-serif text-[15px]" />}
              <RichText text={q.stem} math={q.section === "math"} className="font-medium" />
            </div>
          ),
          options: q.choices!,
          answer: q.answer as number,
          why: q.explanation,
        })),
    [data],
  );

  return (
    <div className={`flex flex-col gap-5 ${tools.desmosOpen ? "" : "max-w-3xl"}`}>
      {tools.panels}
      <PageHeader eyebrow="SAT" title="Blitz" description={"Timed practice with three lives. Consecutive correct answers raise your multiplier to x3."} />
      <Segmented
        value={section}
        onChange={(v) => {
          setSection(v);
          setRound((r) => r + 1);
        }}
        options={[
          { value: "math", label: "Math" },
          { value: "rw", label: "Reading & Writing" },
          { value: "mixed", label: "Mixed" },
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
          toolButtons={tools.buttons}
          workspace={(content, math) => <CalculatorWorkspace open={math && tools.desmosOpen} onClose={tools.closeDesmos}>{content}</CalculatorWorkspace>}
          intro={<p>{items.length} questions, from easier to harder. You have 35–75 seconds per question, depending on difficulty. Answers count towards domain statistics.</p>}
          items={items}
          seconds={(l) => (section === "rw" ? [0, 45, 60, 75][l]! : [0, 35, 55, 75][l]!)}
          onFinish={async ({ answers, points }) => {
            const domainOf = new Map((data ?? []).map((q) => [q.id, q.domain]));
            const r = await api<{ xp: number }>("/sat/blitz/result", { body: { answers: answers.map((a) => ({ id: a.id, domain: domainOf.get(a.id), correct: a.correct })), points } });
            return <p>+{r.xp} XP towards the monthly leaderboard</p>;
          }}
        />
      )}
    </div>
  );
}
