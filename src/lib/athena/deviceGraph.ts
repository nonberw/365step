import { t, tn } from "./i18n";
import { deckClashes, BATTERY_MM, G as GRAV, adapterHole, trayFor, type Material, type Section, LINK_TUBES, MATERIALS, MOTOR_BOSS_MM, PROFILES, ROVER, allowablePrinted, armShoulderZ, ARM, beamFrequency, cantileverTip, departureDeg, fit, rect, roverClearance, simplySupportedSag, twoLinkIk, FIT_MIN, FIT_MAX } from "./physics";
import type { KitItem, Layout, Preset } from "./circuit";
import type { Assembly } from "./assembly/model";
import { verifyAssembly } from "./assembly/checks";
import { sampleCustom } from "./assembly/sample";
import { applyKindToLayout } from "./circuitEdit";
import { verifyBreadboard, sampleBreadboard, breadboardSteps, breadboardPowerProfile, jumperCount, setPreset } from "./circuit";

// Device Graph: single source of truth. Every view (3D, electronics, BOM,
// instructions, checks) is derived from this model.

export type Template = "stand" | "arm" | "rover" | "breadboard" | "custom";
export type ModuleKind = "profile" | "actuator" | "platform" | "camera" | "light" | "controller" | "psu" | "driver" | "link" | "gripper" | "base" | "wheel" | "battery" | "sensor" | "mcu" | "led" | "resistor" | "button" | "pot" | "buzzer" | "wire" | "module" | "motor" | "display";

export interface CatalogModule {
  id: string;
  name: string;
  kind: ModuleKind;
  massKg: number;
  priceUsd: number;
  inStock: boolean;
  voltage?: number; // supply voltage required (V)
  currentA?: number; // draw (A)
  supplyA?: number; // PSU capacity (A)
  supplyV?: number;
  momentNm?: number; // actuator holding torque
  stiffness?: number; // profile: relative stiffness index
  rpm?: number;
  cols?: number; // breadboard columns
  vf?: number; // LED forward voltage (V)
  maxMa?: number; // LED max continuous current
  ohm?: number; // resistor value
  logicV?: number; // MCU logic level
  pinMa?: number; // MCU recommended per-pin current
  mcuMa?: number; // MCU own consumption
  usbMa?: number; // current available from USB
  stallMa?: number; // motor stall current
  outV?: number; // sensor output level
  diameterMm?: number;
  capacityWh?: number;
  chemistry?: "lipo" | "nimh"; // battery packs: lithium packs are not allowed in school safe mode
  /** 3-pin sensor modules (VCC, OUT, GND): what the output follows */
  measures?: "light" | "temperature" | "moisture" | "motion";
  for?: Template[]; // which templates list this module (default: stand only)
}

