import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Loader2 } from "lucide-react";
import type { CadMeasure } from "@shared/cadLessons";
import type { CadMesh } from "./cad.worker";

/** The 3D view of built parts with their measurements. */
export default function CadViewport({ meshes, measure, kernel }: { meshes: CadMesh[]; measure: CadMeasure | null; kernel: boolean }) {
  return (
    <div className="relative h-[420px] overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-[#f4f6fa] to-[#dde3ec] dark:from-[#1a1f29] dark:to-[#0d1117] sm:h-[520px]">
      {!kernel && (
        <div className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Загружаю OpenCascade (≈ 20 МБ, один раз)…
          </span>
        </div>
      )}
      <Canvas camera={{ position: [80, -90, 70], fov: 40, near: 0.5, far: 5000 }} onCreated={({ camera }) => camera.up.set(0, 0, 1)}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[60, -40, 120]} intensity={1.4} />
        <Environment preset="studio" />
        <Grid args={[400, 400]} cellSize={5} sectionSize={50} rotation={[Math.PI / 2, 0, 0]} cellColor="#9aa3ad" sectionColor="#6b7480" fadeDistance={400} infiniteGrid />
        {meshes.map((m, i) => (
          <Part key={i} mesh={m} />
        ))}
        <OrbitControls makeDefault />
        <Fit meshes={meshes} />
      </Canvas>
      {measure && (
        <div className="absolute left-3 top-3 rounded-2xl bg-black/55 px-3 py-2 font-mono text-xs text-white backdrop-blur">
          <div>Габарит {measure.bbox.map((v) => v.toFixed(1)).join(" × ")} мм</div>
          <div>Объём {(measure.volume / 1000).toFixed(2)} см³</div>
          <div>Масса из PLA ≈ {((measure.volume / 1000) * 1.24).toFixed(1)} г</div>
          <div>Граней {measure.faces}</div>
        </div>
      )}
    </div>
  );
}

function Part({ mesh }: { mesh: CadMesh }) {
  const { geo, edges } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.index, 1));
    const e = new THREE.BufferGeometry();
    e.setAttribute("position", new THREE.BufferAttribute(mesh.lines, 3));
    return { geo: g, edges: e };
  }, [mesh]);
  useEffect(
    () => () => {
      geo.dispose();
      edges.dispose();
    },
    [geo, edges],
  );
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color={mesh.color} roughness={0.45} metalness={0.05} polygonOffset polygonOffsetFactor={1} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#1f2937" />
      </lineSegments>
    </group>
  );
}

/** Points the camera at the part whenever a new one is built. */
function Fit({ meshes }: { meshes: CadMesh[] }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    if (!meshes.length) return;
    const box = new THREE.Box3();
    for (const m of meshes) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
      g.computeBoundingBox();
      box.union(g.boundingBox!);
      g.dispose();
    }
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 50;
    camera.position.set(c.x + size * 0.9, c.y - size * 1.1, c.z + size * 0.8);
    camera.lookAt(c);
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (orbit) {
      orbit.target.copy(c);
      orbit.update();
    }
  }, [meshes, camera, controls]);
  return null;
}
