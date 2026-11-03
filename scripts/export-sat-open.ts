/** Reproducible static distribution of the openly licensed content (not application code). */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { SAT_OPEN } from "../shared/satOpen";
import { SAT_OPEN_LICENSE, SAT_OPEN_SOURCES } from "../shared/satSources";
mkdirSync("public/content",{recursive:true});
writeFileSync("public/content/sat-open-2026.json",JSON.stringify({
  title:"365step open SAT-style practice adaptations, November 2026",
  authors:"365step contributors; original source authors credited per source and question",
  license:"CC BY-SA 4.0",licenseUrl:SAT_OPEN_LICENSE,
  notice:"Source texts and exercises are adapted; new questions, options and Russian solutions are by 365step. Not official SAT questions; no endorsement by College Board or source authors. Difficulty is editorial, not statistically calibrated. Source-text public-domain status is distinct from the license on these new adaptations. This content license does not license application code.",
  sourceNotices: {
    precalc:readFileSync(new URL("../docs/content/licenses/precalculus-2.3-notice.txt",import.meta.url),"utf8"),
    society:readFileSync(new URL("../docs/content/licenses/math-in-society-2.6-notice.txt",import.meta.url),"utf8"),
  },
  sources:SAT_OPEN_SOURCES,questions:SAT_OPEN,
},null,2)+"\n");
console.log(`Exported ${SAT_OPEN.length} licensed questions`);
