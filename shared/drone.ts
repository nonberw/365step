// Drone lab: the parts a student assembles a quadcopter from, and the physics that turns the build into numbers.
// Everything here is a textbook model with stated assumptions, so a student can redo the numbers by hand:
//   propeller   T = Ct·ρ·n²·D⁴,  P = Cp·ρ·n³·D⁵  (n — revolutions per second, D — diameter in m)
//   motor       rpm ≈ KV·V·0.8 under load; electrical power = shaft power / 0.8
//   battery     usable capacity 80 %, 3.7 V per LiPo cell
//   arm         cantilever with the motor's full thrust at the tip (beam formulas from athena-ide physics.ts)
// Units: g, mm, V, A, N unless a name says otherwise.

export const G = 9.81;
export const RHO = 1.225; // air density at sea level, kg/m³

export interface Frame {
  id: string;
  name: string;
  /** motor-to-motor diagonal, mm */
  size: number;
  mass: number;
  /** biggest propeller that fits, inches */
  maxProp: number;
  arm: { material: keyof typeof MATERIALS; width: number; thick: number };
  blurb: string;
}
export interface Motor {
  id: string;
  name: string;
  kv: number;
  mass: number;
  /** continuous current limit, A */
  maxA: number;
  blurb: string;
}
export interface Prop {
  id: string;
  name: string;
  /** inches */
  d: number;
  pitch: number;
  mass: number;
}
export interface Battery {
  id: string;
  name: string;
  cells: number;
  mah: number;
  /** discharge rating */
  c: number;
  mass: number;
}
export interface Esc {
  id: string;
  name: string;
  maxA: number;
  /** all four ESCs together */
  mass: number;
}
export interface Payload {
  id: string;
  name: string;
  mass: number;
  /** extra current, A */
  amps: number;
  blurb: string;
}

/** Elastic modulus E (MPa), density (g/mm³), strength (MPa). Typical datasheet values. */
export const MATERIALS = {
  carbon: { name: "Углепластик", E: 70_000, density: 1.55e-3, strength: 600 },
  alu: { name: "Алюминий 6061", E: 69_000, density: 2.7e-3, strength: 240 },
  PLA: { name: "PLA (3D-печать)", E: 3_500, density: 1.24e-3, strength: 50 / 4 }, // FDM knock-down 0.5 and safety factor 2, as in athena-ide
  PETG: { name: "PETG (3D-печать)", E: 2_000, density: 1.27e-3, strength: 45 / 4 },
};

export const FRAMES: Frame[] = [
  { id: "f3", name: "Микро 3″ (150 мм)", size: 150, mass: 45, maxProp: 3, arm: { material: "carbon", width: 8, thick: 3 }, blurb: "Лёгкий учебный дрон для зала" },
  { id: "f5", name: "Фристайл 5″ (220 мм)", size: 220, mass: 110, maxProp: 5.1, arm: { material: "carbon", width: 12, thick: 5 }, blurb: "Классика FPV: быстрый и прочный" },
  { id: "f5p", name: "Печатная рама 5″ (230 мм)", size: 230, mass: 140, maxProp: 5.1, arm: { material: "PETG", width: 16, thick: 8 }, blurb: "Распечатай сам — но проверь прочность лучей" },
  { id: "f7", name: "Дальнобойная 7″ (300 мм)", size: 300, mass: 190, maxProp: 7.5, arm: { material: "carbon", width: 14, thick: 5 }, blurb: "Для долгих полётов и съёмки" },
  { id: "f10", name: "Грузовая 10″ (450 мм)", size: 450, mass: 420, maxProp: 10.5, arm: { material: "alu", width: 16, thick: 16 }, blurb: "Доставка и тяжёлая полезная нагрузка" },
];

export const MOTORS: Motor[] = [
  { id: "m1404", name: "1404 · 4600KV", kv: 4600, mass: 9, maxA: 12, blurb: "Для 3″ на 3S" },
  { id: "m2207", name: "2207 · 1950KV", kv: 1950, mass: 32, maxA: 38, blurb: "Фристайл 5″ на 6S" },
  { id: "m2306", name: "2306 · 2450KV", kv: 2450, mass: 31, maxA: 35, blurb: "Фристайл 5″ на 4S" },
  { id: "m2806", name: "2806.5 · 1300KV", kv: 1300, mass: 47, maxA: 30, blurb: "7″ на 6S, экономный" },
  { id: "m3508", name: "3508 · 700KV", kv: 700, mass: 80, maxA: 25, blurb: "Тяжёлые 10″ пропеллеры" },
];

export const PROPS: Prop[] = [
  { id: "p3", name: "3×3″", d: 3, pitch: 3, mass: 2 },
  { id: "p5", name: "5×4.3″", d: 5, pitch: 4.3, mass: 4.5 },
  { id: "p51", name: "5.1×5″ (агрессивный)", d: 5.1, pitch: 5, mass: 5 },
  { id: "p7", name: "7×3.5″", d: 7, pitch: 3.5, mass: 8 },
  { id: "p10", name: "10×4.5″", d: 10, pitch: 4.5, mass: 14 },
];

