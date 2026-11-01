import { Link } from "react-router-dom";
import { AlarmClock } from "lucide-react";
import type { Reminder } from "@shared/admissions";
import { longDate } from "@shared/examDates";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

// Admissions deadlines in the next 30 days: applications, recommendations and SAT registration.
// The same list goes to Telegram 30, 14, 7 and 1 days before (cron /api/cron/deadlines).

const when = (d: number) => (d < 0 ? `просрочено на ${-d} дн.` : d === 0 ? "сегодня" : d === 1 ? "завтра" : `через ${d} дн.`);

export function useDeadlines() {
  return useApi<Reminder[]>("/admissions/reminders").data ?? [];
}

/** Strip on top of the admissions workspace. */
export function DeadlineStrip() {
  const list = useDeadlines();
  if (!list.length) return null;
  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-[#ff9600]/40 bg-[#fff4e0] p-4 text-[#7a4300]">
      <p className="flex items-center gap-2 font-display font-bold">
        <AlarmClock className="size-5" /> Ближайшие дедлайны
      </p>
      <ul className="flex flex-wrap gap-2">
        {list.slice(0, 6).map((r) => (
          <li key={r.id}>
            <Link to={r.href} className={cn("flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs font-semibold hover:bg-white", r.days <= 7 ? "border-destructive/50 text-destructive" : "border-[#ff9600]/40")} title={longDate(r.date)}>
              {r.title} · {when(r.days)}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-[11px]">
        <Link to="/family" className="underline">Подключи Telegram-ассистента</Link> — напомню за 30, 14, 7 и 1 день.
      </p>
    </div>
  );
}

/** Compact chip for the ecosystem bar on every page. */
export function DeadlineChip() {
  const list = useDeadlines();
  const next = list[0];
  if (!next) return null;
  return (
    <Link to={next.href} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", next.days <= 7 ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-[#ff9600]/50 bg-[#fff4e0] text-[#7a4300]")} title={list.map((r) => `${r.title}: ${longDate(r.date)}`).join("\n")}>
      <AlarmClock className="size-3.5" />
      {next.title} · {when(next.days)}
      {list.length > 1 && <span className="opacity-70">+{list.length - 1}</span>}
    </Link>
  );
}
