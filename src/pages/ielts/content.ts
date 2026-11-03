// Shape of GET /ielts/content (answers stay on the server).
export interface IeltsContent {
  speaking: {
    part1: { id: string; topic: string; questions: string[] }[];
    part2: { id: string; topic: string; points: string[]; part3: string[] }[];
  };
  writing: {
    task1: { id: string; title: string; kind: "bar" | "line"; unit: string; categories: string[]; series: { name: string; values: number[] }[]; prompt: string }[];
    task2: { id: string; type: string; prompt: string }[];
  };
  readingStats: { sets: number; uniquePassages: number };
  academicReading: { id: string; title: string; minutes: number; passages: number; words: number; questions: number };
  reading: { id: string; title: string; level: string; questions: number }[];
  listening: { id: string; title: string; section: string; questions: number }[];
}
