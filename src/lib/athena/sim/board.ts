// The virtual board: an Arduino Uno / Nano or ESP32 wired exactly as the breadboard layout says. The sketch drives its
// pins (runtime.ts); this file works out what the circuit does with them: net voltages, the current through every LED
// branch (Ohm's law with the LED's forward voltage), buttons, the potentiometer, the HC-SR04 echo, the servo moving at its
// real speed, the USB current budget — and what goes wrong like on the bench: an LED without a resistor burns, an
// overloaded pin is damaged, a servo on USB power resets the board, an unconnected input reads noise.
import { CATALOG, type DeviceGraph } from "../deviceGraph";
import { analyze, buildCircuit, type Circuit, type CircuitComp } from "../circuit";
import { parse, SketchError, type Program } from "./sketch";
import { AVR_COSTS, ESP32_COSTS, Machine, type Hardware } from "./runtime";

export const MODE = { INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2 } as const;
export type Level = 0 | 1;

export interface BoardSpec { id: string; name: string; logicV: number; adcMax: number; pinMa: number; absMaxMa: number; usbMa: number; mcuMa: number; intBits: 16 | 32; ledBuiltin: number }
export function boardSpec(mcuId: string): BoardSpec {
  const m = CATALOG[mcuId];
  const esp = mcuId.startsWith("esp32");
  return {
    id: mcuId, name: m?.name ?? mcuId, logicV: m?.logicV ?? 5, adcMax: esp ? 4095 : 1023, pinMa: m?.pinMa ?? 20, absMaxMa: esp ? 40 : 40,
    usbMa: m?.usbMa ?? 500, mcuMa: m?.mcuMa ?? 50, intBits: esp ? 32 : 16, ledBuiltin: esp ? 2 : 13,
  };
}

/** Pin number in the sketch → pin name on the board, and the constants a sketch can use. */
export function pinMap(mcuId: string) {
  const esp = mcuId.startsWith("esp32");
  const toName = (n: number): string | null => {
    if (esp) return n >= 0 && n <= 39 ? `G${n}` : null;
    if (n >= 0 && n <= 13) return `D${n}`;
    if (n >= 14 && n <= 21) return `A${n - 14}`;
    return null;
  };
  /** analogRead(0) means A0 on AVR boards */
  const analogName = (n: number): string | null => (esp ? toName(n) : n >= 0 && n <= 7 ? `A${n}` : toName(n));
  const constants: Record<string, number> = { HIGH: 1, LOW: 0, INPUT: MODE.INPUT, OUTPUT: MODE.OUTPUT, INPUT_PULLUP: MODE.INPUT_PULLUP, CHANGE: 1, FALLING: 2, RISING: 3, DEC: 10, HEX: 16, OCT: 8, BIN: 2, LED_BUILTIN: esp ? 2 : 13, NOT_AN_INTERRUPT: -1 };
  if (esp) Object.assign(constants, { A0: 36, A3: 39, A4: 32, A5: 33, A6: 34, A7: 35 });
  else for (let i = 0; i < 8; i++) constants[`A${i}`] = 14 + i;
  const interrupt = (pin: number) => (esp ? pin : pin === 2 ? 0 : pin === 3 ? 1 : -1);
  const interruptPin = (irq: number) => (esp ? irq : irq === 0 ? 2 : irq === 1 ? 3 : -1);
  return { toName, analogName, constants, interrupt, interruptPin };
}

export interface SimEvent { t: number; kind: "error" | "warn" | "info"; text: string; vars?: Record<string, string | number>; ref?: string; check?: string }
export interface LedState { ref: string; moduleId: string; brightness: number; ma: number; peakMa: number; state: "ok" | "off" | "burned" | "reversed" | "open" }
export interface PinState { name: string; mode: number; level: Level; pwm: number | null; damaged: boolean; ma: number }
export interface Trace { pin: string; points: { t: number; v: number }[] }
export interface Inputs {
  buttons: Record<string, boolean>; pots: Record<string, number>; distanceCm: number;
  /** what the sensor modules feel: light and soil moisture 0–1, temperature °C, motion on/off (per module ref) */
  light: Record<string, number>; temperatureC: number; moisture: number; motion: boolean;
}
export interface MotorState { ref: string; speed: number; powered: boolean; /** wheel angle, degrees */ angle: number; /** what the driver inputs ask for */ target?: number }
export interface LcdState { ref: string; lines: [string, string]; backlight: boolean; on: boolean }

const LED_COLOURS: Record<string, string> = { "led-red": "#ef4444", "led-yellow": "#eab308", "led-green": "#22c55e", "led-blue": "#3b82f6" };
export const ledColour = (id: string) => LED_COLOURS[id] ?? "#ef4444";

const R_PIN = 25; // Ω: output resistance of an AVR pin, which is all that limits an LED wired without a resistor

