import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Play, Timer } from "lucide-react";
import type { SatTestState } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { ART, fmtDate } from "@/lib/format";
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
      <GreetingBanner title="Пробный тест Digital SAT" subtitle="Два раздела по два модуля. Второй модуль подстраивается под результат первого — как на настоящем экзамене." image={ART.astronomer} position="center 30%" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="flex flex-col gap-4">
          <CardTitle>Как устроен тест</CardTitle>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "short", label: "Короткий · 46 вопросов, ~62 мин" },
              { value: "full", label: "Полный · 98 вопросов, 2 ч 14 мин" },
            ]}
          />
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(mode === "full"
              ? [
                  ["Reading & Writing · модуль 1", "27 вопросов · 32 минуты"],
                  ["Reading & Writing · модуль 2", "27 вопросов, сложнее или проще"],
                  ["Math · модуль 1", "22 вопроса · 35 минут, Desmos"],
                  ["Math · модуль 2", "22 вопроса, сложнее или проще"],
                ]
              : [
                  ["Reading & Writing · модуль 1", "12 вопросов · 14 минут"],
                  ["Reading & Writing · модуль 2", "12 вопросов, сложнее или проще"],
                  ["Math · модуль 1", "11 вопросов · 17 минут, Desmos"],
                  ["Math · модуль 2", "11 вопросов, сложнее или проще"],
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
          <p className="text-sm text-muted-foreground">Короткий тест сохраняет темп настоящего, полный повторяет его по длине. Баллы — ориентировочная оценка, а не официальный результат College Board.</p>
          <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <input id="exam-mode" type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={exam} onChange={(e) => setExam(e.target.checked)} />
            <span>
              <span className="flex items-center gap-1.5 font-semibold">
                <Lock className="size-3.5" /> Режим экзамена
              </span>
              <span className="text-muted-foreground">Полный экран, выход из теста фиксируется и виден учителю, как в Bluebook.</span>
            </span>
          </label>
          <ErrorBox message={error} />
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={start} disabled={busy}>
              <Timer /> {busy ? "Готовлю тест…" : "Начать новый тест"}
            </Button>
            {unfinished && (
              <Link to={`/sat/test/run/${unfinished.id}`} className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-6 font-display font-semibold hover:bg-muted">
                <Play className="size-4" /> Продолжить начатый
              </Link>
            )}
          </div>
        </Card>
        <Card className="flex flex-col gap-3">
          <CardTitle>История</CardTitle>
          {!tests.data?.length ? (
            <p className="text-sm text-muted-foreground">Пока пусто.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {tests.data.map((t) => (
                <li key={t.id}>
                  <Link to={`/sat/test/run/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-muted-foreground">{fmtDate(t.started_at)}</span>
                    {t.finished_at ? (
                      <span className="font-display text-lg font-semibold tabular">{(t.rw_score ?? 0) + (t.math_score ?? 0)}</span>
                    ) : (
                      <span className="text-xs font-semibold text-warning">не завершён</span>
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
