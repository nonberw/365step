import curated from "../shared/satExactManifest.json";
/** Topic counts, mixed sequences and real API pagination on disposable data. */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SAT_ACTIVE_BANK, SAT_BANK } from "../shared/sat";
import { BANK_TOPICS, topicFor } from "../shared/satBankCatalog";
import { orderBank } from "../shared/satBankOrder";
import { bankCatalog, selectBank } from "../server/satBank";
let checks = 0;
function eq(actual: unknown, expected: unknown, label: string) { assert.deepEqual(actual, expected, label); checks++; }
function ok(value: unknown, label: string) { assert.ok(value, label); checks++; }
eq(BANK_TOPICS.length, 29, "29 canonical topics");
eq(BANK_TOPICS.filter(t => t.section === "rw").length, 10, "10 Reading & Writing topics");
eq(BANK_TOPICS.filter(t => t.section === "math").length, 19, "19 Math topics");
eq(new Set(BANK_TOPICS.map(t => t.id)).size, 29, "unique topic IDs");
for (const q of SAT_ACTIVE_BANK) ok(topicFor(q), `${q.id} maps into the topic tree`);
const emptyResults = new Map<string, boolean>(), emptySaved = new Set<string>();
const allCatalog = bankCatalog(SAT_ACTIVE_BANK, emptyResults, emptySaved, {});
eq(allCatalog.inventory, curated.active, "curated inventory");
for (const section of allCatalog.sections) {
  eq(section.total, section.domains.reduce((n, d) => n + d.total, 0), "domain sums equal section");
  for (const domain of section.domains) eq(domain.total, domain.topics.reduce((n, t) => n + t.total, 0), "topic sums equal domain");
}
const snapshots = SAT_ACTIVE_BANK.map(q => JSON.stringify(q));
for (const seed of ["alpha", "beta", "refresh"]) {
  const ordered = orderBank(SAT_ACTIVE_BANK, seed);
  eq(ordered.map(q => q.id), orderBank(SAT_ACTIVE_BANK, seed).map(q => q.id), "same seed, same sequence");
  eq(new Set(ordered.map(q => q.id)).size, SAT_ACTIVE_BANK.length, "full permutation without repeats");
  const remaining = [0, 0, 0, 0];
  for (const q of ordered) remaining[q.difficulty]!++;
  ordered.forEach((q, i) => {
    if (i >= 2 && ordered[i-1]!.difficulty === q.difficulty && ordered[i-2]!.difficulty === q.difficulty) ok(remaining.every((n, d) => d === q.difficulty || !n), "three equal levels only when no alternative remains");
    remaining[q.difficulty]!--;
  });
}
ok(orderBank(SAT_ACTIVE_BANK, "alpha").slice(0,40).some((q,i) => q.id !== orderBank(SAT_ACTIVE_BANK, "beta")[i]!.id), "new seed changes order");
eq(orderBank([], "empty"), [], "empty sequence");
eq(orderBank(SAT_ACTIVE_BANK.slice(0,1), "one").length, 1, "single question");
eq(selectBank(SAT_ACTIVE_BANK, emptyResults, emptySaved, {shuffle:"0"}).map(q=>q.id), SAT_ACTIVE_BANK.map(q=>q.id), "explicit sequential mode");
eq(SAT_ACTIVE_BANK.map(q => JSON.stringify(q)), snapshots, "selection never mutates source questions");

