// Breadboard circuits: layout on a real hole grid, netlist extraction, electrical checks, assembly steps and firmware.
// Everything (3D, netlist, checks, BOM, steps, code) is derived from buildCircuit(), so they cannot disagree.
import { CATALOG, DeviceGraph, Check, Severity, ModuleKind, replaceKind, totalCost, modName, modShort } from "./deviceGraph";
import { t, tn } from "./i18n";
import { addExternalPsu, swapComp } from "./circuitEdit";

export type Preset = "led" | "button" | "distance" | "servo" | "traffic" | "doorbell" | "dimmer" | "parking" | "radar" | "night" | "thermo" | "fan" | "plant" | "alarm" | "weather" | "obstacle" | "line";
export const PRESETS: { id: Preset; label: string; blurb: string }[] = [
  { id: "led", label: "LED blink", blurb: "One pin, resistor and LED" },
  { id: "button", label: "Button + LED", blurb: "Input with internal pull-up" },
  { id: "distance", label: "Distance alarm", blurb: "HC-SR04 sensor and buzzer" },
  { id: "servo", label: "Servo + knob", blurb: "Potentiometer steers a servo" },
  { id: "traffic", label: "Traffic light", blurb: "Three LEDs in a timed sequence" },
  { id: "doorbell", label: "Doorbell", blurb: "A button sounds the buzzer" },
  { id: "dimmer", label: "Knob dimmer", blurb: "Potentiometer sets LED brightness (PWM)" },
  { id: "parking", label: "Parking sensor", blurb: "Beeps faster as an object gets closer" },
  { id: "radar", label: "Radar scanner", blurb: "Servo sweeps an ultrasonic sensor" },
  { id: "night", label: "Night light", blurb: "A light sensor turns an LED on in the dark" },
  { id: "thermo", label: "Thermometer", blurb: "TMP36 temperature on a 16×2 display" },
  { id: "fan", label: "Fan with a speed knob", blurb: "A knob sets a DC motor's speed (PWM)" },
  { id: "plant", label: "Plant watering alarm", blurb: "A soil sensor beeps when the plant is dry" },
  { id: "alarm", label: "Motion alarm", blurb: "A PIR sensor sounds the buzzer" },
  { id: "weather", label: "Weather station", blurb: "Temperature and light on a display" },
  { id: "obstacle", label: "Obstacle-avoiding robot", blurb: "Two motors and a distance sensor" },
  { id: "line", label: "Line follower", blurb: "Two light sensors steer two motors" },
];

// ---- breadboard geometry (mm, origin = board centre, Z up, board top at BB_Z) ------------------

export const PITCH = 2.54;
export const BB_Z = 8.5;
export const BB_DEPTH = 55; // y extent of the board
const ROW_Y: Record<string, number> = { a: 13.97, b: 11.43, c: 8.89, d: 6.35, e: 3.81, f: -3.81, g: -6.35, h: -8.89, i: -11.43, j: -13.97 };
const RAIL_Y: Record<string, number> = { TN: 23.0, TP: 20.4, BP: -20.4, BN: -23.0 };
export const railCount = (cols: number) => Math.round((cols * 5) / 6);
export const colX = (c: number, cols: number) => (c - (cols + 1) / 2) * PITCH;
export const railX = (k: number, cols: number) => (k - (railCount(cols) + 1) / 2) * PITCH;
export const boardHalfLength = (cols: number) => (cols * PITCH) / 2 + 3.5;
export const ROWS = Object.keys(ROW_Y);
export const RAILS = Object.keys(RAIL_Y);
export const holeXY = (c: number, r: string, cols: number): [number, number] => (r in RAIL_Y ? [railX(c, cols), RAIL_Y[r]] : [colX(c, cols), ROW_Y[r]]);
export const nodeOfHole = (c: number, r: string) => (r in RAIL_Y ? `r:${r}` : `h:${c}${r <= "e" ? "T" : "B"}`);

// ---- microcontroller boards -----------------------------------------------------------------------

export const MCU_DIMS: Record<string, { w: number; d: number }> = { "uno-r3": { w: 68.6, d: 53.3 }, "esp32-devkit": { w: 51.5, d: 28.6 } };
export const MCU_PIN_Z = 10.1;

function unoPins(): Record<string, [number, number]> {
  const p: Record<string, [number, number]> = {};
  ["SCL", "SDA", "AREF", "GND", "D13", "D12", "D11", "D10", "D9", "D8"].forEach((n, i) => (p[n] = [-26.5 + i * PITCH, 24.4]));
  ["D7", "D6", "D5", "D4", "D3", "D2", "D1", "D0"].forEach((n, i) => (p[n] = [2.9 + i * PITCH, 24.4]));
  ["NC", "IOREF", "RESET", "3V3", "5V", "GND_B", "GND_C", "VIN"].forEach((n, i) => (p[n] = [-10 + i * PITCH, -24.4]));
  ["A0", "A1", "A2", "A3", "A4", "A5"].forEach((n, i) => (p[n] = [12 + i * PITCH, -24.4]));
  return p;
}
function espPins(): Record<string, [number, number]> {
  const p: Record<string, [number, number]> = {};
  ["3V3", "GND", "G23", "G22", "G21", "G19", "G18", "G5", "G4", "G2", "G15"].forEach((n, i) => (p[n] = [-12.7 + i * PITCH, 12.7]));
  ["5V", "GND_B", "G13", "G12", "G14", "G27", "G26", "G25", "G33", "G32", "G35", "G34"].forEach((n, i) => (p[n] = [-14 + i * PITCH, -12.7]));
  return p;
}
export const MCU_PINS: Record<string, Record<string, [number, number]>> = { "uno-r3": unoPins(), "esp32-devkit": espPins() };
export const ROLE_PIN: Record<string, Record<string, string>> = {
  "uno-r3": { led: "D13", led2: "D12", led3: "D11", pwm: "D5", button: "D2", trig: "D9", echo: "D10", buzzer: "D8", servo: "D6", pot: "A0",
    light: "A1", temp: "A2", soil: "A3", light2: "A2", motion: "D7", motA: "D3", motB: "D4", mot2A: "D11", mot2B: "D12", sda: "SDA", scl: "SCL" },
  "esp32-devkit": { led: "G2", led2: "G15", led3: "G23", pwm: "G2", button: "G4", trig: "G5", echo: "G18", buzzer: "G19", servo: "G21", pot: "G34",
    light: "G35", temp: "G32", soil: "G33", light2: "G32", motion: "G27", motA: "G25", motB: "G26", mot2A: "G14", mot2B: "G13", sda: "G21", scl: "G22" },
};
export const LOGIC_PIN: Record<string, string> = { "uno-r3": "5V", "esp32-devkit": "3V3" };

// ---- the circuit -----------------------------------------------------------------------------------
// A circuit is a Layout: which hole each component sits in and where each jumper wire goes. Presets generate a
// layout; the editor edits it. resolveLayout() turns it into the netlist, so 3D, checks, BOM and code agree.

export type Ref = { t: "hole"; c: number; r: string } | { t: "mcu"; pin: string } | { t: "pin"; ref: string; pin: string };
export interface PlacedComp { ref: string; moduleId: string; c?: number; r?: string } // c/r = anchor hole (on-board parts only)
export interface PlacedWire { color: string; a: Ref; b: Ref }
export interface Layout { comps: PlacedComp[]; wires: PlacedWire[] }

export interface Endpoint { node: string; x: number; y: number; z: number; label: string; hole?: { c: number; r: string } }
export interface CircuitPin { name: string; node: string; x: number; y: number }
export interface CircuitComp { ref: string; moduleId: string; kind: ModuleKind; label: string; pins: CircuitPin[]; center: [number, number]; offBoard?: boolean }
export interface CircuitWire { id: string; color: string; a: Endpoint; b: Endpoint }
export interface Net { name: string; nodes: string[]; items: string[] }
export interface Circuit {
  preset: Preset; cols: number; mcuId: string; mcuCenter: [number, number]; roles: Record<string, string>; ext: boolean;
  comps: CircuitComp[]; wires: CircuitWire[]; nets: Net[]; netOf: (node: string) => number;
}

const ORANGE = "#f97316", RED = "#ef4444", BLACK = "#27272a", YELLOW = "#eab308", BLUE = "#3b82f6", GREEN = "#22c55e";
export const WIRE_COLORS = [RED, BLACK, ORANGE, YELLOW, BLUE, GREEN];
export const WIRE_NAME: Record<string, string> = { [ORANGE]: "orange", [RED]: "red", [BLACK]: "black", [YELLOW]: "yellow", [BLUE]: "blue", [GREEN]: "green" };

