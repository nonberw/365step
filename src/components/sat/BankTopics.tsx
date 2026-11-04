import { ArrowRight, Shuffle } from "lucide-react";
import type { BankCatalog, BankTopic } from "@shared/satBankCatalog";
import type { SatSection } from "@shared/types";
import { DOMAIN_RU } from "@shared/types";
import { Button } from "@/components/ui/button";

const number = (n: number) => n.toLocaleString("ru-RU");
export function BankTopics({ catalog, section, shuffle, toggleShuffle, open }: { catalog: BankCatalog; section: string; shuffle: boolean; toggleShuffle: () => void; open: (section: SatSection, topic?: BankTopic, domain?: string) => void }) {
  return <div className="grid gap-5 lg:grid-cols-2">
    {catalog.sections.filter(s => !section || s.id === section).map(s => <section key={s.id} className="overflow-hidden rounded-3xl border border-border bg-card" aria-label={`${s.title}: темы`}>
      <div className="border-b border-border bg-muted/35 p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold">{s.title}</h2><p className="mt-1 text-sm text-muted-foreground">{number(s.total)} заданий</p></div><span className="rounded-full border border-border bg-card px-3 py-1 text-xs">{s.id === "rw" ? "10" : "19"} тем</span></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="inline-flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={shuffle} onChange={toggleShuffle} className="size-4 accent-primary" aria-label={`Перемешивать ${s.title}`} /><Shuffle className="size-3.5" />Вперемешку</label><Button size="sm" variant="outline" disabled={!s.total} onClick={() => open(s.id)}>Практиковать всё <ArrowRight /></Button></div>
      </div>
      <div className="divide-y divide-border">{s.domains.map(d => <div key={d.id} className="px-5 py-4">
        <button type="button" onClick={() => open(s.id, undefined, d.id)} disabled={!d.total} className="mb-2 flex w-full items-start justify-between gap-3 rounded-lg py-1 text-left disabled:opacity-50"><span><span className="block text-sm font-semibold">{d.id}</span><span className="text-xs text-muted-foreground">{DOMAIN_RU[d.id]}</span></span><span className="font-semibold tabular-nums">{number(d.total)}</span></button>
        <ul className="space-y-1">{d.topics.map(t => <li key={t.id}><button type="button" onClick={() => open(s.id, t)} disabled={!t.total} className="group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-40"><span className="min-w-0 leading-5">{t.title}</span><span className="flex shrink-0 items-center gap-2 text-muted-foreground"><span className="tabular-nums">{number(t.total)}</span><ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100" /></span></button></li>)}</ul>
      </div>)}</div>
    </section>)}
  </div>;
}
