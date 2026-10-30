// Arduino sketch front end for the simulator: preprocessor, lexer, parser and a type pass.
// It accepts the C++ subset that Arduino sketches use: globals, functions, the usual statements (if/else, for, while,
// do/while, switch, break/continue/return), integer and floating-point arithmetic with C typing, 1-D arrays, #define
// constants, String, Serial and Servo objects. Classes, pointers, templates and structs are reported as unsupported
// with the line they are on, like a compiler error.

export class SketchError extends Error {
  constructor(message: string, public line: number) { super(message); }
}

// ---------------------------------------------------------------- types

/** Integer types carry their width; "f" is float/double; "s" is String/char*; "v" is void; "obj" is a library object. */
export type Ty =
  | { k: "int"; bits: 8 | 16 | 32 | 64; signed: boolean }
  | { k: "f" } | { k: "b" } | { k: "s" } | { k: "v" } | { k: "obj"; cls: string };

export const T = {
  int16: { k: "int", bits: 16, signed: true } as Ty,
  int32: { k: "int", bits: 32, signed: true } as Ty,
  uint32: { k: "int", bits: 32, signed: false } as Ty,
  uint16: { k: "int", bits: 16, signed: false } as Ty,
  uint8: { k: "int", bits: 8, signed: false } as Ty,
  int8: { k: "int", bits: 8, signed: true } as Ty,
  f: { k: "f" } as Ty,
  b: { k: "b" } as Ty,
  s: { k: "s" } as Ty,
  v: { k: "v" } as Ty,
};

/** Board word size: int is 16-bit on the AVR boards (Uno, Nano) and 32-bit on the ESP32. */
export interface Target { intBits: 16 | 32 }

export function typeFromName(words: string[], target: Target): Ty | null {
  const ws = words.filter((x) => x !== "const" && x !== "static" && x !== "volatile");
  const unsigned = ws.includes("unsigned");
  const base = ws.filter((x) => x !== "unsigned" && x !== "signed").join(" ");
  const int = (bits: 8 | 16 | 32 | 64, signed: boolean): Ty => ({ k: "int", bits, signed });
  switch (base) {
    case "": case "int": return int(target.intBits, !unsigned);
    case "short": case "short int": return int(16, !unsigned);
    case "long": case "long int": return int(32, !unsigned);
    case "long long": case "long long int": return int(64, !unsigned);
    case "char": return int(8, !unsigned);
    case "byte": case "uint8_t": return int(8, false);
    case "int8_t": return int(8, true);
    case "word": case "uint16_t": return int(16, false);
    case "int16_t": return int(16, true);
    case "uint32_t": case "size_t": return int(32, false);
    case "int32_t": return int(32, true);
    case "uint64_t": return int(64, false);
    case "int64_t": return int(64, true);
    case "float": case "double": case "long double": return T.f;
    case "bool": case "boolean": return T.b;
    case "String": return T.s;
    case "void": return T.v;
    default: return null;
  }
}

export const TYPE_WORDS = new Set(["int", "long", "short", "char", "byte", "unsigned", "signed", "float", "double", "bool", "boolean", "void", "String", "word", "const", "static", "volatile",
  "uint8_t", "int8_t", "uint16_t", "int16_t", "uint32_t", "int32_t", "uint64_t", "int64_t", "size_t"]);
/** Library classes a sketch may instantiate. */
export const CLASSES = new Set(["Servo", "LiquidCrystal_I2C"]);

// ---------------------------------------------------------------- lexer

export interface Tok { k: "id" | "num" | "str" | "chr" | "op" | "eof"; v: string; line: number; float?: boolean; unsigned?: boolean; long?: boolean }

const OPS = ["<<=", ">>=", "...", "->", "++", "--", "<<", ">>", "<=", ">=", "==", "!=", "&&", "||", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "::",
  "+", "-", "*", "/", "%", "<", ">", "=", "!", "~", "&", "|", "^", "?", ":", ";", ",", ".", "(", ")", "{", "}", "[", "]"];

export interface Pre { src: string; includes: string[]; defines: Map<string, string> }

/** #include and object-like #define; everything else starting with # is ignored (as it does not change the program here). */
export function preprocess(source: string): Pre {
  const includes: string[] = [];
  const defines = new Map<string, string>();
  const lines = source.replace(/\r\n?/g, "\n").split("\n").map((line) => {
    const m = /^\s*#\s*(\w+)\s*(.*)$/.exec(line);
    if (!m) return line;
    if (m[1] === "include") { const inc = /[<"]([^>"]+)[>"]/.exec(m[2]); if (inc) includes.push(inc[1]); }
    else if (m[1] === "define") {
      const d = /^(\w+)(\([^)]*\))?\s*(.*)$/.exec(m[2]);
      if (d && !d[2]) defines.set(d[1], d[3].replace(/\/\/.*$/, "").trim());
    }
    return ""; // keep line numbers
  });
  return { src: lines.join("\n"), includes, defines };
}

