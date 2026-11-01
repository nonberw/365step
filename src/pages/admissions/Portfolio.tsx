import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles, Trash2, Wand2 } from "lucide-react";
import { MISSIONS } from "@shared/droneMissions";
import { CAD_LESSONS } from "@shared/cadLessons";
import { OPPORTUNITIES } from "@shared/opportunities";
import { ARDUINO_LESSONS } from "@/lib/athena/lessons";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useNotify } from "@/components/Notify";
import { ErrorBox, Loading } from "@/components/Page";
import { Badge, Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/format";

// The bridge from the labs to admissions: everything built on the platform (drone missions, CAD parts, Arduino
// projects, robots, solved problems, path levels) becomes a fact the student can turn into a Common App activity.

interface Activity {
  id: string;
  source: string;
  position: string;
  organization: string;
  description: string;
  hours: number;
  weeks: number;
}

interface Source {
  id: string;
  emoji: string;
  title: string;
  facts: string;
  href: string;
  field: "stem" | "it";
}

interface EngProgress {
  items: Record<string, { score: number; at: number }>;
}

const titleOf = (list: { id: string; title: string }[], ids: string[]) => ids.map((x) => list.find((l) => l.id === x)?.title ?? x);

export default function Portfolio() {
  const notify = useNotify();
  const eng = useApi<EngProgress>("/eng/progress");
  const code = useApi<{ id: string; title: string; status: string; pattern: string }[]>("/coding/problems");
  const path = useApi<{ courses: { id: string; title: string; done: number; total: number }[] }>("/path");
  const acts = useApi<Activity[]>("/admissions/activities");
  const [edit, setEdit] = useState<{ source: string; facts: string; position: string; organization: string; description: string; hours: number; weeks: number; tips: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sources = useMemo<Source[]>(() => {
    const items = eng.data?.items ?? {};
    const ids = (prefix: string) => Object.keys(items).filter((k) => k.startsWith(`${prefix}:`)).map((k) => k.slice(prefix.length + 1));
    const out: Source[] = [];
    const drone = ids("drone");
    if (drone.length) out.push({ id: "drone", emoji: "🚁", title: `Дроны: ${drone.length} ${plural(drone.length, "миссия", "миссии", "миссий")}`, facts: `Designed and tuned a quadcopter in a physics simulator (6DOF, cascaded PID). Completed ${drone.length} flight missions: ${titleOf(MISSIONS, drone).join(", ")}.`, href: "/engineering/drone", field: "stem" });
    const cad = ids("cad");
    if (cad.length) out.push({ id: "cad", emoji: "🧊", title: `CAD: ${cad.length} ${plural(cad.length, "деталь", "детали", "деталей")}`, facts: `Modeled ${cad.length} parametric parts in code on the OpenCascade kernel and exported them for 3D printing: ${titleOf(CAD_LESSONS, cad).join(", ")}.`, href: "/engineering/cad/box", field: "stem" });
    const ard = ids("arduino");
    if (ard.length) out.push({ id: "arduino", emoji: "🔌", title: `Arduino: ${ard.length} ${plural(ard.length, "проект", "проекта", "проектов")}`, facts: `Built and programmed ${ard.length} Arduino circuits in C++ (sensors, servos, displays): ${titleOf(ARDUINO_LESSONS, ard).join(", ")}.`, href: "/engineering/arduino/blink", field: "stem" });
    const robot = ids("robot");
    if (robot.length) out.push({ id: "robot", emoji: "🤖", title: `Роботы URDF: ${robot.length} ${plural(robot.length, "модель", "модели", "моделей")}`, facts: `Designed ${robot.length} robot descriptions (URDF: links, joints, inertia) for simulation: ${robot.join(", ")}.`, href: "/engineering/robot", field: "stem" });
    const solved = (code.data ?? []).filter((p) => p.status === "solved");
    if (solved.length) {
      const patterns = [...new Set(solved.map((p) => p.pattern))];
      out.push({ id: "code", emoji: "💻", title: `Алгоритмы: ${solved.length} ${plural(solved.length, "задача", "задачи", "задач")}`, facts: `Solved ${solved.length} algorithm problems in Python/JavaScript with hidden tests, covering ${patterns.length} topics (${patterns.join(", ")}).`, href: "/coding", field: "it" });
    }
    for (const c of path.data?.courses ?? []) {
      if (c.done >= 3) out.push({ id: `path-${c.id}`, emoji: "🌱", title: `${c.title}: ${c.done} ${plural(c.done, "уровень", "уровня", "уровней")}`, facts: `Self-study: completed ${c.done} of ${c.total} levels of ${c.title} on the 365step learning path.`, href: `/learn?course=${c.id}`, field: c.id === "code" ? "it" : "stem" });
    }
    return out;
  }, [eng.data, code.data, path.data]);

  const fields = new Set(sources.map((s) => s.field));
  const today = new Date().toISOString().slice(0, 10);
  const matches = OPPORTUNITIES.filter((o) => (fields.size ? fields.has(o.field as "stem" | "it") : o.field === "stem") && (o.rolling || (o.deadline && o.deadline >= today))).slice(0, 4);

  async function phrase() {
    if (!edit) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ position: string; organization: string; description: string; tips: string[] }>("/admissions/activities/phrase", { body: { facts: edit.facts } });
      setEdit({ ...edit, ...r });
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveActivity() {
    if (!edit) return;
    setErr("");
    try {
      await api("/admissions/activities", { body: edit });
      setEdit(null);
      notify({ variant: "success", title: "В Activities ✅", body: "Твой проект теперь в списке для Common App." });
      await acts.reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  if (eng.loading || acts.loading) return <Loading />;
  if (!acts.data) return <ErrorBox message={acts.error} />;
  const used = new Set(acts.data.map((a) => a.source));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <p className="font-display text-xl font-bold">Сделано на платформе → в заявку</p>
          <p className="text-sm text-muted-foreground">Лаборатория, код и путь — это не просто уроки: это проекты, о которых можно рассказать приёмной комиссии. Выбери, что оформить в Activities для Common App.</p>
          {sources.length === 0 ? (
            <p className="rounded-2xl bg-muted p-4 text-sm">
              Пока пусто. Пройди миссию с дроном, деталь в CAD или проект на Arduino в{" "}
              <Link to="/engineering" className="font-bold text-primary">
                инженерной лаборатории
              </Link>{" "}
              или реши задачи в{" "}
              <Link to="/coding" className="font-bold text-primary">
                коде
              </Link>{" "}
              — и они появятся здесь.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sources.map((s) => (
                <div key={s.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
                  <p className="font-bold">
                    <span className="sticker mr-1.5 inline-block text-xl">{s.emoji}</span> {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.facts}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant={used.has(s.id) ? "outline" : "default"} onClick={() => setEdit({ source: s.id, facts: s.facts, position: "", organization: "365step", description: "", hours: 3, weeks: 20, tips: [] })}>
                      <Wand2 /> {used.has(s.id) ? "Ещё вариант" : "Оформить для Common App"}
                    </Button>
                    <Link to={s.href} className={buttonVariants({ size: "sm", variant: "ghost" })}>
                      Открыть
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="ghost" className="self-start" onClick={() => setEdit({ source: "custom", facts: "", position: "", organization: "", description: "", hours: 2, weeks: 30, tips: [] })}>
            + Своя активность (кружок, волонтёрство, спорт)
          </Button>
        </Card>

        {edit && (
          <Card className="flex flex-col gap-3 border-primary">
            <p className="font-display text-lg font-bold">Оформляем активность</p>
            <textarea aria-label="Факты" value={edit.facts} onChange={(e) => setEdit({ ...edit, facts: e.target.value })} placeholder="Факты: что делал, сколько часов, каких результатов добился" className="min-h-[90px] rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-primary" />
            <Button variant="outline" onClick={phrase} disabled={busy} className="self-start">
              <Sparkles /> {busy ? "ИИ формулирует…" : "Сформулировать по фактам"}
            </Button>
            <Field label="Position / role" max={50} value={edit.position} onChange={(v) => setEdit({ ...edit, position: v })} />
            <Field label="Organization" max={100} value={edit.organization} onChange={(v) => setEdit({ ...edit, organization: v })} />
            <Field label="Description" max={150} value={edit.description} onChange={(v) => setEdit({ ...edit, description: v })} area />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold">
                часов в неделю
                <Input type="number" min={0} max={80} value={edit.hours} onChange={(e) => setEdit({ ...edit, hours: Number(e.target.value) })} />
              </label>
              <label className="text-xs font-semibold">
                недель в году
                <Input type="number" min={0} max={52} value={edit.weeks} onChange={(e) => setEdit({ ...edit, weeks: Number(e.target.value) })} />
              </label>
            </div>
            {edit.tips.length > 0 && <p className="rounded-2xl bg-muted p-3 text-xs">💡 {edit.tips.join(" ")}</p>}
            <p className="text-[11px] text-muted-foreground">ИИ берёт только твои факты и ничего не преувеличивает. Проверь текст перед отправкой.</p>
            <ErrorBox message={err} />
            <div className="flex gap-2">
              <Button onClick={saveActivity}>Сохранить в Activities</Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>
                Отмена
              </Button>
            </div>
          </Card>
        )}
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-bold">Activities</p>
            <Badge tone={acts.data.length >= 10 ? "warn" : "brand"}>{acts.data.length}/10</Badge>
          </div>
          {acts.data.length === 0 && <p className="text-sm text-muted-foreground">В Common App помещается 10 активностей. Начни с проектов слева.</p>}
          <ol className="flex flex-col gap-2">
            {acts.data.map((a, i) => (
              <li key={a.id} className="rounded-2xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold">
                    {i + 1}. {a.position || "без роли"} · <span className="font-medium text-muted-foreground">{a.organization}</span>
                  </p>
                  <button type="button" aria-label="Удалить" onClick={async () => (await api(`/admissions/activities/${a.id}`, { method: "DELETE" }), acts.reload())} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs">{a.description}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {a.hours} ч/нед · {a.weeks} нед/год
                </p>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="flex flex-col gap-3">
          <p className="font-display text-lg font-bold">Конкурсы под твои навыки</p>
          <p className="text-xs text-muted-foreground">{fields.size ? "Подобраны по тому, что ты уже делал в лаборатории и коде." : "Начни с инженерии или кода — подборка станет точнее."}</p>
          {matches.map((o) => (
            <a key={o.id} href={o.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-2 rounded-2xl border border-border p-3 text-sm hover:border-primary">
              <span>
                <b>{o.title}</b>
                <span className="block text-xs text-muted-foreground">{o.deadline ? `дедлайн ${o.deadline}` : "без фиксированного дедлайна"}</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0" />
            </a>
          ))}
          <Link to="/admissions?tab=catalog" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Весь каталог
          </Link>
        </Card>
      </aside>
    </div>
  );
}

function Field({ label, max, value, onChange, area }: { label: string; max: number; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      <span className="flex justify-between">
        {label}
        <span className={cn("tabular", value.length > max ? "text-destructive" : "text-muted-foreground")}>
          {value.length}/{max}
        </span>
      </span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[70px] rounded-xl border border-border bg-card p-2 text-sm font-normal outline-none focus:border-primary" />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
