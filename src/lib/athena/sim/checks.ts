// Automatic checks of a breadboard project in the simulator: the teacher states what the circuit must do ("the LED
// blinks once a second", "it beeps closer than 20 cm"), and the student's own sketch is run on the virtual board with
// scripted inputs (button presses, knob turns, an obstacle moving) while the outputs are recorded and judged.
// Pure TypeScript: the server runs the same checks on every saved work.
import type { DeviceGraph } from "../deviceGraph";
import type { Preset } from "../circuit";
import { Board } from "./board";

export type SimCondition =
  | { kind: "blink"; periodMs: number }
  | { kind: "button-output" }
  | { kind: "alarm-below"; cm: number }
  | { kind: "pot-servo" }
  | { kind: "pot-brightness" }
  | { kind: "sequence" }
  | { kind: "beeps-faster" }
  | { kind: "sweep" }
  | { kind: "serial"; text: string }
  | { kind: "dark-light" }
  | { kind: "display-temperature" }
  | { kind: "motor-knob" }
  | { kind: "dry-alarm" }
  | { kind: "motion-alarm" }
  | { kind: "avoids-obstacle" }
  | { kind: "follows-line" }
  | { kind: "pulses"; min: number; ms: number }
  | { kind: "knob-rate" }
  | { kind: "servo-input" }
  | { kind: "motor-input" }
  | { kind: "tracker" }
  | { kind: "drives-and-turns" }
  | { kind: "button-servo" }
  | { kind: "led-input" };

export interface CheckResult { pass: boolean; text: string; vars?: Record<string, string | number> }

/** What each condition means, for the teacher's picker. */
export const CONDITIONS: { kind: SimCondition["kind"]; label: string; needs: string[] }[] = [
  { kind: "blink", label: "The LED blinks with a period of {ms} ms", needs: ["led"] },
  { kind: "button-output", label: "The LED or buzzer is on exactly while the button is pressed", needs: ["button"] },
  { kind: "alarm-below", label: "The alarm sounds closer than {cm} cm and is quiet farther away", needs: ["sensor"] },
  { kind: "pot-servo", label: "The servo follows the knob", needs: ["pot", "actuator"] },
  { kind: "pot-brightness", label: "The knob sets the LED brightness", needs: ["pot", "led"] },
  { kind: "sequence", label: "Traffic light: green, then yellow, then red", needs: ["led"] },
  { kind: "beeps-faster", label: "Beeps more often as an object gets closer", needs: ["sensor"] },
  { kind: "sweep", label: "The servo sweeps across its range", needs: ["actuator"] },
  { kind: "serial", label: "Prints “{text}” to the Serial Monitor", needs: [] },
  { kind: "dark-light", label: "The light turns on in the dark and off in daylight", needs: ["module", "led"] },
  { kind: "display-temperature", label: "The display shows the temperature", needs: ["module", "display"] },
  { kind: "motor-knob", label: "The knob sets the motor speed", needs: ["pot", "motor"] },
  { kind: "dry-alarm", label: "Warns when the soil is dry and is quiet when it is wet", needs: ["module"] },
  { kind: "motion-alarm", label: "Sounds when something moves and is quiet otherwise", needs: ["module"] },
  { kind: "avoids-obstacle", label: "Drives forward and turns away from an obstacle", needs: ["sensor", "motor"] },
  { kind: "follows-line", label: "Steers towards the line under its sensors", needs: ["module", "motor"] },
  { kind: "pulses", label: "Flashes at least {n} times in {s} s", needs: [] },
  { kind: "knob-rate", label: "The knob sets how fast it flashes or beeps", needs: ["pot"] },
  { kind: "servo-input", label: "The servo moves when the sensor reading changes", needs: ["actuator"] },
  { kind: "motor-input", label: "The motor switches with the sensor reading", needs: ["motor"] },
  { kind: "tracker", label: "The servo turns towards the brighter side", needs: ["module", "actuator"] },
  { kind: "drives-and-turns", label: "Drives forward and turns", needs: ["motor"] },
  { kind: "button-servo", label: "Button presses move the servo", needs: ["button", "actuator"] },
  { kind: "led-input", label: "The LED brightness follows the sensor", needs: ["led"] },
];

