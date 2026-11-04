import { writeFileSync } from "node:fs";
import { SAT_RW_EXPANSION } from "../shared/satRw";
import { SAT_ACTIVE_BANK } from "../shared/sat";
import { SAT_OPEN_SOURCES } from "../shared/satSources";
import evidence from "../docs/content/sat-rw/source-snapshots.json";
const rw = SAT_ACTIVE_BANK.filter(q=>q.section==="rw");
const manifest = {
  total: SAT_RW_EXPANSION.length,
  hard: SAT_RW_EXPANSION.filter(q=>q.difficulty===3).length,
  uniquePassages: new Set(SAT_RW_EXPANSION.map(q=>q.passage)).size,
  sources: new Set(SAT_RW_EXPANSION.map(q=>q.attribution!.sourceId)).size,
  domains: Object.fromEntries([...new Set(SAT_RW_EXPANSION.map(q=>q.domain))].map(d=>[d,SAT_RW_EXPANSION.filter(q=>q.domain===d).length])),
  skills: Object.fromEntries([...new Set(SAT_RW_EXPANSION.map(q=>q.skill))].map(s=>[s,SAT_RW_EXPANSION.filter(q=>q.skill===s).length])),
  rwTotal: rw.length,
  rwHard: rw.filter(q=>q.difficulty===3).length,
  previousRwTotal: 649, // Historical baseline before this 360-item authored set.
};
writeFileSync("shared/satRwManifest.json",JSON.stringify(manifest,null,2)+"\n");
writeFileSync("public/content/sat-rw-open-2026.json",JSON.stringify({
  title:"365step Reading & Writing: open-source-based practice, November 2026",
  authors:"365step; primary authors credited per question",
  notice:"Newly authored SAT-style questions and critical paraphrases of the cited works, not official College Board items or exercises copied from the books. Difficulty is editorial, not statistically calibrated. The 360 questions include different skills applied to shared passages: passage counts are reported separately. Source ideas and new wording are distinguished in the evidence; no modern translations, annotations, artwork or source-question datasets are incorporated.",
  license:"CC BY-SA 4.0",licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
  changes:"365step authored passages, notes, hypothetical opposing positions, questions, distractors, Russian explanations and skill/difficulty mapping. Source dates and locators identify the basis of discussion, not verbatim quotations.",
  manifest,sources:Object.fromEntries([...new Set(SAT_RW_EXPANSION.map(q=>q.attribution!.sourceId))].map(id=>[id,SAT_OPEN_SOURCES[id]])),
  sourceEvidence:evidence,questions:SAT_RW_EXPANSION,
},null,2)+"\n");
console.log(JSON.stringify(manifest,null,2));