export const CATALOG: Record<string, CatalogModule> = {
  // building blocks for designs assembled from parts (src/lib/assembly): a cut plate, a printed bracket, a ball caster
  "plate-alu": { id: "plate-alu", name: "Aluminium plate, cut to size", kind: "base", massKg: 1.3, priceUsd: 15, inStock: true, for: ["custom"] },
  "bracket-l": { id: "bracket-l", name: "Printed L-bracket", kind: "profile", massKg: 0.02, priceUsd: 1.5, inStock: true, for: ["custom"] },
  "caster-ball": { id: "caster-ball", name: "Ball caster", kind: "wheel", massKg: 0.03, priceUsd: 2, inStock: true, for: ["custom"] },
  "profile-20": { id: "profile-20", name: "Aluminium profile 20×20", kind: "profile", massKg: 0.55, priceUsd: 6, inStock: true, stiffness: 1 },
  "profile-30": { id: "profile-30", name: "Aluminium profile 30×30", kind: "profile", massKg: 1.1, priceUsd: 11, inStock: true, stiffness: 2.6 },
  "nema17": { id: "nema17", name: "NEMA17 stepper 0.45 Nm", kind: "actuator", massKg: 0.35, priceUsd: 14, inStock: true, voltage: 24, currentA: 1.5, momentNm: 0.45 },
  "nema23": { id: "nema23", name: "NEMA23 stepper 1.2 Nm", kind: "actuator", massKg: 0.7, priceUsd: 28, inStock: true, voltage: 24, currentA: 2.8, momentNm: 1.2 },
  "turntable": { id: "turntable", name: "Turntable Ø200", kind: "platform", massKg: 0.6, priceUsd: 22, inStock: true },
  "cam-usb": { id: "cam-usb", name: "USB camera 1080p", kind: "camera", massKg: 0.08, priceUsd: 35, inStock: true, voltage: 5, currentA: 0.4 },
  "ring-light": { id: "ring-light", name: "Ring light 24V", kind: "light", massKg: 0.2, priceUsd: 18, inStock: true, voltage: 24, currentA: 0.5 },
  "esp32": { id: "esp32", name: "ESP32 controller", kind: "controller", massKg: 0.02, priceUsd: 8, inStock: true, voltage: 5, currentA: 0.25, for: ["stand", "arm", "rover"] },
  "drv8825": { id: "drv8825", name: "Stepper driver DRV8825", kind: "driver", massKg: 0.01, priceUsd: 4, inStock: true, voltage: 24, currentA: 0.1 },
  "psu-24-3": { id: "psu-24-3", name: "PSU 24V / 3A", kind: "psu", massKg: 0.4, priceUsd: 19, inStock: true, supplyV: 24, supplyA: 3 },
  "psu-24-6": { id: "psu-24-6", name: "PSU 24V / 6A", kind: "psu", massKg: 0.6, priceUsd: 29, inStock: true, supplyV: 24, supplyA: 6 },
  // --- robot arm modules ---
  "servo-std": { id: "servo-std", name: "Bus servo 2 Nm (20 kg·cm)", kind: "actuator", massKg: 0.06, priceUsd: 15, inStock: true, voltage: 12, currentA: 1.0, momentNm: 1.96, for: ["arm"] },
  "servo-hv": { id: "servo-hv", name: "Bus servo 3.4 Nm (35 kg·cm)", kind: "actuator", massKg: 0.08, priceUsd: 32, inStock: true, voltage: 12, currentA: 1.6, momentNm: 3.4, for: ["arm"] },
  "servo-xl": { id: "servo-xl", name: "Bus servo 9.8 Nm (100 kg·cm)", kind: "actuator", massKg: 0.18, priceUsd: 95, inStock: true, voltage: 12, currentA: 3.2, momentNm: 9.8, for: ["arm"] },
  "servo-pro": { id: "servo-pro", name: "Bus servo 5.9 Nm (60 kg·cm)", kind: "actuator", massKg: 0.11, priceUsd: 58, inStock: true, voltage: 12, currentA: 2.4, momentNm: 5.9, for: ["arm"] },
  "link-alu": { id: "link-alu", name: "Aluminium tube link (per 250 mm)", kind: "link", massKg: 0.07, priceUsd: 12, inStock: true, stiffness: 1, for: ["arm"] },
  "link-carbon": { id: "link-carbon", name: "Carbon tube link (per 250 mm)", kind: "link", massKg: 0.04, priceUsd: 26, inStock: true, stiffness: 2.2, for: ["arm"] },
  "gripper-par": { id: "gripper-par", name: "Parallel gripper 40 mm", kind: "gripper", massKg: 0.05, priceUsd: 18, inStock: true, voltage: 12, currentA: 0.4, for: ["arm"] },
  "arm-base": { id: "arm-base", name: "Base plate with bearing", kind: "base", massKg: 0.5, priceUsd: 10, inStock: true, for: ["arm"] },
  "servo-bus": { id: "servo-bus", name: "Servo bus adapter", kind: "driver", massKg: 0.01, priceUsd: 9, inStock: true, voltage: 12, currentA: 0.05, for: ["arm"] },
  "psu-12-5": { id: "psu-12-5", name: "PSU 12V / 5A", kind: "psu", massKg: 0.3, priceUsd: 14, inStock: true, supplyV: 12, supplyA: 5, for: ["arm"] },
  // --- rover modules ---
  "chassis-300": { id: "chassis-300", name: "Chassis plate 300×200", kind: "base", massKg: 0.8, priceUsd: 22, inStock: true, for: ["rover"] },
  "motor-tt": { id: "motor-tt", name: "TT gear motor 0.15 Nm", kind: "actuator", massKg: 0.05, priceUsd: 6, inStock: true, voltage: 12, currentA: 0.4, momentNm: 0.15, rpm: 150, for: ["rover"] },
  "motor-jgb": { id: "motor-jgb", name: "JGB37 gear motor 0.8 Nm", kind: "actuator", massKg: 0.2, priceUsd: 14, inStock: true, voltage: 12, currentA: 1.2, momentNm: 0.8, rpm: 130, for: ["rover"] },
  "motor-planet": { id: "motor-planet", name: "Planetary motor 3 Nm", kind: "actuator", massKg: 0.45, priceUsd: 32, inStock: true, voltage: 12, currentA: 2.5, momentNm: 3, rpm: 80, for: ["rover"] },
  "wheel-65": { id: "wheel-65", name: "Wheel Ø65", kind: "wheel", massKg: 0.06, priceUsd: 4, inStock: true, diameterMm: 65, for: ["rover"] },
  "wheel-100": { id: "wheel-100", name: "Wheel Ø100", kind: "wheel", massKg: 0.1, priceUsd: 7, inStock: true, diameterMm: 100, for: ["rover"] },
  "battery-3s-5": { id: "battery-3s-5", name: "LiPo 3S 5 Ah (55 Wh)", kind: "battery", massKg: 0.35, priceUsd: 38, inStock: true, supplyV: 11.1, supplyA: 10, capacityWh: 55.5, chemistry: "lipo", for: ["rover"] },
  "battery-3s-10": { id: "battery-3s-10", name: "LiPo 3S 10 Ah (111 Wh)", kind: "battery", massKg: 0.7, priceUsd: 62, inStock: true, supplyV: 11.1, supplyA: 15, capacityWh: 111, chemistry: "lipo", for: ["rover"] },
  "battery-nimh-12": { id: "battery-nimh-12", name: "NiMH 12 V 9 Ah (108 Wh)", kind: "battery", massKg: 1.6, priceUsd: 58, inStock: true, supplyV: 12, supplyA: 9, capacityWh: 108, chemistry: "nimh", for: ["rover"] },
  "driver-dc": { id: "driver-dc", name: "Dual DC motor driver 10 A", kind: "driver", massKg: 0.03, priceUsd: 12, inStock: true, voltage: 12, currentA: 0.05, for: ["rover"] },
  "lidar-2d": { id: "lidar-2d", name: "2D LiDAR 360°", kind: "sensor", massKg: 0.17, priceUsd: 60, inStock: true, voltage: 5, currentA: 0.5, for: ["rover"] },
  // --- breadboard / electronics modules ---
  "bb-half": { id: "bb-half", name: "Breadboard 400 points", kind: "base", massKg: 0.04, priceUsd: 5, inStock: true, cols: 30, for: ["breadboard"] },
  "bb-full": { id: "bb-full", name: "Breadboard 830 points", kind: "base", massKg: 0.09, priceUsd: 9, inStock: true, cols: 63, for: ["breadboard"] },
  "uno-r3": { id: "uno-r3", name: "Arduino Uno R3 (5 V)", kind: "mcu", massKg: 0.025, priceUsd: 27, inStock: true, logicV: 5, pinMa: 20, mcuMa: 50, usbMa: 500, for: ["breadboard"] },
  "esp32-devkit": { id: "esp32-devkit", name: "ESP32 DevKit (3.3 V)", kind: "mcu", massKg: 0.01, priceUsd: 9, inStock: true, logicV: 3.3, pinMa: 12, mcuMa: 160, usbMa: 500, for: ["breadboard"] },
  "led-red": { id: "led-red", name: "LED 5 mm red", kind: "led", massKg: 0.001, priceUsd: 0.1, inStock: true, vf: 2.0, maxMa: 20, for: ["breadboard"] },
  "led-green": { id: "led-green", name: "LED 5 mm green", kind: "led", massKg: 0.001, priceUsd: 0.1, inStock: true, vf: 2.2, maxMa: 20, for: ["breadboard"] },
  "led-yellow": { id: "led-yellow", name: "LED 5 mm yellow", kind: "led", massKg: 0.001, priceUsd: 0.1, inStock: true, vf: 2.1, maxMa: 20, for: ["breadboard"] },
  "led-blue": { id: "led-blue", name: "LED 5 mm blue", kind: "led", massKg: 0.001, priceUsd: 0.15, inStock: true, vf: 3.0, maxMa: 20, for: ["breadboard"] },
  "res-100": { id: "res-100", name: "Resistor 100 Ω", kind: "resistor", massKg: 0.0003, priceUsd: 0.02, inStock: true, ohm: 100, for: ["breadboard"] },
  "res-220": { id: "res-220", name: "Resistor 220 Ω", kind: "resistor", massKg: 0.0003, priceUsd: 0.02, inStock: true, ohm: 220, for: ["breadboard"] },
  "res-330": { id: "res-330", name: "Resistor 330 Ω", kind: "resistor", massKg: 0.0003, priceUsd: 0.02, inStock: true, ohm: 330, for: ["breadboard"] },
  "res-470": { id: "res-470", name: "Resistor 470 Ω", kind: "resistor", massKg: 0.0003, priceUsd: 0.02, inStock: true, ohm: 470, for: ["breadboard"] },
  "res-1k": { id: "res-1k", name: "Resistor 1 kΩ", kind: "resistor", massKg: 0.0003, priceUsd: 0.02, inStock: true, ohm: 1000, for: ["breadboard"] },
  "res-10k": { id: "res-10k", name: "Resistor 10 kΩ", kind: "resistor", massKg: 0.0003, priceUsd: 0.02, inStock: true, ohm: 10000, for: ["breadboard"] },
  "btn-6mm": { id: "btn-6mm", name: "Tactile button 6 mm", kind: "button", massKg: 0.001, priceUsd: 0.1, inStock: true, for: ["breadboard"] },
  "pot-10k": { id: "pot-10k", name: "Potentiometer 10 kΩ", kind: "pot", massKg: 0.004, priceUsd: 0.8, inStock: true, for: ["breadboard"] },
  "buzzer-act": { id: "buzzer-act", name: "Active buzzer 5 V", kind: "buzzer", massKg: 0.002, priceUsd: 0.5, inStock: true, voltage: 5, currentA: 0.015, for: ["breadboard"] },
  "hcsr04": { id: "hcsr04", name: "HC-SR04 ultrasonic sensor", kind: "sensor", massKg: 0.009, priceUsd: 2, inStock: true, voltage: 5, currentA: 0.015, outV: 5, for: ["breadboard"] },
  "servo-sg90": { id: "servo-sg90", name: "Micro servo SG90", kind: "actuator", massKg: 0.009, priceUsd: 3, inStock: true, voltage: 5, currentA: 0.25, stallMa: 650, for: ["breadboard"] },
  // 3-pin sensor modules: VCC, OUT, GND in a row
  "light-module": { id: "light-module", name: "Light sensor module (LDR)", kind: "module", massKg: 0.003, priceUsd: 0.6, inStock: true, voltage: 5, currentA: 0.001, measures: "light", for: ["breadboard"] },
  "tmp36": { id: "tmp36", name: "TMP36 temperature sensor", kind: "module", massKg: 0.001, priceUsd: 1.5, inStock: true, voltage: 5, currentA: 0.00005, measures: "temperature", for: ["breadboard"] },
  "soil-module": { id: "soil-module", name: "Soil moisture sensor", kind: "module", massKg: 0.004, priceUsd: 1, inStock: true, voltage: 5, currentA: 0.005, measures: "moisture", for: ["breadboard"] },
  "pir-module": { id: "pir-module", name: "PIR motion sensor HC-SR501", kind: "module", massKg: 0.008, priceUsd: 1.5, inStock: true, voltage: 5, currentA: 0.0001, outV: 3.3, measures: "motion", for: ["breadboard"] },
  // off-board: a TT gear motor on its own L9110S driver board (IA, IB, VCC, GND), and a character display on I2C
  "dc-motor": { id: "dc-motor", name: "DC gear motor with driver (L9110S)", kind: "motor", massKg: 0.04, priceUsd: 4, inStock: true, voltage: 5, currentA: 0.2, stallMa: 800, rpm: 200, for: ["breadboard"] },
  "lcd-1602": { id: "lcd-1602", name: "LCD 16×2 with I2C adapter", kind: "display", massKg: 0.035, priceUsd: 4, inStock: true, voltage: 5, currentA: 0.03, for: ["breadboard"] },
  "psu-5v-2a": { id: "psu-5v-2a", name: "External supply 5 V / 2 A", kind: "psu", massKg: 0.05, priceUsd: 6, inStock: true, supplyV: 5, supplyA: 2, for: ["breadboard"] },
  "jumper-m2m": { id: "jumper-m2m", name: "Jumper wire", kind: "wire", massKg: 0.0005, priceUsd: 0.1, inStock: true, for: ["breadboard"] },
  "psu-12-10": { id: "psu-12-10", name: "PSU 12V / 10A", kind: "psu", massKg: 0.5, priceUsd: 24, inStock: true, supplyV: 12, supplyA: 10, for: ["arm"] },
};

export interface Part { moduleId: string; qty: number; }

export interface Params {
  tableDiameterMm: number;
  cameraHeightMm: number;
  partMassKg: number;
  link1Mm: number;
  link2Mm: number;
  payloadKg: number;
  targetReachMm: number;
  slopeDeg: number;
  speedMs: number;
  runtimeMin: number;
}

export interface DesignComment { id: string; part: string | null; text: string; by: string; color: string; at: number; resolved?: boolean }

export interface DeviceGraph {
  template: Template;
  circuit?: { preset: Preset; layout?: Layout; kit?: KitItem[] }; // breadboard projects; layout = hand-edited circuit; kit = parts laid out in order
  name: string;
  version: number;
  params: Params;
  parts: Part[];
  budgetUsd: number;
  printerBedMm: number;
  /** school safe mode: supplies up to SAFE_MAX_V and no lithium packs (set for school projects; the class decides) */
  safe?: boolean;
  /** a remix of someone's published design: the author stays credited */
  remixOf?: { author: string; title: string };
  /** designs assembled from blocks (template "custom"): the block tree; `parts` is kept in step with it */
  assembly?: Assembly;
  /** comments pinned to a part (module id) or to the whole project; they travel with the design to teammates */
  comments?: DesignComment[];
}

