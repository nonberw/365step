import { fmtExamDate as fmtDate } from "@/lib/examFormat";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/lib/auth";
import { ART } from "@/lib/format";
import { ErrorBox, GreetingBanner, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle } from "@/components/ui/card";

interface Plan {
  summary: string;
  weeks: { title: string; focus: string; days: { day: string; tasks: string[] }[] }[];
  mode: "ai" | "demo";
  createdAt: number;
}

export default function SatPlan() {
  const { user } = useAuth();
  const { data, setData, error, loading } = useApi<Plan | null>("/sat/plan");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      setData(await api<Plan>("/sat/plan", { body: {} }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner
        title={"AI study plan"}
        subtitle={`Based on your goals,${user?.goals.sat ? ` (SAT ${user.goals.sat.target})` : ""}${user?.goals.ielts ? ` (IELTS ${user.goals.ielts.target})` : ""} exam date and weaker topics from your practice results.`}
        image={ART.monet}
        action={
          <Button variant="accent" onClick={generate} disabled={busy}>
            <Sparkles /> {busy ? "Creating…" : data ? "Update plan" : "Create plan"}
          </Button>
        }
      />
      <ErrorBox message={err || error} />
      {loading ? (
        <Loading />
      ) : !data ? (
        <Card>
          <p className="text-sm text-muted-foreground">No plan yet. Answer at least 15 questions so the plan can reflect your weaker topics, then select Create plan.</p>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CardTitle>Strategy</CardTitle>
              <Badge tone={data.mode === "ai" ? "dark" : "warn"}>{data.mode === "ai" ? "AI-generated" : "Demo plan"}</Badge>
              <span className="text-xs text-muted-foreground">from {fmtDate(data.createdAt)}</span>
            </div>
            <p className="text-sm">{data.summary}</p>
          </Card>
          {data.weeks.map((w) => (
            <section key={w.title} className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-semibold">
                {w.title} <span className="text-base font-normal text-muted-foreground">· {w.focus}</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {w.days.map((d) => (
                  <Card key={d.day} className="p-4">
                    <p className="font-display font-semibold text-primary">{d.day}</p>
                    <ul className="mt-2 flex flex-col gap-2 text-sm">
                      {d.tasks.map((t) => (
                        <li key={t} className="rounded-lg bg-muted/60 px-2.5 py-2">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
