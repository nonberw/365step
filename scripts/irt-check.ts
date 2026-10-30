import { bktMastery, calibratedB, eap, expectedPoints, information, p3pl, sameAnswer, type Response } from "../shared/irt";

// Checks of the adaptive ENT engine: a simulated student of known ability is tested adaptively and the estimate must
// come close; answer matching must accept equivalent forms. Run: npx tsx scripts/irt-check.ts

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
// the bank covers −3…3.5 like a real one with level D items; with a ceiling at 2.4 strong students are underestimated
const bank = Array.from({ length: 520 }, (_, i) => ({ id: i, a: 1, b: -3 + (i % 65) * 0.1, c: 0.02 }));
let fails = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) fails++;
  console.log(`${cond ? "OK  " : "FAIL"} ${msg}`);
};

// 30 simulated students per ability level, 30 adaptively chosen items each: the estimate must be unbiased
// and the ±2·SE interval must cover the true ability in at least 85 % of cases.
for (const trueTheta of [-1.5, 0, 1.2, 2]) {
  let sum = 0;
  let cover = 0;
  let items = 0;
  for (let k = 0; k < 30; k++) {
    const used = new Set<number>();
    const resp: Response[] = [];
    let est = { theta: 0, se: 1 };
    while (est.se > 0.35 && resp.length < 30) {
      const next = bank.filter((x) => !used.has(x.id)).sort((x, y) => information(est.theta, y) - information(est.theta, x))[0];
      used.add(next.id);
      resp.push({ ...next, correct: rand() < p3pl(trueTheta, next) });
      est = eap(resp);
    }
    sum += est.theta;
    items += resp.length;
    if (Math.abs(est.theta - trueTheta) < 2 * est.se) cover++;
  }
  const mean = sum / 30;
  ok(
    Math.abs(mean - trueTheta) < 0.3 && cover / 30 >= 0.85,
    `θ=${trueTheta}: средняя оценка ${mean.toFixed(2)}, интервал ±2·SE накрыл истину в ${Math.round((cover / 30) * 100)} %, в среднем ${(items / 30).toFixed(0)} заданий`,
  );
}

ok(calibratedB("B", 0, 0) === 0, "сложность без данных = априорная (B → 0)");
ok(calibratedB("A", 200, 20) > 1.5, "задание A, которое решают 10 %, становится трудным");
ok(expectedPoints(3, [{ type: "single", count: 25 }]) > 22 && expectedPoints(-3, [{ type: "single", count: 25 }]) < 8, "прогноз баллов растёт с θ");
ok(bktMastery(Array(6).fill({ correct: true, typed: true })) > 0.9 && bktMastery(Array(6).fill({ correct: false, typed: true })) < 0.15, "BKT: шесть верных подряд — тема освоена, шесть ошибок — нет");
for (const [g, a, want] of [
  ["3,5", ["7/2"], true],
  ["  -12 м/с ", ["-12"], true],
  ["0.333", ["1/3"], true],
  ["0.33", ["1/3"], false],
  ["Абай Құнанбайұлы", ["абай кунанбайулы", "абай құнанбайұлы"], true],
  ["Ёлка", ["елка"], true],
  ["-3", ["$-3$"], true],
  ["0,75", ["$\\frac{3}{4}$"], true],
  ["", ["0"], false],
] as const)
  ok(sameAnswer(g, [...a]) === want, `«${g}» vs ${JSON.stringify(a)} → ${want}`);

process.exit(fails ? 1 : 0);
