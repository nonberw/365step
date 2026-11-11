import type { SatQuestion, SatQuestionSummary } from "../shared/types";
import { BANK_DOMAIN_ORDER, BANK_TOPICS, topicFor, type BankCatalog } from "../shared/satBankCatalog";
import { orderBank } from "../shared/satBankOrder";

export type BankQuery = Record<string, unknown>;
export const bankSeed = (query: BankQuery) => String(query.seed ?? "365step-bank").slice(0, 128);
export function matchesCollection(q: SatQuestion, collection: string) {
  switch (collection) {
    case "exact": return q.id.startsWith("exact-");
    case "rw-open": return q.id.startsWith("rw-open-");
    case "rw-scale": return q.id.startsWith("rw-scale-");
    case "rw-scale-native": return q.id.startsWith("rw-scale-bb-");
    case "rw-scale-practice": return q.id.startsWith("rw-scale-") && q.purpose === "reinforcement";
    case "open": return q.id.startsWith("open-math-") || q.id.startsWith("open-rw-");
    case "scale": return q.id.startsWith("scale-");
    case "scale-source": return q.id.startsWith("scale-source-") || q.id.startsWith("scale-rw-");
    case "scale-practice": return q.id.startsWith("scale-practice-") || q.id.startsWith("scale-deepmind-");
    default: return true;
  }
}
export function bankSummaries(pool: SatQuestion[], results: Map<string, boolean>, saved: Set<string>, query: BankQuery): SatQuestionSummary[] {
  const skills = query.skills ? String(query.skills).split("|") : null;
  return pool.filter(q => query.source !== "college-board" && query.source !== "COLLEGE_BOARD" && matchesCollection(q, String(query.collection ?? "")))
    .filter(q => (!query.section || q.section === query.section) && (!query.domain || q.domain === query.domain) && (!query.difficulty || q.difficulty === Number(query.difficulty)) && (!query.purpose || q.purpose === query.purpose) && (!skills || skills.includes(q.skill)) && (!query.topic || topicFor(q)?.id === query.topic))
    .map(q => ({ id: q.id, section: q.section, domain: q.domain, skill: q.skill, difficulty: q.difficulty, purpose: q.purpose, preview: (q.passage ?? q.stem).replace(/\$|\*\*/g, "").slice(0, 110), status: results.has(q.id) ? results.get(q.id) ? "correct" : "wrong" : "new", saved: saved.has(q.id) }));
}
export function matchesStatus(q: SatQuestionSummary, status: string) { return status === "all" || (status === "saved" ? q.saved : status === "solved" ? q.status !== "new" : q.status === status); }
export function selectBank(pool: SatQuestion[], results: Map<string, boolean>, saved: Set<string>, query: BankQuery) {
  const items = bankSummaries(pool, results, saved, query).filter(q => matchesStatus(q, String(query.status ?? "all")));
  return query.shuffle === "0" ? items : orderBank(items, bankSeed(query));
}
export function bankCatalog(pool: SatQuestion[], results: Map<string, boolean>, saved: Set<string>, query: BankQuery): BankCatalog {
  const inventory = { total: pool.length, rw: pool.filter(q => q.section === "rw").length, math: pool.filter(q => q.section === "math").length };
  // Topic tree keeps all domains visible; section selection only changes the displayed panels.
  const base = bankSummaries(pool, results, saved, { ...query, section: "", domain: "", topic: "", skills: "", source: "practice" });
  const scope = bankSummaries(pool, results, saved, { ...query, source: "practice" });
  const statuses = Object.fromEntries(["all", "new", "solved", "wrong", "correct", "saved"].map(s => [s, scope.filter(q => matchesStatus(q, s)).length])) as BankCatalog["statuses"];
  const items = base.filter(q => matchesStatus(q, String(query.status ?? "all")));
  const totals = new Map<string, number>();
  for (const q of items) { const t = topicFor(q); if (t) totals.set(t.id, (totals.get(t.id) ?? 0) + 1); }
  const collections = Object.fromEntries(["exact", "rw-open", "rw-scale", "rw-scale-native", "rw-scale-practice", "open", "scale", "scale-source", "scale-practice"].map(key => [key, pool.filter(q => matchesCollection(q, key)).length]));
  // Summary is lifetime activity, including archived questions. Filter counters stay active-only.
  const correct = [...results.values()].filter(Boolean).length, wrong = results.size - correct;
  return { inventory, collections, statuses, stats: { attempted: correct + wrong, correct, wrong, saved: saved.size, accuracy: correct + wrong ? correct / (correct + wrong) : null }, sections: (["rw", "math"] as const).map(section => ({ id: section, title: section === "rw" ? "Reading & Writing" : "Math", total: items.filter(q => q.section === section).length, domains: BANK_DOMAIN_ORDER[section].map(domain => ({ id: domain, total: items.filter(q => q.section === section && q.domain === domain).length, topics: BANK_TOPICS.filter(t => t.section === section && t.domain === domain).map(t => ({ ...t, total: totals.get(t.id) ?? 0 })) })) })) };
}
