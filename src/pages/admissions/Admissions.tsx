import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bookmark, CalendarDays, GraduationCap, Search, Trophy } from "lucide-react";
import { OPPORTUNITIES, type Opportunity } from "@shared/opportunities";
import { useSearchParams } from "react-router-dom";
import { GreetingBanner } from "@/components/Page";
import Apps from "./Apps";
import Essays from "./Essays";
import Portfolio from "./Portfolio";
import { Badge, Card, Empty, Segmented } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const FIELDS = { stem: "Наука и STEM", it: "IT и технологии", humanities: "Гуманитарные", business: "Бизнес", arts: "Творчество", general: "Разные направления" } as const;
const REGIONS = { international: "Международные", kazakhstan: "Казахстан", usa: "США", europe: "Европа", asia: "Азия" } as const;
const COSTS = { free: "Бесплатно", paid: "Платно", mixed: "Есть стипендии / разные условия" } as const;

const dateLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

const SAVED_KEY = "nc-saved-opportunities";

function loadSaved(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const selectClass = "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:outline-2 focus:outline-primary";

export function Catalog() {
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "competition" | "program">("all");
  const [field, setField] = useState("all");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("upcoming");
  const [free, setFree] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>(loadSaved);
  const [limit, setLimit] = useState(12);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {
      // per-viewer convenience only
    }
  }, [saved]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return OPPORTUNITIES.filter((o) => {
      const past = !!o.deadline && o.deadline < today;
      const future = !!o.deadline && o.deadline >= today;
      return (
        (kind === "all" || o.kind === kind) &&
        (field === "all" || o.field === field) &&
        (region === "all" || o.region === region) &&
        (!free || o.cost === "free") &&
        (!savedOnly || saved.includes(o.id)) &&
        (status === "all" || (status === "upcoming" && (future || o.rolling)) || (status === "month" && future && daysBetween(today, o.deadline!) <= 30) || (status === "unannounced" && !o.deadline && !o.rolling) || (status === "past" && past)) &&
        (!q || [o.title, o.organizer, o.description, o.eligibility, ...o.tags].join(" ").toLowerCase().includes(q))
      );
    }).sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  }, [query, kind, field, region, status, free, savedOnly, saved, today]);

  const reset = () => {
    setQuery("");
    setKind("all");
    setField("all");
    setRegion("all");
    setStatus("upcoming");
    setFree(false);
    setSavedOnly(false);
  };

  const available = OPPORTUNITIES.filter((o) => o.rolling || (o.deadline && o.deadline >= today)).length;

  return (
    <div className="flex flex-col gap-6">

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [Trophy, "Возможностей в каталоге", OPPORTUNITIES.length],
          [CalendarDays, "Срок впереди или набор без даты", available],
          [GraduationCap, "Бесплатных вариантов", OPPORTUNITIES.filter((o) => o.cost === "free").length],
        ].map(([Icon, label, count]) => {
          const I = Icon as typeof Trophy;
          return (
            <Card key={String(label)} className="flex items-center gap-3 p-4">
              <I className="size-5 text-primary" />
              <div>
                <p className="tabular font-display text-xl font-semibold">{String(count)}</p>
                <p className="text-xs text-muted-foreground">{String(label)}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 flex-1">
            <Search aria-hidden className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input aria-label="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название, направление, возраст…" className="pl-9" />
          </div>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Все" },
              { value: "competition", label: "Конкурсы" },
              { value: "program", label: "Программы" },
            ]}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <select aria-label="Направление" value={field} onChange={(e) => setField(e.target.value)} className={selectClass}>
            <option value="all">Все направления</option>
            {Object.entries(FIELDS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select aria-label="География" value={region} onChange={(e) => setRegion(e.target.value)} className={selectClass}>
            <option value="all">Все страны</option>
            {Object.entries(REGIONS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select aria-label="Дедлайн" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            <option value="upcoming">Срок впереди / постоянный набор</option>
            <option value="all">Все сроки</option>
            <option value="month">В ближайшие 30 дней</option>
            <option value="unannounced">Ждём даты нового набора</option>
            <option value="past">Прошедшие сроки</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="accent-[var(--primary)]" />
            Только бесплатные
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} className="accent-[var(--primary)]" />
            Избранное ({saved.length})
          </label>
          <button type="button" onClick={reset} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground">
            Сбросить
          </button>
        </div>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground" role="status">
        Найдено: <span className="font-semibold text-foreground">{results.length}</span> · сначала ближайшие дедлайны · данные проверены 17 октября 2026. Если новый набор не объявлен, так и написано. Перед подачей перепроверьте условия, взносы и часовой пояс на сайте организатора.
      </p>

      {results.length === 0 ? (
        <Empty title="Пока ничего не найдено">Попробуйте другое слово или уберите часть фильтров.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {results.slice(0, limit).map((o) => (
            <OpportunityCard key={o.id} o={o} today={today} saved={saved.includes(o.id)} onToggle={() => setSaved((s) => (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]))} />
          ))}
        </div>
      )}
      {results.length > limit && (
        <button type="button" className={cn(buttonVariants({ variant: "outline" }), "self-center")} onClick={() => setLimit((n) => n + 12)}>
          Показать ещё · осталось {results.length - limit}
        </button>
      )}
    </div>
  );
}

function OpportunityCard({ o, today, saved, onToggle }: { o: Opportunity; today: string; saved: boolean; onToggle: () => void }) {
  const past = !!o.deadline && o.deadline < today;
  const days = o.deadline ? daysBetween(today, o.deadline) : null;
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{o.kind === "competition" ? "Конкурс" : "Программа"}</Badge>
          <Badge tone="brand">{FIELDS[o.field]}</Badge>
        </div>
        <button type="button" onClick={onToggle} aria-pressed={saved} aria-label={`${saved ? "Убрать из избранного" : "В избранное"}: ${o.title}`} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary">
          <Bookmark className="size-4" fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <h2 className="mt-3 font-display text-base font-semibold leading-snug">{o.title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {o.organizer} · {REGIONS[o.region]}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{o.description}</p>
      <dl className="mt-4 space-y-2 text-xs leading-relaxed">
        <div>
          <dt className="font-semibold">Кому подойдёт</dt>
          <dd className="text-muted-foreground">{o.eligibility}</dd>
        </div>
        <div>
          <dt className="font-semibold">{COSTS[o.cost]}</dt>
          <dd className="text-muted-foreground">{o.costNote}</dd>
        </div>
      </dl>
      <div className={cn("mt-4 rounded-xl px-3 py-2.5 text-xs", days !== null && days >= 0 && days <= 30 ? "bg-warning/15" : "bg-muted text-muted-foreground")}>
        <p className="flex items-center gap-1.5 font-semibold">
          <CalendarDays className="size-3.5" />
          {o.deadline ? `${past ? "Прошлый срок" : "Дедлайн"}: ${dateLabel(o.deadline)}` : o.rolling ? "Без фиксированного дедлайна" : "Новый дедлайн не объявлен"}
          {days !== null && days >= 0 && <span className="ml-auto whitespace-nowrap">{days === 0 ? "Сегодня" : `${days} дн.`}</span>}
        </p>
        <p className="mt-1">{o.deadlineNote}</p>
      </div>
      <div className="mt-auto pt-4">
        <a href={o.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Официальный сайт <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </Card>
  );
}

type Tab = "apps" | "essays" | "portfolio" | "catalog";
const TABS: { value: Tab; label: string }[] = [
  { value: "apps", label: "📋 Мои заявки" },
  { value: "essays", label: "✍️ Эссе с ИИ" },
  { value: "portfolio", label: "🧰 Портфолио" },
  { value: "catalog", label: "🏆 Конкурсы" },
];

/** Admissions workspace: applications, essays, the portfolio built from the labs, and the opportunity catalog. */
export default function Admissions() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get("tab"))?.value ?? "apps") as Tab;
  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner eyebrow="Поступление без паники" title="Подавайся как про" subtitle="Список вузов с дедлайнами и чек-листами, эссе с ИИ-коучем (он не пишет за тебя, а помогает найти свою историю) и портфолио, которое само собирается из лаборатории, кода и пути." />
      <Segmented value={tab} onChange={(v) => setParams({ tab: v })} options={TABS} className="self-start" />
      {tab === "apps" && <Apps />}
      {tab === "essays" && <Essays />}
      {tab === "portfolio" && <Portfolio />}
      {tab === "catalog" && <Catalog />}
    </div>
  );
}
