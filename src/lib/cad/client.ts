// The page side of the CAD worker: one OpenCascade kernel shared by every CAD page.
import type { FromCad, ToCad } from "./cad.worker";

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (m: FromCad) => void>();
export let readyMs: number | null = null;
export const readyListeners = new Set<() => void>();

export function cad(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./cad.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<FromCad>) => {
      const m = e.data;
      if (m.type === "ready") {
        readyMs = m.ms;
        readyListeners.forEach((f) => f());
        return;
      }
      waiting.get(m.id)?.(m);
      waiting.delete(m.id);
    };
  }
  return worker;
}
export const call = (m: Omit<ToCad, "id"> & { type: ToCad["type"] }) =>
  new Promise<FromCad>((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    cad().postMessage({ ...m, id } as ToCad);
  });

/** Saves an exported part as a file. */
export async function downloadPart(name: string, format: "stl" | "step"): Promise<string | null> {
  const r = await call({ type: "export", format } as ToCad);
  if (r.type !== "file") return r.type === "error" ? r.message : "Не удалось экспортировать";
  const url = URL.createObjectURL(new Blob([r.data], { type: format === "stl" ? "model/stl" : "application/step" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
  return null;
}

/** OpenCascade error codes are bare numbers; say something useful instead. */
export const cadError = (m: string) => (/^\d+$/.test(m) ? "Ядро CAD не смогло построить форму (часто это скругление слишком большим радиусом или пересечение, которое ничего не оставляет)." : m);