/** One simulation: the board, the circuit and the running sketch. */
export class Board implements Hardware {
  readonly spec: BoardSpec;
  readonly circuit: Circuit;
  readonly map: ReturnType<typeof pinMap>;
  machine: Machine | null = null;
  program: Program | null = null;
  compileError: { message: string; line: number } | null = null;
  inputs: Inputs = { buttons: {}, pots: {}, distanceCm: 50, light: {}, temperatureC: 22, moisture: 0.6, motion: false };
  motors: MotorState[] = [];
  lcds: LcdState[] = [];
  private lcdCursor = new Map<number, { col: number; row: number }>();
  events: SimEvent[] = [];
  serialOut = "";
  private serialIn = "";
  private modes = new Map<string, number>();
  private levels = new Map<string, Level>();
  private pwm = new Map<string, number>();
  private tones = new Map<string, number>();
  private damaged = new Set<string>();
  private burned = new Set<string>();
  private warned = new Set<string>();
  private servoPin = new Map<number, string>();
  private servoTarget = new Map<number, number>();
  /** physical servo horn angles by component ref */
  servoAngle: Record<string, number> = {};
  private trigFall = -1e12;
  private overSince = -1;
  resets = 0;
  leds: LedState[] = [];
  netV: (number | null)[] = [];
  netI: number[] = [];
  pinMa = new Map<string, number>();
  supplyMa = 0;
  private railMa = 0;
  buzzing: { ref: string; on: boolean; freq: number }[] = [];
  traces = new Map<string, { t: number; v: number }[]>();

  constructor(readonly graph: DeviceGraph, readonly analysis = analyze(graph)) {
    this.circuit = this.analysis.c;
    this.spec = boardSpec(this.circuit.mcuId);
    this.map = pinMap(this.circuit.mcuId);
    for (const k of this.circuit.comps) {
      if (k.kind === "pot") this.inputs.pots[k.ref] = 0.5;
      if (k.kind === "button") this.inputs.buttons[k.ref] = false;
      if (k.kind === "actuator") this.servoAngle[k.ref] = 90;
      if (k.kind === "module" && CATALOG[k.moduleId].measures === "light") this.inputs.light[k.ref] = 0.7;
      if (k.kind === "motor") this.motors.push({ ref: k.ref, speed: 0, powered: false, angle: 0 });
      if (k.kind === "display") this.lcds.push({ ref: k.ref, lines: [" ".repeat(16), " ".repeat(16)], backlight: false, on: false });
    }
    this.solve();
  }

  /** Compile and start a sketch; returns the compile error, if any. */
  load(code: string): { message: string; line: number } | null {
    try {
      this.program = parse(code, { constants: this.map.constants, target: { intBits: this.spec.intBits } });
      this.compileError = null;
    } catch (e) {
      this.program = null;
      this.compileError = e instanceof SketchError ? { message: e.message, line: e.line } : { message: String(e), line: 0 };
      return this.compileError;
    }
    this.machine = new Machine(this.program, this, this.spec.intBits === 16 ? AVR_COSTS : ESP32_COSTS);
    return null;
  }

  get now() { return this.machine?.us ?? 0; }

  /** Advance the simulation by `ms`, in 1 ms steps (the servo and the power budget update each step). */
  run(ms: number, maxSteps = 60000): { slow: boolean } {
    let slow = false;
    const steps = Math.max(1, Math.round(ms));
    for (let i = 0; i < steps; i++) {
      if (this.machine) {
        const r = this.machine.advance(this.machine.us + 1000, maxSteps / steps);
        if (r.slow) { slow = true; }
        if (this.machine.status === "error" && this.machine.error) { this.event("error", "Runtime error on line {line}: {msg}", { line: this.machine.error.line, msg: this.machine.error.message }); this.machine.status = "halted"; }
      }
      this.physics(1);
      this.irqBaseline();
    }
    return { slow };
  }

  // ---------------------------------------------------------------- Hardware (called by the sketch)

  private name(pin: number) { return this.map.toName(pin); }
  private pinNet(name: string) { return this.circuit.netOf(`m:${name}`); }

