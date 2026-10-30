// Source of the extra algorithm problems: statement, reference solution and test inputs.
// `npx tsx scripts/problems-gen.ts` runs every reference solution and writes shared/problemsMore.json
// (statements and tests with expected answers, never the solutions). All problems are original wording;
// the classic ideas behind them (BFS, Kadane, intervals...) are common knowledge.

export type Pattern = "arrays" | "pointers" | "window" | "stack" | "binsearch" | "intervals" | "trees" | "graphs" | "backtracking" | "dp" | "greedy" | "math";

export interface Src {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  pattern: Pattern;
  tags: string[];
  name: string;
  params: string[];
  statement: string;
  constraints: string[];
  hints: string[];
  solve: (...args: never[]) => unknown;
  tests: unknown[][];
  unordered?: boolean;
  visible?: number;
}

// Deterministic pseudo-random numbers so regenerated tests do not change.
let seed = 42;
export const rnd = (lo: number, hi: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return lo + (seed % (hi - lo + 1));
};
const arr = (n: number, lo: number, hi: number) => Array.from({ length: n }, () => rnd(lo, hi));
const word = (n: number, abc = "abcde") => Array.from({ length: n }, () => abc[rnd(0, abc.length - 1)]).join("");

type Tree = { val: number; left: Tree | null; right: Tree | null } | null;
/** Tree from a level-order list with nulls, as in most textbooks. */
export function tree(list: (number | null)[]): Tree {
  if (!list.length || list[0] === null) return null;
  const root: Tree = { val: list[0], left: null, right: null };
  const q = [root];
  let i = 1;
  while (q.length && i < list.length) {
    const n = q.shift()!;
    if (i < list.length && list[i] !== null) q.push((n.left = { val: list[i] as number, left: null, right: null }));
    i++;
    if (i < list.length && list[i] !== null) q.push((n.right = { val: list[i] as number, left: null, right: null }));
    i++;
  }
  return root;
}
const TREE_NOTE = 'Дерево задано объектом `{val, left, right}`, где `left` и `right` — такие же объекты или `null` (в Python — словарь `root["val"]`, `root["left"]`).';

