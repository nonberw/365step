import { useState, type FormEvent } from "react";
import { ENT_SUBJECTS } from "@shared/ent";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Lock, Radio, Trash2 } from "lucide-react";
import type { Assignment } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, Card, CardTitle, Empty, Progress, Segmented } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";

interface ClassView {
  classRoom: { code: string; name: string; unlockCode: string; activeLessonId: string | null; locked: boolean; aiEnabled: boolean };
  students: { id: string; name: string; grade: string; satEstimate: number | null; satAccuracy: number | null; ieltsEstimate: number | null; solved: number; monthXp: number; streak: number; lastActive: number | null; assignmentsDone: number }[];
  assignments: (Assignment & { doneCount: number })[];
  lessons: { id: string; title: string; grade: string; task: string }[];
  problems: { id: string; title: string; difficulty: string }[];
}

const KINDS: { value: Assignment["kind"]; label: string }[] = [
  { value: "sat-test", label: "Пробный тест SAT" },
  { value: "sat-practice", label: "Вопросы SAT из банка" },
  { value: "ielts-writing", label: "IELTS Writing" },
  { value: "ielts-speaking", label: "IELTS Speaking" },
  { value: "coding", label: "Задача по коду" },
  { value: "lesson", label: "Урок вайб-кодинга" },
  { value: "vocab", label: "Юнит словаря SAT" },
  { value: "ent-full", label: "Пробный ЕНТ (полный)" },
  { value: "ent-subject", label: "Мини-пробник ЕНТ по предмету" },
];

export default function ClassPage() {
  const { code = "" } = useParams();
  const { data, error, loading, reload } = useApi<ClassView>(`/teacher/classes/${code}`);
  const [tab, setTab] = useState<"students" | "assignments" | "lesson">("students");
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const c = data.classRoom;

  return (
    <div className="flex flex-col gap-5">
      <Link to="/teacher" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все классы
      </Link>
      <PageHeader
        eyebrow="Класс"
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            Код для учеников: <CopyBadge text={c.code} /> · Код выхода из урока: <Badge tone="soft" className="font-mono">{c.unlockCode}</Badge>
          </span>
        }
        action={
          <Link to={`/teacher/classes/${c.code}/live`} className={buttonVariants({ variant: c.activeLessonId ? "default" : "outline" })}>
            <Radio /> {c.activeLessonId ? "Идёт урок" : "Живой урок"}
          </Link>
        }
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "students", label: `Ученики (${data.students.length})` },
          { value: "assignments", label: `Задания (${data.assignments.length})` },
          { value: "lesson", label: "Урок и ИИ" },
        ]}
      />
      {tab === "students" && <Students data={data} />}
      {tab === "assignments" && <Assignments data={data} onChange={reload} />}
      {tab === "lesson" && <LessonSettings data={data} onChange={reload} />}
    </div>
  );
}

function CopyBadge({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }).catch(() => undefined)}
      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-mono text-xs font-semibold text-secondary-foreground"
    >
      {text} <Copy className="size-3" /> {done && "скопировано"}
    </button>
  );
}

