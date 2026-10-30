// BSTS's own request-understanding model for the AI CAD designer.
//
// It is trained by knowledge distillation: Claude labels hundreds of student-style requests (scripts/cad-intent),
// and a small multinomial logistic regression over hashed character n-grams learns to recognise the kind of part.
// Recognised requests get their sizes pulled out by rules and are built from verified parametric templates —
// instantly and without an API call. Everything unusual goes to Claude as before.

export interface Params {
  dims: number[];
  diameter?: number;
  inner?: number;
  thickness?: number;
  height?: number;
  width?: number;
  length?: number;
  teeth?: number;
  holes?: number;
  holeD?: number;
  angle?: number;
}

export interface Intent {
  id: string;
  title: string;
  /** what the teacher model is told when it writes examples */
  describe: string;
  /** replicad code and the size it should come out at; null when the request lacks what the template needs */
  build?: (p: Params) => { code: string; expect: number[]; explain: string; params: string[] } | null;
}

const n = (v: number | undefined, d: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v ?? d));
const f = (v: number) => Number(v.toFixed(2));

export const INTENTS: Intent[] = [
  {
    id: "plate",
    title: "Пластина с отверстиями",
    describe: "плоская прямоугольная пластина, планка, крепёжная площадка или основание, часто с отверстиями под винты",
    build: (p) => {
      const [a, b, c] = [...p.dims].sort((x, y) => y - x);
      const w = n(p.length ?? a, 60, 5, 400);
      const d = n(p.width ?? b, 40, 5, 400);
      const t = n(p.thickness ?? (p.dims.length >= 3 ? c : undefined), 4, 0.8, 50);
      const holes = Math.round(n(p.holes, 0, 0, 12));
      const hd = n(p.holeD, 4, 1, Math.min(w, d) / 2);
      const code = `// Пластина ${f(w)} × ${f(d)} × ${f(t)} мм${holes ? `, отверстий: ${holes} (Ø${f(hd)})` : ""}
const W = ${f(w)}, D = ${f(d)}, T = ${f(t)};
const HOLES = ${holes}, HOLE_D = ${f(hd)}, EDGE = ${f(Math.max(hd, 6))};

function main(r) {
  let plate = r.drawRoundedRectangle(W, D, Math.min(3, D / 4)).sketchOnPlane().extrude(T);
  // 4 отверстия — по углам, иначе — в ряд по длине
  const pts = HOLES === 4
    ? [[W / 2 - EDGE, D / 2 - EDGE], [-W / 2 + EDGE, D / 2 - EDGE], [-W / 2 + EDGE, -D / 2 + EDGE], [W / 2 - EDGE, -D / 2 + EDGE]]
    : Array.from({ length: HOLES }, (_, i) => [-W / 2 + (W * (i + 1)) / (HOLES + 1), 0]);
  for (const [x, y] of pts) plate = plate.cut(r.makeCylinder(HOLE_D / 2, T + 2, [x, y, -1]));
  return plate;
}
`;
      return {
        code,
        expect: [w, d, t],
        explain: `Пластина со скруглёнными углами${holes ? ` и ${holes} отверстиями Ø${f(hd)} мм` : ""}. Меняй размеры, число и диаметр отверстий в первых строках.`,
        params: ["W", "D", "T", "HOLES", "HOLE_D"],
      };
    },
  },
  {
    id: "box",
    title: "Коробка или корпус",
    describe: "открытая сверху коробка, ящик, контейнер, корпус для платы или батарейки, органайзер с одной ячейкой",
    build: (p) => {
      const [a, b, c] = [...p.dims].sort((x, y) => y - x);
      const w = n(p.length ?? a, 60, 10, 400);
      const d = n(p.width ?? b, 40, 10, 400);
      const h = n(p.height ?? c, 30, 5, 300);
      const t = n(p.thickness, 2, 0.8, Math.min(w, d) / 4);
      const code = `// Коробка ${f(w)} × ${f(d)} × ${f(h)} мм, стенки ${f(t)} мм, открыта сверху
const W = ${f(w)}, D = ${f(d)}, H = ${f(h)}, WALL = ${f(t)};

function main(r) {
  const outer = r.makeBaseBox(W, D, H);
  const inner = r.makeBaseBox(W - 2 * WALL, D - 2 * WALL, H).translate(0, 0, WALL);
  return outer.cut(inner);
}
`;
      return { code, expect: [w, d, h], explain: `Коробка со стенками и дном ${f(t)} мм. Чтобы закрыть её, сделай крышку с бортиком (урок CAD «Крышка с посадкой»).`, params: ["W", "D", "H", "WALL"] };
    },
  },
  {
    id: "cylinder",
    title: "Цилиндр, втулка или шайба",
    describe: "цилиндр, втулка, проставка, шайба, кольцо-проставка, ось, трубка — тело вращения с отверстием или без",
    build: (p) => {
      const D = n(p.diameter ?? p.dims[0], 20, 1, 300);
      const h = n(p.height ?? p.thickness ?? p.dims[1], 10, 0.5, 400);
      const inner = p.inner !== undefined ? n(p.inner, 0, 0, D - 1) : p.holeD !== undefined ? n(p.holeD, 0, 0, D - 1) : 0;
      const code = `// Цилиндр Ø${f(D)} × ${f(h)} мм${inner ? `, отверстие Ø${f(inner)}` : ""}
const D = ${f(D)}, H = ${f(h)}, HOLE = ${f(inner)};

function main(r) {
  let part = r.makeCylinder(D / 2, H);
  if (HOLE > 0) part = part.cut(r.makeCylinder(HOLE / 2, H + 2, [0, 0, -1]));
  return part.chamfer(Math.min(0.5, H / 10));
}
`;
      return { code, expect: [D, D, h], explain: `${inner ? "Втулка" : "Цилиндр"} Ø${f(D)} мм высотой ${f(h)} мм с фаской по краям, чтобы легче вставлялась.`, params: ["D", "H", "HOLE"] };
    },
  },
  {
    id: "bracket",
    title: "Уголок или кронштейн",
    describe: "L-образный уголок, кронштейн, держатель на стену, крепёжный угол с отверстиями",
    build: (p) => {
      const [a, b, c] = [...p.dims].sort((x, y) => y - x);
      const len = n(p.length ?? a, 40, 10, 300);
      const hgt = n(p.height ?? b ?? a, 40, 10, 300);
      const wid = n(p.width ?? c, 30, 5, 300);
      const t = n(p.thickness, 4, 1.5, 20);
      const hd = n(p.holeD, 4.4, 2, wid / 2);
      const code = `// Уголок: полка ${f(len)} мм, стенка ${f(hgt)} мм, ширина ${f(wid)} мм, толщина ${f(t)} мм, отверстия Ø${f(hd)}
const L = ${f(len)}, H = ${f(hgt)}, W = ${f(wid)}, T = ${f(t)}, HOLE_D = ${f(hd)};

function main(r) {
  let b = r.makeBaseBox(L, W, T).translate(L / 2, 0, 0).fuse(r.makeBaseBox(T, W, H).translate(T / 2, 0, 0));
  // ребро жёсткости посередине
  const rib = r.draw([T, 0]).lineTo([T + (L - T) * 0.6, 0]).lineTo([T, (H - T) * 0.6]).close().sketchOnPlane("XZ", T / 2).extrude(-T).translate(0, 0, T);
  b = b.fuse(rib);
  for (const y of [-W / 3.2, W / 3.2]) {
    b = b.cut(r.makeCylinder(HOLE_D / 2, T + 2, [L * 0.75, y, -1]));
    b = b.cut(r.makeCylinder(HOLE_D / 2, T + 2, [-1, y, H * 0.75], [1, 0, 0]));
  }
  return b;
}
`;
      return { code, expect: [len, wid, hgt], explain: `L-кронштейн с ребром жёсткости и двумя отверстиями на каждой стороне.`, params: ["L", "H", "W", "T", "HOLE_D"] };
    },
  },
  {
    id: "gear",
    title: "Шестерня",
    describe: "шестерня, зубчатое колесо, звёздочка с зубьями",
    build: (p) => {
      const teeth = Math.round(n(p.teeth, 20, 6, 80));
      const D = n(p.diameter ?? p.dims[0], teeth * 2 + 4, 10, 300);
      const t = n(p.thickness ?? p.height, 6, 1, 50);
      const bore = n(p.holeD ?? p.inner, 5, 0, D / 2);
      const code = `// Шестерня: ${teeth} зубьев, Ø${f(D)} мм, толщина ${f(t)} мм, вал Ø${f(bore)}
const N = ${teeth}, D_OUT = ${f(D)}, T = ${f(t)}, BORE = ${f(bore)};
const M = D_OUT / (N + 2);           // модуль зацепления
const R_OUT = D_OUT / 2, R_ROOT = R_OUT - 2.25 * M;

function main(r) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI, s = Math.PI / N;
    for (const [rr, da] of [[R_ROOT, -s * 0.55], [R_OUT, -s * 0.25], [R_OUT, s * 0.25], [R_ROOT, s * 0.55]]) pts.push([rr * Math.cos(a + da), rr * Math.sin(a + da)]);
  }
  let d = r.draw(pts[0]);
  for (const p of pts.slice(1)) d = d.lineTo(p);
  let gear = d.close().sketchOnPlane().extrude(T);
  if (BORE > 0) gear = gear.cut(r.makeCylinder(BORE / 2, T + 2, [0, 0, -1]));
  return gear;
}
`;
      return {
        code,
        expect: [D, D, t],
        explain: `Шестерня с модулем ${f(D / (teeth + 2))} мм: две шестерни с одинаковым модулем зацепляются. Профиль зуба трапециевидный (упрощённый).`,
        params: ["N", "D_OUT", "T", "BORE"],
      };
    },
  },
  {
    id: "stand",
    title: "Подставка для телефона",
    describe: "подставка или держатель для телефона, планшета или книги на столе, под углом",
    build: (p) => {
      const angle = n(p.angle, 65, 30, 85);
      const width = n(p.width ?? p.dims[0], 75, 40, 250);
      const code = `// Подставка для телефона: наклон ${f(angle)}°, ширина ${f(width)} мм
const ANGLE = ${f(angle)}, W = ${f(width)}, DEPTH = 80, T = 6, BACK = 70, LIP = 14;

function main(r) {
  const base = r.drawRoundedRectangle(W, DEPTH, 6).sketchOnPlane().extrude(T);
  const back = r.makeBaseBox(W, T, BACK).rotate(-(90 - ANGLE), [0, 0, 0], [1, 0, 0]).translate(0, DEPTH / 2 - 22, T - 1);
  const lip = r.makeBaseBox(W, T, LIP).translate(0, -DEPTH / 2 + T / 2 + 6, T - 1);
  // вырез под кабель зарядки в бортике
  return base.fuse(back).fuse(lip).cut(r.makeBaseBox(14, 20, LIP + 2).translate(0, -DEPTH / 2 + T / 2 + 6, T));
}
`;
      return { code, expect: [], explain: `Подставка с наклонной спинкой ${f(angle)}°, бортиком и вырезом под кабель. Угол и ширина — в первых строках.`, params: ["ANGLE", "W", "DEPTH", "BACK", "LIP"] };
    },
  },
  {
    id: "other",
    title: "Другое",
    describe:
      "любая другая деталь, которая НЕ коробка, НЕ пластина, НЕ цилиндр, НЕ уголок, НЕ шестерня и НЕ подставка: ваза, фигурка, брелок, крючок, ручка, органайзер с ячейками, корпус дрона, пропеллер, держатель наушников, кольцо с узором, домик, ракета",
  },
];

