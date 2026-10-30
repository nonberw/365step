// The drone simulator runs in a Web Worker: physics at 1 kHz, the flight controller, mission judging
// and the student's autopilot code. A student's infinite loop only freezes this worker; the page notices
// that frames stopped and terminates it.
import { stats, type Build } from "@shared/drone";
import { FlightController, batteryShare, euler, newState, step, type Command, type DroneState, type Gains } from "@shared/droneSim";
import { judge, mission, platformAt, targetAt, type MissionStatus } from "@shared/droneMissions";

export type ToSim =
  | { type: "start"; build: Build; mission: string; control: "sticks" | "code" | "auto"; code?: string; gains: Gains }
  | { type: "sticks"; roll: number; pitch: number; yaw: number; climb: number }
  | { type: "gains"; gains: Gains }
  | { type: "pause"; paused: boolean };

export interface Frame {
  type: "frame";
  t: number;
  pos: [number, number, number];
  vel: [number, number, number];
  q: [number, number, number, number];
  rpy: [number, number, number];
  thrust: number[];
  maxMotor: number;
  battery: number;
  current: number;
  crashed: string | null;
  status: MissionStatus;
  /** altitude and its target for the chart */
  z: number;
  zTarget: number;
}
export type FromSim = Frame | { type: "log"; text: string } | { type: "error"; text: string };

const post = (m: FromSim) => (self as unknown as Worker).postMessage(m);

let timer: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<ToSim>) => {
  const m = e.data;
  if (m.type === "start") start(m);
  else if (m.type === "sticks") sticks = m;
  else if (m.type === "gains" && fc) fc.gains = { ...m.gains };
  else if (m.type === "pause") paused = m.paused;
};

let sticks = { roll: 0, pitch: 0, yaw: 0, climb: 0 };
let paused = false;
let fc: FlightController | null = null;

function start(m: Extract<ToSim, { type: "start" }>) {
  if (timer) clearInterval(timer);
  paused = false;
  const def = mission(m.mission);
  const model = stats(m.build).sim;
  const cargo = def.cargo ?? 0;
  const world = { wind: def.wind ?? ([0, 0, 0] as [number, number, number]), gust: def.gust ?? 0, cargo };
  const startZ = def.step ? def.step.from : def.id === "storm" ? 2 : 0;
  const s: DroneState = newState([0, 0, startZ]);
  if (startZ > 0) s.landed = false;
  fc = new FlightController(model);
  fc.gains = { ...m.gains };
  fc.reset(s);
  const check = judge(def, m.gains);

  // The student's autopilot: compiled once, called 20 times per second of simulated time.
  let autopilot: ((d: object, mem: object) => unknown) | null = null;
  const mem = {};
  if (m.control === "code") {
    try {
      const log = (...a: unknown[]) => post({ type: "log", text: a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") });
      autopilot = new Function("log", "Math", `${m.code ?? ""}\n;return typeof autopilot === "function" ? autopilot : null;`)(log, Math) as typeof autopilot;
      if (!autopilot) throw new Error("В коде нет функции autopilot(drone, mem)");
    } catch (err) {
      post({ type: "error", text: `Ошибка в коде: ${(err as Error).message}` });
      return;
    }
  }

  let cmd: Command = { mode: "position", x: 0, y: 0, z: startZ };
  let nextCode = 0;
  let status: MissionStatus = check(s, 0);
  let zTarget = startZ;
  let last = performance.now();
  const DT = 0.001;

  timer = setInterval(() => {
    const now = performance.now();
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (paused || status.done || status.failed) return void sendFrame();
    const steps = Math.round(real / DT);
    for (let k = 0; k < steps; k++) {
      if (m.control === "sticks") cmd = { mode: "sticks", ...sticks };
      else if (m.control === "auto") {
        const z = def.step ? (s.t < def.step.at ? def.step.from : def.step.to) : 2;
        cmd = { mode: "position", x: 0, y: 0, z };
      } else if (autopilot && s.t >= nextCode) {
        nextCode = s.t + 0.05;
        const [roll, pitch, yaw] = euler(s.q);
        const tg = def.id === "follow" ? targetAt(s.t) : null;
        const drone = {
          x: s.pos[0],
          y: s.pos[1],
          z: s.pos[2],
          vx: s.vel[0],
          vy: s.vel[1],
          vz: s.vel[2],
          roll,
          pitch,
          yaw,
          t: s.t,
          battery: batteryShare(s, model),
          landed: s.landed,
          ...(tg ? { tx: tg.x, ty: tg.y, tvx: tg.vx, tvy: tg.vy } : {}),
          ...(def.id === "precision" ? (({ x, y, vx, vy }) => ({ px: x, py: y, pvx: vx, pvy: vy }))(platformAt(s.t)) : {}),
        };
        let out: Record<string, number> | null = null;
        try {
          out = autopilot(Object.freeze(drone), mem) as Record<string, number> | null;
        } catch (err) {
          post({ type: "error", text: `Ошибка в autopilot на ${s.t.toFixed(2)} с: ${(err as Error).message}` });
          autopilot = null;
        }
        if (out && typeof out === "object") {
          const n = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
          if ("throttle" in out) cmd = { mode: "attitude", roll: n(out.roll), pitch: n(out.pitch), yawRate: n(out.yawRate), throttle: n(out.throttle) };
          else cmd = { mode: "position", x: n(out.x, s.pos[0]), y: n(out.y, s.pos[1]), z: Math.max(0, n(out.z, s.pos[2])), yaw: "yaw" in out ? n(out.yaw) : undefined };
        }
      }
      if (cmd.mode === "position") zTarget = cmd.z;
      else if (cmd.mode === "sticks") zTarget = s.pos[2];
      if (batteryShare(s, model) <= 0) cmd = { mode: "off" };
      step(s, fc!.update(s, cmd, DT, cargo), model, world, DT);
      status = check(s, DT);
      if (status.done || status.failed) break;
    }
    sendFrame();
  }, 16);

  function sendFrame() {
    post({
      type: "frame",
      t: s.t,
      pos: s.pos,
      vel: s.vel,
      q: s.q,
      rpy: euler(s.q),
      thrust: [...s.thrust],
      maxMotor: model.maxThrust / 4,
      battery: batteryShare(s, model),
      current: s.current,
      crashed: s.crashed,
      status,
      z: s.pos[2],
      zTarget,
    });
  }
}
