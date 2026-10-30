import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Lock, Plus, Radio, Users } from "lucide-react";
import type { PublicUser } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { ART, addressOf, greeting } from "@/lib/format";
import { ErrorBox, GreetingBanner, Loading, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import TelegramAssistant from "@/components/TelegramAssistant";

interface Overview {
  teacher: PublicUser;
  classes: { code: string; name: string; active_lesson_id: string | null; locked: number; students: number; online: number; activeThisWeek: number; monthXp: number; assignments: number }[];
}

export default function TeacherHome({ classesOnly }: { classesOnly?: boolean }) {
  const { data, error, loading, reload } = useApi<Overview>("/teacher/overview");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const r = await api<{ code: string }>("/teacher/classes", { body: { name } });
      setName("");
      reload();
      navigate(`/teacher/classes/${r.code}`);
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }

  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const totalStudents = data.classes.reduce((s, c) => s + c.students, 0);
  const live = data.classes.filter((c) => c.active_lesson_id);

  return (
    <div className="flex flex-col gap-6">
      {classesOnly ? (
        <PageHeader eyebrow="Учитель" title="Мои классы" />
      ) : (
        <GreetingBanner
          title={`${greeting()}, ${addressOf(data.teacher)}`}
          subtitle={
            params.get("welcome")
              ? "Аккаунт учителя готов. Создайте первый класс и раздайте ученикам его код."
              : `${data.classes.length} ${data.classes.length === 1 ? "класс" : "класса"} · ${totalStudents} учеников${live.length ? ` · урок идёт в ${live.length}` : ""}`
          }
          image={ART.astronomer}
          position="center 25%"
        />
      )}

      {!classesOnly && <TelegramAssistant role="teacher" />}

      {live.length > 0 && (
        <div className="flex flex-col gap-2">
          {live.map((c) => (
            <Link key={c.code} to={`/teacher/classes/${c.code}/live`} className="flex items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground">
              <span className="flex items-center gap-2">
                <Radio className="size-4 animate-pulse" /> Урок идёт: {c.name} {c.locked ? <Lock className="size-4" /> : null}
              </span>
              <span className="flex items-center gap-1 text-sm">
                {c.online} в сети <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.classes.map((c) => (
          <Link key={c.code} to={`/teacher/classes/${c.code}`} className="group flex flex-col gap-3 rounded-2xl border border-border p-5 hover:border-primary">
            <div className="flex items-center justify-between gap-2">
              <Badge tone="dark" className="font-mono">
                {c.code}
              </Badge>
              <Users className="size-4 text-muted-foreground" />
            </div>
            <p className="font-display text-xl font-semibold">{c.name}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Mini label="учеников" value={c.students} />
              <Mini label="активны за 7 дней" value={c.activeThisWeek} />
              <Mini label="заданий" value={c.assignments} />
            </div>
            <span className="mt-auto flex items-center justify-between text-sm text-muted-foreground">
              {c.monthXp} XP класса за месяц
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
        <Card className="flex flex-col gap-3 border-dashed">
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-4" /> Новый класс
          </CardTitle>
          <form onSubmit={create} className="flex flex-col gap-3">
            <Field label="Название" htmlFor="class-name">
              <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="10А · SAT Math" />
            </Field>
            <ErrorBox message={err} />
            <Button disabled={!name.trim()}>Создать класс</Button>
          </form>
          <p className="text-xs text-muted-foreground">Ученики вводят код класса при регистрации или в профиле.</p>
        </Card>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-2">
      <p className="font-display text-xl font-semibold tabular">{value}</p>
      <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