export const BATTERIES: Battery[] = [
  { id: "b3s450", name: "3S 450 мА·ч", cells: 3, mah: 450, c: 80, mass: 40 },
  { id: "b4s1300", name: "4S 1300 мА·ч", cells: 4, mah: 1300, c: 100, mass: 160 },
  { id: "b6s1100", name: "6S 1100 мА·ч", cells: 6, mah: 1100, c: 120, mass: 190 },
  { id: "b6s3000", name: "6S 3000 мА·ч Li-Ion", cells: 6, mah: 3000, c: 5, mass: 300 },
  { id: "b6s5000", name: "6S 5000 мА·ч", cells: 6, mah: 5000, c: 30, mass: 650 },
];

export const ESCS: Esc[] = [
  { id: "e12", name: "4в1 · 12 А", maxA: 12, mass: 6 },
  { id: "e35", name: "4в1 · 35 А", maxA: 35, mass: 14 },
  { id: "e45", name: "4в1 · 45 А", maxA: 45, mass: 18 },
  { id: "e60", name: "4 × 60 А", maxA: 60, mass: 70 },
];

export const PAYLOADS: Payload[] = [
  { id: "none", name: "Без нагрузки", mass: 0, amps: 0, blurb: "" },
  { id: "fpv", name: "FPV-камера и передатчик", mass: 25, amps: 0.6, blurb: "Видео в очки пилота" },
  { id: "gopro", name: "Экшн-камера", mass: 130, amps: 0, blurb: "Съёмка в 4K" },
  { id: "box", name: "Посылка 500 г", mass: 500, amps: 0, blurb: "Доставка" },
  { id: "sensor", name: "Датчики воздуха + GPS", mass: 60, amps: 0.4, blurb: "Экомониторинг" },
];

/** Flight controller, receiver, wiring and screws. */
export const ELECTRONICS = { mass: 25, amps: 0.5 };

export interface Build {
  frame: string;
  motor: string;
  prop: string;
  battery: string;
  esc: string;
  payload: string;
}

export const DEFAULT_BUILD: Build = { frame: "f5", motor: "m2306", prop: "p5", battery: "b4s1300", esc: "e35", payload: "fpv" };

const find = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id) ?? list[0];

export function parts(b: Build) {
  return { frame: find(FRAMES, b.frame), motor: find(MOTORS, b.motor), prop: find(PROPS, b.prop), battery: find(BATTERIES, b.battery), esc: find(ESCS, b.esc), payload: find(PAYLOADS, b.payload) };
}

const INCH = 0.0254;
/** Thrust and power coefficients of a typical two-blade propeller; pitchier props pull and consume more. */
const coeffs = (p: Prop) => ({ ct: 0.11 + 0.05 * (p.pitch / p.d), cp: 0.04 + 0.05 * (p.pitch / p.d) });

/** One motor+propeller at revolutions per second n: thrust N, shaft power W. */
export function rotor(p: Prop, n: number) {
  const D = p.d * INCH;
  const { ct, cp } = coeffs(p);
  return { thrust: ct * RHO * n * n * D ** 4, power: cp * RHO * n ** 3 * D ** 5 };
}

/** Revolutions per second a propeller needs to make thrust T newtons. */
export function rpsFor(p: Prop, T: number) {
  const D = p.d * INCH;
  return Math.sqrt(T / (coeffs(p).ct * RHO * D ** 4));
}

export interface Issue {
  level: "error" | "warn" | "ok";
  text: string;
}

export interface DroneStats {
  massG: number;
  voltage: number;
  maxThrustG: number;
  /** thrust-to-weight ratio */
  twr: number;
  hoverThrottle: number;
  hoverA: number;
  maxA: number;
  flightMin: number;
  /** maximum climb acceleration, m/s² */
  climbAcc: number;
  arm: { lengthMm: number; stressMPa: number; allowMPa: number; tipMm: number; material: string };
  /** physical model for the simulator */
  sim: { mass: number; maxThrust: number; armM: number; inertia: [number, number, number]; drag: number; capacityAh: number; voltage: number; hoverA: number };
  issues: Issue[];
}

