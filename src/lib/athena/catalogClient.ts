import { useState } from "react";

// Athena IDE's school catalog is not part of Нурбек Чурбек: these keep the wiring guide's imports working.
// A lab has no catalog guide, and "assembled" is remembered in the browser.

export function guideOf(_project: string): { id: string; title: string; goal: string; minutes: number } | null {
  return null;
}

export function useProjectDone(project: string): { done: boolean; toggle: () => void } {
  const key = `bsts-wired-${project}`;
  const read = () => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  };
  const [done, setDone] = useState(read);
  return {
    done,
    toggle: () => {
      const next = !done;
      setDone(next);
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // not critical
      }
    },
  };
}
