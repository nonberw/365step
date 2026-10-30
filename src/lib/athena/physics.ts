// Engineering formulas behind the mechanical checks, with the material and section data they use.
// Every function is a textbook result (beam theory, statics, rigid-body geometry); the assumptions are written
// next to each one and repeated in the check's "Why?" text, so a user can redo the numbers by hand.
// Units: N, mm, MPa (N/mm²), kg, s — unless a name says otherwise.

export const G = 9.81;

// ---- materials ---------------------------------------------------------------

export interface Material { name: string; E: number; density: number; /** tensile strength of the solid material, MPa */ strength?: number }

/** Values from common datasheets (typical, not minimum guaranteed). */
export const MATERIALS = {
  alu6063: { name: "Aluminium 6063-T5", E: 69_000, density: 2.7e-6, strength: 145 },
  carbon: { name: "Carbon-fibre tube (roll-wrapped)", E: 110_000, density: 1.55e-6 },
  PLA: { name: "PLA", E: 3_500, density: 1.24e-6, strength: 50 },
  PETG: { name: "PETG", E: 2_000, density: 1.27e-6, strength: 45 },
  TPU: { name: "TPU", E: 30, density: 1.21e-6, strength: 30 },
} satisfies Record<string, Material>;

/** Printed parts are weaker than the solid material: layers bond worse than the filament itself, and infill is not solid.
 *  Knock-down 0.5 for FDM, then a safety factor of 2: the allowable stress is a quarter of the datasheet strength. */
export const FDM_KNOCKDOWN = 0.5;
export const PRINT_SAFETY = 2;
export const allowablePrinted = (m: Material) => ((m.strength ?? 0) * FDM_KNOCKDOWN) / PRINT_SAFETY;

// ---- sections ------------------------------------------------------------------

export interface Section { name: string; /** second moment of area, mm⁴ */ I: number; /** area, mm² */ A: number; /** extreme fibre distance, mm */ c: number }

export const tube = (od: number, id: number): Section => ({
  name: `Ø${od}×${(od - id) / 2} tube`,
  I: (Math.PI / 64) * (od ** 4 - id ** 4),
  A: (Math.PI / 4) * (od ** 2 - id ** 2),
  c: od / 2,
});
export const rect = (b: number, h: number): Section => ({ name: `${b}×${h}`, I: (b * h ** 3) / 12, A: b * h, c: h / 2 });

/** Slotted aluminium profiles: second moment of area from the manufacturers' tables (B-type, slot 6 / slot 8). */
export const PROFILES: Record<string, Section & { kgPerM: number }> = {
  "profile-20": { name: "20×20 profile", I: 6_982, A: 158, c: 10, kgPerM: 0.5 },
  "profile-30": { name: "30×30 profile", I: 27_100, A: 316, c: 15, kgPerM: 0.86 },
};

/** Arm link tubes: the same sizes the CAD model draws (src/lib/cad/arm.ts). */
export const LINK_TUBES: Record<string, { section: Section; material: Material }> = {
  "link-alu": { section: tube(18, 14), material: MATERIALS.alu6063 },
  "link-carbon": { section: tube(16, 12), material: MATERIALS.carbon },
};

// ---- beams -------------------------------------------------------------------------

/** Simply supported beam of span L with a point load W at mid-span plus its own weight w (N/mm): mid-span sag. */
export const simplySupportedSag = (W: number, w: number, L: number, E: number, I: number) => (W * L ** 3) / (48 * E * I) + (5 * w * L ** 4) / (384 * E * I);

/** First natural frequency (Hz) of a simply supported beam carrying a mass M (kg) at mid-span; the beam's own mass mb (kg)
 *  counts with the Rayleigh factor 17/35. Stiffness 48·E·I/L³ in N/mm, turned into N/m. */
export function beamFrequency(M: number, mb: number, L: number, E: number, I: number): number {
  const k = ((48 * E * I) / L ** 3) * 1000; // N/m
  return Math.sqrt(k / (M + (17 / 35) * mb)) / (2 * Math.PI);
}

/** Cantilever of length L: tip deflection for point loads (force N, distance from the root mm) and a uniform load w (N/mm). */
export function cantileverTip(loads: { F: number; a: number }[], w: number, L: number, E: number, I: number): number {
  const points = loads.reduce((s, { F, a }) => s + (F * a ** 2 * (3 * L - a)) / (6 * E * I), 0);
  return points + (w * L ** 4) / (8 * E * I);
}

/** Bending stress M·c/I. */
export const bendingStress = (M: number, s: Section) => (M * s.c) / s.I;

// ---- geometry ------------------------------------------------------------------------

/** Planar two-link arm reaching a point (x, z) from the shoulder at (0, zs): elbow-up solution, or null when out of reach. */
export function twoLinkIk(x: number, z: number, zs: number, L1: number, L2: number): { shoulder: number; elbow: number; elbowZ: number; d: number } | null {
  const dz = z - zs;
  const d = Math.hypot(x, dz);
  if (d > L1 + L2 || d < Math.abs(L1 - L2)) return null;
  const cosE = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  const elbow = -Math.acos(Math.max(-1, Math.min(1, cosE))); // elbow up
  const shoulder = Math.atan2(dz, x) - Math.atan2(L2 * Math.sin(elbow), L1 + L2 * Math.cos(elbow));
  return { shoulder, elbow, elbowZ: zs + L1 * Math.sin(shoulder), d };
}

