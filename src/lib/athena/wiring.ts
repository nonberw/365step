// Step-by-step wiring guide for a breadboard circuit. Everything is derived from the same circuit the 3D view, netlist and
// checks use, so the guide can never describe a different circuit than the one on screen.
import { CATALOG, DeviceGraph, modName, modShort } from "./deviceGraph";
import { ROLE_PIN, WIRE_NAME, buildCircuit, footHoles, layoutOf, type CircuitComp, type CircuitWire, type Endpoint } from "./circuit";
import { resistorBands } from "./resistor";
import { t } from "./i18n";

export type Phase = "prepare" | "place" | "power" | "signal" | "test";
export const PHASES: Phase[] = ["prepare", "place", "power", "signal", "test"];

export interface GuideStep {
  id: string; phase: Phase; title: string; detail: string;
  why?: string; check?: string; warn?: string;
  parts: string[]; // catalog ids to focus in 3D
  compRef?: string; wireId?: string; // what the diagram highlights
}
export interface Guide {
  steps: GuideStep[];
  parts: { id: string; name: string; qty: number; note?: string }[];
  pinMap: { pin: string; goes: string; color: string; hex: string }[];
  expect: string; trouble: string[]; minutes: number;
}

const POWER_NODE = /^(m:(GND|5V|3V3|VIN)|p:[+-])/;
const isPowerPin = (n: string) => POWER_NODE.test(n) || /^m:GND/.test(n);
const RAIL_NAME: Record<string, () => string> = {
  TN: () => t("top − (blue) rail"), TP: () => t("top + (red) rail"), BP: () => t("bottom + (red) rail"), BN: () => t("bottom − (blue) rail"),
};
const isRail = (e: Endpoint) => !!e.hole && e.hole.r in RAIL_NAME;

/** Where an end of a wire goes, in words a beginner can follow. */
function where(e: Endpoint, mcuName: string): string {
  if (e.hole) return isRail(e) ? t("the {rail}, hole {c}", { rail: RAIL_NAME[e.hole.r](), c: e.hole.c }) : t("breadboard hole {hole}", { hole: e.label });
  if (e.node.startsWith("m:")) return t("pin {pin} on the {board}", { pin: e.label, board: mcuName });
  return e.label;
}

const itemName = (item: string) => { const [ref, pin] = item.split("."); return pin ? t("{ref} pin {pin}", { ref, pin }) : ref; };

function roleOf(pin: string, mcuId: string): string | undefined {
  const roles = ROLE_PIN[mcuId] ?? {};
  return Object.keys(roles).find((r) => roles[r] === pin);
}
const ROLE_TEXT: Record<string, () => string> = {
  led: () => t("Output: HIGH switches the LED on."), led2: () => t("Output: HIGH switches the LED on."), led3: () => t("Output: HIGH switches the LED on."),
  pwm: () => t("PWM output: the duty cycle sets the brightness."),
  button: () => t("Input: reads whether the button is pressed."),
  trig: () => t("Output: a 10 µs pulse here starts an ultrasonic measurement."),
  echo: () => t("Input: the length of the pulse is the distance."),
  buzzer: () => t("Output: HIGH sounds the buzzer."),
  servo: () => t("PWM output: the pulse width sets the servo angle."),
  pot: () => t("Analog input: reads the voltage on the potentiometer’s wiper."),
  light: () => t("Analog input: reads the light sensor (higher = brighter)."), light2: () => t("Analog input: reads the second light sensor."),
  temp: () => t("Analog input: reads the TMP36 voltage, 10 mV per degree."),
  soil: () => t("Analog input: reads the soil sensor (higher = wetter)."),
  motion: () => t("Input: HIGH while the PIR sensor sees movement."),
  motA: () => t("PWM output: the motor driver’s IA input sets the speed."), motB: () => t("Output: the motor driver’s IB input sets the direction."),
  mot2A: () => t("PWM output: the second driver’s IA input sets the speed."), mot2B: () => t("Output: the second driver’s IB input sets the direction."),
  sda: () => t("I2C data line to the display."), scl: () => t("I2C clock line to the display."),
};

