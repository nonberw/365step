import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock, MapPin, Users, Video, X } from "lucide-react";
import type { ConsultSlot } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { ART, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, GreetingBanner, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Empty, Progress, Segmented } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { BookingTicket, timeOf } from "@/components/ui/booking-ticket";
import { BookingWeekStrip, dayKeyOf, startOfDay } from "@/components/ui/booking-week-strip";

type Kind = "all" | "lesson" | "consultation";

export default function Consult() {
  const slots = useApi<ConsultSlot[]>("/consult");
  const mine = useApi<ConsultSlot[]>("/consult/mine");
  const [kind, setKind] = useState<Kind>("all");
  const [subject, setSubject] = useState("");
  const [day, setDay] = useState<Date | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  const filtered = useMemo(() => (slots.data ?? []).filter((s) => (kind === "all" || s.kind === kind) && (!subject || s.subject === subject)), [slots.data, kind, subject]);
  const subjects = useMemo(() => [...new Set((slots.data ?? []).map((s) => s.subject).filter(Boolean))].sort(), [slots.data]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of filtered) m.set(dayKeyOf(s.startsAt), (m.get(dayKeyOf(s.startsAt)) ?? 0) + 1);
    return m;
  }, [filtered]);
  // Until the student picks a day, show the first day that has sessions.
  const selected = day ?? (filtered[0] ? startOfDay(filtered[0].startsAt) : startOfDay(new Date()));
  const ofDay = filtered.filter((s) => dayKeyOf(s.startsAt) === dayKeyOf(selected));
  const nextOther = !ofDay.length ? filtered.find((s) => s.startsAt > selected.getTime()) : undefined;
  const upcomingMine = (mine.data ?? []).filter((s) => s.startsAt + s.durationMin * 60_000 > Date.now());

  const booked = (s: ConsultSlot) => {
    setFresh(s.id);
    slots.setData((list) => list?.map((x) => (x.id === s.id ? s : x)) ?? null);
    mine.setData((list) => [...(list ?? []).filter((x) => x.id !== s.id), s].sort((a, b) => a.startsAt - b.startsAt));
  };

  async function unbook(s: ConsultSlot) {
    if (!confirm(`Отменить запись на «${s.title}»?`)) return;
    await api(`/consult/${s.id}/book`, { method: "DELETE" });
    mine.setData((list) => list?.filter((x) => x.id !== s.id) ?? null);
    slots.setData((list) => list?.map((x) => (x.id === s.id ? { ...x, mine: false, booked: x.booked - 1 } : x)) ?? null);
  }

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner title="Доп. уроки и консультации" subtitle="Учителя открывают время для дополнительных занятий и личных консультаций. Выбери день, запишись в один клик и добавь встречу в свой календарь." image={ART.painting} position="center 40%" />

      {upcomingMine.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">Мои записи</h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AnimatePresence initial={false}>
              {upcomingMine.map((s) => (
                <motion.div key={s.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
                  <BookingTicket
                    slot={s}
                    stamp={fresh === s.id}
                    actions={
                      !s.cancelled && (
                        <button type="button" onClick={() => unbook(s)} className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-4 text-[13px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
                          <X className="size-3.5" /> Отменить запись
                        </button>
                      )
                    }
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-semibold">Расписание</h2>
          <div className="flex flex-wrap gap-2">
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "Все" },
                { value: "lesson", label: "Доп. уроки" },
                { value: "consultation", label: "Консультации" },
              ]}
            />
            {subjects.length > 0 && (
              <Select aria-label="Предмет" className="h-9 w-auto text-xs" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">Все предметы</option>
                {subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </div>
        </div>

        {slots.loading ? (
          <Loading />
        ) : slots.error ? (
          <ErrorBox message={slots.error} />
        ) : !filtered.length ? (
          <Empty title="Пока нет открытых занятий">Когда учителя откроют время для доп. уроков и консультаций, оно появится здесь.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <BookingWeekStrip key={filtered[0]?.id} selected={selected} onSelect={setDay} counts={counts} className="xl:sticky xl:top-4 xl:self-start" />
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium capitalize text-muted-foreground">{selected.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</p>
              <AnimatePresence mode="popLayout" initial={false}>
                {ofDay.map((s, i) => (
                  <motion.div key={s.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }} exit={{ opacity: 0 }}>
                    <SlotCard slot={s} onBooked={booked} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {!ofDay.length && (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  В этот день занятий нет.
                  {nextOther && (
                    <button type="button" className="ml-1 font-semibold text-primary hover:underline" onClick={() => setDay(startOfDay(nextOther.startsAt))}>
                      Ближайшее — {new Date(nextOther.startsAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SlotCard({ slot, onBooked }: { slot: ConsultSlot; onBooked: (s: ConsultSlot) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const left = slot.capacity - slot.booked;
  const full = left <= 0 && !slot.mine;

  async function book() {
    setBusy(true);
    setError("");
    try {
      onBooked(await api<ConsultSlot>(`/consult/${slot.id}/book`, { body: { note } }));
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card transition-colors", slot.mine ? "border-primary" : "border-border hover:border-foreground/25")}>
      <div className="flex gap-4 p-4">
        <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-muted py-2">
          <span className="font-display text-lg font-bold tabular-nums">{timeOf(slot.startsAt)}</span>
          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
            <Clock className="size-3" /> {slot.durationMin} мин
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={slot.kind === "lesson" ? "dark" : "brand"}>{slot.kind === "lesson" ? "Доп. урок" : "Консультация"}</Badge>
            {slot.subject && <Badge tone="soft">{slot.subject}</Badge>}
            {slot.mine && <Badge tone="ok">ты записан(а)</Badge>}
          </div>
          <h3 className="mt-1.5 font-display text-base font-semibold leading-snug">{slot.title}</h3>
          <p className="text-sm text-muted-foreground">{slot.teacher}</p>
          {slot.description && <p className="mt-1 text-sm text-muted-foreground">{slot.description}</p>}
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {slot.place && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {slot.place}
              </span>
            )}
            {slot.onlineUrl && (
              <span className="inline-flex items-center gap-1">
                <Video className="size-3.5" /> онлайн
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {slot.capacity === 1 ? (left > 0 ? "индивидуально, свободно" : "индивидуально, занято") : `${slot.booked} из ${slot.capacity}, ${left > 0 ? `${left} ${plural(left, "место", "места", "мест")}` : "мест нет"}`}
            </span>
          </p>
          {slot.capacity > 1 && <Progress value={(slot.booked / slot.capacity) * 100} tone={left > 0 ? "brand" : "accent"} className="mt-2 max-w-60" />}
        </div>
        <div className="hidden shrink-0 self-center sm:block">
          {!slot.mine && (
            <Button size="sm" disabled={full} onClick={() => setOpen(!open)} variant={open ? "outline" : "default"}>
              {full ? "Мест нет" : open ? "Закрыть" : "Записаться"}
            </Button>
          )}
        </div>
      </div>
      {!slot.mine && (
        <div className="px-4 pb-4 sm:hidden">
          <Button size="sm" className="w-full" disabled={full} onClick={() => setOpen(!open)} variant={open ? "outline" : "default"}>
            {full ? "Мест нет" : open ? "Закрыть" : "Записаться"}
          </Button>
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }} className="overflow-hidden border-t border-border bg-muted/40">
            <div className="flex flex-col gap-2 p-4">
              <label htmlFor={`note-${slot.id}`} className="text-sm font-medium">
                Что хочешь разобрать? <span className="font-normal text-muted-foreground">(необязательно, учитель увидит заранее)</span>
              </label>
              <Textarea id={`note-${slot.id}`} rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Например: задачи на КПД из домашки" />
              <ErrorBox message={error} />
              <Button onClick={book} disabled={busy} className="self-start">
                {busy ? "Записываю…" : `Подтвердить · ${timeOf(slot.startsAt)}`}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
