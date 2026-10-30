// Quadcopter flight simulator: rigid-body dynamics (6 degrees of freedom) and a flight controller with a cascaded PID,
// the same structure as real autopilots (Betaflight / PX4): position → velocity → tilt angle → rotation rate → motors.
// World frame: x east, y north, z up (m). Body frame: x forward, y left, z up. "X" motor layout.
// Integration: semi-implicit Euler at 1 kHz. Model limits: no blade flapping or ground effect, linear motor lag,
// quadratic drag that is the same in every direction.

import type { DroneStats } from "./drone";

export type V3 = [number, number, number];
export type Quat = [number, number, number, number]; // w, x, y, z

export interface DroneState {
  t: number;
  pos: V3;
  vel: V3;
  q: Quat;
  /** body rotation rates, rad/s */
  rate: V3;
  /** motor thrust, N: front-right, rear-left, front-left, rear-right */
  thrust: [number, number, number, number];
  /** used battery charge, A·h */
  usedAh: number;
  current: number;
  landed: boolean;
  crashed: string | null;
  armed: boolean;
}

export interface Gains {
  /** altitude: position P, velocity P, velocity I */
  altP: number;
  altVelP: number;
  altVelI: number;
  /** horizontal position: position P, velocity P, velocity I (holds against the wind) */
  posP: number;
  velP: number;
  velI: number;
  /** attitude angle P and rate P / D */
  angP: number;
  rateP: number;
  rateD: number;
}

export const DEFAULT_GAINS: Gains = { altP: 1.2, altVelP: 4, altVelI: 1.5, posP: 0.9, velP: 2.2, velI: 0.6, angP: 7, rateP: 22, rateD: 0.6 };

/** What the pilot or the student's code asks for. */
export type Command =
  /** sticks: roll/pitch in [-1, 1] → up to ±30° tilt, yaw in [-1, 1] → ±180°/s, climb in [-1, 1] → ±3 m/s (altitude hold) */
  | { mode: "sticks"; roll: number; pitch: number; yaw: number; climb: number }
  /** fly to a point and hold it */
  | { mode: "position"; x: number; y: number; z: number; yaw?: number }
  /** raw: tilt angles (rad), yaw rate (rad/s) and collective thrust as a share of maximum */
  | { mode: "attitude"; roll: number; pitch: number; yawRate: number; throttle: number }
  | { mode: "off" };

export interface World {
  /** steady wind, m/s */
  wind: V3;
  /** gust strength, m/s */
  gust: number;
  /** extra mass picked up (cargo), kg */
  cargo: number;
}

const MOTORS = [
  { x: 1, y: -1, spin: -1 },
  { x: -1, y: 1, spin: -1 },
  { x: 1, y: 1, spin: 1 },
  { x: -1, y: -1, spin: 1 },
];
const KQ = 0.016; // yaw torque per newton of thrust, m
const MOTOR_TAU = 0.03; // s
const MAX_TILT = (35 * Math.PI) / 180;
const G = 9.81;

export function newState(pos: V3 = [0, 0, 0]): DroneState {
  return { t: 0, pos: [...pos], vel: [0, 0, 0], q: [1, 0, 0, 0], rate: [0, 0, 0], thrust: [0, 0, 0, 0], usedAh: 0, current: 0, landed: true, crashed: null, armed: false };
}

// ---- small vector helpers -----------------------------------------------------------

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function rotate(q: Quat, v: V3): V3 {
  const [w, x, y, z] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}

