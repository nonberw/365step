import { create } from "zustand";
import { sampleBreadboard, setPreset, type Preset } from "./circuit";
import type { DeviceGraph } from "./deviceGraph";
import type { CheckResult, SimCondition } from "./sim/checks";

// The slice of Athena IDE's workspace store that the breadboard editor and the circuit simulator use.
// Athena keeps whole projects (CAD, chat, branches); here there is only the open breadboard lab.

interface State {
  /** id of the open lab: "lab:<lesson id>" */
  project: string;
  graph: DeviceGraph;
  history: DeviceGraph[];
  /** hand-edited sketch per project; `base` is the generated code it started from */
  sketches: Record<string, { text: string; base: string }>;
  playing: boolean;
  readOnly: boolean;
  tab: "3D" | "Electronics" | "Simulation" | "Code" | "Instructions";
  setTab: (t: State["tab"]) => void;
  /** the part the wiring guide highlights (Athena shows it in 3D; here it is only remembered) */
  focus: string | null;
  setFocus: (f: string | null) => void;
  lang: "ru";
  update: (g: DeviceGraph) => void;
  undo: () => void;
  togglePlay: () => void;
  setSketch: (project: string, text: string, base: string) => void;
  clearSketch: (project: string) => void;
  open: (project: string, preset: Preset, graph?: DeviceGraph) => void;
  /** the open lesson: what the simulator's task check tests, and who hears the result */
  lab: { condition: SimCondition; onCheck: (r: CheckResult) => void } | null;
  setLab: (lab: State["lab"]) => void;
}

const KEY = "bsts-arduino-lab";

function restore(): Pick<State, "sketches"> & { graphs: Record<string, DeviceGraph> } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // private mode or broken data: start clean
  }
  return { sketches: {}, graphs: {} };
}
const saved = restore();
function persist(project: string, graph: DeviceGraph, sketches: State["sketches"]) {
  saved.graphs[project] = graph;
  saved.sketches = sketches;
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // not critical
  }
}

export const useStore = create<State>()((set, get) => ({
  project: "lab:led",
  graph: sampleBreadboard(),
  history: [],
  sketches: saved.sketches,
  playing: false,
  readOnly: false,
  tab: "Simulation",
  lab: null,
  setLab: (lab) => set({ lab }),
  focus: null,
  setFocus: (focus) => set({ focus }),
  lang: "ru",
  setTab: (tab) => set({ tab }),
  update: (graph) => {
    const s = get();
    set({ graph, history: [...s.history.slice(-30), s.graph] });
    persist(s.project, graph, s.sketches);
  },
  undo: () => {
    const s = get();
    const prev = s.history.at(-1);
    if (!prev) return;
    set({ graph: prev, history: s.history.slice(0, -1) });
    persist(s.project, prev, s.sketches);
  },
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setSketch: (project, text, base) => {
    const sketches = { ...get().sketches, [project]: { text, base } };
    set({ sketches });
    persist(get().project, get().graph, sketches);
  },
  clearSketch: (project) => {
    const sketches = { ...get().sketches };
    delete sketches[project];
    set({ sketches });
    persist(get().project, get().graph, sketches);
  },
  open: (project, preset, graph) => {
    const g = saved.graphs[project] ?? graph ?? setPreset(sampleBreadboard(), preset);
    set({ project, graph: g, history: [], playing: false });
  },
}));
