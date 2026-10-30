import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Line, Sky } from "@react-three/drei";
import * as THREE from "three";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { ArrowLeft, Battery, Camera, Gamepad2, Pause, Play, RotateCcw, SlidersHorizontal, Terminal, Trophy, Wind } from "lucide-react";
import { parts, stats } from "@shared/drone";
import { DEFAULT_GAINS, type Gains } from "@shared/droneSim";
import { DEFAULT_CODE, mission, platformAt, targetAt, type Control } from "@shared/droneMissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, Progress, Segmented } from "@/components/ui/card";
import { DroneModel, Pad, RingMesh, quatToThree, toThree } from "@/lib/drone/Drone3D";
import type { Frame, FromSim, ToSim } from "@/lib/drone/sim.worker";
import { loadBuild } from "./DroneBuilder";
import { FlightLog, RouteEditor, type LogRow } from "@/lib/drone/FlightTools";
import { saveEngProgress } from "./progress";

const CONTROL_LABEL: Record<Control, string> = { sticks: "Пульт", code: "Код автопилота", auto: "Автопилот + PID" };
const GAIN_INFO: { key: keyof Gains; label: string; max: number; step: number }[] = [
  { key: "altP", label: "Высота · P (м/с на метр ошибки)", max: 5, step: 0.1 },
  { key: "altVelP", label: "Верт. скорость · P", max: 15, step: 0.1 },
  { key: "altVelI", label: "Верт. скорость · I", max: 8, step: 0.1 },
  { key: "posP", label: "Положение · P", max: 3, step: 0.05 },
  { key: "velP", label: "Гор. скорость · P", max: 6, step: 0.1 },
  { key: "velI", label: "Гор. скорость · I (против ветра)", max: 3, step: 0.05 },
  { key: "angP", label: "Угол · P", max: 15, step: 0.5 },
  { key: "rateP", label: "Угловая скорость · P", max: 50, step: 1 },
  { key: "rateD", label: "Угловая скорость · D", max: 3, step: 0.05 },
];

