import { fmtExamDate as fmtDate } from "@/lib/examFormat";
import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, GraduationCap, RotateCcw, Timer, Zap } from "lucide-react";
import { OfficialResources } from "./Learn";
import type { SatDomain } from "@shared/types";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/lib/auth";
import { ART, daysUntil, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, GreetingBanner, Loading, Stat } from "@/components/Page";
import { Card, CardTitle, Progress } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { CircleProgress } from "@/components/ui/circle-progress";

interface Stats {
  attempts: number;
  accuracy: number | null;
  estimate: number | null;
  fromTest: boolean;
  goal: { target: number; date: string } | null;
  avgSeconds: number | null;
  domains: { section: "rw" | "math"; domain: SatDomain; label: string; right: number; total: number; pct: number | null }[];
  byDay: { date: string; total: number; right: number }[];
  tests: { id: string; finished_at: number; rw_score: number; math_score: number }[];
  reviewCount: number;
  savedCount: number;
}

export default function SatHome() {
  const { user } = useAuth();
  const { data, error, loading } = useApi<Stats>("/sat/stats");
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const days = daysUntil(data.goal?.date);
  const gap = data.goal && data.estimate ? data.goal.target - data.estimate : null;

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner eyebrow="Digital SAT"
        title="Digital SAT"
        subtitle={days !== null ? `Until the exam: ${days} ${plural(days, "days", "days", "days")}${gap !== null && gap > 0 ? ` · target exceeded by ${gap} points` : ""}` : "Set your exam date in your profile to start the countdown."}
        image={ART.starry}
        position="center 60%"
        action={
          <Link to="/sat/test" className={buttonVariants({ variant: "accent" })}>
            <Timer /> Practice test
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-5">
          <CircleProgress value={data.estimate ?? 0} max={1600} size={132} stroke={11}>
            <div>
              <p className="font-display text-3xl font-semibold tabular">{data.estimate ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">out of 1600</p>
            </div>
          </CircleProgress>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold">{data.fromTest ? "Last test" : "Practice estimate"}</p>
            <p className="text-sm text-muted-foreground">{data.goal ? `Target: ${data.goal.target}` : "Target not specified"}</p>
            {!data.fromTest && <p className="mt-2 text-xs text-muted-foreground">Take a practice test to estimate your score</p>}
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={"Questions answered"} value={data.attempts} />
          <Stat label={"Accuracy"} value={data.accuracy === null ? "—" : `${Math.round(data.accuracy * 100)}%`} />
          <Stat label={"Average time"} value={data.avgSeconds ? `${data.avgSeconds} s` : "—"} hint={"SAT pace: about 71 s (R&W) and 95 s (Math)"} />
          <Stat label={"Practice tests"} value={data.tests.length} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Action to="/sat/learn" icon={<GraduationCap />} title={"Skill practice"} text={"Separate Math and Reading & Writing skill practice"} />
        <Action to="/sat/bank?status=wrong" icon={<RotateCcw />} title={"Mistake review"} text={`${data.reviewCount} ${plural(data.reviewCount, "question", "questions", "questions")} ready for another attempt.`} />
        <Action to="/sat/bank?status=saved" icon={<Bookmark />} title={"Saved"} text={`${data.savedCount} in your collection.`} />
        <Action to="/sat/blitz" icon={<Zap />} title="Blitz" text={"Three lives, streaks and multipliers"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(["rw", "math"] as const).map((section) => (
          <Card key={section} className="flex flex-col gap-4">
            <CardTitle>{section === "rw" ? "Reading & Writing" : "Math"}</CardTitle>
            {data.domains
              .filter((d) => d.section === section)
              .map((d) => (
                <Link key={d.domain} to={`/sat/bank?domain=${encodeURIComponent(d.domain)}`} className="block">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{d.label}</span>
                    <span className={cn("font-display font-semibold tabular", d.pct !== null && d.pct < 60 && "text-destructive")}>{d.pct === null ? "No data" : `${d.pct}%`}</span>
                  </div>
                  <Progress value={d.pct ?? 0} tone={d.pct !== null && d.pct < 60 ? "brand" : "ok"} className="mt-1.5" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.right} from {d.total}
                  </p>
                </Link>
              ))}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle>Practice over the last 30 days</CardTitle>
          <DayBars days={data.byDay} />
        </Card>
        <Card className="flex flex-col gap-3">
          <CardTitle>Practice tests</CardTitle>
          {data.tests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tests yet. Your first practice test will establish a starting point.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.tests.map((t) => (
                <li key={t.id}>
                  <Link to={`/sat/test/run/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-muted-foreground">{fmtDate(t.finished_at)}</span>
                    <span className="tabular text-muted-foreground">
                      R&W {t.rw_score} · Math {t.math_score}
                    </span>
                    <span className="font-display text-lg font-semibold tabular">{t.rw_score + t.math_score}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <OfficialResources />
      {!user?.goals.sat && (
        <p className="text-sm text-muted-foreground">
          Tip: set your SAT target in{" "}
          <Link className="font-semibold text-primary" to="/profile">
            Profile
          </Link>
          to see your remaining score gap.
        </p>
      )}
    </div>
  );
}

function Action({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-2xl border border-border p-4 hover:border-primary [&_svg]:size-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
      <ArrowRight className="!size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function DayBars({ days }: { days: { date: string; total: number; right: number }[] }) {
  const map = new Map(days.map((d) => [d.date, d]));
  const list = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() + 5 * 3600_000 - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return map.get(d) ?? { date: d, total: 0, right: 0 };
  });
  const max = Math.max(5, ...list.map((d) => d.total));
  return (
    <div className="mt-4">
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={"Daily questions over the last 30 days"}>
        {list.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${d.total} questions, correct ${d.right}`}>
            <div className="w-full rounded-t-[3px] bg-muted" style={{ height: `${((d.total - d.right) / max) * 100}%` }} />
            <div className="w-full rounded-b-[3px] bg-primary" style={{ height: `${(d.right / max) * 100}%`, borderTopLeftRadius: d.total === d.right ? 3 : 0, borderTopRightRadius: d.total === d.right ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>30 days ago</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <i className="inline-block size-2 rounded-sm bg-primary" /> Correct
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block size-2 rounded-sm bg-muted" /> error
          </span>
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
