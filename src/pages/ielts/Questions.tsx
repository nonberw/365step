import type { IeltsChoiceQuestion } from "@shared/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface CheckResult {
  items: { id: string; given: string; answer: string; why: string; correct: boolean }[];
  right: number;
  total: number;
  band: null;
  percentage: number;
  feedback: string;
}

/** True/False/Not Given, multiple choice and gap-fill questions with results. */
export default function Questions({ questions, answers, onChange, result }: { questions: IeltsChoiceQuestion[]; answers: Record<string, string>; onChange: (a: Record<string, string>) => void; result: CheckResult | null }) {
  const set = (id: string, v: string) => onChange({ ...answers, [id]: v });
  return (
    <ol className="flex flex-col gap-5">
      {questions.map((q, index) => {
        const r = result?.items.find((i) => i.id === q.id);
        return (
          <li key={q.id} className={cn("rounded-2xl border p-4", r ? (r.correct ? "border-success/60" : "border-destructive/60") : "border-border")}>
            {q.headingGroup && questions[index - 1]?.headingGroup?.id !== q.headingGroup.id && (
              <div className="mb-4 rounded-xl bg-muted p-3 text-sm"><p className="font-semibold">{q.headingGroup.instruction}</p><ol className="mt-2 space-y-1">{q.headingGroup.options.map((o) => <li key={o.value}><b>{o.value}.</b> {o.text}</li>)}</ol></div>
            )}
            <p className="mb-3 text-sm font-medium">
              <span className="mr-2 font-display font-bold text-primary">{q.id}.</span>
              {q.text}
            </p>
            {q.kind === "headings" && q.headingGroup ? (
              <select aria-label={`Heading for question ${q.id}`} value={answers[q.id] ?? ""} disabled={!!result} onChange={(e) => set(q.id, e.target.value)} className="max-w-full rounded-lg border p-2 bg-card">
                <option value="">Choose a heading</option>
                {q.headingGroup.options.map((o) => <option key={o.value} value={o.value} disabled={!q.headingGroup!.reuse && questions.some((other) => other.id !== q.id && other.headingGroup?.id === q.headingGroup!.id && answers[other.id] === o.value)}>{o.value}. {o.text}</option>)}
              </select>
            ) : q.kind === "gap" ? (
              <Input id={`q-${q.id}`} aria-label={`Answer to question ${q.id}`} className="h-10 max-w-xs" value={answers[q.id] ?? ""} disabled={!!result} onChange={(e) => set(q.id, e.target.value)} placeholder={q.maxWords ? `No more than ${q.maxWords} words` : "One word or number"} />
            ) : (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Question ${q.id}`}>
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
                {r.correct ? "Correct" : `Correct answer: ${r.answer}.`} <span className="text-muted-foreground">{r.why}</span>
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
