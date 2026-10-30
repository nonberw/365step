import fs from "node:fs";
import { DIM, INTENTS, featurize, predict, type IntentModel } from "../../shared/cadIntent";

// Step 2: train the school's own request classifier on the teacher's labels.
// Model: multinomial logistic regression (softmax) over 8192 hashed character n-gram features, trained with
// mini-batch gradient descent and L2 regularisation. Evaluation: a stratified 80/20 split by a fixed seed, plus
// a small set of hand-written requests the teacher never saw. The final model is retrained on all the data.
// Run: npx tsx scripts/cad-intent/train.ts

const rows = fs
  .readFileSync("data-train/cad-intent.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as { text: string; label: string });
const seen = new Set<string>();
const data = rows.filter((r) => r.text.length > 2 && !seen.has(r.text.toLowerCase()) && seen.add(r.text.toLowerCase()));
const labels = INTENTS.map((i) => i.id);

let seed = 20261029;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffled = [...data].sort(() => rand() - 0.5);
const test: typeof data = [];
const train: typeof data = [];
for (const l of labels) {
  const cls = shuffled.filter((r) => r.label === l);
  const cut = Math.round(cls.length * 0.2);
  test.push(...cls.slice(0, cut));
  train.push(...cls.slice(cut));
}

// Written by hand, in the way students actually type — never shown to the teacher model.
const HANDWRITTEN: [string, string][] = [
  ["сделай пластину 80 на 50 толщиной 3 мм с 4 отверстиями под м3", "plate"],
  ["нужна планка 120x20x4 с тремя дырками", "plate"],
  ["коробочка для скрепок 60х40х30", "box"],
  ["корпус под arduino nano со стенками 2 мм", "box"],
  ["втулка диаметр 12 внутренний диаметр 8 высота 15", "cylinder"],
  ["шайба 20 мм с отверстием м5", "cylinder"],
  ["уголок 40х40 толщина 4 для полки", "bracket"],
  ["кронштейн на стену под цветок", "bracket"],
  ["шестерня 24 зуба диаметр 50", "gear"],
  ["зубчатое колесо для редуктора 16 зубьев", "gear"],
  ["подставка под телефон 60 градусов", "stand"],
  ["держатель для планшета на стол", "stand"],
  ["ваза в форме спирали", "other"],
  ["брелок с моим именем", "other"],
  ["крючок для полотенца на дверь", "other"],
  ["корпус для дрона 5 дюймов", "other"],
  ["телефонға тұғыр 70 градус", "stand"],
  ["тісті дөңгелек 30 тіс", "gear"],
  ["phone stand at 45 degrees", "stand"],
  ["a box 100x60x40 with 2 mm walls", "box"],
];

function fit(set: typeof data, epochs = 60): IntentModel {
  const K = labels.length;
  const w = new Float64Array(K * DIM);
  const b = new Float64Array(K);
  const X = set.map((r) => [...featurize(r.text)]);
  const Y = set.map((r) => labels.indexOf(r.label));
  const lambda = 3e-4;
  for (let ep = 0; ep < epochs; ep++) {
    const lr = 1.5 / (1 + ep * 0.08);
    const order = X.map((_, i) => i).sort(() => rand() - 0.5);
    for (const i of order) {
      const x = X[i];
      const z = Array.from({ length: K }, (_, k) => x.reduce((s, [j, v]) => s + w[k * DIM + j] * v, b[k]));
      const mx = Math.max(...z);
      const e = z.map((v) => Math.exp(v - mx));
      const sum = e.reduce((a, c) => a + c, 0);
      for (let k = 0; k < K; k++) {
        const g = e[k] / sum - (k === Y[i] ? 1 : 0);
        b[k] -= lr * g;
        for (const [j, v] of x) w[k * DIM + j] -= lr * (g * v + lambda * w[k * DIM + j]);
      }
    }
  }
  return { labels, w: Array.from(w, (v) => Math.round(v * 1000) / 1000), b: Array.from(b, (v) => Math.round(v * 1000) / 1000), meta: { trainedAt: new Date().toISOString(), examples: set.length, accuracy: 0 } };
}

function evaluate(model: IntentModel, set: [string, string][], title: string) {
  const conf = new Map<string, number>();
  let ok = 0;
  for (const [text, label] of set) {
    const p = predict(model, text);
    if (p.label === label) ok++;
    else conf.set(`${label}→${p.label}`, (conf.get(`${label}→${p.label}`) ?? 0) + 1);
  }
  const acc = ok / set.length;
  console.log(`${title}: точность ${(acc * 100).toFixed(1)} % (${ok}/${set.length})${conf.size ? `, ошибки: ${[...conf].map(([k, v]) => `${k}×${v}`).join(", ")}` : ""}`);
  return acc;
}

console.log(`данных: ${data.length} (обучение ${train.length}, тест ${test.length}), признаков ${DIM}, классов ${labels.length}`);
const t0 = Date.now();
const trial = fit(train);
console.log(`обучение: ${((Date.now() - t0) / 1000).toFixed(1)} с`);
evaluate(
  trial,
  train.map((r) => [r.text, r.label]),
  "на обучающих",
);
const testAcc = evaluate(
  trial,
  test.map((r) => [r.text, r.label]),
  "на отложенных 20 %",
);
evaluate(trial, HANDWRITTEN, "на написанных вручную");
// The product only answers locally when the model is confident; elsewhere it asks Claude.
for (const th of [0.6, 0.7, 0.8, 0.9]) {
  const all = [...test.map((r) => [r.text, r.label] as [string, string]), ...HANDWRITTEN];
  const sure = all.map(([t, l]) => ({ l, p: predict(trial, t) })).filter((x) => x.p.p >= th && x.p.label !== "other");
  const right = sure.filter((x) => x.p.label === x.l).length;
  console.log(`порог ${th}: модель уверена в ${Math.round((sure.length / all.length) * 100)} % запросов, из них верно ${((right / Math.max(1, sure.length)) * 100).toFixed(1)} %`);
}

const final = fit(data);
final.meta.accuracy = Number(testAcc.toFixed(3));
evaluate(final, HANDWRITTEN, "финальная модель, написанные вручную");
fs.mkdirSync("shared/models", { recursive: true });
fs.writeFileSync("shared/models/cad-intent.json", JSON.stringify(final));
console.log(`модель → shared/models/cad-intent.json (${(fs.statSync("shared/models/cad-intent.json").size / 1024).toFixed(0)} КБ)`);
