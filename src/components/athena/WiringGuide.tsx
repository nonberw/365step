// From Athena IDE (src/components/workspace/WiringGuide.tsx).
"use client";
// Step-by-step build guide for breadboard circuits. The diagram is progressive: it shows the board as it should look
// after the current step, so a beginner can match it hole for hole. Everything comes from wiringGuide(graph).
import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Clock, Cuboid, Lightbulb, ListChecks, Table2, Wrench, ZoomIn, ZoomOut } from "lucide-react";
import { useStore } from "@/lib/athena/store";
import { BB_DEPTH, MCU_DIMS, MCU_PINS, RAILS, ROWS, boardHalfLength, buildCircuit, holeXY, railCount, type CircuitComp } from "@/lib/athena/circuit";
import { wiringGuide, PHASES, type GuideStep, type Phase } from "@/lib/athena/wiring";
import { BAND_HEX, resistorBands } from "@/lib/athena/resistor";
import { CATALOG, modShort } from "@/lib/athena/deviceGraph";
import { guideOf, useProjectDone } from "@/lib/athena/catalogClient";
import { t, tn } from "@/lib/athena/i18n";

const LED_COLOR: Record<string, string> = { "led-red": "#ef4444", "led-yellow": "#eab308", "led-green": "#22c55e", "led-blue": "#3b82f6" };
const RAIL_TINT: Record<string, string> = { TP: "#ef4444", BP: "#ef4444", TN: "#3b82f6", BN: "#3b82f6" };
const PHASE_LABEL: Record<Phase, () => string> = { prepare: () => t("Prepare"), place: () => t("Place the parts"), power: () => t("Power and ground wires"), signal: () => t("Signal wires"), test: () => t("Test it") };
const S = (v: number) => -v;
const wireCtrl = (x1: number, y1: number, x2: number, y2: number): [number, number] => {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  return [(x1 + x2) / 2 + ((y2 - y1) / len) * len * 0.12, (y1 + y2) / 2 - ((x2 - x1) / len) * len * 0.12];
};

