// From Athena IDE (src/components/workspace/CircuitSim.tsx); BSTS changes are marked.
"use client";
// The electronics simulator: the project's sketch runs on a virtual board wired exactly like the breadboard layout.
// LEDs light with the current Ohm's law gives them, wires show their voltage and moving dots show where current
// flows, buttons can be pressed and knobs turned, the Serial Monitor talks both ways, and mistakes behave as on the
// bench (an LED without a resistor burns, a servo on USB resets the board) — each with an explanation and a fix.
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, CheckCircle2, Code2, Gauge, Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX, Wrench, XCircle } from "lucide-react";
import { useStore } from "@/lib/athena/store";
import { t } from "@/lib/athena/i18n";
import { verify } from "@/lib/athena/deviceGraph";
import { MCU_PINS, ROWS, RAILS, holeXY, railCount, type CircuitWire } from "@/lib/athena/circuit";
import { Board, ledColour, MODE, type SimEvent } from "@/lib/athena/sim/board";
import { defaultCondition, runCheck, type CheckResult, type SimCondition } from "@/lib/athena/sim/checks";
import { conditionText } from "@/lib/athena/sim/describe";
import { boardFor, codeFor, useSimClock } from "@/lib/athena/sim/session";
import { useClasses } from "@/lib/athena/classes";
import { BoardBase, CompArt, S, dist, viewOf, wireD } from "./BoardArt";

const SPEEDS = [0.1, 0.25, 1] as const;
const btn = "flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-neutral-200 transition hover:bg-white/10 disabled:opacity-40";

/** The condition this project is checked against: the assignment's, else the starter circuit's own behaviour. */
function useCondition(project: string, preset: Parameters<typeof defaultCondition>[0]): SimCondition {
  const details = useClasses((s) => s.details);
  if (project.startsWith("asg:")) {
    const id = project.slice(4);
    for (const d of Object.values(details)) { const a = d.assignments.find((x) => x.id === id); if (a?.sim_check) return a.sim_check; }
  }
  return defaultCondition(preset);
}