export function lex(src: string, defines: Map<string, string> = new Map()): Tok[] {
  const out: Tok[] = [];
  let i = 0, line = 1;
  const push = (t: Tok) => {
    // object-like macros: substitute their tokens (one level, enough for constants)
    if (t.k === "id" && defines.has(t.v)) { for (const x of lex(defines.get(t.v)!)) if (x.k !== "eof") out.push({ ...x, line: t.line }); return; }
    out.push(t);
  };
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; } i += 2; continue; }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /\w/.test(src[j])) j++; push({ k: "id", v: src.slice(i, j), line }); i = j; continue; }
    if (/\d/.test(c) || (c === "." && /\d/.test(src[i + 1] ?? ""))) {
      let j = i, float = false;
      if (c === "0" && /[xX]/.test(src[i + 1])) { j += 2; while (/[0-9a-fA-F]/.test(src[j] ?? "")) j++; }
      else if (c === "0" && /[bB]/.test(src[i + 1])) { j += 2; while (/[01]/.test(src[j] ?? "")) j++; }
      else {
        while (/\d/.test(src[j] ?? "")) j++;
        if (src[j] === "." ) { float = true; j++; while (/\d/.test(src[j] ?? "")) j++; }
        if (/[eE]/.test(src[j] ?? "") && /[\d+-]/.test(src[j + 1] ?? "")) { float = true; j += 2; while (/\d/.test(src[j] ?? "")) j++; }
      }
      const text = src.slice(i, j);
      let unsigned = false, long = false;
      while (/[uUlLfF]/.test(src[j] ?? "")) { const s = src[j].toLowerCase(); if (s === "u") unsigned = true; else if (s === "l") long = true; else float = true; j++; }
      push({ k: "num", v: text, line, float, unsigned, long });
      i = j; continue;
    }
    if (c === '"') {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== '"') { if (src[j] === "\\") { s += unescape(src[j + 1]); j += 2; } else { if (src[j] === "\n") throw new SketchError("missing terminating \" character", line); s += src[j++]; } }
      push({ k: "str", v: s, line }); i = j + 1;
      // adjacent string literals join
      continue;
    }
    if (c === "'") {
      let j = i + 1, s = "";
      if (src[j] === "\\") { s = unescape(src[j + 1]); j += 2; } else s = src[j++];
      if (src[j] !== "'") throw new SketchError("missing terminating ' character", line);
      push({ k: "chr", v: s, line }); i = j + 1; continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new SketchError(`stray '${c}' in program`, line);
    push({ k: "op", v: op, line }); i += op.length;
  }
  out.push({ k: "eof", v: "", line });
  // "ab" "cd" → "abcd"
  for (let k = out.length - 2; k >= 0; k--) if (out[k].k === "str" && out[k + 1].k === "str") { out[k] = { ...out[k], v: out[k].v + out[k + 1].v }; out.splice(k + 1, 1); }
  return out;
}
const unescape = (c: string) => ({ n: "\n", t: "\t", r: "\r", "0": "\0", "\\": "\\", "'": "'", '"': '"' } as Record<string, string>)[c] ?? c;

// ---------------------------------------------------------------- AST

export type Expr =
  | { k: "num"; v: number; ty: Ty; line: number }
  | { k: "str"; v: string; ty: Ty; line: number }
  | { k: "id"; name: string; ty: Ty; line: number; slot?: Slot }
  | { k: "assign"; op: string; target: Expr; value: Expr; ty: Ty; line: number }
  | { k: "bin"; op: string; a: Expr; b: Expr; ty: Ty; line: number }
  | { k: "un"; op: string; a: Expr; ty: Ty; line: number }
  | { k: "upd"; op: "++" | "--"; prefix: boolean; a: Expr; ty: Ty; line: number }
  | { k: "cond"; c: Expr; a: Expr; b: Expr; ty: Ty; line: number }
  | { k: "call"; name: string; obj?: Expr; args: Expr[]; ty: Ty; line: number; fn?: Func }
  | { k: "index"; a: Expr; i: Expr; ty: Ty; line: number }
  | { k: "cast"; to: Ty; a: Expr; ty: Ty; line: number }
  | { k: "sizeof"; bytes: number; ty: Ty; line: number }
  | { k: "list"; items: Expr[]; ty: Ty; line: number };

export type Stmt =
  | { k: "block"; body: Stmt[]; line: number }
  | { k: "expr"; e: Expr; line: number }
  | { k: "decl"; vars: VarDecl[]; line: number }
  | { k: "if"; c: Expr; a: Stmt; b?: Stmt; line: number }
  | { k: "while"; c: Expr; body: Stmt; line: number }
  | { k: "do"; c: Expr; body: Stmt; line: number }
  | { k: "for"; init?: Stmt; c?: Expr; step?: Expr; body: Stmt; line: number }
  | { k: "return"; e?: Expr; line: number }
  | { k: "break"; line: number }
  | { k: "continue"; line: number }
  | { k: "switch"; e: Expr; cases: { test?: Expr; body: Stmt[] }[]; line: number }
  | { k: "empty"; line: number };

