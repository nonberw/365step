// Resistor colour code (4 bands: two digits, multiplier, tolerance). Shared by the 3D model, the diagrams and the wiring guide.
export const BAND_NAMES = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "grey", "white"] as const;
export const BAND_HEX: Record<string, string> = {
  black: "#18181b", brown: "#7c3f12", red: "#dc2626", orange: "#f97316", yellow: "#eab308", green: "#16a34a",
  blue: "#2563eb", violet: "#7c3aed", grey: "#9ca3af", white: "#f5f5f5", gold: "#d4a017",
};

/** The four bands for a value in ohms (5 % tolerance, gold). */
export function resistorBands(ohm: number): string[] {
  const e = Math.max(1, Math.floor(Math.log10(Math.max(ohm, 10)) + 1e-9)); // power of ten of the leading digit
  const sig = Math.round(ohm / 10 ** (e - 1));
  return [BAND_NAMES[Math.floor(sig / 10) % 10], BAND_NAMES[sig % 10], BAND_NAMES[(e - 1) % 10], "gold"];
}
