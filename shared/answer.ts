// Answer comparison shared by the browser test runner and the server.

export function sameAnswer(a: unknown, b: unknown, unordered = false): boolean {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const items = v.map(norm);
      return unordered ? items.map((x) => JSON.stringify(Array.isArray(x) ? [...x].sort() : x)).sort() : items;
    }
    if (typeof v === "number") return Math.round(v * 1e6) / 1e6;
    return v;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