export function sampleProject(): DeviceGraph {
  return {
    template: "stand",
    name: "Quality-control stand",
    version: 1,
    params: { tableDiameterMm: 200, cameraHeightMm: 350, partMassKg: 1.5, link1Mm: 220, link2Mm: 180, payloadKg: 0.5, targetReachMm: 450, slopeDeg: 18, speedMs: 0.6, runtimeMin: 180 },
    parts: [
      { moduleId: "profile-20", qty: 4 },
      { moduleId: "nema17", qty: 1 },
      { moduleId: "turntable", qty: 1 },
      { moduleId: "cam-usb", qty: 1 },
      { moduleId: "ring-light", qty: 1 },
      { moduleId: "esp32", qty: 1 },
      { moduleId: "drv8825", qty: 1 },
      { moduleId: "psu-24-3", qty: 1 },
    ],
    budgetUsd: 450,
    printerBedMm: 220,
  };
}

export function sampleArm(): DeviceGraph {
  return {
    template: "arm",
    name: "Desktop robot arm",
    version: 1,
    params: { tableDiameterMm: 200, cameraHeightMm: 350, partMassKg: 1.5, link1Mm: 220, link2Mm: 180, payloadKg: 0.5, targetReachMm: 450, slopeDeg: 18, speedMs: 0.6, runtimeMin: 180 },
    parts: [
      { moduleId: "arm-base", qty: 1 },
      { moduleId: "servo-std", qty: 4 },
      { moduleId: "link-alu", qty: 2 },
      { moduleId: "gripper-par", qty: 1 },
      { moduleId: "servo-bus", qty: 1 },
      { moduleId: "esp32", qty: 1 },
      { moduleId: "psu-12-5", qty: 1 },
    ],
    budgetUsd: 400,
    printerBedMm: 220,
  };
}

export function sampleRover(): DeviceGraph {
  return {
    template: "rover",
    name: "Delivery rover",
    version: 1,
    params: { tableDiameterMm: 200, cameraHeightMm: 350, partMassKg: 1.5, link1Mm: 220, link2Mm: 180, payloadKg: 1.5, targetReachMm: 450, slopeDeg: 18, speedMs: 0.6, runtimeMin: 180 },
    parts: [
      { moduleId: "chassis-300", qty: 1 },
      { moduleId: "motor-tt", qty: 2 },
      { moduleId: "wheel-65", qty: 2 },
      { moduleId: "battery-3s-5", qty: 1 },
      { moduleId: "driver-dc", qty: 1 },
      { moduleId: "esp32", qty: 1 },
      { moduleId: "lidar-2d", qty: 1 },
    ],
    budgetUsd: 260,
    printerBedMm: 220,
  };
}

export const sampleFor = (t: Template) => (t === "arm" ? sampleArm() : t === "rover" ? sampleRover() : t === "breadboard" ? sampleBreadboard() : t === "custom" ? sampleCustom() : sampleProject());

// ---- Verifier (deterministic code, not AI) ---------------------------------

export type Severity = "green" | "yellow" | "red";
export interface Check {
  id: string;
  category: "Geometry" | "Mechanics" | "Electrics" | "Manufacturing" | "Commerce";
  severity: Severity;
  title: string;
  detail: string;
  fix?: { label: string; apply: (g: DeviceGraph) => DeviceGraph };
  focus?: string; // moduleId to highlight in 3D
  why?: string; // explanation shown behind the "Why?" button
  /** how the number is obtained: "calc" = a physics or geometry formula from stated inputs (src/lib/physics.ts);
   *  "estimate" = rests on a rule of thumb or an assumed factor (duty cycle, friction, efficiency) — read it as a guide */
  basis: "calc" | "estimate";
}

const has = (g: DeviceGraph, kind: ModuleKind) =>
  g.parts.filter((p) => CATALOG[p.moduleId]?.kind === kind);

/** Localised catalog name (falls back to the English one). */
export const modName = (id: string): string => t(CATALOG[id]?.name ?? id);
/** Name without the bracketed detail, e.g. "Bus servo 5.9 Nm". */
export const modShort = (id: string): string => modName(id).split(" (")[0];

export function totalCost(g: DeviceGraph): number {
  const jumpers = g.template === "breadboard" ? jumperCount(g) * CATALOG["jumper-m2m"].priceUsd : 0;
  return Math.round((g.parts.reduce((s, p) => s + (CATALOG[p.moduleId]?.priceUsd ?? 0) * p.qty, 0) + jumpers) * 100) / 100;
}

export function swap(g: DeviceGraph, from: string, to: string): DeviceGraph {
  return {
    ...g,
    version: g.version + 1,
    parts: g.parts.map((p) => (p.moduleId === from ? { ...p, moduleId: to } : p)),
  };
}

export function verify(g: DeviceGraph): Check[] {
  const out = g.template === "arm" ? verifyArm(g) : g.template === "rover" ? verifyRover(g) : g.template === "breadboard" ? verifyBreadboard(g) : g.template === "custom" ? verifyAssembly(g) : verifyStand(g);
  return g.safe ? [...safetyChecks(g), ...out] : out;
}

// ---- School safe mode --------------------------------------------------------
// Safety extra-low voltage only (≤ 24 V DC) and no lithium packs, which need supervised charging and storage.

export const SAFE_MAX_V = 24;
export const allowedInSafeMode = (id: string) => {
  const m = CATALOG[id];
  return !!m && m.chemistry !== "lipo" && Math.max(m.supplyV ?? 0, m.voltage ?? 0) <= SAFE_MAX_V;
};

function safetyChecks(g: DeviceGraph): Check[] {
  return g.parts.filter((p) => !allowedInSafeMode(p.moduleId)).map((p) => {
    const m = CATALOG[p.moduleId];
    const lipo = m.chemistry === "lipo";
    return {
      id: `safe-${m.id}`, basis: "calc", category: "Electrics", severity: "red", focus: m.id,
      title: t("{name} is not allowed in school safe mode", { name: modShort(m.id) }),
      detail: lipo ? t("Lithium packs need supervised charging and storage.") : t("Safe mode allows supplies up to {v} V.", { v: SAFE_MAX_V }),
      why: t("Safe mode is on for school projects: supplies up to {v} V DC and no lithium battery packs. Your teacher can switch it off for the class.", { v: SAFE_MAX_V }),
      fix: lipo ? { label: t("Use {name}", { name: modShort("battery-nimh-12") }), apply: (x: DeviceGraph) => replaceKind(x, "battery-nimh-12") } : undefined,
    };
  });
}

/** A printed part loaded in bending: stress M·c/I against the FDM allowable (datasheet strength × 0.5 knock-down ÷ 2 safety). */
function printedStrength(id: string, name: string, mat: Material, F: number, lever: number, sec: Section, load: string): Check {
  const stress = (F * lever * sec.c) / sec.I;
  const allow = allowablePrinted(mat);
  const sev: Severity = stress > allow ? "red" : stress > allow * 0.67 ? "yellow" : "green";
  return {
    id: `print-${id}`, category: "Mechanics", severity: sev, basis: "calc",
    title: t("{part}: {s} MPa of {a} MPa allowed", { part: name, s: stress.toFixed(1), a: allow.toFixed(1) }),
    detail: sev === "green" ? t("The printed part is strong enough.") : sev === "yellow" ? t("Little reserve: print it with more walls or infill, or thicker.") : t("The printed part may crack: make it thicker or use a stronger material."),
    why: t("Bending at the root: σ = F·a·c/I, F = {F} N ({load}), lever a = {a} mm, section {sec} mm (I = {I} mm⁴). Allowed for printed {mat}: {st} MPa × 0.5 (layers and infill) ÷ 2 (safety) = {al} MPa.", { F: F.toFixed(1), load, a: lever, sec: sec.name, I: Math.round(sec.I), mat: mat.name, st: mat.strength ?? 0, al: allow.toFixed(1) }),
  };
}

