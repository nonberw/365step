import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { parts, type Build } from "@shared/drone";
import type { Ring } from "@shared/droneMissions";

// 3D pieces of the drone lab. The simulator works in x east, y north, z up;
// three.js uses y up, so a point (x, y, z) is drawn at (x, z, −y).

export const toThree = (p: readonly number[]) => new THREE.Vector3(p[0], p[2], -p[1]);
export const quatToThree = (q: readonly number[]) => new THREE.Quaternion(q[1], q[3], -q[2], q[0]);

const ARM_COLOR = { carbon: "#1d1d22", alu: "#b9c0c9", PLA: "#e2463b", PETG: "#ff8a3d" } as const;

/** The quadcopter assembled from the chosen parts, to scale. `spin` turns the propellers. */
export function DroneModel({ build, spin = 0, motorLoad }: { build: Build; spin?: number; motorLoad?: React.RefObject<number[]> }) {
  const p = parts(build);
  const a = (p.frame.size / 2000) * Math.SQRT1_2; // motor offset along each axis, m
  const armW = p.frame.arm.width / 1000;
  const armT = Math.max(0.003, p.frame.arm.thick / 1000);
  const motorR = Math.max(0.006, p.motor.mass / 3000);
  const propR = (p.prop.d * 0.0254) / 2;
  const bat = Math.cbrt(p.battery.mass / 1.8) / 100;
  const props = useRef<(THREE.Group | null)[]>([]);
  const color = ARM_COLOR[p.frame.arm.material];
  const motors = [
    [a, -a, -1],
    [-a, a, -1],
    [a, a, 1],
    [-a, -a, 1],
  ];

  useFrame((_, dt) => {
    props.current.forEach((g, i) => {
      if (!g) return;
      const load = motorLoad?.current?.[i] ?? spin;
      g.rotation.y += motors[i][2] * dt * (4 + load * 60);
    });
  });

  return (
    <group>
      {/* arms */}
      {[1, -1].map((s) => (
        <mesh key={s} rotation={[0, (s * Math.PI) / 4, 0]} castShadow>
          <boxGeometry args={[p.frame.size / 1000 + armW, armT, armW]} />
          <meshStandardMaterial color={color} roughness={p.frame.arm.material === "alu" ? 0.3 : 0.6} metalness={p.frame.arm.material === "alu" ? 0.8 : 0.1} />
        </mesh>
      ))}
      {/* centre plate and flight controller */}
      <mesh position={[0, armT / 2 + 0.004, 0]} castShadow>
        <boxGeometry args={[0.05 + a * 0.3, 0.004, 0.04 + a * 0.25]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, armT / 2 + 0.01, 0]}>
        <boxGeometry args={[0.03, 0.006, 0.03]} />
        <meshStandardMaterial color="#0f6b3a" roughness={0.6} />
      </mesh>
      {/* battery on top */}
      <mesh position={[0, armT / 2 + 0.012 + bat * 0.35, 0]} castShadow>
        <boxGeometry args={[bat * 1.6, bat * 0.7, bat * 0.9]} />
        <meshStandardMaterial color="#e6b422" roughness={0.4} />
      </mesh>
      {/* nose marker so forward is visible */}
      <mesh position={[a * 0.7, armT / 2 + 0.01, 0]}>
        <boxGeometry args={[0.012, 0.012, 0.012]} />
        <meshStandardMaterial color="#ff3b3b" emissive="#ff3b3b" emissiveIntensity={0.8} />
      </mesh>
      {p.payload.mass >= 100 && (
        <mesh position={[0, -0.02 - Math.cbrt(p.payload.mass) / 120, 0]} castShadow>
          <boxGeometry args={[Math.cbrt(p.payload.mass) / 60, Math.cbrt(p.payload.mass) / 60, Math.cbrt(p.payload.mass) / 60]} />
          <meshStandardMaterial color={p.payload.id === "box" ? "#b07a45" : "#222"} roughness={0.8} />
        </mesh>
      )}
      {motors.map(([x, y], i) => (
        <group key={i} position={[x, armT / 2, -y]}>
          <mesh position={[0, motorR * 0.7, 0]} castShadow>
            <cylinderGeometry args={[motorR, motorR, motorR * 1.4, 20]} />
            <meshStandardMaterial color="#2b2f36" metalness={0.7} roughness={0.35} />
          </mesh>
          <group ref={(g) => void (props.current[i] = g)} position={[0, motorR * 1.5, 0]}>
            {[0, Math.PI].map((r) => (
              <mesh key={r} rotation={[0, r, 0.06]} position={[Math.cos(r) * propR * 0.5, 0, 0]}>
                <boxGeometry args={[propR, 0.0015, propR * 0.16]} />
                <meshStandardMaterial color={i < 2 ? "#4cc2ff" : "#ff8562"} transparent opacity={0.85} />
              </mesh>
            ))}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[propR, 32]} />
              <meshBasicMaterial color={i < 2 ? "#4cc2ff" : "#ff8562"} transparent opacity={0.07} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

export function RingMesh({ ring, active, passed }: { ring: Ring; active: boolean; passed: boolean }) {
  const pos = toThree(ring.pos);
  return (
    <mesh position={pos} rotation={ring.axis === "x" ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
      <torusGeometry args={[ring.r, 0.06, 12, 48]} />
      <meshStandardMaterial color={passed ? "#2bb673" : active ? "#ff8562" : "#9aa3ad"} emissive={active ? "#ff5a1f" : "#000"} emissiveIntensity={active ? 0.6 : 0} />
    </mesh>
  );
}

export function Pad({ pos, label }: { pos: number[]; label: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#1f2937";
    g.beginPath();
    g.arc(64, 64, 62, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#ffcf33";
    g.lineWidth = 6;
    g.beginPath();
    g.arc(64, 64, 52, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#fff";
    g.font = "bold 44px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(label.slice(0, 5), 64, 66);
    return new THREE.CanvasTexture(c);
  }, [label]);
  const p = toThree(pos);
  return (
    <mesh position={[p.x, 0.01, p.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[0.6, 40]} />
      <meshStandardMaterial map={tex} />
    </mesh>
  );
}
