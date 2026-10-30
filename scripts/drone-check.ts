import { stats, type Build } from "../shared/drone";

// Prints the drone model's numbers for a few typical builds, to compare with real-world figures.
// Run: npx tsx scripts/drone-check.ts

const builds: Build[] = [
  { frame: "f3", motor: "m1404", prop: "p3", battery: "b3s450", esc: "e12", payload: "none" },
  { frame: "f5", motor: "m2306", prop: "p5", battery: "b4s1300", esc: "e35", payload: "fpv" },
  { frame: "f7", motor: "m2806", prop: "p7", battery: "b6s3000", esc: "e35", payload: "gopro" },
  { frame: "f10", motor: "m3508", prop: "p10", battery: "b6s5000", esc: "e60", payload: "box" },
  { frame: "f5p", motor: "m2207", prop: "p51", battery: "b6s1100", esc: "e45", payload: "none" },
];
for (const b of builds) {
  const s = stats(b);
  console.log(
    b.frame,
    `${Math.round(s.massG)} г`,
    `тяга ${Math.round(s.maxThrustG)} г`,
    `TWR ${s.twr.toFixed(2)}`,
    `висение ${Math.round(s.hoverThrottle * 100)}% ${s.hoverA.toFixed(1)} А`,
    `макс ${s.maxA.toFixed(0)} А`,
    `${s.flightMin.toFixed(1)} мин`,
    `луч ${s.arm.stressMPa.toFixed(0)}/${s.arm.allowMPa.toFixed(0)} МПа`,
    s.issues.map((i) => i.level).join(","),
  );
}