/** Where a variable lives: a global, or a local frame slot. Static locals live with the globals. */
export interface Slot { scope: "g" | "l"; index: number; ty: Ty; array?: number; name: string; isConst: boolean }
export interface VarDecl { slot: Slot; init?: Expr; line: number }
export interface Func { name: string; ret: Ty; params: { slot: Slot; ref: boolean }[]; body?: Stmt; frameSize: number; line: number }

export interface Program {
  globals: Slot[];
  globalInit: VarDecl[];
  funcs: Map<string, Func>;
  includes: string[];
  target: Target;
}

// ---------------------------------------------------------------- built-in signatures

type Sig = { ret: Ty | "arg0" | "wider"; min: number; max: number; blocking?: boolean };
const I = T.int16; // placeholder, replaced by the board's int
const BUILTINS: Record<string, Sig> = {
  pinMode: { ret: T.v, min: 2, max: 2 }, digitalWrite: { ret: T.v, min: 2, max: 2 }, digitalRead: { ret: I, min: 1, max: 1 },
  analogRead: { ret: I, min: 1, max: 1 }, analogWrite: { ret: T.v, min: 2, max: 2 }, analogReadResolution: { ret: T.v, min: 1, max: 1 },
  delay: { ret: T.v, min: 1, max: 1, blocking: true }, delayMicroseconds: { ret: T.v, min: 1, max: 1, blocking: true },
  millis: { ret: T.uint32, min: 0, max: 0 }, micros: { ret: T.uint32, min: 0, max: 0 },
  pulseIn: { ret: T.uint32, min: 2, max: 3, blocking: true }, pulseInLong: { ret: T.uint32, min: 2, max: 3, blocking: true },
  tone: { ret: T.v, min: 2, max: 3 }, noTone: { ret: T.v, min: 1, max: 1 },
  map: { ret: T.int32, min: 5, max: 5 }, constrain: { ret: "arg0", min: 3, max: 3 }, min: { ret: "wider", min: 2, max: 2 }, max: { ret: "wider", min: 2, max: 2 },
  abs: { ret: "arg0", min: 1, max: 1 }, sq: { ret: "arg0", min: 1, max: 1 }, sqrt: { ret: T.f, min: 1, max: 1 }, pow: { ret: T.f, min: 2, max: 2 },
  sin: { ret: T.f, min: 1, max: 1 }, cos: { ret: T.f, min: 1, max: 1 }, tan: { ret: T.f, min: 1, max: 1 }, atan2: { ret: T.f, min: 2, max: 2 },
  floor: { ret: T.f, min: 1, max: 1 }, ceil: { ret: T.f, min: 1, max: 1 }, round: { ret: T.int32, min: 1, max: 1 }, fabs: { ret: T.f, min: 1, max: 1 },
  random: { ret: T.int32, min: 1, max: 2 }, randomSeed: { ret: T.v, min: 1, max: 1 },
  digitalPinToInterrupt: { ret: I, min: 1, max: 1 }, attachInterrupt: { ret: T.v, min: 3, max: 3 }, detachInterrupt: { ret: T.v, min: 1, max: 1 },
  interrupts: { ret: T.v, min: 0, max: 0 }, noInterrupts: { ret: T.v, min: 0, max: 0 },
  bitRead: { ret: I, min: 2, max: 2 }, bit: { ret: T.uint32, min: 1, max: 1 }, lowByte: { ret: T.uint8, min: 1, max: 1 }, highByte: { ret: T.uint8, min: 1, max: 1 },
  String: { ret: T.s, min: 0, max: 2 }, isDigit: { ret: T.b, min: 1, max: 1 }, yield: { ret: T.v, min: 0, max: 0 },
};
const METHODS: Record<string, Record<string, Sig>> = {
  Serial: {
    begin: { ret: T.v, min: 1, max: 2 }, end: { ret: T.v, min: 0, max: 0 }, print: { ret: T.uint32, min: 1, max: 2 }, println: { ret: T.uint32, min: 0, max: 2 },
    write: { ret: T.uint32, min: 1, max: 1 }, available: { ret: I, min: 0, max: 0 }, read: { ret: I, min: 0, max: 0 }, peek: { ret: I, min: 0, max: 0 },
    parseInt: { ret: T.int32, min: 0, max: 0, blocking: true }, parseFloat: { ret: T.f, min: 0, max: 0, blocking: true },
    readString: { ret: T.s, min: 0, max: 0, blocking: true }, readStringUntil: { ret: T.s, min: 1, max: 1, blocking: true },
    setTimeout: { ret: T.v, min: 1, max: 1 }, flush: { ret: T.v, min: 0, max: 0 },
  },
  Servo: {
    attach: { ret: T.uint8, min: 1, max: 3 }, detach: { ret: T.v, min: 0, max: 0 }, write: { ret: T.v, min: 1, max: 1 }, writeMicroseconds: { ret: T.v, min: 1, max: 1 },
    read: { ret: I, min: 0, max: 0 }, attached: { ret: T.b, min: 0, max: 0 },
  },
  LiquidCrystal_I2C: {
    init: { ret: T.v, min: 0, max: 0 }, begin: { ret: T.v, min: 0, max: 3 }, backlight: { ret: T.v, min: 0, max: 0 }, noBacklight: { ret: T.v, min: 0, max: 0 },
    clear: { ret: T.v, min: 0, max: 0 }, home: { ret: T.v, min: 0, max: 0 }, setCursor: { ret: T.v, min: 2, max: 2 }, print: { ret: T.uint32, min: 1, max: 2 },
    display: { ret: T.v, min: 0, max: 0 }, noDisplay: { ret: T.v, min: 0, max: 0 },
  },
  Wire: { begin: { ret: T.v, min: 0, max: 2 }, setClock: { ret: T.v, min: 1, max: 1 } },
  String: {
    length: { ret: T.uint32, min: 0, max: 0 }, toInt: { ret: T.int32, min: 0, max: 0 }, toFloat: { ret: T.f, min: 0, max: 0 }, indexOf: { ret: T.int32, min: 1, max: 2 },
    substring: { ret: T.s, min: 1, max: 2 }, trim: { ret: T.v, min: 0, max: 0 }, equals: { ret: T.b, min: 1, max: 1 }, charAt: { ret: T.int8, min: 1, max: 1 },
    startsWith: { ret: T.b, min: 1, max: 1 }, endsWith: { ret: T.b, min: 1, max: 1 }, toUpperCase: { ret: T.v, min: 0, max: 0 }, toLowerCase: { ret: T.v, min: 0, max: 0 },
    concat: { ret: T.b, min: 1, max: 1 }, c_str: { ret: T.s, min: 0, max: 0 },
  },
};
export const BLOCKING = new Set(Object.entries(BUILTINS).filter(([, s]) => s.blocking).map(([n]) => n));
export const isBlockingMethod = (cls: string, m: string) => !!METHODS[cls]?.[m]?.blocking;

