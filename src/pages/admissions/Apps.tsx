import { useState, type FormEvent } from "react";
import { CalendarClock, Check, Plus, Trash2 } from "lucide-react";
import { daysTo, longDate } from "@shared/examDates";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useNotify } from "@/components/Notify";
import { ErrorBox, Loading } from "@/components/Page";
import { Badge, Card, Empty } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// The application tracker: universities with their system, deadline, status pipeline and checklist.

export interface AppItem {
  id: string;
  name: string;
  country: string;
  program: string;
  system: string;
  deadline: string | null;
  status: string;
  checklist: { id: string; label: string; done: boolean }[];
  notes: string;
  tier: string | null;
}

export const SYSTEMS: Record<string, { label: string; hint: string }> = {
  "us-ed": { label: "США · Early Decision", hint: "обязывающее решение; дедлайн обычно 1 или 15 ноября. 1 августа Common App обнуляет рекомендателей и supplements" },
  "us-ea": { label: "США · Early Action", hint: "необязывающее; обычно 1 или 15 ноября. 1 августа Common App обнуляет рекомендателей и supplements" },
  "us-rd": { label: "США · Regular Decision", hint: "обычно 1–15 января; время дедлайна — по времени вуза" },
  ucas: { label: "Великобритания · UCAS", hint: "основной срок — январь, 18:00 по UK = 23:00 по Астане; Оксфорд, Кембридж и медицина — 15 октября" },
  eu: { label: "Европа", hint: "у каждого вуза свои сроки, часто январь–май" },
  asia: { label: "Азия", hint: "сроки зависят от страны и вуза" },
  kz: { label: "Казахстан", hint: "NU и другие вузы — уточняй сроки на сайте вуза" },
  other: { label: "Другое", hint: "впиши дедлайн с сайта вуза" },
};

const STATUS: Record<string, { label: string; emoji: string; tone: "soft" | "brand" | "ok" | "warn" | "bad" }> = {
  idea: { label: "в списке", emoji: "💭", tone: "soft" },
  preparing: { label: "готовлю", emoji: "🛠️", tone: "brand" },
  submitted: { label: "подал", emoji: "📨", tone: "warn" },
  admitted: { label: "поступил!", emoji: "🎉", tone: "ok" },
  waitlist: { label: "waitlist", emoji: "⏳", tone: "warn" },
  rejected: { label: "отказ", emoji: "🫠", tone: "bad" },
};

const TIERS: Record<string, string> = { reach: "🚀 reach", target: "🎯 target", likely: "✅ likely" };

const AFFIRM =
  "Перед отправкой: подтверждаешь, что эссе и ответы написаны тобой, а ИИ использовался только для вопросов и отзывов? Common App считает выдачу текста ИИ за свой обманом.";

const QUICK: { name: string; country: string; system: string }[] = [
  { name: "Nazarbayev University", country: "Казахстан", system: "kz" },
  { name: "NYU Abu Dhabi", country: "ОАЭ", system: "us-rd" },
  { name: "Purdue University", country: "США", system: "us-ea" },
  { name: "University of Toronto", country: "Канада", system: "other" },
  { name: "University College London", country: "Великобритания", system: "ucas" },
  { name: "TU Munich", country: "Германия", system: "eu" },
  { name: "KAIST", country: "Южная Корея", system: "asia" },
  { name: "Bocconi University", country: "Италия", system: "eu" },
];

