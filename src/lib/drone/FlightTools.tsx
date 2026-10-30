import { useEffect, useRef, useState } from "react";
import { Download, MapPin, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Two engineering tools of the drone lab: a flight log (telemetry like a real flight controller's blackbox,
// with charts and CSV export) and a route editor that turns points on a map into autopilot code.

export interface LogRow {
  t: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  roll: number;
  pitch: number;
  yaw: number;
  battery: number;
  current: number;
}

const SERIES: { key: keyof LogRow; label: string; unit: string; color: string; scale?: number }[] = [
  { key: "z", label: "Высота", unit: "м", color: "#ef4444" },
  { key: "speed", label: "Скорость", unit: "м/с", color: "#3b82f6" },
  { key: "current", label: "Ток", unit: "А", color: "#e6a100" },
  { key: "battery", label: "Батарея", unit: "%", color: "#16a34a", scale: 100 },
];

function Spark({ rows, s }: { rows: LogRow[]; s: (typeof SERIES)[number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const k = s.scale ?? 1;
  const vals = rows.map((r) => (r[s.key] as number) * k);
  const max = Math.max(...vals, 0.001);
  const min = Math.min(...vals, 0);
  useEffect(() => {
    const c = ref.current;
    if (!c || rows.length < 2) return;
    const g = c.getContext("2d")!;
    const W = (c.width = c.clientWidth * devicePixelRatio);
    const H = (c.height = c.clientHeight * devicePixelRatio);
    g.clearRect(0, 0, W, H);
    g.strokeStyle = s.color;
    g.lineWidth = 2 * devicePixelRatio;
    g.beginPath();
    vals.forEach((v, i) => {
      const x = (i / (vals.length - 1)) * W;
      const y = H - ((v - min) / (max - min || 1)) * (H - 4) - 2;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.stroke();
  });
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex justify-between text-[11px] text-muted-foreground">
        {s.label}
        <span>
          макс {max.toFixed(1)} {s.unit}
        </span>
      </span>
      <canvas ref={ref} className="h-10 w-full" />
    </div>
  );
}

export function FlightLog({ rows, name }: { rows: LogRow[]; name: string }) {
  if (rows.length < 5) return null;
  const dist = rows.reduce((acc, r, i) => (i ? acc + Math.hypot(r.x - rows[i - 1].x, r.y - rows[i - 1].y, r.z - rows[i - 1].z) : 0), 0);
  const used = (rows[0].battery - rows[rows.length - 1].battery) * 100;
  const csv = () => {
    const head = "t_s;x_m;y_m;z_m;speed_ms;roll_deg;pitch_deg;yaw_deg;battery_pct;current_a";
    const lines = rows.map((r) => [r.t, r.x, r.y, r.z, r.speed, (r.roll * 180) / Math.PI, (r.pitch * 180) / Math.PI, (r.yaw * 180) / Math.PI, r.battery * 100, r.current].map((v) => v.toFixed(3)).join(";"));
    const url = URL.createObjectURL(new Blob([`﻿${head}\n${lines.join("\n")}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `полёт-${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Журнал полёта (blackbox)</p>
        <Button size="sm" variant="outline" onClick={csv}>
          <Download /> CSV для Excel
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-2.5 py-0.5">Время {rows[rows.length - 1].t.toFixed(1)} с</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5">Путь {dist.toFixed(1)} м</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5">Батарея −{used.toFixed(1)} %</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5">Средний ток {(rows.reduce((a, r) => a + r.current, 0) / rows.length).toFixed(1)} А</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {SERIES.map((s) => (
          <Spark key={s.key} rows={rows} s={s} />
        ))}
      </div>
    </Card>
  );
}

/** Click on the map to add points; the editor writes waypoint-following autopilot code from them. */
export function RouteEditor({ onCode }: { onCode: (code: string) => void }) {
  const [pts, setPts] = useState<{ x: number; y: number; z: number }[]>([]);
  const [alt, setAlt] = useState(2);
  const R = 12; // the map shows −12…12 m
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    const W = (c.width = c.clientWidth * devicePixelRatio);
    const H = (c.height = c.clientHeight * devicePixelRatio);
    const px = (x: number) => ((x + R) / (2 * R)) * W;
    const py = (y: number) => H - ((y + R) / (2 * R)) * H;
    g.fillStyle = "#7fae6a";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,.25)";
    for (let v = -R; v <= R; v += 2) {
      g.beginPath();
      g.moveTo(px(v), 0);
      g.lineTo(px(v), H);
      g.moveTo(0, py(v));
      g.lineTo(W, py(v));
      g.stroke();
    }
    g.fillStyle = "#1f2937";
    g.beginPath();
    g.arc(px(0), py(0), 9 * devicePixelRatio, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#ff5a1f";
    g.lineWidth = 3 * devicePixelRatio;
    g.beginPath();
    g.moveTo(px(0), py(0));
    pts.forEach((p) => g.lineTo(px(p.x), py(p.y)));
    g.stroke();
    g.font = `bold ${11 * devicePixelRatio}px sans-serif`;
    pts.forEach((p, i) => {
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(px(p.x), py(p.y), 8 * devicePixelRatio, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#111";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(i + 1), px(p.x), py(p.y));
    });
  }, [pts]);

  const code = () =>
    `// Маршрут из редактора: точки [x, y, z] в метрах, в конце — посадка на старт.
const route = ${JSON.stringify([...pts.map((p) => [p.x, p.y, p.z]), [0, 0, alt], [0, 0, 0]])};

function autopilot(drone, mem) {
  mem.i ??= 0;
  const [x, y, z] = route[mem.i];
  const dist = Math.hypot(drone.x - x, drone.y - y, drone.z - z);
  if (dist < 0.3 && mem.i < route.length - 1) {
    mem.i++;
    log("точка", mem.i, "из", route.length);
  }
  return { x, y, z };
}
`;

  return (
    <Card className="flex flex-col gap-2">
      <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
        <MapPin className="size-3.5" /> Редактор маршрута
      </p>
      <p className="text-xs text-muted-foreground">Кликай по карте (вид сверху, клетка — 2 м), чтобы поставить точки. Потом вставь маршрут в код автопилота и запусти.</p>
      <canvas
        ref={ref}
        className="aspect-square w-full cursor-crosshair rounded-xl"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = Math.round((((e.clientX - r.left) / r.width) * 2 * R - R) * 2) / 2;
          const y = Math.round((R - ((e.clientY - r.top) / r.height) * 2 * R) * 2) / 2;
          setPts((p) => [...p, { x, y, z: alt }]);
        }}
      />
      <label className="flex items-center gap-2 text-xs">
        Высота новых точек: <b>{alt} м</b>
        <input type="range" min={0.5} max={8} step={0.5} value={alt} onChange={(e) => setAlt(Number(e.target.value))} className="flex-1" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onCode(code())} disabled={!pts.length}>
          <Wand2 /> Вставить в код ({pts.length})
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPts([])} disabled={!pts.length}>
          <Trash2 /> Очистить
        </Button>
      </div>
    </Card>
  );
}
