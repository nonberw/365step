import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, Circle, CircleDot, Map as MapIcon, Search } from "lucide-react";
import type { ProblemPattern } from "@shared/types";
import { PATTERNS } from "@shared/patterns";
import { useApi } from "@/hooks/useApi";
import { ART } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, GreetingBanner, Loading } from "@/components/Page";
import { Segmented } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Row {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  pattern: ProblemPattern;
  tags: string[];
  status: "solved" | "tried" | "new";
  acceptance: number | null;
}

export const DIFF_COLOR = { Easy: "text-success", Medium: "text-warning", Hard: "text-destructive" };

export default function Problems() {
  const { data, error, loading } = useApi<Row[]>("/coding/problems");
  const [diff, setDiff] = useState<"all" | Row["difficulty"]>("all");
  const [status, setStatus] = useState<"all" | Row["status"]>("all");
  const [tag, setTag] = useState("");
  const [pattern, setPattern] = useState<ProblemPattern | "">("");
  const [q, setQ] = useState("");
  const rows = (data ?? []).filter(
    (r) =>
      (diff === "all" || r.difficulty === diff) && (status === "all" || r.status === status) && (!tag || r.tags.includes(tag)) && (!pattern || r.pattern === pattern) && r.title.toLowerCase().includes(q.toLowerCase()),
  );
  const solved = (data ?? []).filter((r) => r.status === "solved");
  // Problem of the day: the same for everyone today, picked among problems this student has not solved.
  const daily = useMemo(() => {
    const open = (data ?? []).filter((r) => r.status !== "solved");
    if (!open.length) return null;
    const day = Math.floor((Date.now() + 5 * 3600_000) / 86_400_000);
    return open[(day * 7919) % open.length];
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner
        title="Задачи по программированию"
        subtitle={`${(data ?? []).length} задач по 12 темам: тесты, JavaScript или Python прямо в браузере, ИИ-разбор решения и тренировка собеседования. Подсказки ИИ не выдают решение целиком.`}
        image={ART.wave}
        position="center 45%"
      >
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {(["Easy", "Medium", "Hard"] as const).map((d) => (
            <span key={d} className="rounded-full bg-white/10 px-3 py-1 backdrop-blur">
              {d}: {solved.filter((r) => r.difficulty === d).length}/{(data ?? []).filter((r) => r.difficulty === d).length}
            </span>
          ))}
        </div>
      </GreetingBanner>

      {data && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <MapIcon className="size-5 text-primary" /> Дорожная карта
            </h2>
            {daily && (
              <Link to={`/coding/problems/${daily.id}`} className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15">
                <CalendarDays className="size-4" /> Задача дня: {daily.title} <span className={cn("text-xs font-semibold", DIFF_COLOR[daily.difficulty])}>{daily.difficulty}</span>
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {PATTERNS.map((pt, i) => {
              const all = data.filter((r) => r.pattern === pt.id);
              const done = all.filter((r) => r.status === "solved").length;
              return (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setPattern(pattern === pt.id ? "" : pt.id)}
                  className={cn("flex flex-col gap-1.5 rounded-2xl border p-3 text-left transition", pattern === pt.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span>
                      <span className="mr-1.5 text-xs text-muted-foreground">{i + 1}</span>
                      {pt.title}
                    </span>
                    <span className="text-xs tabular text-muted-foreground">
                      {done}/{all.length}
                    </span>
                  </span>
                  <span className="line-clamp-1 text-[11px] text-muted-foreground">{pt.blurb}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-gradient-to-r from-[#8fb0ff] to-primary" style={{ width: `${all.length ? (done / all.length) * 100 : 0}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="problem-search" aria-label="Поиск задачи" className="h-10 pl-9" placeholder="Поиск задачи" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented
            value={diff}
            onChange={setDiff}
            options={[
              { value: "all", label: "Все" },
              { value: "Easy", label: "Easy" },
              { value: "Medium", label: "Medium" },
              { value: "Hard", label: "Hard" },
            ]}
          />
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Любой статус" },
              { value: "new", label: "Новые" },
              { value: "tried", label: "Пробовал" },
              { value: "solved", label: "Решены" },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-12 px-4 py-2.5 font-semibold">Статус</th>
                <th className="px-4 py-2.5 font-semibold">Задача</th>
                <th className="px-4 py-2.5 font-semibold">Темы</th>
                <th className="px-4 py-2.5 font-semibold">Решили</th>
                <th className="px-4 py-2.5 font-semibold">Сложность</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={cn("border-t border-border", i % 2 === 1 && "bg-muted/25")}>
                  <td className="px-4 py-3">
                    {r.status === "solved" ? (
                      <CheckCircle2 className="size-4 text-success" aria-label="Решена" />
                    ) : r.status === "tried" ? (
                      <CircleDot className="size-4 text-warning" aria-label="Пробовал" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" aria-label="Новая" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/coding/problems/${r.id}`} className="font-medium hover:text-primary">
                      {i + 1}. {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.tags.join(", ")}</td>
                  <td className="px-4 py-3 tabular text-muted-foreground">{r.acceptance === null ? "—" : `${r.acceptance}%`}</td>
                  <td className={cn("px-4 py-3 font-semibold", DIFF_COLOR[r.difficulty])}>{r.difficulty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
