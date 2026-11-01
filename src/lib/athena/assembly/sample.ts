// The starting design for "your own device": an inspection tower built from blocks — a base plate, a column, an arm
// that holds the camera over a turntable driven by a stepper, and the electronics on the plate. It shows how ports
// and joins work; the user (or the AI) changes it block by block.
import type { DeviceGraph } from "../deviceGraph";
import { addBlock, type Assembly } from "./model";
import { BLOCKS } from "./blocks";

export function sampleAssembly(): Assembly {
  let a: Assembly = { blocks: [], joins: [] };
  const add = (type: string, params: Record<string, number>, parent?: string, parentPort?: string, port?: string, angle = 0) => {
    const r = addBlock(a, type, params, parent ? { parent, parentPort: parentPort!, port: port!, angle } : undefined);
    if ("error" in r) throw new Error(r.error);
    a = r.assembly;
    return r.id!;
  };
  const base = add("plate", { width: 360, length: 360, thickness: 8 });
  const col = add("profile-20", { length: 420 }, base, "top-back", "bottom");
  const arm = add("profile-20", { length: 160 }, col, "top-y", "bottom");
  add("cam-usb", {}, arm, "top-y", "base"); // the arm's -Y side faces down once it sticks out from the column
  const motor = add("nema17", {}, base, "top", "base");
  add("turntable", {}, motor, "shaft", "hub");
  add("esp32", {}, base, "top-front-left", "base");
  add("drv8825", {}, base, "top-front-right", "base");
  add("psu-24-3", {}, base, "top-back-right", "base");
  return a;
}

export function sampleCustom(): DeviceGraph {
  const a = sampleAssembly();
  const counts = new Map<string, number>();
  for (const b of a.blocks) { const id = BLOCKS[b.type]?.moduleId; if (id) counts.set(id, (counts.get(id) ?? 0) + 1); }
  return {
    template: "custom", name: "My device", version: 1,
    params: { tableDiameterMm: 200, cameraHeightMm: 350, partMassKg: 1, link1Mm: 220, link2Mm: 180, payloadKg: 0, targetReachMm: 450, slopeDeg: 0, speedMs: 0.5, runtimeMin: 60 },
    parts: [...counts].map(([moduleId, qty]) => ({ moduleId, qty })),
    assembly: a, budgetUsd: 400, printerBedMm: 220,
  };
}