/** Roll (about x), pitch (about y), yaw (about z), rad. */
export function euler(q: Quat): V3 {
  const [w, x, y, z] = q;
  const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
  const pitch = Math.asin(clamp(2 * (w * y - z * x), -1, 1));
  const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
  return [roll, pitch, yaw];
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ---- flight controller ---------------------------------------------------------------------

export class FlightController {
  gains: Gains = { ...DEFAULT_GAINS };
  private altI = 0;
  private velIx = 0;
  private velIy = 0;
  private holdZ = 0;
  private holdYaw = 0;
  private lastRateErr: V3 = [0, 0, 0];
  private initialised = false;

  constructor(private model: DroneStats["sim"]) {}

  reset(s: DroneState) {
    this.altI = 0;
    this.velIx = 0;
    this.velIy = 0;
    this.holdZ = s.pos[2];
    this.holdYaw = euler(s.q)[2];
    this.lastRateErr = [0, 0, 0];
    this.initialised = true;
  }

  /** Motor thrust commands (N) for this instant. */
  update(s: DroneState, cmd: Command, dt: number, cargo: number): [number, number, number, number] {
    if (!this.initialised) this.reset(s);
    if (cmd.mode === "off" || s.crashed) return [0, 0, 0, 0];
    const mass = this.model.mass + cargo;
    const [roll, pitch, yaw] = euler(s.q);
    const g = this.gains;
    let rollD: number, pitchD: number, yawRateD: number, thrust: number;

    if (cmd.mode === "attitude") {
      rollD = clamp(cmd.roll, -MAX_TILT, MAX_TILT);
      pitchD = clamp(cmd.pitch, -MAX_TILT, MAX_TILT);
      yawRateD = clamp(cmd.yawRate, -Math.PI, Math.PI);
      thrust = clamp(cmd.throttle, 0, 1) * this.model.maxThrust;
      this.holdZ = s.pos[2];
    } else {
      // Desired acceleration in the world frame, then tilt and thrust that produce it.
      let ax = 0,
        ay = 0,
        vzD: number;
      if (cmd.mode === "position") {
        const vx = clamp(g.posP * (cmd.x - s.pos[0]), -5, 5);
        const vy = clamp(g.posP * (cmd.y - s.pos[1]), -5, 5);
        if (!s.landed) {
          this.velIx = clamp(this.velIx + (vx - s.vel[0]) * dt, -4, 4);
          this.velIy = clamp(this.velIy + (vy - s.vel[1]) * dt, -4, 4);
        }
        ax = g.velP * (vx - s.vel[0]) + g.velI * this.velIx;
        ay = g.velP * (vy - s.vel[1]) + g.velI * this.velIy;
        this.holdZ = cmd.z;
        vzD = clamp(g.altP * (this.holdZ - s.pos[2]), -2.5, 3);
        if (cmd.yaw !== undefined) this.holdYaw = cmd.yaw;
        yawRateD = clamp(3 * wrap(this.holdYaw - yaw), -2, 2);
      } else {
        // sticks: tilt directly (angle mode), altitude hold on the throttle stick
        const forward = cmd.pitch * MAX_TILT * 0.85;
        const right = cmd.roll * MAX_TILT * 0.85;
        ax = (Math.cos(yaw) * forward + Math.sin(yaw) * right) * G;
        ay = (Math.sin(yaw) * forward - Math.cos(yaw) * right) * G;
        if (Math.abs(cmd.climb) > 0.05) this.holdZ = s.pos[2] + cmd.climb * 0.6;
        vzD = Math.abs(cmd.climb) > 0.05 ? cmd.climb * 3 : clamp(g.altP * (this.holdZ - s.pos[2]), -2, 2);
        yawRateD = cmd.yaw * Math.PI;
        this.holdYaw = yaw;
      }
      const ez = vzD - s.vel[2];
      this.altI = clamp(this.altI + ez * dt, -3, 3);
      const az = g.altVelP * ez + g.altVelI * this.altI;
      // Tilt towards the wanted horizontal acceleration (small-angle model), rotated into the drone's heading.
      pitchD = clamp((ax * Math.cos(yaw) + ay * Math.sin(yaw)) / G, -MAX_TILT, MAX_TILT);
      rollD = clamp((ax * Math.sin(yaw) - ay * Math.cos(yaw)) / G, -MAX_TILT, MAX_TILT);
      const tilt = Math.max(0.5, Math.cos(roll) * Math.cos(pitch));
      thrust = clamp((mass * (G + az)) / tilt, 0, this.model.maxThrust);
      if (s.landed && vzD <= 0) thrust = 0;
    }

    // Angle loop → rate loop (PD) → torques.
    const rateD: V3 = [g.angP * (rollD - roll), g.angP * (pitchD - pitch), yawRateD];
    const err: V3 = [rateD[0] - s.rate[0], rateD[1] - s.rate[1], rateD[2] - s.rate[2]];
    const I = this.model.inertia;
    const torque = err.map((e, i) => I[i] * (g.rateP * e + (g.rateD * (e - this.lastRateErr[i])) / dt) * (i === 2 ? 0.6 : 1)) as V3;
    this.lastRateErr = err;
    return mix(thrust, torque, this.model);
  }
}

/** Motor mixer: total thrust and three torques → four motor thrusts. */
export function mix(total: number, torque: V3, model: DroneStats["sim"]): [number, number, number, number] {
  const a = model.armM * Math.SQRT1_2;
  const max = model.maxThrust / 4;
  return MOTORS.map((m) => clamp(total / 4 + (torque[0] * m.y) / (4 * a) - (torque[1] * m.x) / (4 * a) + (torque[2] * m.spin) / (4 * KQ), 0, max)) as [number, number, number, number];
}

// ---- dynamics ----------------------------------------------------------------------------------

/** Advance the drone by dt seconds (call with dt ≤ 0.002) given motor commands. */
export function step(s: DroneState, cmdThrust: [number, number, number, number], model: DroneStats["sim"], world: World, dt: number) {
  if (s.crashed) return;
  const mass = model.mass + world.cargo;
  const a = model.armM * Math.SQRT1_2;
  for (let i = 0; i < 4; i++) s.thrust[i] += ((cmdThrust[i] - s.thrust[i]) * dt) / MOTOR_TAU;
  const T = s.thrust.reduce((x, y) => x + y, 0);

  // Forces: thrust along body z, gravity, drag against the air (wind + gusts).
  const up = rotate(s.q, [0, 0, 1]);
  const gust = world.gust ? Math.sin(s.t * 0.9) * Math.sin(s.t * 2.3 + 1) * world.gust : 0;
  const air: V3 = [s.vel[0] - world.wind[0] - gust, s.vel[1] - world.wind[1] - gust * 0.6, s.vel[2] - world.wind[2]];
  const speed = Math.hypot(...air);
  const acc: V3 = [0, 1, 2].map((i) => (T * up[i] - model.drag * speed * air[i] - 0.05 * air[i]) / mass) as V3;
  acc[2] -= G;

  // Torques in the body frame.
  const tau: V3 = [0, 0, 0];
  MOTORS.forEach((m, i) => {
    tau[0] += m.y * a * s.thrust[i];
    tau[1] -= m.x * a * s.thrust[i];
    tau[2] += m.spin * KQ * s.thrust[i];
  });
  const I = model.inertia;
  const w = s.rate;
  const gyro: V3 = [w[1] * w[2] * (I[2] - I[1]), w[2] * w[0] * (I[0] - I[2]), w[0] * w[1] * (I[1] - I[0])];
  for (let i = 0; i < 3; i++) w[i] += ((tau[i] - gyro[i] - 0.002 * w[i]) / I[i]) * dt;

  // Orientation: q' = ½ q ⊗ (0, ω)
  const [qw, qx, qy, qz] = s.q;
  const dq: Quat = [-qx * w[0] - qy * w[1] - qz * w[2], qw * w[0] + qy * w[2] - qz * w[1], qw * w[1] - qx * w[2] + qz * w[0], qw * w[2] + qx * w[1] - qy * w[0]];
  const n = Math.hypot(...s.q.map((v, i) => v + 0.5 * dq[i] * dt));
  s.q = s.q.map((v, i) => (v + 0.5 * dq[i] * dt) / n) as Quat;

  for (let i = 0; i < 3; i++) {
    s.vel[i] += acc[i] * dt;
    s.pos[i] += s.vel[i] * dt;
  }

  // Ground contact.
  if (s.pos[2] <= 0) {
    const impact = -s.vel[2];
    const [roll, pitch] = euler(s.q);
    if (impact > 4) s.crashed = `Жёсткое падение: ${impact.toFixed(1)} м/с`;
    else if (Math.abs(roll) > 1 || Math.abs(pitch) > 1) s.crashed = "Дрон перевернулся при касании земли";
    s.pos[2] = 0;
    s.vel = [s.vel[0] * 0.8, s.vel[1] * 0.8, Math.max(0, s.vel[2])];
    if (T < mass * G * 0.98) {
      s.vel = [0, 0, Math.max(0, s.vel[2])];
      s.rate = [0, 0, s.rate[2] * 0.5];
      const [, , yaw] = euler(s.q);
      s.q = [Math.cos(yaw / 2), 0, 0, Math.sin(yaw / 2)];
    }
  }
  s.landed = s.pos[2] < 0.02 && Math.abs(s.vel[2]) < 0.2;

  // Battery: electrical power from thrust (momentum theory scaled to match the stats model).
  const hoverN = (model.mass * G) / 4;
  const pHover = model.hoverA * model.voltage;
  const power = s.thrust.reduce((acc2, t) => acc2 + (pHover / 4) * Math.pow(Math.max(0, t) / hoverN, 1.5), 0);
  s.current = power / model.voltage + 0.5;
  s.usedAh += (s.current * dt) / 3600;
  s.t += dt;
}

export function batteryShare(s: DroneState, model: DroneStats["sim"]) {
  return clamp(1 - s.usedAh / model.capacityAh, 0, 1);
}
