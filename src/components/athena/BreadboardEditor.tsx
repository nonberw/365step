// From Athena IDE (src/components/workspace/BreadboardEditor.tsx).
"use client";
// Interactive top-down breadboard: place parts, drag them between holes, draw jumper wires. Every edit goes through
// circuitEdit.ts, so the 3D model, netlist, checks, BOM and code update from the same layout.
import { useMemo, useRef, useState } from "react";
import { Cable, Eraser, MousePointer2, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useStore } from "@/lib/athena/store";
import { CATALOG, modName, modShort } from "@/lib/athena/deviceGraph";
import {
  FOOT, MAX_OF, MCU_PINS, OFFBOARD, RAILS, ROWS, WIRE_COLORS, WIRE_NAME, buildCircuit, footHoles, holeXY, layoutOf, railCount, setPreset,
  type CircuitComp, type Ref,
} from "@/lib/athena/circuit";
import { addWire, clearCircuit, fitComp, moveComp, placeComp, recolorWire, removeComp, removeWire, swapComp } from "@/lib/athena/circuitEdit";
import { t } from "@/lib/athena/i18n";
import { BoardBase, CompArt, LED_COLOR, S, bbox, dist, onWire, viewOf, wireCtrl } from "./BoardArt";

type Tool = { k: "select" } | { k: "wire" } | { k: "place"; id: string };
type Sel = { k: "comp"; ref: string } | { k: "wire"; i: number } | null;
interface Target { ref: Ref; x: number; y: number; label: string }

const PALETTE = ["led-red", "led-yellow", "led-green", "led-blue", "res-100", "res-220", "res-330", "res-470", "res-1k", "res-10k", "btn-6mm", "pot-10k", "buzzer-act", "hcsr04",
  "light-module", "tmp36", "soil-module", "pir-module", "servo-sg90", "dc-motor", "lcd-1602", "psu-5v-2a"];
