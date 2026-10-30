// Drone lab missions: the world each one sets up and how it is judged. Runs inside the simulator worker,
// so judging sees exactly the physics the student flies.

import type { DroneState, Gains, V3 } from "./droneSim";

export type Control = "sticks" | "code" | "auto";

export interface Ring {
  pos: V3;
  /** the ring faces along this world axis */
  axis: "x" | "y";
  r: number;
}

export interface MissionDef {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  control: Control[];
  brief: string;
  /** what the student learns */
  learn: string;
  wind?: V3;
  gust?: number;
  cargo?: number;
  rings?: Ring[];
  pads?: { pos: V3; label: string }[];
  /** for "auto" missions: altitude step the controller is tested on */
  step?: { from: number; to: number; at: number };
  xp: number;
  starterCode?: string;
}

export interface MissionStatus {
  text: string;
  progress: number;
  done: boolean;
  failed: string | null;
  /** 0–100 */
  score: number;
  metrics?: Record<string, string>;
}

const CODE_SQUARE = `// Автопилот вызывается 20 раз в секунду.
// drone: x, y, z (м), vx, vy, vz (м/с), roll, pitch, yaw (рад), t (с), battery (0–1), landed
// mem — объект, который сохраняется между вызовами. log(...) пишет в консоль.
// Верни точку { x, y, z } — дрон полетит к ней сам (позиционный режим),
// или { roll, pitch, yawRate, throttle } для прямого управления.

// TODO: добавь остальные углы квадрата, возврат на старт и посадку (z = 0)
const route = [[0, 0, 2], [3, 3, 2]];

function autopilot(drone, mem) {
  mem.i ??= 0;
  const [x, y, z] = route[mem.i];
  const dist = Math.hypot(drone.x - x, drone.y - y, drone.z - z);
  if (dist < 0.3 && mem.i < route.length - 1) {
    mem.i++;
    log("точка", mem.i);
  }
  return { x, y, z };
}
`;

const CODE_FREE = `// Напиши свой автопилот. Пример: взлететь на 3 м и облететь круг радиусом 4 м.
function autopilot(drone, mem) {
  if (drone.t < 4) return { x: 0, y: 0, z: 3 };
  const a = (drone.t - 4) * 0.5;
  return { x: 4 * Math.cos(a) - 4, y: 4 * Math.sin(a), z: 3 };
}
`;

const CODE_DELIVERY = `// Отвези посылку с площадки A (0, 0) на площадку B (8, 6) и мягко приземлись.
function autopilot(drone, mem) {
  mem.stage ??= "up";
  if (mem.stage === "up") {
    if (drone.z > 2.8) mem.stage = "fly";
    return { x: 0, y: 0, z: 3 };
  }
  if (mem.stage === "fly") {
    // TODO: когда дрон над площадкой B — переключись на посадку
    return { x: 8, y: 6, z: 3 };
  }
  return { x: 8, y: 6, z: 0 };
}
`;