/** The condition a starter circuit is built for. */
export function defaultCondition(preset: Preset | undefined): SimCondition {
  switch (preset) {
    case "button": case "doorbell": return { kind: "button-output" };
    case "distance": return { kind: "alarm-below", cm: 20 };
    case "servo": return { kind: "pot-servo" };
    case "dimmer": return { kind: "pot-brightness" };
    case "traffic": return { kind: "sequence" };
    case "parking": return { kind: "beeps-faster" };
    case "radar": return { kind: "sweep" };
    case "night": return { kind: "dark-light" };
    case "thermo": case "weather": return { kind: "display-temperature" };
    case "fan": return { kind: "motor-knob" };
    case "plant": return { kind: "dry-alarm" };
    case "alarm": return { kind: "motion-alarm" };
    case "obstacle": return { kind: "avoids-obstacle" };
    case "line": return { kind: "follows-line" };
    default: return { kind: "blink", periodMs: 1000 };
  }
}

export function cleanCondition(raw: unknown): SimCondition | null {
  const c = raw as SimCondition;
  if (!c || typeof c !== "object") return null;
  switch (c.kind) {
    case "blink": return Number.isFinite(c.periodMs) && c.periodMs >= 50 && c.periodMs <= 20000 ? { kind: "blink", periodMs: Math.round(c.periodMs) } : null;
    case "alarm-below": return Number.isFinite(c.cm) && c.cm >= 3 && c.cm <= 300 ? { kind: "alarm-below", cm: Math.round(c.cm) } : null;
    case "serial": return typeof c.text === "string" && c.text.trim() && c.text.length <= 60 ? { kind: "serial", text: c.text.trim() } : null;
    case "button-output": case "pot-servo": case "pot-brightness": case "sequence": case "beeps-faster": case "sweep":
    case "dark-light": case "display-temperature": case "motor-knob": case "dry-alarm": case "motion-alarm": case "avoids-obstacle": case "follows-line":
    case "knob-rate": case "servo-input": case "motor-input": case "tracker": case "drives-and-turns": case "button-servo": case "led-input": return { kind: c.kind };
    case "pulses": return Number.isFinite(c.min) && c.min >= 1 && c.min <= 100 && Number.isFinite(c.ms) && c.ms >= 500 && c.ms <= 20000 ? { kind: "pulses", min: Math.round(c.min), ms: Math.round(c.ms) } : null;
  }
  return null;
}

/** What an output does over time: sampled every millisecond. */
interface Rec { t: number; led: number[]; buzz: boolean[]; servo: number[] }

function record(b: Board, ms: number, out: Rec[], every = 1) {
  for (let i = 0; i < ms; i += every) {
    b.run(every);
    out.push({ t: b.now / 1000, led: b.leds.map((l) => l.brightness), buzz: b.buzzing.map((z) => z.on), servo: Object.values(b.servoAngle) });
  }
}

/** Rising edges of a boolean series. */
const edges = (xs: { t: number; on: boolean }[]) => xs.filter((x, i) => i > 0 && x.on && !xs[i - 1].on).map((x) => x.t);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

