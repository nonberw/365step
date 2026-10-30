// Psychometric core of the adaptive ENT trainer. Pure functions, no I/O, so they are unit-testable.
//
// Item response theory (IRT): the chance that a student of ability θ answers an item right is the 3-parameter
// logistic model P(θ) = c + (1 − c) / (1 + e^(−a(θ − b))): b — difficulty, a — discrimination, c — guessing
// (0.25 for 4 options, ~0 for a typed answer). Ability is estimated by EAP (expected a posteriori): the posterior
// over θ on a grid, prior N(0, 1.25²) (wide enough that strong and weak students are not pulled to the middle). Its standard deviation is the measurement error — the test stops when it is small.
//
// Knowledge tracing (BKT, Corbett & Anderson 1995): per topic, a hidden "learned / not yet" state updated after every
// answer with learn, slip and guess probabilities. Gives a mastery probability for each topic.

export interface Item {
  a: number;
  b: number;
  c: number;
}
export interface Response extends Item {
  correct: boolean;
}

export const p3pl = (theta: number, it: Item) => it.c + (1 - it.c) / (1 + Math.exp(-it.a * (theta - it.b)));

/** Fisher information of an item at θ (3PL). */
export function information(theta: number, it: Item) {
  const p = p3pl(theta, it);
  const q = 1 - p;
  return it.a ** 2 * (q / p) * ((p - it.c) / (1 - it.c)) ** 2 || 0;
}

const GRID = Array.from({ length: 161 }, (_, i) => -4 + i * 0.05);

/** EAP ability estimate and its posterior SD. */
export function eap(responses: Response[]): { theta: number; se: number } {
  const logPost = GRID.map((t) => {
    let l = (-0.5 * t * t) / 1.5625;
    for (const r of responses) {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, p3pl(t, r)));
      l += Math.log(r.correct ? p : 1 - p);
    }
    return l;
  });
  const max = Math.max(...logPost);
  const w = logPost.map((l) => Math.exp(l - max));
  const sum = w.reduce((a, b) => a + b, 0);
  const theta = GRID.reduce((acc, t, i) => acc + t * w[i], 0) / sum;
  const v = GRID.reduce((acc, t, i) => acc + (t - theta) ** 2 * w[i], 0) / sum;
  return { theta, se: Math.sqrt(v) };
}

/** Prior difficulty from the specification level, then pulled towards what students actually do (shrinkage). */
export function calibratedB(level: "A" | "B" | "C" | "D", attempts: number, right: number, guessing = 0) {
  const prior = { A: -1, B: 0, C: 1, D: 1.6 }[level];
  if (!attempts) return prior;
  // proportion right with a +1/+2 continuity correction, guessing removed, turned into a logit difficulty
  const p = (right + 1) / (attempts + 2);
  const pTrue = Math.min(0.97, Math.max(0.03, (p - guessing) / (1 - guessing)));
  const empirical = -Math.log(pTrue / (1 - pTrue));
  const k = 8; // the prior counts like 8 answers
  return (prior * k + empirical * attempts) / (k + attempts);
}

/** ENT points expected in a block of the given composition at ability θ (items of the A/B/C mix of the specification). */
export function expectedPoints(theta: number, plan: { type: string; count: number }[]) {
  const mix: [number, number][] = [
    [-1, 0.5],
    [0, 0.3],
    [1, 0.2],
  ];
  let total = 0;
  for (const part of plan) {
    const pRight = mix.reduce((acc, [b, w]) => acc + w * p3pl(theta, { a: 1.1, b, c: part.type === "multi" || part.type === "match" ? 0.05 : 0.25 }), 0);
    // two-point items: 2 for all right, 1 for one mistake — approximated by the chance of being right twice / once
    total += part.type === "multi" || part.type === "match" ? part.count * (2 * pRight * pRight + 2 * pRight * (1 - pRight) * 0.5) : part.count * pRight;
  }
  return total;
}

export interface Bkt {
  init: number;
  learn: number;
  slip: number;
  guess: number;
}
export const BKT_TYPED: Bkt = { init: 0.2, learn: 0.12, slip: 0.08, guess: 0.03 };
export const BKT_CHOICE: Bkt = { init: 0.2, learn: 0.1, slip: 0.1, guess: 0.25 };

/** Probability the topic is learned after this sequence of answers. */
export function bktMastery(answers: { correct: boolean; typed: boolean }[]) {
  let L = BKT_CHOICE.init;
  for (const a of answers) {
    const m = a.typed ? BKT_TYPED : BKT_CHOICE;
    const post = a.correct ? (L * (1 - m.slip)) / (L * (1 - m.slip) + (1 - L) * m.guess) : (L * m.slip) / (L * m.slip + (1 - L) * (1 - m.guess));
    L = post + (1 - post) * m.learn;
  }
  return L;
}

/** Typed answers: numbers compare with tolerance (3,5 = 3.5 = 7/2), words ignoring case, spaces and ё. */
export function normalizeAnswer(s: string): { num: number | null; text: string } {
  const t = s
    // LaTeX from the question bank: $-3$, \frac{3}{4}, 2\cdot 10^{3}
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/[$\\{}]/g, "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ");
  const numText = t.replace(/\s/g, "").replace(",", ".");
  const frac = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(numText);
  let num: number | null = null;
  if (frac) num = Number(frac[1]) / Number(frac[2]);
  else {
    const m = /^(-?\d+(?:\.\d+)?(?:e-?\d+)?)(?:[a-zа-я°%²³/.]*)?$/.exec(numText);
    if (m) num = Number(m[1]);
  }
  return { num: num !== null && Number.isFinite(num) ? num : null, text: t.replace(/[.,;:!?«»"'()]/g, "").trim() };
}

export function sameAnswer(given: string, accept: string[]) {
  const g = normalizeAnswer(given);
  return accept.some((a) => {
    const x = normalizeAnswer(a);
    if (g.num !== null && x.num !== null) return Math.abs(g.num - x.num) <= Math.max(1e-6, Math.abs(x.num) * 1e-3);
    return g.text !== "" && g.text === x.text;
  });
}
