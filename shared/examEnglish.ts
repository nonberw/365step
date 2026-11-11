import translations from "./examEnglish.json";
const dictionary: Record<string, string> = translations;
const cyrillic = /[А-Яа-яЁё]/;
/** English presentation only: source questions and grading keys stay untouched. */
export function englishExamText(text: string): string {
  if (!cyrillic.test(text)) return text;
  const direct = dictionary[text];
  if (direct !== undefined) return direct;
  const trimmed = text.trim();
  if (dictionary[trimmed] !== undefined) return text.replace(trimmed, dictionary[trimmed]!);
  const start = text.search(cyrillic);
  const suffix = dictionary[text.slice(start)];
  if (suffix !== undefined) return text.slice(0, start) + suffix;
  return text.split(/(\n+)/).map(part => dictionary[part] ?? dictionary[part.trim()] ?? part).join("");
}
const untouched = new Set(["id", "questionId", "itemId", "lessonId", "answer", "answers", "acceptedAnswers", "given", "response", "text", "transcript", "quote", "evidence", "sourceUrl", "url", "href", "download"]);
export function englishExamData<T>(value: T): T {
  function visit(item: unknown): unknown {
    if (typeof item === "string") return englishExamText(item);
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object" && Object.getPrototypeOf(item) === Object.prototype)
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, untouched.has(key) ? child : visit(child)]));
    return item;
  }
  return visit(value) as T;
}
export const isEnglishExamCourse = (course: string) => ["sat-math", "sat-rw", "ielts-reading"].includes(course);