/** Run the sketch and judge the condition. */
export function runCheck(g: DeviceGraph, code: string, cond: SimCondition): CheckResult {
  const b = new Board(g);
  const err = b.load(code);
  if (err) return { pass: false, text: "The sketch does not compile: line {line}: {msg}", vars: { line: err.line, msg: err.message } };
  const rec: Rec[] = [];
  const btn = Object.keys(b.inputs.buttons)[0];
  const pot = Object.keys(b.inputs.pots)[0];
  const out = (r: Rec) => r.led.some((x) => x > 0.05) || r.buzz.some(Boolean);
  const fail = (text: string, vars?: CheckResult["vars"]): CheckResult => ({ pass: false, text, vars });
  const runtime = () => b.machine?.error ? fail("The sketch stopped with an error: line {line}: {msg}", { line: b.machine.error.line, msg: b.machine.error.message }) : null;

  switch (cond.kind) {
    case "blink": {
      if (!b.leds.length) return fail("There is no LED in the circuit.");
      record(b, Math.max(4000, cond.periodMs * 5), rec, 2);
      const on = rec.map((r) => ({ t: r.t, on: r.led.some((x) => x > 0.05) }));
      const ups = edges(on).filter((t) => t > 200);
      if (ups.length < 2) return runtime() ?? fail("The LED does not blink.");
      const period = median(ups.slice(1).map((t, i) => t - ups[i]));
      const ok = Math.abs(period - cond.periodMs) <= cond.periodMs * 0.15;
      return ok ? { pass: true, text: "The LED blinks every {ms} ms.", vars: { ms: Math.round(period) } } : fail("The LED blinks every {ms} ms instead of {want} ms.", { ms: Math.round(period), want: cond.periodMs });
    }
    case "button-output": {
      if (!btn) return fail("There is no button in the circuit.");
      record(b, 500, rec);
      const idle = rec.slice(-200).some(out);
      b.press(btn, true); rec.length = 0; record(b, 500, rec);
      const pressed = rec.slice(-200).every(out);
      b.press(btn, false); rec.length = 0; record(b, 500, rec);
      const released = !rec.slice(-200).some(out);
      if (idle) return fail("The output is on before the button is pressed.");
      if (!pressed) return runtime() ?? fail("Pressing the button does not switch the output on.");
      if (!released) return fail("The output stays on after the button is released.");
      return { pass: true, text: "The output follows the button." };
    }
    case "alarm-below": {
      if (!b.circuit.comps.some((k) => k.kind === "sensor")) return fail("There is no distance sensor in the circuit.");
      const at = (cm: number) => { b.setDistance(cm); rec.length = 0; record(b, 700, rec); return rec.slice(-500).filter(out).length / 500; };
      const far = at(cond.cm * 2.5), near = at(Math.max(3, cond.cm * 0.5)), justOut = at(cond.cm * 1.3);
      if (near < 0.1) return runtime() ?? fail("Nothing happens when an object is {cm} cm away.", { cm: Math.max(3, Math.round(cond.cm * 0.5)) });
      if (far > 0.05 || justOut > 0.05) return fail("The alarm also sounds farther than {cm} cm.", { cm: cond.cm });
      return { pass: true, text: "Alarm closer than {cm} cm, quiet farther away.", vars: { cm: cond.cm } };
    }
    case "pot-servo": {
      if (!pot) return fail("There is no knob (potentiometer) in the circuit.");
      if (!Object.keys(b.servoAngle).length) return fail("There is no servo in the circuit.");
      const angles: number[] = [];
      for (const p of [0.05, 0.5, 0.95]) { b.turn(pot, p); rec.length = 0; record(b, 600, rec); angles.push(rec[rec.length - 1].servo[0]); }
      const ok = angles[0] < 40 && Math.abs(angles[1] - 90) < 25 && angles[2] > 140;
      return ok ? { pass: true, text: "The servo follows the knob: {a}° / {b}° / {c}°.", vars: { a: Math.round(angles[0]), b: Math.round(angles[1]), c: Math.round(angles[2]) } }
        : runtime() ?? fail("Knob at 5% / 50% / 95% gives the servo {a}° / {b}° / {c}°: it does not follow.", { a: Math.round(angles[0]), b: Math.round(angles[1]), c: Math.round(angles[2]) });
    }
    case "pot-brightness": {
      if (!pot || !b.leds.length) return fail("The circuit needs a knob and an LED.");
      const lv: number[] = [];
      for (const p of [0.1, 0.5, 0.95]) { b.turn(pot, p); rec.length = 0; record(b, 300, rec); lv.push(b.leds[0].ma); }
      const ok = lv[0] < lv[1] && lv[1] < lv[2] && lv[2] > 1;
      return ok ? { pass: true, text: "Brightness rises with the knob: {a} → {b} → {c} mA.", vars: { a: lv[0].toFixed(1), b: lv[1].toFixed(1), c: lv[2].toFixed(1) } } : runtime() ?? fail("The LED current does not rise with the knob: {a} → {b} → {c} mA.", { a: lv[0].toFixed(1), b: lv[1].toFixed(1), c: lv[2].toFixed(1) });
    }
    case "sequence": {
      const refs = b.leds.map((l) => l.moduleId);
      const idx = (id: string) => refs.indexOf(id);
      const [gI, yI, rI] = [idx("led-green"), idx("led-yellow"), idx("led-red")];
      if (gI < 0 || yI < 0 || rI < 0) return fail("The traffic light needs a red, a yellow and a green LED.");
      record(b, 12000, rec, 5);
      const order: number[] = [];
      for (const r of rec) { const on = r.led.findIndex((x) => x > 0.05); if (on >= 0 && order[order.length - 1] !== on) order.push(on); }
      const s = order.map((i) => (i === gI ? "G" : i === yI ? "Y" : i === rI ? "R" : "?")).join("");
      return /GYR/.test(s + s) ? { pass: true, text: "Green → yellow → red, in order." } : runtime() ?? fail("The lights go {seq} instead of green → yellow → red.", { seq: s.slice(0, 8) || "—" });
    }
    case "beeps-faster": {
      if (!b.circuit.comps.some((k) => k.kind === "sensor")) return fail("There is no distance sensor in the circuit.");
      const rate = (cm: number) => { b.setDistance(cm); rec.length = 0; record(b, 2500, rec, 2); return edges(rec.map((r) => ({ t: r.t, on: out(r) }))).length; };
      const far = rate(50), near = rate(10);
      return near > far && near >= 3 ? { pass: true, text: "{near} beeps at 10 cm, {far} at 50 cm.", vars: { near, far } } : runtime() ?? fail("{near} beeps at 10 cm and {far} at 50 cm: it should beep more often when closer.", { near, far });
    }
    case "sweep": {
      if (!Object.keys(b.servoAngle).length) return fail("There is no servo in the circuit.");
      record(b, 8000, rec, 5);
      const a = rec.map((r) => r.servo[0]);
      const lo = Math.min(...a), hi = Math.max(...a);
      return hi - lo > 120 ? { pass: true, text: "The servo sweeps from {lo}° to {hi}°.", vars: { lo: Math.round(lo), hi: Math.round(hi) } } : runtime() ?? fail("The servo only moves between {lo}° and {hi}°.", { lo: Math.round(lo), hi: Math.round(hi) });
    }
    case "dark-light": {
      const lights = Object.keys(b.inputs.light);
      if (!lights.length || !b.leds.length) return fail("The circuit needs a light sensor and an LED.");
      const at = (v: number) => { for (const r of lights) b.setLight(r, v); rec.length = 0; record(b, 800, rec, 2); return rec.slice(-200).filter(out).length / 200; };
      const day = at(0.9), night = at(0.08), dayAgain = at(0.9);
      if (night < 0.8) return runtime() ?? fail("The light stays off in the dark.");
      if (day > 0.1 || dayAgain > 0.1) return fail("The light is on in daylight too.");
      return { pass: true, text: "On in the dark, off in daylight." };
    }
    case "display-temperature": {
      if (!b.lcds.length) return fail("There is no display in the circuit.");
      const shown = (c: number) => { b.setTemperature(c); record(b, 1500, rec, 10); const m = /-?\d+(?:\.\d+)?/.exec(b.lcds[0].lines.join(" ")); return m ? parseFloat(m[0]) : null; };
      const a = shown(18), c = shown(31);
      if (a === null || c === null) return runtime() ?? fail("The display shows no number: {text}", { text: b.lcds[0].on ? b.lcds[0].lines.join(" / ").trim() || "—" : "—" });
      const ok = Math.abs(a - 18) <= 1 && Math.abs(c - 31) <= 1;
      return ok ? { pass: true, text: "Shows {a} at 18 °C and {b} at 31 °C.", vars: { a, b: c } } : fail("Shows {a} at 18 °C and {b} at 31 °C: it should show the temperature.", { a, b: c });
    }
    case "motor-knob": {
      if (!pot || !b.motors.length) return fail("The circuit needs a knob and a motor.");
      const sp: number[] = [];
      for (const p of [0.05, 0.5, 0.95]) { b.turn(pot, p); record(b, 700, rec, 10); sp.push(Math.abs(b.motors[0].speed)); }
      const ok = sp[0] < sp[1] && sp[1] < sp[2] && sp[2] > 0.6;
      return ok ? { pass: true, text: "Motor speed follows the knob: {a} → {b} → {c} %.", vars: { a: Math.round(sp[0] * 100), b: Math.round(sp[1] * 100), c: Math.round(sp[2] * 100) } }
        : runtime() ?? fail("Motor speed {a} → {b} → {c} % as the knob turns: it should rise.", { a: Math.round(sp[0] * 100), b: Math.round(sp[1] * 100), c: Math.round(sp[2] * 100) });
    }
    case "dry-alarm": {
      const at = (v: number) => { b.setMoisture(v); rec.length = 0; record(b, 2000, rec, 5); return rec.filter(out).length; };
      const wet = at(0.85), dry = at(0.1), wetAgain = at(0.85);
      if (dry === 0) return runtime() ?? fail("Nothing happens when the soil is dry.");
      if (wet > 0 || wetAgain > 0) return fail("It also warns when the soil is wet.");
      return { pass: true, text: "Warns when dry, quiet when wet." };
    }
    case "motion-alarm": {
      const at = (on: boolean) => { b.setMotion(on); rec.length = 0; record(b, 600, rec, 2); return rec.slice(-150).filter(out).length / 150; };
      const still = at(false), moving = at(true), stillAgain = at(false);
      if (moving < 0.5) return runtime() ?? fail("Nothing happens when something moves.");
      if (still > 0.1 || stillAgain > 0.1) return fail("It sounds even when nothing moves.");
      return { pass: true, text: "Sounds with motion, quiet without." };
    }
    case "avoids-obstacle": {
      if (b.motors.length < 2) return fail("The robot needs two motors.");
      const at = (cm: number) => { b.setDistance(cm); record(b, 900, rec, 10); return b.motors.map((m) => m.speed); };
      const clear = at(120), close = at(8);
      const forward = clear.every((v) => v > 0.3);
      const turning = close[0] * close[1] < 0 || close.every((v) => v < -0.2);
      if (!forward) return runtime() ?? fail("With the way clear it does not drive forward (motors {a} % / {b} %).", { a: Math.round(clear[0] * 100), b: Math.round(clear[1] * 100) });
      if (!turning) return fail("At 8 cm from an obstacle it does not turn or back away (motors {a} % / {b} %).", { a: Math.round(close[0] * 100), b: Math.round(close[1] * 100) });
      return { pass: true, text: "Forward when clear, turns away at 8 cm." };
    }
    case "follows-line": {
      const lights = Object.keys(b.inputs.light);
      if (b.motors.length < 2 || lights.length < 2) return fail("The robot needs two light sensors and two motors.");
      const at = (l: number, r: number) => { b.setLight(lights[0], l); b.setLight(lights[1], r); record(b, 700, rec, 10); return b.motors.map((m) => m.speed); };
      const left = at(0.1, 0.9), right = at(0.9, 0.1);
      const ok = left[0] < left[1] - 0.2 && right[1] < right[0] - 0.2;
      return ok ? { pass: true, text: "Turns towards the line on either side." } : runtime() ?? fail("With the line on the left the motors run {a} % / {b} %; on the right {c} % / {d} %. It should slow the motor on the line's side.", { a: Math.round(left[0] * 100), b: Math.round(left[1] * 100), c: Math.round(right[0] * 100), d: Math.round(right[1] * 100) });
    }
    case "pulses": {
      record(b, cond.ms, rec, 2);
      const n = edges(rec.map((r) => ({ t: r.t, on: out(r) }))).length + (rec[0] && out(rec[0]) ? 1 : 0);
      return n >= cond.min ? { pass: true, text: "{n} flashes in {s} s.", vars: { n, s: cond.ms / 1000 } } : runtime() ?? fail("Only {n} flashes in {s} s, {min} expected.", { n, s: cond.ms / 1000, min: cond.min });
    }
    case "knob-rate": {
      if (!pot) return fail("There is no knob (potentiometer) in the circuit.");
      const rate = (p: number) => { b.turn(pot, p); rec.length = 0; record(b, 3000, rec, 2); return edges(rec.map((r) => ({ t: r.t, on: out(r) }))).length; };
      const slow = rate(0.05), fast = rate(0.95);
      const [lo, hi] = slow < fast ? [slow, fast] : [fast, slow];
      return hi >= lo * 1.6 && hi >= 3 ? { pass: true, text: "{a} and {b} flashes in 3 s at the two ends of the knob.", vars: { a: slow, b: fast } } : runtime() ?? fail("{a} and {b} flashes in 3 s at the two ends of the knob: the knob should change the rate.", { a: slow, b: fast });
    }
    case "servo-input": case "motor-input": case "led-input": {
      // flip whatever the circuit senses between two extremes and compare the output
      const lights = Object.keys(b.inputs.light);
      const sense = (hi: boolean) => {
        if (b.circuit.comps.some((k) => k.kind === "sensor")) b.setDistance(hi ? 150 : 5);
        lights.forEach((r) => b.setLight(r, hi ? 0.95 : 0.05));
        b.setTemperature(hi ? 36 : 15); b.setMoisture(hi ? 0.9 : 0.1); b.setMotion(hi);
        if (pot) b.turn(pot, hi ? 0.95 : 0.05);
        rec.length = 0; record(b, 1500, rec, 10);
        return cond.kind === "servo-input" ? (rec[rec.length - 1].servo[0] ?? 0) : cond.kind === "motor-input" ? Math.abs(b.motors[0]?.speed ?? 0) : (b.leds[0]?.ma ?? 0);
      };
      const a = sense(false), c = sense(true), a2 = sense(false);
      const unit = cond.kind === "servo-input" ? "°" : cond.kind === "motor-input" ? "%" : " mA";
      const show = (v: number) => (cond.kind === "motor-input" ? Math.round(v * 100) : cond.kind === "led-input" ? +v.toFixed(1) : Math.round(v));
      const gap = cond.kind === "servo-input" ? 60 : cond.kind === "motor-input" ? 0.5 : 4;
      const ok = Math.abs(c - a) >= gap && Math.abs(a2 - a) < gap / 3;
      return ok ? { pass: true, text: "The output changes with the sensor: {a}{u} and {b}{u}.", vars: { a: show(a), b: show(c), u: unit } } : runtime() ?? fail("The output barely changes with the sensor: {a}{u} and {b}{u}.", { a: show(a), b: show(c), u: unit });
    }
    case "tracker": {
      const lights = Object.keys(b.inputs.light);
      if (lights.length < 2 || !Object.keys(b.servoAngle).length) return fail("The tracker needs two light sensors and a servo.");
      const at = (l: number, r: number) => { b.setLight(lights[0], l); b.setLight(lights[1], r); record(b, 2500, rec, 10); return rec[rec.length - 1].servo[0]; };
      const toLeft = at(0.9, 0.2), toRight = at(0.2, 0.9);
      return Math.abs(toLeft - toRight) > 40 ? { pass: true, text: "Turns to {a}° and {b}° as the light moves.", vars: { a: Math.round(toLeft), b: Math.round(toRight) } } : runtime() ?? fail("Stays between {a}° and {b}° as the light moves.", { a: Math.round(toLeft), b: Math.round(toRight) });
    }
    case "drives-and-turns": {
      if (b.motors.length < 2) return fail("The car needs two motors.");
      let forward = false, turning = false;
      for (let i = 0; i < 400; i++) { b.run(20); const [l, r] = b.motors.map((m) => m.speed); if (l > 0.3 && r > 0.3) forward = true; if (l * r < 0 || Math.abs(l - r) > 0.5) turning = true; }
      return forward && turning ? { pass: true, text: "It drives forward and turns." } : runtime() ?? fail(forward ? "It never turns." : "It never drives forward.");
    }
    case "button-servo": {
      if (!btn || !Object.keys(b.servoAngle).length) return fail("The circuit needs a button and a servo.");
      record(b, 600, rec, 10);
      const start = rec[rec.length - 1].servo[0];
      let moved = 0;
      for (let i = 0; i < 4; i++) { b.press(btn, true); record(b, 150, rec, 10); b.press(btn, false); record(b, 600, rec, 10); moved = Math.max(moved, Math.abs(rec[rec.length - 1].servo[0] - start)); }
      return moved > 60 ? { pass: true, text: "Button presses move the servo by {a}°.", vars: { a: Math.round(moved) } } : runtime() ?? fail("The servo moves only {a}° after the button presses.", { a: Math.round(moved) });
    }
    case "serial": {
      // inputs change while it runs, so programs that react to them print too
      for (let i = 0; i < 6; i++) {
        if (btn) b.press(btn, i % 2 === 1);
        b.setMotion(i % 2 === 1);
        if (b.circuit.comps.some((k) => k.kind === "sensor")) b.setDistance(i % 2 === 1 ? 8 : 80);
        record(b, 700, rec, 10);
      }
      return b.serialOut.includes(cond.text) ? { pass: true, text: "Prints “{text}”.", vars: { text: cond.text } } : runtime() ?? fail("The Serial Monitor never shows “{text}”.", { text: cond.text });
    }
  }
}