function verifyStand(g: DeviceGraph): Check[] {
  const out: Check[] = [];

  // Electrics: PSU capacity vs. summed 24V draw
  const draw = g.parts.reduce((s, p) => {
    const m = CATALOG[p.moduleId];
    return s + (m.currentA && m.voltage === 24 ? m.currentA * p.qty : 0);
  }, 0);
  const psu = has(g, "psu")[0];
  const cap = psu ? CATALOG[psu.moduleId].supplyA! * psu.qty : 0;
  const psuId = psu?.moduleId ?? "";
  if (!psu) {
    out.push({ id: "psu", basis: "calc", category: "Electrics", severity: "red", title: t("No power supply"), detail: t("Add a 24 V PSU.") });
  } else if (draw > cap) {
    out.push({
      id: "psu", basis: "calc", category: "Electrics", severity: "red", focus: psuId,
      title: t("Power: {need} A needed, PSU gives {cap} A", { need: draw.toFixed(1), cap }),
      detail: t("PSU is weaker than the total current of the 24 V consumers."),
      why: t("Sum of 24 V consumer currents (motor, driver, ring light) exceeds the PSU rating, so the rail would sag or trip."),
      fix: { label: t("Use PSU 24V / 6A"), apply: (x) => swap(x, psuId, "psu-24-6") },
    });
  } else {
    out.push({ id: "psu", basis: "calc", category: "Electrics", severity: draw > cap * 0.8 ? "yellow" : "green",
      title: t("Power {draw} A / {cap} A", { draw: draw.toFixed(1), cap }), detail: t("Supply headroom {pct}%.", { pct: Math.round((1 - draw / cap) * 100) }), focus: psuId,
      why: t("Sum of 24 V consumer currents (motor, driver, ring light) compared with PSU rating. Below 80% load is considered healthy.") });
  }

  // Mechanics: the stepper must start and stop the table with the part on it (indexing 45° moves, as the simulation runs them)
  const motor = has(g, "actuator")[0];
  if (motor) {
    const m = CATALOG[motor.moduleId];
    const r = g.params.tableDiameterMm / 2000;
    const tableKg = has(g, "platform")[0] ? CATALOG[has(g, "platform")[0].moduleId].massKg : 0.6;
    const J = 0.5 * g.params.partMassKg * r * r + 0.5 * tableKg * r * r;
    const alpha = 3; // rad/s², the indexing move
    const friction = 0.005 * (g.params.partMassKg + tableKg) * GRAV * 0.05;
    const need = (J * alpha + friction) * 2; // steppers lose torque with speed: keep half the holding torque in reserve
    const ok = m.momentNm! >= need;
    out.push({
      id: "motor", category: "Mechanics", focus: motor.moduleId, basis: "calc",
      severity: ok ? "green" : "red",
      title: ok ? t("Motor torque {have} Nm ≥ {need} Nm", { have: m.momentNm!, need: need.toFixed(2) }) : t("Motor too weak: {have} Nm < {need} Nm", { have: m.momentNm!, need: need.toFixed(2) }),
      detail: t("Required torque includes a ×2 reserve for torque loss at speed."),
      why: t("T = (J·α + T_bearing) × 2. J = ½·m_part·r² + ½·m_table·r² = {J} kg·m² (the part taken as a disk filling the table — an upper bound), α = {a} rad/s² (45° moves), bearing friction {f} Nm. T = {T} Nm.", { J: J.toFixed(4), a: alpha, f: friction.toFixed(4), T: need.toFixed(3) }),
      fix: ok ? undefined : { label: t("Use NEMA23 1.2 Nm"), apply: (x) => swap(x, motor.moduleId, "nema23") },
    });
  }

  // Mechanics: the cross beam carrying the camera and ring light (simply supported between the top bars, as the CAD draws it)
  const prof = has(g, "profile")[0];
  if (prof) {
    const sec = PROFILES[prof.moduleId] ?? PROFILES["profile-20"];
    const E = MATERIALS.alu6063.E;
    const L = g.params.tableDiameterMm + 120; // beam span = frame width
    const hung = has(g, "camera").concat(has(g, "light")).reduce((m, p) => m + CATALOG[p.moduleId].massKg * p.qty, 0) + 0.03; // + printed camera bracket
    const beamKg = (sec.kgPerM * L) / 1000;
    const sag = simplySupportedSag(hung * GRAV, (beamKg * GRAV) / L, L, E, sec.I);
    const f = beamFrequency(hung, beamKg, L, E, sec.I);
    const sev: Severity = sag > 0.5 || f < 25 ? "yellow" : "green";
    out.push({
      id: "defl", category: "Mechanics", severity: sev, focus: prof.moduleId, basis: "calc",
      title: t("Camera beam sags {d} mm, natural frequency {f} Hz", { d: sag.toFixed(3), f: Math.round(f) }),
      detail: sev === "green" ? t("Stiff enough: the camera neither sags nor shakes noticeably.") : f < 25 ? t("Low natural frequency: vibration from the motor or the floor may blur images.") : t("The camera beam sags noticeably: the camera may tilt."),
      why: t("{name}, E = {E} GPa, I = {I} mm⁴, span L = {L} mm, camera + light + bracket {m} kg at mid-span, beam {mb} kg. Sag δ = W·L³/(48·E·I) + 5·w·L⁴/(384·E·I) = {d} mm. Natural frequency f = (1/2π)·√(48·E·I/L³ / (m + 17/35·m_beam)) = {f} Hz; below 25 Hz motor and floor vibration can blur the image. Simply supported ends: the real bolted frame is stiffer.", { name: t(sec.name), E: E / 1000, I: sec.I, L, m: hung.toFixed(2), mb: beamKg.toFixed(2), d: sag.toFixed(3), f: Math.round(f) }),
      fix: sev === "green" || prof.moduleId === "profile-30" ? undefined : { label: t("Use profile 30×30"), apply: (x) => swap(x, prof.moduleId, "profile-30") },
    });
  }

  // Assembly: the printed turntable adapter sits on the motor's front boss
  const motorId = has(g, "actuator")[0]?.moduleId;
  if (motorId && MOTOR_BOSS_MM[motorId]) {
    const boss = MOTOR_BOSS_MM[motorId];
    const hole = adapterHole(motorId);
    const f = fit(hole, boss);
    out.push({
      id: "fit", category: "Manufacturing", severity: f === "ok" ? "green" : "yellow", focus: motorId, basis: "calc",
      title: f === "ok" ? t("Adapter hole Ø{h} mm fits the motor boss Ø{b} mm", { h: hole, b: boss }) : t("Adapter hole Ø{h} mm does not suit the motor boss Ø{b} mm", { h: hole, b: boss }),
      detail: f === "ok" ? t("Clearance {c} mm: slides on without forcing.", { c: (hole - boss).toFixed(2) }) : f === "tight" ? t("Too tight for a printed hole: it will not go on.") : t("Too loose: the table will wobble."),
      why: t("Printed holes come out 0.1–0.2 mm small, so a printed hole needs {min}–{max} mm more than the part it goes over. Hole {h} mm − boss {b} mm = {c} mm.", { min: FIT_MIN, max: FIT_MAX, h: hole, b: boss, c: (hole - boss).toFixed(2) }),
    });
  }

  // Strength: the printed L-bracket that holds the camera and ring light on the beam
  {
    const hung = has(g, "camera").concat(has(g, "light")).reduce((m, p) => m + CATALOG[p.moduleId].massKg * p.qty, 0);
    if (hung > 0) out.push(printedStrength("bracket", t("Camera bracket"), MATERIALS.PETG, hung * GRAV * 2, 60, rect(40, 4), t("camera + light {m} kg × 2 (bumps when adjusting)", { m: hung.toFixed(2) })));
  }

  // Manufacturing: printed turntable adapter must fit the printer bed
  const tooBig = g.params.tableDiameterMm > g.printerBedMm;
  out.push({
    id: "print", basis: "calc", category: "Manufacturing", severity: tooBig ? "yellow" : "green",
    title: tooBig ? t("Table Ø{d} mm > bed {bed} mm", { d: g.params.tableDiameterMm, bed: g.printerBedMm }) : t("Printable on your printer"),
    detail: tooBig ? t("Split the plate or use CNC.") : t("All printed parts fit the bed."),
  });

  // Geometry: table must be inside camera field of view (simple FOV model, 60°)
  const fov = 2 * g.params.cameraHeightMm * Math.tan((30 * Math.PI) / 180);
  const inView = g.params.tableDiameterMm <= fov;
  out.push({
    id: "fov", basis: "calc", category: "Geometry", severity: inView ? "green" : "red",
    title: inView ? t("Camera sees {fov} mm field", { fov: Math.round(fov) }) : t("Table Ø{d} exceeds view {fov} mm", { d: g.params.tableDiameterMm, fov: Math.round(fov) }),
    detail: t("Field of view at table plane."),
    why: t("FOV width = 2·H·tan(30°) = 2 × {H} × 0.577 = {fov} mm. The table must fit inside it.", { H: g.params.cameraHeightMm, fov: Math.round(fov) }),
    fix: inView ? undefined : { label: t("Raise camera"), apply: (x) => ({ ...x, version: x.version + 1, params: { ...x.params, cameraHeightMm: Math.ceil(x.params.tableDiameterMm / (2 * Math.tan((30 * Math.PI) / 180)) / 10) * 10 } }) },
  });

  // Commerce
  const missing = g.parts.filter((p) => !CATALOG[p.moduleId].inStock);
  const cost = totalCost(g);
  out.push({
    id: "stock", basis: "estimate", category: "Commerce", severity: missing.length ? "red" : "green",
    title: missing.length ? tn(missing.length, "{n} item out of stock", "{n} items out of stock") : t("All items in stock"), detail: t("Prices and stock are examples: no supplier is connected yet."),
  });
  out.push({
    id: "budget", basis: "calc", category: "Commerce", severity: cost > g.budgetUsd ? "yellow" : "green",
    title: t("Cost ${cost} / budget ${budget}", { cost, budget: g.budgetUsd }), detail: cost > g.budgetUsd ? t("Over budget.") : t("Within budget."),
  });
  return out;
}

export function overall(checks: Check[]): Severity {
  if (checks.some((c) => c.severity === "red")) return "red";
  if (checks.some((c) => c.severity === "yellow")) return "yellow";
  return "green";
}

// ---- Derived views --------------------------------------------------------

