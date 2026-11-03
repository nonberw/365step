import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SAT_BANK, SAT_BY_ID, SAT_ACTIVE_BANK, freshMath, isCorrect } from "../shared/sat";
import { familyOf, fingerprint, selectAssessment } from "../shared/satQuality";
import { choiceKey, numericEqual, parseRational } from "../shared/numeric";
import { checkReading, transcriptCriteria } from "../shared/ieltsAssessment";
import { IELTS_ACADEMIC } from "../server/content/ieltsAcademic";
import { SAT_ORIGINAL } from "../shared/satOriginal";
import { RichText } from "../src/components/RichText";
import { sameAnswer } from "../shared/answer";
import { isUsableEnt } from "../shared/entQuality";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Import AI only after isolating storage and disabling all provider credentials.
process.env.DB_FILE = join(mkdtempSync(join(tmpdir(), "365step-regressions-")), "test.sqlite");
process.env.TURSO_DATABASE_URL = ""; process.env.DATABASE_URL = ""; process.env.ANTHROPIC_API_KEY = "";
const { demoEnt, ieltsSpeaking, ieltsWriting } = await import("../server/ai");

let checks = 0;
function ok(value: unknown, message: string) { assert.ok(value, message); checks++; }
const bus = SAT_BY_ID.get("m-ratio-04")!;
for (const value of ["100/3", "200/6", "33.333333333333336", "33,333333333333336"]) ok(isCorrect(bus, value), `bus accepts ${value}`);
for (const value of ["33.33", "33.333", "100/0", "", null, false, "0x21", "Infinity", "33 33", "1/2/3"]) ok(!isCorrect(bus,value), `bus rejects ${value}`);
ok(!bus.explanation.includes("0.83"), "bus explanation retains exact time");
ok(numericEqual("2/4","0.5"), "equivalent fractions");
ok(!numericEqual("0.50001","0.5"), "no blanket 1e-3 tolerance");
ok(numericEqual("-1.235","-1.24",{kind:"rounded",places:2}), "negative half rounding");
ok(numericEqual("3.14159","3.14",{kind:"rounded",places:2}), "explicit hundredth rounding");
ok(!numericEqual("3.15","3.14",{kind:"rounded",places:2}), "outside rounded interval");
ok(choiceKey("$\\frac{2}{4}$")===choiceKey("0.5"),"equivalent choice detection");
ok(choiceKey("4,200")!==choiceKey("4.2"),"English thousands in options");
ok(parseRational(".5")?.n===1n,"leading decimal point");
ok(!isCorrect({ ...bus, choices:["0","1","2","3"],answer:0 },null),"unanswered MCQ never becomes A");
for (const q of SAT_BANK.filter(q=>q.id.startsWith("m-ratio-"))) {
  const [speed,time] = [...q.stem.matchAll(/\d+/g)].map(x=>Number(x[0]));
  ok(isCorrect(q,`${speed!*time!}/60`),`${q.id} independent exact rate`);
}
for (let seed=1;seed<=2000;seed++) {
  const q=freshMath(seed);
  ok(q.purpose==="reinforcement"&&!!q.familyId,"fresh variants tagged as reinforcement");
  if(q.choices) ok(!q.choices.some(c=>/[′″]/.test(c))&&new Set(q.choices.map(choiceKey)).size===4,`fresh ${seed} meaningful unique options`);
}
for(const [id,head] of [["rw-gen-sva-09","One"],["rw-gen-sva-10","One"],["rw-gen-sva-15","members"],["rw-gen-sva-16","members"]]) {
  const q=SAT_BY_ID.get(id!)!; ok(q.subjectHead===head&&q.explanation.includes(`«${head}»`),`${id} explicit subject head`);
}
for(const [id,fragment] of [["rw-gen-bd-06","the inability"],["rw-gen-bd-08","the possibility"]]) ok(SAT_BY_ID.get(id!)!.passage!.includes(fragment!) && SAT_BY_ID.get(id!)!.choices![Number(SAT_BY_ID.get(id!)!.answer)]!.endsWith(":"),`${id} colon introduces a noun phrase, not an independent clause`);
for(const id of ["m-trig-01","x-math-two-variable-data-h01","x-rw-form-structure-sense-h01"]) ok(SAT_BY_ID.get(id)!.difficulty===1,`${id} easy by content`);
ok(SAT_BANK.filter(q=>q.difficultyReview?.previous===3).length===495,"all formerly Hard IDs reviewed");
const underlineItems=SAT_BANK.filter(q=>/__[\s\S]+?__/.test(q.passage??""));
ok(underlineItems.length>=19,"all old underline items remain");
for(const q of underlineItems) ok(renderToStaticMarkup(createElement(RichText,{text:q.passage!})).includes("<u>"),`${q.id} underline renders`);
ok(renderToStaticMarkup(createElement(RichText,{text:"__area $x^2$__"})).includes("katex"),"nested underline and math");
for(let trial=0;trial<60;trial++) for(const section of ["rw","math"] as const) {
  const pool=SAT_ACTIVE_BANK.filter(q=>q.section===section),size=section==="rw"?27:22;
  const a=selectAssessment(pool,size,[],Array(size).fill(trial%3+1));
  const b=selectAssessment(pool,size,a,Array(size).fill(3));
  const all=[...a,...b];
  ok(a.length===size&&b.length===size,"full assessment modules available");
  ok(new Set(all.map(fingerprint)).size===all.length,"no identical conditions across modules");
  ok(all.every(q=>q.purpose==="assessment"),"warmup/reinforcement excluded");
  const counts=new Map<string,number>();for(const q of all)counts.set(familyOf(q),(counts.get(familyOf(q))??0)+1);
  ok([...counts.values()].every(n=>n<=2),"family cap across modules");
}
// Separately edited keys for the new reading scenarios, not calculated by the checker.
const satKeys=[1,3,0,2,1,3,0,2,1,3];
SAT_ORIGINAL.forEach((q,i)=>ok(q.answer===satKeys[i],`${q.id} reviewed key`));
const academic=IELTS_ACADEMIC.passages.flatMap(p=>p.questions);
const keys=["iv","vi","ii","viii","v","iii","FALSE","FALSE","NOT GIVEN","batch","paper","weekend","knowledge","TRUE","TRUE","FALSE","FALSE","NOT GIVEN","glare","traps","handrail","collisions","C","A","D","B","FALSE","FALSE","FALSE","TRUE","NOT GIVEN","counterfactual","months","follow-up","teaching","activity","C","A","D","B"];
academic.forEach((q,i)=>ok(q.answer===keys[i],`Academic ${q.id} separately edited key`));
const perfect=checkReading(academic,Object.fromEntries(academic.map((q,i)=>[q.id,keys[i]!])));
ok(perfect.right===40&&perfect.band===null,"full author exam has raw40, no unsupported band calibration");
const short=checkReading(academic.slice(6,11),Object.fromEntries(academic.slice(6,11).map(q=>[q.id,q.answer])));
ok(short.right===5&&short.percentage===100&&short.band===null,"5/5 never becomes Band 9");
const reused=checkReading(academic.slice(0,6),{"1":"iv","2":"iv"});ok(reused.right===0,"repeated heading rejected server-side");
ok(!checkReading([academic[9]!],{"10":"seed batch"}).items[0]!.correct,"word limit enforced");
const partial=transcriptCriteria([{name:"Fluency and Coherence",band:6,comment:""},{name:"Lexical Resource",band:7,comment:""},{name:"Grammatical Range and Accuracy",band:8,comment:""},{name:"Pronunciation",band:9,comment:"fabricated"}]);
ok(partial.overall===7&&partial.criteria.at(-1)!.band===null,"pronunciation excluded even if AI returns a number");
for(const id of ["history-kz","physics","reading"])ok(demoEnt(id,"Древнейшая история Казахстана","single",10,"ru").length===0,"unsupported demo returns no math substitution");
ok(demoEnt("math-lit","Проценты, доли и пропорции","single",10,"kk").length===0,"demo language honored");
for(let n=0;n<50;n++)for(const q of demoEnt("math-lit","Проценты, доли и пропорции","single",10,"ru"))ok(isUsableEnt(q),"demo options unique and subject-aligned");
const q=demoEnt("math-lit","Проценты, доли и пропорции","single",1,"ru")[0]!;
ok(!isUsableEnt({...q,subject:"history-kz"}),"legacy seed misclassification quarantined");
ok(!isUsableEnt({...q,options:["0.5","1/2","1","2"]}),"equivalent ENT options rejected");
ok(!sameAnswer([[1,2],[2,1]],[[1,2],[1,2]],true),"permutation inner order preserved");
ok(sameAnswer([["eat","tea"],["x"]],[["x"],["tea","eat"]],true,true),"anagram group order ignored intentionally");
if(!process.env.ANTHROPIC_API_KEY) {
  const writing=await ieltsWriting(2,"Demo task","A word. ".repeat(100));
  const speaking=await ieltsSpeaking(2,"Demo prompt","word ".repeat(150),60);
  ok(writing.overall===null&&writing.predicted===null&&writing.criteria.every(c=>c.band===null),"no demo writing bands");
  ok(speaking.overall===null&&speaking.criteria.every(c=>c.band===null),"no demo speaking bands");
}
console.log(`${checks} regression assertions passed`);
