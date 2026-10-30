import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, MapPin, MessageSquareText, Repeat, Trash2, Users, Video } from "lucide-react";
import type { ConsultKind, ConsultSlot } from "@shared/types";
import { SUBJECTS } from "@shared/textbooks";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { ART, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, GreetingBanner, Loading, Stat } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Empty, Progress, Segmented } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { timeOf } from "@/components/ui/booking-ticket";

interface Data {
  classes: { code: string; name: string }[];
  slots: ConsultSlot[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function TeacherConsult() {
  const { data, error, loading, reload } = useApi<Data>("/consult/teacher");
  const now = Date.now();
  const upcoming = (data?.slots ?? []).filter((s) => s.startsAt + s.durationMin * 60_000 > now);
  const past = (data?.slots ?? []).filter((s) => s.startsAt + s.durationMin * 60_000 <= now).reverse();
  const byDay = useMemo(() => {
    const m = new Map<string, ConsultSlot[]>();
    for (const s of upcoming) {
      const k = new Date(s.startsAt).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m];
  }, [upcoming]);
  const signed = upcoming.filter((s) => !s.cancelled).reduce((n, s) => n + s.booked, 0);

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner title="Доп. уроки и консультации" subtitle="Откройте время для дополнительных занятий или личных консультаций. Ученики увидят его в расписании, запишутся и заранее напишут, что хотят разобрать." image={ART.painting} position="center 40%" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Впереди занятий" value={upcoming.filter((s) => !s.cancelled).length} />
        <Stat label="Записалось учеников" value={signed} />
        <Stat label="Свободных мест" value={upcoming.filter((s) => !s.cancelled).reduce((n, s) => n + Math.max(0, s.capacity - s.booked), 0)} className="col-span-2 md:col-span-1" />
      </div>
      <CreateSlot classes={data?.classes ?? []} onCreated={reload} />
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold">Расписание</h2>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox message={error} />
        ) : !upcoming.length ? (
          <Empty title="Пока ничего не запланировано">Создайте первый доп. урок или окно для консультаций — форма выше.</Empty>
        ) : (
          byDay.map(([label, list]) => (
            <div key={label} className="flex flex-col gap-2">
              <p className="text-sm font-semibold capitalize text-muted-foreground">{label}</p>
              <AnimatePresence initial={false}>
                {list.map((s) => (
                  <motion.div key={s.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                    <TeacherSlot slot={s} onChange={reload} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))
        )}
        {past.length > 0 && (
          <details className="rounded-2xl border border-border p-4">
            <summary className="cursor-pointer font-display font-semibold">Прошедшие за 2 недели · {past.length}</summary>
            <div className="mt-3 flex flex-col gap-2">
              {past.map((s) => (
                <TeacherSlot key={s.id} slot={s} onChange={reload} done />
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}

function CreateSlot({ classes, onCreated }: { classes: { code: string; name: string }[]; onCreated: () => void }) {
  const [kind, setKind] = useState<ConsultKind>("consultation");
  const [form, setForm] = useState({ title: "", subject: "", description: "", date: isoDay(1), time: "15:00", durationMin: "20", capacity: "1", place: "", onlineUrl: "", classCode: "", repeatWeeks: "0" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const switchKind = (k: ConsultKind) => {
    setKind(k);
    setForm((f) => ({ ...f, durationMin: k === "lesson" ? "45" : "20", capacity: k === "lesson" ? "15" : "1" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone("");
    try {
      const startsAt = new Date(`${form.date}T${form.time}`).getTime();
      const r = await api<{ created: number }>("/consult/teacher", { body: { ...form, kind, startsAt, durationMin: Number(form.durationMin), capacity: Number(form.capacity), repeatWeeks: Number(form.repeatWeeks) } });
      setDone(r.created > 1 ? `Создано ${r.created} ${plural(r.created, "занятие", "занятия", "занятий")} — каждую неделю` : "Занятие создано, ученики уже видят его в расписании");
      setForm((f) => ({ ...f, title: "", description: "" }));
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" /> Открыть время
          </CardTitle>
          <Segmented
            value={kind}
            onChange={switchKind}
            options={[
              { value: "consultation", label: "Консультация" },
              { value: "lesson", label: "Доп. урок" },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
          <Field label="Тема" htmlFor="c-title">
            <Input id="c-title" value={form.title} onChange={set("title")} placeholder={kind === "lesson" ? "Подготовка к SAT Math: функции" : "Разбор контрольной и вопросы по теме"} required />
          </Field>
          <Field label="Предмет" htmlFor="c-subject">
            <Input id="c-subject" list="c-subjects" value={form.subject} onChange={set("subject")} placeholder="Физика" />
            <datalist id="c-subjects">
              {[...SUBJECTS, "SAT", "IELTS"].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Field label="Дата" htmlFor="c-date">
            <Input id="c-date" type="date" min={isoDay()} value={form.date} onChange={set("date")} required />
          </Field>
          <Field label="Время" htmlFor="c-time">
            <Input id="c-time" type="time" step={300} value={form.time} onChange={set("time")} required />
          </Field>
          <Field label="Минут" htmlFor="c-dur">
            <Input id="c-dur" type="number" min={10} max={240} step={5} value={form.durationMin} onChange={set("durationMin")} />
          </Field>
          <Field label="Мест" htmlFor="c-cap" hint={kind === "consultation" ? "1 — личная" : undefined}>
            <Input id="c-cap" type="number" min={1} max={200} value={form.capacity} onChange={set("capacity")} />
          </Field>
          <Field label="Повтор" htmlFor="c-rep" className="col-span-2 md:col-span-1">
            <Select id="c-rep" value={form.repeatWeeks} onChange={set("repeatWeeks")}>
              <option value="0">Один раз</option>
              {[1, 3, 5, 7, 11].map((n) => (
                <option key={n} value={n}>
                  Каждую неделю, {n + 1} раз
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Кабинет" htmlFor="c-place">
            <Input id="c-place" value={form.place} onChange={set("place")} placeholder="Каб. 204, корпус 1" />
          </Field>
          <Field label="Ссылка на онлайн-встречу" htmlFor="c-url" hint="Необязательно">
            <Input id="c-url" type="url" value={form.onlineUrl} onChange={set("onlineUrl")} placeholder="https://meet.google.com/…" />
          </Field>
          <Field label="Для кого" htmlFor="c-class">
            <Select id="c-class" value={form.classCode} onChange={set("classCode")}>
              <option value="">Все ученики школы</option>
              {classes.map((c) => (
                <option key={c.code} value={c.code}>
                  Только {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Описание" htmlFor="c-desc" hint="Что принести, к чему подготовиться">
          <Textarea id="c-desc" rows={2} value={form.description} onChange={set("description")} />
        </Field>
        <ErrorBox message={error} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Создаю…" : "Открыть запись"}
          </Button>
          <AnimatePresence>
            {done && (
              <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-sm font-medium text-success">
                {done}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </form>
    </Card>
  );
}

function TeacherSlot({ slot, onChange, done }: { slot: ConsultSlot; onChange: () => void; done?: boolean }) {
  const [open, setOpen] = useState(slot.booked > 0 && !done);
  const people = slot.attendees ?? [];

  async function cancel(series: boolean) {
    const msg = series ? "Отменить это и все следующие занятия серии? Записавшиеся ученики увидят отмену." : people.length ? `Отменить? ${people.length} ${plural(people.length, "ученик увидит", "ученика увидят", "учеников увидят")} отмену в своих записях.` : "Отменить занятие?";
    if (!confirm(msg)) return;
    await api(`/consult/teacher/${slot.id}/cancel`, { body: { series } });
    onChange();
  }

  async function remove() {
    if (!confirm("Удалить занятие вместе с записями?")) return;
    await api(`/consult/teacher/${slot.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card", slot.cancelled && "opacity-60")}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 p-4 text-left">
        <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-muted py-2">
          <span className="font-display text-lg font-bold tabular-nums">{timeOf(slot.startsAt)}</span>
          <span className="text-[11px] text-muted-foreground">{slot.durationMin} мин</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={slot.kind === "lesson" ? "dark" : "brand"}>{slot.kind === "lesson" ? "Доп. урок" : "Консультация"}</Badge>
            {slot.subject && <Badge tone="soft">{slot.subject}</Badge>}
            {slot.seriesId && (
              <Badge tone="soft">
                <Repeat className="size-3" /> еженедельно
              </Badge>
            )}
            {slot.cancelled && <Badge tone="bad">отменено</Badge>}
            {slot.classCode && <Badge tone="soft">{slot.classCode}</Badge>}
          </div>
          <p className="mt-1 truncate font-display font-semibold">{slot.title}</p>
          <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {slot.place && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {slot.place}
              </span>
            )}
            {slot.onlineUrl && (
              <span className="inline-flex items-center gap-1">
                <Video className="size-3" /> онлайн
              </span>
            )}
          </p>
        </div>
        <div className="w-28 shrink-0 text-right">
          <span className="inline-flex items-center gap-1 font-display text-sm font-semibold tabular-nums">
            <Users className="size-4" /> {slot.booked}/{slot.capacity}
          </span>
          <Progress value={(slot.booked / slot.capacity) * 100} tone={slot.booked >= slot.capacity ? "accent" : "brand"} className="mt-1.5" />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="flex flex-col gap-3 border-t border-border p-4">
              {people.length ? (
                <ul className="flex flex-col gap-2">
                  {people.map((p) => (
                    <li key={p.id} className="flex items-start gap-3 rounded-xl bg-muted/60 px-3 py-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
                        {p.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">
                          {p.name} {p.grade && <span className="text-muted-foreground">· {p.grade}</span>}
                        </p>
                        {p.note && (
                          <p className="flex items-start gap-1 text-muted-foreground">
                            <MessageSquareText className="mt-0.5 size-3.5 shrink-0" /> {p.note}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Пока никто не записался.</p>
              )}
              {slot.description && <p className="text-sm text-muted-foreground">{slot.description}</p>}
              <div className="flex flex-wrap gap-2">
                {!slot.cancelled && !done && (
                  <Button variant="outline" size="sm" onClick={() => cancel(false)}>
                    Отменить
                  </Button>
                )}
                {!slot.cancelled && !done && slot.seriesId && (
                  <Button variant="outline" size="sm" onClick={() => cancel(true)}>
                    Отменить серию
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
                  <Trash2 /> Удалить
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