export function bom(g: DeviceGraph) {
  const rows = g.parts.map((p) => ({ ...CATALOG[p.moduleId], qty: p.qty, lineUsd: CATALOG[p.moduleId].priceUsd * p.qty }));
  if (g.template === "breadboard") {
    const j = CATALOG["jumper-m2m"], n = jumperCount(g);
    rows.push({ ...j, qty: n, lineUsd: Math.round(j.priceUsd * n * 100) / 100 });
  }
  return rows;
}

export function instructions(g: DeviceGraph): { title: string; parts: string[] }[] {
  if (g.template === "breadboard") return breadboardSteps(g);
  // Assembly order derived from kind precedence (mechanical → motion → electronics → sensing).
  const order: ModuleKind[] = ["base", "profile", "platform", "actuator", "wheel", "link", "driver", "controller", "psu", "battery", "gripper", "sensor", "light", "camera"];
  const verbs: Record<ModuleKind, string> = {
    profile: t("Assemble frame from"), platform: t("Mount"), actuator: t("Attach to the frame"), driver: t("Install"),
    controller: t("Install"), psu: t("Connect power"), light: t("Fit"), camera: t("Mount on top"),
    base: t("Fix to the bench"), link: t("Fit link"), gripper: t("Attach gripper"), wheel: t("Press onto the motor shaft"), battery: t("Strap in"), sensor: t("Mount on top"),
    mcu: t("Place"), led: t("Insert"), resistor: t("Insert"), button: t("Insert"), pot: t("Insert"), buzzer: t("Insert"), wire: t("Connect"), module: t("Insert"), motor: t("Place"), display: t("Place"),
  };
  return order.flatMap((k) =>
    g.parts.filter((p) => CATALOG[p.moduleId].kind === k).map((p) => ({
      title: `${verbs[k]}: ${modName(p.moduleId)}${p.qty > 1 ? ` ×${p.qty}` : ""}`,
      parts: [p.moduleId],
    }))
  );
}

// Rough "agent" for the chat: maps phrases to graph edits. A real LLM agent
// would call these same tools (athena-cad / athena-verify via MCP).
export function applyCommand(g: DeviceGraph, text: string): { graph: DeviceGraph; reply: string } {
  const q = text.toLowerCase();
  if (g.template === "breadboard") {
    const pre = /(traffic|светофор|бағдаршам)/.test(q) ? "traffic" : /(doorbell|door bell|звонок|қоңырау)/.test(q) ? "doorbell" : /(dimmer|dim |brightness|яркост|жарықтығ)/.test(q) ? "dimmer" : /(parking|парктроник)/.test(q) ? "parking" : /(radar|scanner|радар|сканер)/.test(q) ? "radar" :
      /(distance|alarm|ultrasonic|расстоян|сигнал|қашықтық)/.test(q) ? "distance" : /(servo|knob|pot|серво|ручк|тұтқа)/.test(q) ? "servo" : /(button|кнопк|түйме)/.test(q) ? "button" : /(blink|led|светодиод|мигани|жарықдиод)/.test(q) ? "led" : null;
    if (/esp32/.test(q)) return { graph: replaceKind(g, "esp32-devkit"), reply: t("Switched to the ESP32 DevKit (3.3 V logic). Re-verified.") };
    if (/uno|arduino/.test(q)) return { graph: replaceKind(g, "uno-r3"), reply: t("Switched to the Arduino Uno (5 V logic). Re-verified.") };
    if (/blue|синий|син|көк/.test(q)) return { graph: replaceKind(g, "led-blue"), reply: t("Using a blue LED. Re-verified.") };
    if (/green|зелен|жасыл/.test(q)) return { graph: replaceKind(g, "led-green"), reply: t("Using a green LED. Re-verified.") };
    if (pre) return { graph: setPreset(g, pre), reply: t("Loaded the “{name}” circuit. Re-verified.", { name: t(pre) }) };
    return { graph: g, reply: t("Try: “distance alarm”, “servo with a knob”, “traffic light”, “swap to ESP32” or “use a blue LED”.") };
  }
  const num = parseFloat(((q.match(/(\d+([.,]\d+)?)/) ?? [])[1] ?? "").replace(",", "."));
  const cm = /cm|см/.test(q) ? 10 : 1;
  const next = (p: Partial<Params>): DeviceGraph => ({ ...g, version: g.version + 1, params: { ...g.params, ...p } });
  if (g.template === "rover" && !isNaN(num)) {
    const rv = (p: Partial<Params>, msg: string) => ({ graph: next(p), reply: msg + " " + t("Re-verified.") });
    if (/(payload|kg|кг|груз|жүк)/.test(q)) return rv({ payloadKg: num }, t("Payload → {v} kg.", { v: num }));
    if (/(slope|degree|°|град|уклон|еңіс)/.test(q)) return rv({ slopeDeg: num }, t("Slope → {v}°.", { v: num }));
    if (/(speed|m\/s|скорост|жылдамд)/.test(q)) return rv({ speedMs: num }, t("Target speed → {v} m/s.", { v: num }));
    if (/(runtime|min|минут|battery|мин|жұмыс)/.test(q)) return rv({ runtimeMin: num }, t("Target runtime → {v} min.", { v: num }));
  }
  if (g.template === "arm" && !isNaN(num)) {
    const mm = /cm|см/.test(q) ? num * 10 : num;
    const arm = (p: Partial<Params>, msg: string) => ({ graph: next(p), reply: msg + " " + t("Re-verified.") });
    if (/(payload|kg|кг|load|груз|жүк)/.test(q)) return arm({ payloadKg: num }, t("Payload → {v} kg.", { v: num }));
    if (/(reach|target|вылет|жету)/.test(q)) return arm({ targetReachMm: mm }, t("Target reach → {v} mm.", { v: mm }));
    if (/(forearm|second|link ?2|предплеч|білек)/.test(q)) return arm({ link2Mm: mm }, t("Forearm → {v} mm.", { v: mm }));
    if (/(upper|first|link ?1|link|плеч|иық)/.test(q)) return arm({ link1Mm: mm }, t("Upper arm → {v} mm.", { v: mm }));
  }
  if (/(table|стол|үстел)/.test(q) && !isNaN(num)) {
    const d = /(wider|шире|bigger|кеңірек|кеңей)/.test(q) ? g.params.tableDiameterMm + num * cm : num * cm;
    return { graph: next({ tableDiameterMm: d }), reply: t("Table diameter → {v} mm. Re-verified.", { v: d }) };
  }
  if (/(camera|камер)/.test(q) && !isNaN(num)) {
    const h = /(higher|выше|raise|жоғары)/.test(q) ? g.params.cameraHeightMm + num * cm : num * cm;
    return { graph: next({ cameraHeightMm: h }), reply: t("Camera height → {v} mm. Re-verified.", { v: h }) };
  }
  if (/(kg|кг|mass|weight|вес)/.test(q) && !isNaN(num)) {
    return { graph: next({ partMassKg: num }), reply: t("Part mass → {v} kg. Re-verified.", { v: num }) };
  }
  return { graph: g, reply: g.template === "rover" ? t("Try: “slope 25 degrees”, “payload 2 kg”, “speed 0.8”, or “runtime 120 min”.") : g.template === "arm" ? t("Try: “payload 0.8 kg”, “reach 500 mm”, or “forearm 220 mm”.") : t("Try: “make the table 5 cm wider”, “camera 40 cm”, or “part 3 kg”.") };
}

// ---- Library helpers ------------------------------------------------------

/** Swap the module of this kind. A hand-edited breadboard circuit derives its parts from the layout instead. */
export function replaceKind(g: DeviceGraph, moduleId: string): DeviceGraph {
  return g.circuit?.layout ? applyKindToLayout(g, moduleId) : replaceKindParts(g, moduleId);
}

export function replaceKindParts(g: DeviceGraph, moduleId: string): DeviceGraph {
  const kind = CATALOG[moduleId].kind;
  const exists = g.parts.some((p) => CATALOG[p.moduleId].kind === kind);
  const parts = exists
    ? g.parts.map((p) => (CATALOG[p.moduleId].kind === kind ? { ...p, moduleId } : p))
    : [...g.parts, { moduleId, qty: 1 }];
  return { ...g, version: g.version + 1, parts };
}

// ---- Simulation -----------------------------------------------------------

