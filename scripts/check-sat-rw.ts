import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "../src/components/RichText";
import { SAT_RW_EXPANSION } from "../shared/satRw";
import { SAT_BANK, SAT_ACTIVE_BANK, SAT_BY_ID, isCorrect, rng } from "../shared/sat";
import { fingerprint, normaliseText, selectAssessment } from "../shared/satQuality";
import { SAT_OPEN_SOURCES } from "../shared/satSources";
import manifest from "../shared/satRwManifest.json";
import evidence from "../docs/content/sat-rw/source-snapshots.json";
let checks = 0;
function ok(v:unknown,message:string){assert.ok(v,message);checks++;}
const additions = SAT_RW_EXPANSION;
ok(additions.length===360,"360 editorial records; no permutation multiplier");
ok(new Set(additions.map(q=>q.id)).size===360,"unique stable IDs");
ok(new Set(additions.map(fingerprint)).size===360,"different complete questions");
const legacy = SAT_BANK.filter(q=>!q.id.startsWith("rw-open-")&&!q.id.startsWith("rw-scale-")&&!q.id.startsWith("exact-"));
ok(legacy.length===4835,"all existing IDs retained including historical aliases");
ok(createHash("sha256").update(JSON.stringify(legacy.map(q=>[q.id,q.passage,q.stem,q.choices,q.answer]))).digest("hex")==="6b459180d255ad23ad037ba63a1ad7b95d671a097cea7fef331e742f850229e1","existing passage/stem/choice/key snapshot unchanged");
const sourceIds=new Set(additions.map(q=>q.attribution!.sourceId));
ok(sourceIds.size===12&&evidence.length===12,"12 traceable primary works");
for(const id of sourceIds){
  const snapshot=evidence.find(e=>e.id===id)!;
  ok(!!SAT_OPEN_SOURCES[id]&&!!snapshot&&/^[a-f0-9]{64}$/.test(snapshot.sha256)&&snapshot.bytes>100000&&snapshot.editionNotice.includes("Title:"),`${id}: original edition downloaded and hashed`);
}
for(const q of additions){
  const live=SAT_BY_ID.get(q.id)!;
  ok(live?.canonicalId===q.id,`${q.id}: active, not duplicate of existing question`);
  ok(q.id.length<=60&&q.section==="rw"&&q.purpose==="assessment"&&q.source==="bank",`${q.id}: valid bank item`);
  ok(q.choices?.length===4&&new Set(q.choices.map(c=>normaliseText(c))).size===4&&q.choices.every(c=>c.trim().length>0),`${q.id}: four visible distinct choices`);
  ok(Number.isInteger(q.answer)&&Number(q.answer)>=0&&Number(q.answer)<4,`${q.id}: one indexed key`);
  for(let i=0;i<4;i++)ok(isCorrect(q,i)===(i===q.answer),`${q.id}: checker behavior ${i}`);
  ok(!isCorrect(q,null)&&!isCorrect(q,""),`${q.id}: blank not accepted`);
  const words=q.passage!.split(/\s+/).filter(Boolean).length;
  ok(words>=25&&words<=150,`${q.id}: SAT passage length ${words}`);
  ok(q.explanation.split("— верно:").length===2&&q.explanation.split("— неверно:").length===4&&/[А-Яа-я]/.test(q.explanation),`${q.id}: all four options explained in Russian`);
  ok(!!q.attribution?.locator&&q.attribution.download==="/content/sat-rw-open-2026.json"&&q.attribution.license==="CC BY-SA 4.0",`${q.id}: rights/locator/download`);
  if(q.skill==="Words in Context")ok(q.passage!.match(/\*\*[^*]+\*\*/g)?.length===1,`${q.id}: exactly one highlighted target`);
  if(q.skill==="Rhetorical Synthesis")ok(q.passage!.includes("• ")&&q.stem.includes("student wants"),`${q.id}: notes and explicit rhetorical goal`);
  for(const text of [q.passage!,q.stem,q.explanation,...q.choices!]){
    const html=renderToStaticMarkup(createElement(RichText,{text}));
    ok(html.length>0&&!html.includes("katex-error"),`${q.id}: renders safely`);
  }
}
ok([0,1,2,3].every(i=>additions.filter(q=>q.answer===i).length===90),"answer positions balanced without changing old options");
ok(manifest.total===360&&manifest.rwTotal===SAT_BANK.filter(q=>q.section==="rw"&&q.canonicalId===q.id&&!q.id.startsWith("exact-")).length&&manifest.previousRwTotal===649,"honest English totals and historical baseline");
ok(manifest.uniquePassages===new Set(additions.map(q=>q.passage)).size&&manifest.hard===additions.filter(q=>q.difficulty===3).length,"manifest distinguishes questions and shared passages");
for(const [skill,count] of Object.entries(manifest.skills))ok(additions.filter(q=>q.skill===skill).length===count,`${skill}: count`);
const download=JSON.parse(readFileSync("public/content/sat-rw-open-2026.json","utf8"));
ok(JSON.stringify(download.questions)===JSON.stringify(additions),"download matches all keys and wording");
ok(JSON.stringify(download.manifest)===JSON.stringify(manifest),"download manifest current");
const candidates=SAT_ACTIVE_BANK.filter(q=>q.section==="rw");
for(let seed=0;seed<12;seed++){
  const first=selectAssessment(candidates,27,[],[],rng(seed));
  const second=selectAssessment(candidates,27,first,Array(27).fill(3),rng(seed+100));
  const test=[...first,...second];
  ok(test.length===54&&new Set(test.map(q=>normaliseText(q.passage!))).size===54,`full RW ${seed}: no repeat passage across modules`);
}
const shared=additions.filter(q=>q.familyId==="rw-open:wick");
const repeated=shared.filter(q=>q.passage===shared[0]!.passage);
ok(repeated.length===3,"fixture includes three separate skills against one passage");
ok(selectAssessment(repeated,3).length===1,"same passage cannot reappear merely under a new stem");
ok(selectAssessment(repeated,3,[repeated[0]!]).length===0,"previous module's passage remains excluded");
console.log(`${checks} SAT RW assertions passed; ${manifest.rwTotal} archived English items, ${manifest.total} additions, ${manifest.hard} editorial Hard`);
