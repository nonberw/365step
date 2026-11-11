import type { SatQuestion } from "./types";
import { topicFor } from "./satBankCatalog";
import { normaliseText } from "./satQuality";

/** Reference ceilings transcribed from the learner's screenshots, not claimed inventory. */
export const CURATION_TARGETS: Record<string, number> = {
  "cross-text-connections": 58, "text-structure-purpose": 138, "words-in-context": 238,
  transitions: 96, "rhetorical-synthesis": 134, "central-ideas-details": 123,
  "command-of-evidence": 257, inferences: 123, boundaries: 165, "form-structure-sense": 185,
  "equivalent-expressions": 40, "nonlinear-equations-systems": 96, "nonlinear-functions": 190,
  "linear-functions": 126, "linear-equations-one-variable": 77, "linear-equations-two-variables": 100,
  "linear-inequalities": 52, "linear-systems": 86, "area-volume": 75, circles: 41,
  "lines-angles-triangles": 62, "right-triangles-trigonometry": 46, "ratios-rates-units": 64,
  percentages: 56, "one-variable-data": 48, "two-variable-data": 38, probability: 24,
  "sample-statistics": 11, "statistical-claims": 2,
};
export const CURATION_REASONS: Record<string, string> = {
  duplicate: "Identical conditions already represented by another ID",
  elementary: "Preliminary editorial difficulty Easy: direct retrieval, rule or substitution",
  warmup: "Short introductory warmup rather than substantial SAT practice",
  "general-english": "Bulk general comprehension / automatic cloze import: weak SAT alignment, basic rule or key-only generic explanation",
  "mechanical-math": "Bulk mechanical dataset variant rather than contextual SAT reasoning",
  generated: "Legacy elementary generator series",
  "template-repeat": "At most two representatives of an explicit family",
  "numeric-repeat": "Same wording and algebraic structure with changed numeric parameters",
  "passage-repeat": "At most two questions using the same reading passage",
  "topic-ceiling": "Screenshot reference ceiling reached after quality and diversity screening",
};

/** Also recognizes LaTeX/Unicode and different variable names in numeric variants. */
export function curationSkeleton(q: SatQuestion): string {
  const text = normaliseText(`${q.passage ?? ""} ${q.stem}`)
    .replaceAll("−", "-").replaceAll("²", "^2").replaceAll("³", "^3").replaceAll("⁴", "^4")
    .replace(/\\(?:left|right|cdot|quad|[,;!])/g, "")
    .replace(/[+-]?\d+(?:[.,]\d+)?/g, "#")
    .replace(/\b[a-z]\b/g, "@")
    .replace(/\s*([{}()=+*/^$#@-])\s*/g, "$1").replace(/\s+/g, " ");
  return `${topicFor(q)?.id ?? q.skill}|${text}`;
}

export function selectCuratedBank(items: SatQuestion[]) {
  const selected: SatQuestion[] = [];
  const excluded: Record<string, string> = {};
  const families = new Map<string, number>(), shapes = new Set<string>(), passages = new Map<string, number>(), topics = new Map<string, number>();
  // Prefer substantive multi-step items; stable ID tie-break makes rebuilds reproducible.
  const ranked = [...items].sort((a, b) => b.difficulty - a.difficulty || a.id.localeCompare(b.id, "en"));
  for (const q of ranked) {
    const topic = topicFor(q)?.id ?? "", family = q.familyId ?? q.id;
    const shape = curationSkeleton(q), passage = normaliseText(q.passage ?? "");
    let reason = q.canonicalId !== q.id ? "duplicate"
      : q.difficulty === 1 ? "elementary"
      : q.purpose === "warmup" ? "warmup"
      : q.id.startsWith("rw-scale-") ? "general-english"
      : q.id.startsWith("scale-deepmind-") ? "mechanical-math"
      : q.source === "generated" ? "generated" : "";
    if (!reason && (families.get(family) ?? 0) >= 2) reason = "template-repeat";
    if (!reason && shapes.has(shape)) reason = "numeric-repeat";
    if (!reason && q.section === "rw" && (passages.get(passage) ?? 0) >= 2) reason = "passage-repeat";
    if (!reason && (topics.get(topic) ?? 0) >= (CURATION_TARGETS[topic] ?? Infinity)) reason = "topic-ceiling";
    if (reason) { excluded[q.id] = reason; continue; }
    selected.push(q); families.set(family, (families.get(family) ?? 0) + 1); shapes.add(shape);
    if (q.section === "rw") passages.set(passage, (passages.get(passage) ?? 0) + 1);
    topics.set(topic, (topics.get(topic) ?? 0) + 1);
  }
  // Archive order and IDs remain stable; display order is mixed separately.
  const ids = new Set(selected.map(q => q.id));
  return { selected: items.filter(q => ids.has(q.id)), excluded };
}