export function powerProfile(g: DeviceGraph, samples = 60) {
  if (g.template === "breadboard") return breadboardPowerProfile(g, samples);
  if (g.template === "rover") {
    const act = g.parts.find((p) => CATALOG[p.moduleId].kind === "actuator");
    const bat = g.parts.find((p) => CATALOG[p.moduleId].kind === "battery");
    const n = act?.qty ?? 0, cur = act ? CATALOG[act.moduleId].currentA! : 0;
    return {
      cap: bat ? CATALOG[bat.moduleId].supplyA! : 0,
      points: Array.from({ length: samples }, (_, i) => {
        const t = i / (samples - 1);
        const stop = t > 0.45 && t < 0.55 ? 0.1 : 1;
        return +(0.6 + n * cur * stop * (0.55 + 0.35 * Math.abs(Math.sin(t * 9)))).toFixed(2);
      }),
    };
  }
  if (g.template === "arm") {
    const act = g.parts.find((p) => CATALOG[p.moduleId].kind === "actuator");
    const n = act?.qty ?? 0;
    const cur = act ? CATALOG[act.moduleId].currentA! : 0;
    const ps = g.parts.find((p) => CATALOG[p.moduleId].kind === "psu");
    return {
      cap: ps ? CATALOG[ps.moduleId].supplyA! : 0,
      points: Array.from({ length: samples }, (_, i) => {
        const t = i / (samples - 1);
        return +(0.3 + n * cur * (0.35 + 0.35 * Math.abs(Math.sin(t * 12)))).toFixed(2);
      }),
    };
  }
  const base = g.parts.reduce((s, p) => {
    const m = CATALOG[p.moduleId];
    return s + (m.voltage === 24 && m.kind !== "actuator" ? (m.currentA ?? 0) * p.qty : 0);
  }, 0);
  const motor = g.parts.find((p) => CATALOG[p.moduleId].kind === "actuator");
  const mA = motor ? CATALOG[motor.moduleId].currentA! : 0;
  const cap = g.parts.find((p) => CATALOG[p.moduleId].kind === "psu");
  return {
    cap: cap ? CATALOG[cap.moduleId].supplyA! : 0,
    points: Array.from({ length: samples }, (_, i) => {
      const t = i / (samples - 1);
      const accel = t < 0.1 || (t > 0.45 && t < 0.55) ? 1.25 : t > 0.9 ? 0.2 : 1; // start/stop peaks
      const idle = t > 0.9;
      return +(base + (idle ? 0.1 * mA : mA * accel * (0.9 + 0.1 * Math.sin(t * 60)))).toFixed(2);
    }),
  };
}

export function toCsv(g: DeviceGraph): string {
  const rows = bom(g).map((r) => [r.id, `"${r.name}"`, r.qty, r.priceUsd, r.lineUsd, r.inStock ? "yes" : "no"].join(","));
  return ["sku,name,qty,unit_usd_example,line_usd_example,in_stock_example", ...rows, `total,,,,${totalCost(g)},`].join("\n");
}

export function toUrdf(g: DeviceGraph): string {
  if (g.template === "rover") {
    const w = CATALOG[g.parts.find((p) => CATALOG[p.moduleId].kind === "wheel")?.moduleId ?? "wheel-65"].diameterMm! / 2000;
    return `<?xml version="1.0"?>
<robot name="delivery_rover">
  <link name="base_link"><visual><geometry><box size="0.3 0.2 0.02"/></geometry></visual></link>
  <link name="left_wheel"><visual><geometry><cylinder radius="${w}" length="0.02"/></geometry></visual></link>
  <link name="right_wheel"><visual><geometry><cylinder radius="${w}" length="0.02"/></geometry></visual></link>
  <joint name="left_wheel_joint" type="continuous"><parent link="base_link"/><child link="left_wheel"/><origin xyz="-0.05 0.12 0" rpy="-1.5708 0 0"/><axis xyz="0 0 1"/></joint>
  <joint name="right_wheel_joint" type="continuous"><parent link="base_link"/><child link="right_wheel"/><origin xyz="-0.05 -0.12 0" rpy="-1.5708 0 0"/><axis xyz="0 0 1"/></joint>
</robot>`;
  }
  if (g.template === "arm") {
    const l1 = (g.params.link1Mm / 1000).toFixed(3), l2 = (g.params.link2Mm / 1000).toFixed(3);
    return `<?xml version="1.0"?>
<robot name="desktop_robot_arm">
  <link name="base"/><link name="upper_arm"/><link name="forearm"/><link name="gripper"/>
  <joint name="shoulder" type="revolute"><parent link="base"/><child link="upper_arm"/><axis xyz="0 1 0"/><limit lower="-1.57" upper="1.57" effort="2" velocity="3"/></joint>
  <joint name="elbow" type="revolute"><parent link="upper_arm"/><child link="forearm"/><origin xyz="0 0 ${l1}"/><axis xyz="0 1 0"/><limit lower="-2.2" upper="2.2" effort="2" velocity="3"/></joint>
  <joint name="wrist" type="revolute"><parent link="forearm"/><child link="gripper"/><origin xyz="0 0 ${l2}"/><axis xyz="0 1 0"/><limit lower="-1.57" upper="1.57" effort="1" velocity="3"/></joint>
</robot>`;
  }
  const d = (g.params.tableDiameterMm / 2000).toFixed(3);
  return `<?xml version="1.0"?>
<robot name="${g.name.toLowerCase().replace(/\s+/g, "_")}">
  <link name="base"><visual><geometry><box size="0.5 0.5 0.02"/></geometry></visual></link>
  <link name="turntable"><visual><geometry><cylinder radius="${d}" length="0.02"/></geometry></visual>
    <inertial><mass value="${g.params.partMassKg}"/></inertial></link>
  <joint name="table_joint" type="continuous">
    <parent link="base"/><child link="turntable"/><axis xyz="0 0 1"/>
    <origin xyz="0 0 0.08"/>
  </joint>
</robot>`;
}

// ---- Robot arm verifier ---------------------------------------------------

