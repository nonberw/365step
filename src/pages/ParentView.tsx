import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarCheck, CheckCircle2, Circle, ClipboardCheck, Flame, GraduationCap, Medal, MessageSquareText, Send, Sparkles } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading } from "@/components/Page";
import { Logo } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AnimatedRadialChart } from "@/components/ui/animated-radial-chart";
import { Aurora } from "@/pages/ent/EntHome";

interface Snapshot {
  child: { name: string; firstName: string; grade: string; className: string | null };
  ent: null | {
    pair: string[];
    target: number | null;
    best: number | null;
    tests: { at: number; total: number; passedAll: boolean }[];
    last: { id: string; name: string; points: number; max: number; passed: boolean }[] | null;
    mini: number;
    weekAnswers: number;
    weekAccuracy: number | null;
    plan: { week: number; done: number; of: number; focus: string } | null;
  };
  sat: { estimate: number | null; accuracy: number | null; weekAnswers: number; weekAccuracy: number | null };
  ielts: number | null;
  consultations: { title: string; kind: string; at: number; teacher: string; past: boolean }[];
  assignments: { title: string; done: boolean; dueAt: number | null }[];
  exams: { title: string; score: number | null; max: number | null; at: number }[];
  activity: number[];
  weekXp: number;
  streak: number;
  reviewQueue: number;
}