export default function DroneFly() {
  const { mission: id = "takeoff" } = useParams();
  const def = mission(id);
  const build = useMemo(loadBuild, []);
  const st = useMemo(() => stats(build), [build]);
  const [control, setControl] = useState<Control>(def.control[0]);
  const [code, setCode] = useState(() => readCode(def.id) ?? def.starterCode ?? DEFAULT_CODE);
  // The PID lab starts from a badly tuned controller that the student has to fix.
  const startGains = (): Gains => (def.id === "pid" ? { ...DEFAULT_GAINS, altP: 3, altVelP: 1.5, altVelI: 6 } : { ...DEFAULT_GAINS });
  const [gains, setGains] = useState<Gains>(startGains);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [cam, setCam] = useState<"chase" | "top" | "side">("chase");
  const [saved, setSaved] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const live = useRef<Frame | null>(null);
  const chart = useRef<{ t: number; z: number; target: number }[]>([]);
  const flight = useRef<LogRow[]>([]);
  const lastFrameAt = useRef(0);
  const keys = useRef(new Set<string>());

  useEffect(() => setControl(def.control[0]), [def]);

  const send = (m: ToSim) => worker.current?.postMessage(m);

  function start() {
    worker.current?.terminate();
    const w = new Worker(new URL("../../lib/drone/sim.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    chart.current = [];
    flight.current = [];
    setLogs([]);
    setSaved(null);
    setPaused(false);
    lastFrameAt.current = performance.now();
    w.onmessage = (e: MessageEvent<FromSim>) => {
      const m = e.data;
      if (m.type === "frame") {
        lastFrameAt.current = performance.now();
        live.current = m;
        const c = chart.current;
        if (!c.length || m.t - c[c.length - 1].t > 0.05) c.push({ t: m.t, z: m.z, target: m.zTarget });
        if (c.length > 600) c.shift();
        const f = flight.current;
        if (!f.length || m.t - f[f.length - 1].t >= 0.1)
          f.push({ t: m.t, x: m.pos[0], y: m.pos[1], z: m.pos[2], speed: Math.hypot(...m.vel), roll: m.rpy[0], pitch: m.rpy[1], yaw: m.rpy[2], battery: m.battery, current: m.current });
        setFrame(m);
      } else setLogs((l) => [...l.slice(-60), m.type === "error" ? `⚠ ${m.text}` : m.text]);
    };
    w.postMessage({ type: "start", build, mission: def.id, control, code, gains } satisfies ToSim);
    setRunning(true);
    if (control === "code") writeCode(def.id, code);
  }

  // Watchdog: a frozen worker (an infinite loop in the student's code) is stopped.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      if (!paused && performance.now() - lastFrameAt.current > 1500) {
        worker.current?.terminate();
        worker.current = null;
        setRunning(false);
        setLogs((l) => [...l, "⚠ Симулятор остановлен: автопилот завис (бесконечный цикл?)"]);
      }
    }, 500);
    return () => clearInterval(t);
  }, [running, paused]);

  useEffect(() => () => worker.current?.terminate(), []);

  // Keyboard sticks.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.(".cm-editor, input, textarea")) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      keys.current.add(e.key.toLowerCase());
      push();
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
      push();
    };
    const push = () => {
      const k = keys.current;
      const v = (a: string[], b: string[]) => (a.some((x) => k.has(x)) ? 1 : 0) - (b.some((x) => k.has(x)) ? 1 : 0);
      send({ type: "sticks", pitch: v(["arrowup"], ["arrowdown"]), roll: v(["arrowright"], ["arrowleft"]), yaw: v(["a", "ф"], ["d", "в"]), climb: v(["w", "ц"], ["s", "ы"]) });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Save the result once.
  useEffect(() => {
    if (!frame?.status.done || saved || def.xp === 0) return;
    setSaved("…");
    saveEngProgress(`drone:${def.id}`, frame.status.score)
      .then((r) => setSaved(r.xp ? `+${r.xp} XP` : `Лучший результат: ${r.best}`))
      .catch(() => setSaved("Не удалось сохранить результат"));
  }, [frame?.status.done, frame?.status.score, saved, def]);

  const status = frame?.status;
  const p = parts(build);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/engineering/drone" className="grid size-9 place-items-center rounded-full border border-border hover:bg-muted" aria-label="Назад к сборке">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold">{def.title}</h1>
            <p className="text-sm text-muted-foreground">
              Дрон: {p.frame.name}, {p.motor.name}, {p.battery.name} · {Math.round(st.massG)} г · TWR {st.twr.toFixed(1)}
              {def.cargo ? ` · груз ${def.cargo * 1000} г` : ""}
            </p>
          </div>
        </div>
        {def.control.length > 1 && <Segmented value={control} onChange={(v) => setControl(v)} options={def.control.map((c) => ({ value: c, label: CONTROL_LABEL[c] }))} />}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="relative h-[420px] overflow-hidden rounded-3xl border border-border bg-[#9ec9ef] sm:h-[520px]">
            <Canvas shadows camera={{ position: [-4, 3, 4], fov: 55 }}>
              <Scene build={build} def={def} live={live} cam={cam} />
            </Canvas>
            <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5 rounded-2xl bg-black/55 px-3 py-2 font-mono text-xs text-white backdrop-blur">
              <span>Высота {frame ? frame.pos[2].toFixed(2) : "0.00"} м</span>
              <span>Скорость {frame ? Math.hypot(...frame.vel).toFixed(1) : "0.0"} м/с</span>
              <span>
                Наклон {frame ? ((frame.rpy[0] * 180) / Math.PI).toFixed(0) : 0}° / {frame ? ((frame.rpy[1] * 180) / Math.PI).toFixed(0) : 0}°
              </span>
              <span className="flex items-center gap-1">
                <Battery className="size-3" /> {frame ? Math.round(frame.battery * 100) : 100} % · {frame ? frame.current.toFixed(1) : "0"} А
              </span>
              <span>t = {frame ? frame.t.toFixed(1) : "0.0"} с</span>
            </div>
            {frame && (
              <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-1 rounded-2xl bg-black/55 px-3 py-2 backdrop-blur">
                {frame.thrust.map((t, i) => (
                  <span key={i} className="flex flex-col items-center gap-1">
                    <span className="relative h-14 w-3 overflow-hidden rounded bg-white/15">
                      <span className="absolute inset-x-0 bottom-0 rounded bg-gradient-to-t from-[#4cc2ff] to-[#ff8562]" style={{ height: `${Math.min(100, (t / frame.maxMotor) * 100)}%` }} />
                    </span>
                    <span className="text-[9px] text-white/70">M{i + 1}</span>
                  </span>
                ))}
              </div>
            )}
            {(def.wind || def.gust) && (
              <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
                <Wind className="size-3.5" /> ветер {Math.hypot(...(def.wind ?? [0, 0, 0])).toFixed(1)} м/с{def.gust ? `, порывы ±${def.gust}` : ""}
              </span>
            )}
            <div className="absolute bottom-3 right-3 flex gap-1">
              {(["chase", "top", "side"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCam(c)} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs", cam === c ? "bg-white text-black" : "bg-black/55 text-white")}>
                  <Camera className="size-3" /> {c === "chase" ? "За дроном" : c === "top" ? "Сверху" : "Сбоку"}
                </button>
              ))}
            </div>
            {status && (status.done || status.failed) && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-[2px]">
                <div className="flex max-w-sm flex-col items-center gap-3 rounded-3xl bg-card p-6 text-center shadow-xl">
                  {status.done ? <Trophy className="size-10 text-[#e6b422]" /> : <RotateCcw className="size-10 text-destructive" />}
                  <p className="font-display text-xl font-bold">{status.done ? "Миссия выполнена" : "Не получилось"}</p>
                  <p className="text-sm text-muted-foreground">{status.done ? status.text : status.failed}</p>
                  {status.done && <p className="font-display text-3xl font-bold">{status.score} / 100</p>}
                  {saved && <p className="text-sm font-semibold text-primary">{saved}</p>}
                  <Button onClick={start}>
                    <RotateCcw /> Ещё раз
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={start}>
              {running ? <RotateCcw /> : <Play />} {running ? "Перезапуск" : "Старт"}
            </Button>
            {running && (
              <Button
                variant="outline"
                onClick={() => {
                  setPaused(!paused);
                  send({ type: "pause", paused: !paused });
                }}
              >
                {paused ? <Play /> : <Pause />} {paused ? "Продолжить" : "Пауза"}
              </Button>
            )}
            {control === "sticks" && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gamepad2 className="size-4" /> W/S — вверх/вниз · A/D — поворот · стрелки — наклон вперёд/назад/вбок
              </span>
            )}
          </div>
          <AltChart data={chart} frame={frame} />
          {(status?.done || status?.failed || paused) && <FlightLog rows={flight.current} name={def.id} />}
        </div>

        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Задание</p>
            <p className="text-sm">{def.brief}</p>
            {def.learn && <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">💡 {def.learn}</p>}
            {status && (
              <>
                <Progress value={status.progress * 100} />
                <p className="text-sm font-medium">{status.text}</p>
                {status.metrics && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(status.metrics).map(([k, v]) => (
                      <span key={k} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                        {k}: <b>{v}</b>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {control === "code" && (
            <Card className="flex flex-col gap-2 p-0">
              <p className="flex items-center gap-2 px-4 pt-3 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                <Terminal className="size-3.5" /> autopilot.js
              </p>
              <CodeMirror value={code} onChange={setCode} extensions={[javascript()]} theme={oneDark} height="320px" basicSetup={{ foldGutter: false }} />
              <div className="max-h-32 overflow-auto bg-[#111] px-3 py-2 font-mono text-[11px] text-white/80">
                {logs.length ? logs.map((l, i) => <div key={i}>{l}</div>) : <span className="text-white/40">Здесь будет вывод log(...)</span>}
              </div>
            </Card>
          )}
          {control === "code" && <RouteEditor onCode={setCode} />}

          {(control === "auto" || def.id === "storm") && (
            <Card className="flex flex-col gap-3">
              <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                <SlidersHorizontal className="size-3.5" /> Коэффициенты регулятора
              </p>
              {GAIN_INFO.filter((g) => (def.id === "pid" ? g.key.startsWith("alt") : true)).map((g) => (
                <label key={g.key} className="flex flex-col gap-1 text-xs">
                  <span className="flex justify-between">
                    {g.label} <b className="tabular">{gains[g.key].toFixed(2)}</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={g.max}
                    step={g.step}
                    value={gains[g.key]}
                    onChange={(e) => {
                      const next = { ...gains, [g.key]: Number(e.target.value) };
                      setGains(next);
                      send({ type: "gains", gains: next });
                    }}
                    className="accent-[var(--color-primary)]"
                  />
                </label>
              ))}
              <Button size="sm" variant="outline" className="self-start" onClick={() => setGains(startGains())}>
                Сбросить
              </Button>
            </Card>
          )}
          {control !== "code" && logs.length > 0 && <Card className="font-mono text-xs">{logs.at(-1)}</Card>}
        </div>
      </div>
    </div>
  );
}

const readCode = (id: string) => {
  try {
    return localStorage.getItem(`bsts-drone-code-${id}`);
  } catch {
    return null;
  }
};
const writeCode = (id: string, code: string) => {
  try {
    localStorage.setItem(`bsts-drone-code-${id}`, code);
  } catch {
    // not critical
  }
};

function Scene({ build, def, live, cam }: { build: ReturnType<typeof loadBuild>; def: ReturnType<typeof mission>; live: React.RefObject<Frame | null>; cam: "chase" | "top" | "side" }) {
  const drone = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const mover = useRef<THREE.Group>(null);
  const load = useRef<number[]>([0, 0, 0, 0]);
  const trail = useRef<THREE.Vector3[]>([]);
  const [trailPts, setTrailPts] = useState<THREE.Vector3[]>([]);
  const { camera } = useThree();
  const ringsPassed = live.current?.status.progress ?? 0;

  useFrame((_, dt) => {
    const f = live.current;
    // the moving deck or the rover, at the simulator's time
    if (mover.current) {
      const t = f?.t ?? 0;
      const m = def.id === "precision" ? platformAt(t) : targetAt(t);
      mover.current.position.set(m.x, 0, -m.y);
      mover.current.rotation.y = Math.atan2(m.vy, m.vx);
    }
    if (!drone.current) return;
    const pos = f ? toThree(f.pos) : new THREE.Vector3(0, def.step?.from ?? (def.id === "storm" ? 2 : 0), 0);
    drone.current.position.copy(pos);
    if (f) drone.current.quaternion.copy(quatToThree(f.q));
    load.current = f ? f.thrust.map((t) => t / f.maxMotor) : [0, 0, 0, 0];
    if (shadow.current) {
      shadow.current.position.set(pos.x, 0.005, pos.z);
      const s = Math.max(0.3, 1 - pos.y / 15);
      shadow.current.scale.set(s, s, s);
    }
    if (f) {
      const tr = trail.current;
      if (!tr.length || tr[tr.length - 1].distanceTo(pos) > 0.15) {
        tr.push(pos.clone());
        if (tr.length > 300) tr.shift();
        if (tr.length % 4 === 0) setTrailPts([...tr]);
      }
    }
    const yaw = f ? f.rpy[2] : 0;
    const want =
      cam === "top"
        ? new THREE.Vector3(pos.x, pos.y + 14, pos.z + 0.01)
        : cam === "side"
          ? new THREE.Vector3(pos.x, pos.y + 1.5, pos.z + 9)
          : new THREE.Vector3(pos.x - Math.cos(yaw) * 3.2, pos.y + 1.4, pos.z + Math.sin(yaw) * 3.2);
    camera.position.lerp(want, 1 - Math.exp(-dt * 3));
    camera.lookAt(pos);
  });

  const activeRing = def.rings ? Math.min(def.rings.length - 1, Math.round(ringsPassed * def.rings.length)) : -1;
  return (
    <>
      <Sky sunPosition={[50, 30, 20]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[10, 18, 8]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#7fae6a" roughness={1} />
      </mesh>
      <Grid args={[60, 60]} cellSize={1} sectionSize={5} cellColor="#5f8a4f" sectionColor="#3f6a33" position={[0, 0.002, 0]} fadeDistance={45} infiniteGrid />
      {(def.id === "precision" || def.id === "follow") && (
        <group ref={mover}>
          {def.id === "precision" ? (
            <>
              <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.4, 0.04, 1.4]} />
                <meshStandardMaterial color="#334155" />
              </mesh>
              <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.25, 0.32, 40]} />
                <meshBasicMaterial color="#ffcf33" />
              </mesh>
            </>
          ) : (
            <>
              <mesh position={[0, 0.25, 0]} castShadow>
                <boxGeometry args={[1.1, 0.35, 0.7]} />
                <meshStandardMaterial color="#e2463b" />
              </mesh>
              {[-0.4, 0.4].map((x) =>
                [-0.38, 0.38].map((z) => (
                  <mesh key={`${x}${z}`} position={[x, 0.12, z]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
                    <meshStandardMaterial color="#111" />
                  </mesh>
                )),
              )}
            </>
          )}
        </group>
      )}
      {def.id === "takeoff" && (
        <mesh position={[0, 2, 0]}>
          <cylinderGeometry args={[1.2, 1.2, 0.8, 32, 1, true]} />
          <meshBasicMaterial color="#2bb673" transparent opacity={0.16} side={THREE.DoubleSide} />
        </mesh>
      )}
      {def.id === "storm" && (
        <mesh position={[0, 2, 0]}>
          <sphereGeometry args={[0.6, 24, 16]} />
          <meshBasicMaterial color="#2bb673" transparent opacity={0.15} />
        </mesh>
      )}
      {def.id === "square" &&
        [
          [3, 3],
          [-3, 3],
          [-3, -3],
          [3, -3],
        ].map(([x, y]) => (
          <mesh key={`${x}${y}`} position={toThree([x, y, 2])}>
            <sphereGeometry args={[0.15, 16, 12]} />
            <meshStandardMaterial color="#ff8562" emissive="#ff5a1f" emissiveIntensity={0.4} />
          </mesh>
        ))}
      {def.rings?.map((r, i) => (
        <RingMesh key={i} ring={r} active={i === activeRing} passed={i < Math.round(ringsPassed * def.rings!.length)} />
      ))}
      {(def.pads ?? [{ pos: [0, 0, 0], label: "H" }]).map((p) => (
        <Pad key={p.label} pos={p.pos} label={p.label} />
      ))}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} />
      </mesh>
      {trailPts.length > 1 && <Line points={trailPts} color="#ff8562" lineWidth={2} transparent opacity={0.7} />}
      <group ref={drone}>
        <group scale={1.8}>
          <DroneModel build={build} motorLoad={load} />
        </group>
      </group>
    </>
  );
}

function AltChart({ data, frame }: { data: React.RefObject<{ t: number; z: number; target: number }[]>; frame: Frame | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const pts = data.current;
    if (!c || !pts) return;
    const g = c.getContext("2d")!;
    const W = (c.width = c.clientWidth * devicePixelRatio);
    const H = (c.height = c.clientHeight * devicePixelRatio);
    g.clearRect(0, 0, W, H);
    if (pts.length < 2) return;
    const t0 = pts[0].t;
    const t1 = Math.max(t0 + 5, pts[pts.length - 1].t);
    const zMax = Math.max(3.5, ...pts.map((p) => Math.max(p.z, p.target))) * 1.1;
    const x = (t: number) => ((t - t0) / (t1 - t0)) * (W - 40 * devicePixelRatio) + 30 * devicePixelRatio;
    const y = (z: number) => H - 14 * devicePixelRatio - (z / zMax) * (H - 24 * devicePixelRatio);
    g.strokeStyle = "rgba(128,128,128,.25)";
    g.fillStyle = "rgba(128,128,128,.8)";
    g.font = `${10 * devicePixelRatio}px sans-serif`;
    for (let z = 0; z <= zMax; z += 1) {
      g.beginPath();
      g.moveTo(x(t0), y(z));
      g.lineTo(W, y(z));
      g.stroke();
      g.fillText(`${z} м`, 2, y(z) + 3);
    }
    const line = (key: "z" | "target", color: string, dash: number[]) => {
      g.strokeStyle = color;
      g.setLineDash(dash);
      g.lineWidth = 2 * devicePixelRatio;
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(x(p.t), y(p[key])) : g.moveTo(x(p.t), y(p[key]))));
      g.stroke();
      g.setLineDash([]);
    };
    line("target", "#3b82f6", [6, 4]);
    line("z", "#ef4444", []);
  }, [frame, data]);
  return (
    <Card className="flex flex-col gap-1 p-3">
      <span className="flex items-center gap-3 text-xs text-muted-foreground">
        Высота во времени <span className="text-[#ef4444]">— высота</span> <span className="text-[#3b82f6]">- - цель</span>
      </span>
      <canvas ref={ref} className="h-32 w-full" />
    </Card>
  );
}