  pinMode(pin: number, mode: number) {
    const n = this.name(pin);
    if (!n) return this.warnOnce(`pin${pin}`, "pinMode(): there is no pin {pin} on this board", { pin });
    this.modes.set(n, mode);
    this.changed();
  }
  digitalWrite(pin: number, level: number) {
    const n = this.name(pin);
    if (!n) return this.warnOnce(`pin${pin}`, "digitalWrite(): there is no pin {pin} on this board", { pin });
    if (this.modes.get(n) !== MODE.OUTPUT) {
      // on an AVR, writing HIGH to an input turns its pull-up on: the LED glows faintly — a classic mistake
      if (this.modes.get(n) !== MODE.INPUT_PULLUP || !level) this.warnOnce(`mode${n}`, "{pin} is written but was not set to OUTPUT with pinMode(): an LED on it will only glow faintly", { pin: n });
      if (this.spec.intBits === 16) this.modes.set(n, level ? MODE.INPUT_PULLUP : MODE.INPUT);
    }
    this.pwm.delete(n);
    this.setLevel(n, level ? 1 : 0);
    if (level === 0 && this.trigNet() === this.pinNet(n)) this.trigFall = this.now;
    this.changed();
  }
  digitalRead(pin: number): number {
    const n = this.name(pin);
    if (!n) return 0;
    return this.readDigital(n);
  }
  analogRead(pin: number): number {
    const n = this.map.analogName(pin);
    if (!n) return 0;
    const v = this.netVoltage(this.pinNet(n));
    if (v === null) { this.warnOnce(`float-a${n}`, "analogRead({pin}): nothing is connected, the reading is noise", { pin: n }); return Math.floor(Math.random() * this.spec.adcMax * 0.6 + this.spec.adcMax * 0.2); }
    return Math.max(0, Math.min(this.spec.adcMax, Math.round((v / this.spec.logicV) * this.spec.adcMax)));
  }
  analogWrite(pin: number, duty: number) {
    const n = this.name(pin);
    if (!n) return;
    if (this.spec.intBits === 16 && !/^D(3|5|6|9|10|11)$/.test(n)) {
      // AVR pins without PWM: analogWrite rounds to fully on or off
      this.warnOnce(`pwm${n}`, "{pin} has no PWM on this board: analogWrite() switches it fully on or off. Use pin 3, 5, 6, 9, 10 or 11.", { pin: n });
      this.modes.set(n, MODE.OUTPUT); this.pwm.delete(n); this.setLevel(n, duty >= 128 ? 1 : 0); this.changed(); return;
    }
    this.modes.set(n, MODE.OUTPUT);
    if (duty <= 0) { this.pwm.delete(n); this.setLevel(n, 0); }
    else if (duty >= 255) { this.pwm.delete(n); this.setLevel(n, 1); }
    else { this.pwm.set(n, duty / 255); this.setLevel(n, 1); }
    this.changed();
  }
  pulseIn(pin: number, level: number, timeoutUs: number): { waitUs: number; value: number } {
    const n = this.name(pin);
    const sensor = this.circuit.comps.find((k) => k.kind === "sensor");
    if (!n || !sensor) return { waitUs: timeoutUs, value: 0 };
    const echo = sensor.pins.find((p) => p.name === "ECHO")!;
    const powered = this.powered(sensor, "VCC", "GND");
    const triggered = this.now - this.trigFall < 1000;
    if (this.circuit.netOf(echo.node) !== this.pinNet(n) || !powered || !triggered || level !== 1) {
      if (!powered) this.warnOnce("sonar-power", "The HC-SR04 has no power: connect VCC to 5 V and GND to GND");
      else if (!triggered) this.warnOnce("sonar-trig", "pulseIn() waited for an echo, but the sensor was not triggered: send a 10 µs HIGH pulse on TRIG first");
      return { waitUs: timeoutUs, value: 0 };
    }
    if (this.spec.logicV < 4 && (CATALOG[sensor.moduleId].outV ?? 5) > this.spec.logicV + 0.3) this.warnOnce("sonar-5v", "The 5 V echo goes straight into a 3.3 V pin: on a real ESP32 this can damage the pin");
    const d = this.inputs.distanceCm;
    if (d < 2 || d > 400) return { waitUs: Math.min(timeoutUs, 38_000), value: 0 };
    const width = (d * 2) / 0.0343;
    if (width > timeoutUs) return { waitUs: timeoutUs, value: 0 };
    return { waitUs: 450 + width, value: Math.round(width) };
  }
  tone(pin: number, freq: number) { const n = this.name(pin); if (!n) return; this.modes.set(n, MODE.OUTPUT); this.tones.set(n, freq); this.setLevel(n, 1); this.pwm.set(n, 0.5); this.changed(); }
  noTone(pin: number) { const n = this.name(pin); if (!n) return; this.tones.delete(n); this.pwm.delete(n); this.setLevel(n, 0); this.changed(); }
  servoAttach(id: number, pin: number) { const n = this.name(pin); if (!n) return; this.servoPin.set(id, n); this.modes.set(n, MODE.OUTPUT); this.changed(); }
  servoWrite(id: number, angle: number) { this.servoTarget.set(id, angle); }
  servoDetach(id: number) { this.servoPin.delete(id); }
  serialWrite(text: string) {
    this.serialOut += text;
    if (this.serialOut.length > 20000) this.serialOut = this.serialOut.slice(-16000);
  }
  serialInput() { return this.serialIn; }
  serialConsume(n: number) { this.serialIn = this.serialIn.slice(n); }
  sendSerial(text: string) { this.serialIn += text; }
  interruptPin(n: number) { return this.map.interrupt(n); }
  lcd(id: number, op: string, a?: number, b?: number, text?: string) {
    const k = this.circuit.comps.filter((x) => x.kind === "display")[id];
    const st = k && this.lcds.find((l) => l.ref === k.ref);
    if (!k || !st) return;
    // it answers on I2C only when it is powered and SDA/SCL go to the board's I2C pins
    if (!this.lcdWired(k)) { this.warnOnce(`lcd-${k.ref}`, "{ref} does not answer on I2C: connect SDA and SCL to the board's I2C pins ({sda} and {scl}) and power it from 5 V", { ref: k.ref, sda: this.spec.intBits === 16 ? "SDA/A4" : "G21", scl: this.spec.intBits === 16 ? "SCL/A5" : "G22" }); return; }
    const cur = this.lcdCursor.get(id) ?? { col: 0, row: 0 };
    const put = (txt: string) => {
      let line = st.lines[cur.row] ?? " ".repeat(16);
      for (const ch of txt) { if (cur.col < 16) line = line.slice(0, cur.col) + ch + line.slice(cur.col + 1); cur.col++; }
      st.lines[cur.row] = line.slice(0, 16) as string;
    };
    switch (op) {
      case "init": case "begin": st.on = true; st.lines = [" ".repeat(16), " ".repeat(16)]; cur.col = 0; cur.row = 0; break;
      case "backlight": st.backlight = true; break;
      case "noBacklight": st.backlight = false; break;
      case "clear": st.lines = [" ".repeat(16), " ".repeat(16)]; cur.col = 0; cur.row = 0; break;
      case "home": cur.col = 0; cur.row = 0; break;
      case "setCursor": cur.col = Math.max(0, Math.min(15, a ?? 0)); cur.row = Math.max(0, Math.min(1, b ?? 0)); break;
      case "print": if (st.on) put(text ?? ""); else this.warnOnce(`lcd-init-${k.ref}`, "{ref}: call lcd.init() in setup() before printing", { ref: k.ref }); break;
      case "display": st.on = true; break;
      case "noDisplay": st.on = false; break;
    }
    this.lcdCursor.set(id, cur);
  }
  private lcdWiredRef(ref: string) { const k = this.circuit.comps.find((x) => x.ref === ref); return !!k && this.lcdWired(k); }
  private lcdWired(k: CircuitComp) {
    const net = (name: string) => this.circuit.nets[this.circuit.netOf(k.pins.find((p) => p.name === name)!.node)]?.nodes ?? [];
    const sdaOk = this.spec.intBits === 16 ? net("SDA").some((n) => n === "m:SDA" || n === "m:A4") : net("SDA").includes("m:G21");
    const sclOk = this.spec.intBits === 16 ? net("SCL").some((n) => n === "m:SCL" || n === "m:A5") : net("SCL").includes("m:G22");
    return sdaOk && sclOk && this.powered(k, "VCC", "GND");
  }
  warn(message: string, line: number) { this.warnOnce(`w:${message}`, "Line {line}: {msg}", { line, msg: message }); }

