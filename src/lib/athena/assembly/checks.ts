// Checks for an assembled design: the whole structure, not a template. Every number comes from the block masses and
// where the joins put them (model.ts) and the formulas in physics.ts:
//   stability   — centre of mass against the support polygon on the ground, and the angle it tips at
//   bending     — each profile and link as a cantilever from its support, loaded by everything fixed beyond it
//   torque      — gravity moment about every motor shaft and servo horn, against the motor's torque
//   traction    — wheels driven by motors on a slope, like the rover check
//   power       — every consumer's rated current per supply voltage, against the supplies of that voltage
//   collisions  — the blocks' boxes overlapping where they are not joined (boxes, so an estimate)
import { CATALOG, totalCost, type Check, type DeviceGraph, type Severity } from "../deviceGraph";
import { G, LINK_TUBES, MATERIALS, PROFILES } from "../physics";
import { t } from "../i18n";
import { BLOCKS, type Vec3 } from "./blocks";
import { centre, corners, massOf, mulV, place, subtree, type Assembly, type Placed } from "./model";

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** Convex hull of 2-D points (monotone chain). */
function hull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const crossZ = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const q of p) { while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
/** Signed distance from a point to the inside of a convex polygon's edges (positive inside). */
function margin(poly: [number, number][], x: number, y: number): number {
  if (poly.length < 3) return -Infinity;
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1;
    m = Math.min(m, ((x - ax) * ey - (y - ay) * ex) / -l);
  }
  return m;
}

