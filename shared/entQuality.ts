import { ENT_SUBJECT, type EntQuestion } from "./ent";
import { choiceKey } from "./numeric";

export const ENT_DEMO_TOPICS = ["Проценты, доли и пропорции", "Финансовая грамотность"];
export function entContentIssue(q: Omit<EntQuestion, "id">): string | null {
  if (!q.stem?.trim() || !q.explanation?.trim() || !q.options?.length) return "missing-content";
  const keys = q.options.map((v) => {
    const original=v.replace(/[\s\u00a0\u202f₸]/g, "");
    const numeric=choiceKey(original);
    // Case is instructional content in orthography and in genotypes (AA ≠ aa).
    return /^-?\d+\/\d+$/.test(numeric)?numeric:original;
  });
  if (new Set(keys).size !== keys.length) return "equivalent-options";
  if (q.source === "seed" && (q.subject !== "math-lit" || !ENT_DEMO_TOPICS.includes(q.topic) || q.lang !== "ru")) return "unsupported-demo-subject-topic-language";
  if(q.source==="open"){
    const s=ENT_SUBJECT[q.subject];
    if(!s||!s.topics.includes(q.topic)||(s.fixedLang&&q.lang!==s.fixedLang)||(!s.fixedLang&&!['ru','kk'].includes(q.lang)))return "subject-topic-language";
    if(!q.contentId||!q.familyId||!q.attribution?.url||!q.attribution.licenseUrl||!q.attribution.locator)return "missing-provenance";
    if(q.type==='multi'&&(q.options.length!==6||!Array.isArray(q.answer)||q.answer.length>3||new Set(q.answer).size!==q.answer.length))return "invalid-multi";
    if(q.type==='match'&&(q.options.length!==4||q.left?.length!==2||!Array.isArray(q.answer)||q.answer.length!==2))return "invalid-match";
  }
  if (q.type === "single" || q.type === "context") {
    if (q.options.length !== 4 || !Number.isInteger(q.answer) || Number(q.answer) < 0 || Number(q.answer) > 3) return "invalid-key";
    if (q.type === "context" && !q.passage?.trim()) return "missing-passage";
  } else if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some((i) => !Number.isInteger(i) || i < 0 || i >= q.options.length)) return "invalid-key";
  return null;
}
export const isUsableEnt = (q: Omit<EntQuestion, "id">) => entContentIssue(q) === null;
