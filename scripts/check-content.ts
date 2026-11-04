import { SAT_ACTIVE_BANK } from "../shared/sat";
import "./check-sat-open";
import "./check-sat-scale";
import "./check-sat-rw";
import "./check-sat-rw-scale";
import "./check-ent-open";
import "./check-ent-sources";
import { choiceKey, parseRational } from "../shared/numeric";
import { fingerprint } from "../shared/satQuality";
import { verifyGeneratedMath } from "./sat-math-reference";
import { IELTS_ACADEMIC } from "../server/content/ieltsAcademic";
import { READING } from "../server/content/ielts";
import { SAT_ORIGINAL } from "../shared/satOriginal";
import { SAT_DOMAINS } from "../shared/types";
import { REF } from "./coding-reference";
// Sanity checks for the synthetic content: run with `npm run check:content`.
import { SAT_BANK, isCorrect, freshMath } from "../shared/sat";
import { VOCAB } from "../shared/vocab";
import { PROBLEMS, sameAnswer } from "../shared/problems";
import { BLITZ } from "../shared/content";

let problems = 0;
const fail = (msg: string) => {
  problems++;
  console.log("✗", msg);
};

const ids = new Set<string>();
for (const q of [...SAT_BANK, ...Array.from({ length: 300 }, (_, i) => freshMath(i + 1))]) {
  if (ids.has(q.id) && !q.id.includes("-x")) fail(`duplicate id ${q.id}`);
  ids.add(q.id);
  for (const key of ["id", "section", "domain", "skill", "stem", "explanation", "source", "familyId", "purpose", "canonicalId"] as const) if (!q[key]) fail(`${q.id}: missing ${key}`);
  if (!["rw", "math"].includes(q.section) || !SAT_DOMAINS[q.section]?.includes(q.domain)) fail(`${q.id}: invalid section/domain`);
  if (!["bank", "generated", "ai"].includes(q.source)) fail(`${q.id}: invalid source`);
  if (!["warmup", "reinforcement", "assessment"].includes(q.purpose!)) fail(`${q.id}: invalid purpose`);
  for (const accepted of q.acceptedAnswers ?? []) if (!parseRational(accepted)) fail(`${q.id}: invalid accepted numeric value`);
  if (![1, 2, 3].includes(q.difficulty)) fail(`${q.id}: invalid difficulty`);
  if (/underlined/i.test(q.stem) && !/__(?!_)[\s\S]+?__/.test(q.passage ?? "")) fail(`${q.id}: missing underline markup`);
  if (q.choices) {
    if (q.choices.length !== 4) fail(`${q.id}: ${q.choices.length} choices`);
    if (new Set(q.choices.map((c) => q.section === "math" ? choiceKey(c) : c.toLowerCase().trim())).size !== q.choices.length) fail(`${q.id}: duplicate choices ${JSON.stringify(q.choices)}`);
    if (typeof q.answer !== "number" || q.answer < 0 || q.answer > 3) fail(`${q.id}: bad answer index`);
    if (!isCorrect(q, q.answer)) fail(`${q.id}: own answer rejected`);
  } else {
    if (!parseRational(q.answer)) fail(`${q.id}: invalid numeric answer`);
    if (!q.numericRule) fail(`${q.id}: missing exact/rounding rule`);
    if (!isCorrect(q, q.answer)) fail(`${q.id}: grid-in answer rejected`);
  }
  if (!q.explanation) fail(`${q.id}: no explanation`);
}

const conditions = new Set<string>();
for (const q of SAT_ACTIVE_BANK) { const key = fingerprint(q); if (conditions.has(key)) fail(`${q.id}: duplicate active conditions`); conditions.add(key); }
const math = verifyGeneratedMath([...SAT_BANK, ...Array.from({ length: 300 }, (_, i) => freshMath(i + 1))]);
for (const mismatch of math.mismatches) fail(`independent math: ${JSON.stringify(mismatch)}`);
for (const q of SAT_ORIGINAL) { const words = q.passage!.split(/\s+/).length; if (words < 100 || words > 150) fail(`${q.id}: original passage length ${words}`); }
const words = IELTS_ACADEMIC.passages.reduce((n, p) => n + p.passage.split(/\s+/).length, 0);
const examIds = new Set<string>();
const examQuestions = IELTS_ACADEMIC.passages.flatMap((p) => p.questions);
if (IELTS_ACADEMIC.passages.length !== 3 || words < 2150 || words > 2750 || examQuestions.length !== 40 || IELTS_ACADEMIC.minutes !== 60) fail("Academic Reading format");
for (const p of IELTS_ACADEMIC.passages) for (const q of p.questions) {
  if (examIds.has(q.id)) fail(`Academic duplicate id ${q.id}`); examIds.add(q.id);
  if (!q.why || !q.evidence || !p.passage.includes(q.evidence)) fail(`Academic ${q.id}: missing evidence in passage`);
  if (q.kind === "gap" && (!q.maxWords || !p.passage.toLowerCase().includes(q.answer.toLowerCase()))) fail(`Academic ${q.id}: completion not in text/word limit missing`);
  if (q.kind === "tfng" && !["TRUE","FALSE","NOT GIVEN"].includes(q.answer)) fail(`Academic ${q.id}: invalid TFNG key`);
  if (q.kind === "mcq" && (!q.options?.some((o) => o.startsWith(q.answer + " ")) || new Set(q.options).size !== 4)) fail(`Academic ${q.id}: invalid choice key`);
  if (q.kind === "headings" && !q.headingGroup?.options.some((o) => o.value === q.answer)) fail(`Academic ${q.id}: heading missing from shared list`);
}
for (const r of READING) {
  if (!r.id || !r.passage || !r.questions.length) fail(`Reading ${r.id}: missing content`);
  if (new Set(r.questions.map((q) => q.id)).size !== r.questions.length) fail(`Reading ${r.id}: duplicate question ids`);
  for (const q of r.questions) if (!q.answer || !q.why || !q.text) fail(`Reading ${r.id}/${q.id}: missing key or explanation`);
}
console.log(`Independent Math: ${math.checked}; Academic Reading: ${words} words / ${examQuestions.length} questions; unique active SAT conditions: ${SAT_ACTIVE_BANK.length}`);
const bySection = { rw: 0, math: 0 } as Record<string, number>;
for (const q of SAT_BANK) bySection[q.section]!++;
for (const u of VOCAB) if (u.words.length !== 10) fail(`vocab ${u.id}: ${u.words.length} words`);
for (const b of BLITZ) if (b.answer < 0 || b.answer >= b.options.length) fail(`blitz ${b.id}`);

// Reference solutions prove that every coding test is consistent.


for (const p of PROBLEMS) {
  const ref = REF[p.id];
  if (!ref) {
    fail(`no reference solution for ${p.id}`);
    continue;
  }
  p.tests.forEach((t, i) => {
    const got = ref(...(JSON.parse(JSON.stringify(t.args)) as unknown[]));
    if (!sameAnswer(got, t.expected, p.unordered, p.unorderedInner)) fail(`${p.id} test ${i + 1}: expected ${JSON.stringify(t.expected)}, reference gives ${JSON.stringify(got)}`);
  });
}

console.log(`SAT bank: ${SAT_BANK.length} questions (R&W ${bySection.rw}, Math ${bySection.math}) + unlimited generated variants`);
console.log(`Vocabulary: ${VOCAB.length} units · Coding: ${PROBLEMS.length} problems · Bug Blitz: ${BLITZ.length}`);
console.log(problems ? `${problems} problem(s) found` : "All content checks passed");
process.exit(problems ? 1 : 0);