  // ---------------------------------------------------------------- inputs from the user

  press(ref: string, down: boolean) { this.inputs.buttons[ref] = down; this.changed(); }
  turn(ref: string, pos: number) { this.inputs.pots[ref] = Math.max(0, Math.min(1, pos)); this.changed(); }
  setDistance(cm: number) { this.inputs.distanceCm = cm; }
  setLight(ref: string, v: number) { this.inputs.light[ref] = Math.max(0, Math.min(1, v)); this.changed(); }
  setTemperature(c: number) { this.inputs.temperatureC = c; this.changed(); }
  setMoisture(v: number) { this.inputs.moisture = Math.max(0, Math.min(1, v)); this.changed(); }
  setMotion(on: boolean) { this.inputs.motion = on; this.changed(); }
  /** the reset button: the sketch starts again; burned parts are replaced and the Serial Monitor cleared */
  restart(fresh = true) {
    if (fresh) { this.repair(); this.serialOut = ""; }
    this.modes.clear(); this.levels.clear(); this.pwm.clear(); this.tones.clear(); this.servoPin.clear(); this.servoTarget.clear();
    for (const l of this.lcds) { l.on = false; l.lines = [" ".repeat(16), " ".repeat(16)]; }
    for (const m of this.motors) m.speed = 0;
    this.lcdCursor.clear();
    this.machine?.reset();
    this.solve();
  }
  /** put a new LED in, as after replacing a burned one */
  repair() { this.burned.clear(); this.damaged.clear(); this.changed(); }

  // ---------------------------------------------------------------- circuit

  private setLevel(n: string, v: Level) {
    const old = this.levels.get(n) ?? 0;
    this.levels.set(n, v);
    if (old !== v) this.trace(n, v);
  }
  private trace(n: string, v: number) {
    const tr = this.traces.get(n) ?? [];
    tr.push({ t: this.now, v });
    while (tr.length > 4000 || (tr.length > 2 && tr[0].t < this.now - 20_000_000)) tr.shift();
    this.traces.set(n, tr);
  }

  private trigNet() {
    const s = this.circuit.comps.find((k) => k.kind === "sensor");
    const p = s?.pins.find((x) => x.name === "TRIG");
    return p ? this.circuit.netOf(p.node) : -2;
  }

  /** Nets joined by pressed buttons, so a pressed button connects its two sides. */
  private joined(): (i: number) => number {
    const parent = this.circuit.nets.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (const k of this.circuit.comps) {
      if (k.kind !== "button" || !this.inputs.buttons[k.ref]) continue;
      const a = this.circuit.netOf(k.pins[0].node), b = this.circuit.netOf(k.pins[1].node);
      if (a >= 0 && b >= 0) parent[find(a)] = find(b);
    }
    return find;
  }

