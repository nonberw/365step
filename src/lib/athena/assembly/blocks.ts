// Building blocks for designs that are not one of the templates: profiles, plates, brackets, motors, wheels, servos,
// links and the electronics. Each block has its size, mass and attachment points (ports). A port is a position and an
// outward direction in the block's own frame, and a mate type: two ports join only if their mate types match
// ("bolt" faces bolt together, a "shaft" goes into a "hub", a servo "horn" drives a "hub").
// Pure data (no CAD kernel), shared by the browser, the server, the checks and the AI tools.
import { CATALOG } from "../deviceGraph";

export type Vec3 = [number, number, number];
export type Mate = "bolt" | "shaft" | "horn";
export interface Port { id: string; pos: Vec3; dir: Vec3; mate: Mate; label: string }
export interface ParamDef { default: number; min: number; max: number; unit: string; label: string }

export type BlockRole = "structure" | "motor" | "servo" | "wheel" | "caster" | "table" | "link" | "gripper" | "electronics" | "supply";
export interface BlockDef {
  type: string;
  name: string;
  /** catalog module behind it: price, stock, electrical data */
  moduleId?: string;
  role: BlockRole;
  params: Record<string, ParamDef>;
  /** box in the block's own frame: [x0, x1, y0, y1, z0, z1] mm */
  box: (p: Record<string, number>) => [number, number, number, number, number, number];
  mass: (p: Record<string, number>) => number;
  ports: (p: Record<string, number>) => Port[];
  color: string;
}

const X: Vec3 = [1, 0, 0], NX: Vec3 = [-1, 0, 0], Y: Vec3 = [0, 1, 0], NY: Vec3 = [0, -1, 0], Z: Vec3 = [0, 0, 1], NZ: Vec3 = [0, 0, -1];
const cat = (id: string) => CATALOG[id];

/** An aluminium profile standing along +Z: ends and side slots near the top and in the middle. */
function profile(type: string, s: number, kgPerM: number): BlockDef {
  return {
    type, name: `Aluminium profile ${s}×${s}`, moduleId: type, role: "structure", color: "#b9bcc4",
    params: { length: { default: 300, min: 40, max: 1500, unit: "mm", label: "Length" } },
    box: (p) => [-s / 2, s / 2, -s / 2, s / 2, 0, p.length],
    mass: (p) => (kgPerM * p.length) / 1000,
    ports: (p) => {
      const L = p.length, h = s / 2;
      const side = (id: string, z: number, label: string): Port[] => [
        { id: `${id}+x`, pos: [h, 0, z], dir: X, mate: "bolt", label: `${label}, +X side` }, { id: `${id}-x`, pos: [-h, 0, z], dir: NX, mate: "bolt", label: `${label}, −X side` },
        { id: `${id}+y`, pos: [0, h, z], dir: Y, mate: "bolt", label: `${label}, +Y side` }, { id: `${id}-y`, pos: [0, -h, z], dir: NY, mate: "bolt", label: `${label}, −Y side` },
      ];
      return [
        { id: "bottom", pos: [0, 0, 0], dir: NZ, mate: "bolt", label: "Bottom end" },
        { id: "top", pos: [0, 0, L], dir: Z, mate: "bolt", label: "Top end" },
        ...side("top", L - h, "Near the top"), ...side("mid", L / 2, "Middle"),
      ];
    },
  };
}

/** A flat plate lying on its bottom face: the centre and four corners on both faces, and the middle of each edge. */
const plate: BlockDef = {
  type: "plate", name: "Aluminium plate, cut to size", moduleId: "plate-alu", role: "structure", color: "#2a2a2e",
  params: { width: { default: 200, min: 40, max: 1000, unit: "mm", label: "Width" }, length: { default: 300, min: 40, max: 1000, unit: "mm", label: "Length" }, thickness: { default: 8, min: 3, max: 30, unit: "mm", label: "Thickness" } },
  box: (p) => [-p.width / 2, p.width / 2, -p.length / 2, p.length / 2, 0, p.thickness],
  mass: (p) => (p.width * p.length * p.thickness * 2.7e-6),
  ports: (p) => {
    const w = p.width / 2, l = p.length / 2, t = p.thickness, i = 15;
    const corners: [string, number, number][] = [["front-left", -w + i, -l + i], ["front-right", w - i, -l + i], ["back-left", -w + i, l - i], ["back-right", w - i, l - i]];
    return [
      { id: "top", pos: [0, 0, t], dir: Z, mate: "bolt", label: "Top, centre" },
      { id: "bottom", pos: [0, 0, 0], dir: NZ, mate: "bolt", label: "Bottom, centre" },
      ...corners.map(([n, x, y]) => ({ id: `top-${n}`, pos: [x, y, t] as Vec3, dir: Z, mate: "bolt" as const, label: `Top, ${n} corner` })),
      ...corners.map(([n, x, y]) => ({ id: `bottom-${n}`, pos: [x, y, 0] as Vec3, dir: NZ, mate: "bolt" as const, label: `Bottom, ${n} corner` })),
      { id: "top-front", pos: [0, -l + i, t], dir: Z, mate: "bolt", label: "Top, front edge" }, { id: "top-back", pos: [0, l - i, t], dir: Z, mate: "bolt", label: "Top, back edge" },
      { id: "top-left", pos: [-w + i, 0, t], dir: Z, mate: "bolt", label: "Top, left edge" }, { id: "top-right", pos: [w - i, 0, t], dir: Z, mate: "bolt", label: "Top, right edge" },
      { id: "edge-left", pos: [-w, 0, t / 2], dir: NX, mate: "bolt", label: "Left edge face" }, { id: "edge-right", pos: [w, 0, t / 2], dir: X, mate: "bolt", label: "Right edge face" },
      { id: "edge-front", pos: [0, -l, t / 2], dir: NY, mate: "bolt", label: "Front edge face" }, { id: "edge-back", pos: [0, l, t / 2], dir: Y, mate: "bolt", label: "Back edge face" },
    ];
  },
};