function wireWhy(w: CircuitWire, mcuId: string, others: string): string {
  const nodes = [w.a.node, w.b.node];
  const has = (re: RegExp) => nodes.some((n) => re.test(n));
  if (has(/^m:GND/)) return t("Joins the board’s ground to the − rail, so every part shares one 0 V reference.");
  if (has(/^m:5V$/)) return t("Brings 5 V from the board to the + rail so parts can be powered from the rail.");
  if (has(/^m:3V3$/)) return t("Brings 3.3 V from the board to the + rail so parts can be powered from the rail.");
  if (has(/^p:\+$/)) return t("Carries the external supply’s + to the servo, so the board’s USB port does not have to power the motor.");
  if (has(/^p:-$/)) return t("Joins the supply’s − to the shared ground. The supply and the board must share a ground or the signal has no reference.");
  if (has(/^s:GND$/)) return t("Returns the servo’s ground to the − rail.");
  if (has(/^s:VCC$/)) return t("Powers the servo from the + rail.");
  if (has(/^s:SIG$/)) return t("Signal wire: the board sends the servo its target angle.");
  const rail = [w.a, w.b].find(isRail);
  if (rail) return rail.hole!.r.endsWith("N") ? t("Returns {items} to ground (the − rail).", { items: others }) : t("Powers {items} from the + rail.", { items: others });
  const mcu = [w.a, w.b].find((e) => e.node.startsWith("m:"));
  const role = mcu && roleOf(mcu.label, mcuId);
  return mcu ? t("Signal wire from pin {pin} to {items}. {fn}", { pin: mcu.label, items: others, fn: role ? ROLE_TEXT[role]?.() ?? "" : "" }).trim() : t("Connects {items}.", { items: others });
}

