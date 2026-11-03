/** Mixed-license content export. Application code and private verification inputs are excluded. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { SAT_SCALE, SAT_SCALE_SOURCE, SAT_SCALE_PRACTICE } from "../shared/satScale";
import { SAT_SCALE_READING } from "../shared/satScaleReading";
import { SAT_ACTIVE_BANK } from "../shared/sat";
import { SAT_OPEN_SOURCES } from "../shared/satSources";
import { familyOf } from "../shared/satQuality";

const active=SAT_ACTIVE_BANK.filter(q=>q.id.startsWith("scale-"));
const count=(items:typeof SAT_SCALE)=>({total:items.length,hard:items.filter(q=>q.difficulty===3).length,families:new Set(items.map(familyOf)).size});
const manifest={total:active.length,hard:active.filter(q=>q.difficulty===3).length,source:count(SAT_SCALE_SOURCE),reading:count(SAT_SCALE_READING),practice:count(SAT_SCALE_PRACTICE),bankTotal:SAT_ACTIVE_BANK.length,bankHard:SAT_ACTIVE_BANK.filter(q=>q.difficulty===3).length};
mkdirSync("public/content",{recursive:true});
writeFileSync("shared/satScaleManifest.json",JSON.stringify(manifest,null,2)+"\n");
writeFileSync("public/content/sat-scale-2026.json",JSON.stringify({
  title:"365step expanded offline SAT-style collection, November 2026",
  authors:"365step contributors; source authors credited per question and source",
  notice:"Not official SAT questions. Difficulty is editorial and has not been statistically calibrated. Generated variants are reinforcement, excluded from full assessment selection. Counts separate source-exercise adaptations, newly written reading items and procedural variants. Each question carries its own license; there is no blanket license for this mixed dataset or for application code.",
  manifest,
  licenses:{"CC BY 4.0":"https://creativecommons.org/licenses/by/4.0/","CC BY-SA 4.0":"https://creativecommons.org/licenses/by-sa/4.0/","Apache-2.0":"https://www.apache.org/licenses/LICENSE-2.0"},
  sourceNotices:{
    openstax:readFileSync("docs/content/licenses/openstax-2026-08-CC-BY-4.0.txt","utf8"),
    deepmind:readFileSync("scripts/vendor/mathematics_dataset/LICENSE","utf8"),
    precalc:readFileSync("docs/content/licenses/precalculus-2.3-notice.txt","utf8"),
    changes:"365step: SAT-format adaptations, options, new reading paraphrases, Russian solutions, topic and difficulty mapping; local deterministic practice generation. Original source notices retained. No College Board content imported.",
  },
  sources:Object.fromEntries([...new Set(SAT_SCALE.map(q=>q.attribution!.sourceId))].map(id=>[id,SAT_OPEN_SOURCES[id]])),
  questions:SAT_SCALE,
},null,2)+"\n");
console.log(JSON.stringify(manifest));