export default function CircuitSim() {
  const { graph, project, sketches, setTab, update, readOnly, playing: running, togglePlay } = useStore();
  const code = codeFor(project, graph, sketches);
  const { speed, setSpeed, slow } = useSimClock();
  useSimClock((st) => st.frame); // re-render with the running clock
  // Росток: a lesson sets its own condition and wants to know the result (for progress and XP).
  const fallback = useCondition(project, graph.circuit?.preset);
  const lab = useStore((st) => st.lab);
  const cond = lab?.condition ?? fallback;
  const [, setFrame] = useState(0);
  const [sound, setSound] = useState(false);
  const [meter, setMeter] = useState(false);
  const [probes, setProbes] = useState<string[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const [send, setSend] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const serialRef = useRef<HTMLPreElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const audio = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);

  // a new board whenever the circuit or the code changes (as after re-flashing)
  const board = boardFor(graph, code);
  const [seen, setSeen] = useState(board);
  if (seen !== board) { setSeen(board); setCheck(null); setProbes([]); }

  // the buzzer, when sound is on
  const buzzing = board.buzzing.find((z) => z.on);
  useEffect(() => {
    if (!sound || !buzzing || !running) { if (audio.current) audio.current.gain.gain.value = 0; return; }
    if (!audio.current) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = "square"; osc.connect(gain); gain.connect(ctx.destination); osc.start();
      audio.current = { ctx, osc, gain };
    }
    audio.current.osc.frequency.value = buzzing.freq;
    audio.current.gain.gain.value = 0.04;
  });
  useEffect(() => () => { audio.current?.ctx.close(); audio.current = null; }, []);
  useEffect(() => { const el = serialRef.current; if (el) el.scrollTop = el.scrollHeight; }, [board.serialOut.length]);

  const c = board.circuit;
  const { x0, x1, yTop, y1 } = viewOf(c);
  const pins = MCU_PINS[c.mcuId] ?? MCU_PINS["uno-r3"];
  const pinState = new Map(board.pins().map((p) => [p.name, p]));
  const pinFill = (name: string) => {
    const p = pinState.get(name);
    if (!p) return undefined;
    if (p.damaged) return "#7f1d1d";
    if (p.pwm !== null) return "#a855f7";
    if (p.mode === MODE.OUTPUT) return p.level ? "#ef4444" : "#1d4ed8";
    return undefined;
  };

  // everything a probe or the pointer can land on
  const points = useMemo(() => {
    const out: { node: string; x: number; y: number; label: string }[] = [];
    for (let col = 1; col <= c.cols; col++) for (const r of ROWS) { const [x, y] = holeXY(col, r, c.cols); out.push({ node: `h:${col}${r <= "e" ? "T" : "B"}`, x, y, label: `${col}${r}` }); }
    for (const r of RAILS) for (let k = 1; k <= railCount(c.cols); k++) if (k % 6 !== 0) { const [x, y] = holeXY(k, r, c.cols); out.push({ node: `r:${r}`, x, y, label: r.endsWith("N") ? t("− rail") : t("+ rail") }); }
    for (const [pin, [lx, ly]] of Object.entries(pins)) out.push({ node: `m:${pin}`, x: c.mcuCenter[0] + lx, y: c.mcuCenter[1] + ly, label: pin });
    for (const k of c.comps) if (k.offBoard) for (const p of k.pins) out.push({ node: p.node, x: p.x, y: p.y, label: `${k.ref} ${p.name}` });
    return out;
  }, [c, pins]);
  const toMm = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: q.x, y: -q.y };
  };
  const nearest = (x: number, y: number) => { let best = null as (typeof points)[number] | null, bd = 1.8; for (const p of points) { const d = dist(x, y, p.x, p.y); if (d < bd) { bd = d; best = p; } } return best; };
  const fmtV = (v: number | null) => (v === null ? t("floating") : `${v.toFixed(2)} V`);
  const describe = (node: string, label: string) => {
    const net = c.netOf(node);
    const v = board.netVoltage(net);
    const i = board.netI[net] ?? 0;
    const pin = node.startsWith("m:") ? pinState.get(node.slice(2)) : undefined;
    return `${label}: ${fmtV(v)}${i > 0.05 ? ` · ≈${i.toFixed(1)} mA` : ""}${pin ? ` · ${["INPUT", "OUTPUT", "INPUT_PULLUP"][pin.mode]}${pin.pwm !== null ? ` PWM ${Math.round(pin.pwm * 100)}%` : ""}` : ""}`;
  };

  const down = (e: React.PointerEvent) => {
    const { x, y } = toMm(e);
    if (meter) {
      const p = nearest(x, y);
      if (p) setProbes((ps) => (ps.length >= 2 ? [p.node] : [...ps, p.node]));
      return;
    }
    // press a button by pointing at it
    const hit = c.comps.find((k) => k.kind === "button" && Math.abs(k.center[0] - x) < 4 && Math.abs(k.center[1] - y) < 4);
    if (hit) { board.press(hit.ref, true); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); }
  };
  const up = () => { for (const k of c.comps) if (k.kind === "button" && board.inputs.buttons[k.ref]) board.press(k.ref, false); };
  const move = (e: React.PointerEvent) => {
    const { x, y } = toMm(e);
    const p = nearest(x, y);
    setHover(p ? { x: p.x, y: p.y, text: describe(p.node, p.label) } : null);
  };

  /** Which way current flows along a wire: away from the end at a source, towards the ground end. */
  const flowsAB = (w: CircuitWire) => {
    const src = (n: string) => n.startsWith("m:") && !/^m:GND/.test(n) || n === "p:+";
    const gnd = (n: string) => /^m:GND/.test(n) || n === "r:TN" || n === "r:BN" || n === "p:-";
    if (src(w.a.node) || gnd(w.b.node)) return true;
    if (src(w.b.node) || gnd(w.a.node)) return false;
    return true;
  };

  const meterV = probes.length === 2 ? (() => { const a = board.netVoltage(c.netOf(probes[0])), b = board.netVoltage(c.netOf(probes[1])); return a === null || b === null ? null : a - b; })() : null;
  const runTask = () => { setChecking(true); setTimeout(() => { const r = runCheck(graph, code, cond); setCheck(r); lab?.onCheck(r); setChecking(false); }, 30); };
  const checks = verify(graph);
  const fixFor = (ev: SimEvent) => (ev.check ? checks.find((x) => x.id === ev.check || x.id.startsWith(`${ev.check}`))?.fix : undefined);
  const sensor = c.comps.find((k) => k.kind === "sensor");
  const supply = board.supplyMaNow();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={togglePlay} className={btn}>{running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{running ? t("Pause") : t("Run")}</button>
        <button onClick={() => { board.run(10); setFrame((f) => f + 1); }} disabled={running} title={t("Advance 10 ms")} className={btn}><SkipForward className="h-3.5 w-3.5" />{t("Step 10 ms")}</button>
        <div className="flex rounded-full border border-white/15 p-0.5" role="group" aria-label={t("Speed")}>
          {SPEEDS.map((s) => <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`rounded-full px-2.5 py-1 text-[11.5px] ${speed === s ? "bg-white/15 text-neutral-50" : "text-neutral-400 hover:text-neutral-100"}`}>{s}×</button>)}
        </div>
        <button onClick={() => { board.restart(); setFrame((f) => f + 1); }} title={t("Press the board's reset button")} className={btn}><RotateCcw className="h-3.5 w-3.5" />{t("Reset")}</button>
        <button onClick={() => { setMeter(!meter); setProbes([]); }} aria-pressed={meter} className={`${btn} ${meter ? "border-sky-300/60 bg-sky-400/15" : ""}`}><Gauge className="h-3.5 w-3.5" />{t("Multimeter")}</button>
        <button onClick={() => setSound(!sound)} aria-pressed={sound} title={t("Buzzer sound")} aria-label={t("Buzzer sound")} className={btn}>{sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}</button>
        <button onClick={() => setTab("Code")} className={btn}><Code2 className="h-3.5 w-3.5" />{t("Edit code")}</button>
        <span className="ml-auto font-mono text-[11.5px] text-neutral-500">{board.spec.name} · {(board.now / 1e6).toFixed(2)} s{slow ? ` · ${t("slower than real time")}` : ""}</span>
      </div>

      {board.compileError && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/[0.07] p-3 text-[12.5px] text-red-200" role="alert">
          <div className="font-medium">{t("The sketch does not compile — line {line}", { line: board.compileError.line })}</div>
          <div className="mt-0.5 font-mono text-[12px]">{board.compileError.message}</div>
          <pre className="mt-1.5 overflow-x-auto rounded-lg bg-black/40 p-2 font-mono text-[11.5px] text-neutral-300">{code.split("\n")[board.compileError.line - 1] ?? ""}</pre>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c10]">
        <svg ref={svgRef} viewBox={`${x0} ${yTop} ${x1 - x0} ${y1 - yTop}`} className={`block max-h-[min(46vh,420px)] w-full touch-none select-none ${meter ? "cursor-crosshair" : "cursor-default"}`}
          onPointerDown={down} onPointerUp={up} onPointerLeave={() => { up(); setHover(null); }} onPointerMove={move} role="img" aria-label={t("Running circuit")}>
          <BoardBase c={c} pinFill={pinFill} />
          {c.comps.map((k) => {
            const led = board.leds.find((l) => l.ref === k.ref);
            const motor = board.motors.find((m) => m.ref === k.ref), lcd = board.lcds.find((l) => l.ref === k.ref);
            const out = k.kind === "module" ? board.netVoltage(c.netOf(k.pins[1].node)) : null;
            return <CompArt key={k.ref} k={k} live={{ glow: led?.brightness, burned: led?.state === "burned", pressed: board.inputs.buttons[k.ref], pot: board.inputs.pots[k.ref], horn: board.servoAngle[k.ref], buzzing: board.buzzing.find((z) => z.ref === k.ref)?.on,
              speed: motor?.speed, wheel: motor?.angle, lines: lcd?.on ? lcd.lines : undefined, lit: lcd?.on && lcd.backlight, level: out === null ? undefined : out / board.spec.logicV }} />;
          })}
          {c.wires.map((w) => {
            const net = c.netOf(w.a.node);
            const v = board.netVoltage(net);
            const i = board.netI[net] ?? 0;
            const d = wireD([w.a.x, w.a.y], [w.b.x, w.b.y]);
            const lit = v !== null && v > 0.5;
            return (
              <g key={w.id}>
                <path d={d} fill="none" stroke={lit ? "#fde68a" : "#000"} strokeOpacity={lit ? 0.35 : 0.45} strokeWidth={lit ? 2.6 : 1.9} strokeLinecap="round" />
                <path d={d} fill="none" stroke={w.color} strokeWidth={1.2} strokeLinecap="round" />
                {running && i > 0.3 && [0, 1, 2].map((n) => (
                  <circle key={n} r={0.55} fill="#fef9c3">
                    <animateMotion dur={`${Math.max(0.35, Math.min(3, 12 / i))}s`} begin={`${-n * Math.max(0.35, Math.min(3, 12 / i)) / 3}s`} repeatCount="indefinite" path={d} keyPoints={flowsAB(w) ? "0;1" : "1;0"} keyTimes="0;1" calcMode="linear" />
                  </circle>
                ))}
                <circle cx={w.a.x} cy={S(w.a.y)} r={0.9} fill={w.color} stroke="#000" strokeOpacity={0.4} strokeWidth={0.25} />
                <circle cx={w.b.x} cy={S(w.b.y)} r={0.9} fill={w.color} stroke="#000" strokeOpacity={0.4} strokeWidth={0.25} />
              </g>
            );
          })}
          {sensor && (() => { const xc = (sensor.pins[0].x + sensor.pins[3].x) / 2; const gap = Math.min(30, 4 + board.inputs.distanceCm * 0.12); return <g opacity={0.8}><rect x={xc - 14} y={S(sensor.pins[0].y) - 14 - gap - 3} width={28} height={3} rx={1} fill="#a8a29e" /><text x={xc} y={S(sensor.pins[0].y) - 14 - gap - 4} fontSize={2.2} textAnchor="middle" fill="#a8a29e">{t("{cm} cm", { cm: board.inputs.distanceCm })}</text></g>; })()}
          {probes.map((node, i) => { const p = points.find((x) => x.node === node) ?? points.find((x) => c.netOf(x.node) === c.netOf(node)); return p ? <circle key={i} cx={p.x} cy={S(p.y)} r={1.6} fill="none" stroke={i ? "#3b82f6" : "#ef4444"} strokeWidth={0.6} /> : null; })}
          {hover && <circle cx={hover.x} cy={S(hover.y)} r={1.5} fill="none" stroke="#fff" strokeOpacity={0.8} strokeWidth={0.35} />}
        </svg>
        {hover && <div className="pointer-events-none absolute left-3 top-3 max-w-[80%] rounded-full bg-black/75 px-2.5 py-0.5 font-mono text-[11px] text-neutral-200">{hover.text}</div>}
        {meter && <div className="absolute bottom-3 left-3 rounded-xl border border-sky-300/30 bg-black/80 px-3 py-1.5 font-mono text-[12px] text-sky-100">{probes.length < 2 ? t("Click the red probe, then the black probe") : meterV === null ? t("A probe is on a floating net") : `${meterV.toFixed(2)} V`}</div>}
        {board.resets > 0 && <div className="absolute right-3 top-3 rounded-full border border-red-300/40 bg-red-950/80 px-2.5 py-0.5 text-[11px] text-red-200">{t("{n} resets", { n: board.resets })}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[12px] text-neutral-300">
        {Object.keys(board.inputs.pots).map((ref) => (
          <label key={ref} className="flex items-center gap-2">{ref}<input type="range" min={0} max={1} step={0.01} value={board.inputs.pots[ref]} onChange={(e) => { board.turn(ref, Number(e.target.value)); setFrame((f) => f + 1); }} aria-label={t("Turn {ref}", { ref })} /></label>
        ))}
        {Object.keys(board.inputs.light).map((ref) => (
          <label key={ref} className="flex items-center gap-2">{t("Light at {ref}", { ref })}<input type="range" min={0} max={1} step={0.01} value={board.inputs.light[ref]} onChange={(e) => { board.setLight(ref, Number(e.target.value)); setFrame((f) => f + 1); }} aria-label={t("Light at {ref}", { ref })} /><span className="font-mono">{Math.round(board.inputs.light[ref] * 100)} %</span></label>
        ))}
        {c.comps.some((k) => k.moduleId === "tmp36") && <label className="flex items-center gap-2">{t("Temperature")}<input type="range" min={-10} max={45} step={0.5} value={board.inputs.temperatureC} onChange={(e) => { board.setTemperature(Number(e.target.value)); setFrame((f) => f + 1); }} aria-label={t("Temperature")} /><span className="font-mono">{board.inputs.temperatureC.toFixed(1)} °C</span></label>}
        {c.comps.some((k) => k.moduleId === "soil-module") && <label className="flex items-center gap-2">{t("Soil moisture")}<input type="range" min={0} max={1} step={0.01} value={board.inputs.moisture} onChange={(e) => { board.setMoisture(Number(e.target.value)); setFrame((f) => f + 1); }} aria-label={t("Soil moisture")} /><span className="font-mono">{Math.round(board.inputs.moisture * 100)} %</span></label>}
        {c.comps.some((k) => k.moduleId === "pir-module") && <button onClick={() => { board.setMotion(!board.inputs.motion); setFrame((f) => f + 1); }} aria-pressed={board.inputs.motion} className={`${btn} ${board.inputs.motion ? "border-amber-300/60 bg-amber-400/15" : ""}`}>{board.inputs.motion ? t("Someone is moving") : t("Nobody moves")}</button>}
        {sensor && <label className="flex items-center gap-2">{t("Obstacle")}<input type="range" min={2} max={200} value={board.inputs.distanceCm} onChange={(e) => { board.setDistance(Number(e.target.value)); setFrame((f) => f + 1); }} aria-label={t("Obstacle distance")} /><span className="font-mono">{board.inputs.distanceCm} cm</span></label>}
        {Object.keys(board.inputs.buttons).length > 0 && <span className="text-neutral-500">{t("Hold the button on the board to press it.")}</span>}
        <span className="ml-auto flex items-center gap-2"><span className="text-neutral-500">{t("USB current")}</span>
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10"><span className={`block h-full ${supply > board.spec.usbMa ? "bg-red-400" : supply > board.spec.usbMa * 0.8 ? "bg-amber-300" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, (supply / board.spec.usbMa) * 100)}%` }} /></span>
          <span className="font-mono">{Math.round(supply)} / {board.spec.usbMa} mA</span></span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/40">
          <div className="border-b border-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-neutral-400">{t("Serial Monitor").toUpperCase()}</div>
          <pre ref={serialRef} className="h-32 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11.5px] text-neutral-200">{board.serialOut || <span className="text-neutral-600">{t("Nothing printed yet. Serial.println() output appears here.")}</span>}</pre>
          <form onSubmit={(e) => { e.preventDefault(); if (send) { board.sendSerial(send + "\n"); setSend(""); } }} className="flex gap-2 border-t border-white/10 p-2">
            <input value={send} onChange={(e) => setSend(e.target.value)} placeholder={t("Send to the board…")} className="min-w-0 flex-1 rounded-full border border-white/15 bg-transparent px-3 py-1 font-mono text-[12px] outline-none" aria-label={t("Send to the board")} />
            <button className={btn}>{t("Send")}</button>
          </form>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40">
          <div className="border-b border-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-neutral-400">{t("What happened").toUpperCase()}</div>
          <ul className="h-[172px] space-y-1.5 overflow-auto px-3 py-2 text-[12px]">
            {!board.events.length && <li className="text-neutral-600">{t("No problems so far.")}</li>}
            {[...board.events].reverse().slice(0, 12).map((ev, i) => {
              const fix = fixFor(ev);
              return (
                <li key={i} className={ev.kind === "error" ? "text-red-200" : ev.kind === "warn" ? "text-amber-200" : "text-neutral-300"}>
                  <span className="mr-1.5 font-mono text-[10.5px] text-neutral-500">{(ev.t / 1e6).toFixed(2)} s</span>{t(ev.text, ev.vars)}
                  <span className="ml-2 inline-flex gap-1.5">
                    {fix && !readOnly && <button onClick={() => update(fix.apply(graph))} className="rounded-full bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-900"><Wrench className="mr-1 inline h-3 w-3" />{fix.label}</button>}
                    {ev.text.includes("burned out") && <button onClick={() => { board.repair(); setFrame((f) => f + 1); }} className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-neutral-200">{t("Replace the LED")}</button>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <LogicAnalyzer board={board} />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <Activity className="h-4 w-4 text-neutral-400" />
        <div className="min-w-[200px] flex-1 text-[12.5px] text-neutral-300">{project.startsWith("asg:") ? t("Your teacher checks: {what}", { what: conditionText(cond) }) : t("Task check: {what}", { what: conditionText(cond) })}</div>
        <button onClick={runTask} disabled={checking} className={btn}>{checking ? t("Checking…") : t("Check the task")}</button>
        {check && <div className={`flex w-full items-center gap-2 text-[12.5px] ${check.pass ? "text-emerald-300" : "text-red-300"}`}>{check.pass ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{t(check.text, check.vars)}</div>}
      </div>
      <p className="text-[11px] text-neutral-600">{t("The sketch runs on a simulated {board}: timing is close to the real board, parts follow their datasheet values. Analog parts are simplified (an LED by its forward voltage, a servo by its speed).", { board: board.spec.name })}</p>
    </div>
  );
}

/** Logic analyzer: every pin the sketch drives or reads, over the last seconds. */
function LogicAnalyzer({ board }: { board: Board }) {
  const [win, setWin] = useState(4);
  const traces = [...board.traces.entries()].filter(([, tr]) => tr.length).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  if (!traces.length) return null;
  const now = board.now, from = now - win * 1e6;
  const W = 600, H = 16;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold tracking-[0.14em] text-neutral-400">
        <span>{t("Logic analyzer").toUpperCase()}</span>
        <span className="flex gap-1 font-normal tracking-normal">{[1, 4, 10].map((s) => <button key={s} onClick={() => setWin(s)} aria-pressed={win === s} className={`rounded-full px-2 py-0.5 ${win === s ? "bg-white/15 text-neutral-100" : "text-neutral-500"}`}>{s} s</button>)}</span>
      </div>
      {traces.map(([pin, tr]) => {
        const pts: string[] = [];
        let lastV = tr.filter((p) => p.t <= from).pop()?.v ?? 0;
        const x = (tt: number) => ((tt - from) / (now - from)) * W;
        const y = (v: number) => H - 2 - v * (H - 4);
        pts.push(`0,${y(lastV)}`);
        for (const p of tr) { if (p.t < from) continue; pts.push(`${x(p.t)},${y(lastV)}`, `${x(p.t)},${y(p.v)}`); lastV = p.v; }
        pts.push(`${W},${y(lastV)}`);
        return (
          <div key={pin} className="flex items-center gap-2">
            <span className="w-10 font-mono text-[10.5px] text-neutral-400">{pin}</span>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-4 flex-1" preserveAspectRatio="none"><polyline points={pts.join(" ")} fill="none" stroke={ledColour("")} strokeOpacity={0} /><polyline points={pts.join(" ")} fill="none" stroke="#38bdf8" strokeWidth={1.2} vectorEffect="non-scaling-stroke" /></svg>
          </div>
        );
      })}
    </div>
  );
}
