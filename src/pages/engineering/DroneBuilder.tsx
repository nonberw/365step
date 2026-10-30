import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { motion } from "motion/react";
import { AlertTriangle, Battery, CheckCircle2, Columns3, Gauge, Plane, Rocket, Ruler, Timer, Trash2, Weight, XCircle, Zap } from "lucide-react";
import { BATTERIES, DEFAULT_BUILD, ESCS, FRAMES, MATERIALS, MOTORS, PAYLOADS, PROPS, parts, stats, type Build } from "@shared/drone";
import { MISSIONS } from "@shared/droneMissions";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Aurora } from "@/pages/ent/EntHome";
import { DroneModel } from "@/lib/drone/Drone3D";
import { useEngProgress } from "./progress";
import { Button } from "@/components/ui/button";

const KEY = "bsts-drone-build";

export function loadBuild(): Build {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_BUILD, ...(JSON.parse(raw) as Partial<Build>) };
  } catch {
    // storage unavailable: use the default build
  }
  return DEFAULT_BUILD;
}

function saveBuild(b: Build) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // not critical
  }
}

type Slot = { key: keyof Build; title: string; options: { id: string; name: string; sub: string }[] };

export default function DroneBuilder() {
  const [build, setBuild] = useState<Build>(loadBuild);
  const [compare, setCompare] = useState<Build[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("bsts-drone-compare") ?? "[]") as Build[];
    } catch {
      return [];
    }
  });
  const keepCompare = (list: Build[]) => {
    setCompare(list);
    try {
      localStorage.setItem("bsts-drone-compare", JSON.stringify(list));
    } catch {
      // not critical
    }
  };
  const s = useMemo(() => stats(build), [build]);
  const p = parts(build);
  const progress = useEngProgress();

  const set = (k: keyof Build, v: string) => {
    const next = { ...build, [k]: v };
    setBuild(next);
    saveBuild(next);
  };

  const slots: Slot[] = [
    { key: "frame", title: "Рама", options: FRAMES.map((f) => ({ id: f.id, name: f.name, sub: `${f.mass} г · лучи: ${MATERIALS[f.arm.material].name} · ${f.blurb}` })) },
    { key: "motor", title: "Моторы ×4", options: MOTORS.map((m) => ({ id: m.id, name: m.name, sub: `${m.mass} г · до ${m.maxA} А · ${m.blurb}` })) },
    { key: "prop", title: "Пропеллеры ×4", options: PROPS.map((x) => ({ id: x.id, name: x.name, sub: `диаметр ${x.d}″, шаг ${x.pitch}″ · ${x.mass} г` })) },
    { key: "battery", title: "Аккумулятор", options: BATTERIES.map((b) => ({ id: b.id, name: b.name, sub: `${(b.cells * 3.7).toFixed(1)} В · ${b.c}C · ${b.mass} г` })) },
    { key: "esc", title: "Регуляторы", options: ESCS.map((e) => ({ id: e.id, name: e.name, sub: `${e.mass} г` })) },
    { key: "payload", title: "Полезная нагрузка", options: PAYLOADS.map((x) => ({ id: x.id, name: x.name, sub: x.mass ? `${x.mass} г${x.blurb ? ` · ${x.blurb}` : ""}` : "Только полёт" })) },
  ];

  const mass = [
    { label: "Рама", g: p.frame.mass },
    { label: "Моторы", g: 4 * p.motor.mass },
    { label: "Пропеллеры", g: 4 * p.prop.mass },
    { label: "Аккумулятор", g: p.battery.mass },
    { label: "Регуляторы и электроника", g: p.esc.mass + 25 },
    { label: "Нагрузка", g: p.payload.mass },
  ];
  const bad = s.issues.some((i) => i.level === "error");

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#0d1117] text-white">
        <Aurora />
        <div className="relative grid gap-4 px-6 py-8 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/80">
              <Plane className="size-3.5 text-[#4cc2ff]" /> Лаборатория дронов
            </span>
            <h1 className="font-display text-4xl font-bold sm:text-5xl">Собери свой квадрокоптер</h1>
            <p className="max-w-xl text-white/70">
              Выбери раму, моторы, пропеллеры и аккумулятор. Платформа посчитает массу, тягу, время полёта и прочность лучей по формулам из учебника физики — а потом ты поднимешь этот дрон в симуляторе.
            </p>
          </div>
          <div className="h-64 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#16202e] to-[#0b0f16] sm:h-72">
            <Canvas shadows camera={{ position: [0.35, 0.28, 0.4], fov: 40 }}>
              <ambientLight intensity={0.4} />
              <directionalLight position={[1, 2, 1]} intensity={1.6} castShadow />
              <Environment preset="city" />
              <group scale={0.55 / (p.frame.size / 1000 + 0.15)}>
                <DroneModel build={build} spin={0.3} />
              </group>
              <ContactShadows position={[0, -0.05, 0]} opacity={0.5} blur={2} scale={1.5} />
              <OrbitControls autoRotate autoRotateSpeed={1.2} enablePan={false} minDistance={0.25} maxDistance={1.2} />
            </Canvas>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-4">
          {slots.map((slot) => (
            <Card key={slot.key} className="flex flex-col gap-3">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{slot.title}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {slot.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => set(slot.key, o.id)}
                    className={cn("flex flex-col rounded-2xl border px-3 py-2.5 text-left transition", build[slot.key] === o.id ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted")}
                  >
                    <span className="text-sm font-semibold">{o.name}</span>
                    <span className="text-xs text-muted-foreground">{o.sub}</span>
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="flex flex-col gap-4">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Расчёт</p>
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={<Weight className="size-4" />} label="Масса" value={`${Math.round(s.massG)} г`} />
              <Metric icon={<Rocket className="size-4" />} label="Тяга на полном газу" value={`${(s.maxThrustG / 1000).toFixed(2)} кг`} />
              <Metric icon={<Gauge className="size-4" />} label="Тяговооружённость" value={s.twr.toFixed(2)} hot={s.twr < 2} />
              <Metric icon={<Zap className="size-4" />} label="Газ для висения" value={`${Math.round(s.hoverThrottle * 100)} %`} />
              <Metric icon={<Timer className="size-4" />} label="Время висения" value={`${s.flightMin.toFixed(1)} мин`} />
              <Metric icon={<Battery className="size-4" />} label="Ток: висение / максимум" value={`${s.hoverA.toFixed(1)} / ${s.maxA.toFixed(0)} А`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Ruler className="size-4 text-primary" /> Прочность луча ({s.arm.material}, {Math.round(s.arm.lengthMm)} мм)
              </span>
              <span className="relative h-3 overflow-hidden rounded-full bg-muted">
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (s.arm.stressMPa / s.arm.allowMPa) * 100)}%` }}
                  className={cn("block h-full rounded-full", s.arm.stressMPa > s.arm.allowMPa ? "bg-destructive" : s.arm.stressMPa > s.arm.allowMPa * 0.6 ? "bg-[#ffb020]" : "bg-success")}
                />
              </span>
              <span className="text-xs text-muted-foreground">
                Напряжение изгиба σ = M·c/I = {s.arm.stressMPa.toFixed(1)} МПа из допустимых {s.arm.allowMPa.toFixed(0)} · прогиб конца луча {s.arm.tipMm.toFixed(2)} мм
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Из чего складывается масса</span>
              <div className="flex h-3 overflow-hidden rounded-full">
                {mass.map((m, i) => (
                  <span
                    key={m.label}
                    title={`${m.label}: ${m.g} г`}
                    style={{ width: `${(m.g / s.massG) * 100}%` }}
                    className={["bg-[#1d1d22]", "bg-[#4cc2ff]", "bg-[#8fd3ff]", "bg-[#e6b422]", "bg-[#0f6b3a]", "bg-[#b07a45]"][i]}
                  />
                ))}
              </div>
              <span className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                {mass.map((m) => (
                  <span key={m.label}>
                    {m.label} {m.g} г
                  </span>
                ))}
              </span>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                <Columns3 className="size-3.5" /> Сравнение сборок
              </p>
              <Button size="sm" variant="outline" disabled={compare.length >= 3 || compare.some((c) => JSON.stringify(c) === JSON.stringify(build))} onClick={() => keepCompare([...compare, build])}>
                Добавить текущую
              </Button>
            </div>
            {compare.length === 0 ? (
              <p className="text-xs text-muted-foreground">Сохрани до трёх вариантов и сравни их как инженер: что даёт другой аккумулятор или пропеллер.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-2 font-medium">Параметр</th>
                      {compare.map((c, i) => (
                        <th key={i} className="py-1 pr-2 font-medium">
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => {
                                setBuild(c);
                                saveBuild(c);
                              }}
                            >
                              Вариант {i + 1}
                            </button>
                            <button type="button" aria-label="Убрать" onClick={() => keepCompare(compare.filter((_, j) => j !== i))}>
                              <Trash2 className="size-3" />
                            </button>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Рама / мотор", (b: Build) => `${parts(b).frame.size} мм / ${parts(b).motor.kv}KV`],
                        ["Пропеллер / батарея", (b: Build) => `${parts(b).prop.name} / ${parts(b).battery.name}`],
                        ["Масса", (b: Build) => `${Math.round(stats(b).massG)} г`],
                        ["Тяговооружённость", (b: Build) => stats(b).twr.toFixed(2)],
                        ["Висение", (b: Build) => `${stats(b).flightMin.toFixed(1)} мин`],
                        ["Ток максимум", (b: Build) => `${stats(b).maxA.toFixed(0)} А`],
                        ["Нагрузка луча", (b: Build) => `${Math.round((stats(b).arm.stressMPa / stats(b).arm.allowMPa) * 100)} %`],
                        ["Ошибок в сборке", (b: Build) => String(stats(b).issues.filter((x) => x.level === "error").length)],
                      ] as const
                    ).map(([label, f]) => (
                      <tr key={label} className="border-t border-border">
                        <td className="py-1 pr-2 text-muted-foreground">{label}</td>
                        {compare.map((c, i) => (
                          <td key={i} className="py-1 pr-2 font-medium tabular">
                            {f(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-2">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Инженерная проверка</p>
            {s.issues.map((i) => (
              <p key={i.text} className="flex gap-2 text-sm">
                {i.level === "error" ? (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : i.level === "warn" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#e0a100]" />
                ) : (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                )}
                <span>{i.text}</span>
              </p>
            ))}
            <p className="text-xs text-muted-foreground">Модель: тяга T = Ct·ρ·n²·D⁴, мощность P = Cp·ρ·n³·D⁵, обороты ≈ KV·U·0.8. Это оценка — реальные цифры зависят от конкретных деталей.</p>
          </Card>

          <Card className="flex flex-col gap-3">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Лётные миссии</p>
            {bad && <p className="text-sm text-destructive">В сборке есть ошибки — в симуляторе дрон может не взлететь или упасть. Можно попробовать и убедиться.</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MISSIONS.map((m) => {
                const done = progress.data?.items[`drone:${m.id}`];
                return (
                  <Link key={m.id} to={`/engineering/drone/fly/${m.id}`} className="flex flex-col gap-0.5 rounded-2xl border border-border px-3 py-2.5 transition hover:border-primary hover:bg-primary/5">
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                      {m.title}
                      {done ? <CheckCircle2 className="size-4 text-success" /> : <span className="text-[11px] font-normal text-muted-foreground">{"★".repeat(m.level)}</span>}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{m.brief}</span>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, hot }: { icon: React.ReactNode; label: string; value: string; hot?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-2xl px-3 py-2.5", hot ? "bg-destructive/10" : "bg-muted/60")}>
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon} {label}
      </span>
      <span className="font-display text-xl font-bold tabular">{value}</span>
    </div>
  );
}
