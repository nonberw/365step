import type { IeltsChoiceQuestion } from "@shared/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface CheckResult {
  items: { id: string; given: string; answer: string; why: string; correct: boolean }[];
  right: number;
  total: number;
  band: number;
}

/** True/False/Not Given, multiple choice and gap-fill questions with results. */
export default function Questions({ questions, answers, onChange, result }: { questions: IeltsChoiceQuestion[]; answers: Record<string, string>; onChange: (a: Record<string, string>) => void; result: CheckResult | null }) {
  const set = (id: string, v: string) => onChange({ ...answers, [id]: v });
  return (
    <ol className="flex flex-col gap-5">
      {questions.map((q) => {
        const r = result?.items.find((i) => i.id === q.id);
        return (
          <li key={q.id} className={cn("rounded-2xl border p-4", r ? (r.correct ? "border-success/60" : "border-destructive/60") : "border-border")}>
            <p className="mb-3 text-sm font-medium">
              <span className="mr-2 font-display font-bold text-primary">{q.id}.</span>
              {q.text}
            </p>
            {q.kind === "gap" ? (
              <Input id={`q-${q.id}`} aria-label={`Ответ на вопрос ${q.id}`} className="h-10 max-w-xs" value={answers[q.id] ?? ""} disabled={!!result} onChange={(e) => set(q.id, e.target.value)} placeholder="Одно слово или число" />
            ) : (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Вопрос ${q.id}`}>
                {(q.kind === "tfng" ? ["TRUE", "FALSE", "NOT GIVEN"] : q.options!).map((o) => {
                  const value = q.kind === "tfng" ? o : o.slice(0, 1);
                  const on = answers[q.id] === value;
                  return (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={!!result}
                      onClick={() => set(q.id, value)}
                      className={cn("rounded-xl border-2 px-3 py-2 text-left text-sm", on ? "border-primary bg-primary/5 font-semibold" : "border-border hover:border-foreground/30")}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
            {r && (
              <p className={cn("mt-3 text-sm", r.correct ? "text-success" : "text-destructive")}>
                {r.correct ? "Верно." : `Правильно: ${r.answer}.`} <span className="text-muted-foreground">{r.why}</span>
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