export default function Apps() {
  const { data, error, loading, reload, setData } = useApi<AppItem[]>("/admissions/apps");
  const notify = useNotify();
  const [form, setForm] = useState({ name: "", country: "", system: "us-rd", deadline: "" });
  const [err, setErr] = useState("");

  async function add(e?: FormEvent, preset?: (typeof QUICK)[number]) {
    e?.preventDefault();
    setErr("");
    const body = preset ? { ...preset, deadline: "" } : form;
    try {
      await api("/admissions/apps", { body });
      setForm({ name: "", country: "", system: form.system, deadline: "" });
      await reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  async function patch(app: AppItem, change: Partial<AppItem>) {
    if (change.status === "submitted" && app.status !== "submitted" && !window.confirm(AFFIRM)) return;
    setData((list) => list?.map((a) => (a.id === app.id ? { ...a, ...change } : a)) ?? null);
    try {
      const saved = await api<AppItem>(`/admissions/apps/${app.id}`, { method: "PATCH", body: change });
      if (change.status === "submitted" && app.status !== "submitted") notify({ variant: "success", title: "Заявка отправлена — это база 💅", body: `${app.name}: +30 XP, растение подросло.` });
      if (change.status === "admitted") notify({ variant: "success", title: "ПОСТУПИЛ?! 🎉🎉🎉", body: `${app.name} — ты легенда.` });
      setData((list) => list?.map((a) => (a.id === app.id ? saved : a)) ?? null);
    } catch (x) {
      setErr((x as Error).message);
      void reload();
    }
  }

  async function remove(app: AppItem) {
    await api(`/admissions/apps/${app.id}`, { method: "DELETE" });
    await reload();
  }

  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const submitted = data.filter((a) => ["submitted", "admitted", "waitlist", "rejected"].includes(a.status)).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        {data.length === 0 ? (
          <Empty title="Список вузов пока пуст 👀">Добавь вузы справа — я соберу для каждого чек-лист и буду считать дни до дедлайна.</Empty>
        ) : (
          data.map((a) => {
            const done = a.checklist.filter((c) => c.done).length;
            const days = a.deadline ? daysTo(a.deadline) : null;
            return (
              <Card key={a.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[a.country, SYSTEMS[a.system]?.label].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS[a.status]?.tone ?? "soft"}>
                      {STATUS[a.status]?.emoji} {STATUS[a.status]?.label}
                    </Badge>
                    <button type="button" onClick={() => remove(a)} aria-label={`Убрать ${a.name}`} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <CalendarClock className="size-4 text-primary" />
                  {a.deadline ? (
                    <span className={cn("font-semibold", days !== null && days >= 0 && days <= 14 && "text-destructive")}>
                      дедлайн {longDate(a.deadline)} · {days !== null && days >= 0 ? `${days} дн.` : "прошёл"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">дедлайн не указан — {SYSTEMS[a.system]?.hint}</span>
                  )}
                  <input type="date" aria-label="Дедлайн" value={a.deadline ?? ""} onChange={(e) => patch(a, { deadline: e.target.value || null })} className="ml-auto h-9 rounded-xl border border-border bg-card px-2 text-sm" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Шансы">
                  <span className="text-xs text-muted-foreground">шансы:</span>
                  {Object.entries(TIERS).map(([k, v]) => (
                    <button key={k} type="button" role="radio" aria-checked={a.tier === k} onClick={() => patch(a, { tier: a.tier === k ? null : k })} className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", a.tier === k ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                      {v}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Статус">
                  {Object.entries(STATUS).map(([k, v]) => (
                    <button key={k} type="button" role="radio" aria-checked={a.status === k} onClick={() => patch(a, { status: k })} className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", a.status === k ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                      {v.emoji} {v.label}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>чек-лист</span>
                    <span>
                      {done}/{a.checklist.length}
                    </span>
                  </div>
                  <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(done / Math.max(1, a.checklist.length)) * 100}%` }} />
                  </div>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {a.checklist.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => patch(a, { checklist: a.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted">
                          <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border-2", c.done ? "border-primary bg-primary text-white" : "border-border")}>{c.done && <Check className="size-3.5" />}</span>
                          <span className={cn(c.done && "text-muted-foreground line-through")}>{c.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        <Card className="flex flex-col gap-1">
          <p className="font-display text-lg font-bold">Твой счёт</p>
          <p className="text-sm text-muted-foreground">
            вузов в списке: <b className="text-foreground">{data.length}</b> · заявок отправлено: <b className="text-foreground">{submitted}</b>
          </p>
          <p className="text-xs text-muted-foreground">Каждая отправленная заявка = +30 XP для твоего растения 🌱</p>
          <p className="text-xs text-muted-foreground">
            баланс: {["reach", "target", "likely"].map((t) => `${TIERS[t]} ${data.filter((a) => a.tier === t).length}`).join(" · ")}
          </p>
        </Card>
        <Card>
          <form onSubmit={add} className="flex flex-col gap-3">
            <p className="font-display text-lg font-bold">Добавить вуз</p>
            <Input aria-label="Вуз или программа" placeholder="Вуз или программа" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input aria-label="Страна" placeholder="Страна" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            <Select aria-label="Система подачи" value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value })}>
              {Object.entries(SYSTEMS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{SYSTEMS[form.system]?.hint}</p>
            <input type="date" aria-label="Дедлайн" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="h-10 rounded-xl border border-border bg-card px-3 text-sm" />
            <ErrorBox message={err} />
            <Button disabled={!form.name.trim()}>
              <Plus /> Добавить
            </Button>
          </form>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">популярное у наших</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK.filter((q) => !data.some((a) => a.name === q.name)).map((q) => (
              <button key={q.name} type="button" onClick={() => add(undefined, q)} className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold hover:border-primary hover:text-primary">
                + {q.name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Дедлайны меняются каждый год — сверяй их на сайте вуза.</p>
        </Card>
      </aside>
    </div>
  );
}