  /** The voltage a net is held at, or null when nothing drives it (floating). */
  netVoltage(net: number): number | null {
    if (net < 0) return null;
    const find = this.joined();
    const root = find(net);
    let v: number | null = null;
    this.circuit.nets.forEach((n, i) => {
      if (find(i) !== root || v !== null) return;
      const vv = this.driven(i);
      if (vv !== null) v = vv;
    });
    if (v !== null) return v;
    // a powered sensor module drives its OUT net with what it measures
    for (const k of this.circuit.comps) {
      if (k.kind !== "module") continue;
      if (find(this.circuit.netOf(k.pins[1].node)) !== root) continue;
      const vcc = this.driven(this.circuit.netOf(k.pins[0].node)), gnd = this.driven(this.circuit.netOf(k.pins[2].node));
      if (vcc === null || gnd !== 0 || vcc < 2.7) return null;
      const m = CATALOG[k.moduleId];
      switch (m.measures) {
        case "light": return vcc * (this.inputs.light[k.ref] ?? 0.7);
        case "moisture": return vcc * this.inputs.moisture;
        case "temperature": return Math.max(0.1, Math.min(vcc - 0.2, 0.5 + 0.01 * this.inputs.temperatureC)); // TMP36: 10 mV/°C, 0.5 V at 0 °C
        case "motion": return vcc >= 4.5 && this.inputs.motion ? Math.min(vcc, m.outV ?? 3.3) : vcc >= 4.5 ? 0 : null; // HC-SR501 needs 4.5 V or more
      }
    }
    // potentiometer wiper
    for (const k of this.circuit.comps) {
      if (k.kind !== "pot") continue;
      const w = this.circuit.netOf(k.pins[1].node);
      if (find(w) !== root) continue;
      const a = this.driven(this.circuit.netOf(k.pins[0].node)), b = this.driven(this.circuit.netOf(k.pins[2].node));
      if (a === null || b === null) return null;
      return a + (b - a) * (this.inputs.pots[k.ref] ?? 0.5);
    }
    return null;
  }

  /** Voltage of a net from what is wired straight into it: supply pins and output pins. */
  private driven(net: number): number | null {
    const n = this.circuit.nets[net];
    if (!n) return null;
    if (n.nodes.some((x) => x.startsWith("m:GND"))) return 0;
    if (n.nodes.includes("m:5V")) return 5;
    if (n.nodes.includes("m:3V3")) return 3.3;
    if (n.nodes.includes("p:+")) return 5;
    if (n.nodes.includes("p:-")) return 0;
    for (const x of n.nodes) {
      if (!x.startsWith("m:")) continue;
      const pin = x.slice(2);
      const mode = this.modes.get(pin);
      if (mode === MODE.OUTPUT && !this.damaged.has(pin)) return (this.levels.get(pin) ?? 0) * this.spec.logicV * (this.pwm.get(pin) ?? 1);
    }
    return null;
  }

  private readDigital(pin: string): number {
    const net = this.pinNet(pin);
    const v = this.netVoltage(net);
    if (v !== null) return v > this.spec.logicV * 0.6 ? 1 : v < this.spec.logicV * 0.3 ? 0 : (this.levels.get(pin) ?? 0);
    if (this.modes.get(pin) === MODE.INPUT_PULLUP) return 1;
    this.warnOnce(`float-${pin}`, "{pin} is an input with nothing pulling it up or down: it reads random values. Use INPUT_PULLUP or a resistor.", { pin });
    return Math.random() < 0.5 ? 0 : 1;
  }

  private powered(k: CircuitComp, vcc: string, gnd: string) {
    const v = this.netVoltage(this.circuit.netOf(k.pins.find((p) => p.name === vcc)!.node));
    const g = this.netVoltage(this.circuit.netOf(k.pins.find((p) => p.name === gnd)!.node));
    return v !== null && v >= 4.5 && g === 0;
  }

  private irqLevels = new Map<number, number>();
  private changed() {
    this.solve();
    // inputs with an interrupt attached: an edge queues the routine
    const m = this.machine;
    if (!m) return;
    for (const irq of m.interrupts) {
      const name = this.name(this.map.interruptPin(irq));
      if (!name) continue;
      const v = this.netVoltage(this.pinNet(name));
      const level = v !== null ? (v > this.spec.logicV / 2 ? 1 : 0) : this.modes.get(name) === MODE.INPUT_PULLUP ? 1 : (this.irqLevels.get(irq) ?? 1);
      const old = this.irqLevels.get(irq);
      this.irqLevels.set(irq, level);
      if (old !== undefined && old !== level) m.pinChanged(irq, old, level);
    }
  }
  /** A routine attached since the last change starts from the input's present level. */
  private irqBaseline() {
    const m = this.machine;
    if (!m) return;
    for (const irq of m.interrupts) if (!this.irqLevels.has(irq)) this.changed();
  }

