// An assembly: a tree of blocks. The first block sits on the ground; every other block is fixed by one of its ports to a
// free port of a block already placed. Placing a block lines its port up with the parent's: same point, opposite
// directions, then an optional turn about that axis. So every position follows from the joins, nothing floats, and an
// edit can be checked before it is made (unknown port, port taken, mates that do not fit).
import { BLOCKS, paramsOf, type Port, type Vec3 } from "./blocks";

export interface BlockInstance { id: string; type: string; params: Record<string, number> }
export interface Join { child: string; childPort: string; parent: string; parentPort: string; /** turn about the joint axis, degrees */ angle: number }
export interface Assembly { blocks: BlockInstance[]; joins: Join[] }

// ---- small linear algebra (3×3 row-major rotation matrices) ----
export type Mat3 = [number, number, number, number, number, number, number, number, number];
const I3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const mulV = (m: Mat3, v: Vec3): Vec3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mul = (a: Mat3, b: Mat3): Mat3 => {
  const r = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
};
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Rotation by `deg` about a unit axis (Rodrigues). */
export function axisAngle(axis: Vec3, deg: number): Mat3 {
  const [x, y, z] = norm(axis), a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
/** The rotation that turns unit vector a onto unit vector b. */
function align(a: Vec3, b: Vec3): Mat3 {
  const c = dot(a, b);
  if (c > 1 - 1e-9) return I3;
  if (c < -1 + 1e-9) { const p = Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]); return axisAngle(p, 180); }
  return axisAngle(cross(a, b), (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI);
}
/** Axis and angle (deg) of a rotation matrix, for the CAD kernel's rotate(). */
export function toAxisAngle(m: Mat3): { axis: Vec3; deg: number } {
  const ang = Math.acos(Math.max(-1, Math.min(1, (m[0] + m[4] + m[8] - 1) / 2)));
  if (ang < 1e-9) return { axis: [0, 0, 1], deg: 0 };
  if (Math.abs(ang - Math.PI) < 1e-6) {
    // 180°: the axis is the column of (m + I) with the largest norm
    const cols: Vec3[] = [[m[0] + 1, m[3], m[6]], [m[1], m[4] + 1, m[7]], [m[2], m[5], m[8] + 1]];
    return { axis: norm(cols.sort((p, q) => Math.hypot(...q) - Math.hypot(...p))[0]), deg: 180 };
  }
  return { axis: norm([m[7] - m[5], m[2] - m[6], m[3] - m[1]]), deg: (ang * 180) / Math.PI };
}

export interface Placed { inst: BlockInstance; R: Mat3; t: Vec3; ports: (Port & { world: Vec3; worldDir: Vec3 })[] }

export const portsOf = (b: BlockInstance): Port[] => BLOCKS[b.type]?.ports(paramsOf(b.type, b.params)) ?? [];
export const rootOf = (a: Assembly) => a.blocks.find((b) => !a.joins.some((j) => j.child === b.id));

/** World position and rotation of every block, root first. */
export function place(a: Assembly): Placed[] {
  const out = new Map<string, Placed>();
  const put = (inst: BlockInstance, R: Mat3, t: Vec3) => {
    const ports = portsOf(inst).map((p) => ({ ...p, world: add(mulV(R, p.pos), t), worldDir: mulV(R, p.dir) }));
    out.set(inst.id, { inst, R, t, ports });
  };
  const root = rootOf(a);
  if (!root) return [];
  put(root, I3, [0, 0, 0]);
  // breadth first over the joins
  let frontier = [root.id];
  while (frontier.length) {
    const next: string[] = [];
    for (const pid of frontier) {
      const parent = out.get(pid)!;
      for (const j of a.joins.filter((x) => x.parent === pid)) {
        const inst = a.blocks.find((b) => b.id === j.child);
        const pp = parent.ports.find((p) => p.id === j.parentPort);
        const cp = inst && portsOf(inst).find((p) => p.id === j.childPort);
        if (!inst || !pp || !cp) continue;
        // the child's port faces the parent's port, then turns about the shared axis
        const target: Vec3 = [-pp.worldDir[0], -pp.worldDir[1], -pp.worldDir[2]];
        const R = mul(axisAngle(target, j.angle), align(norm(cp.dir), norm(target)));
        put(inst, R, sub(pp.world, mulV(R, cp.pos)));
        next.push(inst.id);
      }
    }
    frontier = next;
  }
  // lift everything so the lowest point stands on the ground (z = 0)
  const z0 = Math.min(...[...out.values()].flatMap((p) => corners(p).map((c) => c[2])));
  for (const p of out.values()) { p.t = [p.t[0], p.t[1], p.t[2] - z0]; p.ports = p.ports.map((q) => ({ ...q, world: [q.world[0], q.world[1], q.world[2] - z0] })); }
  return [...out.values()];
}

/** The eight corners of a placed block's box, in world coordinates. */
export function corners(p: Placed): Vec3[] {
  const [x0, x1, y0, y1, z0, z1] = BLOCKS[p.inst.type].box(paramsOf(p.inst.type, p.inst.params));
  const out: Vec3[] = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(add(mulV(p.R, [x, y, z]), p.t));
  return out;
}

/** Centre of a placed block's box (its centre of mass: blocks are taken as uniform). */
export function centre(p: Placed): Vec3 {
  const [x0, x1, y0, y1, z0, z1] = BLOCKS[p.inst.type].box(paramsOf(p.inst.type, p.inst.params));
  return add(mulV(p.R, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]), p.t);
}

