import type { IeltsCriterion } from "@shared/types";
import { Badge, Card, CardTitle } from "@/components/ui/card";
import { CircleProgress } from "@/components/ui/circle-progress";

/** Band score header shared by Speaking and Writing results. */
export function BandHeader({ overall, predicted, criteria, mode, extra }: { overall: number | null; predicted: number | null; criteria: IeltsCriterion[]; mode: "ai" | "demo"; extra?: string }) {
  return (
    <Card className="flex flex-col gap-5 lg:flex-row lg:items-center">
      <div className="flex items-center gap-4">
        <CircleProgress value={overall ?? 0} max={9} size={124} stroke={11}>
          <div>
            <p className="font-display text-4xl font-semibold tabular">{mode === "demo" || overall === null ? "—" : overall.toFixed(1)}</p>
            <p className="text-[11px] text-muted-foreground">{mode === "demo" ? "не оценивалось" : criteria.some((c) => c.name === "Pronunciation") ? "по расшифровке" : "оценка ИИ"}</p>
          </div>
        </CircleProgress>
        <div>
          <Badge tone={mode === "ai" ? "dark" : "warn"}>{mode === "ai" ? "Оценка ИИ" : "Демо · без оценки"}</Badge>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{mode === "demo" ? "Демонстрация: языковой уровень не измерен, результат исключён из аналитики уровня." : criteria.some((c) => c.name === "Pronunciation") ? "Частичная оценка трёх критериев по тексту. Произношение и аудиоплавность не оценены; это не общий IELTS Speaking Band." : "Ориентировочная оценка текста, без прогноза официального результата."}</p>
          {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
        </div>
      </div>
      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {criteria.map((c) => (
          <div key={c.name} className="rounded-xl bg-muted/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{c.name}</p>
              <span className="font-display text-lg font-semibold tabular">{mode === "demo" || c.band === null ? "—" : c.band.toFixed(1)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{c.comment}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function PlanList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <ol className="mt-3 flex flex-col gap-2">
        {items.map((p, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">{i + 1}</span>
            {p}
          </li>
        ))}
      </ol>
    </Card>
  );
}
