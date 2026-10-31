import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Code2, Flame, Mic, Timer, Trophy, Zap } from "lucide-react";
import type { LeaderRow, StudentDashboard } from "@shared/types";
import { useApi } from "@/hooks/useApi";
import { ART, daysUntil, fmtDate, greeting, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, GreetingBanner, Loading } from "@/components/Page";
import { PlantCard } from "@/components/Plant";
import { Badge, Card, CardTitle, Progress } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import NumberTicker, { type NumberTickerRef } from "@/components/ui/basic-number-ticker";

export default function StudentHome() {
  const { data, error, loading } = useApi<StudentDashboard>("/me/dashboard");
  const leaders = useApi<LeaderRow[]>("/me/leaderboard?scope=class");
  const [params] = useSearchParams();
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;

  const { user } = data;
  const satDays = daysUntil(user.goals.sat?.date);
  const ieltsDays = daysUntil(user.goals.ielts?.date);
  const subtitle = [
    satDays !== null ? `До SAT ${satDays} ${plural(satDays, "день", "дня", "дней")}` : null,
    ieltsDays !== null ? `до IELTS ${ieltsDays} ${plural(ieltsDays, "день", "дня", "дней")}` : null,
    data.streak ? `серия ${data.streak} ${plural(data.streak, "день", "дня", "дней")}` : "начни серию сегодня",
  ]
    .filter(Boolean)
    .join(" · ");
  const doneToday = data.today.filter((t) => t.done).length;

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner
        title={`${greeting()}, ${user.firstName}`}
        subtitle={params.get("welcome") ? "Аккаунт готов. Мы собрали первый план по твоим ответам — начни с него." : subtitle}
        image={ART.athens}
        position="center 35%"
        action={
          <Link to={data.today.find((t) => !t.done)?.href ?? "/sat/bank"} className={buttonVariants({ variant: "accent" })}>
            Продолжить <ArrowRight />
          </Link>
        }
      />

      <Card className="flex flex-col items-center gap-3 sm:flex-row">
        {user.plant ? (
          <PlantCard species={user.plant} xp={user.xp} className="w-full" />
        ) : (
          <Link to="/profile#plant" className="font-display text-lg font-extrabold text-primary">
            Выбери растение-спутника: оно будет расти вместе с тобой →
          </Link>
        )}
      </Card>

      {data.activeLesson && (
        <Link to={`/coding/lessons/${data.activeLesson.lessonId}`} className="flex items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Урок идёт сейчас{data.activeLesson.locked ? " · закрытый режим" : ""}</p>
            <p className="font-display text-lg font-semibold">{data.activeLesson.title}</p>
          </div>
          <ArrowRight />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TickerStat label="Оценка SAT" value={data.satEstimate} suffix={user.goals.sat ? ` / ${user.goals.sat.target}` : ""} empty="Пройди тест" />
        <TickerStat label="IELTS, ориентир" value={data.ieltsEstimate} decimals empty="Сдай эссе" suffix={user.goals.ielts ? ` / ${user.goals.ielts.target}` : ""} />
        <TickerStat label="XP за месяц" value={data.monthXp} icon={<Zap className="size-4 text-accent" />} />
        <TickerStat label="Серия" value={data.streak} suffix={` ${plural(data.streak, "день", "дня", "дней")}`} icon={<Flame className="size-4 text-primary" />} hint={`Лучшая: ${data.bestStreak}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>План на сегодня</CardTitle>
              <p className="text-sm text-muted-foreground">
                {doneToday}/{data.today.length} выполнено
              </p>
            </div>
            <Link to="/sat/plan" className={buttonVariants({ variant: "outline", size: "sm" })}>
              ИИ-план
            </Link>
          </div>
          <Progress value={(doneToday / Math.max(1, data.today.length)) * 100} />
          <ul className="flex flex-col divide-y divide-border">
            {data.today.map((t) => (
              <li key={t.id}>
                <Link to={t.href} className="group flex items-center gap-3 py-3">
                  {t.done ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <Circle className="size-5 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block font-medium", t.done && "text-muted-foreground line-through")}>{t.title}</span>
                    <span className="block text-xs text-muted-foreground">{t.detail}</span>
                  </span>
                  {t.kind === "assignment" && <Badge tone="brand">Учитель</Badge>}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Поработай над этим</CardTitle>
          {data.weak.length === 0 ? (
            <p className="text-sm text-muted-foreground">Реши 10–15 вопросов в банке SAT, и здесь появятся темы, которые стоит подтянуть.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {data.weak.map((w) => (
                <li key={w.label}>
                  <Link to={w.href} className="block">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{w.label}</span>
                      <span className={cn("font-display font-semibold tabular", w.pct < 60 ? "text-destructive" : "text-foreground")}>{w.pct}%</span>
                    </div>
                    <Progress value={w.pct} tone={w.pct < 60 ? "brand" : "accent"} className="mt-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {w.attempts} {plural(w.attempts, "попытка", "попытки", "попыток")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto grid grid-cols-2 gap-2">
            <Quick to="/sat/blitz" icon={<Zap />} label="Blitz" />
            <Quick to="/sat/test" icon={<Timer />} label="Пробный тест" />
            <Quick to="/ielts/speaking" icon={<Mic />} label="Speaking" />
            <Quick to="/coding" icon={<Code2 />} label="Задача дня" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Активность за год</CardTitle>
            <Badge>{data.questionsDone} вопросов SAT</Badge>
          </div>
          <ActivityHeatmap data={data.heatmap} unit="XP" cellSize={11} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle>Задания учителя</CardTitle>
              {user.classCodes.length === 0 && (
                <Link to="/profile" className="text-sm font-semibold text-primary hover:underline">
                  Ввести код класса
                </Link>
              )}
            </div>
            {data.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{user.classCodes.length ? "Пока заданий нет." : "Присоединись к классу, чтобы получать задания."}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.assignments.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
                    {a.done ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                    {a.dueAt && <span className="shrink-0 text-xs text-muted-foreground">до {fmtDate(a.dueAt)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle>Рейтинг класса</CardTitle>
              <Link to="/leaderboard" className="text-sm font-semibold text-primary hover:underline">
                Весь рейтинг
              </Link>
            </div>
            <ol className="flex flex-col gap-1">
              {(leaders.data ?? []).slice(0, 5).map((r, i) => (
                <li key={r.name + i} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", r.isMe && "bg-primary/10 font-semibold text-primary")}>
                  <span className="w-5 font-display font-semibold tabular">{i + 1}</span>
                  {i === 0 && <Trophy className="size-4 text-accent" />}
                  <span className="min-w-0 flex-1 truncate">{r.isMe ? "Ты" : r.name}</span>
                  <span className="tabular text-muted-foreground">{r.monthXp} XP</span>
                </li>
              ))}
            </ol>
          </Card>
          <Link to="/sat/vocab" className="flex items-center gap-3 rounded-2xl border border-border p-4 hover:border-primary">
            <BookOpen className="size-5 text-primary" />
            <span className="flex-1 text-sm font-medium">Словарь SAT: учи слова в контексте, а не списком</span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function TickerStat({ label, value, suffix = "", empty = "—", decimals, icon, hint }: { label: string; value: number | null; suffix?: string; empty?: string; decimals?: boolean; icon?: React.ReactNode; hint?: string }) {
  const ref = useRef<NumberTickerRef>(null);
  useEffect(() => ref.current?.startAnimation(), [value]);
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="mt-1 break-words font-display text-[22px] font-semibold leading-tight tabular sm:text-[28px]">
        {value === null ? (
          <span className="text-base font-medium text-muted-foreground">{empty}</span>
        ) : decimals ? (
          <>
            {value.toFixed(1)}
            <span className="text-base font-medium text-muted-foreground">{suffix}</span>
          </>
        ) : (
          <>
            <NumberTicker ref={ref} from={0} target={value} transition={{ duration: 1.2, type: "tween", ease: "easeOut" }} />
            <span className="text-base font-medium text-muted-foreground">{suffix}</span>
          </>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Quick({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:border-primary [&_svg]:size-4 [&_svg]:text-primary">
      {icon}
      {label}
    </Link>
  );
}
