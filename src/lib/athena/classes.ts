import { create } from "zustand";
import type { SimCondition } from "./sim/checks";

// Athena IDE looks up a class assignment's simulator check here. BSTS labs take the check from the lesson instead,
// so this store stays empty; it only keeps CircuitSim's import working unchanged.

interface ClassDetail {
  assignments: { id: string; sim_check?: SimCondition }[];
}

export const useClasses = create<{ details: Record<string, ClassDetail> }>()(() => ({ details: {} }));