export const MISSIONS: MissionDef[] = [
  {
    id: "takeoff",
    title: "Первый взлёт",
    level: 1,
    control: ["sticks"],
    brief: "Поднимись на высоту 2 м (зелёная зона), продержись там 5 секунд и мягко приземлись.",
    learn: "Тяга против силы тяжести: дрон висит, когда суммарная тяга моторов равна весу.",
    xp: 40,
  },
  {
    id: "rings",
    title: "Кольца",
    level: 1,
    control: ["sticks", "code"],
    brief: "Пролети через 4 кольца по порядку. Следующее кольцо подсвечено.",
    learn: "Наклон = ускорение: чтобы лететь вперёд, дрон наклоняется, и часть тяги толкает его горизонтально.",
    rings: [
      { pos: [0, 6, 2], axis: "y", r: 0.9 },
      { pos: [6, 10, 3], axis: "x", r: 0.9 },
      { pos: [12, 6, 2.5], axis: "y", r: 0.9 },
      { pos: [6, 0, 1.5], axis: "x", r: 0.9 },
    ],
    xp: 60,
  },
  {
    id: "pid",
    title: "PID-лаборатория",
    level: 2,
    control: ["auto"],
    brief: "Автопилот должен поднять дрон с 1 м на 3 м. Подбери коэффициенты высоты так, чтобы перелёт был меньше 10 %, а дрон успокоился за 3 секунды.",
    learn: "P — сила реакции на ошибку, I — убирает постоянную ошибку, D — гасит раскачку. Так настраивают любые регуляторы: от дронов до термостатов.",
    step: { from: 1, to: 3, at: 3 },
    xp: 80,
  },
  {
    id: "delivery",
    title: "Доставка",
    level: 2,
    control: ["sticks", "code"],
    brief: "С посылкой 500 г перелети с площадки A на площадку B и сядь не дальше 0.6 м от центра. Скорость касания — не больше 1.5 м/с.",
    learn: "Груз увеличивает массу: для висения нужно больше тяги, батарея садится быстрее, дрон медленнее разгоняется.",
    cargo: 0.5,
    pads: [
      { pos: [0, 0, 0], label: "A" },
      { pos: [8, 6, 0], label: "B" },
    ],
    xp: 80,
    starterCode: CODE_DELIVERY,
  },
  {
    id: "square",
    title: "Автопилот: квадрат",
    level: 2,
    control: ["code"],
    brief: "Напиши код автопилота: облети углы квадрата (3, 3), (−3, 3), (−3, −3), (3, −3) на высоте 2 м и вернись на старт.",
    learn: "Автономный полёт — это последовательность точек (waypoints) и условие перехода к следующей.",
    pads: [{ pos: [0, 0, 0], label: "Старт" }],
    xp: 100,
    starterCode: CODE_SQUARE,
  },
  {
    id: "storm",
    title: "Шторм",
    level: 3,
    control: ["auto", "code"],
    brief: "Ветер 3 м/с и порывы. Удержи дрон в радиусе 0.6 м от точки (0, 0, 2) 10 секунд подряд. Настрой коэффициенты положения или напиши свой регулятор.",
    learn: "Интегральная составляющая (I) компенсирует постоянную силу — ветер. Без неё дрон будет висеть со смещением.",
    wind: [3, 1, 0],
    gust: 2,
    xp: 120,
  },
  {
    id: "slalom",
    title: "Слалом на время",
    level: 3,
    control: ["sticks", "code"],
    brief: "Пройди 6 ворот змейкой на разной высоте быстрее чем за 13 секунд. Каждая секунда меньше — больше очков.",
    learn: "Чтобы быстро проходить повороты, нужно заранее начинать торможение и наклон: дрон не может мгновенно сменить скорость — у него есть масса и инерция.",
    rings: [
      { pos: [-2, 5, 1.5], axis: "y", r: 1 },
      { pos: [2, 10, 3], axis: "y", r: 1 },
      { pos: [-2, 15, 2], axis: "y", r: 1 },
      { pos: [2, 20, 3.5], axis: "y", r: 1 },
      { pos: [-2, 25, 1.5], axis: "y", r: 1 },
      { pos: [0, 30, 2.5], axis: "y", r: 1 },
    ],
    xp: 140,
    starterCode: `// Пролети ворота по порядку. Совет: целься не в центр ворот, а в точку за ними.
const gates = [[-2, 5, 1.5], [2, 10, 3], [-2, 15, 2], [2, 20, 3.5], [-2, 25, 1.5], [0, 30, 2.5]];

function autopilot(drone, mem) {
  mem.i ??= 0;
  const [x, y, z] = gates[mem.i];
  if (drone.y > y && mem.i < gates.length - 1) mem.i++;
  return { x, y, z };   // TODO: так дрон тормозит перед каждыми воротами и не уложится в 13 с. Целься дальше ворот
  // и компенсируй отставание: регулятор положения всегда немного запаздывает за быстрой целью.
}
`,
  },
  {
    id: "precision",
    title: "Посадка на движущуюся платформу",
    level: 3,
    control: ["code", "sticks"],
    brief: "Платформа ездит вперёд-назад вдоль оси X (как палуба корабля), дует боковой ветер 1.5 м/с. Приземлись на неё: не дальше 30 см от центра и со скоростью касания меньше 1 м/с.",
    learn: "Садиться нужно туда, где платформа БУДЕТ в момент касания. Время снижения известно — значит, известно и упреждение. Так сажают дроны на корабли и движущиеся машины.",
    wind: [0, 1.5, 0],
    pads: [{ pos: [0, 0, 0], label: "Старт" }],
    xp: 160,
    starterCode: `// drone.px, drone.py — центр платформы сейчас; drone.pvx, drone.pvy — её скорость (м/с).
function autopilot(drone, mem) {
  if (drone.t < 3) return { x: 5, y: -3, z: 2 };
  return { x: drone.px, y: drone.py, z: 0 };   // TODO: платформа уедет, пока дрон снижается
}
`,
  },
  {
    id: "follow",
    title: "Сопровождение машины",
    level: 3,
    control: ["code"],
    brief: "Вездеход едет по кругу радиусом 5 м. Держись над ним (не дальше 1 м по горизонтали, на высоте 1.5–3 м) — всего 20 секунд за минуту полёта.",
    learn: "По движущейся цели нельзя лететь в её текущую точку — дрон всегда будет опаздывать. Нужно упреждение: цель + скорость цели × время реакции. Так работают системы сопровождения.",
    xp: 160,
    starterCode: `// drone.tx, drone.ty — где сейчас вездеход; drone.tvx, drone.tvy — его скорость (м/с).
function autopilot(drone, mem) {
  if (drone.t < 3) return { x: 5, y: 0, z: 2 };
  return { x: drone.tx, y: drone.ty, z: 2 };   // TODO: дрон опаздывает — добавь упреждение
}
`,
  },
  {
    id: "free",
    title: "Свободный полёт",
    level: 1,
    control: ["sticks", "code"],
    brief: "Песочница: летай как хочешь, пробуй ветер, свой код и разные сборки.",
    learn: "",
    rings: [
      { pos: [0, 8, 2], axis: "y", r: 1 },
      { pos: [-8, 4, 3], axis: "x", r: 1 },
    ],
    xp: 0,
    starterCode: CODE_FREE,
  },
];