// ---------- features ----------

export const DIM = 1 << 13;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % DIM;
}

/** Hashed character 3–5-grams inside words plus whole words, L2-normalised. Digits are replaced: sizes do not decide the kind. */
export function featurize(text: string): Map<number, number> {
  const t = ` ${text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\d+([.,]\d+)?/g, "0")
    .replace(/[^a-zа-яәіңғүұқөһ0 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
  const m = new Map<number, number>();
  const add = (k: string) => {
    const i = hash(k);
    m.set(i, (m.get(i) ?? 0) + 1);
  };
  for (const w of t.trim().split(" ")) if (w) add(`w:${w}`);
  for (let len = 3; len <= 5; len++) for (let i = 0; i + len <= t.length; i++) add(t.slice(i, i + len));
  const norm = Math.sqrt([...m.values()].reduce((a, v) => a + v * v, 0)) || 1;
  for (const [k, v] of m) m.set(k, v / norm);
  return m;
}

export interface IntentModel {
  labels: string[];
  /** weights[class][feature] as a flat array, rounded */
  w: number[];
  b: number[];
  meta: { trainedAt: string; examples: number; accuracy: number };
}

export function predict(model: IntentModel, text: string): { label: string; p: number; all: Record<string, number> } {
  const x = featurize(text);
  const K = model.labels.length;
  const z = model.labels.map((_, k) => {
    let s = model.b[k];
    for (const [i, v] of x) s += model.w[k * DIM + i] * v;
    return s;
  });
  const mx = Math.max(...z);
  const e = z.map((v) => Math.exp(v - mx));
  const sum = e.reduce((a, b) => a + b, 0);
  const p = e.map((v) => v / sum);
  let best = 0;
  for (let k = 1; k < K; k++) if (p[k] > p[best]) best = k;
  return { label: model.labels[best], p: p[best], all: Object.fromEntries(model.labels.map((l, k) => [l, Number(p[k].toFixed(3))])) };
}

// ---------- sizes from the text ----------

const WORDNUM: Record<string, number> = {
  один: 1,
  одно: 1,
  одна: 1,
  два: 2,
  две: 2,
  двумя: 2,
  три: 3,
  тремя: 3,
  четыре: 4,
  четырьмя: 4,
  пять: 5,
  шесть: 6,
  восемь: 8,
  екі: 2,
  үш: 3,
  төрт: 4,
  two: 2,
  three: 3,
  four: 4,
  six: 6,
};

/** Rule-based slot filling: numbers with the word next to them decide what each number means. */
export function extractParams(text: string): Params {
  const t = text.toLowerCase().replace(/ё/g, "е").replace(/,(\d)/g, ".$1");
  const p: Params = { dims: [] };
  const num = "(\\d+(?:\\.\\d+)?)";
  const dimMatch = new RegExp(`${num}\\s*(?:x|х|×|\\*|на)\\s*${num}(?:\\s*(?:x|х|×|\\*|на)\\s*${num})?`).exec(t);
  if (dimMatch) p.dims = dimMatch.slice(1).filter(Boolean).map(Number);
  const near = (words: string, after = true) => {
    const re = after ? new RegExp(`(?:${words})[^\\d]{0,14}${num}`) : new RegExp(`${num}\\s*(?:мм|mm|см|cm)?\\s*(?:${words})`);
    const m = re.exec(t);
    return m ? Number(m[1]) : undefined;
  };
  const cm = /\d\s*(см|cm)\b/.test(t) && !/мм|mm/.test(t) ? 10 : 1;
  const scale = (v?: number) => (v === undefined ? undefined : v * cm);
  p.dims = p.dims.map((v) => v * cm);
  p.diameter = scale(near("диаметр|диаметром|ø|⌀|d\\s*=|diameter|диаметрі") ?? (near("радиус|radius") !== undefined ? near("радиус|radius")! * 2 : undefined));
  p.inner = scale(near("внутренн[а-я]* диаметр|внутр[а-я]* отверсти[а-я]*|inner"));
  p.thickness = scale(near("толщин[а-я]*|толщ\\.?|thick[a-z]*|қалыңдығ[а-я]*|стенк[а-я]*") ?? near("толщин|thick", false));
  p.height = scale(near("высот[а-я]*|height|биіктіг[а-я]*|высокий|высокая"));
  p.width = scale(near("ширин[а-я]*|width|ені"));
  p.length = scale(near("длин[а-я]*|length|ұзындығ[а-я]*"));
  const teeth = /(\d+)\s*(?:зуб|teeth|тіс)/.exec(t) ?? /(?:зуб[а-я]*|teeth|тіс[а-я]*)[^\d]{0,10}(\d+)/.exec(t);
  if (teeth) p.teeth = Number(teeth[1]);
  const holesN = /(\d+)\s*(?:отверсти|дыр|holes?|тесік)/.exec(t);
  const holesW = new RegExp(`(${Object.keys(WORDNUM).join("|")})\\s*(?:отверсти|дыр|holes?|тесік)`).exec(t);
  if (holesN) p.holes = Number(holesN[1]);
  else if (holesW) p.holes = WORDNUM[holesW[1]];
  else if (/отверсти|hole|тесік/.test(t)) p.holes = /отверстия|отверстиями|holes/.test(t) ? 2 : 1;
  const metric = /\b[mм]\s?(\d(?:\.\d)?)\b/.exec(t);
  if (metric) p.holeD = Number(metric[1]) + (Number(metric[1]) >= 4 ? 0.4 : 0.2);
  const holeD = /отверсти[а-я]*[^\d]{0,12}(?:ø|⌀|диаметр[а-я]*)?\s*(\d+(?:\.\d+)?)\s*мм/.exec(t);
  if (holeD && !p.holeD) p.holeD = Number(holeD[1]) * cm;
  const angle = /(\d+)\s*(?:°|градус|deg|градус[а-я]*)/.exec(t);
  if (angle) p.angle = Number(angle[1]);
  return p;
}
