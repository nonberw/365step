import type { IeltsChoiceQuestion, IeltsCriterion } from "./types";
export type KeyedReadingQuestion = IeltsChoiceQuestion & { answer: string; why: string; evidence?: string };
export const normaliseIelts = (s: unknown) => String(s ?? "").normalize("NFKC").trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
export function checkReading(questions: KeyedReadingQuestion[], given: Record<string, string>) {
  const uses = new Map<string, number>();
  for (const q of questions) if (q.headingGroup && !q.headingGroup.reuse) {
    const value = normaliseIelts(given[q.id]);
    if (value) { const key = `${q.headingGroup.id}:${value}`; uses.set(key, (uses.get(key) ?? 0) + 1); }
  }
  const items = questions.map((q) => {
    const value = normaliseIelts(given[q.id]);
    const repeated = q.headingGroup && !q.headingGroup.reuse && (uses.get(`${q.headingGroup.id}:${value}`) ?? 0) > 1;
    const withinLimit = !q.maxWords || value.split(/\s+/).filter(Boolean).length <= q.maxWords;
    const correct = !!value && withinLimit && !repeated && q.answer.split("|").map(normaliseIelts).includes(value);
    return { id: q.id, given: String(given[q.id] ?? ""), answer: q.answer.split("|")[0]!, why: repeated ? "Каждый заголовок можно использовать только один раз. " + q.why : !withinLimit ? `Превышен лимит ${q.maxWords} слов. ${q.why}` : q.why, correct };
  });
  const right = items.filter((i) => i.correct).length;
  return { items, right, total: items.length, percentage: items.length ? Math.round(100 * right / items.length) : 0, band: null, feedback: "Это результат по авторскому учебному материалу. Перевод в официальный IELTS Band не откалиброван." };
}
export function transcriptCriteria(criteria: IeltsCriterion[]) {
  const names = ["Fluency and Coherence", "Lexical Resource", "Grammatical Range and Accuracy"];
  const assessed = names.map((name) => {
    const c = criteria.find((c) => c.name === name);
    return c && c.band !== null && Number.isFinite(c.band) && c.band >= 0 && c.band <= 9
      ? { ...c, band: Math.round(c.band * 2) / 2 }
      : { name, band: null, comment: "Недостаточно данных для оценки этого критерия." };
  });
  const overall = assessed.every((c) => c.band !== null) ? Math.round(assessed.reduce((s, c) => s + c.band!, 0) / 3 * 2) / 2 : null;
  return { overall, criteria: [...assessed, { name: "Pronunciation", band: null, comment: "Не оценивалось: необходим анализ аудиозаписи. Темп и расшифровка не измеряют произношение." }] };
}