export default function BreadboardEditor() {
  const { graph, update, undo, history, readOnly } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>({ k: "select" });
  const [sel, setSel] = useState<Sel>(null);
  const [hover, setHover] = useState<Target | null>(null);
  const [start, setStart] = useState<Ref | null>(null);
  const [drag, setDrag] = useState<{ ref: string; dc: number; c: number; r: string; moved: boolean } | null>(null);
  const [msg, setMsg] = useState<string>("");

  const circuit = useMemo(() => buildCircuit(graph), [graph]);
  const layout = layoutOf(graph);
  const { cols, mcuCenter, mcuId } = circuit;
  const pins = MCU_PINS[mcuId] ?? MCU_PINS["uno-r3"];

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg((x) => (x === m ? "" : x)), 2600); };
  const apply = (r: { graph?: typeof graph; error?: string }) => { if (r.error) flash(r.error); else if (r.graph) update(r.graph); return !r.error; };

  // everything a click can land on
  const targets = useMemo<Target[]>(() => {
    const out: Target[] = [];
    for (let col = 1; col <= cols; col++) for (const r of ROWS) { const [x, y] = holeXY(col, r, cols); out.push({ ref: { t: "hole", c: col, r }, x, y, label: `${col}${r}` }); }
    for (const r of RAILS) for (let k = 1; k <= railCount(cols); k++) if (k % 6 !== 0) { const [x, y] = holeXY(k, r, cols); out.push({ ref: { t: "hole", c: k, r }, x, y, label: r === "TN" || r === "BN" ? t("− rail") : t("+ rail") }); }
    for (const [pin, [lx, ly]] of Object.entries(pins)) out.push({ ref: { t: "mcu", pin }, x: mcuCenter[0] + lx, y: mcuCenter[1] + ly, label: pin });
    for (const k of circuit.comps) if (k.offBoard) for (const p of k.pins) out.push({ ref: { t: "pin", ref: k.ref, pin: p.name }, x: p.x, y: p.y, label: `${k.ref} ${p.name}` });
    return out;
  }, [cols, pins, mcuCenter, circuit.comps]);

  const near = (x: number, y: number, only?: (tg: Target) => boolean): Target | null => {
    let best: Target | null = null, bd = 1.7;
    for (const tg of targets) { if (only && !only(tg)) continue; const d = dist(x, y, tg.x, tg.y); if (d < bd) { bd = d; best = tg; } }
    return best;
  };
  const xyOf = (r: Ref): [number, number] | null => {
    if (r.t === "hole") return holeXY(r.c, r.r, cols);
    if (r.t === "mcu") return pins[r.pin] ? [mcuCenter[0] + pins[r.pin][0], mcuCenter[1] + pins[r.pin][1]] : null;
    const p = circuit.comps.find((k) => k.ref === r.ref)?.pins.find((q) => q.name === r.pin);
    return p ? [p.x, p.y] : null;
  };
  const toMm = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: q.x, y: -q.y };
  };

  const selectTool = (k: Tool) => { setTool(k); setStart(null); setSel(null); };
  const del = () => {
    if (!sel || readOnly) return;
    update(sel.k === "comp" ? removeComp(graph, sel.ref) : removeWire(graph, sel.i));
    setSel(null);
  };

  const wireEnds = layout.wires.map((w) => [xyOf(w.a), xyOf(w.b)] as const);

  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).focus?.();
    if (readOnly) return;
    const { x, y } = toMm(e);
    if (tool.k === "place") {
      const tg = near(x, y, (q) => q.ref.t === "hole" && ROWS.includes(q.ref.r));
      if (tg && tg.ref.t === "hole") { if (apply(placeComp(graph, tool.id, tg.ref.c, tg.ref.r))) setTool({ k: "select" }); }
      return;
    }
    if (tool.k === "wire") {
      const tg = near(x, y);
      if (!tg) { setStart(null); return; }
      if (!start) { setStart(tg.ref); return; }
      if (apply(addWire(graph, start, tg.ref))) setStart(null);
      return;
    }
    // select: a part first (nearest leg wins, then the smallest box under the pointer), then a wire
    const byLeg = circuit.comps.filter((k) => !k.offBoard).map((k) => ({ k, d: Math.min(...k.pins.map((p) => dist(x, y, p.x, p.y))) })).filter((q) => q.d < 1.7).sort((a, b) => a.d - b.d)[0]?.k;
    const area = (k: CircuitComp) => { const [a, b, c, d] = bbox(k); return (c - a) * (d - b); };
    const hit = byLeg ?? circuit.comps.filter((k) => { const [bx0, by0, bx1, by1] = bbox(k); return x >= bx0 && x <= bx1 && y >= by0 && y <= by1; }).sort((a, b) => area(a) - area(b))[0];
    if (hit) {
      setSel({ k: "comp", ref: hit.ref });
      const pc = layout.comps.find((q) => q.ref === hit.ref);
      if (pc && pc.c !== undefined) {
        const foot = FOOT[hit.kind]!.pins;
        let g = 0, bd = 1e9;
        hit.pins.forEach((p, i) => { const d = dist(x, y, p.x, p.y); if (d < bd) { bd = d; g = foot[i].dc; } });
        setDrag({ ref: hit.ref, dc: g, c: pc.c, r: pc.r!, moved: false });
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      return;
    }
    const wi = wireEnds.findIndex(([a, b]) => !!a && !!b && onWire(x, S(y), [a[0], S(a[1])], [b[0], S(b[1])]));
    setSel(wi >= 0 ? { k: "wire", i: wi } : null);
  };

  const move = (e: React.PointerEvent) => {
    const { x, y } = toMm(e);
    const tg = near(x, y);
    setHover(tg);
    if (drag && tg && tg.ref.t === "hole" && ROWS.includes(tg.ref.r)) {
      const c = tg.ref.c - drag.dc;
      if (c !== drag.c || tg.ref.r !== drag.r) setDrag({ ...drag, c, r: tg.ref.r, moved: true });
    }
  };
  const up = () => {
    if (drag?.moved) {
      const pc = layout.comps.find((q) => q.ref === drag.ref);
      if (pc && (pc.c !== drag.c || pc.r !== drag.r)) apply(moveComp(graph, drag.ref, drag.c, drag.r));
    }
    setDrag(null);
  };
  const key = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "SELECT") return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); del(); }
    else if (e.key === "Escape") { setStart(null); setTool({ k: "select" }); setSel(null); }
    else if (e.key === "w" || e.key === "W") selectTool({ k: "wire" });
    else if (e.key === "v" || e.key === "V") selectTool({ k: "select" });
  };

  // ---- ghost: where the armed part / dragged part would land ----
  const ghost = (() => {
    if (drag?.moved) {
      const pc = layout.comps.find((q) => q.ref === drag.ref)!;
      const kind = CATALOG[pc.moduleId].kind;
      const row = FOOT[kind]!.pins.some((p) => p.row) ? pc.r! : drag.r;
      return { holes: footHoles(kind, drag.c, row), ok: !fitComp(graph, pc.moduleId, drag.c, row, drag.ref) };
    }
    if (tool.k === "place" && hover && hover.ref.t === "hole" && ROWS.includes(hover.ref.r) && FOOT[CATALOG[tool.id].kind]) {
      const kind = CATALOG[tool.id].kind;
      return { holes: footHoles(kind, hover.ref.c, hover.ref.r), ok: !fitComp(graph, tool.id, hover.ref.c, hover.ref.r) };
    }
    return null;
  })();

  // ---- drawing (SVG y points down, circuit y points up: negate y) ----
  const { x0, x1, yTop, y1 } = viewOf(circuit);

  const drawComp = (k: CircuitComp) => {
    const dim = drag?.moved && drag.ref === k.ref ? 0.3 : 1;
    const on = sel?.k === "comp" && sel.ref === k.ref;
    const [bx0, by0, bx1, by1] = bbox(k);
    return (
      <g key={k.ref}>
        <CompArt k={k} dim={dim} />
        {on && <rect x={bx0} y={S(by1)} width={bx1 - bx0} height={by1 - by0} rx={1.5} fill="none" stroke="#38bdf8" strokeWidth={0.5} strokeDasharray="1.5 1" />}
      </g>
    );
  };

  const armed = tool.k === "place" ? tool.id : null;
  const chip = (id: string) => {
    const m = CATALOG[id];
    const max = MAX_OF[m.kind];
    const taken = max !== undefined && layout.comps.filter((q) => CATALOG[q.moduleId].kind === m.kind).length >= max;
    return (
      <button key={id} disabled={readOnly || taken} title={modName(id)}
        onClick={() => { if (OFFBOARD.includes(m.kind)) apply(placeComp(graph, id)); else selectTool({ k: "place", id }); }}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition disabled:opacity-35 ${armed === id ? "border-sky-300/70 bg-sky-400/20 text-sky-100" : "border-white/10 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.09]"}`}>
        {LED_COLOR[id] && <span className="h-2 w-2 rounded-full" style={{ background: LED_COLOR[id] }} />}
        {modShort(id)}
      </button>
    );
  };

  const selComp = sel?.k === "comp" ? layout.comps.find((q) => q.ref === sel.ref) : undefined;
  const selWire = sel?.k === "wire" ? layout.wires[sel.i] : undefined;
  const hint = tool.k === "place" ? t("Click a hole to place {name}. Esc cancels.", { name: modShort(tool.id) })
    : tool.k === "wire" ? (start ? t("Now click where the wire ends.") : t("Click where the wire starts: a hole, a rail or a board pin."))
    : t("Drag parts to move them. Click a part or wire to select it, Delete removes it.");

  return (
    <div tabIndex={0} onKeyDown={key} className="space-y-3 outline-none">
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => selectTool({ k: "select" })} aria-pressed={tool.k === "select"} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] transition ${tool.k === "select" ? "border-white/40 bg-white/15 text-neutral-50" : "border-white/10 text-neutral-300 hover:bg-white/10"}`}><MousePointer2 className="h-3.5 w-3.5" />{t("Select")}</button>
        <button disabled={readOnly} onClick={() => selectTool({ k: "wire" })} aria-pressed={tool.k === "wire"} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] transition disabled:opacity-40 ${tool.k === "wire" ? "border-white/40 bg-white/15 text-neutral-50" : "border-white/10 text-neutral-300 hover:bg-white/10"}`}><Cable className="h-3.5 w-3.5" />{t("Wire")}</button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button disabled={readOnly || !history.length} onClick={undo} title={t("Undo")} className="rounded-full border border-white/10 p-1.5 text-neutral-300 transition hover:bg-white/10 disabled:opacity-35"><Undo2 className="h-3.5 w-3.5" /></button>
        <button disabled={readOnly} onClick={() => { update(clearCircuit(graph)); setSel(null); }} title={t("Remove every part and wire")} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[11.5px] text-neutral-300 transition hover:bg-white/10 disabled:opacity-35"><Eraser className="h-3.5 w-3.5" />{t("Clear")}</button>
        <button disabled={readOnly || !graph.circuit?.layout} onClick={() => { update(setPreset(graph, graph.circuit?.preset ?? "led")); setSel(null); }} title={t("Go back to the starter circuit")} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[11.5px] text-neutral-300 transition hover:bg-white/10 disabled:opacity-35"><RotateCcw className="h-3.5 w-3.5" />{t("Starter")}</button>
      </div>
      <div className="flex flex-wrap gap-1.5">{PALETTE.map(chip)}</div>

      <div className="flex min-h-9 flex-wrap items-center gap-2 text-[12px] text-neutral-400">
        {selComp ? (
          <>
            <span className="font-mono text-neutral-100">{selComp.ref}</span><span>{modName(selComp.moduleId)}</span>
            {(CATALOG[selComp.moduleId].kind === "led" || CATALOG[selComp.moduleId].kind === "resistor") && (
              <select disabled={readOnly} value={selComp.moduleId} onChange={(e) => update(swapComp(graph, selComp.ref, e.target.value))} className="rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[11.5px] text-neutral-200">
                {Object.values(CATALOG).filter((m) => m.kind === CATALOG[selComp.moduleId].kind && m.for?.includes("breadboard")).map((m) => <option key={m.id} value={m.id}>{modName(m.id)}</option>)}
              </select>
            )}
            <button disabled={readOnly} onClick={del} className="flex items-center gap-1 rounded-full border border-red-300/30 px-2.5 py-1 text-[11.5px] text-red-200 transition hover:bg-red-400/10"><Trash2 className="h-3.5 w-3.5" />{t("Delete")}</button>
          </>
        ) : selWire ? (
          <>
            <span className="font-mono text-neutral-100">{t("Wire")} {sel?.k === "wire" ? sel.i + 1 : ""}</span>
            {WIRE_COLORS.map((c) => <button key={c} disabled={readOnly} title={t(WIRE_NAME[c])} aria-label={t(WIRE_NAME[c])} onClick={() => sel?.k === "wire" && update(recolorWire(graph, sel.i, c))} className={`h-5 w-5 rounded-full border ${selWire.color === c ? "border-white" : "border-white/20"}`} style={{ background: c }} />)}
            <button disabled={readOnly} onClick={del} className="flex items-center gap-1 rounded-full border border-red-300/30 px-2.5 py-1 text-[11.5px] text-red-200 transition hover:bg-red-400/10"><Trash2 className="h-3.5 w-3.5" />{t("Delete")}</button>
          </>
        ) : <span>{readOnly ? t("View-only access.") : hint}</span>}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c10]">
        <svg ref={svgRef} viewBox={`${x0} ${yTop} ${x1 - x0} ${y1 - yTop}`} className={`block max-h-[max(360px,calc(100vh-440px))] w-full touch-none select-none ${tool.k === "select" ? "cursor-default" : "cursor-crosshair"}`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => setHover(null)} role="application" aria-label={t("Breadboard editor")}>
          <BoardBase c={circuit} />

          {circuit.comps.map(drawComp)}

          {/* jumper wires */}
          {layout.wires.map((w, i) => {
            const [a, b] = wireEnds[i];
            if (!a || !b) return null;
            const [cx, cy] = wireCtrl(a[0], S(a[1]), b[0], S(b[1]));
            const d = `M${a[0]} ${S(a[1])} Q${cx} ${cy} ${b[0]} ${S(b[1])}`;
            const on = sel?.k === "wire" && sel.i === i;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={on ? "#38bdf8" : "#000"} strokeOpacity={on ? 1 : 0.45} strokeWidth={on ? 2.2 : 1.9} strokeLinecap="round" />
                <path d={d} fill="none" stroke={w.color} strokeWidth={1.2} strokeLinecap="round" />
                <circle cx={a[0]} cy={S(a[1])} r={0.9} fill={w.color} stroke="#000" strokeOpacity={0.4} strokeWidth={0.25} />
                <circle cx={b[0]} cy={S(b[1])} r={0.9} fill={w.color} stroke="#000" strokeOpacity={0.4} strokeWidth={0.25} />
              </g>
            );
          })}

          {/* wire in progress */}
          {start && (() => { const a = xyOf(start); const b = hover ? [hover.x, hover.y] : null; return a && b ? <line x1={a[0]} y1={S(a[1])} x2={b[0]} y2={S(b[1])} stroke="#38bdf8" strokeWidth={0.8} strokeDasharray="1.6 1.2" /> : null; })()}
          {start && (() => { const a = xyOf(start); return a ? <circle cx={a[0]} cy={S(a[1])} r={1.5} fill="none" stroke="#38bdf8" strokeWidth={0.5} /> : null; })()}

          {/* hover + ghost */}
          {hover && tool.k !== "select" && !ghost && <circle cx={hover.x} cy={S(hover.y)} r={1.5} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={0.4} />}
          {ghost?.holes.map((h, i) => { const [hx, hy] = holeXY(h.c, h.r, cols); return <circle key={i} cx={hx} cy={S(hy)} r={1.5} fill={ghost.ok ? "#22c55e" : "#ef4444"} fillOpacity={0.55} stroke={ghost.ok ? "#bbf7d0" : "#fecaca"} strokeWidth={0.3} />; })}
        </svg>
        {hover && <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-0.5 font-mono text-[11px] text-neutral-300">{hover.label}</div>}
        {msg && <div role="status" className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full border border-red-300/30 bg-red-950/80 px-3.5 py-1 text-[12px] text-red-200">{msg}</div>}
      </div>
    </div>
  );
}
