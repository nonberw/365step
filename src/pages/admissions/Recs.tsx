import { useState, type FormEvent } from "react";
import { CalendarClock, ClipboardCopy, Plus, Trash2 } from "lucide-react";
import { REC_LEAD_DAYS, REC_ROLES, REC_STATUSES, type RecRole, type RecStatus } from "@shared/admissions";
import { daysTo, longDate } from "@shared/examDates";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useNotify } from "@/components/Notify";
import { ErrorBox, Loading } from "@/components/Page";
import { Badge, Card, Empty } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Recommendation tracker: who writes, by when, and a brag sheet the student prepares for them.
// The platform never writes the letter: it only helps the student give the recommender facts.

interface Rec {
  id: string;
  name: string;
  role: RecRole;
  subject: string;
  status: RecStatus;
  due: string | null;
  asked_at: number | null;
  notes: string;
}

interface Activity {
  position: string;
  organization: string;
  description: string;
}

const BRAG = [
  "Какие 2–3 момента на ваших уроках мне особенно запомнились (проект, вопрос, спор, ошибка, которую я исправил):",
  "Чем я горжусь за последние два года и почему:",
  "Куда и на что я подаюсь, и почему именно туда:",
  "Что важного обо мне учитель может не знать (семья, работа, обязанности, трудности):",
  "Качества, которые, как мне кажется, вы видели во мне (с примером):",
];

function bragSheet(rec: Rec, activities: Activity[]) {
  const acts = activities.length ? activities.map((a) => `• ${[a.position, a.organization].filter(Boolean).join(", ")}: ${a.description}`).join("\n") : "• (добавь активности во вкладке «Портфолио»)";
  return [
    `Brag sheet для ${rec.name}${rec.subject ? ` (${rec.subject})` : ""}`,
    rec.due ? `Срок рекомендации: ${longDate(rec.due)}` : "",
    "",
    "Мои активности:",
    acts,
    "",
    ...BRAG.flatMap((q) => [q, "", ""]),
    "Спасибо, что согласились написать рекомендацию!",
  ]
    .filter((l, i, all) => !(l === "" && all[i - 1] === "" && all[i - 2] === ""))
    .join("\n");
}

