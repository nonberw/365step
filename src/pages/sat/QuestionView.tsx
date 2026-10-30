import { useRef, useState } from "react";
import { Bookmark, Highlighter, Strikethrough } from "lucide-react";
import type { SatQuestionPublic } from "@shared/types";
import { DIFFICULTY_RU, DOMAIN_RU } from "@shared/types";
import { RichText } from "@/components/RichText";
import { Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Response = number | string | null;

interface Props {
  q: SatQuestionPublic;
  value: Response;
  onChange: (v: Response) => void;
  /** After checking: index/value of the right answer. */
  reveal?: { answer: number | string; correct: boolean } | null;
  marked?: boolean;
  onMark?: () => void;
  number?: number;
  showMeta?: boolean;
}

const LETTERS = "ABCD";

/**
 * Digital SAT style question: passage on the left with a highlighter,
 * question and choices on the right with answer elimination.
 */
export default function QuestionView({ q, value, onChange, reveal, marked, onMark, number, showMeta = true }: Props) {
  const [struck, setStruck] = useState<Set<number>>(new Set());
  const [eliminate, setEliminate] = useState(false);
  const [highlights, setHighlights] = useState<string[]>([]);
  const passageRef = useRef<HTMLDivElement>(null);
  const locked = !!reveal;

  function highlight() {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || !passageRef.current?.contains(sel!.anchorNode)) return;
    setHighlights((h) => (h.includes(text) ? h.filter((x) => x !== text) : [...h, text]));
    sel?.removeAllRanges();
  }

  const passage = q.passage ? markHighlights(q.passage, highlights) : null;

  return (
    <div className={cn("grid gap-6", q.passage && "lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-border")}>
      {q.passage && (
        <div className="min-w-0 lg:pr-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Выдели текст и нажми маркер</span>
            <button type="button" onClick={highlight} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted">
              <Highlighter className="size-3.5" /> Маркер
            </button>
          </div>
          <div ref={passageRef} className="font-serif text-[16px] leading-7" onMouseUp={() => undefined}>
            <RichText text={passage!} className="[&_strong]:rounded-[3px] [&_strong]:bg-accent/45 [&_strong]:font-normal" />
          </div>
        </div>
      )}
      <div className={cn("min-w-0", q.passage && "lg:pl-8")}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {number !== undefined && <span className="grid size-7 place-items-center rounded-md bg-secondary font-display text-sm font-bold text-secondary-foreground">{number}</span>}
          {onMark && (
            <button type="button" onClick={onMark} aria-pressed={marked} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", marked ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted")}>
              <Bookmark className="size-3.5" /> {marked ? "Отмечено" : "На проверку"}
            </button>
          )}
          {q.choices && !locked && (
            <button type="button" onClick={() => setEliminate(!eliminate)} aria-pressed={eliminate} className={cn("ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", eliminate ? "bg-secondary text-secondary-foreground" : "border border-border hover:bg-muted")}>
              <Strikethrough className="size-3.5" /> ABC
            </button>
          )}
          {showMeta && (
            <span className="flex w-full flex-wrap gap-1.5">
              <Badge>{DOMAIN_RU[q.domain]}</Badge>
              <Badge tone={q.difficulty === 3 ? "bad" : q.difficulty === 2 ? "warn" : "ok"}>{DIFFICULTY_RU[q.difficulty]}</Badge>
              {q.source === "ai" && <Badge tone="dark">Сделано ИИ</Badge>}
            </span>
          )}
        </div>
        <RichText text={q.stem} className="text-[16px] font-medium" />
        {q.choices ? (
          <ul className="mt-5 flex flex-col gap-2.5" role="radiogroup" aria-label="Варианты ответа">
            {q.choices.map((c, i) => {
              const selected = value === i;
              const right = reveal && reveal.answer === i;
              const wrong = reveal && selected && !reveal.correct;
              const isStruck = struck.has(i);
              return (
                <li key={i} className={cn("flex items-center gap-2", isStruck && "choice-struck")}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={locked}
                    onClick={() => onChange(selected ? null : i)}
                    className={cn(
                      "flex min-w-0 flex-1 items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                      selected ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30",
                      right && "border-success bg-[#e3f3ea] dark:bg-success/15",
                      wrong && "border-destructive bg-[#fde3e4] dark:bg-destructive/15",
                    )}
                  >
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-bold", selected ? "border-primary bg-primary text-primary-foreground" : "border-foreground/40")}>{LETTERS[i]}</span>
                    <span className="choice-text min-w-0 pt-0.5">
                      <RichText text={c} />
                    </span>
                  </button>
                  {eliminate && !locked && (
                    <button
                      type="button"
                      aria-label={isStruck ? `Вернуть вариант ${LETTERS[i]}` : `Вычеркнуть вариант ${LETTERS[i]}`}
                      onClick={() => setStruck((s) => {
                        const n = new Set(s);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })}
                      className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold", isStruck ? "border-foreground" : "border-border text-muted-foreground line-through")}
                    >
                      {isStruck ? "↺" : LETTERS[i]}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <label htmlFor={`grid-${q.id}`} className="text-xs font-semibold text-muted-foreground">
              Ответ (число, дробь вида 3/4 или десятичная)
            </label>
            <Input id={`grid-${q.id}`} className="h-12 max-w-[220px] font-mono text-lg" value={(value as string) ?? ""} disabled={locked} onChange={(e) => onChange(e.target.value.replace(/[^\d./-]/g, "").slice(0, 7) || null)} />
            {reveal && <p className={cn("text-sm font-semibold", reveal.correct ? "text-success" : "text-destructive")}>Правильный ответ: {String(reveal.answer)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Wraps highlighted snippets in **…** so RichText renders them as marks. */
function markHighlights(text: string, highlights: string[]) {
  let out = text;
  for (const h of highlights) {
    const i = out.indexOf(h);
    if (i >= 0) out = out.slice(0, i) + `**${h}**` + out.slice(i + h.length);
  }
  return out;
}
