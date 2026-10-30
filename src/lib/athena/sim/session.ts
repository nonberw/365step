"use client";
// The one running circuit simulation of the open breadboard project. It lives outside React (a simulation is a mutable
// machine that ticks every frame); the workspace's Simulate button runs it, the Simulation tab shows and controls it,
// and the 3D view and the AI read what it does.
import { useEffect } from "react";
import { create } from "zustand";
import type { DeviceGraph } from "../deviceGraph";
import { arduinoSketch } from "../circuit";
import { useStore } from "../store";
import { Board } from "./board";
import { circuitLive, useSimSnapshot } from "./live";

let current: { graph: DeviceGraph; code: string; board: Board } | null = null;

/** The board for this circuit and sketch: a new one when either changes (as after re-flashing). */
export function boardFor(graph: DeviceGraph, code: string): Board {
  if (!current || current.graph !== graph || current.code !== code) {
    const board = new Board(graph);
    board.load(code);
    current = { graph, code, board };
  }
  return current.board;
}

/** The sketch the open project runs: the user's edited code, else the generated one. */
export const codeFor = (project: string, graph: DeviceGraph, sketches: Record<string, { text: string }>) => sketches[project]?.text ?? arduinoSketch(graph);

interface Clock { frame: number; speed: number; slow: boolean; setSpeed: (s: number) => void }
/** Re-render signal (about 15 per second) and the speed setting. */
export const useSimClock = create<Clock>()((set) => ({ frame: 0, speed: 1, slow: false, setSpeed: (speed) => set({ speed }) }));

/** Runs the open breadboard project's simulation while the workspace plays. Mount once. */
export function useCircuitRunner() {
  const playing = useStore((s) => s.playing);
  const isBoard = useStore((s) => s.graph.template === "breadboard");
  useEffect(() => {
    if (!isBoard) return;
    let id = 0, last = performance.now(), lastUi = 0, lastSnap = 0;
    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const st = useStore.getState();
      const board = boardFor(st.graph, codeFor(st.project, st.graph, st.sketches));
      const clock = useSimClock.getState();
      if (playing) {
        const r = board.run(dt * clock.speed);
        if (r.slow !== clock.slow) useSimClock.setState({ slow: r.slow });
      }
      circuitLive.running = playing;
      circuitLive.servo = { ...board.servoAngle };
      circuitLive.leds = Object.fromEntries(board.leds.map((l) => [l.ref, l.brightness]));
      circuitLive.leds.__L = board.pins().find((p) => p.name === (board.spec.intBits === 16 ? "D13" : "G2"))?.level ? 1 : 0;
      circuitLive.pots = { ...board.inputs.pots };
      circuitLive.wheels = Object.fromEntries(board.motors.map((m) => [m.ref, m.angle]));
      circuitLive.lcds = Object.fromEntries(board.lcds.map((l) => [l.ref, l.on && l.backlight]));
      if (playing && now - lastSnap > 500) { lastSnap = now; useSimSnapshot.getState().set(st.project, board.snapshot()); }
      if (now - lastUi > 66) { lastUi = now; useSimClock.setState((s) => ({ frame: s.frame + 1 })); }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(id); circuitLive.running = false; };
  }, [playing, isBoard]);
}