  /** Work out every LED branch, the buzzer and the current each source supplies. */
  solve() {
    const c = this.circuit;
    const nets = c.nets.map((_, i) => this.netVoltage(i));
    this.netV = nets;
    const netI = c.nets.map(() => 0);
    const pinMa = new Map<string, number>();
    const sourcePin = (net: number) => c.nets[net]?.nodes.find((x) => x.startsWith("m:") && !/^m:(GND|5V|3V3|VIN)/.test(x))?.slice(2);
    let railMa = 0;
    const add = (net: number, ma: number) => { if (net >= 0) netI[net] += ma; };
    /** current drawn from a source net: from an output pin, or from the 5 V / 3.3 V rail */
    const draw = (net: number, ma: number) => {
      const p = sourcePin(net);
      if (p && this.modes.get(p) === MODE.OUTPUT) pinMa.set(p, (pinMa.get(p) ?? 0) + ma);
      else if (c.nets[net]?.nodes.some((x) => x === "m:5V" || x === "m:3V3")) railMa += ma;
    };

    // LEDs, with the series resistor on either side
    const leds: LedState[] = [];
    for (const led of c.comps.filter((k) => k.kind === "led")) {
      const lm = CATALOG[led.moduleId];
      const aNet = c.netOf(led.pins[0].node), kNet = c.netOf(led.pins[1].node);
      const resistors = c.comps.filter((k) => k.kind === "resistor");
      const viaR = (net: number) => {
        for (const r of resistors) {
          const near = r.pins.find((p) => c.netOf(p.node) === net);
          if (!near) continue;
          const far = r.pins.find((p) => p !== near)!;
          return { R: CATALOG[r.moduleId].ohm ?? 0, far: c.netOf(far.node) };
        }
        return null;
      };
      let vA = nets[aNet], vK = nets[kNet], R = 0, srcNet = aNet, gndNet = kNet;
      const ra = vA === null ? viaR(aNet) : null;
      const rk = vK === null ? viaR(kNet) : null;
      if (ra) { vA = nets[ra.far]; R += ra.R; srcNet = ra.far; }
      if (rk) { vK = nets[rk.far]; R += rk.R; gndNet = rk.far; }
      const vf = lm.vf ?? 2;
      const duty = (() => { const p = sourcePin(srcNet); return p ? (this.pwm.get(p) ?? 1) : 1; })();
      let state: LedState["state"] = "off", ma = 0, peak = 0;
      if (this.burned.has(led.ref)) state = "burned";
      else if (vA === null || vK === null) state = "open";
      else if (vK > vA + 0.5) state = "reversed";
      else {
        const vOn = (vA / duty) - vK; // the source's HIGH level, before PWM averaging
        const pinR = R === 0 ? (sourcePin(srcNet) ? R_PIN : 2) : 0;
        peak = Math.max(0, ((vOn - vf) / (R + pinR)) * 1000);
        ma = peak * duty;
        state = peak > 0.05 ? "ok" : "off";
        if (peak > (lm.maxMa ?? 20) * 2.5) {
          this.burned.add(led.ref); state = "burned"; ma = 0;
          this.event("error", "{ref} burned out: {ma} mA flowed through it (it takes {max} mA). Put a resistor in series.", { ref: led.ref, ma: Math.round(peak), max: lm.maxMa ?? 20 }, led.ref, `led-${led.ref}`);
        }
        if (state === "ok") { draw(srcNet, ma); add(srcNet, ma); add(gndNet, ma); if (ra) add(aNet, ma); if (rk) add(kNet, ma); }
      }
      leds.push({ ref: led.ref, moduleId: led.moduleId, brightness: state === "ok" ? Math.min(1, ma / 12) : 0, ma, peakMa: peak, state });
    }
    this.leds = leds;

    // active buzzer: sounds when its + side is high and − side is grounded
    this.buzzing = c.comps.filter((k) => k.kind === "buzzer").map((k) => {
      const vp = nets[c.netOf(k.pins[0].node)], vn = nets[c.netOf(k.pins[1].node)];
      const src = sourcePin(c.netOf(k.pins[0].node));
      const on = vp !== null && vn === 0 && (vp > 2.5 || (!!src && this.tones.has(src))); // tone() drives a square wave: it still sounds
      const ma = on ? (CATALOG[k.moduleId].currentA ?? 0.015) * 1000 : 0;
      if (on) { draw(c.netOf(k.pins[0].node), ma); add(c.netOf(k.pins[0].node), ma); add(c.netOf(k.pins[1].node), ma); }
      const p = sourcePin(c.netOf(k.pins[0].node));
      return { ref: k.ref, on, freq: (p && this.tones.get(p)) || 2300 };
    });

    // sensor and servo supply current
    for (const k of c.comps) {
      if (k.kind === "sensor" && this.powered(k, "VCC", "GND")) { railMa += 15; add(c.netOf(k.pins[0].node), 15); }
    }
    this.netI = netI;
    this.railMa = railMa;
    // pins sourcing more than they may
    for (const [p, ma] of pinMa) {
      if (ma > this.spec.absMaxMa && !this.damaged.has(p)) {
        this.damaged.add(p);
        this.event("error", "Pin {pin} was damaged: it had to supply {ma} mA (absolute maximum {max} mA).", { pin: p, ma: Math.round(ma), max: this.spec.absMaxMa }, undefined, "overload");
      } else if (ma > this.spec.pinMa) this.warnOnce(`over-${p}`, "Pin {pin} supplies {ma} mA, more than the {max} mA recommended.", { pin: p, ma: Math.round(ma), max: this.spec.pinMa });
    }
    this.pinMa = pinMa;
    this.supplyMa = this.supplyMaNow();
    // a HIGH output pin wired straight to GND (or a LOW one to 5 V) is a short through the pin
    for (const [p, mode] of this.modes) {
      if (mode !== MODE.OUTPUT || this.damaged.has(p)) continue;
      const net = c.nets[this.pinNet(p)];
      if (!net) continue;
      const toGnd = net.nodes.some((x) => x.startsWith("m:GND")), toPwr = net.nodes.some((x) => x === "m:5V" || x === "m:3V3");
      const lvl = this.levels.get(p) ?? 0;
      if ((lvl && toGnd) || (!lvl && toPwr)) { this.damaged.add(p); this.event("error", "Pin {pin} is wired straight to {to}: driving it shorts the pin, and it was damaged.", { pin: p, to: toGnd ? "GND" : "5 V" }, undefined, "short"); }
    }
  }