/** The moving deck in the "precision" mission: back and forth along x around (5, −3), up to 0.9 m/s. */
export function platformAt(t: number) {
  const w = 0.35;
  return { x: 5 + 2.5 * Math.sin(w * t), y: -3, vx: 2.5 * w * Math.cos(w * t), vy: 0 };
}

/** The rover in the "follow" mission: a circle of radius 5 m at 1.25 m/s. */
export function targetAt(t: number) {
  const w = 0.25;
  return { x: 5 * Math.cos(w * t), y: 5 * Math.sin(w * t), vx: -5 * w * Math.sin(w * t), vy: 5 * w * Math.cos(w * t) };
}

export const mission = (id: string) => MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
export const DEFAULT_CODE = CODE_FREE;

/** Judges one run of a mission; feed it every physics frame. */
export function judge(m: MissionDef, gains?: Gains) {
  let hold = 0;
  let reached = false;
  let ring = 0;
  let prev: V3 | null = null;
  let corner = 0;
  let peak = -Infinity;
  let settledAt: number | null = null;
  let left = false;
  let lastVz = 0;
  const corners: V3[] = [
    [3, 3, 2],
    [-3, 3, 2],
    [-3, -3, 2],
    [3, -3, 2],
    [0, 0, 2],
  ];
  const status: MissionStatus = { text: m.brief, progress: 0, done: false, failed: null, score: 0 };
  void gains;

  return (s: DroneState, dt: number): MissionStatus => {
    if (status.done || status.failed) return status;
    if (s.crashed) {
      status.failed = s.crashed;
      return status;
    }
    const p = s.pos;
    switch (m.id) {
      case "takeoff": {
        if (!reached) {
          const inZone = Math.abs(p[2] - 2) < 0.4;
          hold = inZone ? hold + dt : 0;
          status.progress = Math.min(0.7, (hold / 5) * 0.7);
          status.text = inZone ? `Держи высоту: ${(5 - hold).toFixed(1)} с` : `Высота ${p[2].toFixed(1)} м — поднимись до 2 м`;
          if (hold >= 5) reached = true;
        } else {
          status.progress = 0.7 + 0.3 * Math.max(0, 1 - p[2] / 2);
          status.text = "Теперь мягко приземлись";
          if (s.landed) {
            status.done = true;
            status.score = 100;
            status.text = "Миссия выполнена!";
          }
        }
        break;
      }
      case "rings":
      case "slalom":
      case "free": {
        const rings = m.rings ?? [];
        if (prev && ring < rings.length) {
          const r = rings[ring];
          const k = r.axis === "x" ? 0 : 1;
          const crossed = (prev[k] - r.pos[k]) * (p[k] - r.pos[k]) <= 0 && prev[k] !== p[k];
          if (crossed) {
            const o = r.axis === "x" ? 1 : 0;
            const d = Math.hypot(p[o] - r.pos[o], p[2] - r.pos[2]);
            if (d < r.r) ring++;
          }
        }
        if (m.id === "free") {
          status.text = rings.length ? `Колец пройдено: ${ring} из ${rings.length}` : "Свободный полёт";
          status.progress = rings.length ? ring / rings.length : 0;
          break;
        }
        status.progress = ring / rings.length;
        status.text = ring < rings.length ? `${m.id === "slalom" ? "Ворота" : "Кольцо"} ${ring + 1} из ${rings.length}` : "Все кольца пройдены!";
        if (m.id === "slalom") status.metrics = { Время: `${s.t.toFixed(1)} с` };
        if (ring === rings.length) {
          status.done = true;
          status.score = m.id === "slalom" ? Math.max(30, Math.min(100, Math.round(100 - (s.t - 9) * 8))) : Math.max(40, Math.round(100 - Math.max(0, s.t - 25) * 2));
          status.metrics = { Время: `${s.t.toFixed(1)} с` };
        } else if (m.id === "slalom" && s.t > 13) status.failed = `Не уложился в 13 секунд: пройдено ворот ${ring} из ${rings.length}.`;
        break;
      }
      case "pid": {
        const st = m.step!;
        if (s.t < st.at) {
          status.text = "Дрон висит на 1 м. Скоро команда «на 3 м»…";
          break;
        }
        peak = Math.max(peak, p[2]);
        const err = Math.abs(p[2] - st.to);
        if (err < 0.1) settledAt ??= s.t;
        else settledAt = null;
        const elapsed = s.t - st.at;
        status.progress = Math.min(1, elapsed / 8);
        const over = Math.max(0, ((peak - st.to) / (st.to - st.from)) * 100);
        status.metrics = { Перелёт: `${over.toFixed(1)} %`, Успокоился: settledAt !== null ? `за ${(settledAt - st.at).toFixed(1)} с` : "ещё нет" };
        status.text = "Смотри на график: синяя линия — цель, красная — высота";
        if (elapsed >= 8) {
          const settle = settledAt !== null ? settledAt - st.at : 99;
          const ok = over < 10 && settle < 3;
          status.score = Math.round(Math.max(0, 100 - Math.max(0, over - 5) * 4 - Math.max(0, settle - 1.5) * 15));
          if (ok) {
            status.done = true;
            status.text = `Отлично! Перелёт ${over.toFixed(1)} %, успокоился за ${settle.toFixed(1)} с`;
          } else status.failed = `Перелёт ${over.toFixed(1)} % (нужно < 10 %), успокоение ${settle > 50 ? "не наступило" : `${settle.toFixed(1)} с`} (нужно < 3 с). Поменяй коэффициенты и запусти снова.`;
        }
        break;
      }
      case "delivery": {
        const b = m.pads![1].pos;
        const d = Math.hypot(p[0] - b[0], p[1] - b[1]);
        if (p[2] > 0.5) left = true;
        status.progress = left ? Math.min(0.9, 1 - d / 10) : 0;
        status.text = left ? `До площадки B: ${d.toFixed(1)} м` : "Взлетай с площадки A";
        if (left && s.landed) {
          if (d < 0.6) {
            status.done = true;
            status.score = Math.round(100 - d * 50);
            status.text = `Посылка доставлена! Точность ${d.toFixed(2)} м`;
          } else if (Math.hypot(p[0], p[1]) > 1) status.failed = `Посадка в ${d.toFixed(1)} м от площадки B — промах.`;
        }
        if (p[2] > 0.05) lastVz = s.vel[2];
        else if (left && lastVz < -1.5) status.failed = `Слишком жёсткая посадка (${(-lastVz).toFixed(1)} м/с) — посылка разбилась.`;
        break;
      }
      case "square": {
        if (corner < corners.length) {
          const c = corners[corner];
          if (Math.hypot(p[0] - c[0], p[1] - c[1]) < 0.5 && Math.abs(p[2] - c[2]) < 0.5) corner++;
          status.progress = (corner / corners.length) * 0.9;
          status.text = corner < 4 ? `Угол ${corner + 1} из 4: (${c[0]}, ${c[1]})` : "Вернись на старт";
        } else {
          status.progress = 0.95;
          status.text = "Приземлись на старт";
          if (s.landed) {
            const d = Math.hypot(p[0], p[1]);
            if (d < 0.7) {
              status.done = true;
              status.score = Math.round(Math.max(50, 100 - Math.max(0, s.t - 20) * 2));
              status.text = `Квадрат пройден за ${s.t.toFixed(1)} с`;
            } else status.failed = `Посадка в ${d.toFixed(1)} м от старта.`;
          }
        }
        break;
      }
      case "precision": {
        const pl = platformAt(s.t);
        const d = Math.hypot(p[0] - pl.x, p[1] - pl.y);
        if (p[2] > 0.5) left = true;
        if (p[2] > 0.05) lastVz = s.vel[2];
        status.progress = left ? Math.min(0.95, Math.max(0, 1 - d / 6)) : 0;
        status.text = left ? `До центра платформы ${d.toFixed(2)} м, высота ${p[2].toFixed(1)} м` : "Взлетай";
        status.metrics = { "До центра": `${d.toFixed(2)} м` };
        if (left && s.landed) {
          if (lastVz < -1) status.failed = `Касание ${(-lastVz).toFixed(1)} м/с — слишком жёстко (нужно < 1 м/с).`;
          else if (d <= 0.3) {
            status.done = true;
            status.score = Math.round(100 - d * 130);
            status.text = `Посадка в ${Math.round(d * 100)} см от центра движущейся платформы!`;
          } else status.failed = `Дрон сел в ${Math.round(d * 100)} см от центра платформы — мимо.`;
        }
        if (s.t > 60) status.failed = "За минуту не удалось приземлиться.";
        break;
      }
      case "follow": {
        const tg = targetAt(s.t);
        const d = Math.hypot(p[0] - tg.x, p[1] - tg.y);
        const ok = s.t > 3 && d < 1 && p[2] > 1.5 && p[2] < 3;
        if (ok) hold += dt;
        status.progress = Math.min(1, hold / 20);
        status.text = ok ? `Над целью: ${hold.toFixed(1)} из 20 с` : `До вездехода ${d.toFixed(1)} м`;
        status.metrics = { "До цели": `${d.toFixed(2)} м`, Набрано: `${hold.toFixed(1)} с` };
        if (hold >= 20) {
          status.done = true;
          status.score = Math.round(Math.min(100, 60 + (60 - s.t)));
          status.text = "Сопровождение выполнено!";
        }
        if (s.t > 60) status.failed = `За минуту над целью только ${hold.toFixed(1)} с из 20 — дрон не успевает за вездеходом.`;
        break;
      }
      case "storm": {
        const d = Math.hypot(p[0], p[1], p[2] - 2);
        hold = d < 0.6 ? hold + dt : 0;
        status.progress = Math.min(1, hold / 10);
        status.text = d < 0.6 ? `Держись: ${(10 - hold).toFixed(1)} с` : `Отклонение ${d.toFixed(2)} м — вернись в зону`;
        status.metrics = { Отклонение: `${d.toFixed(2)} м` };
        if (hold >= 10) {
          status.done = true;
          status.score = 100;
          status.text = "Шторм не помеха!";
        }
        if (s.t > 90) status.failed = "За 90 секунд не удалось удержаться 10 секунд подряд.";
        break;
      }
    }
    prev = [...p];
    return status;
  };
}
