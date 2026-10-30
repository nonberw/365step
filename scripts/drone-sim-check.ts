import { DEFAULT_BUILD, stats } from "../shared/drone";
import { FlightController, euler, newState, step, type Command } from "../shared/droneSim";

// Headless flight test: take off to 2 m, fly to (5, 3), turn, land. Prints the trajectory every second.
// Run: npx tsx scripts/drone-sim-check.ts

for (const frame of ["f5", "f10", "f3"]) {
  const build =
    frame === "f10"
      ? { frame, motor: "m3508", prop: "p10", battery: "b6s5000", esc: "e60", payload: "box" }
      : frame === "f3"
        ? { frame, motor: "m1404", prop: "p3", battery: "b3s450", esc: "e12", payload: "none" }
        : DEFAULT_BUILD;
  const model = stats(build).sim;
  const fc = new FlightController(model);
  const s = newState();
  const world = { wind: [1.5, 0, 0] as [number, number, number], gust: 1, cargo: 0 };
  const plan: [number, Command][] = [
    [0, { mode: "position", x: 0, y: 0, z: 2 }],
    [5, { mode: "position", x: 5, y: 3, z: 2, yaw: 1.5 }],
    [12, { mode: "sticks", roll: 0, pitch: 0.5, yaw: 0, climb: 0 }],
    [14, { mode: "sticks", roll: 0, pitch: 0, yaw: 0, climb: -0.6 }],
  ];
  console.log(`--- ${frame} mass ${model.mass.toFixed(2)} kg`);
  for (let k = 0; k <= 20000; k++) {
    const cmd = [...plan].reverse().find(([t]) => s.t >= t)![1];
    step(s, fc.update(s, cmd, 0.001, 0), model, world, 0.001);
    if (k % 1000 === 0) {
      const [r, p, y] = euler(s.q).map((v) => ((v * 180) / Math.PI).toFixed(0));
      console.log(`t=${s.t.toFixed(0)} pos=(${s.pos.map((v) => v.toFixed(2)).join(", ")}) rpy=${r}/${p}/${y} I=${s.current.toFixed(1)}A ${s.crashed ?? ""}`);
    }
  }
}
