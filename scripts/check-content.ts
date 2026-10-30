// Sanity checks for the synthetic content: run with `npm run check:content`.
import { SAT_BANK, isCorrect, freshMath } from "../shared/sat";
import { VOCAB } from "../shared/vocab";
import { PROBLEMS, sameAnswer } from "../shared/problems";
import { BLITZ } from "../shared/content";

let problems = 0;
const fail = (msg: string) => {
  problems++;
  console.log("✗", msg);
};

const ids = new Set<string>();
for (const q of [...SAT_BANK, ...Array.from({ length: 300 }, (_, i) => freshMath(i + 1))]) {
  if (ids.has(q.id) && !q.id.includes("-x")) fail(`duplicate id ${q.id}`);
  ids.add(q.id);
  if (q.choices) {
    if (q.choices.length !== 4) fail(`${q.id}: ${q.choices.length} choices`);
    if (new Set(q.choices).size !== q.choices.length) fail(`${q.id}: duplicate choices ${JSON.stringify(q.choices)}`);
    if (typeof q.answer !== "number" || q.answer < 0 || q.answer > 3) fail(`${q.id}: bad answer index`);
    if (!isCorrect(q, q.answer)) fail(`${q.id}: own answer rejected`);
  } else if (!isCorrect(q, q.answer)) fail(`${q.id}: grid-in answer rejected`);
  if (!q.explanation) fail(`${q.id}: no explanation`);
}

const bySection = { rw: 0, math: 0 } as Record<string, number>;
for (const q of SAT_BANK) bySection[q.section]!++;
for (const u of VOCAB) if (u.words.length !== 10) fail(`vocab ${u.id}: ${u.words.length} words`);
for (const b of BLITZ) if (b.answer < 0 || b.answer >= b.options.length) fail(`blitz ${b.id}`);

// Reference solutions prove that every coding test is consistent.
const REF: Record<string, (...a: any[]) => unknown> = {
  "two-sum": (nums: number[], t: number) => {
    const m = new Map<number, number>();
    for (let i = 0; i < nums.length; i++) {
      if (m.has(t - nums[i]!)) return [m.get(t - nums[i]!), i];
      m.set(nums[i]!, i);
    }
  },
  palindrome: (s: string) => {
    const c = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return c === [...c].reverse().join("");
  },
  fizzbuzz: (n: number) => Array.from({ length: n }, (_, i) => ((i + 1) % 15 === 0 ? "FizzBuzz" : (i + 1) % 3 === 0 ? "Fizz" : (i + 1) % 5 === 0 ? "Buzz" : String(i + 1))),
  vowels: (t: string) => (t.match(/[aeiou]/gi) ?? []).length,
  "missing-number": (nums: number[]) => (nums.length * (nums.length + 1)) / 2 - nums.reduce((a, b) => a + b, 0),
  "average-grade": (g: number[]) => (g.length ? Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 100) / 100 : 0),
  "valid-brackets": (s: string) => {
    const st: string[] = [];
    const pair: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    for (const ch of s) {
      if ("([{".includes(ch)) st.push(ch);
      else if (st.pop() !== pair[ch]) return false;
    }
    return st.length === 0;
  },
  anagram: (a: string, b: string) => [...a].sort().join("") === [...b].sort().join(""),
  "merge-sorted": (a: number[], b: number[]) => [...a, ...b].sort((x, y) => x - y),
  "max-subarray": (n: number[]) => {
    let best = n[0]!;
    let cur = 0;
    for (const x of n) {
      cur = Math.max(x, cur + x);
      best = Math.max(best, cur);
    }
    return best;
  },
  "group-anagrams": (w: string[]) => {
    const m = new Map<string, string[]>();
    for (const x of w) {
      const k = [...x].sort().join("");
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    return [...m.values()];
  },
  "longest-unique": (s: string) => {
    let best = 0;
    let left = 0;
    const last = new Map<string, number>();
    [...s].forEach((ch, i) => {
      if ((last.get(ch) ?? -1) >= left) left = last.get(ch)! + 1;
      last.set(ch, i);
      best = Math.max(best, i - left + 1);
    });
    return best;
  },
  "product-except-self": (n: number[]) => n.map((_, i) => n.reduce((p, x, j) => (j === i ? p : p * x), 1)),
  "coin-change": (coins: number[], amount: number) => {
    const dp = Array(amount + 1).fill(Infinity);
    dp[0] = 0;
    for (let x = 1; x <= amount; x++) for (const c of coins) if (c <= x) dp[x] = Math.min(dp[x], dp[x - c] + 1);
    return dp[amount] === Infinity ? -1 : dp[amount];
  },
  "search-insert": (n: number[], t: number) => {
    const i = n.findIndex((x) => x >= t);
    return i < 0 ? n.length : i;
  },
  "top-k": (w: string[], k: number) => {
    const c = new Map<string, number>();
    w.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1));
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map((x) => x[0]);
  },
  "rotate-matrix": (m: number[][]) => m[0]!.map((_, i) => m.map((row) => row[i]!).reverse()),
  lis: (n: number[]) => {
    const dp = n.map(() => 1);
    n.forEach((x, i) => {
      for (let j = 0; j < i; j++) if (n[j]! < x) dp[i] = Math.max(dp[i]!, dp[j]! + 1);
    });
    return Math.max(...dp);
  },
  "rain-water": (h: number[]) => h.reduce((s, x, i) => s + Math.max(0, Math.min(Math.max(...h.slice(0, i + 1)), Math.max(...h.slice(i))) - x), 0),
  "edit-distance": (a: string, b: string) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    return dp[a.length]![b.length];
  },
};

for (const p of PROBLEMS) {
  const ref = REF[p.id];
  if (!ref) {
    fail(`no reference solution for ${p.id}`);
    continue;
  }
  p.tests.forEach((t, i) => {
    const got = ref(...(JSON.parse(JSON.stringify(t.args)) as unknown[]));
    if (!sameAnswer(got, t.expected, p.unordered)) fail(`${p.id} test ${i + 1}: expected ${JSON.stringify(t.expected)}, reference gives ${JSON.stringify(got)}`);
  });
}

console.log(`SAT bank: ${SAT_BANK.length} questions (R&W ${bySection.rw}, Math ${bySection.math}) + unlimited generated variants`);
console.log(`Vocabulary: ${VOCAB.length} units · Coding: ${PROBLEMS.length} problems · Bug Blitz: ${BLITZ.length}`);
console.log(problems ? `${problems} problem(s) found` : "All content checks passed");
process.exit(problems ? 1 : 0);
