import type { SatDomain, SatQuestion, SatSection } from "./types";

export interface BankTopic { id: string; title: string; section: SatSection; domain: SatDomain; skills: string[] }
const topic = (id: string, title: string, section: SatSection, domain: SatDomain, ...skills: string[]): BankTopic => ({ id, title, section, domain, skills });

/** Public SAT skill taxonomy. Aliases preserve the older bank's IDs, text and keys. */
export const BANK_TOPICS: BankTopic[] = [
  topic("cross-text-connections", "Cross-Text Connections", "rw", "Craft and Structure", "Cross-Text Connections"),
  topic("text-structure-purpose", "Text Structure and Purpose", "rw", "Craft and Structure", "Text Structure and Purpose"),
  topic("words-in-context", "Words in Context", "rw", "Craft and Structure", "Words in Context"),
  topic("transitions", "Transitions", "rw", "Expression of Ideas", "Transitions"),
  topic("rhetorical-synthesis", "Rhetorical Synthesis", "rw", "Expression of Ideas", "Rhetorical Synthesis"),
  topic("central-ideas-details", "Central Ideas and Details", "rw", "Information and Ideas", "Central Ideas and Details"),
  topic("command-of-evidence", "Command of Evidence", "rw", "Information and Ideas", "Command of Evidence (Textual)", "Command of Evidence (Quantitative)", "Command of Evidence"),
  topic("inferences", "Inferences", "rw", "Information and Ideas", "Inferences"),
  topic("boundaries", "Boundaries", "rw", "Standard English Conventions", "Boundaries"),
  topic("form-structure-sense", "Form, Structure, and Sense", "rw", "Standard English Conventions", "Form, Structure, and Sense", "Subject-Verb Agreement"),
  topic("equivalent-expressions", "Equivalent Expressions", "math", "Advanced Math", "Equivalent expressions"),
  topic("nonlinear-equations-systems", "Nonlinear Equations and Systems", "math", "Advanced Math", "Nonlinear equations"),
  topic("nonlinear-functions", "Nonlinear Functions", "math", "Advanced Math", "Nonlinear functions", "Quadratic functions", "Exponential models"),
  topic("linear-functions", "Linear Functions", "math", "Algebra", "Linear functions", "Linear models"),
  topic("linear-equations-one-variable", "Linear Equations in One Variable", "math", "Algebra", "Linear equations in one variable"),
  topic("linear-equations-two-variables", "Linear Equations in Two Variables", "math", "Algebra", "Linear equations in two variables"),
  topic("linear-inequalities", "Linear Inequalities in One or Two Variables", "math", "Algebra", "Linear inequalities"),
  topic("linear-systems", "Systems of Two Linear Equations in Two Variables", "math", "Algebra", "Systems of linear equations"),
  topic("area-volume", "Area and Volume", "math", "Geometry and Trigonometry", "Area and volume"),
  topic("circles", "Circles", "math", "Geometry and Trigonometry", "Circles"),
  topic("lines-angles-triangles", "Lines, Angles, and Triangles", "math", "Geometry and Trigonometry", "Lines, angles, and triangles"),
  topic("right-triangles-trigonometry", "Right Triangles and Trigonometry", "math", "Geometry and Trigonometry", "Right triangles", "Right triangle trigonometry"),
  topic("ratios-rates-units", "Ratios, Rates, Proportional Relationships, and Units", "math", "Problem-Solving and Data Analysis", "Ratios, rates, and units"),
  topic("percentages", "Percentages", "math", "Problem-Solving and Data Analysis", "Percentages"),
  topic("one-variable-data", "One-Variable Data", "math", "Problem-Solving and Data Analysis", "One-variable data"),
  topic("two-variable-data", "Two-Variable Data", "math", "Problem-Solving and Data Analysis", "Two-variable data"),
  topic("probability", "Probability and Conditional Probability", "math", "Problem-Solving and Data Analysis", "Probability"),
  topic("sample-statistics", "Inference from Sample Statistics and Margin of Error", "math", "Problem-Solving and Data Analysis", "Sample statistics"),
  topic("statistical-claims", "Evaluating Statistical Claims", "math", "Problem-Solving and Data Analysis", "Statistical claims"),
];
export const BANK_TOPIC_BY_ID = new Map(BANK_TOPICS.map(t => [t.id, t]));
const topicBySkill = new Map(BANK_TOPICS.flatMap(t => t.skills.map(s => [`${t.section}:${t.domain}:${s.toLowerCase()}`, t] as const)));
export function topicFor(q: Pick<SatQuestion, "section" | "domain" | "skill">): BankTopic | undefined {
  return topicBySkill.get(`${q.section}:${q.domain}:${q.skill.toLowerCase()}`);
}
export const BANK_DOMAIN_ORDER: Record<SatSection, SatDomain[]> = {
  rw: ["Craft and Structure", "Expression of Ideas", "Information and Ideas", "Standard English Conventions"],
  math: ["Advanced Math", "Algebra", "Geometry and Trigonometry", "Problem-Solving and Data Analysis"],
};
export const OFFICIAL_BANK_URL = "https://satsuitequestionbank.collegeboard.org/";
export const OFFICIAL_GUIDES: Record<SatSection, string> = {
  rw: "https://satsuite.collegeboard.org/practice/student-question-bank/reading-writing",
  math: "https://satsuite.collegeboard.org/practice/student-question-bank/math",
};
export interface BankCatalog {
  inventory: { total: number; rw: number; math: number };
  collections: Record<string, number>;
  stats: { attempted: number; correct: number; wrong: number; saved: number; accuracy: number | null };
  statuses: Record<"all" | "new" | "solved" | "wrong" | "correct" | "saved", number>;
  sections: { id: SatSection; title: string; total: number; domains: { id: SatDomain; total: number; topics: (BankTopic & { total: number })[] }[] }[];
}