export const massOf = (b: BlockInstance) => BLOCKS[b.type]?.mass(paramsOf(b.type, b.params)) ?? 0;

/** Ids of a block and everything fixed to it, further from the root. */
export function subtree(a: Assembly, id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const j of a.joins.filter((x) => x.parent === out[i])) out.push(j.child);
  return out;
}

// ---- edits (each returns a new assembly or an error a person or the AI can act on) ----

export type EditResult = { assembly: Assembly; id?: string } | { error: string };

/** Readable ids: the block type and a number ("plate-1", "profile-20-2", "esp32-1"). */
const nextId = (a: Assembly, type: string) => {
  let n = 1;
  while (a.blocks.some((b) => b.id === `${type}-${n}`)) n++;
  return `${type}-${n}`;
};

/** Which ports of a block are free (not used by any join). */
export function freePorts(a: Assembly, id: string): Port[] {
  const b = a.blocks.find((x) => x.id === id);
  if (!b) return [];
  const used = new Set(a.joins.flatMap((j) => (j.parent === id ? [j.parentPort] : j.child === id ? [j.childPort] : [])));
  return portsOf(b).filter((p) => !used.has(p.id));
}

export function addBlock(a: Assembly, type: string, params: Record<string, number> = {}, attach?: { parent: string; parentPort: string; port: string; angle?: number }): EditResult {
  const def = BLOCKS[type];
  if (!def) return { error: `Unknown block type "${type}". Use one of: ${Object.keys(BLOCKS).join(", ")}.` };
  const inst: BlockInstance = { id: nextId(a, type), type, params: paramsOf(type, params) };
  if (!a.blocks.length) return { assembly: { blocks: [inst], joins: [] }, id: inst.id };
  if (!attach) return { error: "Say where it goes: a parent block, the parent's port and this block's port." };
  const parent = a.blocks.find((b) => b.id === attach.parent);
  if (!parent) return { error: `There is no block "${attach.parent}".` };
  const pp = freePorts(a, parent.id).find((p) => p.id === attach.parentPort);
  if (!pp) return { error: portsOf(parent).some((p) => p.id === attach.parentPort) ? `Port "${attach.parentPort}" of ${parent.id} is already used.` : `${parent.id} has no port "${attach.parentPort}". Free ports: ${freePorts(a, parent.id).map((p) => p.id).join(", ") || "none"}.` };
  const cp = portsOf(inst).find((p) => p.id === attach.port);
  if (!cp) return { error: `${def.name} has no port "${attach.port}". Its ports: ${portsOf(inst).map((p) => p.id).join(", ")}.` };
  if (cp.mate !== pp.mate) return { error: `A ${cp.mate} port cannot join a ${pp.mate} port (${parent.id}.${pp.id}). Mates must match: bolt to bolt, shaft to hub, horn to hub.` };
  const angle = Number.isFinite(attach.angle) ? ((attach.angle! % 360) + 360) % 360 : 0;
  return { assembly: { blocks: [...a.blocks, inst], joins: [...a.joins, { child: inst.id, childPort: cp.id, parent: parent.id, parentPort: pp.id, angle }] }, id: inst.id };
}

/** Remove a block and everything fixed to it. The root can only go when it is the last block. */
export function removeBlock(a: Assembly, id: string): EditResult {
  if (!a.blocks.some((b) => b.id === id)) return { error: `There is no block "${id}".` };
  if (rootOf(a)?.id === id && a.blocks.length > 1) return { error: `${id} carries everything else: remove the other blocks first.` };
  const gone = new Set(subtree(a, id));
  return { assembly: { blocks: a.blocks.filter((b) => !gone.has(b.id)), joins: a.joins.filter((j) => !gone.has(j.child)) } };
}

export function setParam(a: Assembly, id: string, name: string, value: number): EditResult {
  const b = a.blocks.find((x) => x.id === id);
  if (!b) return { error: `There is no block "${id}".` };
  const def = BLOCKS[b.type].params[name];
  if (!def) return { error: `${b.id} has no parameter "${name}". It has: ${Object.keys(BLOCKS[b.type].params).join(", ") || "none"}.` };
  if (!Number.isFinite(value) || value < def.min || value > def.max) return { error: `${name} must be ${def.min}–${def.max} ${def.unit}.` };
  return { assembly: { ...a, blocks: a.blocks.map((x) => (x.id === id ? { ...x, params: { ...x.params, [name]: value } } : x)) } };
}

export function turnJoin(a: Assembly, id: string, angle: number): EditResult {
  const j = a.joins.find((x) => x.child === id);
  if (!j) return { error: `${id} is not fixed to anything (it is the base).` };
  return { assembly: { ...a, joins: a.joins.map((x) => (x === j ? { ...x, angle: ((angle % 360) + 360) % 360 } : x)) } };
}

/** The catalog parts an assembly is made of (for the bill of materials, the shop and orders). */
export function partsOf(a: Assembly): { moduleId: string; qty: number }[] {
  const counts = new Map<string, number>();
  for (const b of a.blocks) { const id = BLOCKS[b.type]?.moduleId; if (id) counts.set(id, (counts.get(id) ?? 0) + 1); }
  return [...counts].map(([moduleId, qty]) => ({ moduleId, qty }));
}