  private servoMa() {
    let ma = 0;
    for (const k of this.circuit.comps.filter((x) => x.kind === "actuator")) {
      const onUsb = !this.circuit.nets[this.circuit.netOf(k.pins.find((p) => p.name === "VCC")!.node)]?.nodes.includes("p:+");
      const moving = Math.abs((this.servoAngle[k.ref] ?? 90) - this.targetFor(k)) > 0.5;
      if (onUsb && this.powered(k, "VCC", "GND")) ma += moving ? (CATALOG[k.moduleId].currentA ?? 0.25) * 1000 : 10;
    }
    return ma;
  }

  private targetFor(k: CircuitComp): number {
    const sig = this.circuit.netOf(k.pins.find((p) => p.name === "SIG")!.node);
    for (const [id, pin] of this.servoPin) if (this.pinNet(pin) === sig) return this.servoTarget.get(id) ?? this.servoAngle[k.ref] ?? 90;
    return this.servoAngle[k.ref] ?? 90;
  }

  /** Per millisecond: servos move at their speed; a supply over budget for 5 ms resets the board. */
  private physics(dtMs: number) {
    for (const k of this.circuit.comps.filter((x) => x.kind === "actuator")) {
      const vccNet = this.circuit.netOf(k.pins.find((p) => p.name === "VCC")!.node);
      const gndNet = this.circuit.netOf(k.pins.find((p) => p.name === "GND")!.node);
      const v = this.netVoltage(vccNet);
      const ground = this.netVoltage(gndNet) === 0;
      if (v === null || v < 4) { if ([...this.servoPin.values()].length) this.warnOnce(`servo-power-${k.ref}`, "{ref} has no power: connect its VCC (red) to 5 V", { ref: k.ref }); continue; }
      if (!ground) { this.warnOnce(`servo-gnd-${k.ref}`, "{ref} has no common ground with the board: the signal has no reference, so it jitters or does not move", { ref: k.ref }); continue; }
      const target = this.targetFor(k);
      const cur = this.servoAngle[k.ref] ?? 90;
      const step = 0.6 * dtMs; // SG90: 0.1 s per 60° → 0.6° per ms
      this.servoAngle[k.ref] = Math.abs(target - cur) <= step ? target : cur + Math.sign(target - cur) * step;
    }
    this.motorPhysics(dtMs);
    const total = (this.supplyMa = this.supplyMaNow());
    if (total > this.spec.usbMa) {
      if (this.overSince < 0) this.overSince = this.now;
      if (this.now - this.overSince > 5000 && this.machine) {
        this.resets++;
        this.event("error", "The board reset: the parts drew {ma} mA from USB, which gives {max} mA, and the 5 V rail sagged. Power the servo from its own supply.", { ma: Math.round(total), max: this.spec.usbMa }, undefined, "power");
        this.overSince = -1;
        this.restart(false);
      }
    } else this.overSince = -1;
    // keep a level trace of the analog-driven / PWM pins too
    for (const [p, duty] of this.pwm) { const tr = this.traces.get(p); if (!tr || tr[tr.length - 1].v !== duty) this.trace(p, duty); }
  }

