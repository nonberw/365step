import { Check, X } from "lucide-react";
import type { EntAnswer, EntQuestionPublic } from "@shared/ent";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";

export const TYPE_HINT = {
  single: "Выбери один правильный ответ",
  context: "Прочитай текст и выбери один правильный ответ",
  multi: "Выбери от одного до трёх правильных ответов",
  match: "Установи соответствие: для каждого пункта слева выбери вариант справа",
} as const;

const L = (i: number) => String.fromCharCode(65 + i);

/** One ENT question with the input its type needs. `reveal` shows the right answer after checking. */
export function EntQuestion({ q, value, onChange, reveal, disabled }: { q: EntQuestionPublic; value: EntAnswer; onChange: (v: EntAnswer) => void; reveal?: number | number[] | null; disabled?: boolean }) {
  const picked = (i: number) => (q.type === "multi" ? Array.isArray(value) && value.includes(i) : value === i);
  const right = (i: number) => reveal !== undefined && reveal !== null && (Array.isArray(reveal) ? q.type === "multi" && reveal.includes(i) : reveal === i);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{TYPE_HINT[q.type]}</p>
      <RichText text={q.stem} className="text-lg" />
      {q.attribution&&<details className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Источник и лицензия{q.variant?" · числовая вариация":""}</summary>
        <p className="mt-2"><a href={q.attribution.url} target="_blank" rel="noreferrer" className="text-primary underline">{q.attribution.title}</a> · {q.attribution.authors}</p>
        <p className="mt-1">{q.attribution.locator} · Материал: {q.attribution.sourceLicense}</p>
        <p className="mt-1">{q.attribution.changes}</p>
        <a href={q.attribution.licenseUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-primary underline">Задание и перевод: {q.attribution.license}</a>
      </details>}

      {q.type === "match" ? (
        <div className="flex flex-col gap-3">
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {q.options.map((o, i) => (
              <li key={i} className="flex gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                <b className="font-display">{L(i)}</b>
                <RichText text={o} className="min-w-0" />
              </li>
            ))}
          </ol>
          {(q.left ?? []).map((l, li) => {
            const cur = Array.isArray(value) ? value[li] : undefined;
            const want = Array.isArray(reveal) ? reveal[li] : undefined;
            return (
              <div key={li} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary font-display text-xs font-bold text-secondary-foreground">{li + 1}</span>
                <RichText text={l} className="min-w-0 flex-1 text-sm" />
                <div className="flex gap-1.5">
                  {q.options.map((_, oi) => {
                    const on = cur === oi;
                    const ok = want === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={disabled}
                        aria-label={`Пункт ${li + 1} — вариант ${L(oi)}`}
                        onClick={() => {
                          const next = Array.isArray(value) ? [...value] : Array<number>(q.left!.length).fill(-1);
                          next[li] = oi;
                          onChange(next);
                        }}
                        className={cn(
                          "grid size-9 place-items-center rounded-lg border-2 font-display text-sm font-bold transition-colors",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground/40",
                          want !== undefined && ok && "border-success bg-success text-white",
                          want !== undefined && on && !ok && "border-primary bg-primary/15 text-primary line-through",
                        )}
                      >
                        {L(oi)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {q.options.map((o, i) => {
            const on = picked(i);
            const ok = right(i);
            const shown = reveal !== undefined && reveal !== null;
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (q.type === "multi") {
                    const cur = Array.isArray(value) ? value : [];
                    onChange(cur.includes(i) ? cur.filter((x) => x !== i) : cur.length<3?[...cur, i].sort((a, b) => a - b):cur);
                  } else onChange(i);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                  on ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30",
                  shown && ok && "border-success bg-success/10",
                  shown && on && !ok && "border-primary bg-primary/10",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center border-2 font-display text-sm font-bold",
                    q.type === "multi" ? "rounded-lg" : "rounded-full",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    shown && ok && "border-success bg-success text-white",
                  )}
                >
                  {shown && ok ? <Check className="size-4" /> : shown && on ? <X className="size-4" /> : L(i)}
                </span>
                <RichText text={o} className="min-w-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const answered = (v: EntAnswer | undefined) => v !== undefined && v !== null && (!Array.isArray(v) || (v.length > 0 && v.every((x) => x >= 0)));

/** The text of a context question: shown beside the question on wide screens. */
export function Passage({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-[15px] leading-7 lg:max-h-[70dvh] lg:overflow-y-auto">
      <p className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.12em] text-primary">Текст к заданиям</p>
      <RichText text={text} />
    </div>
  );
}
