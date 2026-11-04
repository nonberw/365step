import type { Difficulty } from "./types";

function randomFrom(seed: string) {
  let state = 2166136261;
  for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => { state += 0x6d2b79f5; let x = state; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}

/** Full seeded permutation; avoids runs of three levels while other levels remain. */
export function orderBank<T extends { difficulty: Difficulty }>(items: readonly T[], seed: string): T[] {
  const random = randomFrom(seed);
  const buckets = [1, 2, 3].map(level => {
    const bucket = items.filter(q => q.difficulty === level);
    for (let i = bucket.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [bucket[i], bucket[j]] = [bucket[j]!, bucket[i]!]; }
    return bucket;
  });
  const ordered: T[] = []; let last = -1, run = 0;
  while (ordered.length < items.length) {
    let choices = buckets.map((b, i) => ({ i, n: b.length })).filter(b => b.n);
    if (run >= 2 && choices.length > 1) choices = choices.filter(b => b.i !== last);
    let ticket = random() * choices.reduce((n, b) => n + b.n, 0);
    const selected = choices.find(b => (ticket -= b.n) < 0) ?? choices[choices.length - 1]!;
    ordered.push(buckets[selected.i]!.pop()!);
    run = selected.i === last ? run + 1 : 1; last = selected.i;
  }
  return ordered;
}
