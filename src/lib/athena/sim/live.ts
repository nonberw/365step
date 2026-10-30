// What the running circuit simulation shares with the rest of the app: the 3D view (servo horn, knob, LED glow)
// reads `circuitLive` every frame; the AI engineer gets the latest snapshot with the next chat message.
import { create } from "zustand";

export const circuitLive = {
  running: false,
  servo: {} as Record<string, number>,
  leds: {} as Record<string, number>,
  pots: {} as Record<string, number>,
  /** motor wheel angles (deg) and lit displays, by part ref */
  wheels: {} as Record<string, number>,
  lcds: {} as Record<string, boolean>,
};

interface SimSnapshotState { snapshot: unknown | null; at: number; project: string | null; set: (project: string, s: unknown) => void; clear: () => void }
export const useSimSnapshot = create<SimSnapshotState>()((set) => ({
  snapshot: null,
  at: 0,
  project: null,
  set: (project, snapshot) => set({ project, snapshot, at: Date.now() }),
  clear: () => set({ snapshot: null, at: 0, project: null }),
}));

/** The snapshot to send with a chat message: only for the open project, and only if the simulation ran in the last 10 minutes. */
export function snapshotFor(project: string): unknown | null {
  const s = useSimSnapshot.getState();
  return s.project === project && s.snapshot && Date.now() - s.at < 600_000 ? s.snapshot : null;
}
