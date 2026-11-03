import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAT_OPEN } from "../shared/satOpen";
import { SAT_OPEN_MATH } from "../shared/satOpenMath";
import { SAT_OPEN_READING } from "../shared/satOpenReading";
import { SAT_ACTIVE_BANK, SAT_BY_ID, isCorrect } from "../shared/sat";
import { SAT_OPEN_SOURCES } from "../shared/satSources";
import { familyOf, fingerprint, selectAssessment } from "../shared/satQuality";
import { parseRational, choiceKey } from "../shared/numeric";
import { OPEN_MATH_REFERENCE } from "./sat-open-reference";

let checks=0;
function ok(value: unknown, message: string) { assert.ok(value,message); checks++; }
ok(SAT_OPEN.length===120&&SAT_OPEN_MATH.length===80&&SAT_OPEN_READING.length===40,"curated addition has 80 math and 40 reading items");
ok(SAT_OPEN.filter(q=>q.difficulty===3).length===50,"50 editorially Hard additions");
ok(new Set(SAT_OPEN.map(q=>q.id)).size===120,"stable unique IDs");
ok(new Set(SAT_OPEN.map(fingerprint)).size===120,"distinct question conditions");
ok(Object.keys(OPEN_MATH_REFERENCE).length===80,"independent reference covers all new Math");
for (const q of SAT_OPEN) {
  const live=SAT_BY_ID.get(q.id)!;
  ok(!!live&&live.canonicalId===q.id&&live.purpose==="assessment",`${q.id}: live assessment item`);
  ok(SAT_ACTIVE_BANK.some(old=>!old.id.startsWith("open-")&&old.section===q.section&&old.domain===q.domain&&old.skill===q.skill),`${q.id}: integrates into an existing topic`);
  ok(!!q.attribution&&!!SAT_OPEN_SOURCES[q.attribution.sourceId]&&!!q.attribution.locator&&q.attribution.changes.includes("CC BY-SA 4.0"),`${q.id}: source, locator, changes and license`);
  if(q.choices) ok(q.choices.length===4&&new Set(q.choices.map(c=>q.section==="math"?choiceKey(c):c.toLowerCase().trim())).size===4,`${q.id}: four distinct options`);
  ok(isCorrect(live,q.answer),`${q.id}: correct key accepted`);
  ok(!isCorrect(live,null)&&!isCorrect(live,""),`${q.id}: blank is not correct`);
}
for(const q of SAT_OPEN_MATH) {
  const want=OPEN_MATH_REFERENCE[q.id.replace("open-math-","")];
  ok(want!==undefined,`${q.id}: independent solution exists`);
  const key=q.choices?q.choices[Number(q.answer)]!:String(q.answer);
  if(typeof want==="string") ok(key===want,`${q.id}: separately reviewed statistical inference`);
  else {
    const r=parseRational(key);ok(!!r,`${q.id}: numeric key parses`);
    const got=Number(r!.n)/Number(r!.d);
    ok(Math.abs(got-want)<1e-9*Math.max(1,Math.abs(want)),`${q.id}: independent result ${want}, key ${got}`);
    if(!q.choices) ok(isCorrect(SAT_BY_ID.get(q.id)!,String(want)),`${q.id}: independent result accepted by checker`);
  }
}
for(const q of SAT_OPEN_READING) {
  const words=q.passage!.split(/\s+/).length;
  ok(words>=25&&words<=150,`${q.id}: SAT-length passage (${words})`);
  ok(["A","B","C","D"].every(letter=>q.explanation.includes(letter+" — ")),`${q.id}: all four choices explained`);
  ok(q.explanation.includes("— верно:")&&q.explanation.split("— неверно:").length===4,`${q.id}: unique supported answer with three distractor rationales`);
}
for(const section of ["math","rw"] as const) {
  const hard=SAT_ACTIVE_BANK.filter(q=>q.section===section&&q.difficulty===3);
  ok(hard.length>=20,`${section}: at least two ten-item Hard drills available`);
  const a=selectAssessment(hard,10,[],Array(10).fill(3));
  const b=selectAssessment(hard,10,a,Array(10).fill(3));
  ok(a.length===10&&b.length===10,`${section}: two nonrepeating Hard selections`);
  ok(new Set([...a,...b].map(fingerprint)).size===20,`${section}: no repeated Hard conditions`);
  const families=new Map<string,number>();for(const q of [...a,...b])families.set(familyOf(q),(families.get(familyOf(q))??0)+1);
  ok([...families.values()].every(n=>n<=2),`${section}: family cap across sets`);
}
const distributed=JSON.parse(readFileSync(new URL("../public/content/sat-open-2026.json",import.meta.url),"utf8"));
ok(distributed.license==="CC BY-SA 4.0"&&distributed.questions.length===120,"download provides licensed complete collection");
ok(distributed.sourceNotices.precalc.includes("Stitz")&&distributed.sourceNotices.precalc.includes("Collingwood")&&distributed.sourceNotices.society.includes("Eldridge"),"download preserves contributing-source author notices");
ok(JSON.stringify(distributed.questions)===JSON.stringify(SAT_OPEN),"download matches actual question text, attribution and answer keys");
console.log(`${checks} open SAT assertions passed; 80 independently checked Math, 40 edited RW, 50 new Hard`);
