import { ExternalLink } from "lucide-react";
import { BANK_DOMAIN_ORDER, BANK_TOPICS, OFFICIAL_BANK_URL, OFFICIAL_GUIDES } from "@shared/satBankCatalog";
import { DOMAIN_RU } from "@shared/types";

export function BankOfficial() {
  return <div className="space-y-5">
    <div className="rounded-3xl border border-border bg-muted/35 p-5 sm:p-6"><p className="text-sm leading-6">Официальные задания и объяснения доступны в банке College Board. Открой его и выбери SAT, секцию, группу и тему из списка ниже.</p><p className="mt-2 text-xs text-muted-foreground">Это внешний банк. Решения и прогресс на сайте College Board не синхронизируются с 365step.</p><a href={OFFICIAL_BANK_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground">Открыть официальный Question Bank <ExternalLink className="size-4" /></a></div>
    <div className="grid gap-5 lg:grid-cols-2">{(["rw", "math"] as const).map(s => <section key={s} className="rounded-3xl border border-border bg-card p-5"><h2 className="font-display text-2xl font-semibold">{s === "rw" ? "Reading & Writing" : "Math"}</h2><a href={OFFICIAL_GUIDES[s]} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-4">Как найти задания по навыку <ExternalLink className="size-3" /></a><div className="mt-5 space-y-5">{BANK_DOMAIN_ORDER[s].map(d => <div key={d}><h3 className="text-sm font-semibold">{d}</h3><p className="text-xs text-muted-foreground">{DOMAIN_RU[d]}</p><ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">{BANK_TOPICS.filter(t => t.section === s && t.domain === d).map(t => <li key={t.id} className="pl-3">{t.title}</li>)}</ul></div>)}</div></section>)}</div>
  </div>;
}