function placeStep(c: CircuitComp, pc: { c?: number; r?: string } | undefined): Pick<GuideStep, "title" | "detail" | "warn" | "check"> {
  const m = CATALOG[c.moduleId];
  const hole = (name: string) => { const h = pc?.c !== undefined && pc.r ? footHoles(c.kind, pc.c, pc.r).find((x) => x.name === name) : undefined; return h ? `${h.c}${h.r}` : "?"; };
  switch (c.kind) {
    case "resistor": {
      const ohm = m.ohm ?? 220, bands = resistorBands(ohm).map((b) => t(b)).join(" · ");
      return { title: t("Insert {ref}", { ref: c.ref }), detail: t("Put {ref} ({value}) into holes {a} and {b}. Its colour bands should read: {bands}. A resistor has no polarity, so either way round works.", { ref: c.ref, value: c.label.replace(`${c.ref} `, ""), a: hole("1"), b: hole("2"), bands }), check: t("The two legs are in different columns and nothing else shares those holes.") };
    }
    case "led":
      return { title: t("Insert {ref}", { ref: c.ref }), detail: t("Put the long leg (anode, +) of {ref} into hole {a} and the short leg (cathode, −, next to the flat side of the rim) into hole {k}.", { ref: c.ref, a: hole("A"), k: hole("K") }), warn: t("An LED only works one way round. Wrong polarity will not break it, but it stays dark: just flip it."), check: t("The long leg is on the side that connects to the resistor.") };
    case "button":
      return { title: t("Insert {ref}", { ref: c.ref }), detail: t("Press the button into holes {a}, {b}, {c} and {d} so it straddles the centre channel. It only fits in one orientation.", { ref: c.ref, a: hole("1"), b: hole("2"), c: hole("3"), d: hole("4") }), check: t("It clicks in firmly and the legs are not bent.") };
    case "pot":
      return { title: t("Insert {ref}", { ref: c.ref }), detail: t("Put the three legs of {ref} into holes {a}, {b} and {c}. The middle leg ({b}) is the wiper: it carries the signal.", { ref: c.ref, a: hole("1"), b: hole("W"), c: hole("3") }) };
    case "buzzer":
      return { title: t("Insert {ref}", { ref: c.ref }), detail: t("Put the leg marked + (the longer one) into hole {p} and the other leg into hole {m}.", { ref: c.ref, p: hole("+"), m: hole("−") }), warn: t("Use an active buzzer (it beeps by itself when powered). A passive one needs a tone signal."), };
    case "sensor":
      return { title: t("Insert {ref}", { ref: c.ref }), detail: t("Put the four pins of {ref} into holes {a} (VCC), {b} (TRIG), {c} (ECHO) and {d} (GND). The two round ‘eyes’ face away from the board.", { ref: c.ref, a: hole("VCC"), b: hole("TRIG"), c: hole("ECHO"), d: hole("GND") }), warn: t("Read the labels printed on the sensor: some modules are mirrored.") };
    case "actuator":
      return { title: t("Place {ref}", { ref: c.ref }), detail: t("Lay the servo next to the breadboard. Its cable has three wires: brown or black is GND, red is VCC (power), orange or yellow is the signal. Jumper wires connect to these three pins."), warn: t("Do not force the arm by hand: the gears can strip.") };
    case "psu":
      return { title: t("Place {ref}", { ref: c.ref }), detail: t("Put the external 5 V supply next to the breadboard. Keep it unplugged until the very end."), warn: t("Never connect more than 5 V to the board’s 5 V pin or the rails.") };
    case "module":
      return { title: t("Insert {ref}", { ref: c.ref }), detail: t("Put the three pins of {ref} ({name}) into holes {a} (VCC), {b} (OUT) and {c} (GND), with the sensor facing you.", { ref: c.ref, name: modName(c.moduleId), a: hole("VCC"), b: hole("OUT"), c: hole("GND") }),
        warn: c.moduleId === "tmp36" ? t("Hold the TMP36 with the flat side towards you: then the pins are +Vs, OUT, GND from left to right. Wired backwards it gets hot.") : t("Read the labels printed on the module: the pin order differs between makers.") };
    case "motor":
      return { title: t("Place {ref}", { ref: c.ref }), detail: t("Put the motor with its driver board (L9110S) next to the breadboard. The driver has four pins: IA and IB (control), VCC and GND (power)."), warn: t("Motors draw much more current than the board’s pins can give: never connect a motor straight to a pin, always through the driver.") };
    case "display":
      return { title: t("Place {ref}", { ref: c.ref }), detail: t("Lay the 16×2 display on the left of the breadboard. Its I2C adapter on the back has four pins: GND, VCC, SDA and SCL."), warn: t("If the screen lights up but shows nothing, turn the small contrast screw on the adapter.") };
    default:
      return { title: t("Place {ref}", { ref: c.ref }), detail: t("Place {name}.", { name: modName(c.moduleId) }) };
  }
}

const EXPECT: Record<string, () => string> = {
  led: () => t("The LED blinks: half a second on, half a second off."),
  button: () => t("The LED is lit only while the button is pressed."),
  traffic: () => t("Green for 4 seconds, yellow for 1, red for 4, then it repeats."),
  doorbell: () => t("The buzzer sounds for as long as you hold the button."),
  dimmer: () => t("Turning the knob changes the LED from off to full brightness."),
  distance: () => t("The buzzer sounds when your hand is closer than about 20 cm to the sensor."),
  parking: () => t("Beeps and flashes get faster as your hand moves closer than 60 cm."),
  servo: () => t("Turning the knob moves the servo arm between 0° and 180°."),
  radar: () => t("The servo sweeps back and forth. Open the Serial Monitor at 115200 baud to read the angle and distance pairs."),
  night: () => t("Cover the light sensor with your hand: the LED turns on. Uncover it: the LED turns off."),
  thermo: () => t("The display shows the temperature; hold the sensor between your fingers and watch it rise."),
  weather: () => t("The display shows the temperature on the first line and the light level on the second."),
  fan: () => t("Turning the knob changes the motor speed from stop to full."),
  plant: () => t("With the probe in dry soil the LED blinks and the buzzer beeps once a second; in wet soil it is quiet."),
  alarm: () => t("Wave your hand in front of the PIR sensor: the LED and buzzer switch on (the sensor needs about a minute to settle after power-up)."),
  obstacle: () => t("The wheels turn forward; hold your hand close to the sensor and the robot turns away."),
  line: () => t("Over white paper both motors run; when one sensor sees the black line, that side slows down."),
};

