// AI tools for designs assembled from blocks. The model builds the design block by block; every edit is validated
// (model.ts) and a refused edit comes back as an error to act on. Free ports are described with the direction they
// face in the world ("down", "+Y"...), since a block's own axes turn with it.
import type { DeviceGraph } from "../deviceGraph";
import { BLOCKS, type Vec3 } from "./blocks";
import { addBlock, freePorts, place, removeBlock, setParam, turnJoin, type EditResult } from "./model";
import { withAssembly } from "./checks";

export const ASSEMBLY_TOOLS = ["list_block_types", "get_assembly", "add_block", "remove_block", "set_block_param", "turn_block"];

export const assemblyToolSchemas = [
  { type: "function" as const, function: { name: "list_block_types", description: "Every block type you can add: its parameters (with ranges) and its ports (id, mate type, what it is). Ports join only when their mate types match: bolt–bolt, shaft–shaft (a motor shaft into a hub), horn–horn (a servo horn into a link hub).", parameters: { type: "object", properties: {} } } },
  { type: "function" as const, function: { name: "get_assembly", description: "The design as built: every block with its parameters, where it is (centre, mm, z up), what it is fixed to, and its free ports with the world direction each one faces. Call it before adding blocks.", parameters: { type: "object", properties: {} } } },
  { type: "function" as const, function: { name: "add_block", description: "Add a block. The first block of an empty design is the base and needs no parent. Every other block is fixed by one of its ports (port) to a free port of a block already there (parent, parent_port); it is placed so the two ports meet face to face, then turned by angle degrees about that axis.", parameters: { type: "object", properties: { type: { type: "string" }, params: { type: "object", description: "parameter values, e.g. {\"length\": 400}" }, parent: { type: "string" }, parent_port: { type: "string" }, port: { type: "string" }, angle: { type: "number" } }, required: ["type"] } } },
  { type: "function" as const, function: { name: "remove_block", description: "Remove a block and everything fixed to it.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } } },
  { type: "function" as const, function: { name: "set_block_param", description: "Change a block parameter (a profile's length, a plate's width...).", parameters: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, value: { type: "number" } }, required: ["id", "name", "value"] } } },
  { type: "function" as const, function: { name: "turn_block", description: "Turn a block (and everything on it) about the axis of the port it is fixed by.", parameters: { type: "object", properties: { id: { type: "string" }, angle: { type: "number" } }, required: ["id", "angle"] } } },
];

const facing = (d: Vec3) => {
  const [x, y, z] = d.map((v) => Math.round(v * 100) / 100);
  if (z > 0.9) return "up"; if (z < -0.9) return "down";
  if (x > 0.9) return "+X"; if (x < -0.9) return "-X"; if (y > 0.9) return "+Y"; if (y < -0.9) return "-Y";
  return `(${x}, ${y}, ${z})`;
};

export function describeAssembly(g: DeviceGraph) {
  const a = g.assembly ?? { blocks: [], joins: [] };
  return {
    blocks: place(a).map((p) => {
      const j = a.joins.find((x) => x.child === p.inst.id);
      const [x0, x1, y0, y1, z0, z1] = BLOCKS[p.inst.type].box(p.inst.params);
      const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
      const centre = [0, 1, 2].map((i) => Math.round(p.R[i * 3] * c[0] + p.R[i * 3 + 1] * c[1] + p.R[i * 3 + 2] * c[2] + p.t[i]));
      return {
        id: p.inst.id, type: p.inst.type, params: p.inst.params, centre_mm: centre,
        fixed_to: j ? `${j.parent}.${j.parentPort} (by its ${j.childPort}, turned ${j.angle}°)` : "the ground (base)",
        free_ports: freePorts(a, p.inst.id).map((q) => { const w = p.ports.find((x) => x.id === q.id)!; return { id: q.id, mate: q.mate, faces: facing(w.worldDir), at_mm: w.world.map(Math.round) }; }),
      };
    }),
  };
}

export function runAssemblyTool(g: DeviceGraph, name: string, args: Record<string, unknown>): { graph: DeviceGraph; result: unknown } {
  const a = g.assembly ?? { blocks: [], joins: [] };
  if (name === "list_block_types")
    return { graph: g, result: { types: Object.values(BLOCKS).map((b) => ({ type: b.type, name: b.name, role: b.role, params: b.params, ports: b.ports(Object.fromEntries(Object.entries(b.params).map(([k, d]) => [k, d.default]))).map((p) => ({ id: p.id, mate: p.mate, what: p.label })) })) } };
  if (name === "get_assembly") return { graph: g, result: describeAssembly(g) };
  let r: EditResult;
  if (name === "add_block") {
    const params = args.params && typeof args.params === "object" ? Object.fromEntries(Object.entries(args.params as Record<string, unknown>).map(([k, v]) => [k, Number(v)])) : {};
    r = addBlock(a, String(args.type ?? ""), params, args.parent ? { parent: String(args.parent), parentPort: String(args.parent_port ?? ""), port: String(args.port ?? ""), angle: Number(args.angle ?? 0) } : undefined);
  } else if (name === "remove_block") r = removeBlock(a, String(args.id ?? ""));
  else if (name === "set_block_param") r = setParam(a, String(args.id ?? ""), String(args.name ?? ""), Number(args.value));
  else if (name === "turn_block") r = turnJoin(a, String(args.id ?? ""), Number(args.angle ?? 0));
  else return { graph: g, result: { error: `unknown tool ${name}` } };
  if ("error" in r) return { graph: g, result: { error: r.error } };
  const next = withAssembly(g, r.assembly);
  return { graph: next, result: { ok: true, ...(r.id ? { id: r.id } : {}), ...describeAssembly(next) } };
}