/** Leg layout of every on-board part: column offset from the anchor, and a fixed row where the part straddles the channel. */
interface FootPin { name: string; dc: number; row?: string }
export const FOOT: Partial<Record<ModuleKind, { pins: FootPin[]; links?: [string, string][] }>> = {
  resistor: { pins: [{ name: "1", dc: 0 }, { name: "2", dc: 4 }] },
  led: { pins: [{ name: "A", dc: 0 }, { name: "K", dc: 1 }] },
  button: { pins: [{ name: "1", dc: 0, row: "e" }, { name: "2", dc: 2, row: "e" }, { name: "3", dc: 0, row: "f" }, { name: "4", dc: 2, row: "f" }], links: [["1", "3"], ["2", "4"]] },
  pot: { pins: [{ name: "1", dc: 0 }, { name: "W", dc: 1 }, { name: "3", dc: 2 }] },
  buzzer: { pins: [{ name: "+", dc: 0 }, { name: "−", dc: 2 }] },
  sensor: { pins: [{ name: "VCC", dc: 0 }, { name: "TRIG", dc: 1 }, { name: "ECHO", dc: 2 }, { name: "GND", dc: 3 }] },
  module: { pins: [{ name: "VCC", dc: 0 }, { name: "OUT", dc: 1 }, { name: "GND", dc: 2 }] },
};
export const OFFBOARD: ModuleKind[] = ["actuator", "psu", "motor", "display"];
/** How many of an off-board kind (or the knob) fit in one circuit. */
export const MAX_OF: Partial<Record<ModuleKind, number>> = { actuator: 1, psu: 1, pot: 1, display: 1, motor: 2 };
export const REF_PREFIX: Partial<Record<ModuleKind, string>> = { resistor: "R", led: "LED", button: "SW", pot: "RV", buzzer: "BZ", sensor: "U", actuator: "M", psu: "PS", module: "S", motor: "MD", display: "LCD" };
/** Pins of the off-board parts that have several (a motor driver, the display), named as printed on them. */
export const MOTOR_PINS = ["IA", "IB", "VCC", "GND"] as const;
export const DISPLAY_PINS = ["GND", "VCC", "SDA", "SCL"] as const;

export const validHole = (c: number, r: string, cols: number) =>
  Number.isInteger(c) && (r in RAIL_Y ? c >= 1 && c <= railCount(cols) && c % 6 !== 0 : r in ROW_Y && c >= 1 && c <= cols);

/** Rows a leg may use: legs of one part share a row, so pick the row from the clicked hole. */
export const footHoles = (kind: ModuleKind, c: number, r: string): { name: string; c: number; r: string }[] =>
  (FOOT[kind]?.pins ?? []).map((p) => ({ name: p.name, c: c + p.dc, r: p.row ?? r }));

const ohmLabel = (id: string) => (CATALOG[id].ohm! >= 1000 ? `${CATALOG[id].ohm! / 1000} kΩ` : `${CATALOG[id].ohm} Ω`);
const MODULE_SHORT: Record<string, string> = { "light-module": "LDR", tmp36: "TMP36", "soil-module": "Soil", "pir-module": "PIR" };
const compLabel = (ref: string, id: string) => {
  const k = CATALOG[id].kind;
  return k === "resistor" ? `${ref} ${ohmLabel(id)}` : k === "pot" ? `${ref} 10 kΩ` : k === "sensor" ? `${ref} HC-SR04` : k === "actuator" ? `${ref} SG90` : k === "psu" ? `${ref} 5 V / 2 A`
    : k === "module" ? `${ref} ${MODULE_SHORT[id] ?? ""}`.trim() : k === "motor" ? `${ref} DC` : k === "display" ? `${ref} 16×2` : ref;
};

/** The starter circuit for a preset, as an editable layout. */
/** One block of a kit: a part (with its resistor for an LED) and the board pin role it is wired to. */
export type KitItem =
  | { block: "led"; role: "led" | "led2" | "led3" | "pwm"; id?: string }
  | { block: "button" } | { block: "sonar" } | { block: "buzzer" } | { block: "pot" } | { block: "servo" } | { block: "lcd" }
  | { block: "module"; id: string; role: "light" | "light2" | "temp" | "soil" | "motion" }
  | { block: "motor"; second?: boolean };

/** The parts a kit needs (the board and breadboard come from the graph). */
export function kitParts(items: KitItem[], resistor = "res-220"): string[] {
  return items.flatMap((k) => {
    switch (k.block) {
      case "led": return [k.id ?? "led-red", resistor];
      case "button": return ["btn-6mm"];
      case "sonar": return ["hcsr04"];
      case "buzzer": return ["buzzer-act"];
      case "pot": return ["pot-10k"];
      case "servo": return ["servo-sg90"];
      case "lcd": return ["lcd-1602"];
      case "module": return [k.id];
      case "motor": return ["dc-motor"];
    }
  });
}

