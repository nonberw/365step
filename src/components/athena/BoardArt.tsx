// From Athena IDE (src/components/workspace/BoardArt.tsx).
"use client";
// Top-down drawing of the breadboard, the board and every part, shared by the editor and the simulator.
// Circuit coordinates are mm with y up; SVG y points down, so every y goes through S().
import { modShort } from "@/lib/athena/deviceGraph";
import { BB_DEPTH, MCU_DIMS, MCU_PINS, RAILS, ROWS, boardHalfLength, holeXY, railCount, type Circuit, type CircuitComp } from "@/lib/athena/circuit";
import { t } from "@/lib/athena/i18n";

export const S = (v: number) => -v;
export const LED_COLOR: Record<string, string> = { "led-red": "#ef4444", "led-yellow": "#eab308", "led-green": "#22c55e", "led-blue": "#3b82f6" };
const RAIL_TINT: Record<string, string> = { TP: "#ef4444", BP: "#ef4444", TN: "#3b82f6", BN: "#3b82f6" };

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export const wireCtrl = (x1: number, y1: number, x2: number, y2: number): [number, number] => {
  const len = dist(x1, y1, x2, y2);
  return [(x1 + x2) / 2 + ((y2 - y1) / (len || 1)) * len * 0.12, (y1 + y2) / 2 - ((x2 - x1) / (len || 1)) * len * 0.12];
};
/** SVG path of a jumper between two circuit points. */
export const wireD = (a: [number, number], b: [number, number]) => {
  const [cx, cy] = wireCtrl(a[0], S(a[1]), b[0], S(b[1]));
  return `M${a[0]} ${S(a[1])} Q${cx} ${cy} ${b[0]} ${S(b[1])}`;
};
export const onWire = (x: number, y: number, a: [number, number], b: [number, number]) => {
  const [cx, cy] = wireCtrl(a[0], a[1], b[0], b[1]);
  for (let i = 0; i <= 20; i++) {
    const s = i / 20, u = 1 - s;
    if (dist(x, y, u * u * a[0] + 2 * u * s * cx + s * s * b[0], u * u * a[1] + 2 * u * s * cy + s * s * b[1]) < 1.3) return true;
  }
  return false;
};
export const bbox = (k: CircuitComp): [number, number, number, number] => {
  if (k.offBoard) {
    const [w, h] = k.kind === "actuator" ? [16, 6] : k.kind === "motor" ? [26, 10] : k.kind === "display" ? [36, 13] : [16, 9];
    return [k.center[0] - w, k.center[1] - h, k.center[0] + w, k.center[1] + h];
  }
  const xs = k.pins.map((p) => p.x), ys = k.pins.map((p) => p.y);
  const w = k.kind === "sensor" ? 22.5 : k.kind === "buzzer" ? 6 : k.kind === "pot" ? 4.75 : k.kind === "module" ? 5 : 3.2;
  const up = k.kind === "sensor" ? 13 : k.kind === "pot" ? 5.5 : k.kind === "module" ? 10 : k.kind === "buzzer" || k.kind === "led" ? 6 : 3.2;
  return [Math.min(...xs) - Math.max(w, 1.6), Math.min(...ys) - 2, Math.max(...xs) + Math.max(w, 1.6), Math.max(...ys) + up];
};

/** The drawing's extent in circuit mm. */
export function viewOf(c: Circuit) {
  const bh = boardHalfLength(c.cols);
  const dims = MCU_DIMS[c.mcuId] ?? MCU_DIMS["uno-r3"];
  const hasOff = c.comps.some((k) => k.offBoard && k.kind !== "display"), hasPsu = c.comps.some((k) => k.kind === "psu");
  const hasDisplay = c.comps.some((k) => k.kind === "display");
  const x0 = hasDisplay ? -bh - 84 : Math.min(-bh, -dims.w / 2) - 6, x1 = hasOff ? bh + 62 : Math.max(bh, dims.w / 2) + 6;
  const yTop = hasPsu ? -52 : -31, y1 = BB_DEPTH / 2 + 5 + dims.d + 5;
  return { x0, x1, yTop, y1, bh, dims };
}

