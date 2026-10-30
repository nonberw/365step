// Runs the OpenCascade kernel (replicad) off the main thread, the way athena-ide does it:
// the student's code builds the shapes here, the page only receives triangle meshes and measurements.
import * as replicad from "replicad";
import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import type { CadMeasure } from "@shared/cadLessons";

export type ToCad = { type: "run"; id: number; code: string } | { type: "export"; id: number; format: "stl" | "step" };

export interface CadMesh {
  positions: Float32Array;
  normals: Float32Array;
  index: Uint32Array;
  lines: Float32Array;
  color: string;
}
export type FromCad =
  | { type: "ready"; ms: number }
  | { type: "built"; id: number; meshes: CadMesh[]; measure: CadMeasure; ms: number }
  | { type: "file"; id: number; data: ArrayBuffer; format: "stl" | "step" }
  | { type: "error"; id: number; message: string };

const post = (m: FromCad, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

let ready: Promise<void> | null = null;
const init = () =>
  (ready ??= (async () => {
    const t0 = performance.now();
    const oc = await (opencascade as unknown as (o: object) => Promise<unknown>)({ locateFile: () => wasmUrl });
    replicad.setOC(oc as Parameters<typeof replicad.setOC>[0]);
    post({ type: "ready", ms: Math.round(performance.now() - t0) });
  })());

let last: replicad.Shape3D[] = [];
const COLORS = ["#ff8562", "#4cc2ff", "#a78bfa", "#2bb673", "#e6b422"];

function collect(out: unknown): { shape: replicad.Shape3D; color: string }[] {
  const list = Array.isArray(out) ? out : [out];
  return list.map((x, i) => {
    const o = x as { shape?: replicad.Shape3D; color?: string };
    const shape = (o && typeof o === "object" && "shape" in o ? o.shape : x) as replicad.Shape3D;
    if (!shape || typeof (shape as { mesh?: unknown }).mesh !== "function") throw new Error("main должна вернуть тело (Shape3D): например, результат extrude() или makeBaseBox()");
    return { shape, color: o?.color ?? COLORS[i % COLORS.length] };
  });
}

async function run(id: number, code: string) {
  await init();
  const t0 = performance.now();
  for (const s of last) {
    try {
      s.delete();
    } catch {
      // already freed
    }
  }
  last = [];
  const main = new Function("replicad", `${code}\n;return typeof main === "function" ? main : null;`)(replicad) as ((r: typeof replicad) => unknown) | null;
  if (!main) throw new Error("В коде нет функции main(r)");
  const parts = collect(main(replicad));
  last = parts.map((p) => p.shape);
  const meshes: CadMesh[] = parts.map(({ shape, color }) => {
    const m = shape.mesh({ tolerance: 0.05, angularTolerance: 0.2 });
    const e = shape.meshEdges({ tolerance: 0.05, angularTolerance: 0.2 });
    return { positions: new Float32Array(m.vertices), normals: new Float32Array(m.normals), index: new Uint32Array(m.triangles), lines: new Float32Array(e.lines), color };
  });
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  let volume = 0;
  let faces = 0;
  for (const s of last) {
    const [a, b] = s.boundingBox.bounds;
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], a[i]);
      hi[i] = Math.max(hi[i], b[i]);
    }
    volume += replicad.measureVolume(s);
    faces += s.faces.length;
  }
  const measure: CadMeasure = { bbox: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], volume, faces };
  post(
    { type: "built", id, meshes, measure, ms: Math.round(performance.now() - t0) },
    meshes.flatMap((m) => [m.positions.buffer, m.normals.buffer, m.index.buffer, m.lines.buffer]),
  );
}

async function exportFile(id: number, format: "stl" | "step") {
  if (!last.length) throw new Error("Сначала построй деталь");
  const blob =
    format === "stl"
      ? (last.length === 1 ? last[0] : last.slice(1).reduce((a, b) => a.fuse(b), last[0])).blobSTL({ binary: true, tolerance: 0.02, angularTolerance: 0.1 })
      : replicad.exportSTEP(last.map((shape, i) => ({ shape, name: `part-${i + 1}`, color: COLORS[i % COLORS.length] })));
  const data = await blob.arrayBuffer();
  post({ type: "file", id, data, format }, [data]);
}

self.onmessage = (e: MessageEvent<ToCad>) => {
  const m = e.data;
  const job = m.type === "run" ? run(m.id, m.code) : exportFile(m.id, m.format);
  job.catch((err: unknown) => post({ type: "error", id: m.id, message: err instanceof Error ? err.message : String(err) }));
};
void init();