interface View {
  parentName: string;
  data: Snapshot;
  reports: { week_start: number; summary: string; created_at: number }[];
  notes?: { text: string; sentAt: number; first_name: string; last_name: string; title: string | null }[];
  telegram: boolean;
  telegramUrl: string | null;
}

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function ParentView() {
  const { token = "" } = useParams();
  const { data, error, loading, setData } = useApi<View>(`/family/view/${token}`);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} className="m-6" />;
  const d = data.data;
  const maxDay = Math.max(1, ...d.activity);
  const thisWeek = data.reports[0] && Date.now() - data.reports[0].created_at < 7 * 86_400_000 ? data.reports[0] : null;

  async function makeReport() {
    setBusy(true);
    try {
      const r = await api<{ week: number; summary: string; createdAt: number }>(`/family/view/${token}/report`, { body: {} });
      setData({ ...data!, reports: [{ week_start: r.week, summary: r.summary, created_at: r.createdAt }, ...data!.reports.filter((x) => x.week_start !== r.week)] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-sidebar">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <header className="flex items-center justify-between">
          <Logo />
          <span className="text-xs text-muted-foreground">Страница для родителей · только просмотр</span>
        </header>

        <section className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#2f69cf_0%,#4f8ae0_55%,#8ab7ef_100%)] text-white">
          <Aurora />
          <div className="relative grid grid-cols-1 items-center gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1.3fr_1fr]">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-white/70">Здравствуйте, {data.parentName}!</p>
              <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
                Неделя {d.child.firstName}
                <span className="block text-2xl font-semibold text-white/60 sm:text-3xl">{[d.child.grade && `${d.child.grade} класс`, d.child.className].filter(Boolean).join(" · ")}</span>
              </h1>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <Flame className="size-4 text-[#ffd84d]" /> серия {d.streak} дн.
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <Sparkles className="size-4 text-[#ffd84d]" /> {d.weekXp} XP за неделю
                </span>
                {d.reviewQueue > 0 && <span className="rounded-full bg-white/10 px-3 py-1.5">{d.reviewQueue} ошибок на повторе</span>}
              </div>
              <div className="mt-2 flex h-24 items-end gap-2">
                {d.activity.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <motion.span
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, (v / maxDay) * 80)}px` }}
                      transition={{ delay: i * 0.06, duration: 0.5 }}
                      className={cn("w-full rounded-t-lg", v ? "bg-gradient-to-t from-primary to-[#8fb0ff]" : "bg-white/10")}
                    />
                    <span className="text-[10px] text-white/50">{DAYS[i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center rounded-3xl border border-white/35 bg-white/15 p-4">
              <AnimatedRadialChart
                value={d.ent?.best ?? 0}
                max={140}
                target={d.ent?.target}
                size={Math.min(270, typeof window !== "undefined" ? window.innerWidth - 110 : 270)}
                dark
                label={d.ent ? (d.ent.best !== null ? `лучший пробный ЕНТ${d.ent.target ? ` · цель ${d.ent.target}` : ""}` : "полного пробника ЕНТ ещё не было") : "ЕНТ ещё не начат"}
              />
            </div>
          </div>
        </section>

        <Card className="flex flex-col gap-3 border-primary/30">
          <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="size-3.5" /> Отчёт недели
          </p>
          {thisWeek ? <p className="whitespace-pre-line text-[15px] leading-7">{thisWeek.summary}</p> : <p className="text-sm text-muted-foreground">Отчёт приходит по пятницам. Можно собрать его прямо сейчас.</p>}
          <div className="flex flex-wrap gap-2">
            {!thisWeek && (
              <Button onClick={makeReport} disabled={busy}>
                <Sparkles /> {busy ? "Собираю отчёт… до 20 секунд" : "Собрать отчёт сейчас"}
              </Button>
            )}
            {data.telegramUrl && !data.telegram && (
              <a href={data.telegramUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#229ED9] px-5 text-sm font-semibold text-white">
                <Send className="size-4" /> Получать в Telegram
              </a>
            )}
          </div>
          {data.telegramUrl && (
            <p className="text-xs text-muted-foreground">
              В Telegram можно не только получать отчёт, но и спросить ИИ-помощника школы, как идут дела у ребёнка и как помочь с подготовкой. Он отвечает только по учёбе и только по данным платформы.
            </p>
          )}
        </Card>

        {!!data.notes?.length && (
          <Card className="flex flex-col gap-3 border-primary/30">
            <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <MessageSquareText className="size-3.5" /> Сообщения от учителей
            </p>
            {data.notes.map((n) => (
              <div key={n.sentAt} className="flex flex-col gap-1 rounded-2xl bg-muted/50 px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {n.title ? `${{ mr: "Mr", ms: "Ms", mrs: "Mrs" }[n.title] ?? ""} ${n.last_name}` : `${n.first_name} ${n.last_name}`} · {fmtDate(n.sentAt)}
                </span>
                <p className="whitespace-pre-line text-[15px] leading-7">{n.text}</p>
              </div>
            ))}
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            icon={<Medal className="size-4" />}
            label="ЕНТ, лучший пробник"
            value={d.ent?.best ?? "—"}
            hint={d.ent ? `${d.ent.weekAnswers} заданий за неделю${d.ent.weekAccuracy !== null ? `, ${d.ent.weekAccuracy}% верно` : ""}` : "профиль не выбран"}
          />
          <Kpi icon={<GraduationCap className="size-4" />} label="SAT, оценка" value={d.sat.estimate ?? "—"} hint={`${d.sat.weekAnswers} вопросов за неделю`} />
          <Kpi icon={<GraduationCap className="size-4" />} label="IELTS, ориентир" value={d.ielts ?? "—"} hint="по Writing и Speaking" />
          <Kpi icon={<ClipboardCheck className="size-4" />} label="Задания учителя" value={`${d.assignments.filter((a) => a.done).length}/${d.assignments.length}`} hint="выполнено" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {d.ent && (
            <Card className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-semibold">ЕНТ: {d.ent.pair.join(" + ")}</h2>
              {d.ent.plan && (
                <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
                  План недели {d.ent.plan.week}: «{d.ent.plan.focus}» — выполнено {d.ent.plan.done} из {d.ent.plan.of} задач
                </p>
              )}
              {d.ent.last ? (
                d.ent.last.map((b, i) => (
                  <div key={b.id} className="flex flex-col gap-1">
                    <span className="flex justify-between text-sm">
                      <span>{b.name}</span>
                      <b className={cn("font-display tabular", !b.passed && "text-primary")}>
                        {b.points}/{b.max}
                      </b>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <motion.span
                        initial={{ width: 0 }}
                        animate={{ width: `${(b.points / b.max) * 100}%` }}
                        transition={{ delay: i * 0.08, duration: 0.6 }}
                        className={cn("block h-full rounded-full", b.passed ? "bg-success" : "bg-primary")}
                      />
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Полного пробного ЕНТ ещё не было{d.ent.mini ? `, мини-пробников за неделю: ${d.ent.mini}` : ""}.</p>
              )}
              {d.ent.tests.length > 1 && <p className="text-xs text-muted-foreground">Пробники: {d.ent.tests.map((t) => t.total).join(" → ")}</p>}
            </Card>
          )}
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold">Задания учителя</h2>
            {!d.assignments.length && <p className="text-sm text-muted-foreground">Заданий пока нет.</p>}
            {d.assignments.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                {a.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate">{a.title}</span>
                {a.dueAt && <span className="text-xs text-muted-foreground">до {fmtDate(a.dueAt)}</span>}
              </div>
            ))}
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold">Консультации и доп. уроки</h2>
            {!d.consultations.length && <p className="text-sm text-muted-foreground">За неделю записей не было.</p>}
            {d.consultations.map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                <CalendarCheck className={cn("size-4", c.past ? "text-success" : "text-primary")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{c.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.teacher} · {fmtDate(c.at)} · {c.past ? "прошла" : "запланирована"}
                  </span>
                </span>
              </div>
            ))}
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold">Контрольные</h2>
            {!d.exams.length && <p className="text-sm text-muted-foreground">За последний месяц контрольных с открытыми результатами не было.</p>}
            {d.exams.map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
                <span className="font-display font-semibold tabular">{e.score !== null && e.max ? `${Math.round((e.score / e.max) * 100)}%` : "—"}</span>
              </div>
            ))}
          </Card>
        </div>

        {data.reports.length > 1 && (
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold">Прошлые отчёты</h2>
            {data.reports.slice(1).map((r) => (
              <details key={r.week_start} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium">Неделя с {fmtDate(r.week_start)}</summary>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">{r.summary}</p>
              </details>
            ))}
          </Card>
        )}
        <p className="pb-6 text-center text-xs text-muted-foreground">Баллы ЕНТ, SAT и IELTS — тренировочные оценки платформы, не официальные результаты.</p>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </span>
      <span className="font-display text-3xl font-bold tabular">{value}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Card>
  );
}
