import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "../src/components/RichText";
import { SAT_SCALE, SAT_SCALE_SOURCE, SAT_SCALE_PRACTICE } from "../shared/satScale";
import { SAT_SCALE_READING } from "../shared/satScaleReading";
import { SAT_BANK, SAT_ACTIVE_BANK, SAT_BY_ID, isCorrect } from "../shared/sat";
import { SAT_OPEN_SOURCES } from "../shared/satSources";
import { familyOf, fingerprint, selectAssessment } from "../shared/satQuality";
import { choiceKey } from "../shared/numeric";
import manifest from "../shared/satScaleManifest.json";

let checks=0;
function ok(value:unknown,message:string){assert.ok(value,message);checks++;}
ok(SAT_SCALE.length>=3000&&SAT_SCALE_SOURCE.length>=650&&SAT_SCALE_READING.length===40&&SAT_SCALE_PRACTICE.length===2400,"substantial expansion, not only 120 items");
ok(new Set(SAT_SCALE.map(q=>q.id)).size===SAT_SCALE.length,"stable unique IDs");
ok(new Set(SAT_SCALE.map(fingerprint)).size===SAT_SCALE.length,"distinct complete conditions");
ok(manifest.total===SAT_SCALE.length&&manifest.bankTotal===SAT_BANK.filter(q=>q.canonicalId===q.id&&!q.id.startsWith("exact-")).length,"historical import manifest matches preserved archive");
ok(manifest.hard===SAT_SCALE.filter(q=>q.difficulty===3).length,"editorial Hard count");
const old=SAT_BANK.filter(q=>!q.id.startsWith("scale-"));
for(const q of SAT_SCALE){
  const live=SAT_BY_ID.get(q.id)!;
  ok(live.canonicalId===q.id,`${q.id}: new active condition`);
  ok(q.id.length<=60,`${q.id}: API ID fits`);
  ok(old.some(o=>o.section===q.section&&o.domain===q.domain&&o.skill===q.skill),`${q.id}: existing SAT topic`);
  ok(!!q.attribution&&!!SAT_OPEN_SOURCES[q.attribution.sourceId]&&!!q.attribution.locator&&!!q.attribution.license&&!!q.attribution.licenseUrl&&q.attribution.download==="/content/sat-scale-2026.json",`${q.id}: rights and traceable attribution`);
  ok(!("parameters" in q)&&!("expected" in q)&&!("upstreamAnswer" in q),`${q.id}: reference inputs separate from public object`);
  ok(isCorrect(live,q.answer)&&!isCorrect(live,null)&&!isCorrect(live,""),`${q.id}: checker accepts key, rejects blanks`);
  if(q.choices)ok(q.choices.length===4&&new Set(q.choices.map(c=>q.section==="math"?choiceKey(c):c.trim().toLowerCase())).size===4,`${q.id}: distinct options`);
  if(q.section==="math"){
    for(const text of [q.stem,q.explanation,...(q.choices??[])]){
      const rendered=renderToStaticMarkup(createElement(RichText,{text}));
      ok(!rendered.includes("katex-error"),`${q.id}: math renders`);
    }
  }
}
for(const q of SAT_SCALE_PRACTICE){
  ok(q.purpose==="reinforcement"&&q.familyId!.startsWith("scale-"),`${q.id}: procedural variants explicitly marked`);
  ok(q.attribution!.changes.includes("не")||q.attribution!.changes.includes("Это не"),`${q.id}: provenance explains procedural origin`);
}
ok(new Set(SAT_SCALE_PRACTICE.map(familyOf)).size===21,"variant families are not counted as 2400 authored problems");
ok(new Set(SAT_SCALE.filter(q=>q.purpose==="reinforcement").slice(0,21).map(familyOf)).size===21,"bank interleaves template families");
ok(SAT_SCALE_SOURCE.filter(q=>q.stem.includes("\\right)^{3}")).every(q=>q.difficulty!==3),"a visible factored cube alone is not Hard");
for(const q of SAT_SCALE_READING){
  const words=q.passage!.split(/\s+/).length;
  ok(words>=25&&words<=150,`${q.id}: SAT length`);
  ok(q.explanation.includes("— верно:")&&q.explanation.split("— неверно:").length===4,`${q.id}: all choices explained`);
}
for(const section of ["math","rw"] as const){
  const full=selectAssessment(SAT_ACTIVE_BANK.filter(q=>q.section===section),section==="math"?44:54);
  ok(full.length===(section==="math"?44:54)&&full.every(q=>q.purpose==="assessment"),`${section}: full tests exclude generated reinforcement`);
}
const download=JSON.parse(readFileSync("public/content/sat-scale-2026.json","utf8"));
ok(JSON.stringify(download.questions)===JSON.stringify(SAT_SCALE),"download matches every distributed key and condition");
ok(download.sourceNotices.openstax.startsWith("Attribution 4.0 International")&&download.sourceNotices.deepmind.includes("Apache License"),"complete upstream license notices preserved");
console.log(`${checks} scale assertions passed; ${SAT_SCALE.length} additions, ${manifest.hard} Hard, ${manifest.practice.total} labeled practice variants`);
