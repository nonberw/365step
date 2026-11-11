import { readFileSync, writeFileSync } from "node:fs";
import { SAT_RW_SCALE } from "../shared/satRwScale";
import { SAT_BANK } from "../shared/sat";
import { SAT_OPEN_SOURCES } from "../shared/satSources";
import imported from "../docs/content/sat-rw-scale/import.json";
// Historical source downloads retain their complete contents after active-bank curation.
const archive=SAT_BANK.filter(q=>q.canonicalId===q.id);
const active=archive.filter(q=>q.id.startsWith("rw-scale-"));
const manifest={total:active.length,nativeReading:active.filter(q=>q.id.startsWith("rw-scale-bb-")).length,
  reinforcement:active.filter(q=>q.purpose==="reinforcement").length,
  adaptedReadingPractice:imported.adaptedReadingPractice,vocabularyPractice:imported.vocabularyPractice,
  transitionPractice:imported.transitionPractice,grammarPractice:imported.grammarPractice,
  uniquePassages:new Set(active.map(q=>q.passage)).size,sourceParagraphs:imported.sourceParagraphs,
  grammarFamilies:Object.keys(imported.grammarFamilies).length,vocabularyFamilies:Object.keys(imported.vocabularyFamilies).length,
  transitionFamilies:Object.keys(imported.transitionFamilies).length,
  domains:Object.fromEntries([...new Set(active.map(q=>q.domain))].map(d=>[d,active.filter(q=>q.domain===d).length])),
  rwTotal:archive.filter(q=>q.section==="rw").length,mathTotal:archive.filter(q=>q.section==="math").length,
  bankTotal:archive.length};
writeFileSync("shared/satRwScaleManifest.json",JSON.stringify(manifest,null,2)+"\n");
writeFileSync("public/content/sat-rw-scale-2026.json",JSON.stringify({
  title:"365step expanded English reading and language practice — November 2026",
  authors:"Belebele and SQuAD authors; Wikipedia/Wikimedia contributors credited via each original text URL; 365step adaptations",
  notice:"Not official SAT questions. Native Belebele multiple-choice questions preserve options and published keys; no detailed source rationales are claimed. Controlled vocabulary/transition/grammar exercises use complete SQuAD English paragraphs, are explicitly reinforcement, and are excluded from full tests. No SQuAD MC distractor conversion is included. Preliminary Medium labels are not empirically calibrated difficulty ratings. Original keys, source snapshots, modifications and question/passages counts are distinguished.",
  license:"CC BY-SA 4.0",licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
  sources:Object.fromEntries([...new Set(SAT_RW_SCALE.map(q=>q.attribution!.sourceId))].map(id=>[id,SAT_OPEN_SOURCES[id]])),
  sourceNotices:{ccBySa4:readFileSync("docs/content/sat-rw-scale/belebele-license.txt","utf8"),datasetLicenseEvidence:imported.inputs,
    changes:"365step: selection, UI formatting, source-linked provenance, commentary, explicit practice labels, and controlled vocabulary/transition/grammar transformations. Original Wikipedia paragraph content is unchanged except indicated blanks/highlights and literal currency escaping. No NC training assemblies, College Board materials or third-party runtime API used."},
  manifest,questions:SAT_RW_SCALE,
},null,2)+"\n");
console.log(JSON.stringify(manifest,null,2));
