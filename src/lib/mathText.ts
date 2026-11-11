/** Presentation only: recognize bounded arithmetic expressions in math content.
 * Prose and persisted question/answer strings are never rewritten. */
export type MathTextPart = { kind: "text"; text: string } | { kind: "math"; tex: string };
type Token = { value: string; start: number; end: number; kind: "number" | "variable" | "function" | "symbol" };
type Expr = { tex: string; fraction?: boolean };
const letters = /[\p{L}\p{N}_]/u;
const superscripts: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };
const operators: Record<string, string> = { "−": "-", "–": "-", "≤": "\\le", "<=": "\\le", "≥": "\\ge", ">=": "\\ge", "≠": "\\ne", "!=": "\\ne", "≈": "\\approx", "·": "\\cdot", "×": "\\times", "*": "\\cdot", "÷": "\\div", ":": ":", "±": "\\pm" };

function tokens(text: string, start: number): Token[] {
  const out: Token[] = [];
  let i = start;
  while (i < text.length && out.length < 160) {
    const gap = /^[ \t]*/.exec(text.slice(i))![0];
    i += gap.length;
    const rest = text.slice(i);
    const number = /^(?:\d{1,3}(?:,\d{3})+(?!\d)|\d+)(?:\.\d+)?/.exec(rest)?.[0];
    const word = /^[A-Za-z]+/.exec(rest)?.[0];
    let value: string;
    let kind: Token["kind"];
    if (number) { value = number; kind = "number"; }
    else if (/^[πθ]/.test(rest)) { value = rest[0]!; kind = "variable"; }
    else if (word && /^(sqrt|sin|cos|tan|log|ln)$/.test(word)) { value = word; kind = "function"; }
    else if (word && (word.length === 1 || /^(pi|xy|lw|[A-Z]{2,3})$/.test(word))) { value = word; kind = "variable"; }
    else {
      const symbol = /^(?:<=|>=|!=|[+\-−–*/÷·×=<>≤≥≠≈±():,^_%√⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺])/.exec(rest)?.[0];
      if (!symbol) break;
      value = symbol; kind = "symbol";
    }
    out.push({ value, start: i, end: i + value.length, kind });
    i += value.length;
  }
  return out;
}

