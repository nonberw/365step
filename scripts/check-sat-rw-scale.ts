import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "../src/components/RichText";
import { SAT_RW_SCALE } from "../shared/satRwScale";
import { SAT_ACTIVE_BANK, SAT_BANK, SAT_BY_ID, isCorrect, rng } from "../shared/sat";
import { SAT_OPEN_SOURCES } from "../shared/satSources";
import { fingerprint, normaliseText, selectAssessment } from "../shared/satQuality";
import manifest from "../shared/satRwScaleManifest.json";
import imported from "../docs/content/sat-rw-scale/import.json";
import refs from "./sat-rw-scale-reference.json";
let checks=0;
function ok(value:unknown,message:string){assert.ok(value,message);checks++;}
const sha=(text:string)=>createHash("sha256").update(text).digest("hex");
const unescapeCurrency=(text:string)=>text.replaceAll("＄","$");
const references=new Map(refs.map(ref=>[ref.id,ref]));
for(const text of ["One ______ blank.","Two ______ and ______ blanks.","A ___ short blank."]){
 const html=renderToStaticMarkup(createElement(RichText,{text}));
 ok((html.match(/_{3,}/g)??[]).join("|")===(text.match(/_{3,}/g)??[]).join("|"),"answer blanks stay fully visible");
}
const underlined=renderToStaticMarkup(createElement(RichText,{text:"Read __this evidence__ before completing ______."}));
ok(underlined.includes("<u>")&&underlined.includes("this evidence")&&underlined.includes("______"),"underlined evidence and answer blank coexist");
const paired=renderToStaticMarkup(createElement(RichText,{text:"__First claim__ and __second claim__; fill ______."}));
ok(paired.split("<u>").length===3&&paired.includes("______"),"two separate references retain underlining");
const embedded=renderToStaticMarkup(createElement(RichText,{text:"__The claim ______ continues here.__"}));
ok(embedded.split("<u>").length===2&&embedded.includes("______")&&embedded.includes("continues here."),"blank inside an underlined clause does not close it early");
ok(SAT_RW_SCALE.length===3191&&manifest.total===3191,"3,191 complete new conditions");
ok(SAT_BANK.filter(q=>q.section==="rw"&&q.canonicalId===q.id&&!q.id.startsWith("exact-")).length===4200&&manifest.rwTotal===4200,"historical English import total preserved in archive");
ok(SAT_BANK.filter(q=>q.section==="math"&&q.canonicalId===q.id&&!q.id.startsWith("exact-")).length===4157&&manifest.mathTotal===4157,"historical Math import total preserved in archive");
const legacy=SAT_BANK.filter(q=>!q.id.startsWith("rw-scale-")&&!q.id.startsWith("exact-"));
ok(legacy.length===5195&&sha(JSON.stringify(legacy.map(q=>[q.id,q.passage,q.stem,q.choices,q.answer])))==="486f8f3f54335587bf6ba6f0ca396dd4a3eb8bda2bcfc9c5c4a28e44808b278b","every earlier question, option order and key unchanged");
ok(new Set(SAT_RW_SCALE.map(q=>q.id)).size===3191&&new Set(SAT_RW_SCALE.map(fingerprint)).size===3191,"unique IDs and complete conditions");
ok(refs.length===3191&&references.size===3191,"one audit reference per question");
const hosts=new Set(["en.wikipedia.org","en.wikibooks.org","en.wikinews.org","en.wikivoyage.org"]);
for(const q of SAT_RW_SCALE){
 const ref=references.get(q.id)!;
 ok(SAT_BY_ID.get(q.id)?.canonicalId===q.id&&q.section==="rw"&&q.id.length<=60,`${q.id}: active API-compatible ID`);
 ok(q.choices?.length===4&&q.choices.every(c=>c.trim())&&new Set(q.choices.map(normaliseText)).size===4,`${q.id}: distinct visible options`);
 for(let i=0;i<4;i++)ok(isCorrect(q,i)===(i===q.answer),`${q.id}: answer ${i}`);
 ok(!isCorrect(q,null)&&!isCorrect(q,""),`${q.id}: blank rejected`);
 const length=q.passage!.split(/\s+/).filter(Boolean).length;
 ok(length>=25&&length<=150,`${q.id}: complete SAT-length context`);
 ok(q.difficulty===2&&q.attribution?.license==="CC BY-SA 4.0"&&q.attribution.download==="/content/sat-rw-scale-2026.json"&&!!SAT_OPEN_SOURCES[q.attribution.sourceId],`${q.id}: preliminary level and rights`);
 const sourceUrl=new URL(q.attribution!.sourceUrl!);
 ok(sourceUrl.protocol==="https:"&&hosts.has(sourceUrl.hostname),`${q.id}: original-text attribution link`);
 ok(!("answerText"in q)&&!("blankStart"in q)&&!("originalAnswer"in q),`${q.id}: private audit fields excluded`);
 if(q.id.startsWith("rw-scale-bb-")){
  ok(q.purpose==="assessment"&&ref.source==="belebele",`${q.id}: native published MC`);
  ok(unescapeCurrency(q.stem)===ref.originalQuestion&&q.answer===ref.originalAnswer&&JSON.stringify(q.choices!.map(unescapeCurrency))===JSON.stringify(ref.originalChoices),`${q.id}: unchanged native question/options/key except documented currency escaping`);
  ok(sha(unescapeCurrency(q.passage!))===ref.contextHash,`${q.id}: native complete context retained`);
  ok(q.explanation.includes("не развёрнутый разбор"),`${q.id}: no invented source rationale`);
 }else{
  ok(q.purpose==="reinforcement",`${q.id}: generated language practice excluded from tests`);
  const passage=unescapeCurrency(q.passage!);
  let original=passage;
  if(ref.source==="squad-vocabulary"){
   original=passage.replace(/\*\*/g,"");
   ok(passage.match(/\*\*[^*]+\*\*/g)?.length===1&&q.choices![Number(q.answer)]===ref.answerText,`${q.id}: one word target and fixed meaning`);
  }else{
   ok(passage.split("______").length===2,`${q.id}: one edited slot`);
   original=passage.replace("______",q.choices![Number(q.answer)]);
   ok(q.choices![Number(q.answer)]===ref.answerText,`${q.id}: exact original form`);
  }
  ok(sha(original)===ref.contextHash,`${q.id}: filling key reconstructs source paragraph`);
  ok(q.explanation.split("— верно:").length===2&&q.explanation.split("— неверно:").length===4,`${q.id}: all language options explained`);
  ok(!q.attribution!.locator.includes("original transition"),`${q.id}: transition not revealed in source label`);
 }
 for(const text of [q.passage!,q.stem,...q.choices!,q.explanation]){
  const rendered=renderToStaticMarkup(createElement(RichText,{text}));
  ok(!!rendered&&!rendered.includes("katex-error")&&!rendered.includes("�"),`${q.id}: text renders`);
 }
}
ok(manifest.nativeReading===711&&manifest.reinforcement===2480&&manifest.grammarPractice===1480,"honest source/practice counts");
ok(manifest.vocabularyPractice===600&&manifest.transitionPractice===400&&manifest.adaptedReadingPractice===0,"language variety, no unreviewed MC distractor padding");
ok(manifest.uniquePassages===new Set(SAT_RW_SCALE.map(q=>q.passage)).size&&manifest.sourceParagraphs===new Set(refs.map(r=>r.contextHash)).size,"passages and questions reported separately");
ok(manifest.grammarFamilies===Object.keys(imported.grammarFamilies).length&&manifest.vocabularyFamilies===94&&manifest.transitionFamilies===5,"family counts disclosed");
for(const [domain,count]of Object.entries(manifest.domains))ok(SAT_RW_SCALE.filter(q=>q.domain===domain).length===count,`${domain}: real count`);
const download=JSON.parse(readFileSync("public/content/sat-rw-scale-2026.json","utf8"));
ok(JSON.stringify(download.questions)===JSON.stringify(SAT_RW_SCALE)&&JSON.stringify(download.manifest)===JSON.stringify(manifest),"download matches distributed keys and data");
ok(download.sourceNotices.ccBySa4.includes("Attribution-ShareAlike")&&download.sourceNotices.datasetLicenseEvidence.squad.sha256===imported.inputs.squad.sha256,"license and input hashes retained");
for(let seed=0;seed<8;seed++){
 const pool=SAT_ACTIVE_BANK.filter(q=>q.section==="rw");
 const first=selectAssessment(pool,27,[],[],rng(seed));
 const second=selectAssessment(pool,27,first,[],rng(seed+20));
 const test=[...first,...second];
 ok(test.length===54&&test.every(q=>q.purpose==="assessment"),"full test excludes new reinforcement");
 ok(new Set(test.map(q=>normaliseText(q.passage!))).size===54,"no passage repeats across modules");
}
console.log(`${checks} English archive assertions passed; 4,200 archived English, 3,191 archived additions (${manifest.nativeReading} native / ${manifest.reinforcement} reinforcement)`);