/** Steepest ramp change a vehicle can take without its body touching: departure angle from the rear overhang (deg). */
export const departureDeg = (clearance: number, rearOverhang: number) => (Math.atan2(clearance, rearOverhang) * 180) / Math.PI;
/** Breakover angle over a crest between two contact points (deg). */
export const breakoverDeg = (clearance: number, wheelbase: number) => (2 * Math.atan2(2 * clearance, wheelbase) * 180) / Math.PI;

/** FDM clearance for a printed hole around a bought part: holes print about 0.1–0.2 mm small, so 0.2–0.6 mm slides in. */
export const FIT_MIN = 0.2;
export const FIT_MAX = 0.6;
export type FitResult = "tight" | "ok" | "loose";
export const fit = (hole: number, shaft: number): FitResult => (hole - shaft < FIT_MIN ? "tight" : hole - shaft > FIT_MAX ? "loose" : "ok");

// ---- motors ----------------------------------------------------------------------------

/** DC and servo motors: current rises about linearly with load torque between no-load and rated. */
export const motorCurrent = (torque: number, ratedTorque: number, ratedA: number, idleShare = 0.15) =>
  ratedA * (idleShare + (1 - idleShare) * Math.min(Math.abs(torque) / Math.max(ratedTorque, 1e-9), 3));

// ---- bought parts the geometry depends on -------------------------------------------------

/** NEMA motor front boss (pilot) diameter, mm — NEMA ICS 16 sizes. */
export const MOTOR_BOSS_MM: Record<string, number> = { nema17: 22, nema23: 38.1 };
/** Hole of the printed turntable adapter: the motor boss plus a sliding clearance. */
export const adapterHole = (motorId: string | undefined) => Math.round(((MOTOR_BOSS_MM[motorId ?? "nema17"] ?? 22) + 0.3) * 10) / 10;
/** Inner size of the printed battery tray: the pack plus 2 mm all round; walls 2.4 mm. */
export const TRAY_WALL = 2.4;
export const trayFor = (batteryId: string | undefined) => {
  const [l, w, h] = BATTERY_MM[batteryId ?? "battery-3s-5"] ?? BATTERY_MM["battery-3s-5"];
  return { l: l + 4 + 2 * TRAY_WALL, w: w + 4 + 2 * TRAY_WALL, h: Math.round(h * 0.6), t: TRAY_WALL };
};

/** Battery pack size, mm (length, width, height): typical packs of that rating — check your own pack. */
export const BATTERY_MM: Record<string, [number, number, number]> = {
  "battery-3s-5": [138, 44, 26],
  "battery-3s-10": [150, 52, 48],
  "battery-nimh-12": [165, 66, 61],
};
/** Bus servo body (length, thickness, width), mm — the CAD model draws the same boxes. */
export const SERVO_MM: Record<string, { L: number; T: number; W: number }> = {
  "servo-std": { L: 40, T: 20, W: 36 },
  "servo-hv": { L: 45, T: 24, W: 38 },
  "servo-pro": { L: 50, T: 28, W: 42 },
  "servo-xl": { L: 65, T: 30, W: 48 },
};
/** Rover drive motor body (length, width), mm. */
export const ROVER_MOTOR_MM: Record<string, { len: number; w: number }> = {
  "motor-tt": { len: 70, w: 22 },
  "motor-jgb": { len: 70, w: 37 },
  "motor-planet": { len: 85, w: 42 },
};

// Rover deck layout (top view, mm), as src/lib/cad/rover.ts places it: [x0, x1, y0, y1].
export const ROVER_DECK: { name: string; box: [number, number, number, number] }[] = [
  { name: "Motor driver", box: [17.5, 72.5, 50, 95] },
  { name: "ESP32 controller", box: [31, 59, -95.5, -44.5] },
  { name: "LiDAR", box: [80, 140, -30, 30] },
];
/** What a box centred at (cx, cy) of size l×w hits on the rover deck, including the chassis edge. */
export function deckClashes(cx: number, cy: number, l: number, w: number): string[] {
  const [x0, x1, y0, y1] = [cx - l / 2, cx + l / 2, cy - w / 2, cy + w / 2];
  const hits = ROVER_DECK.filter(({ box: [a0, a1, b0, b1] }) => x0 < a1 && x1 > a0 && y0 < b1 && y1 > b0).map((d) => d.name);
  if (x0 < -150 || x1 > 150 || y0 < -100 || y1 > 100) hits.push("Chassis edge");
  return hits;
}

// Layout constants shared with the CAD generators, so checks and 3D agree.
export const ARM = { baseH: 30, fingerLen: 84 };
export const armShoulderZ = (servoId: string | undefined) => ARM.baseH + (SERVO_MM[servoId ?? "servo-std"] ?? SERVO_MM["servo-std"]).T + 4 + 4 + 30;
export const ROVER = { axleX: -50, casterX: 130, rearX: -150, frontX: 150, casterR: 10, wheelY: 115, chassisT: 6 };
/** Height of the rover chassis underside above the ground. */
export const roverClearance = (wheelDia: number, motorId: string | undefined) => wheelDia / 2 + (ROVER_MOTOR_MM[motorId ?? "motor-tt"] ?? ROVER_MOTOR_MM["motor-tt"]).w / 2 + 3;