function verifyArm(g: DeviceGraph): Check[] {
  const out: Check[] = [];
  const P = g.params;
  const G = 9.81;
  const actP = has(g, "actuator")[0];
  const servo = actP ? CATALOG[actP.moduleId] : undefined;
  const nServo = actP?.qty ?? 0;
  const gripM = has(g, "gripper")[0] ? CATALOG[has(g, "gripper")[0].moduleId] : undefined;
  const linkM = has(g, "link")[0] ? CATALOG[has(g, "link")[0].moduleId] : undefined;
  const L1 = P.link1Mm / 1000, L2 = P.link2Mm / 1000;
  const perM = (linkM?.massKg ?? 0.07) / 0.25; // kg per metre
  const mG = (gripM?.massKg ?? 0) + P.payloadKg;
  const shoulderNeed = (mS: number) => G * (perM * L1 * L1 / 2 + mS * L1 + perM * L2 * (L1 + L2 / 2) + mS * (L1 + L2) + mG * (L1 + L2));
  const elbowNeed = (mS: number) => G * (perM * L2 * L2 / 2 + mS * L2 + mG * L2);
  const mS = servo?.massKg ?? 0;
  const servoIds = ["servo-std", "servo-hv", "servo-pro", "servo-xl"];
  const betterServo = (need: (m: number) => number) =>
    servoIds.find((id) => CATALOG[id].momentNm! >= need(CATALOG[id].massKg) * 1.5 && id !== actP?.moduleId && CATALOG[id].momentNm! > (servo?.momentNm ?? 0));

  const torque = (id: string, title: string, need: (m: number) => number) => {
    const T = need(mS);
    const hold = servo?.momentNm ?? 0;
    const ratio = hold / T;
    const sevr: Severity = ratio < 1 ? "red" : ratio < 1.5 ? "yellow" : "green";
    const better = sevr === "green" ? undefined : betterServo(need);
    out.push({
      id, category: "Mechanics", severity: sevr, focus: actP?.moduleId, basis: "calc",
      title: t("{joint}: needs {need} Nm, servo holds {hold} Nm", { joint: title, need: T.toFixed(2), hold }),
      detail: sevr === "green" ? t("Safety factor ×{f}.", { f: ratio.toFixed(1) }) : ratio < 1 ? t("Servo cannot hold the arm at full extension.") : t("Safety factor below ×1.5."),
      why: t("Fully extended horizontal pose. T = g·Σ(m·d) with links {perM} kg/m, servos {mS} kg, gripper+payload {mG} kg, L1 {l1} mm, L2 {l2} mm.", { perM: perM.toFixed(2), mS, mG: mG.toFixed(2), l1: P.link1Mm, l2: P.link2Mm }),
      fix: better ? { label: t("Use {name}", { name: modShort(better) }), apply: (x) => replaceKind(x, better) } : undefined,
    });
  };
  torque("shoulder", t("Shoulder"), shoulderNeed);
  torque("elbow", t("Elbow"), elbowNeed);

  // Reach: the gripper points down at a spot on the table targetReachMm from the base axis. The wrist pivot is then a finger
  // length above the table, and the shoulder pivot sits on the base and the yaw servo (same layout as the CAD model).
  const zs = armShoulderZ(actP?.moduleId);
  const ik = twoLinkIk(P.targetReachMm, ARM.fingerLen, zs, P.link1Mm, P.link2Mm);
  const dWrist = Math.hypot(P.targetReachMm, ARM.fingerLen - zs);
  const reachMax = Math.sqrt(Math.max(0, (P.link1Mm + P.link2Mm) ** 2 - (ARM.fingerLen - zs) ** 2));
  const inside = !!ik;
  out.push({
    id: "reach", category: "Geometry", severity: inside ? "green" : "red", basis: "calc",
    title: inside ? t("Reaches a spot {target} mm away on the table", { target: P.targetReachMm }) : t("Cannot reach a spot {target} mm away: limit {max} mm", { target: P.targetReachMm, max: Math.floor(reachMax) }),
    detail: inside ? t("Elbow at {z} mm above the table, gripper pointing down.", { z: Math.round(ik!.elbowZ) }) : dWrist < Math.abs(P.link1Mm - P.link2Mm) ? t("The spot is too close to the base for these links.") : t("Arm cannot reach the target point."),
    why: t("Inverse kinematics, gripper pointing down: the wrist pivot must be at {x} mm out and {zw} mm up (finger length); the shoulder pivot is {zs} mm up. Distance shoulder→wrist = √({x}² + {dz}²) = {d} mm, reachable between |L1−L2| = {min} mm and L1+L2 = {max} mm.", { x: P.targetReachMm, zw: ARM.fingerLen, zs, dz: ARM.fingerLen - zs, d: Math.round(dWrist), min: Math.abs(P.link1Mm - P.link2Mm), max: P.link1Mm + P.link2Mm }),
    fix: inside || dWrist < Math.abs(P.link1Mm - P.link2Mm) ? undefined : (() => { const l2 = Math.ceil(dWrist - P.link1Mm + 5); return { label: t("Forearm → {mm} mm", { mm: l2 }), apply: (x: DeviceGraph) => ({ ...x, version: x.version + 1, params: { ...x.params, link2Mm: l2 } }) }; })(),
  });

  // Power: all servos at 70% of rated current simultaneously
  const draw = (servo?.currentA ?? 0) * nServo * 0.7 + (gripM?.currentA ?? 0) + 0.3;
  const psuP = has(g, "psu")[0];
  const psu = psuP ? CATALOG[psuP.moduleId] : undefined;
  const cap = psu?.supplyA ?? 0;
  const pSev: Severity = !psu || draw > cap ? "red" : draw > cap * 0.8 ? "yellow" : "green";
  out.push({
    id: "psu", basis: "estimate", category: "Electrics", severity: pSev, focus: psuP?.moduleId,
    title: t("Power {draw} A / {cap} A ({v} V)", { draw: draw.toFixed(1), cap, v: psu?.supplyV ?? 12 }),
    detail: pSev === "red" ? t("PSU too weak for simultaneous servo motion.") : t("Supply headroom {pct}%.", { pct: Math.round((1 - draw / cap) * 100) }),
    why: t("{n} servos × {i} A × 0.7 duty + gripper {gi} A + logic 0.3 A = {total} A.", { n: nServo, i: servo?.currentA ?? 0, gi: gripM?.currentA ?? 0, total: draw.toFixed(2) }),
    fix: pSev === "green" ? undefined : { label: t("Use PSU 12V / 10A"), apply: (x) => replaceKind(x, "psu-12-10") },
  });

  // Link bending at full horizontal extension: a cantilever from the shoulder with the elbow servo at L1, the wrist servo,
  // gripper and payload at the tip, and the tubes' own weight. Joint backlash comes on top and is not modelled.
  const tubeSpec = LINK_TUBES[linkM?.id ?? "link-alu"] ?? LINK_TUBES["link-alu"];
  const Ltot = P.link1Mm + P.link2Mm;
  const EI = tubeSpec.material.E * tubeSpec.section.I;
  const tipDefl = (linkId: string) => {
    const spec = LINK_TUBES[linkId] ?? LINK_TUBES["link-alu"];
    const kgPerM = (CATALOG[linkId]?.massKg ?? 0.07) / 0.25;
    return cantileverTip([{ F: mS * GRAV, a: P.link1Mm }, { F: (mS + mG) * GRAV, a: Ltot }], (kgPerM * GRAV) / 1000, Ltot, spec.material.E, spec.section.I);
  };
  const defl = tipDefl(linkM?.id ?? "link-alu");
  // a fix only when it really helps: stiffer links, else a shorter forearm that still reaches the target
  const shorter = Math.max(80, Math.round(P.link2Mm * 0.85));
  const deflFix = linkM?.id !== "link-carbon" && tipDefl("link-carbon") <= 1.0 ? { label: t("Use carbon links"), apply: (x: DeviceGraph) => replaceKind(x, "link-carbon") }
    : twoLinkIk(P.targetReachMm, ARM.fingerLen, zs, P.link1Mm, shorter) ? { label: t("Shorten the forearm to {mm} mm", { mm: shorter }), apply: (x: DeviceGraph) => ({ ...x, version: x.version + 1, params: { ...x.params, link2Mm: shorter } }) } : undefined;
  const dSev: Severity = defl > 1.0 ? "yellow" : "green";
  out.push({
    id: "defl", category: "Mechanics", severity: dSev, focus: linkM?.id, basis: "calc",
    title: t("Tip deflection {d} mm", { d: defl.toFixed(2) }), detail: dSev === "green" ? t("Link bending is within the 1 mm budget; servo backlash adds to it.") : t("Accuracy loss at full extension."),
    why: t("Cantilever L = L1 + L2 = {L} mm, {tube} ({mat}), E·I = {EI} N·m². Loads: elbow servo {ms} kg at L1, wrist servo + gripper + payload {mt} kg at the tip, tubes {w} kg/m. δ = Σ F·a²·(3L − a)/(6·E·I) + w·L⁴/(8·E·I) = {d} mm. Servo gear backlash is not included.", { L: Ltot, tube: tubeSpec.section.name, mat: tubeSpec.material.name, EI: (EI / 1e6).toFixed(0), ms: mS, mt: (mS + mG).toFixed(2), w: perM.toFixed(2), d: defl.toFixed(2) }),
    fix: dSev === "green" ? undefined : deflFix,
  });

  // Strength: each printed finger holds the payload by friction. Grip force per finger N = m·g / (2·μ) × 2 (safety),
  // with μ = 0.5 for the TPU pad; the finger bends like a cantilever loaded at its pad.
  if (gripM) {
    const N = ((P.payloadKg * GRAV) / (2 * 0.5)) * 2;
    out.push(printedStrength("finger", t("Gripper finger"), MATERIALS.PLA, N, 50, rect(18, 6), t("grip force for {m} kg with μ = 0.5 and ×2 safety", { m: P.payloadKg })));
  }

  const missing = g.parts.filter((p) => !CATALOG[p.moduleId].inStock);
  const cost = totalCost(g);
  out.push({ id: "stock", basis: "estimate", category: "Commerce", severity: missing.length ? "red" : "green", title: missing.length ? tn(missing.length, "{n} item out of stock", "{n} items out of stock") : t("All items in stock"), detail: t("Prices and stock are examples: no supplier is connected yet.") });
  out.push({ id: "budget", basis: "calc", category: "Commerce", severity: cost > g.budgetUsd ? "yellow" : "green", title: t("Cost ${cost} / budget ${budget}", { cost, budget: g.budgetUsd }), detail: cost > g.budgetUsd ? t("Over budget.") : t("Within budget.") });
  return out;
}

// ---- Rover verifier -------------------------------------------------------