function Students({ data }: { data: ClassView }) {
  if (!data.students.length) return <Empty title="В классе пока нет учеников">Раздайте код {data.classRoom.code}: ученик вводит его при регистрации или в профиле.</Empty>;
  const total = data.assignments.length;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-secondary text-left text-xs text-secondary-foreground">
          <tr>
            {["Ученик", "SAT", "Точность", "IELTS", "Задачи", "Задания", "XP за месяц", "Последняя активность"].map((h) => (
              <th key={h} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.students.map((s) => (
            <tr key={s.id} className="border-t border-border hover:bg-muted/50">
              <td className="px-4 py-3">
                <Link to={`/teacher/students/${s.id}`} className="font-semibold hover:text-primary">
                  {s.name}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">{s.grade}</span>
              </td>
              <td className="px-4 py-3 font-display font-semibold tabular">{s.satEstimate ?? "—"}</td>
              <td className={cn("px-4 py-3 tabular", s.satAccuracy !== null && s.satAccuracy < 0.6 && "text-destructive")}>{s.satAccuracy === null ? "—" : `${Math.round(s.satAccuracy * 100)}%`}</td>
              <td className="px-4 py-3 tabular">{s.ieltsEstimate?.toFixed(1) ?? "—"}</td>
              <td className="px-4 py-3 tabular">{s.solved}</td>
              <td className="px-4 py-3">
                <span className="tabular">
                  {s.assignmentsDone}/{total}
                </span>
                {total > 0 && <Progress value={(s.assignmentsDone / total) * 100} tone="ok" className="mt-1 w-20" />}
              </td>
              <td className="px-4 py-3 tabular">{s.monthXp}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.lastActive ? fmtDate(s.lastActive) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Assignments({ data, onChange }: { data: ClassView; onChange: () => void }) {
  const [kind, setKind] = useState<Assignment["kind"]>("sat-practice");
  const [title, setTitle] = useState("");
  const [ref, setRef] = useState("20");
  const [due, setDue] = useState("");
  const [err, setErr] = useState("");

  const refField =
    kind === "coding" ? (
      <Select id="as-ref" value={ref} onChange={(e) => setRef(e.target.value)}>
        {data.problems.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title} · {p.difficulty}
          </option>
        ))}
      </Select>
    ) : kind === "lesson" ? (
      <Select id="as-ref" value={ref} onChange={(e) => setRef(e.target.value)}>
        {data.lessons.map((l) => (
          <option key={l.id} value={l.id}>
            {l.grade} кл. · {l.title}
          </option>
        ))}
      </Select>
    ) : kind === "vocab" ? (
      <Select id="as-ref" value={ref} onChange={(e) => setRef(e.target.value)}>
        {["v1", "v2", "v3", "v4"].map((v, i) => (
          <option key={v} value={v}>
            Юнит {i + 1}
          </option>
        ))}
      </Select>
    ) : kind === "ent-subject" ? (
      <Select id="as-ref" value={ref} onChange={(e) => setRef(e.target.value)}>
        {ENT_SUBJECTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    ) : kind === "sat-practice" ? (
      <Input id="as-ref" inputMode="numeric" value={ref} onChange={(e) => setRef(e.target.value.replace(/\D/g, ""))} />
    ) : null;

  function pickKind(k: Assignment["kind"]) {
    setKind(k);
    setRef(k === "coding" ? data.problems[0]!.id : k === "lesson" ? data.lessons[0]!.id : k === "vocab" ? "v1" : k === "sat-practice" ? "20" : k === "ent-subject" ? "math" : "");
    setTitle(KINDS.find((x) => x.value === k)!.label);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api(`/teacher/classes/${data.classRoom.code}/assignments`, { body: { kind, title: title || KINDS.find((x) => x.value === kind)!.label, ref, dueAt: due || null } });
      setTitle("");
      onChange();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }

  async function remove(id: string) {
    await api(`/teacher/assignments/${id}`, { method: "DELETE" }).catch(() => undefined);
    onChange();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-2">
        {data.assignments.length === 0 && <Empty title="Заданий пока нет">Создайте первое задание справа: статус по каждому ученику обновится сам.</Empty>}
        {data.assignments.map((a) => (
          <Card key={a.id} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {KINDS.find((k) => k.value === a.kind)?.label}
                {a.dueAt && ` · до ${fmtDate(a.dueAt)}`}
              </p>
              <Progress value={(a.doneCount / Math.max(1, data.students.length)) * 100} tone="ok" className="mt-2" />
            </div>
            <span className="font-display text-lg font-semibold tabular">
              {a.doneCount}/{data.students.length}
            </span>
            <button type="button" aria-label="Удалить задание" onClick={() => remove(a.id)} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive">
              <Trash2 className="size-4" />
            </button>
          </Card>
        ))}
      </div>
      <Card>
        <CardTitle>Новое задание</CardTitle>
        <form onSubmit={create} className="mt-4 flex flex-col gap-3">
          <Field label="Тип" htmlFor="as-kind">
            <Select id="as-kind" value={kind} onChange={(e) => pickKind(e.target.value as Assignment["kind"])}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          {refField && (
            <Field label={kind === "sat-practice" ? "Сколько вопросов" : "Что именно"} htmlFor="as-ref">
              {refField}
            </Field>
          )}
          <Field label="Название для учеников" htmlFor="as-title">
            <Input id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={KINDS.find((x) => x.value === kind)!.label} />
          </Field>
          <Field label="Срок (необязательно)" htmlFor="as-due">
            <Input id="as-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <ErrorBox message={err} />
          <Button>Выдать классу</Button>
        </form>
      </Card>
    </div>
  );
}

function LessonSettings({ data, onChange }: { data: ClassView; onChange: () => void }) {
  const c = data.classRoom;
  async function update(patch: Record<string, unknown>) {
    await api(`/teacher/classes/${c.code}/settings`, { body: patch }).catch(() => undefined);
    onChange();
  }
  return (
    <Card className="flex flex-col gap-4">
      <Field label="Открытый урок" htmlFor="active-lesson">
        <Select id="active-lesson" value={c.activeLessonId ?? ""} onChange={(e) => update({ activeLessonId: e.target.value || null })}>
          <option value="">Урок не начат</option>
          {data.lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.grade} кл. · {l.title}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-wrap gap-3">
        <Toggle on={c.locked} disabled={!c.activeLessonId} onClick={() => update({ locked: !c.locked })} label={c.locked ? "Закрытый режим включён" : "Включить закрытый режим"} icon={<Lock className="size-4" />} />
        <Toggle on={c.aiEnabled} onClick={() => update({ aiEnabled: !c.aiEnabled })} label={c.aiEnabled ? "ИИ-помощник включён" : "ИИ-помощник выключен"} />
      </div>
      <p className="text-sm text-muted-foreground">В закрытом режиме ученики класса автоматически попадают в урок. Выход из полноэкранного режима или вкладки фиксируется, выйти совсем можно только по коду {c.unlockCode}.</p>
    </Card>
  );
}

export function Toggle({ on, onClick, label, disabled, icon }: { on: boolean; onClick: () => void; label: string; disabled?: boolean; icon?: React.ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={onClick} className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 font-display text-sm font-semibold transition-colors disabled:opacity-50", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
      {icon}
      {label}
    </button>
  );
}
