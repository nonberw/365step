import { fmtExamDate as fmtDate } from "@/lib/examFormat";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Play, Timer } from "lucide-react";
import type { SatTestState } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { ART } from "@/lib/format";
import { ErrorBox, GreetingBanner } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Segmented } from "@/components/ui/card";

export const EXAM_KEY = "bsts-sat-exam-mode";

export default function TestHome() {
  const navigate = useNavigate();
  const tests = useApi<{ id: string; started_at: number; finished_at: number | null; rw_score: number | null; math_score: number | null }[]>("/sat/tests");
  const [exam, setExam] = useState(true);
  const [mode, setMode] = useState<"short" | "full">("short");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const r = await api<{ test: SatTestState }>("/sat/test/start", { body: { mode } });
      try {
        sessionStorage.setItem(EXAM_KEY, exam ? "1" : "0");
      } catch {
        // exam mode falls back to on
      }
      navigate(`/sat/test/run/${r.test.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const unfinished = tests.data?.find((t) => !t.finished_at);

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner title={"Digital SAT practice test"} subtitle={"Two sections, each with two modules. Adaptive practice using original questions; scores are not statistically calibrated."} image={ART.astronomer} position="center 30%" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="flex flex-col gap-4">
          <CardTitle>How the test works</CardTitle>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "short", label: "Short · 46 questions · about 62 min" },
              { value: "full", label: "· 98 questions · 2 h 14 min" },
            ]}
          />
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(mode === "full"
              ? [
                  ["Reading & Writing · module 1", "27 questions · 32 minutes"],
                  ["Reading & Writing · module 2", "27 questions, harder or easier"],
                  ["Math · module 1", "22 questions · 35 minutes · Desmos"],
                  ["Math · module 2", "22 questions · harder or easier"],
                ]
              : [
                  ["Reading & Writing · module 1", "12 questions · 14 minutes"],
                  ["Reading & Writing · module 2", "12 questions, harder or easier"],
                  ["Math · module 1", "11 questions · 17 minutes, Desmos"],
                  ["Math · module 2", "11 questions, harder or easier"],
                ]
            ).map(([t, d], i) => (
              <li key={t} className="rounded-xl bg-muted/60 p-3">
                <p className="font-display text-sm font-semibold">
                  {i + 1}. {t}
                </p>
                <p className="text-xs text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">The short test keeps the real test's pace; the full test matches its length. Scores are approximate practice estimates, not official College Board results.</p>
          <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <input id="exam-mode" type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={exam} onChange={(e) => setExam(e.target.checked)} />
            <span>
              <span className="flex items-center gap-1.5 font-semibold">
                <Lock className="size-3.5" /> Examination mode
              </span>
              <span className="text-muted-foreground">Use full screen. Leaving the test is recorded and visible to your teacher.</span>
            </span>
          </label>
          <ErrorBox message={error} />
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={start} disabled={busy}>
              <Timer /> {busy ? "Preparing test…" : "Start new test"}
            </Button>
            {unfinished && (
              <Link to={`/sat/test/run/${unfinished.id}`} className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-6 font-display font-semibold hover:bg-muted">
                <Play className="size-4" /> Resume test
              </Link>
            )}
          </div>
        </Card>
        <Card className="flex flex-col gap-3">
          <CardTitle>History</CardTitle>
          {!tests.data?.length ? (
            <p className="text-sm text-muted-foreground">No results yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {tests.data.map((t) => (
                <li key={t.id}>
                  <Link to={`/sat/test/run/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-muted-foreground">{fmtDate(t.started_at)}</span>
                    {t.finished_at ? (
                      <span className="font-display text-lg font-semibold tabular">{(t.rw_score ?? 0) + (t.math_score ?? 0)}</span>
                    ) : (
                      <span className="text-xs font-semibold text-warning">not completed</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