export const SOURCES: Src[] = [
  // ---------- arrays & hashing ----------
  {
    id: "contains-duplicate",
    title: "Повторный пропуск",
    difficulty: "Easy",
    pattern: "arrays",
    tags: ["массивы", "хеш-таблица"],
    name: "hasDuplicate",
    params: ["ids"],
    statement: "Охранник записывает номера пропусков `ids` всех, кто прошёл в школу. Верни `true`, если какой-то номер встречается дважды, иначе `false`.",
    constraints: ["1 ≤ длина ids ≤ 10⁵"],
    hints: ["Множество (Set) помнит, что ты уже видел, и проверяет за O(1)."],
    solve: (ids: number[]) => new Set(ids).size !== ids.length,
    tests: [[[1, 2, 3, 1]], [[1, 2, 3, 4]], [[7]], [arr(2000, 1, 100000)], [[...Array(1500).keys()]]],
  },
  {
    id: "majority",
    title: "Голос большинства",
    difficulty: "Easy",
    pattern: "arrays",
    tags: ["массивы", "подсчёт"],
    name: "majority",
    params: ["votes"],
    statement: "В голосовании за президента класса один кандидат получил **больше половины** голосов. Дан массив `votes` с номерами кандидатов. Верни номер победителя.",
    constraints: ["1 ≤ длина votes ≤ 5·10⁴", "победитель всегда есть"],
    hints: ["Можно посчитать голоса в словаре.", "Алгоритм Бойера–Мура решает за O(1) памяти: держи кандидата и счётчик."],
    solve: (v: number[]) => {
      let c = 0,
        k = 0;
      for (const x of v) {
        if (!k) c = x;
        k += x === c ? 1 : -1;
      }
      return c;
    },
    tests: [[[3, 2, 3]], [[2, 2, 1, 1, 1, 2, 2]], [[5]], [[...arr(300, 1, 9), ...Array(400).fill(4)]]],
  },
  {
    id: "longest-consecutive",
    title: "Самая длинная серия",
    difficulty: "Medium",
    pattern: "arrays",
    tags: ["хеш-таблица", "множества"],
    name: "longestStreak",
    params: ["days"],
    statement: "`days` — номера дней, когда ученик занимался (в любом порядке, могут повторяться). Найди длину самой длинной серии подряд идущих дней. Нужно решение за O(n).",
    constraints: ["0 ≤ длина days ≤ 10⁵"],
    hints: ["Сортировка даст O(n log n). Можно быстрее.", "Положи всё в Set. Серию начинай считать только с дня d, если d − 1 нет в множестве."],
    solve: (d: number[]) => {
      const s = new Set(d);
      let best = 0;
      for (const x of s)
        if (!s.has(x - 1)) {
          let y = x;
          while (s.has(y + 1)) y++;
          best = Math.max(best, y - x + 1);
        }
      return best;
    },
    tests: [[[100, 4, 200, 1, 3, 2]], [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], [[]], [[5, 5, 5]], [arr(1500, 1, 4000)]],
  },
  {
    id: "subarray-sum-k",
    title: "Отрезки с суммой K",
    difficulty: "Medium",
    pattern: "arrays",
    tags: ["префиксные суммы", "хеш-таблица"],
    name: "countSubarrays",
    params: ["nums", "k"],
    statement: "Посчитай, сколько непрерывных отрезков массива `nums` имеют сумму ровно `k`. Числа могут быть отрицательными.",
    constraints: ["1 ≤ длина nums ≤ 2·10⁴", "−1000 ≤ nums[i] ≤ 1000"],
    hints: ["Сумма отрезка = префикс[j] − префикс[i].", "Храни, сколько раз встречался каждый префикс, и ищи префикс − k."],
    solve: (a: number[], k: number) => {
      const m = new Map([[0, 1]]);
      let s = 0,
        c = 0;
      for (const x of a) {
        s += x;
        c += m.get(s - k) ?? 0;
        m.set(s, (m.get(s) ?? 0) + 1);
      }
      return c;
    },
    tests: [
      [[1, 1, 1], 2],
      [[1, 2, 3], 3],
      [[1, -1, 0], 0],
      [[3, 4, 7, 2, -3, 1, 4, 2], 7],
      [arr(2000, -10, 10), 5],
    ],
  },
  {
    id: "encode-strings",
    title: "Сжатие строки",
    difficulty: "Easy",
    pattern: "arrays",
    tags: ["строки"],
    name: "compress",
    params: ["s"],
    statement: "Сожми строку `s`: каждую серию одинаковых символов замени на символ и длину серии, если длина больше 1. Например, `aaabcc` → `a3bc2`.",
    constraints: ["0 ≤ длина s ≤ 10⁵"],
    hints: ["Иди по строке и считай длину текущей серии; когда символ меняется — допиши результат."],
    solve: (s: string) => s.replace(/(.)\1*/g, (m, c: string) => c + (m.length > 1 ? m.length : "")),
    tests: [["aaabcc"], ["abc"], [""], ["zzzzzzzzzzzz"], [word(500, "ab")]],
  },
  // ---------- two pointers ----------
  {
    id: "move-zeros",
    title: "Нули в конец",
    difficulty: "Easy",
    pattern: "pointers",
    tags: ["два указателя"],
    name: "moveZeros",
    params: ["nums"],
    statement: "Перенеси все нули массива `nums` в конец, сохранив порядок остальных чисел. Верни получившийся массив.",
    constraints: ["1 ≤ длина nums ≤ 10⁴"],
    hints: ["Указатель «куда писать» двигается только когда встречаешь не ноль."],
    solve: (a: number[]) => [...a.filter((x) => x !== 0), ...a.filter((x) => x === 0)],
    tests: [[[0, 1, 0, 3, 12]], [[0]], [[1, 2, 3]], [arr(1000, 0, 3)]],
  },
  {
    id: "three-sum",
    title: "Три слагаемых",
    difficulty: "Medium",
    pattern: "pointers",
    tags: ["два указателя", "сортировка"],
    name: "threeSum",
    params: ["nums"],
    statement: "Найди все **уникальные** тройки чисел из `nums`, сумма которых равна 0. Каждую тройку верни по возрастанию; порядок троек не важен.",
    constraints: ["3 ≤ длина nums ≤ 3000"],
    hints: ["Отсортируй массив. Зафиксируй первое число и ищи пару двумя указателями.", "Пропускай одинаковые значения, чтобы тройки не повторялись."],
    unordered: true,
    solve: (a: number[]) => {
      const n = [...a].sort((x, y) => x - y),
        out: number[][] = [];
      for (let i = 0; i < n.length; i++) {
        if (i && n[i] === n[i - 1]) continue;
        let l = i + 1,
          r = n.length - 1;
        while (l < r) {
          const s = n[i] + n[l] + n[r];
          if (s === 0) {
            out.push([n[i], n[l], n[r]]);
            while (n[l] === n[l + 1]) l++;
            l++;
            r--;
          } else if (s < 0) l++;
          else r--;
        }
      }
      return out;
    },
    tests: [[[-1, 0, 1, 2, -1, -4]], [[0, 1, 1]], [[0, 0, 0, 0]], [arr(120, -15, 15)]],
  },
  {
    id: "container-water",
    title: "Самый вместительный бак",
    difficulty: "Medium",
    pattern: "pointers",
    tags: ["два указателя", "жадный"],
    name: "maxArea",
    params: ["heights"],
    statement: "На линии стоят вертикальные стенки высотой `heights[i]`. Выбери две стенки так, чтобы между ними поместилось больше всего воды (площадь = расстояние × меньшая высота). Верни эту площадь.",
    constraints: ["2 ≤ длина heights ≤ 10⁵"],
    hints: ["Начни с самых крайних стенок.", "Всегда сдвигай более низкую стенку: от высокой выигрыша не будет."],
    solve: (h: number[]) => {
      let l = 0,
        r = h.length - 1,
        b = 0;
      while (l < r) {
        b = Math.max(b, (r - l) * Math.min(h[l], h[r]));
        if (h[l] < h[r]) l++;
        else r--;
      }
      return b;
    },
    tests: [[[1, 8, 6, 2, 5, 4, 8, 3, 7]], [[1, 1]], [[4, 3, 2, 1, 4]], [arr(1500, 0, 10000)]],
  },
  // ---------- sliding window ----------
  {
    id: "best-time-stock",
    title: "Купить и продать",
    difficulty: "Easy",
    pattern: "window",
    tags: ["скользящее окно", "жадный"],
    name: "maxProfit",
    params: ["prices"],
    statement: "`prices[i]` — цена акции школьного стартапа в день i. Можно один раз купить и позже один раз продать. Верни максимальную прибыль (или 0, если выгоды нет).",
    constraints: ["1 ≤ длина prices ≤ 10⁵"],
    hints: ["Помни минимальную цену до текущего дня."],
    solve: (p: number[]) => {
      let m = Infinity,
        b = 0;
      for (const x of p) {
        m = Math.min(m, x);
        b = Math.max(b, x - m);
      }
      return b;
    },
    tests: [[[7, 1, 5, 3, 6, 4]], [[7, 6, 4, 3, 1]], [[2]], [arr(1500, 1, 10000)]],
  },
  {
    id: "max-window-sum",
    title: "Лучшая неделя",
    difficulty: "Easy",
    pattern: "window",
    tags: ["скользящее окно"],
    name: "bestWindow",
    params: ["xp", "k"],
    statement: "`xp[i]` — очки опыта за день i. Найди максимальную сумму очков за `k` дней подряд.",
    constraints: ["1 ≤ k ≤ длина xp ≤ 10⁵"],
    hints: ["Не пересчитывай сумму окна заново: прибавь новый день и вычти ушедший."],
    solve: (a: number[], k: number) => {
      let s = a.slice(0, k).reduce((x, y) => x + y, 0),
        b = s;
      for (let i = k; i < a.length; i++) {
        s += a[i] - a[i - k];
        b = Math.max(b, s);
      }
      return b;
    },
    tests: [
      [[1, 4, 2, 10, 23, 3, 1, 0, 20], 4],
      [[5], 1],
      [[-1, -2, -3], 2],
      [arr(1500, -50, 100), 7],
    ],
  },
  {
    id: "char-replacement",
    title: "Одинаковые буквы после замен",
    difficulty: "Medium",
    pattern: "window",
    tags: ["скользящее окно", "строки"],
    name: "longestAfterReplace",
    params: ["s", "k"],
    statement: "Можно заменить не больше `k` букв строки `s` (из заглавных латинских). Верни длину самой длинной подстроки из одинаковых букв, которую можно получить.",
    constraints: ["1 ≤ длина s ≤ 10⁵", "0 ≤ k ≤ длина s"],
    hints: ["Окно подходит, если длина окна − частота самой частой буквы ≤ k."],
    solve: (s: string, k: number) => {
      const c: Record<string, number> = {};
      let l = 0,
        m = 0,
        b = 0;
      for (let r = 0; r < s.length; r++) {
        c[s[r]] = (c[s[r]] ?? 0) + 1;
        m = Math.max(m, c[s[r]]);
        while (r - l + 1 - m > k) c[s[l++]]--;
        b = Math.max(b, r - l + 1);
      }
      return b;
    },
    tests: [
      ["ABAB", 2],
      ["AABABBA", 1],
      ["A", 0],
      [word(3000, "ABC"), 50],
    ],
  },
  {
    id: "min-window",
    title: "Минимальное окно с буквами",
    difficulty: "Hard",
    pattern: "window",
    tags: ["скользящее окно", "хеш-таблица"],
    name: "minWindow",
    params: ["s", "t"],
    statement: "Найди самую короткую подстроку `s`, которая содержит все буквы строки `t` (с учётом повторов). Если таких несколько — самую левую. Если нет — верни пустую строку.",
    constraints: ["1 ≤ длина s, t ≤ 10⁵"],
    hints: ["Расширяй правую границу, пока окно не станет подходящим, потом сжимай левую.", "Считай, сколько букв t ещё не покрыто."],
    solve: (s: string, t: string) => {
      const need: Record<string, number> = {};
      for (const ch of t) need[ch] = (need[ch] ?? 0) + 1;
      let missing = t.length,
        l = 0,
        best: [number, number] = [0, Infinity];
      for (let r = 0; r < s.length; r++) {
        if ((need[s[r]] ?? 0) > 0) missing--;
        need[s[r]] = (need[s[r]] ?? 0) - 1;
        while (!missing) {
          if (r - l < best[1] - best[0]) best = [l, r];
          need[s[l]]++;
          if (need[s[l]] > 0) missing++;
          l++;
        }
      }
      return best[1] === Infinity ? "" : s.slice(best[0], best[1] + 1);
    },
    tests: [
      ["ADOBECODEBANC", "ABC"],
      ["a", "a"],
      ["a", "aa"],
      [word(2000, "abcdefg"), "gfa"],
    ],
  },
  // ---------- stack ----------
  {
    id: "daily-temps",
    title: "Когда потеплеет",
    difficulty: "Medium",
    pattern: "stack",
    tags: ["монотонный стек"],
    name: "daysUntilWarmer",
    params: ["temps"],
    statement: "Для каждого дня из `temps` найди, через сколько дней станет теплее. Если теплее не станет — 0.",
    constraints: ["1 ≤ длина temps ≤ 10⁵"],
    hints: ["Держи стек индексов дней, для которых ответ ещё не найден; температуры в нём убывают."],
    solve: (t: number[]) => {
      const out = Array(t.length).fill(0),
        st: number[] = [];
      t.forEach((x, i) => {
        while (st.length && t[st[st.length - 1]] < x) {
          const j = st.pop()!;
          out[j] = i - j;
        }
        st.push(i);
      });
      return out;
    },
    tests: [[[73, 74, 75, 71, 69, 72, 76, 73]], [[30, 40, 50, 60]], [[30, 20, 10]], [arr(1500, -30, 40)]],
  },
  {
    id: "eval-rpn",
    title: "Калькулятор в обратной польской записи",
    difficulty: "Medium",
    pattern: "stack",
    tags: ["стек"],
    name: "evalRpn",
    params: ["tokens"],
    statement: 'Вычисли выражение в обратной польской записи: `["2", "1", "+", "3", "*"]` = (2 + 1) × 3 = 9. Операции: `+ - * /`, деление целочисленное с отбрасыванием дробной части к нулю.',
    constraints: ["1 ≤ длина tokens ≤ 10⁴", "выражение корректное"],
    hints: ["Числа кладутся в стек; операция снимает два верхних и кладёт результат."],
    solve: (t: string[]) => {
      const st: number[] = [];
      for (const x of t) {
        if ("+-*/".includes(x) && x.length === 1) {
          const b = st.pop()!,
            a = st.pop()!;
          st.push(x === "+" ? a + b : x === "-" ? a - b : x === "*" ? a * b : Math.trunc(a / b));
        } else st.push(Number(x));
      }
      return st[0];
    },
    tests: [[["2", "1", "+", "3", "*"]], [["4", "13", "5", "/", "+"]], [["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"]], [["7"]]],
  },
  {
    id: "largest-rectangle",
    title: "Самый большой плакат",
    difficulty: "Hard",
    pattern: "stack",
    tags: ["монотонный стек"],
    name: "largestRectangle",
    params: ["heights"],
    statement: "Гистограмма из столбцов шириной 1 и высотой `heights[i]`. Найди площадь самого большого прямоугольника, который целиком помещается в гистограмму.",
    constraints: ["1 ≤ длина heights ≤ 10⁵"],
    hints: ["Для каждого столбца найди, насколько далеко влево и вправо можно растянуть прямоугольник его высоты.", "Монотонный стек находит обе границы за O(n)."],
    solve: (h: number[]) => {
      const st: number[] = [];
      let b = 0;
      for (let i = 0; i <= h.length; i++) {
        const x = i === h.length ? 0 : h[i];
        while (st.length && h[st[st.length - 1]] >= x) {
          const top = h[st.pop()!];
          const left = st.length ? st[st.length - 1] + 1 : 0;
          b = Math.max(b, top * (i - left));
        }
        st.push(i);
      }
      return b;
    },
    tests: [[[2, 1, 5, 6, 2, 3]], [[2, 4]], [[1]], [arr(1500, 0, 1000)]],
  },
  // ---------- binary search ----------
  {
    id: "first-bad",
    title: "Первая сломанная сборка",
    difficulty: "Easy",
    pattern: "binsearch",
    tags: ["бинарный поиск"],
    name: "firstBad",
    params: ["builds"],
    statement: "`builds` — результаты ночных сборок проекта: сначала идут `true` (работает), потом `false` (сломано). Верни индекс первой сломанной сборки или −1, если все работают. Нужно O(log n).",
    constraints: ["1 ≤ длина builds ≤ 10⁶"],
    hints: ["Классический бинарный поиск по границе: lo — точно хорошая, hi — первая плохая."],
    solve: (b: boolean[]) => {
      let lo = 0,
        hi = b.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (b[m]) lo = m + 1;
        else hi = m;
      }
      return lo === b.length ? -1 : lo;
    },
    tests: [[[true, true, false, false]], [[false]], [[true, true]], [[...Array(2100).fill(true), ...Array(900).fill(false)]]],
  },
  {
    id: "rotated-search",
    title: "Поиск в повёрнутом массиве",
    difficulty: "Medium",
    pattern: "binsearch",
    tags: ["бинарный поиск"],
    name: "searchRotated",
    params: ["nums", "target"],
    statement: "Отсортированный массив различных чисел «повернули» в неизвестной точке: `[4, 5, 6, 7, 0, 1, 2]`. Найди индекс `target` за O(log n) или верни −1.",
    constraints: ["1 ≤ длина nums ≤ 5000"],
    hints: ["Одна из половин всегда отсортирована. Проверь, лежит ли target в ней."],
    solve: (a: number[], t: number) => a.indexOf(t),
    tests: [
      [[4, 5, 6, 7, 0, 1, 2], 0],
      [[4, 5, 6, 7, 0, 1, 2], 3],
      [[1], 1],
      [[5, 1, 3], 5],
      [[...Array.from({ length: 300 }, (_, i) => i * 3 + 1000), ...Array.from({ length: 200 }, (_, i) => i * 3)], 1300],
    ],
  },
  {
    id: "koko-reading",
    title: "Успеть прочитать",
    difficulty: "Medium",
    pattern: "binsearch",
    tags: ["бинарный поиск по ответу"],
    name: "minSpeed",
    params: ["pages", "hours"],
    statement:
      "Перед экзаменом нужно прочитать главы, `pages[i]` — страниц в главе i. За час читаешь не больше `v` страниц и только из одной главы (остаток часа пропадает). Найди минимальную целую скорость `v`, чтобы успеть за `hours` часов.",
    constraints: ["1 ≤ длина pages ≤ hours ≤ 10⁹"],
    hints: ["Если скорость v подходит, подходит и любая большая — значит, можно искать v бинарным поиском."],
    solve: (p: number[], h: number) => {
      let lo = 1,
        hi = Math.max(...p);
      while (lo < hi) {
        const m = Math.floor((lo + hi) / 2);
        const t = p.reduce((s, x) => s + Math.ceil(x / m), 0);
        if (t <= h) hi = m;
        else lo = m + 1;
      }
      return lo;
    },
    tests: [
      [[3, 6, 7, 11], 8],
      [[30, 11, 23, 4, 20], 5],
      [[30, 11, 23, 4, 20], 6],
      [arr(1000, 1, 1000000), 5000],
    ],
  },
  // ---------- intervals ----------
  {
    id: "merge-intervals",
    title: "Объединить расписание",
    difficulty: "Medium",
    pattern: "intervals",
    tags: ["интервалы", "сортировка"],
    name: "mergeIntervals",
    params: ["slots"],
    statement: "`slots` — занятые отрезки времени `[начало, конец]`. Объедини пересекающиеся и касающиеся отрезки и верни их по возрастанию начала.",
    constraints: ["1 ≤ длина slots ≤ 10⁴"],
    hints: ["Отсортируй по началу и иди по порядку, расширяя последний отрезок."],
    solve: (s: number[][]) => {
      const a = [...s].sort((x, y) => x[0] - y[0]),
        out: number[][] = [];
      for (const [l, r] of a) {
        if (out.length && l <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], r);
        else out.push([l, r]);
      }
      return out;
    },
    tests: [
      [
        [
          [1, 3],
          [2, 6],
          [8, 10],
          [15, 18],
        ],
      ],
      [
        [
          [1, 4],
          [4, 5],
        ],
      ],
      [[[5, 7]]],
      [
        Array.from({ length: 300 }, () => {
          const l = rnd(0, 2000);
          return [l, l + rnd(0, 30)];
        }),
      ],
    ],
  },
  {
    id: "meeting-rooms",
    title: "Сколько нужно кабинетов",
    difficulty: "Medium",
    pattern: "intervals",
    tags: ["интервалы", "сканирующая прямая"],
    name: "roomsNeeded",
    params: ["lessons"],
    statement: "Доп. уроки заданы отрезками `[начало, конец)`. Урок, который заканчивается в момент t, освобождает кабинет для урока, начинающегося в t. Найди минимальное число кабинетов.",
    constraints: ["1 ≤ длина lessons ≤ 10⁴"],
    hints: ["Раздели события на «начало» и «конец», отсортируй и считай, сколько уроков идёт одновременно."],
    solve: (s: number[][]) => {
      const ev = s.flatMap(([a, b]) => [
        [a, 1],
        [b, -1],
      ]);
      ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      let c = 0,
        b = 0;
      for (const [, d] of ev) {
        c += d;
        b = Math.max(b, c);
      }
      return b;
    },
    tests: [
      [
        [
          [0, 30],
          [5, 10],
          [15, 20],
        ],
      ],
      [
        [
          [7, 10],
          [2, 4],
        ],
      ],
      [
        [
          [1, 5],
          [5, 10],
          [10, 15],
        ],
      ],
      [
        Array.from({ length: 500 }, () => {
          const l = rnd(0, 1000);
          return [l, l + rnd(1, 120)];
        }),
      ],
    ],
  },
  // ---------- trees ----------
  {
    id: "tree-depth",
    title: "Глубина дерева",
    difficulty: "Easy",
    pattern: "trees",
    tags: ["деревья", "рекурсия"],
    name: "maxDepth",
    params: ["root"],
    statement: `Верни глубину двоичного дерева — число узлов на самом длинном пути от корня до листа. ${TREE_NOTE}`,
    constraints: ["0 ≤ узлов ≤ 10⁴"],
    hints: ["Глубина = 1 + max(глубина левого, глубина правого)."],
    solve: (r: Tree) => {
      const d = (n: Tree): number => (n ? 1 + Math.max(d(n.left), d(n.right)) : 0);
      return d(r);
    },
    tests: [[tree([3, 9, 20, null, null, 15, 7])], [tree([1, null, 2])], [null], [tree(Array.from({ length: 200 }, (_, i) => i))]],
  },
  {
    id: "tree-symmetric",
    title: "Зеркальное дерево",
    difficulty: "Easy",
    pattern: "trees",
    tags: ["деревья", "рекурсия"],
    name: "isSymmetric",
    params: ["root"],
    statement: `Проверь, симметрично ли дерево относительно центра (левая половина — зеркало правой). ${TREE_NOTE}`,
    constraints: ["1 ≤ узлов ≤ 1000"],
    hints: ["Сравнивай пары: левый ребёнок одного с правым ребёнком другого."],
    solve: (r: Tree) => {
      const m = (a: Tree, b: Tree): boolean => (!a || !b ? a === b : a.val === b.val && m(a.left, b.right) && m(a.right, b.left));
      return m(r?.left ?? null, r?.right ?? null);
    },
    tests: [[tree([1, 2, 2, 3, 4, 4, 3])], [tree([1, 2, 2, null, 3, null, 3])], [tree([5])], [tree([1, 2, 2, 3, null, null, 3])]],
  },
  {
    id: "tree-levels",
    title: "Дерево по уровням",
    difficulty: "Medium",
    pattern: "trees",
    tags: ["деревья", "BFS"],
    name: "levelOrder",
    params: ["root"],
    statement: `Верни значения узлов по уровням: массив массивов, каждый уровень слева направо. ${TREE_NOTE}`,
    constraints: ["0 ≤ узлов ≤ 2000"],
    hints: ["Обход в ширину: очередь, обрабатывай уровень целиком, зная его размер."],
    solve: (r: Tree) => {
      const out: number[][] = [];
      let q: NonNullable<Tree>[] = r ? [r] : [];
      while (q.length) {
        out.push(q.map((n) => n.val));
        q = q.flatMap((n) => [n.left, n.right].filter((x): x is NonNullable<Tree> => !!x));
      }
      return out;
    },
    tests: [[tree([3, 9, 20, null, null, 15, 7])], [tree([1])], [null], [tree(Array.from({ length: 40 }, (_, i) => i * 2))]],
  },
  {
    id: "validate-bst",
    title: "Это дерево поиска?",
    difficulty: "Medium",
    pattern: "trees",
    tags: ["деревья", "BST"],
    name: "isValidBst",
    params: ["root"],
    statement: `Проверь, является ли дерево двоичным деревом поиска: все значения левого поддерева строго меньше узла, правого — строго больше, и так для каждого узла. ${TREE_NOTE}`,
    constraints: ["1 ≤ узлов ≤ 10⁴"],
    hints: ["Сравнивать только с детьми недостаточно — передавай вниз допустимый диапазон (min, max)."],
    solve: (r: Tree) => {
      const ok = (n: Tree, lo: number, hi: number): boolean => !n || (n.val > lo && n.val < hi && ok(n.left, lo, n.val) && ok(n.right, n.val, hi));
      return ok(r, -Infinity, Infinity);
    },
    tests: [[tree([2, 1, 3])], [tree([5, 1, 4, null, null, 3, 6])], [tree([5, 4, 6, null, null, 3, 7])], [tree([8, 4, 12, 2, 6, 10, 14])]],
  },
  {
    id: "path-sum",
    title: "Путь с нужной суммой",
    difficulty: "Easy",
    pattern: "trees",
    tags: ["деревья", "DFS"],
    name: "hasPathSum",
    params: ["root", "target"],
    statement: `Есть ли путь от корня до **листа**, сумма значений на котором равна \`target\`? ${TREE_NOTE}`,
    constraints: ["0 ≤ узлов ≤ 5000"],
    hints: ["Спускаясь, вычитай значение узла из target; в листе проверь, что осталось 0."],
    solve: (r: Tree, t: number) => {
      const f = (n: Tree, s: number): boolean => !!n && (!n.left && !n.right ? s === n.val : f(n.left, s - n.val) || f(n.right, s - n.val));
      return f(r, t);
    },
    tests: [
      [tree([5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]), 22],
      [tree([1, 2, 3]), 5],
      [null, 0],
      [tree([1, 2]), 1],
    ],
  },
  // ---------- graphs ----------
  {
    id: "islands",
    title: "Острова на карте",
    difficulty: "Medium",
    pattern: "graphs",
    tags: ["графы", "DFS", "сетка"],
    name: "countIslands",
    params: ["grid"],
    statement: 'Карта — сетка из `"1"` (суша) и `"0"` (вода). Остров — группа клеток суши, соединённых по горизонтали или вертикали. Посчитай острова.',
    constraints: ["1 ≤ размер сетки ≤ 300 × 300"],
    hints: ["Найдя сушу, «затопи» весь её остров обходом в глубину или ширину и увеличь счётчик."],
    solve: (g: string[][]) => {
      const m = g.map((r) => [...r]);
      let c = 0;
      const fill = (i: number, j: number) => {
        const st = [[i, j]];
        while (st.length) {
          const [a, b] = st.pop()!;
          if (a < 0 || b < 0 || a >= m.length || b >= m[0].length || m[a][b] !== "1") continue;
          m[a][b] = "0";
          st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
        }
      };
      m.forEach((r, i) =>
        r.forEach((v, j) => {
          if (v === "1") {
            c++;
            fill(i, j);
          }
        }),
      );
      return c;
    },
    tests: [
      [
        [
          ["1", "1", "0", "0", "0"],
          ["1", "1", "0", "0", "0"],
          ["0", "0", "1", "0", "0"],
          ["0", "0", "0", "1", "1"],
        ],
      ],
      [[["0"]]],
      [
        [
          ["1", "1", "1"],
          ["0", "1", "0"],
          ["1", "1", "1"],
        ],
      ],
      [Array.from({ length: 40 }, () => Array.from({ length: 40 }, () => (rnd(0, 9) < 4 ? "1" : "0")))],
    ],
  },
  {
    id: "maze-path",
    title: "Кратчайший путь по школе",
    difficulty: "Medium",
    pattern: "graphs",
    tags: ["графы", "BFS", "сетка"],
    name: "shortestPath",
    params: ["grid"],
    statement: "План этажа: `0` — проход, `1` — стена. Нужно дойти из левого верхнего угла в правый нижний, шагая вверх, вниз, влево и вправо. Верни минимальное число шагов или −1, если пути нет.",
    constraints: ["1 ≤ размер ≤ 200 × 200"],
    hints: ["Обход в ширину находит кратчайший путь в невзвешенном графе: первая встреча клетки — уже лучший ответ."],
    solve: (g: number[][]) => {
      const n = g.length,
        m = g[0].length;
      if (g[0][0] || g[n - 1][m - 1]) return -1;
      const d = g.map((r) => r.map(() => -1));
      d[0][0] = 0;
      const q = [[0, 0]];
      for (let k = 0; k < q.length; k++) {
        const [a, b] = q[k];
        for (const [x, y] of [
          [a + 1, b],
          [a - 1, b],
          [a, b + 1],
          [a, b - 1],
        ])
          if (x >= 0 && y >= 0 && x < n && y < m && !g[x][y] && d[x][y] < 0) {
            d[x][y] = d[a][b] + 1;
            q.push([x, y]);
          }
      }
      return d[n - 1][m - 1];
    },
    tests: [
      [
        [
          [0, 0, 0],
          [1, 1, 0],
          [0, 0, 0],
        ],
      ],
      [
        [
          [0, 1],
          [1, 0],
        ],
      ],
      [[[0]]],
      [Array.from({ length: 30 }, (_, i) => Array.from({ length: 30 }, (_, j) => (i + j === 0 || (i === 29 && j === 29) ? 0 : rnd(0, 9) < 3 ? 1 : 0)))],
    ],
  },
  {
    id: "course-order",
    title: "Порядок курсов",
    difficulty: "Medium",
    pattern: "graphs",
    tags: ["графы", "топологическая сортировка"],
    name: "canFinish",
    params: ["n", "prereq"],
    statement: "Есть `n` курсов (0…n−1). Пара `[a, b]` в `prereq` значит: перед курсом a нужно пройти курс b. Можно ли пройти все курсы? (Нельзя, если зависимости образуют цикл.)",
    constraints: ["1 ≤ n ≤ 2000", "0 ≤ длина prereq ≤ 5000"],
    hints: ["Алгоритм Кана: начни с курсов без зависимостей и «снимай» их, уменьшая счётчики у остальных."],
    solve: (n: number, p: number[][]) => {
      const indeg = Array(n).fill(0),
        g: number[][] = Array.from({ length: n }, () => []);
      for (const [a, b] of p) {
        g[b].push(a);
        indeg[a]++;
      }
      const q = indeg.flatMap((d, i) => (d ? [] : [i]));
      for (let k = 0; k < q.length; k++) for (const v of g[q[k]]) if (!--indeg[v]) q.push(v);
      return q.length === n;
    },
    tests: [
      [2, [[1, 0]]],
      [
        2,
        [
          [1, 0],
          [0, 1],
        ],
      ],
      [
        4,
        [
          [1, 0],
          [2, 1],
          [3, 2],
          [1, 3],
        ],
      ],
      [5, []],
      [
        300,
        Array.from({ length: 600 }, () => {
          const a = rnd(1, 299);
          return [a, rnd(0, a - 1)];
        }),
      ],
    ],
  },
  {
    id: "friend-circles",
    title: "Компании друзей",
    difficulty: "Medium",
    pattern: "graphs",
    tags: ["графы", "DSU"],
    name: "countGroups",
    params: ["n", "pairs"],
    statement: "В классе `n` учеников. Каждая пара `[a, b]` — они дружат. Дружба транзитивна: друзья друзей — одна компания. Сколько компаний в классе?",
    constraints: ["1 ≤ n ≤ 10⁴"],
    hints: ["Система непересекающихся множеств (DSU) или обход графа по компонентам."],
    solve: (n: number, p: number[][]) => {
      const par = [...Array(n).keys()];
      const f = (x: number): number => (par[x] === x ? x : (par[x] = f(par[x])));
      let c = n;
      for (const [a, b] of p) {
        const x = f(a),
          y = f(b);
        if (x !== y) {
          par[x] = y;
          c--;
        }
      }
      return c;
    },
    tests: [
      [
        5,
        [
          [0, 1],
          [1, 2],
          [3, 4],
        ],
      ],
      [3, []],
      [
        4,
        [
          [0, 1],
          [2, 3],
          [1, 2],
        ],
      ],
      [500, Array.from({ length: 350 }, () => [rnd(0, 499), rnd(0, 499)])],
    ],
  },
  // ---------- backtracking ----------
  {
    id: "subsets",
    title: "Все наборы кружков",
    difficulty: "Medium",
    pattern: "backtracking",
    tags: ["перебор", "рекурсия"],
    name: "subsets",
    params: ["clubs"],
    statement: "Верни все подмножества массива различных чисел `clubs` (включая пустое). Числа внутри подмножества — в исходном порядке, порядок подмножеств не важен.",
    constraints: ["0 ≤ длина clubs ≤ 10"],
    hints: ["Для каждого элемента два варианта: взять или не взять. Всего 2ⁿ подмножеств."],
    unordered: true,
    solve: (a: number[]) => a.reduce<number[][]>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]]),
    tests: [[[1, 2, 3]], [[0]], [[]], [[5, 1, 9, 3, 7]]],
  },
  {
    id: "permutations",
    title: "Порядок выступлений",
    difficulty: "Medium",
    pattern: "backtracking",
    tags: ["перебор", "рекурсия"],
    name: "permutations",
    params: ["nums"],
    statement: "Верни все перестановки массива различных чисел `nums` — все возможные порядки выступлений. Порядок перестановок не важен.",
    constraints: ["1 ≤ длина nums ≤ 7"],
    hints: ["Выбирай, кто выступает следующим, из ещё не выбранных; после рекурсии верни выбор назад."],
    unordered: true,
    solve: (a: number[]) => {
      const out: number[][] = [];
      const go = (cur: number[], rest: number[]) => {
        if (!rest.length) out.push(cur);
        rest.forEach((x, i) => go([...cur, x], [...rest.slice(0, i), ...rest.slice(i + 1)]));
      };
      go([], a);
      return out;
    },
    tests: [[[1, 2, 3]], [[0, 1]], [[1]], [[4, 2, 7, 1]]],
  },
  {
    id: "combination-sum",
    title: "Набрать сумму монетами",
    difficulty: "Medium",
    pattern: "backtracking",
    tags: ["перебор"],
    name: "combinationSum",
    params: ["coins", "target"],
    statement: "Из номиналов `coins` (каждый можно брать сколько угодно раз) составь все различные наборы с суммой `target`. Каждый набор — по неубыванию, порядок наборов не важен.",
    constraints: ["1 ≤ длина coins ≤ 30", "1 ≤ target ≤ 40"],
    hints: ["Перебирай номиналы начиная с текущего, чтобы не получать одни и те же наборы в разном порядке."],
    unordered: true,
    solve: (c: number[], t: number) => {
      const a = [...c].sort((x, y) => x - y),
        out: number[][] = [];
      const go = (i: number, left: number, cur: number[]) => {
        if (!left) return void out.push(cur);
        for (let j = i; j < a.length && a[j] <= left; j++) go(j, left - a[j], [...cur, a[j]]);
      };
      go(0, t, []);
      return out;
    },
    tests: [
      [[2, 3, 6, 7], 7],
      [[2, 3, 5], 8],
      [[2], 1],
      [[3, 4, 5, 7], 20],
    ],
  },
  {
    id: "n-queens-count",
    title: "Ферзи на доске",
    difficulty: "Hard",
    pattern: "backtracking",
    tags: ["перебор", "рекурсия"],
    name: "queens",
    params: ["n"],
    statement: "Сколькими способами можно расставить `n` ферзей на доске n × n, чтобы они не били друг друга?",
    constraints: ["1 ≤ n ≤ 10"],
    hints: ["Ставь по одному ферзю в каждую строку и помни занятые столбцы и обе диагонали."],
    solve: (n: number) => {
      let c = 0;
      const go = (r: number, cols: number, d1: number, d2: number) => {
        if (r === n) return void c++;
        for (let j = 0; j < n; j++) if (!(cols & (1 << j)) && !(d1 & (1 << (r + j))) && !(d2 & (1 << (r - j + n)))) go(r + 1, cols | (1 << j), d1 | (1 << (r + j)), d2 | (1 << (r - j + n)));
      };
      go(0, 0, 0, 0);
      return c;
    },
    tests: [[4], [1], [6], [8], [9]],
  },
  // ---------- dynamic programming ----------
  {
    id: "climb-stairs",
    title: "Лестница в спортзал",
    difficulty: "Easy",
    pattern: "dp",
    tags: ["динамическое программирование"],
    name: "climbWays",
    params: ["n"],
    statement: "До спортзала `n` ступенек. За шаг можно подняться на 1 или 2 ступеньки. Сколькими способами можно подняться?",
    constraints: ["1 ≤ n ≤ 45"],
    hints: ["На ступеньку n можно прийти с n−1 или с n−2: ways(n) = ways(n−1) + ways(n−2)."],
    solve: (n: number) => {
      let a = 1,
        b = 1;
      for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
      return b;
    },
    tests: [[2], [3], [1], [10], [45]],
  },
  {
    id: "house-robber",
    title: "Сбор макулатуры",
    difficulty: "Medium",
    pattern: "dp",
    tags: ["динамическое программирование"],
    name: "maxCollect",
    params: ["houses"],
    statement: "Вдоль улицы дома, `houses[i]` — сколько кг макулатуры можно забрать в доме i. Нельзя заходить в два соседних дома подряд (соседи обижаются). Сколько можно собрать максимум?",
    constraints: ["1 ≤ длина houses ≤ 10⁵"],
    hints: ["best[i] = max(best[i−1], best[i−2] + houses[i])."],
    solve: (h: number[]) => {
      let a = 0,
        b = 0;
      for (const x of h) [a, b] = [b, Math.max(b, a + x)];
      return b;
    },
    tests: [[[1, 2, 3, 1]], [[2, 7, 9, 3, 1]], [[5]], [arr(1500, 0, 400)]],
  },
  {
    id: "unique-paths",
    title: "Пути по сетке",
    difficulty: "Medium",
    pattern: "dp",
    tags: ["динамическое программирование", "комбинаторика"],
    name: "gridPaths",
    params: ["rows", "cols"],
    statement: "Робот стоит в левом верхнем углу поля `rows × cols` и ходит только вправо или вниз. Сколько разных путей ведут в правый нижний угол?",
    constraints: ["1 ≤ rows, cols ≤ 30"],
    hints: ["В клетку можно прийти сверху или слева: paths[i][j] = paths[i−1][j] + paths[i][j−1]."],
    solve: (n: number, m: number) => {
      const d = Array(m).fill(1);
      for (let i = 1; i < n; i++) for (let j = 1; j < m; j++) d[j] += d[j - 1];
      return d[m - 1];
    },
    tests: [
      [3, 7],
      [3, 2],
      [1, 1],
      [10, 10],
      [16, 16],
    ],
  },
  {
    id: "lcs",
    title: "Общая подпоследовательность",
    difficulty: "Medium",
    pattern: "dp",
    tags: ["динамическое программирование", "строки"],
    name: "lcs",
    params: ["a", "b"],
    statement: "Найди длину наибольшей общей подпоследовательности строк `a` и `b` (символы идут в том же порядке, но не обязательно подряд).",
    constraints: ["1 ≤ длина a, b ≤ 1000"],
    hints: ["dp[i][j] — ответ для первых i символов a и j символов b. Если a[i−1] = b[j−1], то dp = dp[i−1][j−1] + 1."],
    solve: (a: string, b: string) => {
      let prev = Array(b.length + 1).fill(0);
      for (let i = 1; i <= a.length; i++) {
        const cur = [0];
        for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
        prev = cur;
      }
      return prev[b.length];
    },
    tests: [
      ["abcde", "ace"],
      ["abc", "def"],
      ["platform", "bstsplatform"],
      [word(400, "acgt"), word(400, "acgt")],
    ],
  },
  {
    id: "word-break",
    title: "Разбить на слова",
    difficulty: "Medium",
    pattern: "dp",
    tags: ["динамическое программирование", "строки"],
    name: "canSplit",
    params: ["s", "words"],
    statement: "Можно ли разбить строку `s` без пробелов на слова из словаря `words`? Слова можно использовать много раз.",
    constraints: ["1 ≤ длина s ≤ 300", "1 ≤ длина words ≤ 1000"],
    hints: ["ok[i] — можно ли разбить первые i символов. ok[i] = ok[j] и s[j..i] есть в словаре для какого-то j."],
    solve: (s: string, w: string[]) => {
      const d = new Set(w),
        ok = [true];
      for (let i = 1; i <= s.length; i++) {
        ok[i] = false;
        for (let j = 0; j < i && !ok[i]; j++) ok[i] = ok[j] && d.has(s.slice(j, i));
      }
      return ok[s.length];
    },
    tests: [
      ["robotclub", ["robot", "club"]],
      ["applepenapple", ["apple", "pen"]],
      ["catsandog", ["cats", "dog", "sand", "and", "cat"]],
      ["a".repeat(150) + "b", ["a", "aa", "aaa"]],
    ],
  },
  {
    id: "knapsack",
    title: "Рюкзак в поход",
    difficulty: "Hard",
    pattern: "dp",
    tags: ["динамическое программирование", "рюкзак"],
    name: "knapsack",
    params: ["weights", "values", "capacity"],
    statement: "Есть предметы с весом `weights[i]` и пользой `values[i]`. Рюкзак выдерживает `capacity` кг. Каждый предмет можно взять не больше одного раза. Верни максимальную суммарную пользу.",
    constraints: ["1 ≤ предметов ≤ 200", "1 ≤ capacity ≤ 10⁴"],
    hints: ["best[c] — лучшая польза при вместимости c. Перебирай вместимость с конца, чтобы не взять предмет дважды."],
    solve: (w: number[], v: number[], cap: number) => {
      const d = Array(cap + 1).fill(0);
      w.forEach((wi, i) => {
        for (let c = cap; c >= wi; c--) d[c] = Math.max(d[c], d[c - wi] + v[i]);
      });
      return d[cap];
    },
    tests: [
      [[1, 3, 4, 5], [1, 4, 5, 7], 7],
      [[10], [5], 5],
      [[2, 2, 2], [3, 3, 3], 5],
      [arr(120, 1, 60), arr(120, 1, 100), 900],
    ],
  },
  // ---------- greedy ----------
  {
    id: "jump-game",
    title: "Прыжки по кочкам",
    difficulty: "Medium",
    pattern: "greedy",
    tags: ["жадный"],
    name: "canReach",
    params: ["jumps"],
    statement: "Стоишь на первой кочке. С кочки i можно прыгнуть вперёд не дальше чем на `jumps[i]`. Можно ли добраться до последней кочки?",
    constraints: ["1 ≤ длина jumps ≤ 10⁵"],
    hints: ["Держи самую дальнюю достижимую кочку. Если текущая дальше неё — всё."],
    solve: (j: number[]) => {
      let far = 0;
      for (let i = 0; i < j.length; i++) {
        if (i > far) return false;
        far = Math.max(far, i + j[i]);
      }
      return true;
    },
    tests: [[[2, 3, 1, 1, 4]], [[3, 2, 1, 0, 4]], [[0]], [arr(1500, 0, 3)]],
  },
  {
    id: "gas-station",
    title: "Кольцевой маршрут",
    difficulty: "Medium",
    pattern: "greedy",
    tags: ["жадный"],
    name: "startStation",
    params: ["charge", "cost"],
    statement:
      "Электробус ездит по кольцу из n станций. На станции i он заряжается на `charge[i]`, а дорога до следующей стоит `cost[i]`. С какой станции нужно стартовать с пустой батареей, чтобы проехать круг? Если нельзя — −1 (ответ единственный).",
    constraints: ["1 ≤ n ≤ 10⁵"],
    hints: ["Если суммарный заряд меньше суммарной стоимости — ответа нет.", "Если с start застряли на станции i, то ни одна станция между ними не подходит: начинай с i + 1."],
    solve: (g: number[], c: number[]) => {
      let tot = 0,
        cur = 0,
        s = 0;
      for (let i = 0; i < g.length; i++) {
        tot += g[i] - c[i];
        cur += g[i] - c[i];
        if (cur < 0) {
          cur = 0;
          s = i + 1;
        }
      }
      return tot < 0 ? -1 : s;
    },
    tests: [
      [
        [1, 2, 3, 4, 5],
        [3, 4, 5, 1, 2],
      ],
      [
        [2, 3, 4],
        [3, 4, 3],
      ],
      [[5], [4]],
      [
        [4, 1, 6, 2, 8],
        [3, 5, 2, 7, 3],
      ],
    ],
  },
  // ---------- math & bits ----------
  {
    id: "single-number",
    title: "Носок без пары",
    difficulty: "Easy",
    pattern: "math",
    tags: ["биты", "XOR"],
    name: "singleOne",
    params: ["nums"],
    statement: "Каждое число в `nums` встречается дважды, кроме одного. Найди его за O(n) времени и O(1) памяти.",
    constraints: ["1 ≤ длина nums ≤ 3·10⁴"],
    hints: ["x XOR x = 0, а x XOR 0 = x."],
    solve: (a: number[]) => a.reduce((x, y) => x ^ y, 0),
    tests: [[[2, 2, 1]], [[4, 1, 2, 1, 2]], [[1]], [[...Array.from({ length: 500 }, (_, i) => i), 777, ...Array.from({ length: 500 }, (_, i) => 499 - i)]]],
  },
  {
    id: "count-primes",
    title: "Простые числа до N",
    difficulty: "Medium",
    pattern: "math",
    tags: ["математика", "решето Эратосфена"],
    name: "countPrimes",
    params: ["n"],
    statement: "Посчитай, сколько простых чисел строго меньше `n`.",
    constraints: ["0 ≤ n ≤ 5·10⁶"],
    hints: ["Решето Эратосфена: вычёркивай кратные каждого простого, начиная с его квадрата."],
    solve: (n: number) => {
      if (n < 3) return 0;
      const s = new Uint8Array(n);
      let c = 0;
      for (let i = 2; i < n; i++)
        if (!s[i]) {
          c++;
          for (let j = i * i; j < n; j += i) s[j] = 1;
        }
      return c;
    },
    tests: [[10], [0], [2], [100], [1000000]],
  },
  {
    id: "fast-power",
    title: "Быстрое возведение в степень",
    difficulty: "Medium",
    pattern: "math",
    tags: ["математика", "двоичное возведение"],
    name: "powMod",
    params: ["a", "n", "m"],
    statement: "Вычисли aⁿ mod m. Степень `n` бывает огромной, поэтому нужно решение за O(log n). Промежуточные произведения держи по модулю `m` (m < 46340, чтобы не было переполнения).",
    constraints: ["0 ≤ a ≤ 10⁹", "0 ≤ n ≤ 10¹⁵", "1 ≤ m < 46340"],
    hints: ["aⁿ = (a^(n/2))² для чётного n и a·aⁿ⁻¹ для нечётного."],
    solve: (a: number, n: number, m: number) => {
      let r = 1 % m,
        b = a % m,
        e = n;
      while (e > 0) {
        if (e % 2 === 1) r = (r * b) % m;
        b = (b * b) % m;
        e = Math.floor(e / 2);
      }
      return r;
    },
    tests: [
      [2, 10, 1000],
      [3, 0, 7],
      [7, 1e15, 46337],
      [123456789, 987654321, 40000],
    ],
  },
];
