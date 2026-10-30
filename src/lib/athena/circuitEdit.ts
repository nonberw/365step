// Pure edit operations on a breadboard Layout. Each returns a new Device Graph (or an error message) and keeps the
// parts list in step with what is placed, so the BOM, cost and checks always describe the circuit on screen.
import { CATALOG, DeviceGraph, ModuleKind, replaceKindParts } from "./deviceGraph";
import {
  FOOT, LOGIC_PIN, MAX_OF, MCU_PINS, OFFBOARD, REF_PREFIX, ROLE_PIN, ROWS, WIRE_COLORS, buildCircuit, footHoles, layoutOf, railCount, validHole,
  type Layout, type PlacedComp, type PlacedWire, type Ref,
} from "./circuit";
import { t } from "./i18n";

export type EditResult = { graph: DeviceGraph; error?: undefined } | { graph?: undefined; error: string };

const KINDS_IN_PARTS: ModuleKind[] = ["base", "mcu"];
const kindOf = (id: string) => CATALOG[id]?.kind;
const colsOf = (g: DeviceGraph) => CATALOG[g.parts.find((p) => kindOf(p.moduleId) === "base")?.moduleId ?? "bb-half"].cols ?? 30;
const mcuOf = (g: DeviceGraph) => g.parts.find((p) => kindOf(p.moduleId) === "mcu")?.moduleId ?? "uno-r3";
export const holeKey = (c: number, r: string) => `${c}${r}`;
const sameRef = (a: Ref, b: Ref) => JSON.stringify(a) === JSON.stringify(b);

/** Store a layout and rebuild the parts list from it (board and MCU stay as they are). */
export function commit(g: DeviceGraph, layout: Layout): DeviceGraph {
  const counts = new Map<string, number>();
  layout.comps.forEach((c) => counts.set(c.moduleId, (counts.get(c.moduleId) ?? 0) + 1));
  const parts = [...g.parts.filter((p) => KINDS_IN_PARTS.includes(kindOf(p.moduleId))), ...[...counts].map(([moduleId, qty]) => ({ moduleId, qty }))];
  return { ...g, version: g.version + 1, circuit: { preset: g.circuit?.preset ?? "led", layout }, parts };
}

/** Holes already holding a lead (a part leg or a jumper end). */
export function usedHoles(layout: Layout, cols: number, skipRef?: string): Set<string> {
  const s = new Set<string>();
  for (const c of layout.comps) {
    if (c.ref === skipRef || c.c === undefined || !c.r || !FOOT[kindOf(c.moduleId)]) continue;
    footHoles(kindOf(c.moduleId), c.c, c.r).forEach((h) => s.add(holeKey(h.c, h.r)));
  }
  for (const w of layout.wires) for (const e of [w.a, w.b]) if (e.t === "hole" && validHole(e.c, e.r, cols)) s.add(holeKey(e.c, e.r));
  return s;
}