export default function Recs() {
  const { data, error, loading, reload, setData } = useApi<Rec[]>("/admissions/recs");
  const activities = useApi<Activity[]>("/admissions/activities");
  const notify = useNotify();
  const [form, setForm] = useState({ name: "", role: "teacher" as RecRole, subject: "", due: "" });
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api("/admissions/recs", { body: form });
      setForm({ name: "", role: form.role, subject: "", due: "" });
      await reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  async function patch(rec: Rec, change: Partial<Rec>) {
    setData((list) => list?.map((r) => (r.id === rec.id ? { ...r, ...change } : r)) ?? null);
    try {
      const saved = await api<Rec>(`/admissions/recs/${rec.id}`, { method: "PATCH", body: change });
      if (change.status === "submitted" && rec.status !== "submitted") notify({ variant: "success", title: "Рекомендация ушла 🫶", body: `${rec.name}: +10 XP. Не забудь сказать спасибо.` });
      setData((list) => list?.map((r) => (r.id === rec.id ? saved : r)) ?? null);
    } catch (x) {
      setErr((x as Error).message);
      void reload();
    }
  }

  async function remove(rec: Rec) {
    await api(`/admissions/recs/${rec.id}`, { method: "DELETE" });
    await reload();
  }

  async function copy(rec: Rec) {
    await navigator.clipboard.writeText(bragSheet(rec, activities.data ?? []));
    notify({ variant: "success", title: "Brag sheet скопирован", body: "Заполни ответы своими словами и отправь рекомендателю." });
  }

  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl border border-primary/25 bg-primary/5 p-4 text-sm">
          <b>Как это работает.</b> Попроси лично и минимум за 4 недели до срока, потом отправь приглашение в Common App или UCAS и дай рекомендателю brag sheet — короткую памятку о себе. Текст письма пишет только рекомендатель. В Common App 1 августа приглашения рекомендателям обнуляются: всё, что отправлено до этой даты, придётся отправить заново.
        </div>
        {data.length === 0 ? (
          <Empty title="Пока никого 🤝">Обычно нужно 2 учителя и школьный консультант. Добавь их справа — я напомню о сроках.</Empty>
        ) : (
          data.map((r) => {
            const days = r.due ? daysTo(r.due) : null;
            const late = days !== null && r.status === "idea" && days < REC_LEAD_DAYS;
            return (
              <Card key={r.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{[REC_ROLES[r.role], r.subject].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={r.status === "submitted" ? "ok" : r.status === "idea" ? "soft" : "warn"}>
                      {REC_STATUSES[r.status].emoji} {REC_STATUSES[r.status].label}
                    </Badge>
                    <button type="button" onClick={() => remove(r)} aria-label={`Убрать ${r.name}`} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <CalendarClock className="size-4 text-primary" />
                  {r.due ? (
                    <span className={cn("font-semibold", days !== null && days <= 7 && r.status !== "submitted" && "text-destructive")}>
                      срок {longDate(r.due)} · {days !== null && days >= 0 ? `${days} дн.` : "прошёл"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">срок не указан — обычно это дедлайн заявки</span>
                  )}
                  <input type="date" aria-label="Срок" value={r.due ?? ""} onChange={(e) => patch(r, { due: e.target.value || null })} className="ml-auto h-9 rounded-xl border border-border bg-card px-2 text-sm" />
                </div>
                {late && <p className="rounded-2xl bg-[#fff4e0] px-3 py-2 text-xs text-[#7a4300]">До срока меньше 4 недель, а ты ещё не попросил. Сделай это на этой неделе — учителям нужно время.</p>}
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Статус">
                  {(Object.keys(REC_STATUSES) as RecStatus[]).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={r.status === k} onClick={() => patch(r, { status: k })} className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", r.status === k ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                      {REC_STATUSES[k].emoji} {REC_STATUSES[k].label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    {open === r.id ? "Скрыть памятку" : "Что попросить выделить"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copy(r)}>
                    <ClipboardCopy /> Скопировать brag sheet
                  </Button>
                </div>
                {open === r.id && (
                  <textarea
                    aria-label="Памятка для рекомендателя"
                    defaultValue={r.notes}
                    onBlur={(e) => e.target.value !== r.notes && patch(r, { notes: e.target.value })}
                    placeholder="Что важно, чтобы этот человек упомянул: конкретный проект, рост, случай на уроке. Это твои заметки — их увидишь только ты."
                    className="min-h-[100px] rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-primary"
                  />
                )}
              </Card>
            );
          })
        )}
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <form onSubmit={add} className="flex flex-col gap-3">
            <p className="font-display text-lg font-bold">Добавить рекомендателя</p>
            <Input aria-label="Имя" placeholder="Имя и фамилия" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select aria-label="Кто" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as RecRole })}>
              {(Object.keys(REC_ROLES) as RecRole[]).map((k) => (
                <option key={k} value={k}>
                  {REC_ROLES[k]}
                </option>
              ))}
            </Select>
            <Input aria-label="Предмет" placeholder="Предмет (для учителя)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <input type="date" aria-label="Срок" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className="h-10 rounded-xl border border-border bg-card px-3 text-sm" />
            <ErrorBox message={err} />
            <Button disabled={!form.name.trim()}>
              <Plus /> Добавить
            </Button>
          </form>
        </Card>
        <Card className="text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 font-display text-sm font-bold text-foreground">Кого просить</p>
          США: обычно 2 учителя профильных предметов 11–12 класса и школьный консультант. UCAS: одна рекомендация (reference) от школы. Выбирай тех, кто видел тебя в деле, а не тех, у кого самая высокая оценка.
        </Card>
      </aside>
    </div>
  );
}
