// Only the requested levels may ignore order; permutations and subsets retain inner order.
export function sameAnswer(a: unknown, b: unknown, unordered = false, unorderedInner = false): boolean {
  const norm = (v: unknown, depth = 0): unknown => {
    if (Array.isArray(v)) {
      const items = v.map((x) => norm(x, depth + 1));
      return (depth === 0 && unordered) || (depth === 1 && unorderedInner)
        ? items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : items;
    }
    if (typeof v === "number") return Math.round(v * 1e6) / 1e6;
    return v;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
