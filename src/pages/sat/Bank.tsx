import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, CheckCircle2, Circle, ExternalLink, Library, Shuffle, XCircle } from "lucide-react";
import type { SatQuestionSummary, SatSection } from "@shared/types";
import { DIFFICULTY_RU, SAT_DOMAINS } from "@shared/types";
import { BANK_TOPIC_BY_ID, type BankCatalog, type BankTopic } from "@shared/satBankCatalog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/api";
import { Empty, Badge, Segmented } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { BankTopics } from "@/components/sat/BankTopics";
import { BankOfficial } from "@/components/sat/BankOfficial";
import { newBankSeed, saveBankSequence } from "@/lib/satBank";
import scale from "@shared/satScaleManifest.json";
import reading from "@shared/satRwManifest.json";
import rwScale from "@shared/satRwScaleManifest.json";
export { LIST_KEY } from "@/lib/satBank";

const number = (n: number) => n.toLocaleString("ru-RU");
export default function Bank() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [initialSeed] = useState(newBankSeed);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState("");
  const source = params.get("source") ?? (["section", "domain", "skills", "collection", "topic"].some(k => params.has(k)) ? "practice" : "");
  const official = source === "college-board" || source === "COLLEGE_BOARD";
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
  const questions = !official && !!source && (params.get("view") === "questions" || (params.get("view") !== "topics" && ["domain", "skills", "collection", "topic", "purpose"].some(k => !!params.get(k))));
  const query = new URLSearchParams();
  for (const key of ["section", "domain", "skills", "difficulty", "collection", "purpose", "topic"]) if (params.get(key)) query.set(key, params.get(key)!);
  query.set("status", status); query.set("shuffle", shuffle ? "1" : "0"); query.set("seed", seed);
  const catalogQuery = new URLSearchParams(query); catalogQuery.delete("seed"); catalogQuery.delete("shuffle");
  const catalog = useApi<BankCatalog>(`/sat/bank/catalog?${catalogQuery}`);
  const bank = useApi<{ total: number; page: number; items: SatQuestionSummary[] }>(questions ? `/sat/bank?${query}&page=${page}` : null);

  useEffect(() => {
    if (!source || official || params.has("seed")) return;
    const next = new URLSearchParams(params); next.set("seed", initialSeed); setParams(next, { replace: true });
  }, [source, official, params, setParams, initialSeed]);
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
      if (!first) return setOpenError("В этой подборке пока нет заданий. Измени фильтры.");
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
  const statusOptions = ([['new', 'Нерешённые'], ['solved', 'Решённые'], ['wrong', 'Ошибки'], ['all', 'Все'], ['saved', 'Сохранённые']] as const).map(([value, title]) => ({ value, label: <>{title}{catalog.data && <span className="ml-1.5 opacity-70">{number(catalog.data.statuses[value])}</span>}</> }));

  return <div className="space-y-5">
    {source && <button type="button" onClick={() => setParams({})} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Все источники</button>}
    <PageHeader eyebrow="SAT" title={official ? "Official College Board" : source ? questions ? activeTopic?.title ?? (domain || "Практика по темам") : "Practice Tests" : "Банк вопросов"} description={official ? "Официальные материалы — на сайте College Board." : source ? "Выбери тему и решай задания в своём темпе. Уровни сложности ориентировочные." : "Два источника подготовки. Выбирай секцию, группу и конкретную тему."} />
    {!source ? <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Решено заданий", stats ? number(stats.attempted) : "—"], ["Точность", stats?.accuracy != null ? `${Math.round(stats.accuracy * 100)}%` : "—"], ["Сохранено", stats ? number(stats.saved) : "—"], ["Ошибки", stats ? number(stats.wrong) : "—"]].map(([title, value]) => <div key={title} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p></div>)}</div>
      <ErrorBox message={catalog.error} />
      <div className="grid gap-5 md:grid-cols-2">
        <button type="button" onClick={() => update({ source: "practice", view: "topics", seed: newBankSeed() })} className="group flex min-h-64 flex-col items-start rounded-3xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/50"><BookOpen className="mb-6 size-7 text-primary" /><h2 className="font-display text-2xl font-semibold">Practice Tests</h2><p className="mt-2 text-sm text-muted-foreground">Практика 365step по темам SAT: авторские задания, открытые материалы и закрепление.</p><div className="mt-6 flex w-full items-end justify-between gap-3"><div><p className="text-3xl font-semibold tabular-nums">{inventory ? number(inventory.total) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">R&W {inventory ? number(inventory.rw) : "—"} · Math {inventory ? number(inventory.math) : "—"}</p></div><ArrowRight className="size-5 text-primary transition-transform group-hover:translate-x-1" /></div></button>
        <button type="button" onClick={() => update({ source: "college-board" })} className="group flex min-h-64 flex-col items-start rounded-3xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/50"><Library className="mb-6 size-7 text-primary" /><h2 className="font-display text-2xl font-semibold">Official College Board</h2><p className="mt-2 text-sm text-muted-foreground">Официальный Question Bank, объяснения и навигация по тем же навыкам.</p><div className="mt-auto flex w-full items-end justify-between gap-3 pt-6"><div><Badge>Внешний ресурс</Badge><p className="mt-2 text-xs text-muted-foreground">Открывается на сайте College Board</p></div><ExternalLink className="size-5 text-primary" /></div></button>
      </div>
    </> : official ? <BankOfficial /> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><Segmented value={status} onChange={v => update({ status: v })} options={statusOptions} /><Select aria-label="Сложность" value={difficulty} onChange={e => update({ difficulty: e.target.value })} className="h-9 w-auto text-xs"><option value="">Любая сложность</option>{([1,2,3] as const).map(d => <option key={d} value={d}>{DIFFICULTY_RU[d]}</option>)}</Select></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><Segmented value={section || "all"} onChange={v => update({ section: v === "all" ? "" : v, domain: "", topic: "", skills: "", view: "topics" })} options={[{ value: "all", label: "Обе секции" },{ value: "rw", label: "Reading & Writing" },{ value: "math", label: "Math" }]} />{(difficulty || collection || purpose || status !== "all") && <button type="button" onClick={() => update({ difficulty: "", collection: "", purpose: "", status: "all", skills: "" })} className="text-xs text-primary underline underline-offset-4">Сбросить фильтры</button>}</div>
      <details className="rounded-2xl border border-border px-4 py-3" open={!!collection || !!purpose}><summary className="cursor-pointer text-xs text-muted-foreground">Подборки и назначение заданий{collection ? " · фильтр включён" : ""}</summary><div className="mt-3 flex flex-wrap gap-3"><Select aria-label="Набор задач" className="h-9 w-auto max-w-full text-xs" value={collection} onChange={e => update({ collection: e.target.value, ...(e.target.value.startsWith("rw-") ? { section: "rw", topic: "", domain: "", skills: "" } : {}) })}><option value="">Весь банк</option><option value="rw-scale">Большой Reading & Writing · {rwScale.total}</option><option value="rw-scale-native">Открытые вопросы на чтение · {rwScale.nativeReading}</option><option value="rw-scale-practice">Закрепление английского · {rwScale.reinforcement}</option><option value="rw-open">Авторский Reading & Writing · {reading.total}</option><option value="scale">Большой набор · {scale.total}</option><option value="scale-source">Источники и Reading · {scale.source.total + scale.reading.total}</option><option value="scale-practice">Тренировочные варианты · {scale.practice.total}</option><option value="open">Первый открытый набор · 120</option></Select><Select aria-label="Назначение" value={purpose} onChange={e => update({ purpose: e.target.value })} className="h-9 w-auto text-xs"><option value="">Все назначения</option><option value="warmup">Разминка</option><option value="reinforcement">Закрепление</option><option value="assessment">Контроль</option></Select></div><p className="mt-3 text-xs text-muted-foreground">Закрепление помечено отдельно и не входит в полный пробник. Источники и лицензии доступны в карточке задания.</p></details>
      <ErrorBox message={openError || catalog.error} />
      {!questions ? catalog.loading ? <Loading /> : catalog.data && <BankTopics catalog={catalog.data} section={section} shuffle={shuffle} toggleShuffle={switchShuffle} open={openTopic} /> : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => update({ view: "topics", topic: "", domain: "", skills: "" })} className="inline-flex items-center gap-1.5 text-xs text-primary"><ArrowLeft className="size-3.5" /> К темам</button><Select aria-label="Группа тем" value={domain} onChange={e => update({ domain: e.target.value, topic: "", skills: "" })} className="h-9 w-auto max-w-full text-xs"><option value="">Все группы</option>{domains.map(d => <option key={d} value={d}>{d}</option>)}</Select></div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4"><div><p className="text-sm font-semibold">{bank.data ? number(bank.data.total) : "—"} заданий в подборке</p><label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input aria-label="Перемешивать задания" type="checkbox" checked={shuffle} onChange={switchShuffle} className="size-4 accent-primary" />{shuffle ? "Случайный порядок · сложности вперемешку" : "Порядок добавления"}</label></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => update({ seed: newBankSeed(), shuffle: "1" })}><Shuffle /> Перемешать</Button><Button size="sm" disabled={!bank.data?.items.length || opening} onClick={() => void openQuestion()}>{opening ? "Открываю…" : "Начать практику"}<ArrowRight /></Button></div></div>
        {bank.loading ? <Loading /> : bank.error ? <ErrorBox message={bank.error} /> : !bank.data?.items.length ? <Empty title="В этой подборке нет заданий">Измени фильтры или выбери другую тему.</Empty> : <>
          <ul className="overflow-hidden rounded-2xl border border-border">{bank.data.items.map(q => <li key={q.id} className="border-b border-border last:border-b-0"><button type="button" disabled={opening} onClick={() => void openQuestion(q.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 disabled:opacity-60">{q.status === "correct" ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : q.status === "wrong" ? <XCircle className="size-5 shrink-0 text-destructive" /> : <Circle className="size-5 shrink-0 text-muted-foreground" />}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{q.preview}</span><span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span>{q.section === "rw" ? "R&W" : "Math"}</span>·<span>{q.skill}</span>{q.purpose === "reinforcement" && <Badge>Закрепление</Badge>}</span></span>{q.saved && <Bookmark className="size-4 shrink-0 fill-primary text-primary" />}<Badge tone={q.difficulty === 3 ? "bad" : q.difficulty === 2 ? "warn" : "ok"} className="shrink-0">{DIFFICULTY_RU[q.difficulty]}</Badge></button></li>)}</ul>
          {bank.data.total > 40 && <div className="flex items-center justify-center gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => update({ page: String(page - 1) })}>Назад</Button><span className="text-sm tabular-nums text-muted-foreground">{page + 1} / {Math.ceil(bank.data.total / 40)}</span><Button variant="outline" size="sm" disabled={(page + 1) * 40 >= bank.data.total} onClick={() => update({ page: String(page + 1) })}>Дальше</Button></div>}
        </>}
      </>}
    </>}
    <p className="text-xs leading-5 text-muted-foreground">SAT — товарный знак College Board. 365step не связан с College Board. В нашей практике используются авторские и открытые учебные материалы; официальные задания доступны по внешним ссылкам.</p>
  </div>;
}