/** A printed L-bracket (PETG): joins a face to a face at right angles. */
const bracket: BlockDef = {
  type: "bracket", name: "Printed L-bracket", moduleId: "bracket-l", role: "structure", color: "#52525b",
  params: {},
  box: () => [-20, 20, 0, 40, 0, 40],
  mass: () => 0.02,
  ports: () => [
    { id: "base", pos: [0, 20, 0], dir: NZ, mate: "bolt", label: "Base face" },
    { id: "face", pos: [0, 0, 20], dir: NY, mate: "bolt", label: "Upright face" },
  ],
};

/** A stepper standing on its flange, shaft up. */
function stepper(type: string, size: number, h: number): BlockDef {
  return {
    type, name: cat(type).name, moduleId: type, role: "motor", color: "#3f3f46",
    params: {},
    box: () => [-size / 2, size / 2, -size / 2, size / 2, 0, h],
    mass: () => cat(type).massKg,
    ports: () => [{ id: "base", pos: [0, 0, 0], dir: NZ, mate: "bolt", label: "Base" }, { id: "shaft", pos: [0, 0, h + 20], dir: Z, mate: "shaft", label: "Shaft" }],
  };
}

/** A gear motor lying on its side: flat base down, shaft out to +Y. */
function gearmotor(type: string, len: number, w: number): BlockDef {
  return {
    type, name: cat(type).name, moduleId: type, role: "motor", color: "#3f3f46",
    params: {},
    box: () => [-w / 2, w / 2, -len / 2, len / 2, 0, w],
    mass: () => cat(type).massKg,
    ports: () => [{ id: "base", pos: [0, 0, 0], dir: NZ, mate: "bolt", label: "Base" }, { id: "shaft", pos: [0, len / 2 + 12, w / 2], dir: Y, mate: "shaft", label: "Shaft" }],
  };
}

function wheel(type: string): BlockDef {
  const d = cat(type).diameterMm ?? 65;
  return {
    type, name: cat(type).name, moduleId: type, role: "wheel", color: "#e4e4e7",
    params: {},
    // the hub sits on the shaft; the wheel extends along +Z from it
    box: () => [-d / 2, d / 2, -d / 2, d / 2, 0, 26],
    mass: () => cat(type).massKg,
    ports: () => [{ id: "hub", pos: [0, 0, 0], dir: NZ, mate: "shaft", label: "Hub" }],
  };
}

function servo(type: string, L: number, T: number, W: number): BlockDef {
  return {
    type, name: cat(type).name, moduleId: type, role: "servo", color: "#3f3f46",
    params: {},
    box: () => [-L / 2, L / 2, -T / 2, T / 2, 0, W],
    mass: () => cat(type).massKg,
    ports: () => [{ id: "base", pos: [0, 0, 0], dir: NZ, mate: "bolt", label: "Base" }, { id: "horn", pos: [L / 4, 0, W + 2], dir: Z, mate: "horn", label: "Horn" }],
  };
}

function link(type: string): BlockDef {
  const perM = cat(type).massKg / 0.25;
  return {
    type, name: type === "link-carbon" ? "Carbon tube link" : "Aluminium tube link", moduleId: type, role: "link", color: type === "link-carbon" ? "#27272a" : "#b9bcc4",
    params: { length: { default: 200, min: 60, max: 600, unit: "mm", label: "Length" } },
    box: (p) => [-14, 14, -10, 10, 0, p.length],
    mass: (p) => (perM * p.length) / 1000,
    ports: (p) => [{ id: "hub", pos: [0, 0, 0], dir: NZ, mate: "horn", label: "Hub (on a servo horn)" }, { id: "end", pos: [0, 0, p.length], dir: Z, mate: "bolt", label: "Far end" }],
  };
}