/** The microcontroller board with its pins, and the breadboard with rails and holes. `pinFill` colours a pin (live levels). */
export function BoardBase({ c, pinFill }: { c: Circuit; pinFill?: (pin: string) => string | undefined }) {
  const { bh, dims } = viewOf(c);
  const pins = MCU_PINS[c.mcuId] ?? MCU_PINS["uno-r3"];
  const holes: [number, number][] = [];
  for (let col = 1; col <= c.cols; col++) for (const r of ROWS) holes.push(holeXY(col, r, c.cols));
  for (const r of RAILS) for (let k = 1; k <= railCount(c.cols); k++) if (k % 6 !== 0) holes.push(holeXY(k, r, c.cols));
  return (
    <g>
      <rect x={c.mcuCenter[0] - dims.w / 2} y={S(c.mcuCenter[1]) - dims.d / 2} width={dims.w} height={dims.d} rx={2} fill={c.mcuId === "uno-r3" ? "#0e7490" : "#16181d"} stroke="#ffffff22" strokeWidth={0.4} />
      <text x={c.mcuCenter[0]} y={S(c.mcuCenter[1]) + 1} fontSize={3.4} textAnchor="middle" fill="#ffffff88" style={{ pointerEvents: "none" }}>{modShort(c.mcuId)}</text>
      {Object.entries(pins).map(([name, [lx, ly]]) => {
        const px = c.mcuCenter[0] + lx, py = S(c.mcuCenter[1] + ly), top = ly > 0;
        const ly2 = py + (top ? 2.2 : -2.2);
        const live = pinFill?.(name);
        return <g key={name} style={{ pointerEvents: "none" }}><rect x={px - 0.8} y={py - 0.8} width={1.6} height={1.6} fill={live ?? "#18181b"} stroke="#a1a1aa" strokeWidth={0.2} /><text x={px} y={ly2} fontSize={1.6} textAnchor="start" fill="#ffffffbb" transform={`rotate(${top ? 90 : -90} ${px} ${ly2})`} dominantBaseline="central">{name.replace("_B", "").replace("_C", "")}</text></g>;
      })}
      <rect x={-bh} y={-BB_DEPTH / 2} width={bh * 2} height={BB_DEPTH} rx={2} fill="#e7e5df" />
      <rect x={-bh + 1.5} y={-1.6} width={bh * 2 - 3} height={3.2} fill="#c9c6bd" />
      {RAILS.map((r) => <line key={r} x1={-bh + 3} x2={bh - 3} y1={S(holeXY(1, r, c.cols)[1]) + (r.startsWith("T") ? -2.1 : 2.1)} y2={S(holeXY(1, r, c.cols)[1]) + (r.startsWith("T") ? -2.1 : 2.1)} stroke={RAIL_TINT[r]} strokeWidth={0.35} />)}
      {holes.map(([x, y], i) => <circle key={i} cx={x} cy={S(y)} r={0.62} fill="#3f3f46" />)}
      {Array.from({ length: Math.floor(c.cols / 5) }, (_, i) => (i + 1) * 5).map((c0) => <text key={c0} x={holeXY(c0, "a", c.cols)[0]} y={S(15.9) - 0.2} fontSize={1.7} textAnchor="middle" fill="#71717a" style={{ pointerEvents: "none" }}>{c0}</text>)}
      {ROWS.map((r) => <text key={r} x={-bh + 1.4} y={S(holeXY(1, r, c.cols)[1]) + 0.6} fontSize={1.7} fill="#71717a" style={{ pointerEvents: "none" }}>{r}</text>)}
    </g>
  );
}

/** What the simulator shows on a part. */
export interface PartLive { glow?: number; burned?: boolean; pressed?: boolean; pot?: number; horn?: number; buzzing?: boolean; /** motor speed −1…1 and wheel angle (deg) */ speed?: number; wheel?: number; /** display text */ lines?: [string, string]; lit?: boolean; /** module reading 0–1 for its little gauge */ level?: number }

