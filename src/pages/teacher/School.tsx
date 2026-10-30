import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { AlertTriangle, Building2, Download, Sparkles } from "lucide-react";
import { api, download } from "@/api";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card, Segmented } from "@/components/ui/card";
import NumberTicker from "@/components/ui/basic-number-ticker";
import { Aurora } from "@/pages/ent/EntHome";

interface Report {
  days: number;
  totals: { classes: number; teachers: number; students: number; activePct: number; entMocks: number; exams: number; risk: number; consultations: number };
  classes: {
    code: string;
    name: string;
    teacher: string;
    students: number;
    activePct: number;
    entMocks: number;
    entAvgBest: number | null;
    pass50: number | null;
    satAvg: number | null;
    exams: number;
    examAvg: number | null;
    risk: number;
  }[];
  teachers: { id: string; name: string; classes: number; exams: number; consultations: number; written: number; materials: number }[];
  risk: { id: string; name: string; className: string; reasons: string[] }[];
}

export default function School() {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const { data, error, loading } = useApi<Report>(`/school/report?days=${days}`);
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#120d0d] text-white">
        <Aurora />
        <div className="relative flex flex-col gap-5 px-6 py-8 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/80">
              <Building2 className="size-3.5 text-[#ff8562]" /> Отчёт для завуча
            </span>
            <div className="[&_button]:text-white/80">
              <Segmented
                value={days}
                onChange={(v) => (setDays(v), setSummary(null))}
                options={[
                  { value: "7", label: "7 дней" },
                  { value: "30", label: "30 дней" },
                  { value: "90", label: "четверть" },
                ]}
              />
            </div>
          </div>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">Школа на одной странице</h1>
          {data && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "учеников", v: data.totals.students, sub: `${data.totals.classes} классов · ${data.totals.teachers} учителей` },
                { label: "активны за неделю", v: data.totals.activePct, suffix: "%", sub: "заходили и занимались" },
                { label: "пробников ЕНТ", v: data.totals.entMocks, sub: `контрольных: ${data.totals.exams}` },
                { label: "требуют внимания", v: data.totals.risk, sub: `консультаций: ${data.totals.consultations}`, hot: data.totals.risk > 0 },
              ].map((k) => (
                <div key={k.label} className={cn("rounded-2xl border p-4", k.hot ? "border-[#ff8562]/50 bg-[#ff8562]/10" : "border-white/10 bg-white/[0.05]")}>
                  <span className="block font-display text-4xl font-bold tabular">
                    <NumberTicker from={0} target={k.v} transition={{ duration: 1.2, ease: "easeOut" }} />
                    {k.suffix}
                  </span>
                  <span className="text-sm text-white/80">{k.label}</span>
                  <span className="block text-xs text-white/50">{k.sub}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {loading ? (
        <Loading label="Собираю данные по всем классам…" />
      ) : error ? (
        <ErrorBox message={error} />
      ) : data ? (
        <>
          <Card className="flex flex-col gap-3 border-primary/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                <Sparkles className="size-3.5" /> Выводы ИИ
              </p>
              <div className="flex gap-2">
                {!summary && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        setSummary((await api<{ text: string }>("/school/report/summary", { body: { days: Number(days) } })).text);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Sparkles /> {busy ? "Анализирую…" : "Сделать выводы"}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => download(`/school/report.csv?days=${days}`, `Отчёт школы за ${days} дней.csv`)}>
                  <Download /> CSV
                </Button>
              </div>
            </div>
            {summary ? (
              <p className="whitespace-pre-line text-[15px] leading-7">{summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Claude прочитает сводку и коротко назовёт сильные и слабые классы, риски и что сделать на этой неделе.</p>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="flex flex-col gap-4">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Средний лучший пробный ЕНТ</p>
              {data.classes.map((c, i) => (
                <div key={c.code} className="flex flex-col gap-1">
                  <span className="flex justify-between text-sm">
                    <span className="truncate">{c.name}</span>
                    <b className="font-display tabular">{c.entAvgBest ?? "—"}</b>
                  </span>
                  <span className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${((c.entAvgBest ?? 0) / 140) * 100}%` }}
                      transition={{ delay: i * 0.06, duration: 0.6 }}
                      className="block h-full rounded-full bg-gradient-to-r from-[#ff8562] to-primary"
                    />
                    <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${(50 / 140) * 100}%` }} />
                  </span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Черта — порог 50 баллов.</p>
            </Card>
            <Card className="flex flex-col gap-4">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Активность за неделю</p>
              {data.classes.map((c, i) => (
                <div key={c.code} className="flex flex-col gap-1">
                  <span className="flex justify-between text-sm">
                    <span className="truncate">{c.name}</span>
                    <b className={cn("font-display tabular", c.activePct < 50 && "text-primary")}>{c.activePct}%</b>
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${c.activePct}%` }}
                      transition={{ delay: i * 0.06, duration: 0.6 }}
                      className={cn("block h-full rounded-full", c.activePct < 50 ? "bg-primary" : "bg-success")}
                    />
                  </span>
                </div>
              ))}
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    {["Класс", "Учитель", "Учеников", "Активны", "Пробников ЕНТ", "Ср. лучший ЕНТ", "Порог 50", "Ср. SAT", "Контрольные", "Риск"].map((h) => (
                      <th key={h} className="px-3 py-2.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.classes.map((c) => (
                    <tr key={c.code} className="border-t border-border">
                      <td className="px-3 py-2.5 font-medium">{c.name}</td>
                      <td className="px-3 py-2.5">{c.teacher}</td>
                      <td className="px-3 py-2.5 tabular">{c.students}</td>
                      <td className="px-3 py-2.5 tabular">{c.activePct}%</td>
                      <td className="px-3 py-2.5 tabular">{c.entMocks}</td>
                      <td className="px-3 py-2.5 font-display font-semibold tabular">{c.entAvgBest ?? "—"}</td>
                      <td className="px-3 py-2.5 tabular">{c.pass50 !== null ? `${c.pass50}%` : "—"}</td>
                      <td className="px-3 py-2.5 tabular">{c.satAvg ?? "—"}</td>
                      <td className="px-3 py-2.5 tabular">
                        {c.exams}
                        {c.examAvg !== null ? ` · ${c.examAvg}%` : ""}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.risk ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{c.risk}</span> : <span className="text-muted-foreground">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card className="flex flex-col gap-3 bg-secondary text-secondary-foreground">
              <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                <AlertTriangle className="size-3.5" /> Требуют внимания
              </p>
              {!data.risk.length && <p className="text-sm text-white/60">Учеников в зоне риска нет.</p>}
              {data.risk.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.04 }}
                  className="flex flex-col gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2.5"
                >
                  <span className="flex justify-between gap-2 text-sm">
                    <Link to={`/teacher/students/${r.id}`} className="font-medium hover:text-[#ff8562]">
                      {r.name}
                    </Link>
                    <span className="text-xs text-white/50">{r.className}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {r.reasons.map((x) => (
                      <span key={x} className="rounded-full bg-primary/30 px-2 py-0.5 text-[11px]">
                        {x}
                      </span>
                    ))}
                  </span>
                </motion.div>
              ))}
            </Card>
            <Card className="flex flex-col gap-3">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Учителя за период</p>
              {data.teachers.map((t) => (
                <div key={t.id} className="flex flex-col gap-1 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">
                    классов {t.classes} · контрольных {t.exams} · консультаций {t.consultations} · проверок по фото {t.written} · материалов {t.materials}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