function verifyRover(g: DeviceGraph): Check[] {
  const out: Check[] = [];
  const P = g.params;
  const G = 9.81;
  const th = (P.slopeDeg * Math.PI) / 180;
  const motorP = has(g, "actuator")[0];
  const motor = motorP ? CATALOG[motorP.moduleId] : undefined;
  const nM = motorP?.qty ?? 0;
  const wheel = has(g, "wheel")[0] ? CATALOG[has(g, "wheel")[0].moduleId] : undefined;
  const bat = has(g, "battery")[0] ? CATALOG[has(g, "battery")[0].moduleId] : undefined;
  const dia = wheel?.diameterMm ?? 65;
  const r = dia / 2000;
  const others = g.parts.filter((p) => CATALOG[p.moduleId].kind !== "actuator").reduce((s, p) => s + CATALOG[p.moduleId].massKg * p.qty, 0);
  const mass = (mMotor: number) => others + mMotor * nM + P.payloadKg + 0.05;
  const force = (mMotor: number) => mass(mMotor) * G * (Math.sin(th) + 0.03 * Math.cos(th));
  const need = (mMotor: number) => (force(mMotor) * r) / Math.max(nM, 1);

  // Traction torque per motor
  const T = need(motor?.massKg ?? 0);
  const hold = motor?.momentNm ?? 0;
  const ratio = hold / T;
  const tSev: Severity = ratio < 1 ? "red" : ratio < 1.5 ? "yellow" : "green";
  const ids = ["motor-tt", "motor-jgb", "motor-planet"];
  const better = tSev === "green" ? undefined : ids.find((id) => CATALOG[id].momentNm! >= need(CATALOG[id].massKg) * 1.5 && CATALOG[id].momentNm! > hold);
  out.push({
    id: "torque", basis: "calc", category: "Mechanics", severity: tSev, focus: motorP?.moduleId,
    title: t("Slope {deg}°: needs {need} Nm/motor, motor gives {hold} Nm", { deg: P.slopeDeg, need: T.toFixed(2), hold }),
    detail: tSev === "green" ? t("Safety factor ×{f}.", { f: ratio.toFixed(1) }) : ratio < 1 ? t("Rover cannot climb this slope loaded.") : t("Safety factor below ×1.5."),
    why: t("F = M·g·(sinθ + 0.03·cosθ) = {M} kg × 9.81 × (…) = {F} N; T = F·r / {n} motors, r = {r} mm.", { M: mass(motor?.massKg ?? 0).toFixed(2), F: force(motor?.massKg ?? 0).toFixed(1), n: nM, r: (r * 1000).toFixed(1) }),
    fix: better ? { label: t("Use {name}", { name: modShort(better) }), apply: (x) => replaceKind(x, better) } : undefined,
  });

  // Top speed
  const v = motor?.rpm ? (motor.rpm * Math.PI * (dia / 1000)) / 60 : 0;
  const sSev: Severity = v >= P.speedMs ? "green" : "red";
  out.push({
    id: "speed", basis: "calc", category: "Mechanics", severity: sSev, focus: wheel?.id,
    title: sSev === "green" ? t("Top speed {v} m/s ≥ {target}", { v: v.toFixed(2), target: P.speedMs }) : t("Top speed {v} m/s < target {target}", { v: v.toFixed(2), target: P.speedMs }),
    detail: sSev === "green" ? t("Target speed reachable.") : t("Wheel/motor combination is too slow."),
    why: t("v = rpm·π·D / 60 = {rpm} × π × {D} m / 60 = {v} m/s.", { rpm: motor?.rpm ?? 0, D: dia / 1000, v: v.toFixed(2) }),
    fix: sSev === "green" || wheel?.id === "wheel-100" ? undefined : { label: t("Use Wheel Ø100"), apply: (x) => replaceKind(x, "wheel-100") },
  });

  // Runtime
  const elec = g.parts.filter((p) => CATALOG[p.moduleId].kind !== "actuator" && CATALOG[p.moduleId].voltage)
    .reduce((s, p) => s + CATALOG[p.moduleId].voltage! * (CATALOG[p.moduleId].currentA ?? 0) * p.qty, 0);
  const mech = (force(motor?.massKg ?? 0) * P.speedMs) / 0.5; // 50% drivetrain efficiency
  const total = mech + elec;
  const minutes = bat?.capacityWh ? ((bat.capacityWh * 0.8) / total) * 60 : 0;
  const rSev: Severity = minutes >= P.runtimeMin ? "green" : "red";
  out.push({
    id: "runtime", basis: "estimate", category: "Electrics", severity: rSev, focus: bat?.id,
    title: t("Runtime {m} min / target {target} min", { m: Math.round(minutes), target: P.runtimeMin }),
    detail: rSev === "green" ? t("Battery covers the mission.") : t("Battery will run out before the target."),
    why: t("Usable energy {wh} Wh ÷ (mechanical {mech} W + electronics {elec} W) = {h} h.", { wh: ((bat?.capacityWh ?? 0) * 0.8).toFixed(0), mech: mech.toFixed(1), elec: elec.toFixed(1), h: (minutes / 60).toFixed(2) }),
    fix: rSev === "green" || bat?.id === "battery-3s-10" ? undefined : { label: t("Use LiPo 3S 10 Ah"), apply: (x) => replaceKind(x, "battery-3s-10") },
  });

  // Geometry: at the foot of the slope the rear of the chassis swings down towards the floor (departure angle)
  const clear = roverClearance(dia, motorP?.moduleId);
  const overhang = ROVER.axleX - ROVER.rearX;
  const dep = departureDeg(clear, overhang);
  const gSev: Severity = P.slopeDeg >= dep ? "red" : P.slopeDeg > dep - 3 ? "yellow" : "green";
  out.push({
    id: "departure", category: "Geometry", severity: gSev, focus: wheel?.id, basis: "calc",
    title: gSev === "red" ? t("The rear scrapes at the foot of a {deg}° slope", { deg: P.slopeDeg }) : t("Clears a {deg}° slope: departure angle {dep}°", { deg: P.slopeDeg, dep: dep.toFixed(1) }),
    detail: gSev === "green" ? t("The chassis does not touch the floor when the slope starts.") : t("Larger wheels raise the chassis."),
    why: t("Departure angle = atan(clearance / rear overhang) = atan({c} mm / {o} mm) = {dep}°. Clearance = wheel radius {r} mm + half the motor {mw} mm + 3 mm. It must be larger than the slope ({deg}°).", { c: clear.toFixed(1), o: overhang, dep: dep.toFixed(1), r: dia / 2, mw: (clear - dia / 2 - 3).toFixed(1), deg: P.slopeDeg }),
    fix: gSev === "green" || wheel?.id === "wheel-100" ? undefined : { label: t("Use Wheel Ø100"), apply: (x) => replaceKind(x, "wheel-100") },
  });

  // Assembly: the battery's printed tray must not collide with the boards and the LiDAR on the deck
  if (bat && BATTERY_MM[bat.id]) {
    const [bl, bw, bh] = BATTERY_MM[bat.id];
    const tray = trayFor(bat.id);
    const clash = deckClashes(ROVER.axleX, 0, tray.l, tray.w);
    out.push({
      id: "fit", category: "Manufacturing", severity: clash.length ? "red" : "green", focus: bat.id, basis: "calc",
      title: clash.length ? t("The battery tray hits: {what}", { what: clash.map((c) => t(c)).join(", ") }) : t("Battery {l}×{w}×{h} mm fits its tray and the chassis", { l: bl, w: bw, h: bh }),
      detail: clash.length ? t("Move the boards or choose a smaller battery.") : t("Typical pack size: measure yours before printing the tray."),
      why: t("Tray inside = pack + 2 mm all round, walls {wall} mm: {tl}×{tw} mm outside, centred over the axle. Checked in top view against the motor driver, the ESP32, the LiDAR and the chassis edge (300×200 mm).", { wall: tray.t, tl: tray.l.toFixed(1), tw: tray.w.toFixed(1) }),
    });
  }

  // Strength: the printed L-bracket of the sensor, with ×3 for bumps while driving
  const sens = has(g, "sensor")[0];
  if (sens) out.push(printedStrength("mount", t("Sensor mount"), MATERIALS.PETG, CATALOG[sens.moduleId].massKg * GRAV * 3, 40, rect(30, 3), t("{name} {m} kg × 3 (bumps)", { name: modShort(sens.moduleId), m: CATALOG[sens.moduleId].massKg })));

  // Battery discharge limit
  const peak = (motor?.currentA ?? 0) * nM * 1.5 + 1;
  const bCap = bat?.supplyA ?? 0;
  const bSev: Severity = peak > bCap ? "red" : peak > bCap * 0.8 ? "yellow" : "green";
  out.push({
    id: "battery", basis: "estimate", category: "Electrics", severity: bSev, focus: bat?.id,
    title: t("Peak draw {peak} A / battery {cap} A", { peak: peak.toFixed(1), cap: bCap }),
    detail: bSev === "green" ? t("Discharge within limits.") : t("Battery cannot supply motor peaks."),
    why: t("{n} motors × {i} A × 1.5 (stall margin) + 1 A logic = {total} A.", { n: nM, i: motor?.currentA ?? 0, total: peak.toFixed(2) }),
    fix: bSev === "green" || bat?.id === "battery-3s-10" ? undefined : { label: t("Use LiPo 3S 10 Ah"), apply: (x) => replaceKind(x, "battery-3s-10") },
  });

  const missing = g.parts.filter((p) => !CATALOG[p.moduleId].inStock);
  const cost = totalCost(g);
  out.push({ id: "stock", basis: "estimate", category: "Commerce", severity: missing.length ? "red" : "green", title: missing.length ? tn(missing.length, "{n} item out of stock", "{n} items out of stock") : t("All items in stock"), detail: t("Prices and stock are examples: no supplier is connected yet.") });
  out.push({ id: "budget", basis: "calc", category: "Commerce", severity: cost > g.budgetUsd ? "yellow" : "green", title: t("Cost ${cost} / budget ${budget}", { cost, budget: g.budgetUsd }), detail: cost > g.budgetUsd ? t("Over budget.") : t("Within budget.") });
  return out;
}

// ---- Repair agent: deterministic, at most N attempts ---------------------

/** How bad a set of checks is: a red counts more than any number of yellows a fix could add. */
const badness = (cs: Check[]) => cs.reduce((a, c) => a + (c.severity === "red" ? 100 : c.severity === "yellow" ? 1 : 0), 0);

/** Apply the verifier's fixes to get the design as good as possible. A small beam search over fix sequences: some fixes only
 *  help together (a stronger servo, then a bigger supply for it), and a fix that breaks another check (a stronger but
 *  slower motor that makes the speed red) loses to a better sequence. Deterministic: same design, same result. */
export function repair(g: DeviceGraph, max = 3) {
  type State = { graph: DeviceGraph; applied: string[]; score: number };
  const key = (x: DeviceGraph) => JSON.stringify([x.params, x.parts, x.circuit]);
  const start: State = { graph: g, applied: [], score: badness(verify(g)) };
  let best = start;
  let beam: State[] = [start];
  const seen = new Set([key(g)]);
  for (let depth = 0; depth < max && best.score > 0; depth++) {
    const next: State[] = [];
    for (const st of beam) {
      const cs = verify(st.graph);
      for (const c of cs.filter((x) => x.severity !== "green" && x.fix)) {
        const graph = c.fix!.apply(st.graph);
        const k = key(graph);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ graph, applied: [...st.applied, c.fix!.label], score: badness(verify(graph)) });
      }
    }
    if (!next.length) break;
    next.sort((a, b) => a.score - b.score || totalCost(a.graph) - totalCost(b.graph));
    beam = next.slice(0, 4);
    if (beam[0].score < best.score) best = beam[0];
  }
  return { graph: best.graph, applied: best.applied, status: overall(verify(best.graph)) };
}