export function presetLayout(g: DeviceGraph): Layout {
  const preset = g.circuit?.preset ?? "led";
  const pick = (kind: ModuleKind) => g.parts.find((p) => CATALOG[p.moduleId].kind === kind)?.moduleId;
  const mcuId = pick("mcu") ?? "uno-r3";
  const ledId = pick("led") ?? "led-red";
  const resId = pick("resistor") ?? "res-220";
  const ext = g.parts.some((p) => CATALOG[p.moduleId].kind === "psu");
  const roles = ROLE_PIN[mcuId] ?? ROLE_PIN["uno-r3"];
  const comps: PlacedComp[] = [];
  const wires: PlacedWire[] = [];
  const used = { TN: false, TP: false, BP: false };
  const h = (c: number, r: string): Ref => ({ t: "hole", c, r });
  // rail holes skip every sixth position and end before the board does
  const railHole = (k: number) => { const max = railCount(CATALOG[pick("base") ?? "bb-half"]?.cols ?? 30); let x = Math.min(k, max); if (x % 6 === 0) x = x === max ? x - 1 : x + 1; return x; };
  const rail = (name: "TN" | "TP" | "BP", k: number): Ref => { used[name] = true; return h(railHole(k), name); };
  const mcu = (pin: string): Ref => ({ t: "mcu", pin });
  const pin = (ref: string, p: string): Ref => ({ t: "pin", ref, pin: p });
  const wire = (a: Ref, b: Ref, color: string) => wires.push({ a, b, color });

  const ledBlock = (c0: number, idx: number, role = "led", led = ledId, color = ORANGE) => {
    comps.push({ ref: `R${idx}`, moduleId: resId, c: c0, r: "e" }, { ref: `LED${idx}`, moduleId: led, c: c0 + 4, r: "d" });
    wire(mcu(roles[role]), h(c0, "a"), color);
    wire(h(c0 + 5, "a"), rail("TN", c0 + 5), BLACK);
  };
  const sonarBlock = (c0: number) => {
    if (!sensorId) return;
    comps.push({ ref: "U2", moduleId: sensorId, c: c0, r: "e" });
    wire(h(c0, "a"), rail("TP", c0), RED);
    wire(mcu(roles.trig), h(c0 + 1, "a"), ORANGE);
    wire(h(c0 + 2, "a"), mcu(roles.echo), YELLOW);
    wire(h(c0 + 3, "a"), rail("TN", c0 + 3), BLACK);
  };
  const buzzerBlock = (c0: number, railK: number) => {
    if (!buzzId) return;
    comps.push({ ref: "BZ1", moduleId: buzzId, c: c0, r: "e" });
    wire(mcu(roles.buzzer), h(c0, "a"), BLUE);
    wire(h(c0 + 2, "a"), rail("TN", railK), BLACK);
  };
  const potBlock = (c0: number) => {
    if (!potId) return;
    comps.push({ ref: "RV1", moduleId: potId, c: c0, r: "e" });
    wire(h(c0, "a"), rail("TN", c0), BLACK);
    wire(h(c0 + 1, "a"), mcu(roles.pot), YELLOW);
    wire(h(c0 + 2, "a"), rail(logicRail as "TP" | "BP", c0 + 3), RED);
  };
  const sensorId = pick("sensor"), buzzId = pick("buzzer"), potId = pick("pot"), servoId = pick("actuator"), btnId = pick("button");
  const logicRail = LOGIC_PIN[mcuId] === "5V" ? "TP" : "BP";
  const modules = g.parts.filter((p) => CATALOG[p.moduleId].kind === "module").flatMap((p) => Array(p.qty).fill(p.moduleId) as string[]);
  /** a 3-pin sensor module: VCC to the logic rail (a PIR needs 5 V), OUT to its pin, GND to the − rail */
  const moduleBlock = (c0: number, idx: number, id: string, role: string) => {
    comps.push({ ref: `S${idx}`, moduleId: id, c: c0, r: "e" });
    wire(h(c0, "a"), id === "pir-module" ? rail("TP", c0) : rail(logicRail as "TP" | "BP", c0), RED);
    wire(h(c0 + 1, "a"), mcu(roles[role]), YELLOW);
    wire(h(c0 + 2, "a"), rail("TN", c0 + 2), BLACK);
  };
  /** a DC motor on its driver board, beside the breadboard: IA/IB from two pins, power from the 5 V rail or the external supply */
  const motorBlock = (idx: number, a: string, b: string) => {
    const ref = `MD${idx + 1}`;
    comps.push({ ref, moduleId: "dc-motor" });
    wire(mcu(roles[a]), pin(ref, "IA"), idx ? BLUE : ORANGE);
    wire(mcu(roles[b]), pin(ref, "IB"), idx ? GREEN : YELLOW);
    if (ext) wire(pin("PS1", "+"), pin(ref, "VCC"), RED); else wire(rail("TP", 20 + idx * 2), pin(ref, "VCC"), RED);
    wire(pin(ref, "GND"), rail("TN", 21 + idx * 2), BLACK);
  };
  const lcdBlock = () => {
    comps.push({ ref: "LCD1", moduleId: "lcd-1602" });
    wire(pin("LCD1", "GND"), rail("TN", 1), BLACK);
    wire(pin("LCD1", "VCC"), rail("TP", 1), RED);
    wire(pin("LCD1", "SDA"), mcu(roles.sda), BLUE);
    wire(pin("LCD1", "SCL"), mcu(roles.scl), YELLOW);
  };
  const extSupply = () => {
    if (!ext) return;
    comps.push({ ref: "PS1", moduleId: pick("psu")! });
    wire(pin("PS1", "−"), rail("TN", 25), BLACK);
  };

  const kit = g.circuit?.kit;
  if (kit) {
    // lay the kit's blocks out left to right, each in its own columns
    const width = { led: 7, button: 4, sonar: 5, buzzer: 4, pot: 4, module: 4 } as Record<string, number>;
    let col = 2, leds = 0, mods = 0;
    if (kit.some((k) => k.block === "servo" || k.block === "motor")) extSupply();
    for (const k of kit) {
      if (k.block === "led") { leds++; const ledOf = k.id ?? ledId; ledBlock(col, leds, k.role, ledOf, k.role === "led2" ? YELLOW : k.role === "led3" ? GREEN : ORANGE); }
      else if (k.block === "button" && btnId) { comps.push({ ref: "SW1", moduleId: btnId, c: col, r: "e" }); wire(mcu(roles.button), h(col, "a"), ORANGE); wire(h(col + 2, "a"), rail("TN", col + 2), BLACK); }
      else if (k.block === "sonar") sonarBlock(col);
      else if (k.block === "buzzer") buzzerBlock(col, col + 3);
      else if (k.block === "pot") potBlock(col);
      else if (k.block === "module") moduleBlock(col, ++mods, k.id, k.role);
      else if (k.block === "motor") motorBlock(k.second ? 1 : 0, k.second ? "mot2A" : "motA", k.second ? "mot2B" : "motB");
      else if (k.block === "lcd") lcdBlock();
      else if (k.block === "servo" && servoId) {
        comps.push({ ref: "M1", moduleId: servoId });
        wire(mcu(roles.servo), pin("M1", "SIG"), ORANGE);
        wire(pin("M1", "GND"), rail("TN", 19), BLACK);
        if (ext) wire(pin("PS1", "+"), pin("M1", "VCC"), RED); else wire(rail("TP", 19), pin("M1", "VCC"), RED);
      }
      col += width[k.block] ?? 0;
    }
  } else if (preset === "led") {
    ledBlock(10, 1);
  } else if (preset === "button") {
    ledBlock(5, 1);
    if (btnId) {
      comps.push({ ref: "SW1", moduleId: btnId, c: 20, r: "e" });
      wire(mcu(roles.button), h(20, "a"), ORANGE);
      wire(h(22, "a"), rail("TN", 22), BLACK);
    }
  } else if (preset === "traffic") {
    ledBlock(2, 1, "led", "led-red");
    ledBlock(10, 2, "led2", "led-yellow", YELLOW);
    ledBlock(17, 3, "led3", "led-green", GREEN);
  } else if (preset === "doorbell") {
    if (btnId) {
      comps.push({ ref: "SW1", moduleId: btnId, c: 8, r: "e" });
      wire(mcu(roles.button), h(8, "a"), ORANGE);
      wire(h(10, "a"), rail("TN", 10), BLACK);
    }
    buzzerBlock(20, 23);
  } else if (preset === "dimmer") {
    potBlock(7);
    ledBlock(17, 1, "pwm");
  } else if (preset === "distance") {
    sonarBlock(8);
    buzzerBlock(22, 25);
  } else if (preset === "parking") {
    sonarBlock(5);
    ledBlock(11, 1);
    buzzerBlock(20, 23);
  } else if (preset === "night") {
    moduleBlock(5, 1, modules[0] ?? "light-module", "light");
    ledBlock(14, 1);
  } else if (preset === "thermo") {
    moduleBlock(8, 1, modules[0] ?? "tmp36", "temp");
    lcdBlock();
  } else if (preset === "weather") {
    moduleBlock(5, 1, modules.find((x) => x === "tmp36") ?? "tmp36", "temp");
    moduleBlock(12, 2, modules.find((x) => x === "light-module") ?? "light-module", "light");
    lcdBlock();
  } else if (preset === "plant") {
    moduleBlock(5, 1, modules[0] ?? "soil-module", "soil");
    ledBlock(11, 1);
    buzzerBlock(20, 23);
  } else if (preset === "alarm") {
    moduleBlock(5, 1, modules[0] ?? "pir-module", "motion");
    ledBlock(11, 1);
    buzzerBlock(20, 23);
  } else if (preset === "fan") {
    extSupply();
    potBlock(7);
    motorBlock(0, "motA", "motB");
  } else if (preset === "obstacle") {
    extSupply();
    sonarBlock(8);
    motorBlock(0, "motA", "motB");
    motorBlock(1, "mot2A", "mot2B");
  } else if (preset === "line") {
    extSupply();
    moduleBlock(4, 1, "light-module", "light");
    moduleBlock(12, 2, "light-module", "light2");
    motorBlock(0, "motA", "motB");
    motorBlock(1, "mot2A", "mot2B");
  } else {
    // servo (knob-steered) and radar (sonar on a sweeping servo) share the servo branch
    if (preset === "radar") sonarBlock(7);
    else potBlock(10);
    if (servoId) {
      comps.push({ ref: "M1", moduleId: servoId });
      wire(mcu(roles.servo), pin("M1", "SIG"), ORANGE);
      wire(pin("M1", "GND"), rail("TN", 20), BLACK);
      if (ext) {
        comps.push({ ref: "PS1", moduleId: pick("psu")! });
        wire(pin("PS1", "+"), pin("M1", "VCC"), RED);
        wire(pin("PS1", "−"), rail("TN", 22), BLACK);
      } else {
        wire(rail("TP", 21), pin("M1", "VCC"), RED);
      }
    }
  }
  // power rails are fed from the MCU
  wire(mcu("GND"), rail("TN", 3), BLACK);
  if (used.TP) wire(mcu("5V"), h(3, "TP"), RED);
  if (used.BP) wire(mcu(LOGIC_PIN[mcuId]), h(5, "BP"), RED);
  return { comps, wires };
}

/** The layout in force: an edited one, else the preset's starter circuit. */
export const layoutOf = (g: DeviceGraph): Layout => g.circuit?.layout ?? presetLayout(g);

