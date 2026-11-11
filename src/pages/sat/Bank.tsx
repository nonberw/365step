import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, CheckCircle2, Circle, Shuffle, XCircle } from "lucide-react";
import type { SatQuestionSummary, SatSection } from "@shared/types";
import { DIFFICULTY_EN, SAT_DOMAINS } from "@shared/types";
import { BANK_TOPIC_BY_ID, type BankCatalog, type BankTopic } from "@shared/satBankCatalog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/api";
import { Empty, Badge, Segmented } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { BankTopics } from "@/components/sat/BankTopics";
import { newBankSeed, saveBankSequence } from "@/lib/satBank";
export { LIST_KEY } from "@/lib/satBank";

const number = (n: number) => n.toLocaleString("en-US");
export default function Bank() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [initialSeed] = useState(newBankSeed);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState("");
  const source = params.get("source") ?? (["section", "domain", "skills", "collection", "topic"].some(k => params.has(k)) ? "practice" : "");
  const section = params.get("section") ?? "";
  const domain = params.get("domain") ?? "";
  const topic = params.get("topic") ?? "";
  const difficulty = params.get("difficulty") ?? "";
  const collection = params.get("collection") ?? "";
  const purpose = params.get("purpose") ?? "";
  const status = params.get("status") ?? "all";
  const page = Math.max(0, Math.floor(Number(params.get("page")) || 0));
  const shuffle = params.get("shuffle") !== "0";
  const seed = params.get("seed") || initialSeed;
  const questions = !!source && (params.get("view") === "questions" || (params.get("view") !== "topics" && ["domain", "skills", "collection", "topic", "purpose"].some(k => !!params.get(k))));
  const query = new URLSearchParams();
  for (const key of ["section", "domain", "skills", "difficulty", "collection", "purpose", "topic"]) if (params.get(key)) query.set(key, params.get(key)!);
  query.set("status", status); query.set("shuffle", shuffle ? "1" : "0"); query.set("seed", seed);
  const catalogQuery = new URLSearchParams(query); catalogQuery.delete("seed"); catalogQuery.delete("shuffle");
  const catalog = useApi<BankCatalog>(`/sat/bank/catalog?${catalogQuery}`);
  const bank = useApi<{ total: number; page: number; items: SatQuestionSummary[] }>(questions ? `/sat/bank?${query}&page=${page}` : null);

  useEffect(() => {
    if (!source) return;
    const next = new URLSearchParams(params);
    const legacyOfficial = source === "college-board" || source === "COLLEGE_BOARD";
    if (legacyOfficial) { next.set("source", "practice"); next.set("view", "topics"); }
    if (!params.has("seed")) next.set("seed", initialSeed);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [source, params, setParams, initialSeed]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [source, questions, topic, domain, section, page]);
  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!("page" in patch)) next.delete("page");
    setOpenError(""); setParams(next);
  };
  async function openQuestion(id?: string) {
    if (opening) return;
    setOpening(true); setOpenError("");
    try {
      const sequence = await api<{ ids: string[] }>(`/sat/bank/sequence?${query}`);
      const first = id && sequence.ids.includes(id) ? id : sequence.ids[0];
      if (!first) return setOpenError("There are no questions in this selection. Try different filters.");
      const back = new URLSearchParams(params); back.set("source", "practice"); back.set("seed", seed); back.set("view", "questions");
      saveBankSequence(sequence.ids, { query: query.toString(), returnTo: `/sat/bank?${back}` });
      navigate(`/sat/q/${first}`);
    } catch (e) { setOpenError((e as Error).message); } finally { setOpening(false); }
  }
  function openTopic(s: SatSection, t?: BankTopic, d?: string) {
    update({ source: "practice", section: s, topic: t?.id ?? "", domain: t?.domain ?? d ?? "", skills: "", view: "questions", seed: newBankSeed() });
  }
  const activeTopic = BANK_TOPIC_BY_ID.get(topic);
  const stats = catalog.data?.stats;
  const inventory = catalog.data?.inventory;
  const domains = section === "rw" || section === "math" ? SAT_DOMAINS[section] : [...SAT_DOMAINS.rw, ...SAT_DOMAINS.math];
  const switchShuffle = () => update({ shuffle: shuffle ? "0" : "1", seed: newBankSeed() });
  const statusOptions = ([['new', "Unanswered"], ['solved', "Answered"], ['wrong', "Mistakes"], ['all', "All"], ['saved', "Saved"]] as const).map(([value, title]) => ({ value, label: <>{title}{catalog.data && <span className="ml-1.5 opacity-70">{number(catalog.data.statuses[value])}</span>}</> }));

  return <div className="space-y-5">
    {source && <button type="button" onClick={() => setParams({})} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Bank overview</button>}
    <PageHeader eyebrow="SAT" title={source && questions ? activeTopic?.title ?? (domain || "Topic practice") : "Question Banks"} description={"Choose a section and topic, then practise at your own pace. Difficulty ratings are approximate."} />
    {!source ? <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Questions answered", stats ? number(stats.attempted) : "—"], ["Accuracy", stats?.accuracy != null ? `${Math.round(stats.accuracy * 100)}%` : "—"], ["Saved", stats ? number(stats.saved) : "—"], ["Mistakes", stats ? number(stats.wrong) : "—"]].map(([title, value]) => <div key={title} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p></div>)}</div>
      <ErrorBox message={catalog.error} />
      <div className="grid gap-5">
        <button type="button" onClick={() => update({ source: "practice", view: "topics", seed: newBankSeed() })} className="group flex min-h-64 flex-col items-start rounded-3xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/50"><BookOpen className="mb-6 size-7 text-primary" /><h2 className="font-display text-2xl font-semibold">Question Banks</h2><p className="mt-2 text-sm text-muted-foreground">SAT practice by topic: original questions, open educational resources and reinforcement exercises.</p><div className="mt-6 flex w-full items-end justify-between gap-3"><div><p className="text-3xl font-semibold tabular-nums">{inventory ? number(inventory.total) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">R&W {inventory ? number(inventory.rw) : "—"} · Math {inventory ? number(inventory.math) : "—"}</p></div><ArrowRight className="size-5 text-primary transition-transform group-hover:translate-x-1" /></div></button>
      </div>
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><Segmented value={status} onChange={v => update({ status: v })} options={statusOptions} /><Select aria-label={"Difficulty"} value={difficulty} onChange={e => update({ difficulty: e.target.value })} className="h-9 w-auto text-xs"><option value="">Any difficulty</option>{([2,3] as const).map(d => <option key={d} value={d}>{DIFFICULTY_EN[d]}</option>)}</Select></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><Segmented value={section || "all"} onChange={v => update({ section: v === "all" ? "" : v, domain: "", topic: "", skills: "", view: "topics" })} options={[{ value: "all", label: "Both sections" },{ value: "rw", label: "Reading & Writing" },{ value: "math", label: "Math" }]} />{(difficulty || collection || purpose || status !== "all") && <button type="button" onClick={() => update({ difficulty: "", collection: "", purpose: "", status: "all", skills: "" })} className="text-xs text-primary underline underline-offset-4">Clear filters</button>}</div>
      <details className="rounded-2xl border border-border px-4 py-3" open={!!collection || !!purpose}><summary className="cursor-pointer text-xs text-muted-foreground">Collections and practice types{collection ? " · Filter active" : ""}</summary><div className="mt-3 flex flex-wrap gap-3"><Select aria-label={"Question collection"} className="h-9 w-auto max-w-full text-xs" value={collection} onChange={e => update({ collection: e.target.value, ...(e.target.value.startsWith("rw-") ? { section: "rw", topic: "", domain: "", skills: "" } : {}) })}><option value="">All questions</option>{[["exact", "New topic questions"], ["rw-open", "Original Reading & Writing"], ["scale", "Open thematic set"], ["scale-source", "Source-based Reading"], ["scale-practice", "Practice questions"], ["open", "First open collection"]].filter(([id]) => (catalog.data?.collections[id!] ?? 0) > 0).map(([id, title]) => <option key={id} value={id}>{title} · {number(catalog.data!.collections[id!]!)}</option>)}</Select><Select aria-label={"Purpose"} value={purpose} onChange={e => update({ purpose: e.target.value })} className="h-9 w-auto text-xs"><option value="">All purposes</option><option value="warmup">Warm-up</option><option value="reinforcement">Reinforcement</option><option value="assessment">Assessment</option></Select></div><p className="mt-3 text-xs text-muted-foreground">Reinforcement exercises are labelled separately and excluded from full practice tests. Each question includes its source and licence.</p></details>
      <ErrorBox message={openError || catalog.error} />
      {!questions ? catalog.loading ? <Loading /> : catalog.data && <BankTopics catalog={catalog.data} section={section} shuffle={shuffle} toggleShuffle={switchShuffle} open={openTopic} /> : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => update({ view: "topics", topic: "", domain: "", skills: "" })} className="inline-flex items-center gap-1.5 text-xs text-primary"><ArrowLeft className="size-3.5" /> Back to topics</button><Select aria-label={"Domain"} value={domain} onChange={e => update({ domain: e.target.value, topic: "", skills: "" })} className="h-9 w-auto max-w-full text-xs"><option value="">All domains</option>{domains.map(d => <option key={d} value={d}>{d}</option>)}</Select></div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4"><div><p className="text-sm font-semibold">{bank.data ? number(bank.data.total) : "—"} questions in this selection</p><label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input aria-label={"Shuffle questions"} type="checkbox" checked={shuffle} onChange={switchShuffle} className="size-4 accent-primary" />{shuffle ? "Random order · mixed difficulty" : "Order added"}</label></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => update({ seed: newBankSeed(), shuffle: "1" })}><Shuffle /> Shuffle</Button><Button size="sm" disabled={!bank.data?.items.length || opening} onClick={() => void openQuestion()}>{opening ? "Opening…" : "Start practice"}<ArrowRight /></Button></div></div>
        {bank.loading ? <Loading /> : bank.error ? <ErrorBox message={bank.error} /> : !bank.data?.items.length ? <Empty title={"No questions match this selection."}>Change the filters or choose another topic.</Empty> : <>
          <ul className="overflow-hidden rounded-2xl border border-border">{bank.data.items.map(q => <li key={q.id} className="border-b border-border last:border-b-0"><button type="button" disabled={opening} onClick={() => void openQuestion(q.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 disabled:opacity-60">{q.status === "correct" ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : q.status === "wrong" ? <XCircle className="size-5 shrink-0 text-destructive" /> : <Circle className="size-5 shrink-0 text-muted-foreground" />}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{q.preview}</span><span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span>{q.section === "rw" ? "R&W" : "Math"}</span>·<span>{q.skill}</span>{q.purpose === "reinforcement" && <Badge>Reinforcement</Badge>}</span></span>{q.saved && <Bookmark className="size-4 shrink-0 fill-primary text-primary" />}<Badge tone={q.difficulty === 3 ? "bad" : q.difficulty === 2 ? "warn" : "ok"} className="shrink-0">{DIFFICULTY_EN[q.difficulty]}</Badge></button></li>)}</ul>
          {bank.data.total > 40 && <div className="flex items-center justify-center gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => update({ page: String(page - 1) })}>Back</Button><span className="text-sm tabular-nums text-muted-foreground">{page + 1} / {Math.ceil(bank.data.total / 40)}</span><Button variant="outline" size="sm" disabled={(page + 1) * 40 >= bank.data.total} onClick={() => update({ page: String(page + 1) })}>Next</Button></div>}
        </>}
      </>}
    </>}
    <p className="text-xs leading-5 text-muted-foreground">SAT is a trademark of College Board. 365step is not affiliated with College Board. Our practice uses original questions and open educational resources, with sources listed for each question.</p>
  </div>;
}