class Expression {
  i = 0;
  constructor(readonly t: Token[]) {}
  peek(value: string) { return this.t[this.i]?.value === value; }
  relation(): Expr | null {
    let left = this.sum();
    if (!left) return null;
    while (/^(=|<|>|<=|>=|≤|≥|≠|!=|≈)$/.test(this.t[this.i]?.value ?? "")) {
      const saved = this.i;
      const op = this.t[this.i++]!.value;
      const right = this.sum();
      if (!right) { this.i = saved; break; }
      left = { tex: `${left.tex} ${operators[op] ?? op} ${right.tex}` };
    }
    return left;
  }
  sum(): Expr | null {
    let left = this.product();
    if (!left) return null;
    while (/^[+\-−–±]$/.test(this.t[this.i]?.value ?? "")) {
      const saved = this.i;
      const op = this.t[this.i++]!.value;
      const right = this.product();
      if (!right) { this.i = saved; break; }
      left = { tex: `${left.tex} ${operators[op] ?? op} ${right.tex}` };
    }
    return left;
  }
  product(): Expr | null {
    let left = this.power();
    if (!left) return null;
    while (this.i < this.t.length) {
      const next = this.t[this.i]!;
      const explicit = /^[*/÷·×:]$/.test(next.value);
      const previous = this.t[this.i - 1]!;
      const atom = next.kind !== "symbol" || next.value === "(" || next.value === "√";
      const adjacent = previous.end === next.start;
      const implicit = atom && (adjacent || (previous.kind === "number" && next.kind === "variable" && !/^[aI]$/.test(next.value)) || (next.value === "(" && /^[fgh]$/.test(previous.value)));
      if (!explicit && !implicit) break;
      const saved = this.i;
      if (explicit) this.i++;
      const right = this.power();
      if (!right) { this.i = saved; break; }
      if (next.value === "/") left = { tex: `\\frac{${ungroup(left.tex)}}{${ungroup(right.tex)}}`, fraction: true };
      else if (explicit) left = { tex: `${left.tex} ${operators[next.value] ?? next.value} ${right.tex}` };
      else left = { tex: `${left.tex}${next.value === "(" && /^[fgh]$/.test(previous.value) ? "" : " "}${right.tex}` };
    }
    return left;
  }
  power(): Expr | null {
    let left = this.atom();
    if (!left) return null;
    while (this.i < this.t.length) {
      const op = this.t[this.i]!.value;
      if (op === "^" || op === "_") {
        const saved = this.i++;
        const exponent = this.atom();
        if (!exponent) { this.i = saved; break; }
        left = { tex: `${left.tex}${op}{${ungroup(exponent.tex)}}` };
      } else if (superscripts[op]) {
        let exponent = "";
        while (superscripts[this.t[this.i]?.value ?? ""]) exponent += superscripts[this.t[this.i++]!.value];
        left = { tex: `${left.tex}^{${exponent}}` };
      } else if (op === "%") { this.i++; left = { tex: `${left.tex}\\%` }; }
      else break;
    }
    return left;
  }
  atom(): Expr | null {
    const token = this.t[this.i];
    if (!token) return null;
    if (/^[+\-−–±]$/.test(token.value)) {
      const saved = this.i++;
      const a = this.atom();
      if (!a) { this.i = saved; return null; }
      return { tex: `${operators[token.value] ?? token.value}${a.tex}` };
    }
    if (token.kind === "number" || token.kind === "variable") {
      this.i++;
      return { tex: token.value === "π" || token.value === "pi" ? "\\pi" : token.value === "θ" ? "\\theta" : token.value.replace(/,/g, "{,}") };
    }
    if (token.value === "(" ) {
      const saved = this.i++;
      const inner = this.relation();
      if (!inner) { this.i = saved; return null; }
      let tex = inner.tex;
      while (this.peek(",")) {
        this.i++;
        const coordinate = this.relation();
        if (!coordinate) { this.i = saved; return null; }
        tex += `, ${coordinate.tex}`;
      }
      if (!this.peek(")")) { this.i = saved; return null; }
      this.i++;
      return { tex: inner.fraction && tex === inner.tex ? tex : `(${tex})` };
    }
    if (token.kind === "function" || token.value === "√") {
      const saved = this.i++;
      const argument = this.atom();
      if (!argument) { this.i = saved; return null; }
      return { tex: token.value === "sqrt" || token.value === "√" ? `\\sqrt{${ungroup(argument.tex)}}` : `\\${token.value} ${argument.tex}` };
    }
    return null;
  }
}

function ungroup(tex: string) {
  // Only remove an enclosing pair, never the separate groups in (x+1)(x-1).
  if (!tex.startsWith("(") || !tex.endsWith(")")) return tex;
  let depth = 0;
  for (let i = 0; i < tex.length - 1; i++) {
    if (tex[i] === "(") depth++;
    if (tex[i] === ")") depth--;
    if (depth === 0) return tex;
  }
  return tex.slice(1, -1);
}

export function mathTextParts(text: string): MathTextPart[] {
  const out: MathTextPart[] = [];
  let plain = 0;
  for (let start = 0; start < text.length; start++) {
    if (start > 0 && (letters.test(text[start - 1]!) || /[$\\]/.test(text[start - 1]!))) continue;
    if (!/[A-Za-z\dπθ√(−\-+]/.test(text[start]!)) continue;
    const t = tokens(text, start);
    if (!t.length || t[0]!.start !== start) continue;
    const parser = new Expression(t);
    const expression = parser.relation();
    if (!expression || !parser.i) continue;
    const end = t[parser.i - 1]!.end;
    if (letters.test(text[end] ?? "")) continue;
    const raw = text.slice(start, end);
    // Bare article 'a', pronoun 'I', labels and prose numbers stay in the text font.
    const whole = !text.slice(0, start).trim() && !text.slice(end).trim();
    const singleVariable = t[0]!.kind === "variable" && parser.i === 1 && !/^(a|A|I|[A-Z]{2,3})$/.test(raw);
    if (parser.i === 1 && !singleVariable && !whole) continue;
    if (out.length || start > 0) out.push({ kind: "text", text: text.slice(plain, start) });
    out.push({ kind: "math", tex: expression.tex });
    plain = end;
    start = end - 1;
  }
  if (plain < text.length) out.push({ kind: "text", text: text.slice(plain) });
  return out;
}