/** Separating-axis test for two placed boxes, shrunk a little so touching faces do not count. */
function overlap(a: Placed, b: Placed): boolean {
  const boxOf = (p: Placed) => {
    const [x0, x1, y0, y1, z0, z1] = BLOCKS[p.inst.type].box(p.inst.params);
    const c = mulV(p.R, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
    return { c: [c[0] + p.t[0], c[1] + p.t[1], c[2] + p.t[2]] as Vec3, h: [Math.max(0, (x1 - x0) / 2 - 1.5), Math.max(0, (y1 - y0) / 2 - 1.5), Math.max(0, (z1 - z0) / 2 - 1.5)], ax: [mulV(p.R, [1, 0, 0]), mulV(p.R, [0, 1, 0]), mulV(p.R, [0, 0, 1])] };
  };
  const A = boxOf(a), B = boxOf(b);
  const d = sub(B.c, A.c);
  const axes: Vec3[] = [...A.ax, ...B.ax];
  for (const u of A.ax) for (const v of B.ax) { const c = cross(u, v); if (len(c) > 1e-6) axes.push(c); }
  for (const L of axes) {
    const ra = A.ax.reduce((s, u, i) => s + A.h[i] * Math.abs(dot(u, L)), 0);
    const rb = B.ax.reduce((s, u, i) => s + B.h[i] * Math.abs(dot(u, L)), 0);
    if (Math.abs(dot(d, L)) > ra + rb) return false;
  }
  return true;
}

const name = (p: Placed) => `${p.inst.id} (${t(BLOCKS[p.inst.type].name)})`;
const UPGRADE: Record<string, string> = { "profile-20": "profile-30", nema17: "nema23", "motor-tt": "motor-jgb", "motor-jgb": "motor-planet", "servo-std": "servo-hv", "servo-hv": "servo-pro", "servo-pro": "servo-xl", "link-alu": "link-carbon", "psu-24-3": "psu-24-6", "psu-12-5": "psu-12-10", "battery-3s-5": "battery-3s-10" };
/** A fix that swaps one block for the next stronger one of its family, keeping its size and joins. */
const upgrade = (id: string, type: string) => (UPGRADE[type] ? { label: t("Use {name} for {id}", { name: t(BLOCKS[UPGRADE[type]].name), id }), apply: (g: DeviceGraph) => withAssembly(g, { ...g.assembly!, blocks: g.assembly!.blocks.map((b) => (b.id === id ? { ...b, type: UPGRADE[type] } : b)) }) } : undefined);

/** The graph with a new assembly, its parts list kept in step. */
export function withAssembly(g: DeviceGraph, a: Assembly): DeviceGraph {
  const counts = new Map<string, number>();
  for (const b of a.blocks) { const id = BLOCKS[b.type]?.moduleId; if (id) counts.set(id, (counts.get(id) ?? 0) + 1); }
  return { ...g, version: g.version + 1, assembly: a, parts: [...counts].map(([moduleId, qty]) => ({ moduleId, qty })) };
}

export function verifyAssembly(g: DeviceGraph): Check[] {
  const a = g.assembly ?? { blocks: [], joins: [] };
  const out: Check[] = [];
  if (!a.blocks.length) return [{ id: "empty", category: "Geometry", severity: "red", basis: "calc", title: t("Nothing built yet"), detail: t("Add a first block (a plate is a good base), then fix the others to its ports.") }];
  const placed = place(a);
  const byId = new Map(placed.map((p) => [p.inst.id, p]));
  const P = g.params;

  // ---- stability ----
  const mass = a.blocks.reduce((s, b) => s + massOf(b), 0) + P.payloadKg;
  const top = placed.reduce((hi, p) => (centre(p)[2] > centre(hi)[2] ? p : hi), placed[0]);
  const com = placed.reduce((s, p) => { const c = centre(p), m = massOf(p.inst); return [s[0] + c[0] * m, s[1] + c[1] * m, s[2] + c[2] * m] as Vec3; }, [0, 0, 0] as Vec3);
  // the payload rides on the highest block
  const tc = centre(top);
  const comW: Vec3 = [(com[0] + tc[0] * P.payloadKg) / mass, (com[1] + tc[1] * P.payloadKg) / mass, (com[2] + tc[2] * P.payloadKg) / mass];
  const feet = placed.flatMap((p) => corners(p)).filter((c) => c[2] < 1.5).map((c) => [c[0], c[1]] as [number, number]);
  const poly = hull(feet);
  const m = margin(poly, comW[0], comW[1]);
  const tip = m > 0 ? (Math.atan2(m, Math.max(comW[2], 1)) * 180) / Math.PI : 0;
  const sSev: Severity = m <= 0 ? "red" : tip < 10 ? "yellow" : "green";
  out.push({
    id: "stability", category: "Mechanics", severity: sSev, basis: "calc",
    title: m <= 0 ? t("It tips over: the centre of mass is outside its feet") : t("Stands steady: tips only past {deg}°", { deg: tip.toFixed(0) }),
    detail: sSev === "green" ? t("Total mass {kg} kg, centre of mass {h} mm high.", { kg: mass.toFixed(2), h: Math.round(comW[2]) }) : t("Widen the base or move heavy parts lower and nearer the middle."),
    why: t("Centre of mass of all blocks{payload} at ({x}, {y}, {z}) mm. The feet are the block corners touching the ground; the centre is {m} mm inside the edge of their outline, so it tips when tilted by atan({m} / {z}) = {deg}°.", { payload: P.payloadKg ? t(" and the {kg} kg payload", { kg: P.payloadKg }) : "", x: Math.round(comW[0]), y: Math.round(comW[1]), z: Math.round(comW[2]), m: Math.round(m), deg: tip.toFixed(1) }),
  });

  // ---- bending of every profile and link, as a cantilever from where it is held ----
  let worst: { p: Placed; stress: number; allow: number; defl: number; L: number; M: number; I: number; E: number } | null = null;
  for (const p of placed) {
    const role = BLOCKS[p.inst.type].role;
    const isProfile = !!PROFILES[p.inst.type], isLink = role === "link";
    if (!isProfile && !isLink) continue;
    const join = a.joins.find((j) => j.child === p.inst.id);
    const held = join ? p.ports.find((q) => q.id === join.childPort)! : p.ports.find((q) => q.id === "bottom") ?? p.ports[0];
    const axis = mulV(p.R, [0, 0, 1]);
    let M: Vec3 = [0, 0, 0];
    for (const id of subtree(a, p.inst.id)) {
      const q = byId.get(id); if (!q) continue;
      const mm = massOf(q.inst) + (q === top ? P.payloadKg : 0);
      M = [M[0], M[1], M[2]].map((v, i) => v + cross(sub(centre(q), held.world), [0, 0, -mm * G])[i]) as Vec3;
    }
    const along = dot(M, axis);
    const Mb = len(sub(M, [axis[0] * along, axis[1] * along, axis[2] * along])); // N·mm
    const sec = isProfile ? PROFILES[p.inst.type] : LINK_TUBES[p.inst.type].section;
    const E = isProfile ? MATERIALS.alu6063.E : LINK_TUBES[p.inst.type].material.E;
    const L = p.inst.params.length ?? 300;
    const stress = (Mb * sec.c) / sec.I;
    const defl = (Mb * L * L) / (2 * E * sec.I);
    const allow = isProfile ? MATERIALS.alu6063.strength / 2 : 60;
    if (!worst || defl > worst.defl) worst = { p, stress, allow, defl, L, M: Mb, I: sec.I, E };
  }
  if (worst) {
    const bSev: Severity = worst.stress > worst.allow ? "red" : worst.defl > 1 ? "yellow" : "green";
    out.push({
      id: "bending", category: "Mechanics", severity: bSev, basis: "calc", focus: BLOCKS[worst.p.inst.type].moduleId,
      title: t("Most bent: {block}, {d} mm, {s} MPa", { block: worst.p.inst.id, d: worst.defl.toFixed(2), s: worst.stress.toFixed(1) }),
      detail: bSev === "green" ? t("Every profile and link is stiff enough.") : bSev === "red" ? t("It is overloaded: it will bend for good.") : t("It bends more than 1 mm under the load."),
      why: t("{block}: bending moment {M} N·m at the point it is held, from everything fixed beyond it. Stress = M·c/I = {s} MPa (allowed {al} MPa); end deflection ≈ M·L²/(2·E·I) = {d} mm with L = {L} mm, I = {I} mm⁴, E = {E} GPa.", { block: name(worst.p), M: (worst.M / 1000).toFixed(2), s: worst.stress.toFixed(1), al: worst.allow, d: worst.defl.toFixed(2), L: worst.L, I: Math.round(worst.I), E: worst.E / 1000 }),
      fix: bSev === "green" ? undefined : upgrade(worst.p.inst.id, worst.p.inst.type),
    });
  }

  // ---- torque at every motor shaft and servo horn carrying something ----
  for (const p of placed) {
    const role = BLOCKS[p.inst.type].role;
    if (role !== "motor" && role !== "servo") continue;
    const outPort = p.ports.find((q) => q.mate === "shaft" || q.mate === "horn")!;
    const driven = a.joins.filter((j) => j.parent === p.inst.id && j.parentPort === outPort.id).map((j) => j.child);
    if (!driven.length) continue;
    if (driven.some((id) => BLOCKS[a.blocks.find((b) => b.id === id)!.type].role === "wheel")) continue; // wheels: see traction
    const axis = outPort.worldDir;
    let tq = 0;
    for (const id of driven.flatMap((d) => subtree(a, d))) {
      const q = byId.get(id)!;
      const mm = massOf(q.inst) + (q === top ? P.payloadKg : 0);
      tq += dot(cross(sub(centre(q), outPort.world), [0, 0, -mm * G]), axis);
    }
    const need = Math.abs(tq) / 1000; // N·m
    const have = CATALOG[BLOCKS[p.inst.type].moduleId!]?.momentNm ?? 0;
    const ratio = need > 1e-6 ? have / need : Infinity;
    const sev: Severity = ratio < 1 ? "red" : ratio < 1.5 ? "yellow" : "green";
    out.push({
      id: `torque-${p.inst.id}`, category: "Mechanics", severity: sev, basis: "calc", focus: BLOCKS[p.inst.type].moduleId,
      title: t("{block}: holds {have} N·m, the load needs {need} N·m", { block: p.inst.id, have, need: need.toFixed(2) }),
      detail: sev === "green" ? (need < 0.005 ? t("The axis is vertical: gravity does not turn it.") : t("Safety factor ×{f}.", { f: ratio.toFixed(1) })) : ratio < 1 ? t("The motor cannot hold the load.") : t("Safety factor below ×1.5."),
      why: t("Gravity moment about the {block} axis of everything it turns: Σ (r × m·g) · axis = {need} N·m. Static: starting and stopping need more.", { block: p.inst.id, need: need.toFixed(3) }),
      fix: sev === "green" ? undefined : upgrade(p.inst.id, p.inst.type),
    });
  }

  // ---- wheels: traction on the slope ----
  const drives = placed.filter((p) => BLOCKS[p.inst.type].role === "motor" && a.joins.some((j) => j.parent === p.inst.id && BLOCKS[a.blocks.find((b) => b.id === j.child)!.type].role === "wheel"));
  if (drives.length) {
    const wheelId = a.joins.find((j) => j.parent === drives[0].inst.id && BLOCKS[a.blocks.find((b) => b.id === j.child)!.type].role === "wheel")!.child;
    const r = (CATALOG[BLOCKS[a.blocks.find((b) => b.id === wheelId)!.type].moduleId!]?.diameterMm ?? 65) / 2000;
    const th = (P.slopeDeg * Math.PI) / 180;
    const F = mass * G * (Math.sin(th) + 0.03 * Math.cos(th));
    const need = (F * r) / drives.length;
    const weakest = drives.reduce((w, p) => ((CATALOG[BLOCKS[p.inst.type].moduleId!]?.momentNm ?? 0) < (CATALOG[BLOCKS[w.inst.type].moduleId!]?.momentNm ?? 0) ? p : w), drives[0]);
    const have = CATALOG[BLOCKS[weakest.inst.type].moduleId!]?.momentNm ?? 0;
    const ratio = have / need;
    const sev: Severity = ratio < 1 ? "red" : ratio < 1.5 ? "yellow" : "green";
    out.push({
      id: "traction", category: "Mechanics", severity: sev, basis: "calc", focus: BLOCKS[weakest.inst.type].moduleId,
      title: t("Slope {deg}°: needs {need} N·m per motor, {block} gives {have} N·m", { deg: P.slopeDeg, need: need.toFixed(2), block: weakest.inst.id, have }),
      detail: sev === "green" ? t("Safety factor ×{f}.", { f: ratio.toFixed(1) }) : t("It cannot climb this slope loaded."),
      why: t("F = M·g·(sinθ + 0.03·cosθ) = {M} kg × 9.81 × (…) = {F} N; per motor T = F·r / {n} with wheel radius {r} mm.", { M: mass.toFixed(2), F: F.toFixed(1), n: drives.length, r: (r * 1000).toFixed(1) }),
      fix: sev === "green" ? undefined : upgrade(weakest.inst.id, weakest.inst.type),
    });
  }

  // ---- power: consumers of each voltage against the supplies of that voltage ----
  const byVolt = new Map<number, { need: number; have: number; supplies: Placed[] }>();
  for (const p of placed) {
    const mod = CATALOG[BLOCKS[p.inst.type].moduleId ?? ""];
    if (!mod) continue;
    if (mod.supplyV) { const v = Math.round(mod.supplyV); const e = byVolt.get(v) ?? { need: 0, have: 0, supplies: [] }; e.have += mod.supplyA ?? 0; e.supplies.push(p); byVolt.set(v, e); }
    else if (mod.voltage && mod.voltage > 5 && mod.currentA) { const v = mod.voltage; const e = byVolt.get(v) ?? { need: 0, have: 0, supplies: [] }; e.need += mod.currentA; byVolt.set(v, e); }
  }
  // a 11.1 V pack feeds 12 V parts
  if (byVolt.has(11) && byVolt.has(12)) { const b = byVolt.get(11)!, e = byVolt.get(12)!; e.have += b.have; e.supplies.push(...b.supplies); byVolt.delete(11); }
  for (const [v, e] of byVolt) {
    if (!e.need) continue;
    const sev: Severity = e.have <= 0 || e.need > e.have ? "red" : e.need > e.have * 0.8 ? "yellow" : "green";
    const sp = e.supplies[0];
    out.push({
      id: `power-${v}`, category: "Electrics", severity: sev, basis: "calc", focus: sp ? BLOCKS[sp.inst.type].moduleId : undefined,
      title: e.have <= 0 ? t("Nothing supplies the {v} V parts", { v }) : t("{v} V: {need} A needed, supplies give {have} A", { v, need: e.need.toFixed(1), have: e.have }),
      detail: sev === "green" ? t("Supply headroom {pct}%.", { pct: Math.round((1 - e.need / e.have) * 100) }) : e.have <= 0 ? t("Add a supply of that voltage.") : t("The supply is too small for everything running at once."),
      why: t("Sum of the rated currents of the {v} V parts, all running at once (conservative). 5 V electronics run from USB or a regulator and are not counted here.", { v }),
      fix: sev === "green" || !sp ? undefined : upgrade(sp.inst.id, sp.inst.type),
    });
  }

  // ---- collisions between blocks that are not joined to each other ----
  const joined = new Set(a.joins.flatMap((j) => [`${j.child}|${j.parent}`, `${j.parent}|${j.child}`]));
  const clashes: string[] = [];
  for (let i = 0; i < placed.length; i++) for (let k = i + 1; k < placed.length; k++) {
    const x = placed[i], y = placed[k];
    if (joined.has(`${x.inst.id}|${y.inst.id}`)) continue;
    // a wheel on a shaft and the motor's own body share the hub region, so siblings on one parent are compared too
    if (overlap(x, y)) clashes.push(`${x.inst.id} ↔ ${y.inst.id}`);
  }
  out.push({
    id: "collisions", category: "Geometry", severity: clashes.length ? "yellow" : "green", basis: "estimate",
    title: clashes.length ? t("Parts overlap: {pairs}", { pairs: clashes.slice(0, 3).join(", ") }) : t("No parts overlap"),
    detail: clashes.length ? t("Move or turn one of them, or use a longer profile.") : t("Checked on the blocks' bounding boxes."),
    why: t("Each block is taken as its bounding box (a separating-axis test on oriented boxes, 1.5 mm shrunk so touching faces do not count). Round parts are smaller than their box, so an overlap here may be a near miss."),
  });

  // ---- cost ----
  const cost = totalCost(g);
  out.push({ id: "budget", category: "Commerce", severity: cost > g.budgetUsd ? "yellow" : "green", basis: "calc", title: t("Cost ${cost} / budget ${budget}", { cost, budget: g.budgetUsd }), detail: cost > g.budgetUsd ? t("Over budget.") : t("Within budget.") });
  out.push({ id: "stock", category: "Commerce", severity: "green", basis: "estimate", title: t("All items in stock"), detail: t("Prices and stock are examples: no supplier is connected yet.") });
  return out;
}
