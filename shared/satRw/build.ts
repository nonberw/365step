import type { Difficulty, SatDomain, SatQuestion } from "../types";

/** Correct option is first in the editorial file, then rotated once at build time.
 * No generated wording or numerical variants are counted as new questions. */
export type Option = readonly [text: string, reason: string];
export type Options = readonly [Option, Option, Option, Option];
export type Item = {
  id: string; source: string; locator: string; passage: string;
  skill: string; domain: SatDomain; difficulty: Difficulty;
  stem: string; options: Options; family?: string;
};
export const II = "Information and Ideas", CS = "Craft and Structure",
  EI = "Expression of Ideas", SEC = "Standard English Conventions";

export function build(items: Item[]): SatQuestion[] {
  return items.map((item, index) => {
    const answer = index % 4;
    const options = [...item.options.slice(1)];
    options.splice(answer, 0, item.options[0]);
    return {
      id: `rw-open-${item.id}`, section: "rw", source: "bank",
      domain: item.domain, skill: item.skill, difficulty: item.difficulty,
      passage: item.passage, stem: item.stem,
      choices: options.map(([text]) => text), answer,
      explanation: options.map(([, reason], i) => `${"ABCD"[i]} — ${i === answer ? "верно" : "неверно"}: ${reason}`).join("\n\n"),
      purpose: "assessment", familyId: `rw-open:${item.family ?? item.id}`,
      attribution: {
        sourceId: item.source, locator: item.locator,
        changes: "Новый учебный текст/пересказ идей 365step по указанному свободно доступному английскому первоисточнику; новые вопросы, варианты и русские разборы. Формулировки заданий не заимствованы из книги. Это задания в формате SAT, не вопросы College Board. CC BY-SA 4.0.",
        license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        download: "/content/sat-rw-open-2026.json",
      },
    };
  });
}
