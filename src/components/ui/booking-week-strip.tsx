import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Adapted from 21st.dev «Booking Slot Calendar» (bidyut10): a week strip of day pills.
// Days with open sessions get a dot; the strip slides when the week changes.

export function startOfDay(t: number | Date) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(d: Date) {
  const s = startOfDay(d);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // weeks start on Monday
  return s;
}

const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

export const dayKeyOf = (t: number | Date) => startOfDay(t).toDateString();

export function BookingWeekStrip({ selected, onSelect, counts, className }: { selected: Date; onSelect: (d: Date) => void; counts: Map<string, number>; className?: string }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(selected));
  const [dir, setDir] = useState(0);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const canPrev = addDays(weekStart, -1) >= today;
  const month = days[3].toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const shift = (n: number) => {
    setDir(n);
    setWeekStart((w) => addDays(w, n * 7));
  };

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_24px_rgba(0,0,0,0.04)]", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-sm font-semibold capitalize">{month}</p>
        <div className="flex">
          <button type="button" aria-label="Предыдущая неделя" disabled={!canPrev} onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Следующая неделя" onClick={() => shift(1)} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div key={weekStart.toISOString()} className={cn("grid grid-cols-7 transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] starting:opacity-0", dir >= 0 ? "starting:translate-x-2" : "starting:-translate-x-2")}>
        {days.map((d) => {
          const past = d < today;
          const active = dayKeyOf(d) === dayKeyOf(selected);
          const isToday = dayKeyOf(d) === dayKeyOf(today);
          const n = counts.get(dayKeyOf(d)) ?? 0;
          return (
            <button key={d.toISOString()} type="button" disabled={past} aria-pressed={active} onClick={() => onSelect(d)} className="group flex flex-col items-center gap-1 outline-none disabled:cursor-not-allowed">
              <span className={cn("text-[10px] font-semibold uppercase tracking-wide", past ? "text-muted-foreground/40" : "text-muted-foreground")}>{d.toLocaleDateString("ru-RU", { weekday: "short" })}</span>
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full text-sm font-semibold tabular-nums transition-colors duration-150 group-focus-visible:outline-2 group-focus-visible:outline-offset-1 group-focus-visible:outline-primary",
                  past && "text-muted-foreground/40",
                  !past && active && "bg-secondary text-secondary-foreground",
                  !past && !active && isToday && "bg-muted group-hover:bg-border",
                  !past && !active && !isToday && "group-hover:bg-muted",
                )}
              >
                {d.getDate()}
              </span>
              <span className={cn("h-1.5 w-1.5 rounded-full transition-opacity", n && !past ? "bg-primary" : "opacity-0")} aria-label={n ? `${n} занятий` : undefined} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