export function buildCircuit(g: DeviceGraph): Circuit {
  const layout = layoutOf(g);
  const preset = g.circuit?.preset ?? "led";
  const pick = (kind: ModuleKind) => g.parts.find((p) => CATALOG[p.moduleId].kind === kind)?.moduleId;
  const mcuId = pick("mcu") ?? "uno-r3";
  const boardId = pick("base") ?? "bb-half";
  const cols = CATALOG[boardId].cols ?? 30;
  const ext = g.parts.some((p) => CATALOG[p.moduleId].kind === "psu") || layout.comps.some((p) => CATALOG[p.moduleId]?.kind === "psu");
  const dims = MCU_DIMS[mcuId] ?? MCU_DIMS["uno-r3"];
  const mcuCenter: [number, number] = [0, -(BB_DEPTH / 2 + 5 + dims.d / 2)];
  const pins = MCU_PINS[mcuId] ?? MCU_PINS["uno-r3"];
  const roles = ROLE_PIN[mcuId] ?? ROLE_PIN["uno-r3"];

  const comps: CircuitComp[] = [];
  const wires: CircuitWire[] = [];
  const hole = (c: number, r: string): Endpoint => { const [x, y] = holeXY(c, r, cols); return { node: nodeOfHole(c, r), x, y, z: BB_Z, label: r in RAIL_Y ? t(r === "TN" || r === "BN" ? "− rail" : "+ rail") : `${c}${r}`, hole: { c, r } }; };
  const mcu = (pin: string): Endpoint => { const [lx, ly] = pins[pin]; return { node: `m:${pin}`, x: mcuCenter[0] + lx, y: mcuCenter[1] + ly, z: MCU_PIN_Z, label: pin }; };
  const links: [string, string][] = []; // internal connections inside components

  // components first, so wires can attach to the off-board ones
  const bh = boardHalfLength(cols);
  const sx = bh + 8;
  let motors = 0;
  for (const pc of layout.comps) {
    const mod = CATALOG[pc.moduleId];
    if (!mod) continue;
    if (mod.kind === "motor") {
      // beside the board, below the servo's place: the driver's four pins face the breadboard
      const cy = -26 - motors++ * 24;
      const mp = MOTOR_PINS.map((name, i) => ({ name, node: `o:${pc.ref}:${name}`, x: sx, y: cy + (1.5 - i) * PITCH }));
      comps.push({ ref: pc.ref, moduleId: pc.moduleId, kind: "motor", label: compLabel(pc.ref, pc.moduleId), pins: mp, center: [bh + 34, cy], offBoard: true });
    } else if (mod.kind === "display") {
      // on the other side of the board
      const dp = DISPLAY_PINS.map((name, i) => ({ name, node: `o:${pc.ref}:${name}`, x: -sx, y: (1.5 - i) * PITCH }));
      comps.push({ ref: pc.ref, moduleId: pc.moduleId, kind: "display", label: compLabel(pc.ref, pc.moduleId), pins: dp, center: [-bh - 44, 0], offBoard: true });
    } else if (mod.kind === "actuator") {
      const sp = [{ name: "GND", node: "s:GND", x: sx, y: -PITCH }, { name: "VCC", node: "s:VCC", x: sx, y: 0 }, { name: "SIG", node: "s:SIG", x: sx, y: PITCH }];
      comps.push({ ref: pc.ref, moduleId: pc.moduleId, kind: "actuator", label: compLabel(pc.ref, pc.moduleId), pins: sp, center: [bh + 34, 0], offBoard: true });
    } else if (mod.kind === "psu") {
      const tp = [{ name: "+", node: "p:+", x: sx + 6, y: 36 }, { name: "−", node: "p:-", x: sx + 6, y: 41 }];
      comps.push({ ref: pc.ref, moduleId: pc.moduleId, kind: "psu", label: compLabel(pc.ref, pc.moduleId), pins: tp, center: [bh + 24, 38], offBoard: true });
    } else if (FOOT[mod.kind] && pc.c !== undefined && pc.r) {
      const hs = footHoles(mod.kind, pc.c, pc.r);
      if (!hs.every((p) => validHole(p.c, p.r, cols))) continue;
      const ps: CircuitPin[] = hs.map((p) => { const [x, y] = holeXY(p.c, p.r, cols); return { name: p.name, node: nodeOfHole(p.c, p.r), x, y }; });
      const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
      comps.push({ ref: pc.ref, moduleId: pc.moduleId, kind: mod.kind, label: compLabel(pc.ref, pc.moduleId), pins: ps, center: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] });
      for (const [a, b] of FOOT[mod.kind]!.links ?? []) links.push([ps.find((p) => p.name === a)!.node, ps.find((p) => p.name === b)!.node]);
    }
  }

  const endpoint = (r: Ref): Endpoint | null => {
    if (r.t === "hole") return validHole(r.c, r.r, cols) ? hole(r.c, r.r) : null;
    if (r.t === "mcu") return r.pin in pins ? mcu(r.pin) : null;
    const comp = comps.find((x) => x.ref === r.ref && x.offBoard);
    const p = comp?.pins.find((x) => x.name === r.pin);
    if (!comp || !p) return null;
    const label = comp.kind === "actuator" ? ({ GND: t("servo GND"), VCC: t("servo VCC"), SIG: t("servo SIG") } as Record<string, string>)[p.name] : `${comp.ref} ${p.name}`;
    return { node: p.node, x: p.x, y: p.y, z: comp.kind === "psu" ? 18 : 10, label };
  };
  for (const pw of layout.wires) {
    const a = endpoint(pw.a), b = endpoint(pw.b);
    if (a && b) wires.push({ id: `W${wires.length + 1}`, color: pw.color, a, b });
  }

  // ---- netlist by union-find ----
  const parent = new Map<string, string>();
  const find = (a: string): string => { if (!parent.has(a)) parent.set(a, a); let r = a; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(a, r); return r; };
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  wires.forEach((w) => union(w.a.node, w.b.node));
  links.forEach(([a, b]) => union(a, b));
  Object.keys(pins).filter((n) => n.startsWith("GND")).forEach((n) => union(`m:${n}`, "m:GND"));
  comps.forEach((c) => c.pins.forEach((p) => find(p.node)));
  wires.forEach((w) => { find(w.a.node); find(w.b.node); });

  const group = new Map<string, { nodes: Set<string>; items: Set<string> }>();
  const add = (node: string, item?: string) => {
    const r = find(node);
    if (!group.has(r)) group.set(r, { nodes: new Set(), items: new Set() });
    group.get(r)!.nodes.add(node);
    if (item) group.get(r)!.items.add(item);
  };
  comps.forEach((c) => c.pins.forEach((p) => add(p.node, `${c.ref}.${p.name}`)));
  wires.forEach((w) => [w.a, w.b].forEach((e) => add(e.node, e.node.startsWith("m:") ? `U1.${e.node.slice(2)}` : undefined)));
  const nets: Net[] = [];
  const index = new Map<string, number>();
  let anon = 1;
  for (const [root, gr] of group) {
    const items = [...gr.items].sort();
    const nodes = [...gr.nodes];
    const has = (n: string) => nodes.includes(n);
    const name = has("m:GND") ? "GND" : has("m:5V") ? "5V" : has("m:3V3") ? "3V3" : has("p:+") ? "5V EXT" : nodes.find((n) => n.startsWith("m:")) ? nodes.find((n) => n.startsWith("m:"))!.slice(2) : `N${anon++}`;
    index.set(root, nets.length);
    nets.push({ name, nodes, items });
  }
  const netOf = (node: string) => index.get(find(node)) ?? -1;
  return { preset, cols, mcuId, mcuCenter, roles, ext, comps, wires, nets, netOf };
}

export const jumperCount = (g: DeviceGraph) => buildCircuit(g).wires.length;

// ---- electrical analysis ------------------------------------------------------------------------------

export interface LedInfo { ref: string; resRef?: string; moduleId: string; vs: number; r: number | null; i: number; limit: number; grounded: boolean }
export interface Analysis {
  c: Circuit; leds: LedInfo[]; typMa: number; peakMa: number; usbMa: number; extPsu: boolean;
  logic: { what: string; level: number; limit: number }[]; overload: { what: string; ma: number; limit: number }[];
  shorts: string[]; floating: string[]; buttonPullup: boolean;
}

export function analyze(g: DeviceGraph): Analysis {
  const c = buildCircuit(g);
  const mcu = CATALOG[c.mcuId];
  const logicV = mcu.logicV ?? 5;
  const gpioLimit = mcu.pinMa ?? 20;
  const isGpio = (n: string) => n.startsWith("m:") && !/^m:(GND|5V|3V3|VIN|NC|IOREF|RESET|AREF)/.test(n);
  const nodesOf = (node: string) => c.nets[c.netOf(node)]?.nodes ?? [];

  const leds: LedInfo[] = c.comps.filter((x) => x.kind === "led").map((led) => {
    const anode = led.pins[0].node, cathode = led.pins[1].node;
    const aNet = nodesOf(anode);
    // series resistor: a resistor pin in the anode net, other pin leads to the source
    let r: number | null = null, vs = logicV, resRef: string | undefined;
    // only a real series resistor counts: the anode must not be driven directly, and the far end must reach the source
    const anodeDriven = aNet.some((n) => n.startsWith("m:"));
    for (const res of anodeDriven ? [] : c.comps.filter((x) => x.kind === "resistor")) {
      const near = res.pins.find((p) => aNet.includes(p.node));
      if (!near) continue;
      const far = res.pins.find((p) => p !== near)!;
      if (!nodesOf(far.node).some((n) => n.startsWith("m:"))) continue;
      r = CATALOG[res.moduleId].ohm ?? null;
      resRef = res.ref;
      const far_ = nodesOf(far.node);
      vs = far_.some((n) => n === "m:5V") ? 5 : far_.some((n) => n === "m:3V3") ? 3.3 : logicV;
    }
    let grounded = nodesOf(cathode).includes("m:GND");
    if (!resRef && !grounded) {
      // series resistor on the cathode side is just as valid: cathode net -> resistor -> GND
      const cNet = nodesOf(cathode);
      for (const res of c.comps.filter((x) => x.kind === "resistor")) {
        const near = res.pins.find((p) => cNet.includes(p.node));
        const far = near && res.pins.find((p) => p !== near);
        if (!far || !nodesOf(far.node).includes("m:GND")) continue;
        r = CATALOG[res.moduleId].ohm ?? null; resRef = res.ref; grounded = true;
        vs = aNet.includes("m:5V") ? 5 : aNet.includes("m:3V3") ? 3.3 : logicV;
      }
    }
    const lm = CATALOG[led.moduleId];
    const i = r ? Math.max(0, (vs - (lm.vf ?? 2)) / r) * 1000 : 0;
    return { ref: led.ref, resRef, moduleId: led.moduleId, vs, r, i, limit: Math.min(lm.maxMa ?? 20, gpioLimit), grounded };
  });

  const logic: Analysis["logic"] = [];
  const overload: Analysis["overload"] = [];
  const sensor = c.comps.find((x) => x.kind === "sensor");
  if (sensor) {
    const sm = CATALOG[sensor.moduleId];
    const echo = sensor.pins.find((p) => p.name === "ECHO");
    if (echo && nodesOf(echo.node).some(isGpio) && (sm.outV ?? 0) > logicV + 0.3) logic.push({ what: t("{ref} ECHO ({v} V) → MCU input ({lv} V)", { ref: sensor.ref, v: sm.outV!, lv: logicV }), level: sm.outV!, limit: logicV });
  }
  const buzzer = c.comps.find((x) => x.kind === "buzzer");
  if (buzzer) {
    const ma = (CATALOG[buzzer.moduleId].currentA ?? 0) * 1000;
    if (ma > gpioLimit) overload.push({ what: t("{ref} driven directly from a GPIO", { ref: buzzer.ref }), ma, limit: gpioLimit });
  }

  // 3-pin modules: an output above the board's logic level (a module on the 5 V rail of a 3.3 V board) is unsafe
  for (const m of c.comps.filter((x) => x.kind === "module")) {
    const out = m.pins.find((p) => p.name === "OUT")!, vcc = m.pins.find((p) => p.name === "VCC")!;
    const supply = nodesOf(vcc.node).includes("m:5V") || nodesOf(vcc.node).includes("p:+") ? 5 : 3.3;
    const level = Math.min(supply, CATALOG[m.moduleId].outV ?? supply);
    if (nodesOf(out.node).some(isGpio) && level > logicV + 0.3) logic.push({ what: t("{ref} OUT ({v} V) → MCU input ({lv} V)", { ref: m.ref, v: level, lv: logicV }), level, limit: logicV });
  }
  const motors = c.comps.filter((x) => x.kind === "motor");
  const motorsOnUsb = motors.filter((m) => !nodesOf(m.pins.find((p) => p.name === "VCC")!.node).includes("p:+"));
  const display = c.comps.find((x) => x.kind === "display");
  const moduleMa = c.comps.filter((x) => x.kind === "module").reduce((a, m) => a + (CATALOG[m.moduleId].currentA ?? 0) * 1000, 0) + (display ? (CATALOG[display.moduleId].currentA ?? 0) * 1000 : 0);
  const servo = c.comps.find((x) => x.kind === "actuator");
  const ledOn = leds.reduce((s, l) => s + l.i, 0);
  const base = (mcu.mcuMa ?? 50) + ledOn + (sensor ? (CATALOG[sensor.moduleId].currentA ?? 0) * 1000 : 0) + (buzzer ? (CATALOG[buzzer.moduleId].currentA ?? 0) * 1000 : 0);
  const sv = servo ? CATALOG[servo.moduleId] : undefined;
  // the motor only counts as externally powered when its supply pin is actually wired to the supply
  const servoOnPsu = servo ? nodesOf("s:VCC").includes("p:+") : c.ext;
  const motorTyp = motorsOnUsb.reduce((a, m) => a + (CATALOG[m.moduleId].currentA ?? 0) * 1000, 0);
  const motorPeak = motorsOnUsb.reduce((a, m) => a + (CATALOG[m.moduleId].stallMa ?? 0), 0);
  const typMa = base + moduleMa + motorTyp + (sv && !servoOnPsu ? (sv.currentA ?? 0) * 1000 : 0);
  const peakMa = base + moduleMa + motorPeak + (sv && !servoOnPsu ? sv.stallMa ?? 0 : 0);

  const shorts: string[] = [], floating: string[] = [];
  c.nets.forEach((n) => {
    const hasGnd = n.nodes.some((x) => x.startsWith("m:GND")), hasPwr = n.nodes.some((x) => x === "m:5V" || x === "m:3V3" || x === "p:+");
    if (hasGnd && hasPwr) shorts.push(n.name);
    if (n.items.length < 2 && !n.nodes.some((x) => x.startsWith("m:"))) floating.push(n.items[0] ?? n.name);
  });
  return { c, leds, typMa, peakMa, usbMa: mcu.usbMa ?? 500, extPsu: servoOnPsu, logic, overload, shorts, floating, buttonPullup: c.comps.some((x) => x.kind === "button") };
}

