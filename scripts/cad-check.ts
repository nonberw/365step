import path from "node:path";
import * as replicad from "replicad";
import opencascade from "replicad-opencascadejs";
import { CAD_LESSONS, checkCad, type CadMeasure } from "../shared/cadLessons";

// Builds a reference solution for every CAD lesson and runs the lesson's own check on it,
// so the expected sizes and volumes in shared/cadLessons.ts are proven, not guessed.
// Run: npx tsx scripts/cad-check.ts

const SOLUTIONS: Record<string, string> = {
  box: `function main(r) { return r.drawRectangle(40, 20).sketchOnPlane().extrude(10); }`,
  hole: `function main(r) { return r.drawRectangle(60, 40).sketchOnPlane().extrude(5).cut(r.makeCylinder(5, 7, [0, 0, -1])); }`,
  fillet: `function main(r) { return r.makeBaseBox(30, 30, 30).fillet(3); }`,
  cup: `function main(r) { return r.makeCylinder(25, 40).cut(r.makeCylinder(22, 40, [0, 0, 3])); }`,
  pattern: `function main(r) { let b = r.drawRectangle(100, 20).sketchOnPlane().extrude(3); for (let i = 0; i < 5; i++) b = b.cut(r.makeCylinder(2.5, 5, [(i - 2) * 20, 0, -1])); return b; }`,
  "motor-mount": `function main(r) { let m = r.makeBaseBox(30, 30, 4).fillet(4, (e) => e.inDirection("Z")); for (const [x, y] of [[8, 8], [-8, 8], [-8, -8], [8, -8]]) m = m.cut(r.makeCylinder(1.6, 6, [x, y, -1])); return m.cut(r.makeCylinder(4, 6, [0, 0, -1])); }`,
  dice: `function main(r) { return r.makeBaseBox(20, 20, 20).translate(0, 0, -10).intersect(r.makeSphere(14)); }`,
  vase: `function main(r) { return r.draw([0, 0]).hLine(25).smoothSplineTo([12, 50]).smoothSplineTo([20, 80]).hLine(-20).close().sketchOnPlane("XZ").revolve(); }`,
  "drone-arm": `function main(r) { let a = r.drawRoundedRectangle(110, 12, 3).sketchOnPlane().extrude(5); for (const x of [35, 51, -45, -25]) a = a.cut(r.makeCylinder(1.6, 7, [x, 0, -1])); return a; }`,
  bracket: `function main(r) { const t = 4; let b = r.makeBaseBox(40, 30, t).translate(20, 0, 0).fuse(r.makeBaseBox(t, 30, 40).translate(t / 2, 0, 0)); const rib = r.draw([t, 0]).lineTo([30, 0]).lineTo([t, 26]).close().sketchOnPlane("XZ", 2).extrude(-t).translate(0, 0, t); b = b.fuse(rib); for (const y of [-9, 9]) { b = b.cut(r.makeCylinder(2.2, 10, [30, y, -1])); b = b.cut(r.makeCylinder(2.2, 10, [-1, y, 28], [1, 0, 0])); } return b; }`,
  gear: `function main(r) { const N = 12, rOut = 20, rRoot = 16, w = 6; const pts = []; for (let i = 0; i < N; i++) { const a = (i / N) * 2 * Math.PI, s = Math.PI / N; for (const [rr, da] of [[rRoot, -s * 0.55], [rOut, -s * 0.25], [rOut, s * 0.25], [rRoot, s * 0.55]]) pts.push([rr * Math.cos(a + da), rr * Math.sin(a + da)]); } let d = r.draw(pts[0]); for (const p of pts.slice(1)) d = d.lineTo(p); return d.close().sketchOnPlane().extrude(w).cut(r.makeCylinder(2.5, w + 2, [0, 0, -1])); }`,
  enclosure: `function main(r) { let b = r.makeBaseBox(60, 40, 25).cut(r.makeBaseBox(56, 36, 25).translate(0, 0, 2)); for (const [x, y] of [[-24, -14], [24, -14], [-24, 14], [24, 14]]) b = b.fuse(r.makeCylinder(3, 23, [x, y, 0]).cut(r.makeCylinder(1.25, 24, [x, y, 1]))); return b.cut(r.makeCylinder(4, 10, [25, 0, 12], [1, 0, 0])); }`,
  lid: `function main(r) { const gap = 0.2; const top = r.makeBaseBox(60, 40, 2); const lipOut = r.makeBaseBox(56 - 2 * gap, 36 - 2 * gap, 4).translate(0, 0, -4); const lipIn = r.makeBaseBox(56 - 2 * gap - 3, 36 - 2 * gap - 3, 4).translate(0, 0, -4); return top.fuse(lipOut.cut(lipIn)).translate(0, 0, 4); }`,
  free: CAD_LESSONS.find((l) => l.id === "free")!.starter,
};

const wasm = path.resolve("node_modules/replicad-opencascadejs/dist/replicad_single.wasm");
const oc = await (opencascade as unknown as (o: object) => Promise<unknown>)({ locateFile: () => wasm });
replicad.setOC(oc as Parameters<typeof replicad.setOC>[0]);

let failed = 0;
for (const l of CAD_LESSONS) {
  const main = new Function("replicad", `${SOLUTIONS[l.id]}\n;return main;`)(replicad) as (r: typeof replicad) => replicad.Shape3D;
  const shape = main(replicad);
  const [a, b] = shape.boundingBox.bounds;
  const m: CadMeasure = { bbox: [b[0] - a[0], b[1] - a[1], b[2] - a[2]], volume: replicad.measureVolume(shape), faces: shape.faces.length };
  const starter = new Function("replicad", `${l.starter}\n;return main;`)(replicad) as (r: typeof replicad) => replicad.Shape3D;
  const s0 = starter(replicad);
  const [a0, b0] = s0.boundingBox.bounds;
  const starterOk = checkCad(l, { bbox: [b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]], volume: replicad.measureVolume(s0), faces: s0.faces.length }).ok;
  const r = checkCad(l, m);
  if (!r.ok) failed++;
  console.log(
    `${r.ok ? "OK  " : "FAIL"} ${l.id.padEnd(12)} bbox ${m.bbox.map((v) => v.toFixed(1)).join("×")} vol ${m.volume.toFixed(0)} faces ${m.faces}${r.ok ? "" : ` → ${r.notes.join("; ")}`}${starterOk && l.id !== "vase" && l.id !== "free" ? "  (!) starter already passes" : ""}`,
  );
}
process.exit(failed ? 1 : 0);
