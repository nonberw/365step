import fs from "node:fs";
import path from "node:path";
import * as replicad from "replicad";
import opencascade from "replicad-opencascadejs";
import { INTENTS, extractParams, predict, type IntentModel } from "../../shared/cadIntent";

// Step 3: every template must build on the real CAD kernel and come out at the size it promises,
// for requests the way students type them. Run: npx tsx scripts/cad-intent/templates-check.ts

const wasm = path.resolve("node_modules/replicad-opencascadejs/dist/replicad_single.wasm");
replicad.setOC((await (opencascade as unknown as (o: object) => Promise<unknown>)({ locateFile: () => wasm })) as Parameters<typeof replicad.setOC>[0]);
const model = JSON.parse(fs.readFileSync("shared/models/cad-intent.json", "utf8")) as IntentModel;

const PROMPTS = [
  "пластина 80 на 50 толщиной 3 мм с 4 отверстиями под м3",
  "планка 120x20x4 с тремя отверстиями",
  "коробочка 60х40х30 стенки 2 мм",
  "корпус 100 x 70 x 35 со стенкой 2.5",
  "втулка диаметр 12 внутренний диаметр 8 высота 15",
  "шайба диаметром 20 мм толщиной 2 с отверстием м5",
  "уголок 40х40х30 толщина 4",
  "шестерня 24 зуба диаметр 52 толщина 8",
  "шестерня 16 зубьев",
  "подставка под телефон 60 градусов шириной 80",
  "a box 100x60x40 with 2 mm walls",
];

let bad = 0;
for (const text of PROMPTS) {
  const pred = predict(model, text);
  const intent = INTENTS.find((i) => i.id === pred.label);
  const made = intent?.build?.(extractParams(text));
  if (!made) {
    console.log(`—    ${text} → ${pred.label} (${pred.p.toFixed(2)}): шаблона нет`);
    continue;
  }
  try {
    const shape = (new Function("replicad", `${made.code}\n;return main;`)(replicad) as (r: typeof replicad) => replicad.Shape3D)(replicad);
    const [a, b] = shape.boundingBox.bounds;
    const got = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ok = !made.expect.length || [...got].sort((x, y) => x - y).every((g, i) => Math.abs(g - [...made.expect].sort((x, y) => x - y)[i]) <= Math.max(1, made.expect[i] * 0.05));
    if (!ok) bad++;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${text} → ${pred.label} (${pred.p.toFixed(2)}) ${got.map((v) => v.toFixed(1)).join("×")} мм${made.expect.length ? ` (обещано ${made.expect.map((v) => v.toFixed(1)).join("×")})` : ""}`,
    );
  } catch (e) {
    bad++;
    console.log(`FAIL ${text} → ${pred.label}: не строится: ${String(e)}`);
  }
}
process.exit(bad ? 1 : 0);