export function stats(b: Build): DroneStats {
  const p = parts(b);
  const massG = p.frame.mass + 4 * p.motor.mass + 4 * p.prop.mass + p.battery.mass + p.esc.mass + p.payload.mass + ELECTRONICS.mass;
  const voltage = p.battery.cells * 3.7;
  const nMax = (p.motor.kv * voltage * 0.8) / 60;
  const full = rotor(p.prop, nMax);
  const motorA = full.power / 0.8 / voltage;
  const maxThrustN = full.thrust * 4;
  const weightN = (massG / 1000) * G;

  const hoverN = weightN / 4;
  const nHover = rpsFor(p.prop, hoverN);
  // Motors are least efficient at part throttle, and real hovering is never perfectly still: 60 % overall.
  const hoverPower = rotor(p.prop, nHover).power / 0.6;
  const hoverA = (4 * hoverPower) / voltage + ELECTRONICS.amps + p.payload.amps;
  const maxA = 4 * motorA + ELECTRONICS.amps + p.payload.amps;
  const flightMin = ((p.battery.mah / 1000) * 0.8 * 60) / hoverA;

  // Arm: cantilever from the frame centre to the motor, full thrust of one motor at the tip.
  const mat = MATERIALS[p.frame.arm.material];
  const L = p.frame.size / 2 - 15; // the centre plate takes ~15 mm
  const I = (p.frame.arm.width * p.frame.arm.thick ** 3) / 12;
  const M = full.thrust * L; // N·mm
  const stressMPa = (M * (p.frame.arm.thick / 2)) / I;
  const tipMm = (full.thrust * L ** 3) / (3 * mat.E * I);

  const issues: Issue[] = [];
  const twr = maxThrustN / weightN;
  if (p.prop.d > p.frame.maxProp) issues.push({ level: "error", text: `Пропеллер ${p.prop.d}″ не помещается в раму: максимум ${p.frame.maxProp}″ — лопасти заденут друг друга.` });
  if (twr < 1.3) issues.push({ level: "error", text: `Тяговооружённость ${twr.toFixed(2)}: дрон еле оторвётся от земли. Нужно хотя бы 2.` });
  else if (twr < 2) issues.push({ level: "warn", text: `Тяговооружённость ${twr.toFixed(2)}: полетит, но вяло и плохо справится с ветром. Для съёмки нужно 2–3, для фристайла 5+.` });
  else
    issues.push({ level: "ok", text: `Тяговооружённость ${twr.toFixed(1)}: ${twr > 6 ? "очень резвый, для гонок и фристайла" : twr > 3 ? "уверенный и манёвренный" : "спокойный полёт, хорошо для съёмки и доставки"}.` });
  if (motorA > p.motor.maxA * 1.1) issues.push({ level: "error", text: `На полном газу мотор тянет ${motorA.toFixed(0)} А при допуске ${p.motor.maxA} А — перегреется. Уменьши пропеллер или напряжение.` });
  if (motorA > p.esc.maxA) issues.push({ level: "error", text: `Регулятор ${p.esc.maxA} А слабее мотора (${motorA.toFixed(0)} А на полном газу) — сгорит.` });
  if (maxA > p.battery.c * (p.battery.mah / 1000))
    issues.push({ level: "warn", text: `Аккумулятор отдаёт до ${((p.battery.c * p.battery.mah) / 1000).toFixed(0)} А, а дрону на полном газу нужно ${maxA.toFixed(0)} А — напряжение просядет.` });
  if (hoverN / full.thrust > 0.75) issues.push({ level: "warn", text: `Для висения нужно ${Math.round((hoverN / full.thrust) * 100)} % тяги — запаса почти нет.` });
  if (stressMPa > mat.strength) issues.push({ level: "error", text: `Луч рамы из материала «${mat.name}» сломается: напряжение ${stressMPa.toFixed(0)} МПа при допустимых ${mat.strength.toFixed(0)}. Сделай луч толще.` });
  else if (stressMPa > mat.strength * 0.6) issues.push({ level: "warn", text: `Луч рамы нагружен на ${Math.round((stressMPa / mat.strength) * 100)} % от допустимого — при жёсткой посадке может треснуть.` });
  if (flightMin < 3) issues.push({ level: "warn", text: `Время висения около ${flightMin.toFixed(1)} мин — очень мало.` });

  const mass = massG / 1000;
  const armM = p.frame.size / 2000; // motor distance from the centre, m
  // Inertia: four motors as point masses on the arms plus a central box.
  const rm = (p.frame.size / 2000) * Math.SQRT1_2;
  const ixx = 4 * ((p.motor.mass + p.prop.mass) / 1000) * rm * rm + (mass * 0.6 * (0.05 ** 2 + 0.03 ** 2)) / 12;
  return {
    massG,
    voltage,
    maxThrustG: (maxThrustN / G) * 1000,
    twr,
    hoverThrottle: Math.min(1, nHover / nMax),
    hoverA,
    maxA,
    flightMin,
    climbAcc: (maxThrustN - weightN) / mass,
    arm: { lengthMm: L, stressMPa, allowMPa: mat.strength, tipMm, material: mat.name },
    sim: { mass, maxThrust: maxThrustN, armM, inertia: [ixx, ixx, 2 * ixx], drag: 0.08 + p.frame.size / 4000, capacityAh: (p.battery.mah / 1000) * 0.8, voltage, hoverA },
    issues,
  };
}
