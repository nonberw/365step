import { DEFAULT_BUILD, stats } from "../shared/drone";
import { DEFAULT_GAINS, FlightController, euler, newState, step, type Command } from "../shared/droneSim";
import { judge, mission, platformAt, targetAt } from "../shared/droneMissions";

// Runs the code missions headless like the browser worker does: the starter code must not pass,
// a sensible reference autopilot must. Run: npx tsx scripts/drone-missions-check.ts

const SOLUTIONS: Record<string, string> = {
  slalom: `
const gates = [[-2, 5, 1.5], [2, 10, 3], [-2, 15, 2], [2, 20, 3.5], [-2, 25, 1.5], [0, 30, 2.5]];
function autopilot(drone, mem) {
  mem.i ??= 0;
  if (drone.y > gates[mem.i][1] && mem.i < gates.length - 1) mem.i++;
  const [x, y, z] = gates[mem.i];
  // aim beyond the gate (no braking in front of it) and over-correct sideways and in height,
  // because the position controller lags behind a fast-moving target
  return { x: x + (x - drone.x) * 0.8, y: y + 1.5, z: z + (z - drone.z) * 0.8 };
}`,
  precision: `
function autopilot(drone, mem) {
  if (drone.t < 3) return { x: 5, y: -3, z: 2 };
  // follow the deck with a lead for the controller lag; go down only while close, and touch down where it will be
  const lead = 1.2;
  const x = drone.px + drone.pvx * lead, y = drone.py + drone.pvy * lead;
  const off = Math.hypot(drone.x - drone.px, drone.y - drone.py);
  const z = off < 0.35 ? Math.max(0, drone.z - 0.5) : Math.max(drone.z, 0.6);
  return { x, y, z };
}`,
  follow: `
function autopilot(drone, mem) {
  if (drone.t < 3) return { x: 5, y: 0, z: 2 };
  return { x: drone.tx + drone.tvx * 1.6, y: drone.ty + drone.tvy * 1.6, z: 2 };
}`,
};

function fly(id: string, code: string) {
  const def = mission(id);
  const model = stats(DEFAULT_BUILD).sim;
  const s = newState([0, 0, 0]);
  const fc = new FlightController(model);
  fc.gains = { ...DEFAULT_GAINS };
  fc.reset(s);
  const check = judge(def);
  const world = { wind: def.wind ?? ([0, 0, 0] as [number, number, number]), gust: def.gust ?? 0, cargo: def.cargo ?? 0 };
  const autopilot = new Function("log", "Math", `${code}\n;return autopilot;`)(() => undefined, Math) as (d: object, m: object) => Record<string, number>;
  const mem = {};
  let cmd: Command = { mode: "position", x: 0, y: 0, z: 0 };
  let next = 0;
  for (let k = 0; k < 95_000; k++) {
    if (s.t >= next) {
      next = s.t + 0.05;
      const [roll, pitch, yaw] = euler(s.q);
      const tg = targetAt(s.t);
      const pl = platformAt(s.t);
      const out = autopilot(
        {
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
          landed: s.landed,
          tx: tg.x,
          ty: tg.y,
          tvx: tg.vx,
          tvy: tg.vy,
          px: pl.x,
          py: pl.y,
          pvx: pl.vx,
          pvy: pl.vy,
        },
        mem,
      );
      cmd = { mode: "position", x: out.x, y: out.y, z: Math.max(0, out.z) };
    }
    step(s, fc.update(s, cmd, 0.001, world.cargo), model, world, 0.001);
    const st = check(s, 0.001);
    if (st.done || st.failed) return st;
  }
  return check(s, 0);
}

let bad = 0;
for (const id of Object.keys(SOLUTIONS)) {
  const starter = fly(id, mission(id).starterCode!);
  const good = fly(id, SOLUTIONS[id]);
  const ok = !starter.done && good.done;
  if (!ok) bad++;
  console.log(
    `[starter t=${starter.metrics?.["Время"] ?? "-"}]`,
    `${ok ? "OK  " : "FAIL"} ${id.padEnd(10)} starter: ${starter.done ? `PASSES (${starter.text})` : (starter.failed ?? starter.text)} | reference: ${good.done ? `${good.text} (${good.score})` : (good.failed ?? good.text)}`,
  );
}
process.exit(bad ? 1 : 0);