const STD_R = ["res-100", "res-220", "res-330", "res-470", "res-1k", "res-10k"];

export function verifyBreadboard(g: DeviceGraph): Check[] {
  const out: Check[] = [];
  const a = analyze(g);
  const mcuId = a.c.mcuId;

  for (const l of a.leds) {
    const lm = CATALOG[l.moduleId];
    const sev: Severity = !l.r ? "red" : l.i > l.limit ? "red" : l.i > l.limit * 0.9 ? "yellow" : l.i < 2 ? "yellow" : "green";
    const best = STD_R.find((id) => {
      const rr = CATALOG[id].ohm!;
      const i = ((l.vs - (lm.vf ?? 2)) / rr) * 1000;
      return i <= l.limit * 0.8 && i >= 2;
    });
    out.push({
      id: `led-${l.ref}`, basis: "calc", category: "Electrics", severity: sev, focus: l.moduleId,
      title: t("{ref}: {i} mA through the LED (limit {limit} mA)", { ref: l.ref, i: l.i.toFixed(1), limit: l.limit }),
      detail: sev === "green" ? t("Safe and clearly lit.") : l.i > l.limit ? t("Too much current: the LED or the MCU pin will be damaged.") : l.i < 2 ? t("Too dim to see well.") : t("Close to the limit — little margin."),
      why: t("I = (Vsupply − Vf) / R = ({vs} V − {vf} V) / {r} Ω = {i} mA. Limit = min(LED {lmax} mA, MCU pin {pin} mA) = {limit} mA.", { vs: l.vs, vf: lm.vf!, r: l.r ?? "—", i: l.i.toFixed(1), lmax: lm.maxMa!, pin: CATALOG[mcuId].pinMa!, limit: l.limit }),
      fix: sev === "green" || !best ? undefined : { label: t("Use {name}", { name: modName(best) }), apply: (x) => (l.resRef ? swapComp(x, l.resRef, best) : replaceKind(x, best)) },
    });
    if (!l.grounded) out.push({ id: `gnd-${l.ref}`, basis: "calc", category: "Electrics", severity: "red", title: t("{ref} cathode is not connected to GND", { ref: l.ref }), detail: t("The circuit is open.") });
  }

  for (const lg of a.logic)
    out.push({
      id: "logic", basis: "calc", category: "Electrics", severity: "red", focus: "hcsr04",
      title: t("5 V signal into a 3.3 V pin"), detail: lg.what + ". " + t("This can damage the ESP32."),
      why: t("HC-SR04 ECHO drives {v} V, the ESP32 GPIO tolerates {limit} V. Use a level shifter / divider, or a 5 V board.", { v: lg.level, limit: lg.limit }),
      fix: { label: t("Use Arduino Uno (5 V)"), apply: (x) => replaceKind(x, "uno-r3") },
    });
  for (const o of a.overload)
    out.push({
      id: "overload", basis: "calc", category: "Electrics", severity: "red", focus: "buzzer-act",
      title: t("GPIO overloaded: {ma} mA > {limit} mA", { ma: o.ma, limit: o.limit }), detail: o.what + ".",
      why: t("The buzzer draws about {ma} mA, but one {board} pin should supply at most {limit} mA.", { ma: o.ma, board: modShort(mcuId), limit: o.limit }),
      fix: mcuId === "uno-r3" ? undefined : { label: t("Use Arduino Uno (5 V)"), apply: (x) => replaceKind(x, "uno-r3") },
    });

  // Judge the normal case (servo moving, no load). A stall is a rare worst case: report it, don't fail the design for it.
  const servo = a.c.comps.find((x) => x.kind === "actuator");
  const sv = servo ? CATALOG[servo.moduleId] : undefined;
  const power: Severity = a.typMa > a.usbMa ? "red" : a.typMa > a.usbMa * 0.8 ? "yellow" : "green";
  const stallRisk = power === "green" && !a.extPsu && a.peakMa > a.usbMa;
  out.push({
    id: "power", basis: "estimate", category: "Electrics", severity: power, focus: "servo-sg90",
    title: t("USB power: {typ} mA typical, {peak} mA peak / {usb} mA", { typ: Math.round(a.typMa), peak: Math.round(a.peakMa), usb: a.usbMa }),
    detail: power === "red" ? t("Even in normal use this needs more than USB provides. The board will reset or misbehave.")
      : power === "yellow" ? t("Normal use is close to the USB limit. The board may reset when the motor starts.")
      : stallRisk ? t("Fine for normal use. If the servo carries a load or stalls it can briefly draw more than USB provides; add a supply if that can happen.")
      : a.extPsu ? t("Motor runs from the external supply.") : t("Within the USB budget."),
    why: servo
      ? t("Typical = board + LED + sensor + buzzer + servo moving without load ({sv} mA). Peak adds the servo stalled ({stall} mA). USB provides {usb} mA. Values are catalog estimates.", { sv: Math.round((sv?.currentA ?? 0) * 1000), stall: sv?.stallMa ?? 0, usb: a.usbMa })
      : t("Sum of board + LED + sensor + buzzer. USB provides {usb} mA.", { usb: a.usbMa }),
    fix: power === "green" && !stallRisk ? undefined : { label: stallRisk ? t("Add external 5 V supply (optional)") : t("Add external 5 V supply"), apply: (x) => (x.circuit?.layout ? addExternalPsu(x) : { ...x, version: x.version + 1, parts: [...x.parts, { moduleId: "psu-5v-2a", qty: 1 }] }) },
  });

  out.push(a.shorts.length
    ? { id: "short", basis: "calc", category: "Electrics", severity: "red", title: t("Short circuit on net {nets}", { nets: a.shorts.join(", ") }), detail: t("Power and ground are connected.") }
    : { id: "nets", basis: "calc", category: "Geometry", severity: a.floating.length ? "yellow" : "green", title: a.floating.length ? t("Unconnected pins: {pins}", { pins: a.floating.join(", ") }) : t("Netlist OK — {n} nets, no shorts", { n: a.c.nets.length }), detail: t("{w} jumper wires on a {cols}-column breadboard.", { w: a.c.wires.length, cols: a.c.cols }) });
  if (a.buttonPullup) out.push({ id: "pullup", basis: "calc", category: "Electrics", severity: "green", title: t("Button uses INPUT_PULLUP"), detail: t("No external pull-up resistor is needed.") });

  const missing = g.parts.filter((p) => !CATALOG[p.moduleId].inStock);
  const cost = totalCost(g);
  out.push({ id: "stock", basis: "estimate", category: "Commerce", severity: missing.length ? "red" : "green", title: missing.length ? tn(missing.length, "{n} item out of stock", "{n} items out of stock") : t("All items in stock"), detail: t("Prices and stock are examples: no supplier is connected yet.") });
  out.push({ id: "budget", basis: "calc", category: "Commerce", severity: cost > g.budgetUsd ? "yellow" : "green", title: t("Cost ${cost} / budget ${budget}", { cost, budget: g.budgetUsd }), detail: cost > g.budgetUsd ? t("Over budget.") : t("Within budget.") });
  return out;
}

