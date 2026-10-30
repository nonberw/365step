import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, BrainCircuit, CheckCircle2, RotateCcw } from "lucide-react";
import type { EntQuestionPublic } from "@shared/ent";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import NumberTicker from "@/components/ui/basic-number-ticker";
import { Aurora } from "@/pages/ent/EntHome";
import { Run } from "@/pages/ent/EntPractice";
import { LIST_KEY } from "@/pages/sat/Bank";

interface ReviewData {
  due: { ent: string[]; sat: string[] };
  total: number;
  stages: number[];
  days: { day: number; ent: number; sat: number }[];
  entItems: EntQuestionPublic[];
}

const WEEKDAY = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export default function Review() {
  const { data, error, loading, reload } = useApi<ReviewData>("/review");
  const [session, setSession] = useState(false);
  const navigate = useNavigate();
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const dueTotal = data.due.ent.length + data.due.sat.length;
  const maxDay = Math.max(1, ...data.days.map((d) => d.ent + d.sat));

  if (session && data.entItems.length)
    return (
      <div className="flex max-w-4xl flex-col gap-4">
        <h1 className="font-display text-2xl font-semibold">Повтор ошибок ЕНТ</h1>
        <Run
          items={data.entItems}
          onMore={() => {
            setSession(false);
            reload();
          }}
          onBack={() => {
            setSession(false);
            reload();
          }}
        />
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#120d0d] text-white">
        <Aurora />
        <div className="relative grid grid-cols-1 gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/80">
              <BrainCircuit className="size-3.5 text-[#ff8562]" /> Интервальное повторение
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
              Ошибки, которые <span className="bg-gradient-to-r from-[#ff8562] to-[#ff3b3b] bg-clip-text text-transparent">не повторятся</span>
            </h1>
            <p className="max-w-xl text-white/70">Каждое задание ЕНТ или SAT, где ты ошибся, вернётся через 1 день, потом через 3 и через 7. Три верных ответа подряд — и тема закреплена.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "ЕНТ сегодня", n: data.due.ent.length },
              { label: "SAT сегодня", n: data.due.sat.length },
            ].map((x) => (
              <div key={x.label} className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
                <span className="text-xs text-white/60">{x.label}</span>
                <span className="mt-1 block font-display text-5xl font-bold tabular">
                  <NumberTicker from={0} target={x.n} transition={{ duration: 1, ease: "easeOut" }} />
                </span>
                <span className="text-xs text-white/50">заданий к повтору</span>
              </div>
            ))}
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm">
              {["через 1 день", "через 3 дня", "через 7 дней"].map((l, i) => (
                <span key={l} className="flex flex-col items-center">
                  <b className="font-display text-xl">{data.stages[i] ?? 0}</b>
                  <span className="text-[11px] text-white/55">{l}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {dueTotal === 0 && data.total === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <p className="font-display text-xl font-semibold">Повторять пока нечего</p>
          <p className="max-w-md text-sm text-muted-foreground">Ошибки из тренировок и пробников ЕНТ и SAT попадут сюда сами. Начни с тренировки или мини-пробника.</p>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/ent")}>Подготовка к ЕНТ</Button>
            <Button variant="outline" onClick={() => navigate("/sat/bank")}>
              Банк SAT
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
          <Card className="flex flex-col gap-3">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Сегодня</p>
            <motion.button
              whileHover={{ y: -3 }}
              type="button"
              disabled={!data.due.ent.length}
              onClick={() => setSession(true)}
              className={cn("flex items-center gap-4 rounded-2xl border-2 p-4 text-left", data.due.ent.length ? "border-primary bg-primary/5" : "border-border opacity-60")}
            >
              <span className="grid size-12 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">{data.due.ent.length}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold">Повторить ЕНТ</span>
                <span className="text-xs text-muted-foreground">с разбором и подробным объяснением ИИ</span>
              </span>
              <ArrowRight className="size-5" />
            </motion.button>
            <motion.button
              whileHover={{ y: -3 }}
              type="button"
              disabled={!data.due.sat.length}
              onClick={() => {
                try {
                  sessionStorage.setItem(LIST_KEY, JSON.stringify(data.due.sat));
                } catch {
                  // the list is a convenience for prev/next
                }
                navigate(`/sat/q/${data.due.sat[0]}`);
              }}
              className={cn("flex items-center gap-4 rounded-2xl border-2 p-4 text-left", data.due.sat.length ? "border-secondary bg-secondary/5" : "border-border opacity-60")}
            >
              <span className="grid size-12 place-items-center rounded-xl bg-secondary font-display text-lg font-bold text-secondary-foreground">{data.due.sat.length}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold">Повторить SAT</span>
                <span className="text-xs text-muted-foreground">вопросы откроются по очереди</span>
              </span>
              <ArrowRight className="size-5" />
            </motion.button>
            {dueTotal === 0 && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <RotateCcw className="size-4" /> На сегодня всё повторено — следующие задания вернутся по графику справа.
              </p>
            )}
          </Card>
          <Card className="flex flex-col gap-4">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Следующие 7 дней</p>
            <div className="flex h-40 items-end gap-2">
              {data.days.map((d, i) => {
                const date = new Date(Date.now() + (d.day + 1) * 86_400_000);
                return (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
                      <motion.span initial={{ height: 0 }} animate={{ height: `${(d.sat / maxDay) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.5 }} className="w-full rounded-t-md bg-secondary" />
                      <motion.span
                        initial={{ height: 0 }}
                        animate={{ height: `${(d.ent / maxDay) * 100}%` }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                        className={cn("w-full bg-primary", !d.sat && "rounded-t-md")}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{WEEKDAY[date.getDay()]}</span>
                  </div>
                );
              })}
            </div>
            <p className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary" /> ЕНТ
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-secondary" /> SAT
              </span>
              <span>Всего в очереди: {data.total}</span>
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
