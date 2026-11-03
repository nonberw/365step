import type { Difficulty, SatQuestion } from "./types";
import reviews from "./satDifficulty.json";

export const normaliseText = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
export const fingerprint = (q: Pick<SatQuestion, "section" | "passage" | "stem">) => `${q.section}|${normaliseText(q.passage ?? "")}|${normaliseText(q.stem)}`;
const hash = (s: string) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
};
export function familyOf(q: SatQuestion): string {
  if (q.familyId) return q.familyId;
  if (q.source === "generated") return q.id.replace(/-(?:\d+|x\d+)$/, "");
  // Same wording with changed numeric parameters is one family, across Easy/Medium/Hard imports.
  const skeleton = fingerprint(q).replace(/[−+-]?\d+(?:[.,]\d+)?/g, "#");
  return `${q.section}:${q.skill}:${hash(skeleton)}`;
}

/** Preserve original IDs and option indices. Canonical IDs affect new selection only. */
export function annotateBank(items: SatQuestion[]): SatQuestion[] {
  const canonical = new Map<string, string>();
  return items.map((item) => {
    const q = { ...item };
    if (!q.choices) {
      q.numericRule ??= /nearest (?:hundredth|0\.01)/i.test(q.stem) ? { kind: "rounded", places: 2 }
        : /nearest tenth/i.test(q.stem) ? { kind: "rounded", places: 1 }
        : /nearest (?:whole|integer)/i.test(q.stem) ? { kind: "rounded", places: 0 } : { kind: "exact" };
    }
    const review = (reviews as Record<string, { difficulty: number; reason: string }>)[q.id];
    if (review) {
      q.difficultyReview = { basis: "editorial", previous: 3, reason: review.reason };
      q.difficulty = review.difficulty as Difficulty;
    }
    if (q.id === "rw-sec-05") q.passage = q.passage!.replace("Lise Meitner ______", "Lise ______");
    if (q.id === "x-rw-boundaries-h04") q.passage = q.passage!.replace(/^Pando ______/, "______");
    if (q.id === "x-rw-quantitative-evidence-h10") q.passage = q.passage!.replace("has become more important than its role as a source of books", "has grown while its role as a source of books has declined");
    if (q.id === "x-rw-transitions-h15") q.choices = q.choices!.map((c) => c === "Accordingly," ? "For example," : c);
    if (q.id === "x-rw-text-structure-h08") q.passage = q.passage!.replace("The ice at a glacier's front may be centuries younger than the ice that fell as snow at its head, having traveled the length of the valley over hundreds of years.", "Ice reaching a glacier's front may have begun as snow far up the valley centuries earlier, having traveled slowly downhill over that time.");
    if (q.id === "x-math-nonlinear-equations-h15") q.stem = q.stem.replace("a is a constant", "a is a nonzero constant");
    q.familyId = familyOf(q);
    q.purpose ??= q.section === "rw" && (q.passage ?? "").split(/\s+/).filter(Boolean).length < 25 ? "warmup"
      : q.source === "generated" ? "reinforcement" : "assessment";
    const key = fingerprint(q);
    q.canonicalId = canonical.get(key) ?? q.id;
    canonical.set(key, q.canonicalId);
    return q;
  });
}

/** Strict constraints never relax: no identical conditions, at most two variants per family across the test. */
export function selectAssessment(pool: SatQuestion[], count: number, previous: SatQuestion[] = [], plan: Difficulty[] = [], random = Math.random): SatQuestion[] {
  const chosen: SatQuestion[] = [];
  const seen = new Set(previous.map(fingerprint));
  const families = new Map<string, number>();
  for (const q of previous) families.set(familyOf(q), (families.get(familyOf(q)) ?? 0) + 1);
  const weights: Record<string, number> = pool[0]?.section === "math"
    ? { Algebra: .35, "Advanced Math": .35, "Problem-Solving and Data Analysis": .15, "Geometry and Trigonometry": .15 }
    : { "Information and Ideas": .26, "Craft and Structure": .28, "Expression of Ideas": .20, "Standard English Conventions": .26 };
  const positions = [0, 0, 0, 0];
  for (const q of previous) if (q.choices) positions[Number(q.answer)]!++;
  for (let i = 0; i < count; i++) {
    const candidates = pool.filter((q) => q.purpose === "assessment" && (!q.canonicalId || q.canonicalId === q.id) && !seen.has(fingerprint(q)) && (families.get(familyOf(q)) ?? 0) < 2);
    if (!candidates.length) break;
    const target = plan[i] ?? 2;
    const wantSpr = pool[0]?.section === "math" && chosen.filter((q) => !q.choices).length < Math.round((i + 1) * .25);
    const score = (q: SatQuestion) => {
      const domainCount = chosen.filter((c) => c.domain === q.domain).length;
      const deficit = (weights[q.domain] ?? .1) * count - domainCount;
      const positionPenalty = q.choices ? positions[Number(q.answer)]! - Math.min(...positions) : 0;
      return Math.abs(q.difficulty - target) * 2 - deficit * 3 + positionPenalty * 2 + (pool[0]?.section === "math" && !q.choices !== wantSpr ? 2 : 0) + random();
    };
    const q = candidates.map((q) => ({ q, s: score(q) })).sort((a, b) => a.s - b.s)[0]!.q;
    chosen.push(q); seen.add(fingerprint(q));
    families.set(familyOf(q), (families.get(familyOf(q)) ?? 0) + 1);
    if (q.choices) positions[Number(q.answer)]!++;
  }
  return chosen;
}