/** Constants every sketch can use. Pin names depend on the board, so they come from the caller. */
export interface Env { constants: Record<string, number>; target: Target }

// ---------------------------------------------------------------- parser

const isInt = (t: Ty) => t.k === "int" || t.k === "b";
const rank = (t: Ty) => (t.k === "f" ? 100 : t.k === "int" ? t.bits * 2 + (t.signed ? 0 : 1) : t.k === "b" ? 0 : -1);
/** C's usual arithmetic conversions: promote to int, then to the wider (or unsigned) of the two. */
export function arith(a: Ty, b: Ty, target: Target): Ty {
  if (a.k === "f" || b.k === "f") return T.f;
  const promote = (t: Ty): Ty => (t.k === "int" && t.bits >= target.intBits ? t : { k: "int", bits: target.intBits, signed: true });
  const pa = promote(a), pb = promote(b);
  return rank(pa) >= rank(pb) ? pa : pb;
}

export function parse(source: string, env: Env): Program {
  const pre = preprocess(source);
  const toks = lex(pre.src, pre.defines);
  const target = env.target;
  const INT: Ty = { k: "int", bits: target.intBits, signed: true };
  let p = 0;
  const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)];
  const next = () => toks[p++];
  const at = (v: string, o = 0) => { const t = peek(o); return (t.k === "op" || t.k === "id") && t.v === v; };
  const eat = (v: string) => { if (at(v)) { p++; return true; } return false; };
  const expect = (v: string, what = `'${v}'`) => { if (!eat(v)) throw new SketchError(`expected ${what} before '${peek().v || "end of file"}'`, peek().line); };

  const globals: Slot[] = [];
  const globalInit: VarDecl[] = [];
  const funcs = new Map<string, Func>();
  const objects = new Map<string, string>(); // global object name -> class
  objects.set("Serial", "Serial");
  objects.set("Wire", "Wire");
  // scopes: innermost last; globals are scope 0
  let scopes: Map<string, Slot>[] = [new Map()];
  let frame: { size: number } | null = null;
  let fnRet: Ty = T.v;
  const lookup = (name: string) => { for (let k = scopes.length - 1; k >= 0; k--) { const s = scopes[k].get(name); if (s) return s; } return undefined; };

  const isTypeStart = () => { const t = peek(); return t.k === "id" && (TYPE_WORDS.has(t.v) || CLASSES.has(t.v)); };
  const readTypeWords = (): string[] => { const w: string[] = []; while (peek().k === "id" && TYPE_WORDS.has(peek().v)) w.push(next().v); return w; };
  const typeOf = (words: string[], line: number): Ty => {
    const ty = typeFromName(words, target);
    if (!ty) throw new SketchError(`'${words.join(" ")}' does not name a type`, line);
    return ty;
  };

  const declare = (name: string, ty: Ty, line: number, isConst: boolean, array?: number, isStatic = false): Slot => {
    const scope = scopes[scopes.length - 1];
    if (scope.has(name)) throw new SketchError(`redeclaration of '${name}'`, line);
    let slot: Slot;
    if (!frame || isStatic) { slot = { scope: "g", index: globals.length, ty, array, name, isConst }; globals.push(slot); }
    else slot = { scope: "l", index: frame.size++, ty, array, name, isConst };
    scope.set(name, slot);
    return slot;
  };

  // ---- expressions (precedence climbing) ----
  const BIN: [string[], number][] = [[["||"], 1], [["&&"], 2], [["|"], 3], [["^"], 4], [["&"], 5], [["==", "!="], 6], [["<", ">", "<=", ">="], 7], [["<<", ">>"], 8], [["+", "-"], 9], [["*", "/", "%"], 10]];
  const prec = (op: string) => BIN.find(([ops]) => ops.includes(op))?.[1] ?? 0;
  const ASSIGN = ["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="];

  const lvalue = (e: Expr, line: number) => {
    if (e.k === "id" && e.slot) { if (e.slot.isConst) throw new SketchError(`assignment of read-only variable '${e.name}'`, line); return; }
    if (e.k === "index") return;
    throw new SketchError("lvalue required as left operand of assignment", line);
  };

  const expr = (): Expr => assignment();
  const assignment = (): Expr => {
    const left = conditional();
    const t = peek();
    if (t.k === "op" && ASSIGN.includes(t.v)) {
      next();
      lvalue(left, t.line);
      const value = assignment();
      if (left.ty.k === "s" && t.v !== "=" && t.v !== "+=") throw new SketchError(`invalid operands to String '${t.v}'`, t.line);
      return { k: "assign", op: t.v, target: left, value, ty: left.ty, line: t.line };
    }
    return left;
  };
  const conditional = (): Expr => {
    const c = binary(1);
    if (at("?")) {
      const line = next().line;
      const a = expr(); expect(":");
      const b = conditional();
      return { k: "cond", c, a, b, ty: a.ty.k === "s" || b.ty.k === "s" ? T.s : isInt(a.ty) && isInt(b.ty) ? arith(a.ty, b.ty, target) : a.ty.k === "f" || b.ty.k === "f" ? T.f : a.ty, line };
    }
    return c;
  };
  const binary = (min: number): Expr => {
    let a = unary();
    for (;;) {
      const t = peek();
      if (t.k !== "op") break;
      const pr = prec(t.v);
      if (!pr || pr < min) break;
      next();
      const b = binary(pr + 1);
      let ty: Ty;
      if (["==", "!=", "<", ">", "<=", ">=", "&&", "||"].includes(t.v)) ty = T.b;
      else if (t.v === "+" && (a.ty.k === "s" || b.ty.k === "s")) ty = T.s;
      else if (["<<", ">>"].includes(t.v)) ty = arith(a.ty, T.int16, target).k === "f" ? INT : arith(a.ty, { k: "int", bits: 8, signed: true }, target);
      else ty = arith(a.ty, b.ty, target);
      if ((["%", "&", "|", "^", "<<", ">>"].includes(t.v)) && (a.ty.k === "f" || b.ty.k === "f")) throw new SketchError(`invalid operands of types 'float' to binary 'operator${t.v}'`, t.line);
      a = { k: "bin", op: t.v, a, b, ty, line: t.line };
    }
    return a;
  };
  const unary = (): Expr => {
    const t = peek();
    if (t.k === "op" && ["!", "-", "+", "~"].includes(t.v)) { next(); const a = unary(); return { k: "un", op: t.v, a, ty: t.v === "!" ? T.b : a.ty.k === "f" ? T.f : arith(a.ty, INT, target), line: t.line }; }
    if (t.k === "op" && (t.v === "++" || t.v === "--")) { next(); const a = unary(); lvalue(a, t.line); return { k: "upd", op: t.v, prefix: true, a, ty: a.ty, line: t.line }; }
    if (t.k === "id" && t.v === "sizeof") {
      next(); expect("(");
      let bytes = 0;
      if (isTypeStart()) { const ty = typeOf(readTypeWords(), t.line); bytes = sizeOfTy(ty); }
      else { const e = expr(); bytes = e.k === "id" && e.slot?.array !== undefined ? e.slot.array * sizeOfTy(e.slot.ty) : sizeOfTy(e.ty); }
      expect(")");
      return { k: "sizeof", bytes, ty: T.uint32, line: t.line };
    }
    // C-style cast: (type) expr
    if (at("(") && peek(1).k === "id" && TYPE_WORDS.has(peek(1).v)) {
      const save = p;
      next();
      const words = readTypeWords();
      if (at(")")) { next(); const to = typeOf(words, t.line); const a = unary(); return { k: "cast", to, a, ty: to, line: t.line }; }
      p = save;
    }
    return postfix();
  };
  const postfix = (): Expr => {
    let e = primary();
    for (;;) {
      const t = peek();
      if (at("[")) { next(); const i = expr(); expect("]"); if (e.k !== "id" || e.slot?.array === undefined) { if (e.ty.k !== "s") throw new SketchError("subscripted value is neither array nor pointer", t.line); } e = { k: "index", a: e, i, ty: e.ty.k === "s" ? T.int8 : e.ty, line: t.line }; continue; }
      if (at("++") || at("--")) { next(); lvalue(e, t.line); e = { k: "upd", op: t.v as "++" | "--", prefix: false, a: e, ty: e.ty, line: t.line }; continue; }
      if (at(".")) {
        next();
        const m = next();
        if (m.k !== "id") throw new SketchError("expected member name", m.line);
        const cls = e.ty.k === "obj" ? e.ty.cls : e.ty.k === "s" ? "String" : null;
        if (!cls) throw new SketchError(`request for member '${m.v}' in something that is not an object`, m.line);
        const sig = METHODS[cls]?.[m.v];
        if (!sig) throw new SketchError(`'class ${cls}' has no member named '${m.v}'`, m.line);
        expect("(");
        const args = callArgs();
        if (args.length < sig.min || args.length > sig.max) throw new SketchError(`no matching function for call to '${cls}::${m.v}' with ${args.length} argument(s)`, m.line);
        e = { k: "call", name: m.v, obj: e, args, ty: sig.ret === "arg0" || sig.ret === "wider" ? (args[0]?.ty ?? INT) : sig.ret === I ? INT : sig.ret, line: m.line };
        continue;
      }
      break;
    }
    return e;
  };
  const callArgs = (): Expr[] => {
    const args: Expr[] = [];
    if (!eat(")")) { do args.push(assignment()); while (eat(",")); expect(")"); }
    return args;
  };
  const primary = (): Expr => {
    const t = next();
    if (t.k === "num") {
      const v = /^0[xX]/.test(t.v) ? parseInt(t.v, 16) : /^0[bB]/.test(t.v) ? parseInt(t.v.slice(2), 2) : /^0\d/.test(t.v) && !t.float ? parseInt(t.v, 8) : Number(t.v);
      const ty: Ty = t.float ? T.f : { k: "int", bits: t.long || v > (target.intBits === 16 ? 32767 : 2147483647) ? 32 : target.intBits, signed: !t.unsigned };
      return { k: "num", v, ty, line: t.line };
    }
    if (t.k === "str") return { k: "str", v: t.v, ty: T.s, line: t.line };
    if (t.k === "chr") return { k: "num", v: t.v.charCodeAt(0), ty: T.int8, line: t.line };
    if (t.k === "op" && t.v === "(") { const e = expr(); expect(")"); return e; }
    if (t.k === "op" && t.v === "{") { const items: Expr[] = []; if (!eat("}")) { do { if (at("}")) break; items.push(assignment()); } while (eat(",")); expect("}"); } return { k: "list", items, ty: items[0]?.ty ?? INT, line: t.line }; }
    if (t.k === "id") {
      if (t.v === "true" || t.v === "false") return { k: "num", v: t.v === "true" ? 1 : 0, ty: T.b, line: t.line };
      if (at("(")) {
        next();
        const args = callArgs();
        const user = funcs.get(t.v);
        if (user) {
          if (args.length !== user.params.length) throw new SketchError(`${args.length < user.params.length ? "too few" : "too many"} arguments to function '${t.v}'`, t.line);
          return { k: "call", name: t.v, args, ty: user.ret, line: t.line, fn: user };
        }
        const sig = BUILTINS[t.v];
        if (!sig) return { k: "call", name: t.v, args, ty: INT, line: t.line }; // resolved after all functions are known
        if (args.length < sig.min || args.length > sig.max) throw new SketchError(`${args.length < sig.min ? "too few" : "too many"} arguments to function '${t.v}'`, t.line);
        const ret = sig.ret === "arg0" ? (args[0].ty.k === "f" ? T.f : arith(args[0].ty, INT, target)) : sig.ret === "wider" ? arith(args[0].ty, args[1].ty, target) : sig.ret === I ? INT : sig.ret;
        return { k: "call", name: t.v, args, ty: ret, line: t.line };
      }
      const slot = lookup(t.v);
      if (slot) return { k: "id", name: t.v, ty: slot.ty, line: t.line, slot };
      if (funcs.has(t.v)) return { k: "id", name: t.v, ty: T.v, line: t.line }; // a function passed by name (attachInterrupt)
      if (objects.has(t.v)) return { k: "id", name: t.v, ty: { k: "obj", cls: objects.get(t.v)! }, line: t.line };
      if (t.v in env.constants) return { k: "num", v: env.constants[t.v], ty: INT, line: t.line };
      if (t.v === "PI" || t.v === "HALF_PI" || t.v === "TWO_PI" || t.v === "DEG_TO_RAD" || t.v === "RAD_TO_DEG")
        return { k: "num", v: { PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: 2 * Math.PI, DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI }[t.v]!, ty: T.f, line: t.line };
      throw new SketchError(`'${t.v}' was not declared in this scope`, t.line);
    }
    throw new SketchError(`expected primary-expression before '${t.v || "end of file"}'`, t.line);
  };

  // ---- statements ----
  const varDecls = (ty: Ty, isConst: boolean, isStatic: boolean, line: number, first?: string): VarDecl[] => {
    const out: VarDecl[] = [];
    let name = first;
    for (;;) {
      if (!name) { const n = next(); if (n.k !== "id") throw new SketchError("expected unqualified-id", n.line); name = n.v; }
      let array: number | undefined;
      if (eat("[")) {
        if (at("]")) array = -1; else { const n = expr(); if (n.k !== "num" && n.k !== "sizeof") { if (!(n.k === "id" && n.slot?.isConst)) throw new SketchError("array size must be a constant", line); } array = n.k === "num" ? n.v : n.k === "sizeof" ? n.bytes : -1; }
        expect("]");
      }
      let init: Expr | undefined;
      if (eat("=")) init = assignment();
      else if (ty.k === "obj" && at("(")) { next(); callArgs(); } // Servo s(…) – constructor args are ignored
      if (array === -1) array = init?.k === "list" ? init.items.length : init?.k === "str" ? init.v.length + 1 : 0;
      if (init && init.k === "str" && array !== undefined) { const s = init.v; init = { k: "list", items: [...s].map((ch) => ({ k: "num", v: ch.charCodeAt(0), ty: T.int8, line })), ty: T.int8, line }; void s; }
      const slot = declare(name, ty, line, isConst, array, isStatic);
      out.push({ slot, init, line });
      name = undefined;
      if (!eat(",")) break;
    }
    expect(";");
    return out;
  };

  const statement = (): Stmt => {
    const t = peek();
    if (at("{")) { next(); scopes.push(new Map()); const body: Stmt[] = []; while (!at("}")) { if (peek().k === "eof") throw new SketchError("expected '}' at end of input", peek().line); body.push(statement()); } next(); scopes.pop(); return { k: "block", body, line: t.line }; }
    if (at(";")) { next(); return { k: "empty", line: t.line }; }
    if (t.k === "id") {
      switch (t.v) {
        case "if": { next(); expect("("); const c = expr(); expect(")"); const a = statement(); let b: Stmt | undefined; if (eat("else")) b = statement(); return { k: "if", c, a, b, line: t.line }; }
        case "while": { next(); expect("("); const c = expr(); expect(")"); return { k: "while", c, body: statement(), line: t.line }; }
        case "do": { next(); const body = statement(); expect("while"); expect("("); const c = expr(); expect(")"); expect(";"); return { k: "do", c, body, line: t.line }; }
        case "for": {
          next(); expect("("); scopes.push(new Map());
          let init: Stmt | undefined;
          if (!eat(";")) init = isTypeStart() ? declStatement() : (() => { const e = expr(); expect(";"); return { k: "expr", e, line: t.line } as Stmt; })();
          const c = at(";") ? undefined : expr(); expect(";");
          const step = at(")") ? undefined : expr(); expect(")");
          const body = statement(); scopes.pop();
          return { k: "for", init, c, step, body, line: t.line };
        }
        case "return": { next(); const e = at(";") ? undefined : expr(); expect(";"); if (e && fnRet.k === "v") throw new SketchError("return-statement with a value, in function returning 'void'", t.line); return { k: "return", e, line: t.line }; }
        case "break": next(); expect(";"); return { k: "break", line: t.line };
        case "continue": next(); expect(";"); return { k: "continue", line: t.line };
        case "switch": {
          next(); expect("("); const e = expr(); expect(")"); expect("{");
          const cases: { test?: Expr; body: Stmt[] }[] = [];
          scopes.push(new Map());
          while (!eat("}")) {
            if (eat("case")) { const test = conditional(); expect(":"); cases.push({ test, body: [] }); }
            else if (eat("default")) { expect(":"); cases.push({ body: [] }); }
            else { if (!cases.length) throw new SketchError("statement before the first case label", peek().line); cases[cases.length - 1].body.push(statement()); }
          }
          scopes.pop();
          return { k: "switch", e, cases, line: t.line };
        }
        case "class": case "struct": case "template": case "typedef": case "enum": case "union": case "namespace":
          throw new SketchError(`'${t.v}' is not supported by the simulator yet`, t.line);
        case "goto": throw new SketchError("'goto' is not supported by the simulator", t.line);
      }
      if (isTypeStart()) return declStatement();
    }
    const e = expr(); expect(";");
    return { k: "expr", e, line: t.line };
  };
  const declStatement = (): Stmt => {
    const line = peek().line;
    if (CLASSES.has(peek().v)) { const cls = next().v; const vars = varDecls({ k: "obj", cls }, false, false, line); return { k: "decl", vars, line }; }
    const words = readTypeWords();
    if (at("*") || at("&")) throw new SketchError("pointers and references are not supported by the simulator yet", line);
    const ty = typeOf(words, line);
    if (ty.k === "v") throw new SketchError("variable declared void", line);
    return { k: "decl", vars: varDecls(ty, words.includes("const"), words.includes("static"), line), line };
  };

  // ---- top level ----
  const pending: { fn: Func; start: number; paramScope: Map<string, Slot> }[] = [];
  while (peek().k !== "eof") {
    const t = peek();
    if (at(";")) { next(); continue; }
    if (t.k === "id" && CLASSES.has(t.v)) {
      const cls = next().v;
      for (;;) {
        const n = next();
        if (n.k !== "id") throw new SketchError("expected unqualified-id", n.line);
        objects.set(n.v, cls);
        const slot = declare(n.v, { k: "obj", cls }, n.line, false);
        globalInit.push({ slot, line: n.line });
        if (at("(")) { next(); callArgs(); }
        if (!eat(",")) break;
      }
      expect(";");
      continue;
    }
    if (!(t.k === "id" && TYPE_WORDS.has(t.v))) {
      if (t.k === "id" && ["class", "struct", "template", "typedef", "enum", "namespace", "union"].includes(t.v)) throw new SketchError(`'${t.v}' is not supported by the simulator yet`, t.line);
      throw new SketchError(`'${t.v}' does not name a type`, t.line);
    }
    const words = readTypeWords();
    if (at("*") || at("&")) throw new SketchError("pointers and references are not supported by the simulator yet", t.line);
    const name = next();
    if (name.k !== "id") throw new SketchError("expected unqualified-id", name.line);
    if (at("(")) {
      // function: read the parameters now, the body after every signature is known (so calls can go forwards)
      next();
      const ret = typeOf(words, t.line);
      const paramScope = new Map<string, Slot>();
      const params: Func["params"] = [];
      let size = 0;
      if (!(at("void") && peek(1).v === ")")) {
        while (!at(")")) {
          const pw = readTypeWords();
          if (!pw.length) throw new SketchError("expected parameter type", peek().line);
          const ref = eat("&");
          if (at("*")) throw new SketchError("pointer parameters are not supported by the simulator yet", peek().line);
          const pn = next();
          if (pn.k !== "id") throw new SketchError("expected parameter name", pn.line);
          let array: number | undefined;
          if (eat("[")) { while (!eat("]")) next(); array = 0; }
          const slot: Slot = { scope: "l", index: size++, ty: typeOf(pw, pn.line), name: pn.v, isConst: pw.includes("const"), array };
          paramScope.set(pn.v, slot);
          params.push({ slot, ref: ref || array !== undefined });
          if (!eat(",")) break;
        }
      } else next();
      expect(")");
      const fn: Func = { name: name.v, ret, params, frameSize: size, line: t.line };
      if (at(";")) { next(); if (!funcs.has(name.v)) funcs.set(name.v, fn); continue; } // prototype
      const existing = funcs.get(name.v);
      if (existing?.body) throw new SketchError(`redefinition of '${name.v}'`, t.line);
      if (existing) Object.assign(existing, { params, frameSize: size, ret }); else funcs.set(name.v, fn);
      const start = p;
      // skip the body for now
      let depth = 0;
      if (!at("{")) throw new SketchError("expected '{' before function body", peek().line);
      do { const x = next(); if (x.k === "op" && x.v === "{") depth++; else if (x.k === "op" && x.v === "}") depth--; else if (x.k === "eof") throw new SketchError("expected '}' at end of input", x.line); } while (depth > 0);
      pending.push({ fn: funcs.get(name.v)!, start, paramScope });
      continue;
    }
    const ty = typeOf(words, t.line);
    globalInit.push(...varDecls(ty, words.includes("const"), true, t.line, name.v));
  }

  // bodies
  for (const { fn, start, paramScope } of pending) {
    const save = p;
    p = start;
    scopes = [scopes[0], paramScope];
    frame = { size: fn.frameSize };
    fnRet = fn.ret;
    fn.body = statement();
    fn.frameSize = frame.size;
    frame = null;
    p = save;
  }
  scopes = [scopes[0]];

  // calls to functions defined later, and unknown names
  const resolve = (s: Stmt | Expr | undefined): void => {
    if (!s || typeof s !== "object") return;
    if ((s as Expr).k === "call") {
      const c = s as Extract<Expr, { k: "call" }>;
      if (!c.obj && !c.fn && !BUILTINS[c.name]) {
        const fn = funcs.get(c.name);
        if (!fn) throw new SketchError(`'${c.name}' was not declared in this scope`, c.line);
        if (c.args.length !== fn.params.length) throw new SketchError(`wrong number of arguments to function '${c.name}'`, c.line);
        c.fn = fn; c.ty = fn.ret;
      }
    }
    for (const v of Object.values(s)) {
      if (Array.isArray(v)) v.forEach((x) => (x && typeof x === "object" && "k" in x ? resolve(x) : x && typeof x === "object" && "body" in x ? (resolve((x as { test?: Expr }).test), (x as { body: Stmt[] }).body.forEach(resolve)) : undefined));
      else if (v && typeof v === "object" && "k" in v && v !== s) resolve(v as Expr);
    }
  };
  for (const fn of funcs.values()) resolve(fn.body);
  globalInit.forEach((d) => resolve(d.init));
  for (const req of ["setup", "loop"]) {
    const fn = funcs.get(req);
    if (!fn?.body) throw new SketchError(`undefined reference to '${req}()'`, toks[toks.length - 1].line);
  }
  return { globals, globalInit, funcs, includes: pre.includes, target };
}

export const sizeOfTy = (t: Ty) => (t.k === "int" ? t.bits / 8 : t.k === "f" ? 4 : t.k === "b" ? 1 : t.k === "s" ? 6 : 2);