const nextRef = (layout: Layout, kind: ModuleKind) => {
  const prefix = REF_PREFIX[kind] ?? "X";
  const taken = new Set(layout.comps.map((c) => c.ref));
  let n = kind === "sensor" ? 2 : 1; // U1 is the microcontroller
  while (taken.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
};

/** Where would this part's legs go if its anchor were at (c, r)? null when it does not fit. */
export function fitComp(g: DeviceGraph, moduleId: string, c: number, r: string, skipRef?: string): string | null {
  const kind = kindOf(moduleId);
  if (!FOOT[kind]) return t("This part is not placed on the breadboard.");
  if (!ROWS.includes(r)) return t("Parts go in the main holes, not the power rails.");
  const cols = colsOf(g);
  const hs = footHoles(kind, c, r);
  if (!hs.every((h) => validHole(h.c, h.r, cols))) return t("It does not fit there.");
  const used = usedHoles(layoutOf(g), cols, skipRef);
  if (hs.some((h) => used.has(holeKey(h.c, h.r)))) return t("That hole is already taken.");
  return null;
}

export function placeComp(g: DeviceGraph, moduleId: string, c = 0, r = "e"): EditResult {
  const layout = layoutOf(g);
  const kind = kindOf(moduleId);
  const max = MAX_OF[kind];
  if (max !== undefined && layout.comps.filter((x) => kindOf(x.moduleId) === kind).length >= max)
    return { error: max === 1 ? t("Only one of these fits in a circuit.") : t("Up to {n} of these fit in a circuit.", { n: max }) };
  if (!OFFBOARD.includes(kind)) {
    const err = fitComp(g, moduleId, c, r);
    if (err) return { error: err };
  }
  const comp: PlacedComp = OFFBOARD.includes(kind) ? { ref: nextRef(layout, kind), moduleId } : { ref: nextRef(layout, kind), moduleId, c, r };
  return { graph: commit(g, { ...layout, comps: [...layout.comps, comp] }) };
}

export function moveComp(g: DeviceGraph, ref: string, c: number, r: string): EditResult {
  const layout = layoutOf(g);
  const comp = layout.comps.find((x) => x.ref === ref);
  if (!comp || comp.c === undefined) return { error: t("Nothing to move.") };
  const kind = kindOf(comp.moduleId);
  const row = FOOT[kind]?.pins.some((p) => p.row) ? comp.r! : r; // straddling parts keep their rows
  const err = fitComp(g, comp.moduleId, c, row, ref);
  if (err) return { error: err };
  if (comp.c === c && comp.r === row) return { graph: g };
  return { graph: commit(g, { ...layout, comps: layout.comps.map((x) => (x.ref === ref ? { ...x, c, r: row } : x)) }) };
}

export function removeComp(g: DeviceGraph, ref: string): DeviceGraph {
  const layout = layoutOf(g);
  const touches = (e: Ref) => e.t === "pin" && e.ref === ref;
  return commit(g, { comps: layout.comps.filter((x) => x.ref !== ref), wires: layout.wires.filter((w) => !touches(w.a) && !touches(w.b)) });
}

export function swapComp(g: DeviceGraph, ref: string, moduleId: string): DeviceGraph {
  if (!g.circuit?.layout) return replaceKindParts(g, moduleId);
  const layout = g.circuit.layout;
  return commit(g, { ...layout, comps: layout.comps.map((x) => (x.ref === ref && kindOf(x.moduleId) === kindOf(moduleId) ? { ...x, moduleId } : x)) });
}

/** Jumper colour by what it carries: red for power, black for ground, otherwise a signal colour. */
export function autoColor(a: Ref, b: Ref, n: number): string {
  const name = (e: Ref) => (e.t === "mcu" ? e.pin : e.t === "hole" ? (e.r === "TN" || e.r === "BN" ? "GND" : e.r === "TP" || e.r === "BP" ? "5V" : "") : e.pin === "GND" || e.pin === "−" ? "GND" : e.pin === "VCC" || e.pin === "+" ? "5V" : "");
  const x = [name(a), name(b)];
  if (x.some((s) => s.startsWith("GND"))) return WIRE_COLORS[1];
  if (x.some((s) => s === "5V" || s === "3V3" || s === "VIN")) return WIRE_COLORS[0];
  return [WIRE_COLORS[2], WIRE_COLORS[3], WIRE_COLORS[4], WIRE_COLORS[5]][n % 4];
}

export function addWire(g: DeviceGraph, a: Ref, b: Ref): EditResult {
  const layout = layoutOf(g);
  const cols = colsOf(g);
  if (sameRef(a, b)) return { error: t("Pick two different points.") };
  const pins = MCU_PINS[mcuOf(g)];
  const offboard = buildCircuit(g).comps.filter((c) => c.offBoard);
  const used = usedHoles(layout, cols);
  for (const e of [a, b]) {
    if (e.t === "hole") {
      if (!validHole(e.c, e.r, cols)) return { error: t("There is no hole there.") };
      if (used.has(holeKey(e.c, e.r))) return { error: t("That hole is already taken.") };
    } else if (e.t === "mcu") {
      if (!(e.pin in pins)) return { error: t("There is no such pin.") };
    } else if (!offboard.some((c) => c.ref === e.ref && c.pins.some((p) => p.name === e.pin))) return { error: t("There is no such pin.") };
    if (e.t !== "hole" && layout.wires.some((w) => sameRef(w.a, e) || sameRef(w.b, e))) return { error: t("That pin already has a wire.") };
  }
  const wire: PlacedWire = { color: autoColor(a, b, layout.wires.length), a, b };
  return { graph: commit(g, { ...layout, wires: [...layout.wires, wire] }) };
}

export const removeWire = (g: DeviceGraph, i: number): DeviceGraph => { const l = layoutOf(g); return commit(g, { ...l, wires: l.wires.filter((_, k) => k !== i) }); };
export const recolorWire = (g: DeviceGraph, i: number, color: string): DeviceGraph => { const l = layoutOf(g); return commit(g, { ...l, wires: l.wires.map((w, k) => (k === i ? { ...w, color } : w)) }); };
export const clearCircuit = (g: DeviceGraph): DeviceGraph => commit(g, { comps: [], wires: [] });

// ---- kind-level changes on an edited circuit (swap MCU / board / LED colour / add a supply) ----

function remapPin(from: string, to: string, pin: string): string | null {
  const target = MCU_PINS[to];
  if (/^(GND|5V|3V3)/.test(pin)) return pin in target ? pin : pin.startsWith("GND") ? "GND" : null;
  const role = Object.entries(ROLE_PIN[from] ?? {}).find(([, p]) => p === pin)?.[0];
  return role ? (ROLE_PIN[to]?.[role] ?? null) : null;
}

/** replaceKind() for a hand-edited circuit: parts are derived from the layout, so change the layout. */
export function applyKindToLayout(g: DeviceGraph, moduleId: string): DeviceGraph {
  const kind = kindOf(moduleId);
  const layout = layoutOf(g);
  if (kind === "mcu" || kind === "base") {
    const swapped = replaceKindParts(g, moduleId); // board / MCU live in the parts list
    const cols = CATALOG[swapped.parts.find((p) => kindOf(p.moduleId) === "base")?.moduleId ?? "bb-half"].cols ?? 30;
    const from = mcuOf(g), to = mcuOf(swapped);
    const fix = (e: Ref): Ref | null => (e.t === "mcu" && from !== to ? (() => { const p = remapPin(from, to, e.pin); return p ? { t: "mcu", pin: p } : null; })() : e);
    const wires = layout.wires.flatMap((w) => { const a = fix(w.a), b = fix(w.b); return a && b ? [{ ...w, a, b }] : []; })
      .filter((w) => [w.a, w.b].every((e) => e.t !== "hole" || validHole(e.c, e.r, cols)));
    const comps = layout.comps.filter((c) => c.c === undefined || footHoles(kindOf(c.moduleId), c.c, c.r!).every((h) => validHole(h.c, h.r, cols)));
    return commit({ ...swapped, circuit: g.circuit }, { comps, wires });
  }
  if (kind === "psu") return addExternalPsu(g);
  if (!layout.comps.some((c) => kindOf(c.moduleId) === kind)) return g;
  return commit(g, { ...layout, comps: layout.comps.map((c) => (kindOf(c.moduleId) === kind ? { ...c, moduleId } : c)) });
}

/** Feed the servo and the motors from their own 5 V supply (placing one if needed) instead of the board. */
export function addExternalPsu(g: DeviceGraph): DeviceGraph {
  const layout = layoutOf(g);
  const psu = layout.comps.find((c) => kindOf(c.moduleId) === "psu") ?? { ref: "PS1", moduleId: "psu-5v-2a" };
  const comps: PlacedComp[] = layout.comps.includes(psu) ? layout.comps : [...layout.comps, psu];
  const loads = layout.comps.filter((c) => kindOf(c.moduleId) === "actuator" || kindOf(c.moduleId) === "motor");
  if (!loads.length) return commit(g, { comps, wires: layout.wires });
  const vccs: Ref[] = loads.map((l) => ({ t: "pin", ref: l.ref, pin: "VCC" }));
  const plus: Ref = { t: "pin", ref: psu.ref, pin: "+" }, minus: Ref = { t: "pin", ref: psu.ref, pin: "−" };
  const wires = layout.wires.filter((w) => ![...vccs, plus, minus].some((e) => sameRef(w.a, e) || sameRef(w.b, e)));
  const used = usedHoles({ comps, wires }, colsOf(g));
  let k = 1;
  while ((k % 6 === 0 || used.has(holeKey(k, "TN"))) && k <= railCount(colsOf(g))) k++;
  return commit(g, { comps, wires: [...wires, ...vccs.map((vcc) => ({ color: WIRE_COLORS[0], a: plus, b: vcc })), { color: WIRE_COLORS[1], a: minus, b: { t: "hole", c: k, r: "TN" } }] });
}

export const logicRailOf = (mcuId: string) => (LOGIC_PIN[mcuId] === "5V" ? "TP" : "BP");