// ---- presets ---------------------------------------------------------------------------------------------

export function sampleBreadboard(): DeviceGraph {
  return {
    template: "breadboard", name: "Breadboard circuit", version: 1, circuit: { preset: "led" },
    params: { tableDiameterMm: 200, cameraHeightMm: 350, partMassKg: 1.5, link1Mm: 220, link2Mm: 180, payloadKg: 0.5, targetReachMm: 450, slopeDeg: 18, speedMs: 0.6, runtimeMin: 180 },
    parts: ["bb-half", "uno-r3", "led-red", "res-100"].map((moduleId) => ({ moduleId, qty: 1 })),
    budgetUsd: 60, printerBedMm: 220,
  };
}

export function setPreset(g: DeviceGraph, preset: Preset): DeviceGraph {
  const keep = (kind: ModuleKind, def: string) => g.parts.find((p) => CATALOG[p.moduleId].kind === kind)?.moduleId ?? def;
  const ids = [keep("base", "bb-half"), keep("mcu", "uno-r3")];
  if (preset === "led") ids.push(keep("led", "led-red"), keep("resistor", "res-220"));
  if (preset === "button") ids.push(keep("led", "led-red"), keep("resistor", "res-220"), "btn-6mm");
  if (preset === "distance") ids.push("hcsr04", "buzzer-act");
  if (preset === "servo") { ids.push("pot-10k", "servo-sg90"); if (g.parts.some((p) => p.moduleId === "psu-5v-2a")) ids.push("psu-5v-2a"); }
  if (preset === "traffic") ids.push("led-red", "led-yellow", "led-green", keep("resistor", "res-220"), keep("resistor", "res-220"), keep("resistor", "res-220"));
  if (preset === "doorbell") ids.push("btn-6mm", "buzzer-act");
  if (preset === "dimmer") ids.push(keep("led", "led-red"), keep("resistor", "res-220"), "pot-10k");
  if (preset === "parking") ids.push("hcsr04", "buzzer-act", keep("led", "led-red"), keep("resistor", "res-220"));
  if (preset === "radar") ids.push("hcsr04", "servo-sg90", "psu-5v-2a"); // the servo gets its own supply: it is the part that browns out a USB-powered board
  if (preset === "night") ids.push("light-module", keep("led", "led-yellow"), keep("resistor", "res-220"));
  if (preset === "thermo") ids.push("tmp36", "lcd-1602");
  if (preset === "weather") ids.push("tmp36", "light-module", "lcd-1602");
  if (preset === "plant") ids.push("soil-module", keep("led", "led-red"), keep("resistor", "res-220"), "buzzer-act");
  if (preset === "alarm") ids.push("pir-module", keep("led", "led-red"), keep("resistor", "res-220"), "buzzer-act");
  // motors get their own supply, like the servo
  if (preset === "fan") ids.push("pot-10k", "dc-motor", "psu-5v-2a");
  if (preset === "obstacle") ids.push("hcsr04", "dc-motor", "dc-motor", "psu-5v-2a");
  if (preset === "line") ids.push("light-module", "light-module", "dc-motor", "dc-motor", "psu-5v-2a");
  const counts = new Map<string, number>();
  ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  return { ...g, version: g.version + 1, circuit: { preset }, parts: [...counts].map(([moduleId, qty]) => ({ moduleId, qty })) };
}

/** A circuit made of a kit of blocks (catalog projects): the parts come from the kit, the layout is generated. */
export function setKit(g: DeviceGraph, kit: KitItem[], opts: { resistor?: string; board?: string; ext?: boolean } = {}): DeviceGraph {
  const keep = (kind: ModuleKind, def: string) => g.parts.find((p) => CATALOG[p.moduleId].kind === kind)?.moduleId ?? def;
  const ids = [opts.board ?? keep("base", "bb-half"), keep("mcu", "uno-r3"), ...kitParts(kit, opts.resistor), ...((opts.ext ?? kit.some((k) => k.block === "servo" || k.block === "motor")) ? ["psu-5v-2a"] : [])];
  const counts = new Map<string, number>();
  ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  return { ...g, version: g.version + 1, circuit: { preset: g.circuit?.preset ?? "led", kit }, parts: [...counts].map(([moduleId, qty]) => ({ moduleId, qty })) };
}

// ---- derived views ------------------------------------------------------------------------------------------

export function breadboardSteps(g: DeviceGraph): { title: string; parts: string[] }[] {
  const c = buildCircuit(g);
  const steps: { title: string; parts: string[] }[] = [];
  const id = (k: ModuleKind) => g.parts.find((p) => CATALOG[p.moduleId].kind === k)?.moduleId;
  steps.push({ title: t("Place the {name} on the bench", { name: modName(id("base")!) }), parts: [id("base")!] });
  steps.push({ title: t("Put the {name} in front of it", { name: modName(c.mcuId) }), parts: [c.mcuId] });
  for (const k of c.comps) {
    const cols = [...new Set(k.pins.map((p) => p.node.replace(/\D/g, "")))].join(", ");
    steps.push({
      title: k.offBoard ? t("Place {label} next to the breadboard", { label: k.label }) : t("Insert {label} with legs at {pins} in columns {cols}", { label: k.label, pins: k.pins.map((p) => p.name).join("/"), cols }),
      parts: [k.moduleId],
    });
  }
  for (const w of c.wires) steps.push({ title: t("Wire {id}: {a} → {b} ({color})", { id: w.id, a: w.a.label, b: w.b.label, color: t(WIRE_NAME[w.color] ?? "any colour") }), parts: [] });
  return steps;
}

export function breadboardPowerProfile(g: DeviceGraph, samples = 60) {
  const a = analyze(g);
  const servo = a.c.comps.find((x) => x.kind === "actuator");
  const base = (CATALOG[a.c.mcuId].mcuMa ?? 50) / 1000;
  return {
    cap: a.usbMa / 1000,
    points: Array.from({ length: samples }, (_, i) => {
      const t = i / (samples - 1);
      const blink = Math.sin(t * 20) > 0 ? 1 : 0.2;
      const sv = servo && !a.extPsu ? (0.08 + 0.17 * Math.abs(Math.sin(t * 8)) + (t > 0.45 && t < 0.5 ? 0.4 : 0)) : 0;
      return +(base + (a.leds.reduce((s, l) => s + l.i, 0) / 1000) * blink + (a.c.comps.some((x) => x.kind === "sensor") ? 0.015 : 0) + (a.c.comps.some((x) => x.kind === "buzzer") && blink > 0.5 ? 0.015 : 0) + sv).toFixed(3);
    }),
  };
}

