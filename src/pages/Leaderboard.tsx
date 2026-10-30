import { useState } from "react";
import { Crown, Flame, Medal } from "lucide-react";
import type { LeaderRow } from "@shared/types";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/lib/auth";
import { ART } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, GreetingBanner, Loading } from "@/components/Page";
import { Segmented } from "@/components/ui/card";

export default function Leaderboard() {
  const { user } = useAuth();
  const [scope, setScope] = useState<"class" | "school">(user?.role === "teacher" ? "school" : "class");
  const { data, error, loading } = useApi<LeaderRow[]>(`/me/leaderboard?scope=${scope}`);
  const month = new Date().toLocaleDateString("ru-RU", { month: "long" });
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const rows = data ?? [];
  const top = rows.slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner title={`Рейтинг · ${month}`} subtitle={`Очки за практику во всех модулях. Рейтинг обнуляется ${nextMonth}, у каждого новый шанс.`} image={ART.wave} position="center 40%" />
      {user?.role === "student" && (
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: "class", label: "Мой класс" },
            { value: "school", label: "Вся школа" },
          ]}
        />
      )}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <>
          <div className="grid grid-cols-3 items-end gap-3 sm:gap-5">
            {[1, 0, 2].map((idx) => {
              const r = top[idx];
              if (!r) return <div key={idx} />;
              const heights = ["h-40", "h-32", "h-28"];
              return (
                <div key={idx} className="flex flex-col items-center gap-2 text-center">
                  {idx === 0 ? <Crown className="size-6 text-accent" /> : <Medal className={cn("size-5", idx === 1 ? "text-muted-foreground" : "text-[#b07040]")} />}
                  <p className={cn("max-w-full truncate font-display font-semibold", r.isMe && "text-primary")}>{r.isMe ? "Ты" : r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.monthXp} XP</p>
                  <div className={cn("w-full rounded-t-2xl", heights[idx], idx === 0 ? "bg-primary" : "bg-secondary")}>
                    <p className="pt-3 font-display text-3xl font-bold text-white">{idx + 1}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <ol className="overflow-hidden rounded-2xl border border-border">
            {rows.map((r, i) => (
              <li key={r.name + i} className={cn("flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0", r.isMe && "bg-primary/10")}>
                <span className="w-6 font-display font-semibold tabular text-muted-foreground">{i + 1}</span>
                <span className={cn("min-w-0 flex-1 truncate font-medium", r.isMe && "text-primary")}>
                  {r.isMe ? `${r.name} (ты)` : r.name}
                  {r.meta && <span className="ml-2 text-xs text-muted-foreground">{r.meta}</span>}
                </span>
                {r.streak > 0 && (
                  <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                    <Flame className="size-3.5 text-primary" /> {r.streak}
                  </span>
                )}
                <span className="font-display font-semibold tabular">{r.monthXp} XP</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
