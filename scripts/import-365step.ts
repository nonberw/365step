// Converts the 365step task bank (one JSON file per skill) into shared/bank365.json,
// the format this project uses: SatQuestion[], IELTS Reading sets, Writing Task 2 prompts and Speaking prompts.
//
//   npx tsx scripts/import-365step.ts "<path to 365step>/src/content/bank"
//
// The output is committed, so the importer only runs when the source bank changes.

import fs from "node:fs";
import path from "node:path";
import type { Difficulty, IeltsChoiceQuestion, SatDomain, SatQuestion, SatSection } from "../shared/types";

const dir = process.argv[2];
if (!dir) throw new Error("Pass the path to 365step/src/content/bank");

const SAT_DOMAIN: Record<string, SatDomain> = {
  "information-and-ideas": "Information and Ideas",
  "craft-and-structure": "Craft and Structure",
  "expression-of-ideas": "Expression of Ideas",
  "standard-english-conventions": "Standard English Conventions",
  algebra: "Algebra",
  "advanced-math": "Advanced Math",
  "problem-solving-data": "Problem-Solving and Data Analysis",
  "geometry-trigonometry": "Geometry and Trigonometry",
};

// Skill names follow the ones already used in shared/sat.ts so filters group both banks together.
const SAT_SKILL: Record<string, string> = {
  boundaries: "Boundaries",
  "central-ideas": "Central Ideas and Details",
  "cross-text": "Cross-Text Connections",
  "form-structure-sense": "Form, Structure, and Sense",
  inferences: "Inferences",
  "quantitative-evidence": "Command of Evidence (Quantitative)",
  "rhetorical-synthesis": "Rhetorical Synthesis",
  "text-structure": "Text Structure and Purpose",
  "textual-evidence": "Command of Evidence (Textual)",
  transitions: "Transitions",
  "words-in-context": "Words in Context",
  "area-volume": "Area and volume",
  circles: "Circles",
  "equivalent-expressions": "Equivalent expressions",
  inequalities: "Linear inequalities",
  "linear-equations-one": "Linear equations in one variable",
  "linear-equations-two": "Linear equations in two variables",
  "linear-functions": "Linear functions",
  "lines-angles-triangles": "Lines, angles, and triangles",
  "nonlinear-equations": "Nonlinear equations",
  "nonlinear-functions": "Nonlinear functions",
  "one-variable-data": "One-variable data",
  percentages: "Percentages",
  probability: "Probability",
  "ratios-rates": "Ratios, rates, and units",
  "right-triangles": "Right triangles",
  "sample-statistics": "Sample statistics",
  "statistical-claims": "Statistical claims",
  systems: "Systems of linear equations",
  "two-variable-data": "Two-variable data",
};

const DIFFICULTY: Record<string, Difficulty> = { easy: 1, medium: 2, hard: 3 };

interface Item {
  id: string;
  difficulty: string;
  type: string;
  stem: string;
  passage?: string;
  passage2?: string;
  passageRef?: string;
  table?: { caption?: string; head: string[]; rows: string[][] };
  choices?: string[];
  answer: number | string | string[];
  explanation?: string;
  taskKind?: string;
  part?: number;
  questions?: string[];
  cueCard?: { topic: string; points: string[] };
}
interface Passage {
  id: string;
  title: string;
  text: string;
  source: string;
  license: string;
}
interface BankFile {
  defaults: { domain: string; skill: string; source?: string; license?: string };
  passages?: Passage[];
  items: Item[];
}

const read = (rel: string): BankFile => JSON.parse(fs.readFileSync(path.join(dir, rel), "utf8"));
const files = (rel: string) => fs.readdirSync(path.join(dir, rel)).filter((f) => f.endsWith(".json")).sort();
const problems: string[] = [];

// ---------- SAT ----------
// The passage pane renders **bold** as a highlighter mark, so captions and labels stay plain text.

const mdTable = (t: NonNullable<Item["table"]>) => [t.caption ?? "", `| ${t.head.join(" | ")} |`, ...t.rows.map((r) => `| ${r.join(" | ")} |`)].filter(Boolean).join("\n");

function sat(section: SatSection): SatQuestion[] {
  const out: SatQuestion[] = [];
  for (const f of files(`sat/${section}`)) {
    const file = read(`sat/${section}/${f}`);
    const { domain, skill } = file.defaults;
    const domainName = SAT_DOMAIN[domain];
    const skillName = SAT_SKILL[skill];
    if (!domainName || !skillName) {
      problems.push(`${f}: unknown domain/skill ${domain}/${skill}`);
      continue;
    }
    for (const it of file.items) {
      const id = `x-${section}-${skill}-${it.id}`;
      let passage = it.passage;
      if (it.passage2) passage = `Text 1\n\n${it.passage}\n\nText 2\n\n${it.passage2}`;
      if (it.table) passage = [passage, mdTable(it.table)].filter(Boolean).join("\n\n");
      const base = { id, section, domain: domainName, skill: skillName, difficulty: DIFFICULTY[it.difficulty]!, ...(passage ? { passage } : {}), stem: it.stem, explanation: it.explanation ?? "", source: "bank" as const };
      if (!base.difficulty || !base.explanation) {
        problems.push(`${id}: missing difficulty or explanation`);
        continue;
      }
      if (it.type === "mcq") {
        if (!it.choices || typeof it.answer !== "number" || it.answer >= it.choices.length) {
          problems.push(`${id}: bad mcq`);
          continue;
        }
        out.push({ ...base, choices: it.choices, answer: it.answer });
      } else if (it.type === "grid-in") {
        const answers = Array.isArray(it.answer) ? it.answer : [String(it.answer)];
        if (!answers.length) {
          problems.push(`${id}: bad grid-in`);
          continue;
        }
        out.push({ ...base, answer: answers[0]! });
      } else problems.push(`${id}: unsupported type ${it.type}`);
    }
  }
  return out;
}

