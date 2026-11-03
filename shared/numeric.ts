/** Content-specific numeric comparison. No eval, permissive Number coercion or blanket tolerance. */
export type NumericRule = { kind: "exact" } | { kind: "rounded"; places: number };
type Rational = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => b ? gcd(b, a % b) : a < 0n ? -a : a;
export function parseRational(input: unknown): Rational | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const s = String(input).trim().replace(/−/g, "-").replace(",", ".");
  if (s.length > 100 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\/[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(s)) return null;
  const decimal = (v: string): Rational => {
    const digits = v.split(".")[1]?.length ?? 0;
    return { n: BigInt(v.replace(".", "")), d: 10n ** BigInt(digits) };
  };
  const [a, b] = s.split("/");
  const x = decimal(a!), y = b === undefined ? { n: 1n, d: 1n } : decimal(b);
  let n = x.n * y.d, d = x.d * y.n;
  if (!d) return null;
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export function exactFraction(n: number, d: number): string {
  const r = parseRational(`${n}/${d}`);
  if (!r) throw new Error("Invalid rational");
  return r.d === 1n ? String(r.n) : `${r.n}/${r.d}`;
}
export function numericEqual(input: unknown, expected: unknown, rule: NumericRule = { kind: "exact" }): boolean {
  const a = parseRational(input), b = parseRational(expected);
  if (!a || !b) return false;
  if (rule.kind === "rounded") {
    if (!Number.isInteger(rule.places) || rule.places < 0 || rule.places > 10) return false;
    // Compare rounded rational values, including half-away-from-zero ties, without binary rounding errors.
    const round = ({ n, d }: Rational) => {
      const sign = n < 0n ? -1n : 1n;
      const scaled = (n < 0n ? -n : n) * 10n ** BigInt(rule.places);
      return sign * ((scaled * 2n + d) / (2n * d));
    };
    return round(a) === round(b);
  }
  if (a.n * b.d === b.n * a.d) return true;
  // Only machine-precision decimal representations (e.g. 100/3 as 33.333333333333336).
  const x = Number(a.n) / Number(a.d), y = Number(b.n) / Number(b.d);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 8 * Number.EPSILON * Math.max(Math.abs(x), Math.abs(y));
}
/** Normalises plain/LaTeX numeric choices to detect equivalent distractors. */
export function choiceKey(value: string): string {
  const s = value.trim().replace(/^\$|\$$/g, "").replace(/\\(?:d?frac)\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2").replace(/\\,/g, "");
  const r = parseRational(/^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s) ? s.replace(/,/g, "") : s);
  return r ? `${r.n}/${r.d}` : s.toLowerCase().replace(/\s+/g, " ");
}
