/** English dates within SAT and IELTS; the platform's default formatter stays Russian. */
export const fmtExamDate = (value: string | number) => new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
