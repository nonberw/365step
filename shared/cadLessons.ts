// CAD lessons: parametric modelling in code with replicad (OpenCascade, the same kernel as FreeCAD).
// Each lesson is checked by the geometry the student's code builds: bounding box, volume, face count.

export interface CadCheck {
  /** size along X, Y, Z in mm (±0.5) */
  bbox?: [number, number, number];
  /** volume, mm³ */
  volume?: [number, number];
  minFaces?: number;
}

export interface CadLesson {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  topic: string;
  theory: string;
  task: string;
  starter: string;
  check: CadCheck;
  xp: number;
  /** functions worth knowing for this lesson */
  api: string[];
}

const HEAD = `// main получает библиотеку replicad (r) и возвращает деталь.
// Единицы — миллиметры, ось Z смотрит вверх.\n`;

export const CAD_LESSONS: CadLesson[] = [
  {
    id: "box",
    title: "Первая деталь: брусок",
    level: 1,
    topic: "Эскиз и выдавливание",
    theory:
      "Почти любая деталь в CAD начинается с эскиза — плоского контура — который выдавливают (extrude) в объём. В replicad: drawRectangle(ширина, глубина) рисует прямоугольник, sketchOnPlane() кладёт его на плоскость XY, extrude(высота) делает тело.",
    task: "Сделай брусок 40 × 20 × 10 мм.",
    starter: `${HEAD}
function main(r) {
  return r.drawRectangle(30, 20).sketchOnPlane().extrude(10);
}
`,
    check: { bbox: [40, 20, 10] },
    xp: 30,
    api: ["drawRectangle(w, h)", "sketchOnPlane()", "extrude(h)"],
  },
  {
    id: "hole",
    title: "Пластина с отверстием",
    level: 1,
    topic: "Булевы операции: вычитание",
    theory:
      "Отверстие — это цилиндр, который вычитают из детали: shape.cut(tool). makeCylinder(радиус, высота, [x, y, z]) создаёт цилиндр с основанием в точке. Чтобы отверстие было сквозным, сделай цилиндр чуть выше пластины и начни чуть ниже нуля.",
    task: "Пластина 60 × 40 × 5 мм с отверстием диаметром 10 мм ровно по центру.",
    starter: `${HEAD}
function main(r) {
  const plate = r.drawRectangle(60, 40).sketchOnPlane().extrude(5);
  const hole = r.makeCylinder(5, 7, [0, 0, -1]);
  // вычти отверстие из пластины
  return plate;
}
`,
    check: { bbox: [60, 40, 5], volume: [11560, 11660] },
    xp: 40,
    api: ["makeCylinder(r, h, [x, y, z])", "shape.cut(tool)"],
  },
  {
    id: "fillet",
    title: "Скругления и фаски",
    level: 1,
    topic: "Обработка рёбер",
    theory:
      'Острые рёбра режут руки и концентрируют напряжения — поэтому их скругляют (fillet) или срезают фаской (chamfer). shape.fillet(радиус) скругляет все рёбра, а shape.fillet(радиус, (e) => e.inDirection("Z")) — только вертикальные.',
    task: "Кубик 30 мм со скруглёнными рёбрами радиусом 3 мм.",
    starter: `${HEAD}
function main(r) {
  const cube = r.makeBaseBox(30, 30, 30);
  return cube;
}
`,
    check: { bbox: [30, 30, 30], volume: [26000, 26960], minFaces: 20 },
    xp: 40,
    api: ["makeBaseBox(x, y, z)", "shape.fillet(r)", "shape.chamfer(d)"],
  },
  {
    id: "cup",
    title: "Стакан",
    level: 1,
    topic: "Полые тела",
    theory:
      "Полую деталь можно получить вычитанием внутреннего тела из внешнего. Ещё есть shell — «оболочка» заданной толщины. Здесь сделаем через вычитание: внешний цилиндр минус внутренний, который начинается на высоте дна.",
    task: "Стакан: внешний радиус 25 мм, высота 40 мм, стенка 3 мм, дно 3 мм, сверху открыт.",
    starter: `${HEAD}
function main(r) {
  const outer = r.makeCylinder(25, 40);
  // внутренний цилиндр: радиус 22, начинается на высоте 3 мм
  return outer;
}
`,
    check: { bbox: [50, 50, 40], volume: [22150, 22420] },
    xp: 50,
    api: ["makeCylinder(r, h, [x, y, z])", "shape.cut(tool)"],
  },
  {
    id: "pattern",
    title: "Массив отверстий",
    level: 2,
    topic: "Параметры и циклы",
    theory: "Главная сила CAD в коде — параметры. Количество отверстий, шаг и диаметр — это переменные: поменял число, и деталь перестроилась. Повторяющиеся элементы делают циклом.",
    task: "Планка 100 × 20 × 3 мм с пятью отверстиями диаметром 5 мм: шаг 20 мм, по центру планки.",
    starter: `${HEAD}
const N = 5, STEP = 20, D = 5;

function main(r) {
  let bar = r.drawRectangle(100, 20).sketchOnPlane().extrude(3);
  for (let i = 0; i < N; i++) {
    const x = (i - (N - 1) / 2) * STEP;
    // вырежи отверстие в точке (x, 0)
  }
  return bar;
}
`,
    check: { bbox: [100, 20, 3], volume: [5690, 5720] },
    xp: 60,
    api: ["for (let i = 0; i < N; i++)", "shape.cut(tool)"],
  },
  {
    id: "motor-mount",
    title: "Крепление мотора дрона",
    level: 2,
    topic: "Инженерная деталь",
    theory: "Моторы дронов крепятся четырьмя винтами M3 по квадрату 16 × 16 мм (стандарт для моторов 22xx–23xx), а в центре — отверстие под вал. Диаметр отверстия под M3 — 3.2 мм (зазор, чтобы винт прошёл свободно).",
    task: "Площадка 30 × 30 × 4 мм со скруглёнными вертикальными рёбрами (r = 4), 4 отверстия Ø3.2 мм по углам квадрата 16 × 16 и центральное отверстие Ø8 мм.",
    starter: `${HEAD}
function main(r) {
  let mount = r.makeBaseBox(30, 30, 4).fillet(4, (e) => e.inDirection("Z"));
  const holes = [[8, 8], [-8, 8], [-8, -8], [8, -8]];
  // вырежи 4 отверстия Ø3.2 и центральное Ø8
  return mount;
}
`,
    check: { bbox: [30, 30, 4], volume: [3180, 3290] },
    xp: 70,
    api: ['fillet(r, (e) => e.inDirection("Z"))', "makeCylinder", "cut"],
  },
  {
    id: "dice",
    title: "Игральный кубик",
    level: 2,
    topic: "Пересечение тел",
    theory: "Кроме вычитания (cut) и объединения (fuse) есть пересечение (intersect): остаётся только общая часть двух тел. Пересечение куба и шара даёт кубик с плавно срезанными углами.",
    task: "Пересеки куб 20 мм (по центру начала координат) и шар радиусом 14 мм.",
    starter: `${HEAD}
function main(r) {
  const cube = r.makeBaseBox(20, 20, 20).translate(0, 0, -10);
  const ball = r.makeSphere(14);
  return cube;
}
`,
    check: { bbox: [20, 20, 20], volume: [7300, 7900] },
    xp: 60,
    api: ["makeSphere(r)", "translate(x, y, z)", "shape.intersect(tool)"],
  },
  {
    id: "vase",
    title: "Ваза вращением",
    level: 2,
    topic: "Тела вращения",
    theory:
      'Тела вращения (вазы, валы, колёса) рисуют профилем — половиной сечения — и вращают вокруг оси: draw() строит контур по точкам, close() замыкает его, sketchOnPlane("XZ") кладёт на вертикальную плоскость, revolve() вращает вокруг Z.',
    task: "Ваза высотой 80 мм: профиль сужается к горлышку и расширяется к верху (форма на твой вкус). Радиус не больше 30 мм.",
    starter: `${HEAD}
function main(r) {
  const profile = r.draw([0, 0])
    .hLine(25)
    .smoothSplineTo([12, 50])
    .smoothSplineTo([20, 80])
    .hLine(-20)
    .close();
  return profile.sketchOnPlane("XZ").revolve();
}
`,
    check: { volume: [20000, 160000] },
    xp: 60,
    api: ["draw([x, y])", "hLine(dx)", "lineTo([x, y])", "smoothSplineTo([x, y])", "close()", "revolve()"],
  },
  {
    id: "drone-arm",
    title: "Луч рамы дрона",
    level: 3,
    topic: "Проектирование под нагрузку",
    theory:
      "Луч рамы — это консоль: мотор тянет его вверх, а у основания возникает изгибающий момент M = F·L. Напряжение σ = M·c / I, где I = b·h³/12. Толщина h входит в куб — поэтому удвоение толщины делает луч в 4 раза прочнее по напряжению и в 8 раз жёстче. В лаборатории дронов эта формула проверяет твою сборку.",
    task: "Луч длиной 110 мм, шириной 12 мм и толщиной 5 мм; на внешнем конце — два отверстия Ø3.2 под мотор с шагом 16 мм вдоль луча (центр между ними в 12 мм от края), на внутреннем — два отверстия Ø3.2 с шагом 20 мм для крепления к раме (первое в 10 мм от края).",
    starter: `${HEAD}
const L = 110, W = 12, T = 5;

function main(r) {
  let arm = r.drawRoundedRectangle(L, W, 3).sketchOnPlane().extrude(T);
  // концы луча — x = −55 и x = 55
  return arm;
}
`,
    check: { bbox: [110, 12, 5], volume: [6370, 6430] },
    xp: 80,
    api: ["drawRoundedRectangle(w, h, r)", "makeCylinder", "cut"],
  },
  {
    id: "bracket",
    title: "L-кронштейн с ребром жёсткости",
    level: 3,
    topic: "Жёсткость конструкции",
    theory:
      'Уголок под нагрузкой изгибается в месте соединения полки и стенки. Треугольное ребро жёсткости (косынка) превращает изгиб в растяжение и сжатие — кронштейн становится в разы жёстче почти без лишней массы. Так делают полки, крепления двигателей и рамы. Ребро удобно нарисовать треугольником на вертикальной плоскости: sketchOnPlane("XZ", y) — плоскость XZ, сдвинутая на y.',
    task: "Полка 40 × 30 × 4 мм (от стенки в сторону +X), вертикальная стенка 4 × 30 × 40 мм на краю x = 0…4, треугольное ребро толщиной 4 мм посередине (катеты 26 мм от внутреннего угла), по два отверстия Ø4.4 мм под винт M4 в полке (x = 30) и в стенке (z = 28), с шагом 18 мм по Y.",
    starter: `${HEAD}
const T = 4;

function main(r) {
  const shelf = r.makeBaseBox(40, 30, T).translate(20, 0, 0);   // полка
  const wall = r.makeBaseBox(T, 30, 40).translate(T / 2, 0, 0);  // стенка
  let b = shelf.fuse(wall);
  // TODO: ребро жёсткости — треугольник [T,0] → [30,0] → [T,26] на плоскости XZ, толщиной T по центру
  // TODO: отверстия Ø4.4 в полке (вертикально) и в стенке (вдоль X)
  return b;
}
`,
    check: { bbox: [40, 30, 40], volume: [10050, 10400] },
    xp: 100,
    api: ['sketchOnPlane("XZ", y)', "extrude(-T)", "makeCylinder(r, h, [x, y, z], [1, 0, 0])"],
  },
  {
    id: "gear",
    title: "Шестерня",
    level: 3,
    topic: "Параметрический профиль",
    theory:
      "Профиль шестерни строят по точкам: для каждого зуба — две точки на окружности впадин и две на вершине, повёрнутые на угол 360°/N. Цикл плюс тригонометрия (x = r·cos a, y = r·sin a) — и меняя одно число N, получаешь любую шестерню. Настоящий эвольвентный профиль сложнее, но принцип тот же.",
    task: "Шестерня на 12 зубьев: наружный радиус 20 мм, радиус впадин 16 мм, толщина 6 мм, отверстие под вал Ø5 мм. Зуб — трапеция: у основания шире, чем на вершине.",
    starter: `${HEAD}
const N = 12, R_OUT = 20, R_ROOT = 16, W = 6;

function main(r) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI;
    // TODO: добавь 4 точки зуба: [R_ROOT, a - …], [R_OUT, a - …], [R_OUT, a + …], [R_ROOT, a + …]
    pts.push([R_ROOT * Math.cos(a), R_ROOT * Math.sin(a)]);
  }
  let d = r.draw(pts[0]);
  for (const p of pts.slice(1)) d = d.lineTo(p);
  return d.close().sketchOnPlane().extrude(W);
}
`,
    check: { bbox: [40, 40, 6], volume: [5000, 6500], minFaces: 40 },
    xp: 120,
    api: ["Math.cos / Math.sin", "draw(p).lineTo(p)", "close()", "extrude"],
  },
  {
    id: "enclosure",
    title: "Корпус для электроники",
    level: 3,
    topic: "Корпус под плату",
    theory:
      "Корпус — коробка с тонкими стенками и стойками под саморезы, на которые садится плата. Для печати стенки 2 мм — хороший компромисс прочности и пластика. Отверстие под саморез делают меньше его диаметра (Ø2.5 под саморез 3 мм) — тогда резьба нарезается в пластике.",
    task: "Снаружи 60 × 40 × 25 мм, стенки и дно 2 мм, сверху открыт. В углах — четыре стойки Ø6 мм от дна до высоты 23 мм (центры в точках x = ±24, y = ±14) с отверстием Ø2.5 мм, в короткой стенке со стороны +X — отверстие Ø8 мм под кабель на высоте 12 мм.",
    starter: `${HEAD}
function main(r) {
  const outer = r.makeBaseBox(60, 40, 25);
  // TODO: вычти внутренний объём, оставив стенки и дно 2 мм
  // TODO: четыре стойки с отверстиями и отверстие под кабель
  return outer;
}
`,
    check: { bbox: [60, 40, 25], volume: [15200, 15800] },
    xp: 120,
    api: ["makeBaseBox", "cut", "fuse", "makeCylinder(r, h, [x, y, z], [1, 0, 0])"],
  },
  {
    id: "lid",
    title: "Крышка с посадкой",
    level: 3,
    topic: "Допуски и посадки",
    theory:
      "Две напечатанные детали не войдут друг в друга, если сделать размеры точно: пластик на принтере «плывёт» на 0.1–0.2 мм. Поэтому закладывают зазор: бортик крышки на 0.2 мм с каждой стороны меньше внутреннего размера корпуса. Это и есть допуск — главное слово в инженерии.",
    task: "Крышка к корпусу из прошлого урока (внутри 56 × 36 мм): пластина 60 × 40 × 2 мм, снизу бортик высотой 4 мм с зазором 0.2 мм на сторону и стенкой 1.5 мм. Деталь стоит на z = 0: бортик снизу, пластина сверху.",
    starter: `${HEAD}
const GAP = 0.2, LIP_WALL = 1.5, LIP_H = 4;

function main(r) {
  const top = r.makeBaseBox(60, 40, 2).translate(0, 0, LIP_H);
  // TODO: бортик — рамка снаружи (56 − 2·GAP) × (36 − 2·GAP), стенка LIP_WALL, высота LIP_H, от z = 0
  return top;
}
`,
    check: { bbox: [60, 40, 6], volume: [5800, 5920] },
    xp: 100,
    api: ["makeBaseBox", "cut", "fuse", "translate"],
  },
  {
    id: "free",
    title: "Свободный проект",
    level: 3,
    topic: "Своя деталь",
    theory: "Придумай деталь для своего проекта: держатель, корпус для датчика, шестерню, подставку. Экспортируй STL и распечатай на 3D-принтере.",
    task: "Построй любую деталь объёмом больше 1 см³.",
    starter: `${HEAD}
// Подставка для телефона: основание и наклонная спинка
function main(r) {
  const base = r.drawRoundedRectangle(80, 70, 6).sketchOnPlane().extrude(6);
  const back = r.makeBaseBox(80, 8, 70).rotate(-20, [0, 0, 0], [1, 0, 0]).translate(0, 18, 3);
  const lip = r.makeBaseBox(80, 6, 14).translate(0, -28, 3);
  return base.fuse(back).fuse(lip);
}
`,
    check: { volume: [1000, 1e9] },
    xp: 50,
    api: ["fuse", "rotate(deg, [cx, cy, cz], [ax, ay, az])", "translate"],
  },
];

export const cadLesson = (id: string) => CAD_LESSONS.find((l) => l.id === id) ?? CAD_LESSONS[0];

export interface CadMeasure {
  bbox: [number, number, number];
  volume: number;
  faces: number;
}

export function checkCad(l: CadLesson, m: CadMeasure): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const c = l.check;
  if (c.bbox) {
    const axes = ["X", "Y", "Z"];
    c.bbox.forEach((v, i) => {
      if (Math.abs(m.bbox[i] - v) > 0.5) notes.push(`Размер по ${axes[i]}: ${m.bbox[i].toFixed(1)} мм, нужно ${v} мм`);
    });
  }
  if (c.volume && (m.volume < c.volume[0] || m.volume > c.volume[1])) notes.push(`Объём ${Math.round(m.volume)} мм³ — ожидается от ${c.volume[0]} до ${c.volume[1]}. Проверь отверстия и вырезы.`);
  if (c.minFaces && m.faces < c.minFaces) notes.push(`Граней ${m.faces} — похоже, рёбра ещё не скруглены.`);
  return { ok: notes.length === 0, notes };
}