export function arduinoSketch(g: DeviceGraph): string {
  const c = buildCircuit(g);
  const R = c.roles;
  const mcu = CATALOG[c.mcuId];
  if (g.circuit?.layout || g.circuit?.kit) return customSketch(g, c);
  const head = `// generated from Device Graph v${g.version} — ${mcu.name}, preset: ${c.preset}\n`;
  const analogMax = c.mcuId === "uno-r3" ? 1023 : 4095;
  if (c.preset === "led")
    return head + `const int LED = ${pinNum(R.led)};\n\nvoid setup() { pinMode(LED, OUTPUT); }\n\nvoid loop() {\n  digitalWrite(LED, HIGH); delay(500);\n  digitalWrite(LED, LOW);  delay(500);\n}\n`;
  if (c.preset === "button")
    return head + `const int LED = ${pinNum(R.led)};\nconst int BTN = ${pinNum(R.button)};\n\nvoid setup() {\n  pinMode(LED, OUTPUT);\n  pinMode(BTN, INPUT_PULLUP);   // button connects the pin to GND\n}\n\nvoid loop() {\n  digitalWrite(LED, digitalRead(BTN) == LOW);\n}\n`;
  if (c.preset === "distance")
    return head + `const int TRIG = ${pinNum(R.trig)};\nconst int ECHO = ${pinNum(R.echo)};\nconst int BUZZ = ${pinNum(R.buzzer)};\n\nvoid setup() {\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(BUZZ, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(TRIG, LOW);  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long us = pulseIn(ECHO, HIGH, 30000);\n  float cm = us * 0.0343 / 2;\n  digitalWrite(BUZZ, cm > 0 && cm < 20);   // alarm closer than 20 cm\n  delay(60);\n}\n`;
  if (c.preset === "traffic")
    return head + `const int RED_LED = ${pinNum(R.led)};\nconst int YELLOW_LED = ${pinNum(R.led2)};\nconst int GREEN_LED = ${pinNum(R.led3)};\n\nvoid setup() {\n  pinMode(RED_LED, OUTPUT); pinMode(YELLOW_LED, OUTPUT); pinMode(GREEN_LED, OUTPUT);\n}\n\nvoid light(int pin, int ms) {\n  digitalWrite(pin, HIGH); delay(ms); digitalWrite(pin, LOW);\n}\n\nvoid loop() {\n  light(GREEN_LED, 4000);    // go\n  light(YELLOW_LED, 1200);   // get ready to stop\n  light(RED_LED, 4000);      // stop\n}\n`;
  if (c.preset === "doorbell")
    return head + `const int BTN = ${pinNum(R.button)};\nconst int BUZZ = ${pinNum(R.buzzer)};\n\nvoid setup() {\n  pinMode(BTN, INPUT_PULLUP);   // button connects the pin to GND\n  pinMode(BUZZ, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(BUZZ, digitalRead(BTN) == LOW);   // ring while pressed\n}\n`;
  if (c.preset === "dimmer")
    return head + `const int POT = ${pinNum(R.pot)};\nconst int LED = ${pinNum(R.pwm)};   // must be a PWM pin\n\nvoid setup() { pinMode(LED, OUTPUT); }\n\nvoid loop() {\n  int v = analogRead(POT);                  // 0..${analogMax}\n  analogWrite(LED, map(v, 0, ${analogMax}, 0, 255));   // 0 = off, 255 = full brightness\n  delay(5);\n}\n`;
  if (c.preset === "parking")
    return head + `const int TRIG = ${pinNum(R.trig)};\nconst int ECHO = ${pinNum(R.echo)};\nconst int BUZZ = ${pinNum(R.buzzer)};\nconst int LED = ${pinNum(R.led)};\n\nvoid setup() {\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(BUZZ, OUTPUT); pinMode(LED, OUTPUT);\n}\n\nfloat distanceCm() {\n  digitalWrite(TRIG, LOW);  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long us = pulseIn(ECHO, HIGH, 30000);\n  return us * 0.0343 / 2;   // 0 means no echo\n}\n\nvoid loop() {\n  float cm = distanceCm();\n  if (cm > 0 && cm < 60) {\n    int gap = map((long)cm, 5, 60, 60, 500);   // closer = shorter pause between beeps\n    digitalWrite(LED, HIGH); digitalWrite(BUZZ, HIGH); delay(40);\n    digitalWrite(LED, LOW);  digitalWrite(BUZZ, LOW);  delay(gap);\n  } else {\n    delay(60);\n  }\n}\n`;
  if (c.preset === "radar")
    return head + `#include <${c.mcuId === "uno-r3" ? "Servo.h" : "ESP32Servo.h"}>\nServo servo;\nconst int TRIG = ${pinNum(R.trig)};\nconst int ECHO = ${pinNum(R.echo)};\nconst int SERVO_PIN = ${pinNum(R.servo)};\n\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);\n  servo.attach(SERVO_PIN);\n}\n\nfloat distanceCm() {\n  digitalWrite(TRIG, LOW);  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long us = pulseIn(ECHO, HIGH, 30000);\n  return us * 0.0343 / 2;\n}\n\nvoid sweep(int from, int to, int step) {\n  for (int a = from; a != to + step; a += step) {\n    servo.write(a);\n    delay(60);                       // let the servo arrive before measuring\n    Serial.print(a); Serial.print(","); Serial.println(distanceCm());   // angle,cm  (open the Serial Monitor)\n  }\n}\n\nvoid loop() {\n  sweep(0, 180, 5);\n  sweep(180, 0, -5);\n}\n`;
  const vref = c.mcuId === "uno-r3" ? "5.0" : "3.3";
  const lcdHead = `#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2);   // I2C address 0x27, 16 columns, 2 rows\n`;
  const motorFns = (two: boolean) => `\n// a motor driver input pair: IA sets the speed (PWM), IB the direction\nvoid motor(int ia, int ib, int speed) {\n  if (speed >= 0) { analogWrite(ia, speed); digitalWrite(ib, LOW); }\n  else { analogWrite(ia, 255 + speed); digitalWrite(ib, HIGH); }   // reverse: IB high, IA low for the speed\n}\n${two ? "void drive(int left, int right) { motor(L_IA, L_IB, left); motor(R_IA, R_IB, right); }\n" : ""}`;
  if (c.preset === "night")
    return head + `const int LIGHT = ${pinNum(R.light)};   // light sensor: higher = brighter\nconst int LED = ${pinNum(R.led)};\nconst int DARK = ${Math.round(analogMax * 0.3)};   // below this the room counts as dark\n\nvoid setup() {\n  pinMode(LED, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int light = analogRead(LIGHT);   // 0..${analogMax}\n  Serial.println(light);\n  digitalWrite(LED, light < DARK);\n  delay(100);\n}\n`;
  if (c.preset === "thermo")
    return head + lcdHead + `const int TEMP = ${pinNum(R.temp)};\n\nvoid setup() {\n  lcd.init();\n  lcd.backlight();\n}\n\nvoid loop() {\n  int raw = analogRead(TEMP);\n  float volts = raw * ${vref} / ${analogMax};\n  float celsius = (volts - 0.5) * 100;   // TMP36: 0.5 V at 0 °C, 10 mV per degree\n  lcd.setCursor(0, 0);\n  lcd.print("Temp: ");\n  lcd.print(celsius, 1);\n  lcd.print(" C   ");\n  delay(500);\n}\n`;
  if (c.preset === "weather")
    return head + lcdHead + `const int TEMP = ${pinNum(R.temp)};\nconst int LIGHT = ${pinNum(R.light)};\n\nvoid setup() {\n  lcd.init();\n  lcd.backlight();\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  float celsius = (analogRead(TEMP) * ${vref} / ${analogMax} - 0.5) * 100;\n  int light = map(analogRead(LIGHT), 0, ${analogMax}, 0, 100);   // percent\n  lcd.setCursor(0, 0); lcd.print("Temp  "); lcd.print(celsius, 1); lcd.print(" C   ");\n  lcd.setCursor(0, 1); lcd.print("Light "); lcd.print(light); lcd.print(" %   ");\n  Serial.print(celsius); Serial.print(","); Serial.println(light);\n  delay(1000);\n}\n`;
  if (c.preset === "plant")
    return head + `const int SOIL = ${pinNum(R.soil)};   // soil sensor: higher = wetter\nconst int LED = ${pinNum(R.led)};\nconst int BUZZ = ${pinNum(R.buzzer)};\nconst int DRY = ${Math.round(analogMax * 0.35)};\n\nvoid setup() {\n  pinMode(LED, OUTPUT); pinMode(BUZZ, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int moisture = analogRead(SOIL);\n  Serial.println(moisture);\n  if (moisture < DRY) {   // dry: blink and beep\n    digitalWrite(LED, HIGH); digitalWrite(BUZZ, HIGH); delay(150);\n    digitalWrite(LED, LOW);  digitalWrite(BUZZ, LOW);  delay(850);\n  } else {\n    delay(500);\n  }\n}\n`;
  if (c.preset === "alarm")
    return head + `const int PIR = ${pinNum(R.motion)};\nconst int LED = ${pinNum(R.led)};\nconst int BUZZ = ${pinNum(R.buzzer)};\n\nvoid setup() {\n  pinMode(PIR, INPUT); pinMode(LED, OUTPUT); pinMode(BUZZ, OUTPUT);\n}\n\nvoid loop() {\n  bool motion = digitalRead(PIR) == HIGH;\n  digitalWrite(LED, motion);\n  digitalWrite(BUZZ, motion);\n  delay(50);\n}\n`;
  if (c.preset === "fan")
    return head + `const int POT = ${pinNum(R.pot)};\nconst int IA = ${pinNum(R.motA)};   // PWM pin: speed\nconst int IB = ${pinNum(R.motB)};   // direction\n\nvoid setup() {\n  pinMode(IA, OUTPUT); pinMode(IB, OUTPUT);\n}\n\nvoid loop() {\n  int speed = map(analogRead(POT), 0, ${analogMax}, 0, 255);\n  analogWrite(IA, speed);\n  digitalWrite(IB, LOW);\n  delay(20);\n}\n`;
  if (c.preset === "obstacle")
    return head + `const int TRIG = ${pinNum(R.trig)};\nconst int ECHO = ${pinNum(R.echo)};\nconst int L_IA = ${pinNum(R.motA)}, L_IB = ${pinNum(R.motB)};\nconst int R_IA = ${pinNum(R.mot2A)}, R_IB = ${pinNum(R.mot2B)};\n${motorFns(true)}\nfloat distanceCm() {\n  digitalWrite(TRIG, LOW);  delayMicroseconds(2);\n  digitalWrite(TRIG, HIGH); delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long us = pulseIn(ECHO, HIGH, 30000);\n  return us * 0.0343 / 2;\n}\n\nvoid setup() {\n  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);\n  pinMode(L_IA, OUTPUT); pinMode(L_IB, OUTPUT); pinMode(R_IA, OUTPUT); pinMode(R_IB, OUTPUT);\n}\n\nvoid loop() {\n  float cm = distanceCm();\n  if (cm > 0 && cm < 20) {\n    drive(-180, 180);   // too close: turn on the spot\n    delay(300);\n  } else {\n    drive(200, 200);    // the way is clear: forward\n  }\n  delay(40);\n}\n`;
  if (c.preset === "line")
    return head + `const int LEFT = ${pinNum(R.light)};    // light sensors look down: the black line reads dark (low)\nconst int RIGHT = ${pinNum(R.light2)};\nconst int L_IA = ${pinNum(R.motA)}, L_IB = ${pinNum(R.motB)};\nconst int R_IA = ${pinNum(R.mot2A)}, R_IB = ${pinNum(R.mot2B)};\nconst int DARK = ${Math.round(analogMax * 0.4)};\n${motorFns(true)}\nvoid setup() {\n  pinMode(L_IA, OUTPUT); pinMode(L_IB, OUTPUT); pinMode(R_IA, OUTPUT); pinMode(R_IB, OUTPUT);\n}\n\nvoid loop() {\n  bool leftOnLine = analogRead(LEFT) < DARK;\n  bool rightOnLine = analogRead(RIGHT) < DARK;\n  if (leftOnLine && !rightOnLine) drive(60, 200);        // line is to the left: turn left\n  else if (rightOnLine && !leftOnLine) drive(200, 60);   // line is to the right: turn right\n  else drive(180, 180);\n  delay(10);\n}\n`;
  return head + `#include <${c.mcuId === "uno-r3" ? "Servo.h" : "ESP32Servo.h"}>\nServo servo;\nconst int POT = ${pinNum(R.pot)};\nconst int SERVO_PIN = ${pinNum(R.servo)};\n\nvoid setup() { servo.attach(SERVO_PIN); }\n\nvoid loop() {\n  int v = analogRead(POT);                    // 0..${analogMax}\n  servo.write(map(v, 0, ${analogMax}, 0, 180));  // knob steers the servo\n  delay(15);\n}\n`;
}
const pinNum = (p: string) => (p.startsWith("D") ? p.slice(1) : p.startsWith("G") ? p.slice(1) : p);

