import { useState, type FormEvent } from "react";
import { LogOut } from "lucide-react";
import type { PublicUser } from "@shared/types";
import { TITLES } from "@shared/types";
import { entSessionsForYear, entTargetFor, entYearChoices } from "@shared/entSchedule";
import type { PlantSpecies } from "@shared/plants";
import { PlantCard, PlantPicker } from "@/components/Plant";
import { api } from "@/api";
import { useAuth } from "@/lib/auth";
import { ErrorBox, GreetingBanner } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";

export default function Profile() {
  const { user, refresh, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [entChanged, setEntChanged] = useState(false);
  const [ent, setEnt] = useState(() => {
    const exam = entTargetFor(user?.goals ?? {}, user?.grade);
    return { target: user?.goals.ent?.target ?? 0, year: exam.year, session: exam.session };
  });
  const [goals, setGoals] = useState(() => ({
    sat: user?.goals.sat?.target ?? 0,
    satDate: user?.goals.sat?.date ?? "",
    ielts: user?.goals.ielts?.target ?? 0,
    ieltsDate: user?.goals.ielts?.date ?? "",
  }));
  if (!user) return null;

  async function join(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api("/me/join-class", { body: { code } });
      await refresh();
      setMsg(`Готово: вы в классе ${code.toUpperCase()}`);
      setCode("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function choosePlant(plant: PlantSpecies) {
    setError("");
    try {
      await api<PublicUser>("/auth/me", { method: "PATCH", body: { plant } });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveGoals(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const previous = user!.goals.ent;
      const previousExam = entTargetFor(user!.goals, user!.grade);
      const sameSchedule = ent.year === previousExam.year && ent.session === previousExam.session;
      const entGoal = !entChanged ? previous : !ent.target ? undefined : previous && sameSchedule ? { ...previous, target: ent.target } : {
        target: ent.target, year: ent.year, session: ent.session, date: entSessionsForYear(ent.year).find((s) => s.id === ent.session)!.date, tentative: true,
      };
      await api<PublicUser>("/auth/me", {
        method: "PATCH",
        body: {
          goals: {
            ...user!.goals,
            ent: entGoal,
            sat: goals.sat ? { target: goals.sat, date: goals.satDate, current: user!.goals.sat?.current } : undefined,
            ielts: goals.ielts ? { target: goals.ielts, date: goals.ieltsDate, current: user!.goals.ielts?.current } : undefined,
          },
        },
      });
      await refresh();
      setMsg("Цели сохранены");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <GreetingBanner
        eyebrow="Профиль"
        title={user.role === "teacher" ? `${user.title ? TITLES[user.title] : ""} ${user.lastName}` : `${user.firstName} ${user.lastName}`}
        subtitle={`${user.email} · ${user.plan === "pro" ? `Pro до ${new Date(user.planUntil ?? 0).toLocaleDateString("ru-RU")}` : "Тариф «Старт»"}`}
        action={
          <Button variant="outline" onClick={signOut}>
            <LogOut /> Выйти
          </Button>
        }
      />
      {msg && <p className="rounded-xl bg-[#e6f6ec] px-4 py-3 text-sm text-success">{msg}</p>}
      <ErrorBox message={error} />

      {user.role === "student" ? (
        <>
          <Card id="plant" className="flex flex-col gap-4">
            <CardTitle>Растение-спутник</CardTitle>
            {user.plant && <PlantCard species={user.plant} xp={user.xp} />}
            <PlantPicker value={user.plant} onChange={choosePlant} />
          </Card>
          <Card id="goals">
            <CardTitle>Цели</CardTitle>
            <form onSubmit={saveGoals} className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Цель ЕНТ (50–140, 0 — не готовлюсь)" htmlFor="g-ent">
                <Input id="g-ent" type="number" min={ent.target ? 50 : 0} max={140} value={ent.target || ""} onChange={(e) => { setEntChanged(true); setEnt({ ...ent, target: Number(e.target.value) }); }} />
              </Field>
              <Field label="Год сдачи ЕНТ" htmlFor="g-ent-year">
                <Select id="g-ent-year" value={ent.year} onChange={(e) => { const year = Number(e.target.value); setEntChanged(true); setEnt({ ...ent, year, session: `${year}-${ent.session.split("-")[1]}` }); }}>
                  {entYearChoices(user.grade, ent.year).map((year) => <option key={year} value={year}>{year}</option>)}
                </Select>
              </Field>
              <Field label="Сессия ЕНТ · сроки ориентировочные" htmlFor="g-ent-session">
                <Select id="g-ent-session" value={ent.session} onChange={(e) => { setEntChanged(true); setEnt({ ...ent, session: e.target.value }); }}>
                  {entSessionsForYear(ent.year).map((session) => <option key={session.id} value={session.id}>{session.name} · {session.dates}</option>)}
                </Select>
              </Field>
              <p className="self-center text-sm text-muted-foreground">План и отсчёт до ЕНТ учитывают выбранный год. Точную дату нужно будет сверить с официальным расписанием.</p>
              <Field label="Цель SAT (400–1600, 0 — не готовлюсь)" htmlFor="g-sat">
                <Input id="g-sat" inputMode="numeric" value={goals.sat || ""} onChange={(e) => setGoals({ ...goals, sat: Number(e.target.value.replace(/\D/g, "")) })} />
              </Field>
              <Field label="Дата SAT" htmlFor="g-sat-date">
                <Input id="g-sat-date" type="date" value={goals.satDate} onChange={(e) => setGoals({ ...goals, satDate: e.target.value })} />
              </Field>
              <Field label="Цель IELTS (1–9, 0 — не готовлюсь)" htmlFor="g-ielts">
                <Input id="g-ielts" inputMode="decimal" value={goals.ielts || ""} onChange={(e) => setGoals({ ...goals, ielts: Number(e.target.value.replace(/[^\d.]/g, "")) })} />
              </Field>
              <Field label="Дата IELTS" htmlFor="g-ielts-date">
                <Input id="g-ielts-date" type="date" value={goals.ieltsDate} onChange={(e) => setGoals({ ...goals, ieltsDate: e.target.value })} />
              </Field>
              <Button className="sm:col-span-2 sm:justify-self-start">Сохранить цели</Button>
            </form>
          </Card>
        </>
      ) : (
        <Card className="flex flex-col gap-2">
          <CardTitle>Предметы</CardTitle>
          <div className="flex flex-wrap gap-2">
            {user.subjects.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
