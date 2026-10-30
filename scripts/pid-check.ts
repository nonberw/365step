import { DEFAULT_BUILD, stats } from "../shared/drone";
import { DEFAULT_GAINS, FlightController, newState, step, type Gains } from "../shared/droneSim";
import { judge, mission } from "../shared/droneMissions";

// Runs the PID and storm missions headless with a few gain sets: the starting gains must fail, sensible ones must pass.
// Run: npx tsx scripts/pid-check.ts

const model = stats(DEFAULT_BUILD).sim;
function runMission(id: string, gains: Gains) {
  const def = mission(id);
  const s = newState([0, 0, def.step ? def.step.from : 2]);
  s.landed = false;
  const fc = new FlightController(model);
  fc.gains = gains;
  fc.reset(s);
  const check = judge(def);
  const world = { wind: def.wind ?? ([0, 0, 0] as [number, number, number]), gust: def.gust ?? 0, cargo: 0 };
  for (let k = 0; k < 120000; k++) {
    const z = def.step ? (s.t < def.step.at ? def.step.from : def.step.to) : 2;
    step(s, fc.update(s, { mode: "position", x: 0, y: 0, z }, 0.001, 0), model, world, 0.001);
    const st = check(s, 0.001);
    if (st.done || st.failed) return `${st.done ? "PASS" : "FAIL"} ${st.done ? st.text : st.failed} ${JSON.stringify(st.metrics ?? {})}`;
  }
  return "timeout";
}
console.log("pid start gains  ", runMission("pid", { ...DEFAULT_GAINS, altP: 3, altVelP: 1.5, altVelI: 6 }));
console.log("pid default      ", runMission("pid", DEFAULT_GAINS));
console.log("pid tuned        ", runMission("pid", { ...DEFAULT_GAINS, altP: 1.6, altVelP: 5, altVelI: 1 }));
console.log("storm default    ", runMission("storm", DEFAULT_GAINS));
console.log("storm no I       ", runMission("storm", { ...DEFAULT_GAINS, velI: 0 }));
console.log("storm stronger   ", runMission("storm", { ...DEFAULT_GAINS, posP: 1.4, velP: 3, velI: 1.2 }));

if (process.argv.includes("--search")) {
  for (const g of [
    { altP: 3, altVelP: 1.5, altVelI: 6 },
    { altP: 4, altVelP: 2, altVelI: 8 },
    { altP: 0.4, altVelP: 4, altVelI: 1.5 },
    { altP: 2.5, altVelP: 1.2, altVelI: 5 },
  ])
    console.log("pid", JSON.stringify(g), runMission("pid", { ...DEFAULT_GAINS, ...g }));
  const storm = mission("storm");
  for (const gust of [1.5, 2]) {
    storm.gust = gust;
    console.log(`storm gust ${gust} default`, runMission("storm", DEFAULT_GAINS));
    console.log(`storm gust ${gust} noI    `, runMission("storm", { ...DEFAULT_GAINS, velI: 0 }));
    console.log(`storm gust ${gust} strong `, runMission("storm", { ...DEFAULT_GAINS, posP: 1.4, velP: 3, velI: 1.2 }));
    console.log(`storm gust ${gust} max    `, runMission("storm", { ...DEFAULT_GAINS, posP: 2, velP: 4.5, velI: 2 }));
  }
}