/** Sketch for a hand-built circuit: the pins come from what is actually wired, not from a preset. */
function customSketch(g: DeviceGraph, c: Circuit): string {
  const mcu = CATALOG[c.mcuId];
  const analogMax = c.mcuId === "uno-r3" ? 1023 : 4095;
  const gpio = (node: string) => (c.nets[c.netOf(node)]?.nodes ?? []).find((n) => n.startsWith("m:") && !/^m:(GND|5V|3V3|VIN|NC|IOREF|RESET|AREF)/.test(n))?.slice(2);
  const pinOf = (comp: CircuitComp, name: string) => comp.pins.find((p) => p.name === name)!;
  const decl: string[] = [], setup: string[] = [], loop: string[] = [];
  const todo = (what: string) => decl.push(`// ${what}: not wired to a GPIO pin yet`);
  const of = (kind: ModuleKind) => c.comps.filter((x) => x.kind === kind);

  const leds = of("led").map((led) => {
    const aNet = c.nets[c.netOf(pinOf(led, "A").node)]?.nodes ?? [];
    const res = c.comps.filter((x) => x.kind === "resistor").find((r) => r.pins.some((p) => aNet.includes(p.node)));
    const far = res?.pins.find((p) => !aNet.includes(p.node));
    return { led, pin: gpio(pinOf(led, "A").node) ?? (far ? gpio(far.node) : undefined) };
  });
  const btn = of("button")[0];
  const btnPin = btn && btn.pins.map((p) => gpio(p.node)).find(Boolean);
  const pot = of("pot")[0], servo = of("actuator")[0], sensor = of("sensor")[0], buzzer = of("buzzer")[0];
  const potPin = pot && gpio(pinOf(pot, "W").node);
  const servoPin = servo && gpio(pinOf(servo, "SIG").node);
  const buzzPin = buzzer && gpio(pinOf(buzzer, "+").node);

  leds.forEach(({ led, pin }) => (pin ? (decl.push(`const int ${led.ref} = ${pinNum(pin)};`), setup.push(`  pinMode(${led.ref}, OUTPUT);`)) : todo(led.ref)));
  const wired = leds.filter((l) => l.pin);
  if (btn) {
    if (btnPin) { decl.push(`const int BTN = ${pinNum(btnPin)};`); setup.push("  pinMode(BTN, INPUT_PULLUP);   // button connects the pin to GND"); } else todo(btn.ref);
  }
  if (sensor) {
    const trig = gpio(pinOf(sensor, "TRIG").node), echo = gpio(pinOf(sensor, "ECHO").node);
    if (trig && echo) { decl.push(`const int TRIG = ${pinNum(trig)};`, `const int ECHO = ${pinNum(echo)};`); setup.push("  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);"); } else todo(sensor.ref);
  }
  if (buzzer) {
    if (buzzPin) { decl.push(`const int BUZZ = ${pinNum(buzzPin)};`); setup.push("  pinMode(BUZZ, OUTPUT);"); } else todo(buzzer.ref);
  }
  if (pot) { if (potPin) decl.push(`const int POT = ${pinNum(potPin)};`); else todo(pot.ref); }
  // sensor modules, motors on drivers and the display
  const mods = of("module").map((m) => ({ m, pin: gpio(pinOf(m, "OUT").node) }));
  mods.forEach(({ m, pin }) => (pin ? decl.push(`const int ${m.ref} = ${pinNum(pin)};   // ${CATALOG[m.moduleId].name}`) : todo(m.ref)));
  const motorPins = of("motor").map((mt) => ({ mt, ia: gpio(pinOf(mt, "IA").node), ib: gpio(pinOf(mt, "IB").node) }));
  motorPins.forEach(({ mt, ia, ib }) => { if (ia && ib) { decl.push(`const int ${mt.ref}_IA = ${pinNum(ia)}, ${mt.ref}_IB = ${pinNum(ib)};`); setup.push(`  pinMode(${mt.ref}_IA, OUTPUT); pinMode(${mt.ref}_IB, OUTPUT);`); } else todo(mt.ref); });
  const lcd = of("display")[0];
  if (lcd) { decl.push("LiquidCrystal_I2C lcd(0x27, 16, 2);"); setup.push("  lcd.init();", "  lcd.backlight();"); }
  if (servo) { if (servoPin) decl.push(`const int SERVO_PIN = ${pinNum(servoPin)};`, "Servo servo;"); else todo(servo.ref); }
  if (servo && servoPin) setup.push("  servo.attach(SERVO_PIN);");

  if (sensor && decl.some((d) => d.startsWith("const int TRIG"))) {
    loop.push("  digitalWrite(TRIG, LOW);  delayMicroseconds(2);", "  digitalWrite(TRIG, HIGH); delayMicroseconds(10);", "  digitalWrite(TRIG, LOW);", "  long us = pulseIn(ECHO, HIGH, 30000);", "  float cm = us * 0.0343 / 2;");
    if (buzzPin) loop.push("  digitalWrite(BUZZ, cm > 0 && cm < 20);   // alarm closer than 20 cm");
    wired.forEach((l) => loop.push(`  digitalWrite(${l.led.ref}, cm > 0 && cm < 20);`));
    motorPins.filter((x) => x.ia && x.ib).forEach(({ mt }) => loop.push(`  analogWrite(${mt.ref}_IA, cm > 0 && cm < 20 ? 0 : 180); digitalWrite(${mt.ref}_IB, LOW);   // stop close to an obstacle`));
    loop.push("  delay(60);");
  } else if (pot && potPin && servo && servoPin) {
    loop.push(`  int v = analogRead(POT);                    // 0..${analogMax}`, `  servo.write(map(v, 0, ${analogMax}, 0, 180));  // knob steers the servo`, "  delay(15);");
  } else if (btn && btnPin && (wired.length || buzzPin)) {
    wired.forEach((l) => loop.push(`  digitalWrite(${l.led.ref}, digitalRead(BTN) == LOW);`));
    if (buzzPin) loop.push("  digitalWrite(BUZZ, digitalRead(BTN) == LOW);");
  } else if (mods.some((x) => x.pin) || motorPins.some((x) => x.ia) || lcd) {
    if (mods.some((x) => x.pin)) setup.push("  Serial.begin(9600);");
    mods.filter((x) => x.pin).forEach(({ m }, i) => {
      const digital = CATALOG[m.moduleId].measures === "motion";
      loop.push(`  int v${i} = ${digital ? "digitalRead" : "analogRead"}(${m.ref});`, `  Serial.print("${m.ref} "); Serial.println(v${i});`);
      if (lcd) loop.push(`  lcd.setCursor(0, ${Math.min(i, 1)}); lcd.print("${m.ref} "); lcd.print(v${i}); lcd.print("    ");`);
    });
    if (lcd && !mods.some((x) => x.pin)) loop.push('  lcd.setCursor(0, 0); lcd.print("Hello!");');
    motorPins.filter((x) => x.ia && x.ib).forEach(({ mt }) => loop.push(`  analogWrite(${mt.ref}_IA, 180); digitalWrite(${mt.ref}_IB, LOW);   // forward at about 70 %`));
    loop.push("  delay(200);");
  } else if (wired.length) {
    wired.forEach((l) => loop.push(`  digitalWrite(${l.led.ref}, HIGH);`));
    loop.push("  delay(500);");
    wired.forEach((l) => loop.push(`  digitalWrite(${l.led.ref}, LOW);`));
    loop.push("  delay(500);");
  }
  const lib = (servo && servoPin ? `#include <${c.mcuId === "uno-r3" ? "Servo.h" : "ESP32Servo.h"}>\n` : "") + (lcd ? "#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\n" : "");
  const body = loop.length ? loop.join("\n") : "  // wire something up and this loop fills in";
  return `// generated from Device Graph v${g.version} — ${mcu.name}, custom circuit\n${lib}${decl.join("\n")}\n\nvoid setup() {\n${setup.join("\n")}\n}\n\nvoid loop() {\n${body}\n}\n`;
}