  /** Motors: the driver's IA/IB levels (PWM duty) set speed and direction; the motor follows with a 0.1 s time constant. */
  private motorPhysics(dtMs: number) {
    for (const st of this.motors) {
      const k = this.circuit.comps.find((x) => x.ref === st.ref)!;
      const duty = (name: string) => {
        const net = this.circuit.nets[this.circuit.netOf(k.pins.find((p) => p.name === name)!.node)];
        const pin = net?.nodes.find((n) => n.startsWith("m:") && !/^m:(GND|5V|3V3|VIN)/.test(n))?.slice(2);
        if (!pin || this.modes.get(pin) !== MODE.OUTPUT) return 0;
        return (this.levels.get(pin) ?? 0) * (this.pwm.get(pin) ?? 1);
      };
      st.powered = this.powered(k, "VCC", "GND");
      if (!st.powered && (duty("IA") || duty("IB"))) this.warnOnce(`motor-power-${k.ref}`, "{ref} has no power: connect the driver's VCC to 5 V and GND to GND", { ref: k.ref });
      const target = st.powered ? duty("IA") - duty("IB") : 0;
      st.target = target;
      st.speed += (target - st.speed) * Math.min(1, dtMs / 100);
      st.angle = (st.angle + st.speed * (CATALOG[k.moduleId].rpm ?? 200) * 6 * (dtMs / 1000)) % 360; // rpm × 6 = degrees per second
    }
  }

  private motorsMa() {
    let ma = 0;
    for (const st of this.motors) {
      const k = this.circuit.comps.find((x) => x.ref === st.ref)!;
      const onUsb = !this.circuit.nets[this.circuit.netOf(k.pins.find((p) => p.name === "VCC")!.node)]?.nodes.includes("p:+");
      // running current grows with speed; while the motor is still getting up to speed it draws towards its stall current
      const m = CATALOG[k.moduleId];
      const lag = Math.abs((st.target ?? 0) - st.speed);
      if (onUsb && st.powered) ma += 15 + Math.abs(st.speed) * (m.currentA ?? 0.2) * 1000 + lag * Math.max(0, (m.stallMa ?? 800) - (m.currentA ?? 0.2) * 1000);
    }
    return ma;
  }

  /** Current from USB: the board itself, what its pins and 5 V / 3.3 V rails supply, and a servo or motors powered from it. */
  supplyMaNow() {
    let usb = this.spec.mcuMa + this.railMa + this.servoMa() + this.motorsMa();
    for (const l of this.lcds) if (l.on || this.lcdWiredRef(l.ref)) usb += 30;
    for (const k of this.circuit.comps) if (k.kind === "module" && this.powered(k, "VCC", "GND")) usb += (CATALOG[k.moduleId].currentA ?? 0) * 1000;
    for (const [, ma] of this.pinMa) usb += ma;
    return usb;
  }

  // ---------------------------------------------------------------- reporting

  event(kind: SimEvent["kind"], text: string, vars?: SimEvent["vars"], ref?: string, check?: string) {
    this.events.push({ t: this.now, kind, text, vars, ref, check });
    if (this.events.length > 200) this.events.shift();
  }
  private warnOnce(key: string, text: string, vars?: SimEvent["vars"]) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.event("warn", text, vars);
  }

  pins(): PinState[] {
    const used = new Set<string>([...this.modes.keys(), ...this.levels.keys()]);
    return [...used].sort().map((name) => ({ name, mode: this.modes.get(name) ?? MODE.INPUT, level: this.levels.get(name) ?? 0, pwm: this.pwm.get(name) ?? null, damaged: this.damaged.has(name), ma: this.pinMa.get(name) ?? 0 }));
  }

  /** Everything the AI and the UI need to know, compact. */
  snapshot() {
    return {
      board: this.spec.name,
      time_ms: Math.round(this.now / 1000),
      status: this.compileError ? `compile error line ${this.compileError.line}: ${this.compileError.message}` : this.machine?.status ?? "not started",
      pins: this.pins().map((p) => ({ pin: p.name, mode: ["INPUT", "OUTPUT", "INPUT_PULLUP"][p.mode], level: p.pwm !== null ? `PWM ${Math.round(p.pwm * 100)}%` : p.level ? "HIGH" : "LOW", mA: +p.ma.toFixed(1), damaged: p.damaged || undefined })),
      leds: this.leds.map((l) => ({ ref: l.ref, state: l.state, mA: +l.ma.toFixed(1) })),
      servos: Object.entries(this.servoAngle).map(([ref, a]) => ({ ref, angle: Math.round(a) })),
      buzzers: this.buzzing.map((b) => ({ ref: b.ref, on: b.on })),
      motors: this.motors.map((m) => ({ ref: m.ref, speed_pct: Math.round(m.speed * 100), powered: m.powered })),
      displays: this.lcds.map((l) => ({ ref: l.ref, text: l.on ? l.lines.map((x) => x.trimEnd()) : "(off)" })),
      inputs: this.inputs,
      supply_mA: Math.round(this.supplyMaNow()),
      resets: this.resets,
      serial_tail: this.serialOut.slice(-400),
      events: this.events.slice(-8).map((e) => ({ kind: e.kind, text: e.text, ...(e.vars ?? {}) })),
    };
  }
}

/** The sketch to run for a breadboard project: the user's edited code, or the generated one. */
export const sketchFor = (g: DeviceGraph, edited?: string | null, generated?: string) => edited ?? generated ?? "";

export { buildCircuit };