// ---------- IELTS Reading ----------

const SKILL_TITLE: Record<string, string> = {
  completion: "Completion",
  "matching-headings": "Matching headings",
  "matching-information": "Matching information",
  mcq: "Multiple choice",
  "short-answer": "Short answer",
  tfng: "True / False / Not Given",
  ynng: "Yes / No / Not Given",
};

interface ReadingSet {
  id: string;
  title: string;
  level: string;
  passage: string;
  difficulty: Difficulty;
  questions: (IeltsChoiceQuestion & { answer: string; why: string })[];
}

const LETTERS = "ABCDEFGH";

function reading(): ReadingSet[] {
  const out: ReadingSet[] = [];
  for (const f of files("ielts/reading")) {
    const file = read(`ielts/reading/${f}`);
    const skill = file.defaults.skill;
    const byPassage = new Map<string, Item[]>();
    for (const it of file.items) {
      if (!it.passageRef) {
        problems.push(`reading ${skill}/${it.id}: no passageRef`);
        continue;
      }
      byPassage.set(it.passageRef, [...(byPassage.get(it.passageRef) ?? []), it]);
    }
    for (const p of file.passages ?? []) {
      const items = byPassage.get(p.id);
      if (!items?.length) continue;
      const questions: ReadingSet["questions"] = [];
      items.forEach((it, i) => {
        const id = String(i + 1);
        const why = it.explanation ?? "";
        if (skill === "tfng") {
          const answer = ["TRUE", "FALSE", "NOT GIVEN"][it.answer as number];
          if (!answer) return problems.push(`reading ${skill}/${it.id}: bad answer`);
          questions.push({ id, kind: "tfng", text: it.stem.replace(/^Does the following statement agree with the information in the passage\? Choose TRUE, FALSE or NOT GIVEN\.\s*/, ""), answer, why });
        } else if (it.type === "short-answer") {
          if (!Array.isArray(it.answer)) return problems.push(`reading ${skill}/${it.id}: bad answer`);
          questions.push({ id, kind: "gap", text: it.stem, answer: it.answer.join("|"), why });
        } else if (it.type === "mcq" && it.choices && typeof it.answer === "number" && it.answer < it.choices.length) {
          // The UI submits the first letter of an option, so options are "A text".
          const options = it.choices.map((c, j) => `${LETTERS[j]} ${c}`);
          questions.push({ id, kind: "mcq", text: it.stem, options, answer: LETTERS[it.answer]!, why });
        } else problems.push(`reading ${skill}/${it.id}: unsupported item`);
      });
      if (!questions.length) continue;
      // "**A** text" paragraph markers become plain "A text" lines, as in the hand-written sets.
      let text = p.text.replace(/\*\*([A-H])\*\*\s*/g, "$1 ");
      if (p.source !== "original") text += `\n\nИсточник: ${p.source} (${p.license}).`;
      const difficulty = Math.max(...items.map((i) => DIFFICULTY[i.difficulty] ?? 1)) as Difficulty;
      out.push({ id: `b-${skill}-${p.id}`, title: p.title, level: `Academic · ${SKILL_TITLE[skill] ?? skill}`, passage: text, difficulty, questions });
    }
  }
  return out;
}

// ---------- IELTS Writing / Speaking ----------

function writing2() {
  return read("ielts/writing/task2.json").items.map((it) => ({ id: `b-w2-${it.id}`, type: it.taskKind ?? "opinion", prompt: it.stem.replace(/^Write about the following topic:\s*/, "") }));
}

function speaking() {
  const part1 = read("ielts/speaking/part1.json").items.map((it) => ({
    id: `b-s1-${it.id}`,
    topic: (/Let's talk about (.+?)\.?$/.exec(it.stem)?.[1] ?? "General").replace(/^./, (c) => c.toUpperCase()),
    questions: it.questions ?? [],
  }));
  const p3 = read("ielts/speaking/part3.json").items;
  const part2 = read("ielts/speaking/part2.json").items.flatMap((it, i) => {
    if (!it.cueCard) return (problems.push(`speaking part2/${it.id}: no cue card`), []);
    return [{ id: `b-s2-${it.id}`, topic: it.cueCard.topic, points: it.cueCard.points, part3: (p3[i]?.questions ?? []).slice(0, 4) }];
  });
  return { part1, part2 };
}

const bank = { sat: [...sat("rw"), ...sat("math")], reading: reading(), writing2: writing2(), speaking: speaking() };
const out = path.join(import.meta.dirname, "..", "shared", "bank365.json");
fs.writeFileSync(out, JSON.stringify(bank));
console.log(`SAT ${bank.sat.length}, reading sets ${bank.reading.length} (${bank.reading.reduce((n, r) => n + r.questions.length, 0)} questions), writing2 ${bank.writing2.length}, speaking ${bank.speaking.part1.length}+${bank.speaking.part2.length}`);
if (problems.length) {
  console.log(`${problems.length} skipped:\n${problems.slice(0, 20).join("\n")}`);
}