/** One part, drawn at its holes. */
export function CompArt({ k, live, dim = 1 }: { k: CircuitComp; live?: PartLive; dim?: number }) {
  const [cx, cy] = k.center;
  const legs = k.pins.map((p, i) => <circle key={i} cx={p.x} cy={S(p.y)} r={0.55} fill="#d4d4d8" />);
  let body: React.ReactNode = null;
  if (k.kind === "led") {
    const col = LED_COLOR[k.moduleId] ?? "#ef4444";
    const glow = live?.glow ?? 0;
    body = (
      <g>
        {glow > 0.02 && <circle cx={cx} cy={S(cy)} r={3 + 5 * glow} fill={col} opacity={0.35 * glow} style={{ filter: "blur(1.4px)" }} />}
        <circle cx={cx} cy={S(cy)} r={2.9} fill={live?.burned ? "#3f3f46" : col} fillOpacity={live && !live.burned ? 0.35 + 0.65 * glow : 1} stroke={glow > 0.02 ? "#fff" : "#fff"} strokeOpacity={0.3 + 0.5 * glow} strokeWidth={0.3} />
        {live?.burned && <path d={`M${cx - 1.6} ${S(cy) - 1.6} L${cx + 1.6} ${S(cy) + 1.6} M${cx + 1.6} ${S(cy) - 1.6} L${cx - 1.6} ${S(cy) + 1.6}`} stroke="#f87171" strokeWidth={0.6} />}
      </g>
    );
  } else if (k.kind === "resistor") {
    const [a, b] = k.pins;
    body = <g><line x1={a.x} y1={S(a.y)} x2={b.x} y2={S(b.y)} stroke="#a1a1aa" strokeWidth={0.5} /><rect x={cx - 3.15} y={S(cy) - 1.2} width={6.3} height={2.4} rx={1.1} fill="#d6b98c" /><rect x={cx - 1.6} y={S(cy) - 1.2} width={0.7} height={2.4} fill="#7c3f12" /><rect x={cx - 0.4} y={S(cy) - 1.2} width={0.7} height={2.4} fill="#7c3f12" /></g>;
  } else if (k.kind === "button") body = <g><rect x={cx - 3.1} y={S(cy) - 3.1} width={6.2} height={6.2} rx={0.8} fill="#27272a" stroke={live?.pressed ? "#38bdf8" : "#52525b"} strokeWidth={live?.pressed ? 0.6 : 0.3} /><circle cx={cx} cy={S(cy)} r={live?.pressed ? 1.4 : 1.75} fill={live?.pressed ? "#0ea5e9" : "#3f3f46"} /></g>;
  else if (k.kind === "pot") {
    const px = k.pins[1].x, py = k.pins[1].y;
    const ang = ((live?.pot ?? 0.5) - 0.5) * 270;
    body = <g><rect x={px - 4.75} y={S(py) - 5.5} width={9.5} height={9.5} rx={0.8} fill="#1d4ed8" /><circle cx={px} cy={S(py + 0.75)} r={3.2} fill="#f4f4f5" /><rect x={px - 0.4} y={S(py + 0.75) - 3.2} width={0.8} height={3.4} fill="#a1a1aa" transform={`rotate(${ang} ${px} ${S(py + 0.75)})`} /></g>;
  } else if (k.kind === "buzzer") body = <g><circle cx={cx} cy={S(cy)} r={6} fill="#18181b" stroke={live?.buzzing ? "#fbbf24" : "#52525b"} strokeWidth={live?.buzzing ? 0.6 : 0.3} /><circle cx={cx} cy={S(cy)} r={0.9} fill="#52525b" />{live?.buzzing && [7.5, 9.5].map((r) => <circle key={r} cx={cx} cy={S(cy)} r={r} fill="none" stroke="#fbbf24" strokeOpacity={0.5} strokeWidth={0.3}><animate attributeName="r" from={r - 1.5} to={r + 1.5} dur="0.4s" repeatCount="indefinite" /></circle>)}</g>;
  else if (k.kind === "sensor") { const xc = (k.pins[0].x + k.pins[3].x) / 2, ye = k.pins[0].y; body = <g><rect x={xc - 22.5} y={S(ye) - 0.8} width={45} height={1.6} fill="#1e40af" /><rect x={xc - 21} y={S(ye) - 12.8} width={16} height={12} rx={6} fill="#a1a1aa" /><rect x={xc + 5} y={S(ye) - 12.8} width={16} height={12} rx={6} fill="#a1a1aa" /></g>; }
  else if (k.kind === "actuator") {
    const hx = cx + 5.5;
    const a = (((live?.horn ?? 90) - 90) * Math.PI) / 180;
    body = <g><rect x={cx - 11.1} y={-5.9} width={22.2} height={11.8} rx={1} fill="#1d4ed8" /><rect x={cx - 16.25} y={-5.9} width={32.5} height={2} fill="#1e3a8a" /><circle cx={hx} cy={0} r={3.5} fill="#f4f4f5" /><line x1={hx} y1={0} x2={hx + 9 * Math.sin(a)} y2={-9 * Math.cos(a)} stroke="#f4f4f5" strokeWidth={2} strokeLinecap="round" /><text x={cx - 8} y={1} fontSize={2.6} fill="#bfdbfe">SG90</text></g>;
  } else if (k.kind === "module") {
    const [a, , c3] = k.pins;
    const xc = (a.x + c3.x) / 2, ye = a.y;
    const tint = k.moduleId === "tmp36" ? "#18181b" : k.moduleId === "soil-module" ? "#7f1d1d" : k.moduleId === "pir-module" ? "#065f46" : "#1e3a8a";
    body = (
      <g>
        <rect x={xc - 5} y={S(ye) - 9.5} width={10} height={8.5} rx={0.8} fill={tint} />
        {k.moduleId === "pir-module" && <circle cx={xc} cy={S(ye) - 5.8} r={3.4} fill="#f5f5f4" opacity={0.9} />}
        {k.moduleId === "light-module" && <circle cx={xc} cy={S(ye) - 5.8} r={1.8} fill="#fca5a5" stroke="#7f1d1d" strokeWidth={0.3} />}
        {k.moduleId === "soil-module" && <path d={`M${xc - 3} ${S(ye) - 2} v-7 M${xc + 3} ${S(ye) - 2} v-7`} stroke="#d4d4d8" strokeWidth={1.4} />}
        {k.moduleId === "tmp36" && <text x={xc} y={S(ye) - 4.8} fontSize={2.2} textAnchor="middle" fill="#e4e4e7">TMP</text>}
        {live?.level !== undefined && <rect x={xc - 4.5} y={S(ye) - 1.8} width={9 * Math.max(0, Math.min(1, live.level))} height={0.7} fill="#fbbf24" />}
      </g>
    );
  } else if (k.kind === "motor") {
    const [cx2, cy2] = k.center;
    const wa = ((live?.wheel ?? 0) * Math.PI) / 180;
    const spin = Math.abs(live?.speed ?? 0) > 0.05;
    body = (
      <g>
        <rect x={cx2 - 25} y={S(cy2) - 6} width={14} height={12} rx={1} fill="#b91c1c" />
        <text x={cx2 - 18} y={S(cy2) + 1} fontSize={2.2} textAnchor="middle" fill="#fee2e2">L9110S</text>
        <rect x={cx2 - 8} y={S(cy2) - 5} width={20} height={10} rx={1.5} fill="#facc15" />
        <circle cx={cx2 + 17} cy={S(cy2)} r={8} fill="#27272a" stroke={spin ? "#22c55e" : "#52525b"} strokeWidth={0.6} />
        {[0, 1, 2].map((i) => { const a = wa + (i * 2 * Math.PI) / 3; return <line key={i} x1={cx2 + 17} y1={S(cy2)} x2={cx2 + 17 + 7 * Math.cos(a)} y2={S(cy2) + 7 * Math.sin(a)} stroke="#a1a1aa" strokeWidth={0.8} />; })}
        {live?.speed !== undefined && <text x={cx2 + 17} y={S(cy2) + 12} fontSize={2.4} textAnchor="middle" fill={spin ? "#86efac" : "#71717a"}>{Math.round(live.speed * 100)}%</text>}
      </g>
    );
  } else if (k.kind === "display") {
    const [cx2, cy2] = k.center;
    const lines = live?.lines ?? ["", ""];
    body = (
      <g>
        <rect x={cx2 - 36} y={S(cy2) - 13} width={72} height={26} rx={1.5} fill="#1d4ed8" />
        <rect x={cx2 - 32} y={S(cy2) - 8} width={64} height={16} rx={0.8} fill={live?.lit ? "#a3e635" : "#365314"} />
        {[0, 1].map((r) => <text key={r} x={cx2 - 30.5} y={S(cy2) - 1.8 + r * 6.4} fontSize={5.2} fontFamily="monospace" fill={live?.lit ? "#1a2e05" : "#4d7c0f"} style={{ whiteSpace: "pre" }}>{(lines[r] ?? "").slice(0, 16)}</text>)}
        <text x={cx2} y={S(cy2) + 11.5} fontSize={2.2} textAnchor="middle" fill="#bfdbfe">LCD 16×2 · I2C</text>
      </g>
    );
  } else if (k.kind === "psu") body = <g><rect x={cx - 16} y={S(cy) - 9} width={32} height={18} rx={1.5} fill="#15803d" /><text x={cx - 13} y={S(cy) + 1} fontSize={2.8} fill="#dcfce7">5 V / 2 A</text></g>;
  const [, , , by1] = bbox(k);
  return (
    <g opacity={dim}>
      {body}{!k.offBoard && legs}
      <text x={cx} y={S(Math.max(by1, cy)) - 1.2 - (k.kind === "sensor" ? 12 : 0)} fontSize={2.3} textAnchor="middle" fill="#27272a" fontWeight={600} style={{ pointerEvents: "none" }}>{k.ref}</text>
    </g>
  );
}

export const railLabel = (r: string) => (r === "TN" || r === "BN" ? t("− rail") : t("+ rail"));
