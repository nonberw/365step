import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { PublicUser, SatDomain, WeakSpot } from "@shared/types";
import { DOMAIN_RU } from "@shared/types";
import { useApi } from "@/hooks/useApi";
import { fmtDate } from "@/lib/format";
import { ErrorBox, Loading, PageHeader, Stat } from "@/components/Page";
import { Badge, Card, CardTitle, Progress } from "@/components/ui/card";

interface Detail {
  student: PublicUser;
  xp: { total: number; month: number; streak: number; best: number };
  sat: { estimate: number | null; accuracy: number | null; attempts: number; domains: { domain: SatDomain; right: number; total: number }[] };
  ielts: { kind: string; overall: number; at: number }[];
  ieltsEstimate: number | null;
  coding: { solved: string[]; total: number };
  lessons: { lessonId: string; title: string; submitted: boolean; score: number | null; teacherGrade: number | null }[];
  weak: WeakSpot[];
  tests: { rw_score: number; math_score: number; finished_at: number }[];
}

export default function StudentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useApi<Detail>(`/teacher/students/${id}`);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const s = data.student;
  const goals = [s.goals.sat && `SAT ${s.goals.sat.target}${s.goals.sat.date ? ` к ${fmtDate(s.goals.sat.date)}` : ""}`, s.goals.ielts && `IELTS ${s.goals.ielts.target}`, s.goals.coding && "программирование"].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Назад
      </button>
      <PageHeader eyebrow={`${s.grade ?? ""}${s.classLetter ?? ""} класс`} title={`${s.firstName} ${s.lastName}`} description={goals ? `Цели: ${goals}` : "Цели не указаны"} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Оценка SAT" value={data.sat.estimate ?? "—"} />
        <Stat label="Точность SAT" value={data.sat.accuracy === null ? "—" : `${Math.round(data.sat.accuracy * 100)}%`} hint={`${data.sat.attempts} вопросов`} />
        <Stat label="IELTS" value={data.ieltsEstimate?.toFixed(1) ?? "—"} />
        <Stat label="Задач решено" value={`${data.coding.solved.length}/${data.coding.total}`} />
        <Stat label="Серия" value={data.xp.streak} hint={`${data.xp.month} XP за месяц`} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardTitle>SAT по доменам</CardTitle>
          {data.sat.domains.length === 0 && <p className="text-sm text-muted-foreground">Нет данных</p>}
          {data.sat.domains.map((d) => {
            const p = Math.round((d.right / d.total) * 100);
            return (
              <div key={d.domain}>
                <div className="flex justify-between text-sm">
                  <span>{DOMAIN_RU[d.domain]}</span>
                  <span className="tabular">
                    {p}% · {d.total}
                  </span>
                </div>
                <Progress value={p} tone={p < 60 ? "brand" : "ok"} className="mt-1" />
              </div>
            );
          })}
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2">
            <CardTitle>Пробные тесты SAT</CardTitle>
            {data.tests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Тестов не было</p>
            ) : (
              data.tests.map((t) => (
                <div key={t.finished_at} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{fmtDate(t.finished_at)}</span>
                  <span className="font-display font-semibold tabular">{t.rw_score + t.math_score}</span>
                </div>
              ))
            )}
          </Card>
          <Card className="flex flex-col gap-2">
            <CardTitle>IELTS: последние проверки</CardTitle>
            {data.ielts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет проверок</p>
            ) : (
              data.ielts.map((r) => (
                <div key={r.at} className="flex justify-between text-sm">
                  <span>{r.kind === "speaking" ? "Speaking" : r.kind === "writing1" ? "Writing Task 1" : "Writing Task 2"}</span>
                  <span className="text-muted-foreground">{fmtDate(r.at)}</span>
                  <span className="font-display font-semibold tabular">{r.overall.toFixed(1)}</span>
                </div>
              ))
            )}
          </Card>
          <Card className="flex flex-col gap-2">
            <CardTitle>Уроки вайб-кодинга</CardTitle>
            {data.lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока не открывал</p>
            ) : (
              data.lessons.map((l) => (
                <div key={l.lessonId} className="flex items-center justify-between gap-2 text-sm">
                  <span>{l.title}</span>
                  {l.teacherGrade ? <Badge tone="ok">{l.teacherGrade}</Badge> : l.submitted ? <Badge tone="brand">{l.score}%</Badge> : <Badge>в работе</Badge>}
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
      {data.weak.length > 0 && (
        <Card>
          <CardTitle>Слабые места</CardTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.weak.map((w) => (
              <Badge key={w.label} tone={w.pct < 60 ? "bad" : "warn"}>
                {w.label}: {w.pct}%
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
