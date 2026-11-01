import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, GraduationCap } from "lucide-react";
import { PRINT_PROFILES, buildRobot, toUrdf, validateRobot, type PrintMaterial, type RobotKind, type RobotParams } from "@shared/robotDesign";
import { GreetingBanner } from "@/components/Page";
import { Badge, Card, Segmented } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useNotify } from "@/components/Notify";
import { saveEngProgress } from "./progress";

// Robot description designer (URDF) built on nwo-text-cad's generator, plus its 3D-print starting profiles.

const KINDS: { value: RobotKind; label: string }[] = [
  { value: "manipulator", label: "🦾 Манипулятор" },
  { value: "mobile", label: "🚗 Колёсный" },
  { value: "legged", label: "🐕 Четвероногий" },
];

export default function RobotDesigner() {
  const notify = useNotify();
  const [p, setP] = useState<RobotParams>({ kind: "manipulator", name: "my_arm", dof: 4, reach: 0.6, payload: 1, drive: "diff-drive", wheelDia: 0.1, legLength: 0.2 });
  const [material, setMaterial] = useState<PrintMaterial>("PETG");
  const model = useMemo(() => buildRobot(p), [p]);
  const errors = validateRobot(model);
  const urdf = useMemo(() => toUrdf(model), [model]);
  const mass = model.links.reduce((s, l) => s + l.massKg, 0);
  const set = (patch: Partial<RobotParams>) => setP((x) => ({ ...x, ...patch }));

  function download() {
    const blob = new Blob([urdf], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${model.name}.urdf`;
    a.click();
    URL.revokeObjectURL(a.href);
    // A downloaded robot counts as a finished project and shows up in the admissions portfolio.
    void saveEngProgress(`robot:${p.kind}`, 100).then((r) => r.xp && notify({ variant: "success", title: `Робот готов 🤖 +${r.xp} XP`, body: "Он уже в портфолио для поступления." }));
  }

  const profile = PRINT_PROFILES[material];
  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner eyebrow="Инженерная лаборатория · NWO Text-to-CAD" title="Робот → URDF" subtitle="Опиши робота параметрами — получи файл URDF со звеньями, суставами и инерцией. Его открывают ROS, Gazebo, PyBullet и онлайн-просмотрщики." />
      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="flex flex-col gap-4">
          <Segmented value={p.kind} onChange={(kind) => set({ kind, name: kind === "manipulator" ? "my_arm" : kind === "mobile" ? "my_rover" : "my_dog" })} options={KINDS} />
          <label className="text-xs font-semibold">
            имя (латиница)
            <Input value={p.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          {p.kind === "manipulator" && (
            <>
              <Range label={`Степеней свободы: ${p.dof}`} min={2} max={7} step={1} value={p.dof} onChange={(dof) => set({ dof })} />
              <Range label={`Вылет: ${p.reach.toFixed(2)} м`} min={0.2} max={1.5} step={0.05} value={p.reach} onChange={(reach) => set({ reach })} />
              <Range label={`Груз: ${p.payload} кг`} min={0.1} max={10} step={0.1} value={p.payload} onChange={(payload) => set({ payload })} />
            </>
          )}
          {p.kind === "mobile" && (
            <>
              <label className="text-xs font-semibold">
                привод
                <Select value={p.drive} onChange={(e) => set({ drive: e.target.value as RobotParams["drive"] })}>
                  <option value="diff-drive">Дифференциальный (2 колеса)</option>
                  <option value="mecanum">Меканум (4 колеса)</option>
                </Select>
              </label>
              <Range label={`Диаметр колеса: ${Math.round(p.wheelDia * 1000)} мм`} min={0.04} max={0.3} step={0.01} value={p.wheelDia} onChange={(wheelDia) => set({ wheelDia })} />
            </>
          )}
          {p.kind === "legged" && <Range label={`Длина ноги: ${Math.round(p.legLength * 100)} см`} min={0.08} max={0.5} step={0.01} value={p.legLength} onChange={(legLength) => set({ legLength })} />}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Stat k="звеньев" v={model.links.length} />
            <Stat k="суставов" v={model.joints.length} />
            <Stat k="масса, кг" v={mass.toFixed(1)} />
          </div>
          {errors.length ? <p className="text-sm text-destructive">{errors.join(" · ")}</p> : <Badge tone="ok">структура проверена: все суставы ведут к звеньям</Badge>}
          <Button onClick={download} disabled={errors.length > 0}>
            <Download /> Скачать {model.name}.urdf
          </Button>
          <Link to="/admissions?tab=portfolio" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <GraduationCap /> Добавить в портфолио для поступления
          </Link>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2">
            <p className="font-display text-lg font-bold">Кинематическая цепочка</p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {model.joints.map((j) => (
                <span key={j.name} className="rounded-full border border-border px-2.5 py-1">
                  {j.parent} → <b>{j.child}</b> <span className="text-muted-foreground">({j.type === "continuous" ? "вращение" : j.type === "revolute" ? `±${j.limits?.upper}` : j.type})</span>
                </span>
              ))}
            </div>
          </Card>
          <Card className="flex min-w-0 flex-col gap-2">
            <p className="font-display text-lg font-bold">URDF</p>
            <pre className="max-h-[420px] overflow-auto rounded-2xl bg-[#0b1014] p-4 font-mono text-xs leading-5 text-[#e8edf6]">{urdf}</pre>
          </Card>
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-lg font-bold">Напечатать детали</p>
              <Segmented value={material} onChange={setMaterial} options={(Object.keys(PRINT_PROFILES) as PrintMaterial[]).map((m) => ({ value: m, label: m }))} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
              <Stat k="сопло, °C" v={profile.temperature} />
              <Stat k="стол, °C" v={profile.bedTemp} />
              <Stat k="скорость, мм/с" v={profile.speed} />
              <Stat k="слой, мм" v={profile.layerHeight} />
              <Stat k="заполнение, %" v={profile.infill} />
            </div>
            <p className="text-xs text-muted-foreground">
              Стартовые настройки слайсера из nwo-text-cad. Сами детали модели строй в{" "}
              <Link to="/engineering/cad/box" className="font-semibold text-primary">
                CAD-лаборатории
              </Link>
              : генератор CAD в nwo-text-cad пока заготовка и не строит геометрию.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Range({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-xs font-semibold">
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--primary)]" />
    </label>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-2xl bg-muted px-2 py-2">
      <p className="font-display text-lg font-bold">{v}</p>
      <p className="text-muted-foreground">{k}</p>
    </div>
  );
}