/** An electronics or supply box resting on its base, with a mounting face on top. */
function box(type: string, role: BlockRole, x: number, y: number, z: number, color: string): BlockDef {
  return {
    type, name: cat(type).name, moduleId: type, role, color,
    params: {},
    box: () => [-x / 2, x / 2, -y / 2, y / 2, 0, z],
    mass: () => cat(type).massKg,
    ports: () => [{ id: "base", pos: [0, 0, 0], dir: NZ, mate: "bolt", label: "Base" }, { id: "top", pos: [0, 0, z], dir: Z, mate: "bolt", label: "Top" }],
  };
}

// Built on first use: the catalog (deviceGraph.ts) imports the assembly checks, so it is not ready while this module loads.
let built: Record<string, BlockDef> | null = null;
const build = (): Record<string, BlockDef> => Object.fromEntries([
  profile("profile-20", 20, 0.5), profile("profile-30", 30, 0.86), plate, bracket,
  stepper("nema17", 42, 40), stepper("nema23", 57, 56),
  gearmotor("motor-tt", 70, 22), gearmotor("motor-jgb", 70, 37), gearmotor("motor-planet", 85, 42),
  wheel("wheel-65"), wheel("wheel-100"),
  {
    type: "caster", name: "Ball caster", moduleId: "caster-ball", role: "caster", color: "#71717a", params: {},
    box: () => [-10, 10, -10, 10, -28, 0], mass: () => 0.03,
    ports: () => [{ id: "top", pos: [0, 0, 0], dir: Z, mate: "bolt", label: "Top plate" }],
  } satisfies BlockDef,
  {
    type: "turntable", name: cat("turntable").name, moduleId: "turntable", role: "table", color: "#e4e4e7",
    params: {},
    box: () => [-100, 100, -100, 100, 0, 20], mass: () => cat("turntable").massKg,
    ports: () => [{ id: "hub", pos: [0, 0, 0], dir: NZ, mate: "shaft", label: "Hub (on a motor shaft)" }, { id: "top", pos: [0, 0, 20], dir: Z, mate: "bolt", label: "Top" }],
  } satisfies BlockDef,
  servo("servo-std", 40, 20, 36), servo("servo-hv", 45, 24, 38), servo("servo-pro", 50, 28, 42), servo("servo-xl", 65, 30, 48),
  link("link-alu"), link("link-carbon"),
  {
    type: "gripper-par", name: cat("gripper-par").name, moduleId: "gripper-par", role: "gripper", color: "#d4d4d8",
    params: {},
    box: () => [-20, 20, -10, 10, 0, 84], mass: () => cat("gripper-par").massKg,
    ports: () => [{ id: "base", pos: [0, 0, 0], dir: NZ, mate: "bolt", label: "Base" }],
  } satisfies BlockDef,
  box("cam-usb", "electronics", 70, 45, 40, "#18181b"), box("ring-light", "electronics", 150, 150, 10, "#fff1b8"),
  box("esp32", "electronics", 28, 51, 10, "#166534"), box("drv8825", "electronics", 15, 20, 8, "#1d4ed8"), box("driver-dc", "electronics", 55, 45, 14, "#16a34a"),
  box("servo-bus", "electronics", 30, 25, 10, "#1d4ed8"), box("lidar-2d", "electronics", 60, 60, 40, "#27272a"),
  box("psu-24-3", "supply", 80, 120, 60, "#52525b"), box("psu-24-6", "supply", 90, 130, 60, "#52525b"), box("psu-12-5", "supply", 80, 110, 50, "#52525b"), box("psu-12-10", "supply", 90, 130, 60, "#52525b"),
  box("battery-3s-5", "supply", 138, 44, 26, "#fbbf24"), box("battery-3s-10", "supply", 150, 52, 48, "#fbbf24"), box("battery-nimh-12", "supply", 165, 66, 61, "#fbbf24"),
].map((b) => [b.type, b]));
export const BLOCKS: Record<string, BlockDef> = new Proxy({} as Record<string, BlockDef>, {
  get: (_, k) => (built ??= build())[k as string],
  has: (_, k) => k in (built ??= build()),
  ownKeys: () => Reflect.ownKeys((built ??= build())),
  getOwnPropertyDescriptor: (_, k) => Object.getOwnPropertyDescriptor((built ??= build()), k),
});

/** Parameter values with the defaults filled in and clamped to their range. */
export function paramsOf(type: string, given: Record<string, number> = {}): Record<string, number> {
  const def = BLOCKS[type];
  const out: Record<string, number> = {};
  for (const [k, d] of Object.entries(def?.params ?? {})) {
    const v = Number(given[k]);
    out[k] = Number.isFinite(v) ? Math.min(d.max, Math.max(d.min, v)) : d.default;
  }
  return out;
}
