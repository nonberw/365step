import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { BookMarked, Download, FileSpreadsheet } from "lucide-react";
import { download } from "@/api";
import { useApi } from "@/hooks/useApi";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card, Empty } from "@/components/ui/card";
import { Aurora } from "@/pages/ent/EntHome";

interface JournalData {
  classRoom: { code: string; name: string };
  scale: { t5: number; t4: number; t3: number };
  columns: { id: string; kind: "exam" | "lesson" | "written"; title: string; at: number }[];
  rows: { id: string; name: string; cells: ({ pct: number | null; mark: number | null; raw: string } | null)[]; average: number | null }[];
}

const MARK = { 5: "bg-success text-white", 4: "bg-success/25 text-success", 3: "bg-[#ffd9b8] text-[#8a4b12]", 2: "bg-primary text-primary-foreground" } as Record<number, string>;
const KIND = { exam: "Контрольная", lesson: "Урок", written: "Письменная" };

export default function Journal() {
  const overview = useApi<{ classes: { code: string; name: string }[] }>("/teacher/overview");
  const [params, setParams] = useSearchParams();
  const code = params.get("class") ?? overview.data?.classes[0]?.code ?? null;
  const [scale, setScale] = useState({ t5: 85, t4: 70, t3: 50 });
  const q = `t5=${scale.t5}&t4=${scale.t4}&t3=${scale.t3}`;
  const { data, error, loading } = useApi<JournalData>(code ? `/journal/${code}?${q}` : null);

  if (overview.loading) return <Loading />;
  if (!overview.data?.classes.length) return <Empty title="Сначала создайте класс">Журнал собирается из работ учеников класса.</Empty>;

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#120d0d] text-white">
        <Aurora />
        <div className="relative flex flex-col gap-4 px-6 py-8 sm:px-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/80">
            <BookMarked className="size-3.5 text-[#ff8562]" /> Журнал оценок
          </span>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{data?.classRoom.name ?? "Журнал класса"}</h1>
          <p className="max-w-2xl text-white/70">
            Все оценки класса в одной таблице: контрольные с ИИ, уроки вайб-кодинга и письменные работы, проверенные по фото. Проценты переводятся в пятибалльную оценку по вашим порогам, таблицу можно выгрузить для
            Kundelik.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {overview.data.classes.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setParams({ class: c.code })}
                className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", c.code === code ? "bg-white text-[#120d0d]" : "bg-white/10 text-white/80 hover:bg-white/20")}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Card className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-5">
          {([5, 4, 3] as const).map((m) => {
            const key = `t${m}` as const;
            return (
              <label key={m} className="flex flex-col gap-1 text-sm">
                <span className="flex items-center gap-2">
                  <span className={cn("grid size-6 place-items-center rounded-md font-display text-xs font-bold", MARK[m])}>{m}</span>
                  от <b className="font-display tabular">{scale[key]}%</b>
                </span>
                <input type="range" min={m === 3 ? 20 : 40} max={m === 5 ? 100 : 95} value={scale[key]} onChange={(e) => setScale({ ...scale, [key]: Number(e.target.value) })} className="w-40 accent-[var(--primary)]" />
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!data?.columns.length} onClick={() => data && download(`/journal/${data.classRoom.code}/export.csv?format=long&${q}`, `Журнал ${data.classRoom.name} — для Kundelik.csv`)}>
            <Download /> Для Kundelik
          </Button>
          <Button disabled={!data?.columns.length} onClick={() => data && download(`/journal/${data.classRoom.code}/export.csv?format=wide&${q}`, `Журнал ${data.classRoom.name}.csv`)}>
            <FileSpreadsheet /> Таблица Excel
          </Button>
        </div>
      </Card>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : data && !data.columns.length ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <BookMarked className="size-10 text-muted-foreground" />
          <p className="font-display text-xl font-semibold">Оценок пока нет</p>
          <p className="max-w-lg text-sm text-muted-foreground">
            Журнал заполнится сам, когда класс напишет{" "}
            <Link to="/teacher/exams" className="font-semibold text-primary">
              контрольную с ИИ
            </Link>
            , вы оцените урок вайб-кодинга или проверите{" "}
            <Link to="/teacher/written" className="font-semibold text-primary">
              письменную работу по фото
            </Link>
            .
          </p>
        </Card>
      ) : data ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-48 border-b border-border bg-card px-4 py-3 text-left text-xs font-medium text-muted-foreground">Ученик</th>
                  {data.columns.map((c) => (
                    <th key={c.id} className="min-w-28 max-w-40 border-b border-border px-2 py-3 text-left align-bottom" title={c.title}>
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary">{KIND[c.kind]}</span>
                      <span className="line-clamp-2 text-xs font-medium">{c.title.replace(/^(Урок|Письменная): /, "")}</span>
                      <span className="text-[10px] text-muted-foreground">{fmtDate(c.at)}</span>
                    </th>
                  ))}
                  <th className="border-b border-border px-3 py-3 text-xs font-medium text-muted-foreground">Средний</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, ri) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="sticky left-0 z-10 border-b border-border bg-card px-4 py-2.5 font-medium">{r.name}</td>
                    {r.cells.map((c, ci) => (
                      <td key={ci} className="border-b border-border px-2 py-2.5">
                        {c && c.mark !== null ? (
                          <motion.span
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: Math.min(ri * 0.02 + ci * 0.02, 0.6) }}
                            title={`${c.raw}${c.pct !== null ? ` · ${c.pct}%` : ""}`}
                            className={cn("inline-grid size-8 place-items-center rounded-lg font-display text-sm font-bold", MARK[c.mark])}
                          >
                            {c.mark}
                          </motion.span>
                        ) : (
                          <span className="text-muted-foreground">·</span>
                        )}
                      </td>
                    ))}
                    <td className="border-b border-border px-3 py-2.5 font-display font-semibold tabular">{r.average ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      <p className="text-xs text-muted-foreground">Kundelik не принимает файлы напрямую от сторонних сервисов, поэтому выгрузка сделана так, чтобы оценки было удобно перенести: по ученику, дате и работе.</p>
    </div>
  );
}