/** Top-down board showing everything up to and including the current step. */
function BoardDiagram({ steps, cur }: { steps: GuideStep[]; cur: number }) {
  const graph = useStore((s) => s.graph);
  const [zoom, setZoom] = useState(true);
  const c = useMemo(() => buildCircuit(graph), [graph]);
  const step = steps[cur];
  const upTo = steps.slice(0, cur + 1);
  const shownComps = new Set(upTo.map((s) => s.compRef).filter(Boolean));
  const shownWires = new Set(upTo.map((s) => s.wireId).filter(Boolean));
  const { cols, mcuCenter, mcuId } = c;
  const bh = boardHalfLength(cols), dims = MCU_DIMS[mcuId] ?? MCU_DIMS["uno-r3"], pins = MCU_PINS[mcuId] ?? MCU_PINS["uno-r3"];
  const hasOff = c.comps.some((k) => k.offBoard), hasPsu = c.comps.some((k) => k.kind === "psu");
  const x0 = Math.min(-bh, -dims.w / 2) - 6, x1 = hasOff ? bh + 58 : Math.max(bh, dims.w / 2) + 6;
  const yTop = hasPsu ? -52 : -31, y1 = BB_DEPTH / 2 + 5 + dims.d + 5;
  const showBoard = step.phase !== "prepare" || cur >= 1;
  const showMcu = cur >= 1;

  // zoom to whatever this step is about, keeping a landscape frame; the whole board for setup and testing steps
  const focus = (() => {
    const pts: [number, number][] = [];
    const comp = step.compRef ? c.comps.find((k) => k.ref === step.compRef) : undefined;
    const wire = step.wireId ? c.wires.find((w) => w.id === step.wireId) : undefined;
    if (comp) { comp.pins.forEach((p) => pts.push([p.x, S(p.y)])); if (comp.offBoard) pts.push([comp.center[0] - 18, S(comp.center[1]) - 10], [comp.center[0] + 18, S(comp.center[1]) + 10]); else pts.push([comp.center[0], S(comp.center[1]) - 9]); }
    if (wire) pts.push([wire.a.x, S(wire.a.y)], [wire.b.x, S(wire.b.y)]);
    if (!pts.length) return null;
    const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0])), minY = Math.min(...pts.map((q) => q[1])), maxY = Math.max(...pts.map((q) => q[1]));
    const ASPECT = 1.5;
    let w = Math.max(maxX - minX + 22, 48), h = Math.max(maxY - minY + 18, 32);
    if (w / h < ASPECT) w = h * ASPECT; else h = w / ASPECT;
    return [(minX + maxX) / 2 - w / 2, (minY + maxY) / 2 - h / 2, w, h] as const;
  })();
  const zoomed = zoom && !!focus;
  const vb = zoomed ? focus! : ([x0, yTop, x1 - x0, y1 - yTop] as const);

  const tag = (x: number, y: number, text: string, key: string | number) => (
    <g key={key} style={{ pointerEvents: "none" }}>
      <rect x={x - text.length * 0.78 - 0.8} y={y - 2.1} width={text.length * 1.56 + 1.6} height={3.4} rx={1.2} fill="#0b0c10" fillOpacity={0.88} stroke="#38bdf8" strokeWidth={0.25} />
      <text x={x} y={y + 0.35} fontSize={2.3} textAnchor="middle" fill="#bae6fd" fontWeight={600}>{text}</text>
    </g>
  );

  const drawComp = (k: CircuitComp) => {
    const [cx, cy] = k.center;
    const active = step.compRef === k.ref;
    const legs = k.pins.map((p, i) => <circle key={i} cx={p.x} cy={S(p.y)} r={0.55} fill="#d4d4d8" />);
    let body: React.ReactNode = null;
    if (k.kind === "led") body = <g><circle cx={cx} cy={S(cy)} r={2.9} fill={LED_COLOR[k.moduleId] ?? "#ef4444"} stroke="#fff" strokeOpacity={0.5} strokeWidth={0.3} /><circle cx={k.pins[0].x} cy={S(k.pins[0].y)} r={0.9} fill="none" stroke="#fff" strokeWidth={0.3} /><text x={k.pins[0].x} y={S(k.pins[0].y) + 5.2} fontSize={2} fill="#27272a" textAnchor="middle">+</text></g>;
    else if (k.kind === "resistor") {
      const [a, b] = k.pins;
      const bands = resistorBands(CATALOG[k.moduleId].ohm ?? 220);
      body = <g><line x1={a.x} y1={S(a.y)} x2={b.x} y2={S(b.y)} stroke="#a1a1aa" strokeWidth={0.5} /><rect x={cx - 3.15} y={S(cy) - 1.2} width={6.3} height={2.4} rx={1.1} fill="#d6b98c" />
        {bands.map((name, i) => <rect key={i} x={cx - 2.3 + i * 1.25} y={S(cy) - 1.2} width={0.65} height={2.4} fill={BAND_HEX[name]} />)}</g>;
    } else if (k.kind === "button") body = <g><rect x={cx - 3.1} y={S(cy) - 3.1} width={6.2} height={6.2} rx={0.8} fill="#27272a" stroke="#52525b" strokeWidth={0.3} /><circle cx={cx} cy={S(cy)} r={1.75} fill="#3f3f46" /></g>;
    else if (k.kind === "pot") { const px = k.pins[1].x, py = k.pins[1].y; body = <g><rect x={px - 4.75} y={S(py) - 5.5} width={9.5} height={9.5} rx={0.8} fill="#1d4ed8" /><circle cx={px} cy={S(py + 0.75)} r={3.2} fill="#f4f4f5" /><rect x={px - 0.4} y={S(py + 0.75) - 3.2} width={0.8} height={3.4} fill="#a1a1aa" /></g>; }
    else if (k.kind === "buzzer") body = <g><circle cx={cx} cy={S(cy)} r={6} fill="#18181b" stroke="#52525b" strokeWidth={0.3} /><circle cx={cx} cy={S(cy)} r={0.9} fill="#52525b" /><text x={k.pins[0].x} y={S(k.pins[0].y) + 3.2} fontSize={2.2} fill="#a1a1aa" textAnchor="middle">+</text></g>;
    else if (k.kind === "sensor") { const xc = (k.pins[0].x + k.pins[3].x) / 2, ye = k.pins[0].y; body = <g><rect x={xc - 22.5} y={S(ye) - 0.8} width={45} height={1.6} fill="#1e40af" /><rect x={xc - 21} y={S(ye) - 12.8} width={16} height={12} rx={6} fill="#a1a1aa" /><rect x={xc + 5} y={S(ye) - 12.8} width={16} height={12} rx={6} fill="#a1a1aa" /></g>; }
    else if (k.kind === "actuator") body = <g><rect x={cx - 11.1} y={-5.9} width={22.2} height={11.8} rx={1} fill="#1d4ed8" /><rect x={cx - 16.25} y={-5.9} width={32.5} height={2} fill="#1e3a8a" /><circle cx={cx + 5.5} cy={0} r={3.5} fill="#f4f4f5" /><text x={cx - 8} y={1} fontSize={2.6} fill="#bfdbfe">SG90</text></g>;
    else if (k.kind === "psu") body = <g><rect x={cx - 16} y={S(cy) - 9} width={32} height={18} rx={1.5} fill="#15803d" /><text x={cx - 13} y={S(cy) + 1} fontSize={2.8} fill="#dcfce7">5 V / 2 A</text></g>;
    const xs = k.pins.map((p) => p.x), ys = k.pins.map((p) => p.y);
    return (
      <g key={k.ref}>
        {active && <rect x={Math.min(...xs) - 6.5} y={S(Math.max(...ys)) - 8.5} width={Math.max(...xs) - Math.min(...xs) + 13} height={Math.max(...ys) - Math.min(...ys) + 15} rx={2} fill="#38bdf8" fillOpacity={0.14} stroke="#38bdf8" strokeWidth={0.5} strokeDasharray="1.6 1.1" />}
        {body}{!k.offBoard && legs}
        <text x={cx} y={S(Math.max(...ys, cy)) - 3.5 - (k.kind === "sensor" ? 11 : 0)} fontSize={2.3} textAnchor="middle" fill="#27272a" fontWeight={600}>{k.ref}</text>
        {active && !k.offBoard && k.pins.map((p, i) => {
          const hl = holeLabel(p.node);
          return hl ? tag(p.x, S(p.y) + (p.y > 0 ? -5.2 - (i % 2) * 3.6 : 5.2 + (i % 2) * 3.6), `${p.name} ${hl}`, i) : null;
        })}
      </g>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c10]">
      <svg viewBox={vb.join(" ")} className="block max-h-[420px] w-full select-none" role="img" aria-label={t("Wiring diagram after step {n}", { n: cur + 1 })}>
        {showMcu && (
          <g>
            <rect x={mcuCenter[0] - dims.w / 2} y={S(mcuCenter[1]) - dims.d / 2} width={dims.w} height={dims.d} rx={2} fill={mcuId === "uno-r3" ? "#0e7490" : "#16181d"} stroke="#ffffff22" strokeWidth={0.4} />
            <text x={mcuCenter[0]} y={S(mcuCenter[1]) + 1} fontSize={3.4} textAnchor="middle" fill="#ffffff88">{modShort(mcuId)}</text>
            {Object.entries(pins).map(([name, [lx, ly]]) => {
              const px = mcuCenter[0] + lx, py = S(mcuCenter[1] + ly), top = ly > 0, ly2 = py + (top ? 2.2 : -2.2);
              const hot = step.wireId && c.wires.find((w) => w.id === step.wireId && (w.a.node === `m:${name}` || w.b.node === `m:${name}`));
              return <g key={name}><rect x={px - 0.8} y={py - 0.8} width={1.6} height={1.6} fill={hot ? "#38bdf8" : "#18181b"} stroke="#a1a1aa" strokeWidth={0.2} /><text x={px} y={ly2} fontSize={1.6} fill={hot ? "#bae6fd" : "#ffffffbb"} transform={`rotate(${top ? 90 : -90} ${px} ${ly2})`} dominantBaseline="central">{name.replace("_B", "").replace("_C", "")}</text></g>;
            })}
          </g>
        )}
        {showBoard && (
          <g>
            <rect x={-bh} y={-BB_DEPTH / 2} width={bh * 2} height={BB_DEPTH} rx={2} fill="#e7e5df" />
            <rect x={-bh + 1.5} y={-1.6} width={bh * 2 - 3} height={3.2} fill="#c9c6bd" />
            {RAILS.map((r) => { const yy = S(holeXY(1, r, cols)[1]) + (r.startsWith("T") ? -2.1 : 2.1); return <line key={r} x1={-bh + 3} x2={bh - 3} y1={yy} y2={yy} stroke={RAIL_TINT[r]} strokeWidth={0.35} />; })}
            {ROWS.flatMap((r) => Array.from({ length: cols }, (_, i) => { const [x, y] = holeXY(i + 1, r, cols); return <circle key={`${r}${i}`} cx={x} cy={S(y)} r={0.62} fill="#3f3f46" />; }))}
            {RAILS.flatMap((r) => Array.from({ length: railCount(cols) }, (_, i) => i + 1).filter((k) => k % 6 !== 0).map((k) => { const [x, y] = holeXY(k, r, cols); return <circle key={`${r}${k}`} cx={x} cy={S(y)} r={0.62} fill="#3f3f46" />; }))}
            {Array.from({ length: Math.floor(cols / 5) }, (_, i) => (i + 1) * 5).map((c0) => <text key={c0} x={holeXY(c0, "a", cols)[0]} y={S(15.9) - 0.2} fontSize={1.7} textAnchor="middle" fill="#71717a">{c0}</text>)}
            {ROWS.map((r) => <text key={r} x={-bh + 1.4} y={S(holeXY(1, r, cols)[1]) + 0.6} fontSize={1.7} fill="#71717a">{r}</text>)}
          </g>
        )}
        {c.comps.filter((k) => shownComps.has(k.ref)).map(drawComp)}
        {c.wires.filter((w) => shownWires.has(w.id)).map((w) => {
          const active = step.wireId === w.id;
          const [cx, cy] = wireCtrl(w.a.x, S(w.a.y), w.b.x, S(w.b.y));
          const d = `M${w.a.x} ${S(w.a.y)} Q${cx} ${cy} ${w.b.x} ${S(w.b.y)}`;
          return (
            <g key={w.id} opacity={active || !step.wireId ? 1 : 0.55}>
              {active && <path d={d} fill="none" stroke="#38bdf8" strokeOpacity={0.55} strokeWidth={4.2} strokeLinecap="round" />}
              <path d={d} fill="none" stroke="#000" strokeOpacity={0.45} strokeWidth={1.9} strokeLinecap="round" />
              <path d={d} fill="none" stroke={w.color} strokeWidth={1.2} strokeLinecap="round" />
              {[w.a, w.b].map((e, i) => <circle key={i} cx={e.x} cy={S(e.y)} r={active ? 1.4 : 0.9} fill={w.color} stroke={active ? "#fff" : "#000"} strokeOpacity={active ? 1 : 0.4} strokeWidth={0.3} />)}
              {active && [w.a, w.b].map((e, i) => tag(e.x, S(e.y) + (e.y > 0 ? -4.5 : 4.8), e.hole ? (RAIL_TINT[e.hole.r] ? `${e.label} ${e.hole.c}` : e.label) : e.label, i))}
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-0.5 font-mono text-[11px] text-neutral-300">{t("After step {n}", { n: cur + 1 })}</div>
      {focus && <button onClick={() => setZoom((z) => !z)} aria-pressed={zoom} className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-neutral-200 transition hover:bg-black">{zoom ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}{zoom ? t("Whole board") : t("Zoom to step")}</button>}
    </div>
  );

  function holeLabel(node: string) {
    const m = /^h:(\d+)(T|B)$/.exec(node);
    return m ? `${m[1]}${m[2] === "T" ? "a–e" : "f–j"}` : null;
  }
}

function Swatches({ names }: { names: string[] }) {
  return <span className="inline-flex items-center gap-0.5 align-middle">{names.map((n, i) => <span key={i} className="h-3 w-1.5 rounded-[1px] border border-white/20" style={{ background: BAND_HEX[n] }} />)}</span>;
}

export default function WiringGuide() {
  const { graph, setFocus, setTab } = useStore();
  const project = useStore((s) => s.project);
  useStore((s) => s.lang);
  const guide = useMemo(() => wiringGuide(graph), [graph]);
  const { done: finished, toggle } = useProjectDone(project);
  const [cur, setCur] = useState(0);
  const [doneSteps, setDone] = useState<Set<string>>(new Set());
  const [have, setHave] = useState<Set<string>>(new Set());
  const steps = guide.steps;
  const i = Math.min(cur, steps.length - 1);
  const step = steps[i];
  const pct = Math.round((steps.filter((s) => doneSteps.has(s.title)).length / steps.length) * 100);
  const focusOf = (s: GuideStep) => s.parts[0] ?? (s.wireId ? `wire:${s.wireId}` : null);
  const go = (n: number) => { const k = Math.max(0, Math.min(steps.length - 1, n)); setCur(k); setFocus(focusOf(steps[k])); };
  const mark = () => { setDone((d) => new Set(d).add(step.title)); go(i + 1); };
  const proj = guideOf(project);
  const allDone = steps.every((s) => doneSteps.has(s.title));

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-medium text-neutral-50"><ListChecks className="h-4 w-4" />{proj ? proj.title : t("Wiring guide")}</h3>
          <span className="flex items-center gap-3 font-mono text-[11.5px] text-neutral-400"><span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{t("about {n} min", { n: guide.minutes })}</span>{tn(steps.length, "{n} step", "{n} steps")}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-neutral-50 transition-all" style={{ width: `${pct}%` }} /></div>
          <span className="font-mono text-[11px] text-neutral-400">{pct}%</span>
        </div>
        {proj && <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-400">{proj.goal}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <BoardDiagram steps={steps} cur={i} />
        <div className="flex flex-col rounded-2xl border border-white/15 bg-white/[0.05] p-4">
          <div className="mb-1 text-[10.5px] font-semibold tracking-[0.16em] text-neutral-500">{t("STEP {n} OF {total}", { n: i + 1, total: steps.length })} · {PHASE_LABEL[step.phase]().toUpperCase()}</div>
          <div className="text-[16px] font-medium text-neutral-50">{step.title}</div>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-200">{step.detail}</p>
          {step.why && <p className="mt-2.5 flex gap-2 text-[12.5px] leading-relaxed text-neutral-400"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" /><span><span className="text-sky-200">{t("Why:")}</span> {step.why}</span></p>}
          {step.check && <p className="mt-2 flex gap-2 text-[12.5px] leading-relaxed text-neutral-400"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /><span><span className="text-emerald-200">{t("Check:")}</span> {step.check}</span></p>}
          {step.warn && <p className="mt-2 flex gap-2 rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-2.5 text-[12px] leading-relaxed text-amber-100"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{step.warn}</p>}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            <button onClick={() => go(i - 1)} disabled={i === 0} aria-label={t("Previous step")} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-neutral-300 hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={mark} className="flex items-center gap-1.5 rounded-full bg-neutral-50 px-4 py-2 text-[12.5px] font-medium text-neutral-900 transition hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"><Check className="h-3.5 w-3.5" />{i === steps.length - 1 ? t("Finish") : t("Done, next step")}</button>
            <button onClick={() => go(i + 1)} disabled={i === steps.length - 1} aria-label={t("Next step")} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-neutral-300 hover:bg-white/10 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            {/* BSTS: no 3D view in the Arduino lab, so no «Show in 3D» */}
          </div>
          {allDone && proj && (
            <button onClick={toggle} className={`mt-3 rounded-full border px-4 py-2 text-[12.5px] transition ${finished ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200" : "border-white/20 text-neutral-100 hover:bg-white/10"}`}>
              {finished ? t("Project marked as done") : t("Mark project as done")}
            </button>
          )}
        </div>
      </div>

      <ol className="space-y-1">
        {PHASES.filter((p) => steps.some((s) => s.phase === p)).map((p) => (
          <li key={p}>
            <div className="mb-1 mt-3 text-[10.5px] font-semibold tracking-[0.16em] text-neutral-500">{PHASE_LABEL[p]().toUpperCase()}</div>
            {steps.map((s, n) => s.phase === p && (
              <button key={s.id} onClick={() => go(n)} className={`mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${n === i ? "border-white/40 bg-white/[0.07]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] ${doneSteps.has(s.title) ? "border-transparent bg-neutral-50 text-neutral-900" : "border-white/15 text-neutral-400"}`}>{doneSteps.has(s.title) ? <Check className="h-3.5 w-3.5" /> : n + 1}</span>
                <span className={`text-[12.5px] ${doneSteps.has(s.title) ? "text-neutral-500 line-through" : "text-neutral-200"}`}>{s.title}</span>
              </button>
            ))}
          </li>
        ))}
      </ol>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-neutral-400"><ListChecks className="h-3.5 w-3.5" />{t("PARTS CHECKLIST")}</h4>
          <div className="space-y-1">
            {guide.parts.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12.5px]">
                <input type="checkbox" checked={have.has(p.id)} onChange={() => setHave((h) => { const n = new Set(h); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} className="accent-white" />
                <span className="font-mono text-neutral-500">{p.qty}×</span><span className={have.has(p.id) ? "text-neutral-500 line-through" : "text-neutral-200"}>{p.name}</span>
                {CATALOG[p.id].kind === "resistor" && <span className="ml-auto flex items-center gap-1.5 text-[11px] text-neutral-500"><Swatches names={resistorBands(CATALOG[p.id].ohm ?? 220)} /></span>}
              </label>
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-neutral-400"><Table2 className="h-3.5 w-3.5" />{t("PIN MAP")}</h4>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-[12px]">
              <thead className="bg-white/[0.04] text-left text-[10.5px] uppercase tracking-wider text-neutral-500"><tr><th className="px-3 py-1.5 font-medium">{t("Board pin")}</th><th className="px-3 py-1.5 font-medium">{t("Goes to")}</th></tr></thead>
              <tbody>
                {guide.pinMap.map((r, n) => (
                  <tr key={n} className="border-t border-white/5">
                    <td className="px-3 py-1.5 font-mono text-neutral-100"><span className="mr-2 inline-block h-2 w-2 rounded-full border border-white/20" style={{ background: r.hex }} />{r.pin}</td>
                    <td className="px-3 py-1.5 text-neutral-400">{r.goes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-neutral-400"><Wrench className="h-3.5 w-3.5" />{t("IF IT DOES NOT WORK")}</h4>
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-neutral-400">{guide.trouble.map((x) => <li key={x} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />{x}</li>)}</ul>
      </div>
    </div>
  );
}
