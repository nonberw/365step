import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { BookOpenCheck, CheckCircle2, Flag, RefreshCw, RotateCcw, Sparkles, Timer } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { ErrorBox } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ENT_IMAGE } from "./visuals";
import type { EntMeta } from "./EntHome";

interface Task {
  kind: "practice" | "mini" | "full" | "review";
  subject: string;
  topic: string;
  count: number;
  title: string;
}

interface PlanResponse {
  plan: { summary: string; weeks: { week: number; focus: string; tasks: Task[] }[]; milestones: { month: string; target: number; note: string }[]; mode: string };
  createdAt: number;
  progress: { week: number; from: number; tasks: { done: number; of: number }[] };
}

const ICON = { practice: BookOpenCheck, mini: Flag, full: Timer, review: RotateCcw };
const fmt = (t: number) => new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

export function EntPlan({ meta, onStart, busy }: { meta: EntMeta; onStart: (kind: "full" | "subject", subject?: string) => void; busy: string | null }) {
  const { data, error, loading, setData } = useApi<PlanResponse>("/ent/plan");
  const [rebuilding, setRebuilding] = useState(false);
  const name = (id: string) => meta.subjects.find((s) => s.id === id)?.name ?? "";

  async function rebuild() {
    setRebuilding(true);
    try {
      setData(await api<PlanResponse>("/ent/plan?rebuild=1"));
    } finally {
      setRebuilding(false);
    }
  }

  if (loading || rebuilding)
    return (
      <Card className="flex flex-col gap-3">
        <p className="flex items-center gap-2 font-display font-semibold">
          <Sparkles className="size-4 animate-pulse text-primary" /> ИИ строит твой план до ЕНТ…
        </p>
        {[90, 75, 82, 60].map((w, i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" style={{ width: `${w}%` }} />
        ))}
      </Card>
    );
  if (!data) return <ErrorBox message={error} />;

  const { plan, progress } = data;
  const week = plan.weeks[progress.week];
  const done = progress.tasks.filter((t) => t.done >= t.of).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-primary">Адаптивный план · пересчитывается после каждого пробника</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Мой план до ЕНТ</h2>
        </div>
        <Button variant="outline" size="sm" onClick={rebuild}>
          <RefreshCw /> Пересчитать
        </Button>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{plan.summary}</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span>
              <span className="block font-display text-lg font-semibold">
                Неделя {progress.week + 1} · {week?.focus}
              </span>
              <span className="text-xs text-muted-foreground">
                {fmt(progress.from)} — {fmt(progress.from + 6 * 86_400_000)} · выполнено {done} из {progress.tasks.length}
              </span>
            </span>
            <span className="relative grid size-12 place-items-center">
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--muted)" strokeWidth="4" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={94.2}
                  initial={{ strokeDashoffset: 94.2 }}
                  animate={{ strokeDashoffset: 94.2 * (1 - done / Math.max(1, progress.tasks.length)) }}
                  transition={{ duration: 0.8 }}
                />
              </svg>
              <span className="font-display text-xs font-bold">
                {done}/{progress.tasks.length}
              </span>
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {(week?.tasks ?? []).map((t, i) => {
              const p = progress.tasks[i] ?? { done: 0, of: 1 };
              const finished = p.done >= p.of;
              const Icon = ICON[t.kind];
              const action =
                t.kind === "practice" ? (
                  <Link
                    to={`/ent/practice/${t.subject}?type=single${t.topic ? `&topic=${encodeURIComponent(t.topic)}` : ""}`}
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    Решать
                  </Link>
                ) : t.kind === "review" ? (
                  <Link to="/review" className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                    Повтор
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => (t.kind === "full" ? onStart("full") : onStart("subject", t.subject))}
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy && (busy === "full" || busy === t.subject) ? "Собираю…" : "Начать"}
                  </button>
                );
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn("flex items-center gap-3 rounded-2xl border p-3", finished ? "border-success/40 bg-success/5" : "border-border")}
                >
                  {t.subject ? (
                    <img src={ENT_IMAGE[t.subject]} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                      <Icon className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-medium", finished && "line-through opacity-60")}>{t.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {[name(t.subject), t.topic].filter(Boolean).join(" · ") || (t.kind === "full" ? "120 заданий, 240 минут" : "")}
                      {t.kind === "practice" && ` · ${p.done}/${p.of}`}
                    </span>
                  </span>
                  {finished ? <CheckCircle2 className="size-5 text-success" /> : action}
                </motion.li>
              );
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Дальше</p>
            {plan.weeks
              .filter((w) => w.week - 1 > progress.week)
              .map((w) => (
                <div key={w.week} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-display font-bold text-primary">Н{w.week}</span>
                  <span className="min-w-0 flex-1 truncate">{w.focus}</span>
                  <span className="text-xs text-muted-foreground">{w.tasks.length} задач</span>
                </div>
              ))}
          </Card>
          {plan.milestones.length > 0 && (
            <Card className="flex flex-col gap-3 bg-secondary text-secondary-foreground">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Контрольные точки</p>
              <div className="flex items-end gap-1.5">
                {plan.milestones.map((m, i) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={m.note}>
                    <span className="font-display text-xs font-bold">{m.target}</span>
                    <motion.span
                      initial={{ height: 0 }}
                      animate={{ height: `${(m.target / 140) * 90}px` }}
                      transition={{ delay: i * 0.08, duration: 0.5 }}
                      className="w-full rounded-t-md bg-gradient-to-t from-primary to-[#9be300]"
                    />
                    <span className="text-[10px] text-white/60">{m.month.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
