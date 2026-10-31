import type { Difficulty, IeltsChoiceQuestion, SatQuestion } from "./types";
import raw from "./bank365.json";

// Task bank imported from 365step by scripts/import-365step.ts (original tasks, explanations in Russian).

export interface BankReadingSet {
  id: string;
  title: string;
  level: string;
  passage: string;
  difficulty: Difficulty;
  questions: (IeltsChoiceQuestion & { answer: string; why: string })[];
}

export const BANK365 = raw as unknown as {
  sat: SatQuestion[];
  reading: BankReadingSet[];
  writing2: { id: string; type: string; prompt: string }[];
  speaking: { part1: { id: string; topic: string; questions: string[] }[]; part2: { id: string; topic: string; points: string[]; part3: string[] }[] };
};