export function wiringGuide(g: DeviceGraph): Guide {
  const c = buildCircuit(g);
  const layout = layoutOf(g);
  const mcuName = modShort(c.mcuId);
  const boardId = g.parts.find((p) => CATALOG[p.moduleId].kind === "base")?.moduleId ?? "bb-half";
  const steps: GuideStep[] = [];
  const push = (s: Omit<GuideStep, "id">) => steps.push({ id: `s${steps.length + 1}`, ...s });
  const netItems = (node: string) => (c.nets[c.netOf(node)]?.items ?? []).filter((i) => !i.startsWith("U1.")).map(itemName);
  // the part legs sitting in exactly this column half (what a wire end actually touches)
  const localItems = (node: string) => c.comps.flatMap((k) => k.pins.filter((p) => p.node === node).map((p) => itemName(`${k.ref}.${p.name}`)));

  // ---- prepare ----
  push({ phase: "prepare", title: t("Get ready"), detail: t("Collect the parts from the checklist. Work on a clear, dry table."), warn: t("Unplug the USB cable and any supply while you build. Wire with the power off."), parts: [boardId] });
  push({ phase: "prepare", title: t("Set up the boards"), detail: t("Put the breadboard in front of you with the red and blue rail lines along the long edges. Put the {board} below it, with its pin headers facing the breadboard. Letters a–e are the holes above the centre channel, f–j below it; holes in the same numbered column and half are connected.", { board: mcuName }), parts: [boardId, c.mcuId] });

  // ---- place parts, left to right ----
  const placed = [...c.comps].sort((a, b) => (a.offBoard ? 1 : 0) - (b.offBoard ? 1 : 0) || a.center[0] - b.center[0]);
  for (const k of placed) {
    const pc = layout.comps.find((q) => q.ref === k.ref);
    const s = placeStep(k, pc);
    push({ phase: "place", ...s, parts: [k.moduleId], compRef: k.ref });
  }

  // ---- wires: feed the rails first, then the rest ----
  const rank = (w: CircuitWire) => (w.a.node.startsWith("m:") && isPowerPin(w.a.node)) || (w.b.node.startsWith("m:") && isPowerPin(w.b.node)) ? 0 : [w.a, w.b].some(isRail) || /^(p|s):/.test(w.a.node + w.b.node) ? 1 : 2;
  const localOf = (w: CircuitWire) => [w.a, w.b].filter((e) => !e.node.startsWith("m:") && !isRail(e)).flatMap((e) => localItems(e.node));
  const ordered = [...c.wires].sort((a, b) => rank(a) - rank(b));
  for (const w of ordered) {
    const others = (() => {
      const far = [w.a, w.b].find((e) => !e.node.startsWith("m:") && !isRail(e)) ?? w.b;
      const items = localItems(far.node);
      return items.length ? items.join(", ") : far.label;
    })();
    const phase: Phase = rank(w) < 2 ? "power" : "signal";
    const color = t(WIRE_NAME[w.color] ?? "any colour");
    const net = c.nets[c.netOf(w.a.node)];
    push({
      phase, title: t("Wire {id}: {a} → {b}", { id: w.id, a: w.a.label, b: w.b.label }),
      detail: t("Take one {color} jumper wire. Push one end into {a} and the other end into {b}.", { color, a: where(w.a, mcuName), b: where(w.b, mcuName) }),
      why: wireWhy(w, c.mcuId, others),
      check: net ? (localOf(w).length ? t("After this wire, {items} is connected to the “{net}” net.", { items: localOf(w).join(", "), net: net.name }) : t("After this wire, “{net}” joins: {items}.", { net: net.name, items: netItems(w.a.node).slice(0, 6).join(", ") || "—" })) : undefined,
      warn: phase === "power" ? t("Red for power, black for ground makes mistakes easy to spot.") : undefined,
      parts: [], wireId: w.id,
    });
  }

  // ---- test ----
  push({ phase: "test", title: t("Check your work"), detail: t("Compare the board with the diagram: every part in its holes, the LED the right way round, no bare legs touching each other, and the red and black wires on the right rails."), parts: [] });
  const expect = g.circuit?.layout || g.circuit?.kit ? t("Your custom circuit does what the sketch in the Code tab says.") : EXPECT[c.preset]?.() ?? t("The circuit does what the sketch in the Code tab says.");
  push({ phase: "test", title: t("Power it up"), detail: t("Plug in the USB cable. {expect}", { expect }), warn: t("If anything gets hot, smells, or the board resets, unplug it at once and look for a short between the + and − rails."), parts: [c.mcuId] });
  push({ phase: "test", title: t("Upload the sketch"), detail: t("Open the Code tab. In the desktop app press Upload to board; otherwise copy the sketch into the Arduino IDE and upload it."), parts: [] });

  // ---- summary data ----
  const parts = g.parts.filter((p) => CATALOG[p.moduleId].kind !== "wire").map((p) => ({
    id: p.moduleId, name: modName(p.moduleId), qty: p.qty,
    note: CATALOG[p.moduleId].kind === "resistor" ? resistorBands(CATALOG[p.moduleId].ohm ?? 220).map((b) => t(b)).join(" · ") : undefined,
  }));
  if (c.wires.length) parts.push({ id: "jumper-m2m", name: modName("jumper-m2m"), qty: c.wires.length, note: undefined });

  const pinMap = c.wires.flatMap((w) => {
    const m = [w.a, w.b].find((e) => e.node.startsWith("m:"));
    if (!m) return [];
    const far = m === w.a ? w.b : w.a;
    return [{ pin: m.label, goes: isRail(far) ? where(far, mcuName) : `${far.label}${localItems(far.node).length ? ` (${localItems(far.node).join(", ")})` : ""}`, color: t(WIRE_NAME[w.color] ?? "any colour"), hex: w.color }];
  });

  const kinds = new Set(c.comps.map((k) => k.kind));
  const trouble = [
    t("Nothing happens at all: check the USB cable and that the board’s power LED is lit."),
    ...(kinds.has("led") ? [t("An LED stays dark: flip it round, then check its resistor and that the cathode reaches the − rail.")] : []),
    ...(kinds.has("button") ? [t("The button does nothing: it must straddle the centre channel. Turn it 90° and press it in again.")] : []),
    ...(kinds.has("sensor") ? [t("The distance always reads 0: check that TRIG and ECHO are not swapped and that VCC and GND are on the right rails.")] : []),
    ...(kinds.has("pot") ? [t("The knob reading jumps around: the middle leg must go to the analog pin, the outer legs to 5 V and ground.")] : []),
    ...(kinds.has("actuator") ? [t("The servo twitches or the board resets: power the servo from its own supply, not from USB.")] : []),
    ...(kinds.has("buzzer") ? [t("The buzzer is silent: check which leg is + and that it is an active buzzer.")] : []),
    ...(kinds.has("module") ? [t("A sensor reads 0 or never changes: check VCC and GND, and that OUT goes to an analog pin (A0–A5 on the Uno).")] : []),
    ...(kinds.has("motor") ? [t("A motor does not turn: check the driver’s VCC and GND, and that IA is on a PWM pin. If the board resets when it starts, give the motors their own supply.")] : []),
    ...(kinds.has("display") ? [t("The display is blank: check SDA and SCL (A4 and A5 on the Uno), then turn the contrast screw on its back.")] : []),
    t("Anything hot or resetting: unplug immediately and look for + touching − somewhere."),
  ];
  return { steps, parts, pinMap, expect, trouble, minutes: Math.max(10, Math.round((5 + c.comps.length * 2 + c.wires.length) / 5) * 5) };
}