const scratch = await mkdtemp(path.join(tmpdir(), "365-bank-topics-"));
process.env.DB_FILE = path.join(scratch, "check.sqlite");
process.env.TURSO_DATABASE_URL = ""; process.env.DATABASE_URL = "";
process.env.ANTHROPIC_API_KEY = ""; process.env.TELEGRAM_BOT_TOKEN = "";
const {app} = await import("../server/app");
const {db,ready,run} = await import("../server/db"); await ready;
const server = app.listen(0,"127.0.0.1"); await new Promise<void>(r=>server.once("listening",r));
const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
let token = "";
async function request(route:string, body?:unknown, expected=200) {
  const response = await fetch(base+route,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const result = await response.json() as any; eq(response.status,expected,`${route}: HTTP ${expected}`); return result;
}
try {
  await request("/sat/bank/catalog", undefined, 401);
  await request("/sat/bank/sequence", undefined, 401);
  const account = await request("/auth/register",{firstName:"Topic",lastName:"Check",email:"bank-topics@example.test",password:"TopicBank2026",consent:true,goals:{}},201); token=account.token;
  const catalog = await request("/sat/bank/catalog");
  eq(catalog.inventory, allCatalog.inventory, "API catalog inventory");
  eq(catalog.statuses.new, SAT_ACTIVE_BANK.length, "all initially new");
  const sequence = await request("/sat/bank/sequence?seed=page-test");
  eq(sequence.total,SAT_ACTIVE_BANK.length,"sequence covers whole bank, not the first 40");
  eq(new Set(sequence.ids).size,SAT_ACTIVE_BANK.length,"sequence IDs unique");
  eq(Object.keys(sequence).sort(),["ids","seed","total"],"sequence has no solutions");
  const pages:string[]=[];
  for (let page=0;page<Math.ceil(sequence.total/40);page++) {
    const batch=await request(`/sat/bank?seed=page-test&page=${page}`);
    eq(batch.items.map((q:any)=>q.id),sequence.ids.slice(page*40,page*40+40),"page matches stable full sequence");
    ok(batch.items.every((q:any)=>!("answer" in q)&&!("explanation" in q)),"summaries keep answers private");
    pages.push(...batch.items.map((q:any)=>q.id));
  }
  eq(pages,sequence.ids,"all pages cover sequence exactly once");
  eq((await request("/sat/bank?seed=page-test&page=1")).items.map((q:any)=>q.id),sequence.ids.slice(40,80),"refresh preserves second page");
  ok((await request("/sat/bank/sequence?seed=other")).ids.some((id:string,i:number)=>id!==sequence.ids[i]),"reshuffle changes sequence");
  eq((await request("/sat/bank?source=college-board")).total,0,"local material never relabeled official");
  eq((await request("/sat/bank?source=COLLEGE_BOARD")).total,0,"official source alias never returns local material");
  for (const topic of BANK_TOPICS) {
    const expected=SAT_ACTIVE_BANK.filter(q=>topicFor(q)?.id===topic.id);
    const batch=await request(`/sat/bank?topic=${topic.id}&seed=topics`);
    eq(batch.total,expected.length,`${topic.id}: actual topic count`);
    const topicCatalog=await request(`/sat/bank/catalog?topic=${topic.id}&section=${topic.section}`);
    eq(topicCatalog.statuses.all,expected.length,`${topic.id}: status counters scoped to current topic`);
    ok(batch.items.every((q:any)=>topicFor(q)?.id===topic.id),`${topic.id}: no other skill leaks`);
    const ids=await request(`/sat/bank/sequence?topic=${topic.id}&seed=topics`);
    eq(new Set(ids.ids),new Set(expected.map(q=>q.id)),`${topic.id}: complete topic sequence`);
  }
  for (const difficulty of ["1","2","3"]) {
    const c=await request(`/sat/bank/catalog?difficulty=${difficulty}`);
    for (const s of c.sections) for (const d of s.domains) {
      const list=await request(`/sat/bank?difficulty=${difficulty}&domain=${encodeURIComponent(d.id)}`);
      eq(d.total,list.total,"filtered domain count matches list");
      eq(d.total,d.topics.reduce((n:number,t:any)=>n+t.total,0),"filtered skills sum");
    }
  }
  const filtered=await request("/sat/bank/catalog?collection=rw-open&difficulty=3&section=rw");
  eq(filtered.statuses.all,(await request("/sat/bank?collection=rw-open&difficulty=3&section=rw")).total,"collection/difficulty/section counts align");
  eq((await request("/sat/bank?topic=missing")).total,0,"unknown topic yields empty state");
  eq((await request("/sat/bank?section=math&topic=words-in-context")).total,0,"incompatible section/topic is empty");
  eq((await request("/sat/bank?page=-1")).page,0,"negative page bounded");
  eq((await request("/sat/bank?page=1.9")).page,1,"fractional page bounded");
  const choices=SAT_ACTIVE_BANK.filter(q=>q.choices);
  const wrong=choices[0]!, correct=choices[1]!;
  await request("/sat/answer",{id:wrong.id,response:(Number(wrong.answer)+1)%4,ms:1});
  await request("/sat/answer",{id:correct.id,response:correct.answer,ms:1});
  await request("/sat/save",{id:correct.id,saved:true});
  const after=await request("/sat/bank/catalog");
  eq(after.stats,{attempted:2,correct:1,wrong:1,saved:1,accuracy:0.5},"real student summaries");
  for (const [status,n] of Object.entries({all:SAT_ACTIVE_BANK.length,new:SAT_ACTIVE_BANK.length-2,solved:2,wrong:1,correct:1,saved:1})) eq((await request(`/sat/bank?status=${status}`)).total,n,`${status}: real result filter`);
  eq((await request(`/sat/bank?status=saved`)).items[0].id,correct.id,"saved ID retained");
  const legacy=SAT_BANK.find(q=>!SAT_ACTIVE_BANK.some(a=>a.id===q.id))!;
  await request("/sat/answer",{id:legacy.id,response:legacy.answer,ms:1});
  await request("/sat/save", {id:legacy.id,saved:true});
  eq((await request(`/sat/question/${legacy.id}`)).question.id, legacy.id, "archived direct URL resolves");
  eq((await request(`/sat/question/${legacy.id}`)).saved, true, "archived bookmark preserved");
  eq((await request("/sat/bank?status=solved")).total,2,"archived history cannot re-enter new practice");
  eq((await request("/sat/bank?status=saved")).total,1,"archived bookmarks cannot inflate active catalogue");
  eq((await request("/sat/bank/catalog")).stats.attempted,3,"lifetime progress includes archived answers");
  eq((await request("/sat/bank/catalog")).inventory,curated.active,"archive does not change counters");
  ok(!(await request("/sat/bank/sequence")).ids.includes(legacy.id),"archive absent from new practice sequence");
  await request("/sat/answer",{id:legacy.id,response:(Number(legacy.answer)+1)%4,ms:1});
  ok((await request("/sat/review")).some((q:any)=>q.id===legacy.id),"mistake review retains archived question");
  let oldTest=await request("/sat/test/start",{mode:"full"});
  const archivedRw=SAT_BANK.find(q=>q.section==="rw"&&!SAT_ACTIVE_BANK.some(a=>a.id===q.id))!;
  oldTest.test.modules[0].questionIds[0]=archivedRw.id;
  await run("UPDATE sat_tests SET state = ? WHERE id = ?",JSON.stringify(oldTest.test),oldTest.test.id);
  const restored=await request(`/sat/test/${oldTest.test.id}`);
  eq(restored.questions[0].id,archivedRw.id,"pre-cleanup running test still loads archived questions");
  ok(!("answer" in restored.questions[0]),"archive key remains private before submission");
  const submitted=await request(`/sat/test/${oldTest.test.id}/submit`,{answers:Object.fromEntries(restored.questions.map((q:any)=>[q.id,SAT_BANK.find(a=>a.id===q.id)!.answer])),seconds:1});
  eq(submitted.test.current,1,"running test advances with archived question");
  for(const section of ["rw","math"]) {
    const blitz=await request(`/sat/blitz?section=${section}`);
    ok(blitz.length===30&&blitz.every((q:any)=>SAT_ACTIVE_BANK.some(a=>a.id===q.id)),"Blitz uses curated bank only");
  }
  const collections=(await request("/sat/bank/catalog")).collections;
  eq(collections["rw-scale"],0,"removed bulk English collection is not advertised");
  eq(collections["rw-open"],SAT_ACTIVE_BANK.filter(q=>q.id.startsWith("rw-open-")).length,"collection label uses surviving questions");
  console.log(`${checks} SAT topic-bank assertions passed on disposable data`);
} finally { await new Promise<void>(r=>server.close(()=>r())); db.close(); }
