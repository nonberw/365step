import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import additions from "../shared/satExact.json";
import manifest from "../shared/satExactManifest.json";
import baseline from "../shared/satCurated.json";
import { SAT_ACTIVE_BANK, SAT_BANK, SAT_BY_ID, isCorrect } from "../shared/sat";
import { CURATION_TARGETS, curationSkeleton } from "../shared/satCuration";
import { BANK_TOPICS, topicFor } from "../shared/satBankCatalog";
import { fingerprint, normaliseText } from "../shared/satQuality";
import { SAT_OPEN_SOURCES } from "../shared/satSources";
import { RichText } from "../src/components/RichText";
import { bankCatalog, selectBank } from "../server/satBank";
import type { SatQuestion } from "../shared/types";
let checks=0;
const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const eq=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;};
const raw=additions as SatQuestion[];
const audit=JSON.parse(readFileSync("docs/content/sat-exact/reference.json","utf8"));
const refs=new Map<string,any>(audit.items.map((r:any)=>[r.id,r]));
const display=(s:string)=>Object.entries(audit.displayRepairs as Record<string,string>).reduce((v,[a,b])=>v.replace(new RegExp("(?<![A-Za-z])(?<!A )(?<!a )"+a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"),()=>b),s).replaceAll("$","＄").trim();
for (const text of ["Along with new names, the scientists propose symbols.","An octopus has made an escape.","A nasal spray laced with oxytocin was studied.","The major problems the man faced were exposure and dehydration."]) eq(display(text),text,"valid initial capitals must not be duplicated");
eq(manifest.active,{total:2751,rw:1517,math:1234},"requested screenshot section totals");
eq(manifest.baselineSha256,createHash("sha256").update(readFileSync("shared/satCurated.json")).digest("hex"),"frozen baseline has not changed");
eq(raw.length,1417,"complete additions");
eq(SAT_ACTIVE_BANK.map(q=>q.id),manifest.ids,"manifest describes the actual active bank");
eq(SAT_BANK.length,8386+1417,"entire earlier archive plus additions retained");
eq(new Set(SAT_ACTIVE_BANK.map(fingerprint)).size,2751,"all active conditions distinct");
eq(new Set(SAT_ACTIVE_BANK.map(curationSkeleton)).size,2751,"no pure numeric/variable-name clones");
for(const t of BANK_TOPICS)eq(SAT_ACTIVE_BANK.filter(q=>topicFor(q)?.id===t.id).length,CURATION_TARGETS[t.id],`${t.id}: exact per-topic target`);
for(const id of baseline.ids)ok(SAT_ACTIVE_BANK.some(q=>q.id===id),`${id}: reviewed baseline preserved`);
const catalog=bankCatalog(SAT_ACTIVE_BANK,new Map(),new Set(),{});
eq(catalog.inventory,manifest.active,"catalog uses actual objects");
eq(catalog.collections.exact,1417,"new collection is an actual subset");
eq(selectBank(SAT_ACTIVE_BANK,new Map(),new Set(),{collection:"exact"}).length,1417,"collection filter reaches additions");
for(const q of raw){
 const ref=refs.get(q.id),live=SAT_BY_ID.get(q.id)!;
 ok(ref,`${q.id}: audit record`);ok(live?.canonicalId===q.id,`${q.id}: canonical active ID`);
 eq([live.passage,live.stem,live.choices,live.answer],[q.passage,q.stem,q.choices,q.answer],`${q.id}: live wording and key equal distribution`);
 ok(!!q.attribution&&!!SAT_OPEN_SOURCES[q.attribution.sourceId]&&q.attribution.download==="/content/sat-exact-2026.json",`${q.id}: licensed source reachable`);
 ok(q.purpose==="assessment"&&q.source==="bank",`${q.id}: curated practice`);
 ok(isCorrect(live,q.answer)&&!isCorrect(live,null)&&!isCorrect(live,""),`${q.id}: answer checker accepts key and rejects blanks`);
 for(const text of [q.stem,q.passage,q.explanation,...(q.choices??[])].filter((s):s is string=>!!s)){
  ok(!/[\u0000-\u0008\u000b-\u001f]/.test(text),`${q.id}: no control-character corruption`);
  const html=renderToStaticMarkup(createElement(RichText,{text}));
  ok(!html.includes('katex-error'),`${q.id}: math/markup renders`);
 }
 if(q.section==="math"){
  if(!q.choices)eq(String(q.answer),ref.expected,`${q.id}: exact independently specified calculation`);
  if(ref.source==="aqua")eq(q.choices![Number(q.answer)],ref.adaptedChoices[0],`${q.id}: source key remapped after dropping an incorrect choice`);
  if(ref.options)eq(q.choices![Number(q.answer)],ref.options[0],`${q.id}: qualitative model conclusion`);
 }else if(ref.source==="onestop-syntax"){
  if(ref.subject)ok(new RegExp("\\b"+ref.subject+"\\b","i").test(ref.originalContext.slice(Math.max(0,ref.start-350),ref.start)),`${q.id}: subject head is visible before the verb`);
  eq(q.choices![Number(q.answer)],ref.originalSlot,`${q.id}: original grammatical form is the key`);
  eq(q.passage!.replace("______",ref.originalSlot),display(ref.originalContext),`${q.id}: key reconstructs the complete source context`);
 }else if(ref.source==="onestop-lexicon"){
  eq(q.passage!.replaceAll("**",""),display(ref.originalContext),`${q.id}: complete vocabulary context`);
  eq(q.choices![Number(q.answer)],ref.authoredChoices[0],`${q.id}: contextual sense key`);
 }else if(ref.kind==="native"){
  eq(q.choices![Number(q.answer)],display(ref.originalChoices[0]),`${q.id}: published STARC key`);
  eq(q.passage,display(ref.originalContext),`${q.id}: native Advanced context`);
 }else if(ref.kind==="authored-inference"){
  eq(q.choices![Number(q.answer)],display(ref.authoredChoices[0]),`${q.id}: implication key`);
  eq(q.passage,display(ref.originalContext),`${q.id}: inference full context`);
 }else if(ref.kind==="transition"){
  eq(q.passage!.replace("______",ref.sourceConnector),display(ref.originalContext),`${q.id}: transition reconstructs source`);
  eq(q.choices![Number(q.answer)],ref.sourceConnector,`${q.id}: transition key`);
 }else if(ref.kind==="evidence"){
  eq(q.passage,display(ref.originalContext),`${q.id}: evidence complete context`);
  eq(q.choices![Number(q.answer)],display('“'+ref.criticalText+'”'),`${q.id}: published critical span key`);
 }
}
const download=JSON.parse(readFileSync("public/content/sat-exact-2026.json","utf8"));
eq(download.questions,additions,"download has every distributed question and key");
eq(download.references,audit.items,"download includes transformation/source evidence");
for(const file of download.licenses)ok(readFileSync('public'+file,'utf8').length>200,`${file}: full license/notice supplied`);
console.log(`${checks} exact-bank checks passed: 1517 R&W, 1234 Math, all 29 topic counts match.`);
