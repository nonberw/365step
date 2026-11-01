import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Medal } from "lucide-react";
import { SCHOLARSHIPS, type Scholarship } from "@shared/admissions";
import { OPPORTUNITIES } from "@shared/opportunities";
import { Badge, Card, Segmented } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

// Scholarships and financial aid for students from Kazakhstan, with the Bolashak bachelor track tied to the contest catalog.

type Filter = "all" | "kz" | "abroad";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "kz", label: "🇰🇿 Для граждан РК" },
  { value: "abroad", label: "🌍 Учёба за рубежом" },
];

const TAG: Record<Scholarship["tags"][number], string> = {
  "kz-citizen": "граждане РК",
  olympiad: "нужна медаль",
  "need-blind": "need-blind",
  "full-need": "100% потребности",
  government: "государственная",
  fee: "сбор за заявку",
};

const contest = (id: string) => OPPORTUNITIES.find((o) => o.id === id);

function ScholarshipCard({ s }: { s: Scholarship }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">{s.flag}</span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.where}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {s.tags.map((t) => (
          <Badge key={t} tone={t === "olympiad" ? "warn" : "soft"}>
            {TAG[t]}
          </Badge>
        ))}
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">что покрывает</dt>
          <dd>{s.covers}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">кому</dt>
          <dd>{s.who}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">когда</dt>
          <dd>{s.window}</dd>
        </div>
      </dl>
      {s.note && <p className="rounded-2xl bg-muted px-3 py-2 text-xs">{s.note}</p>}
      {s.contests && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">путь к медали — из нашего каталога</p>
          <div className="flex flex-wrap gap-1.5">
            {s.contests.map(contest).filter(Boolean).map((o) => (
              <Link key={o!.id} to="/admissions?tab=catalog" className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold hover:border-primary hover:text-primary">
                <Medal className="mr-1 inline size-3" />
                {o!.title}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="mt-auto pt-1">
        <a href={s.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Официальный сайт <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </Card>
  );
}

export default function Money() {
  const [filter, setFilter] = useState<Filter>("all");
  const list = SCHOLARSHIPS.filter((s) => (filter === "all" ? true : filter === "kz" ? s.tags.includes("kz-citizen") : !s.flag.includes("🇰🇿")));
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-primary/25 bg-primary/5 p-4 text-sm">
        <b>Деньги — не повод не подаваться.</b> Need-blind вузы не смотрят на то, нужна ли тебе помощь, а full-need закрывают всю доказанную потребность семьи. Для финпомощи в США почти везде нужен CSS Profile — заполняй его вместе с заявкой. Даты ниже — обычные окна; точные сроки каждый год проверяй на официальном сайте.
      </div>
      <Segmented value={filter} onChange={setFilter} options={FILTERS} className="self-start" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => (
          <ScholarshipCard key={s.id} s={s} />
        ))}
      </div>
    </div>
  );
}
