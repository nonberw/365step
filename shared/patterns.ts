import type { ProblemPattern } from "./types";

/** Topics in the order of the roadmap, like a course: each builds on the previous ones. */
export const PATTERNS: { id: ProblemPattern; title: string; blurb: string }[] = [
  { id: "arrays", title: "Массивы и хеширование", blurb: "Словари и множества превращают O(n²) в O(n)" },
  { id: "pointers", title: "Два указателя", blurb: "Два индекса идут навстречу или друг за другом" },
  { id: "window", title: "Скользящее окно", blurb: "Отрезок, который растёт справа и сжимается слева" },
  { id: "stack", title: "Стек", blurb: "Последним пришёл — первым ушёл: скобки, монотонный стек" },
  { id: "binsearch", title: "Бинарный поиск", blurb: "Делим пространство ответа пополам" },
  { id: "intervals", title: "Интервалы", blurb: "Сортировка по началу и сканирующая прямая" },
  { id: "trees", title: "Деревья", blurb: "Рекурсия, обходы в глубину и ширину" },
  { id: "graphs", title: "Графы", blurb: "BFS, DFS, топологическая сортировка, DSU" },
  { id: "backtracking", title: "Перебор с возвратом", blurb: "Все подмножества, перестановки, расстановки" },
  { id: "dp", title: "Динамическое программирование", blurb: "Большая задача из ответов маленьких" },
  { id: "greedy", title: "Жадные алгоритмы", blurb: "Лучший шаг сейчас ведёт к лучшему ответу" },
  { id: "math", title: "Математика и биты", blurb: "Простые числа, XOR, быстрое возведение в степень" },
];
