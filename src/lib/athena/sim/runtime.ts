// Runs a parsed sketch against a virtual board, in simulated microseconds.
// The program is a tree of generators: a statement yields when it must wait (delay, pulseIn, waiting for Serial) or when the
// scheduler asks (an interrupt is pending, the frame's time is up). Time advances by a cost per statement and per
// hardware call, close to an Arduino at 16 MHz, so millis() keeps moving in busy loops just as on the real board.
import { SketchError, arith, isBlockingMethod, BLOCKING, type Expr, type Func, type Program, type Slot, type Stmt, type Ty } from "./sketch";

export type Value = number | string | number[] | { cls: string; id: number };
interface Box { v: Value }
type Ctl = undefined | { k: "break" } | { k: "continue" } | { k: "return"; v?: Value };
type Gen<R> = Generator<number, R, void>;

/** What the program can touch. The board implements it. */
export interface Hardware {
  pinMode(pin: number, mode: number): void;
  digitalWrite(pin: number, level: number): void;
  digitalRead(pin: number): number;
  analogRead(pin: number): number;
  analogWrite(pin: number, duty: number): void;
  /** how long to wait and the pulse length measured (0 = timed out) */
  pulseIn(pin: number, level: number, timeoutUs: number): { waitUs: number; value: number };
  tone(pin: number, freq: number, durationMs?: number): void;
  noTone(pin: number): void;
  servoAttach(id: number, pin: number): void;
  servoWrite(id: number, angle: number): void;
  servoDetach(id: number): void;
  serialWrite(text: string): void;
  /** a character display on I2C: init, clear, setCursor(col, row), print(text), backlight on/off */
  lcd(id: number, op: string, a?: number, b?: number, text?: string): void;
  serialInput(): string;
  serialConsume(n: number): void;
  /** interrupt number → pin (digitalPinToInterrupt) */
  interruptPin(n: number): number;
  warn(message: string, line: number): void;
}

export interface Costs { stmt: number; io: number; adc: number }
export const AVR_COSTS: Costs = { stmt: 1, io: 4, adc: 112 };
export const ESP32_COSTS: Costs = { stmt: 0.5, io: 2, adc: 10 };

const SLEEP_CHECK = 0; // yield value asking the scheduler to look around

export class Machine {
  us = 0;
  status: "running" | "error" | "halted" = "running";
  error: { message: string; line: number } | null = null;
  line = 0;
  steps = 0;
  private gen: Gen<void>;
  private sleepUntil = 0;
  private stopAt = 0;
  private globals: Box[] = [];
  private servos = 0;
  private displays = 0;
  private isr = new Map<number, { fn: Func; mode: number }>();
  private pending: Func[] = [];
  private irqOn = true;
  private inIsr = false;
  private seed = 1;
  private serialTimeout = 1000;
  private startUs = 0;

  constructor(private prog: Program, private hw: Hardware, private cost: Costs) {
    this.gen = this.main();
  }

  /** Restart from setup(), as after a reset (the board keeps its wiring). */
  reset() {
    this.status = "running"; this.error = null; this.globals = []; this.servos = 0; this.isr.clear(); this.pending = []; this.irqOn = true;
    this.sleepUntil = this.us; this.startUs = this.us; this.gen = this.main();
  }

  get millis() { return Math.floor((this.us - this.startUs) / 1000); }

  /** Interrupt numbers with a routine attached. */
  get interrupts() { return [...this.isr.keys()]; }

  /** The input behind interrupt `irq` changed level: queue its routine if it is attached for that edge. */
  pinChanged(irq: number, from: number, to: number) {
    const h = this.isr.get(irq);
    if (!h || from === to) return;
    const ok = h.mode === 1 /* CHANGE */ || (h.mode === 3 /* RISING */ && to > from) || (h.mode === 2 /* FALLING */ && to < from) || (h.mode === 0 /* LOW */ && to === 0);
    if (ok) this.pending.push(h.fn);
  }

  /** Run until simulated time reaches `toUs`, or `maxSteps` statements ran (then the simulation is slower than real time). */
  advance(toUs: number, maxSteps = 60000): { slow: boolean } {
    if (this.status !== "running") { this.us = Math.max(this.us, toUs); return { slow: false }; }
    const start = this.steps;
    this.stopAt = toUs;
    while (this.us < toUs) {
      if (this.sleepUntil > this.us) {
        if (this.sleepUntil >= toUs) { this.us = toUs; break; }
        this.us = this.sleepUntil;
      }
      if (this.pending.length && this.irqOn && !this.inIsr) this.runIsrs();
      if (this.steps - start > maxSteps) return { slow: true };
      let r: IteratorResult<number, void>;
      try { r = this.gen.next(); } catch (e) {
        this.status = "error";
        this.error = e instanceof SketchError ? { message: e.message, line: e.line } : { message: e instanceof Error ? e.message : String(e), line: this.line };
        return { slow: false };
      }
      if (r.done) { this.status = "halted"; break; }
      if (r.value > 0) this.sleepUntil = this.us + r.value;
    }
    return { slow: false };
  }

  private runIsrs() {
    this.inIsr = true;
    while (this.pending.length) {
      const fn = this.pending.shift()!;
      const g = this.call(fn, []);
      for (let i = 0; i < 100000; i++) { const r = g.next(); if (r.done) break; if (r.value > 0) this.hw.warn("delay() inside an interrupt routine does not wait on a real board", this.line); }
    }
    this.inIsr = false;
  }

  private *main(): Gen<void> {
    for (const d of this.prog.globalInit) this.globals[d.slot.index] = { v: this.initial(d.slot) };
    for (const slot of this.prog.globals) if (!this.globals[slot.index]) this.globals[slot.index] = { v: this.initial(slot) };
    for (const d of this.prog.globalInit) if (d.init) this.globals[d.slot.index].v = this.convertInit(d.slot, this.evalSync(d.init, []));
    yield* this.call(this.prog.funcs.get("setup")!, []);
    const loop = this.prog.funcs.get("loop")!;
    for (;;) {
      yield* this.call(loop, []);
      this.tick(this.cost.stmt * 2);
      yield SLEEP_CHECK;
    }
  }

  // ---------------------------------------------------------------- values

  private initial(slot: Slot): Value {
    if (slot.ty.k === "obj") return slot.ty.cls === "Servo" ? { cls: "Servo", id: this.servos++ } : slot.ty.cls === "LiquidCrystal_I2C" ? { cls: slot.ty.cls, id: this.displays++ } : { cls: slot.ty.cls, id: 0 };
    if (slot.array !== undefined) return new Array(Math.max(0, slot.array)).fill(0);
    return slot.ty.k === "s" ? "" : 0;
  }

  private convertInit(slot: Slot, v: Value): Value {
    if (slot.array !== undefined) {
      const list = Array.isArray(v) ? v : [v as number];
      const out = new Array(Math.max(slot.array, list.length)).fill(0);
      list.forEach((x, i) => (out[i] = this.wrap(x, slot.ty)));
      return out;
    }
    return this.store(v, slot.ty);
  }

  /** Convert a value to the type it is stored as (C truncation and integer wrap-around). */
  store(v: Value, ty: Ty): Value {
    if (ty.k === "s") return typeof v === "string" ? v : this.toStr(v as number, ty);
    if (ty.k === "obj") return v;
    if (typeof v === "string") return ty.k === "f" ? parseFloat(v) || 0 : parseInt(v, 10) || 0;
    if (Array.isArray(v) || typeof v === "object") return v;
    return this.wrap(v, ty);
  }

  wrap(v: number, ty: Ty): number {
    if (ty.k === "b") return v ? 1 : 0;
    if (ty.k === "f") return this.prog.target.intBits === 16 ? Math.fround(v) : v;
    if (ty.k !== "int") return v;
    if (!Number.isFinite(v)) return 0;
    const n = Math.trunc(v);
    switch (ty.bits) {
      case 8: return ty.signed ? (n << 24) >> 24 : n & 0xff;
      case 16: return ty.signed ? (n << 16) >> 16 : n & 0xffff;
      case 32: return ty.signed ? n | 0 : n >>> 0;
      default: return n;
    }
  }

  private tick(us: number) { this.us += us; }

  // ---------------------------------------------------------------- statements

  private *call(fn: Func, args: (Value | Box)[]): Gen<Value | undefined> {
    const frame: Box[] = new Array(fn.frameSize);
    fn.params.forEach((p, i) => { const a = args[i]; frame[p.slot.index] = p.ref && a && typeof a === "object" && "v" in a ? (a as Box) : { v: this.store(a as Value, p.slot.ty) }; });
    const r = yield* this.exec(fn.body!, frame);
    if (r?.k === "return") return r.v === undefined ? undefined : this.store(r.v, fn.ret);
    return undefined;
  }

  private *exec(s: Stmt, f: Box[]): Gen<Ctl> {
    this.line = s.line;
    this.steps++;
    this.tick(this.cost.stmt);
    if (this.us >= this.stopAt || (this.pending.length && this.irqOn && !this.inIsr)) yield SLEEP_CHECK;
    switch (s.k) {
      case "block":
        for (const x of s.body) { const r = yield* this.exec(x, f); if (r) return r; }
        return;
      case "expr": yield* this.ev(s.e, f); return;
      case "decl":
        for (const d of s.vars) {
          const box = d.slot.scope === "g" ? this.globals[d.slot.index] : (f[d.slot.index] = { v: this.initial(d.slot) });
          if (d.slot.scope === "g") { if ((box as Box & { done?: boolean }).done) continue; (box as Box & { done?: boolean }).done = true; } // static local: once
          if (d.init) box.v = this.convertInit(d.slot, yield* this.ev(d.init, f));
        }
        return;
      case "if": return (this.truthy(yield* this.ev(s.c, f))) ? yield* this.exec(s.a, f) : s.b ? yield* this.exec(s.b, f) : undefined;
      case "while":
        while (this.truthy(yield* this.ev(s.c, f))) { const r = yield* this.exec(s.body, f); if (r?.k === "break") break; if (r?.k === "return") return r; }
        return;
      case "do":
        do { const r = yield* this.exec(s.body, f); if (r?.k === "break") break; if (r?.k === "return") return r; } while (this.truthy(yield* this.ev(s.c, f)));
        return;
      case "for":
        if (s.init) yield* this.exec(s.init, f);
        while (!s.c || this.truthy(yield* this.ev(s.c, f))) {
          const r = yield* this.exec(s.body, f);
          if (r?.k === "break") break;
          if (r?.k === "return") return r;
          if (s.step) yield* this.ev(s.step, f);
          this.tick(this.cost.stmt);
        }
        return;
      case "return": return { k: "return", v: s.e ? yield* this.ev(s.e, f) : undefined };
      case "break": return { k: "break" };
      case "continue": return { k: "continue" };
      case "switch": {
        const v = yield* this.ev(s.e, f);
        let on = false;
        const idx = s.cases.findIndex((c) => c.test && this.evalSync(c.test, f) === v);
        const start = idx >= 0 ? idx : s.cases.findIndex((c) => !c.test);
        if (start < 0) return;
        for (let i = start; i < s.cases.length; i++) {
          on = true;
          for (const x of s.cases[i].body) { const r = yield* this.exec(x, f); if (r?.k === "break") return; if (r) return r; }
        }
        void on;
        return;
      }
      case "empty": return;
    }
  }

  truthy(v: Value) { return typeof v === "string" ? v.length > 0 : !!v; }

  // ---------------------------------------------------------------- expressions

  private pureCache = new WeakMap<Expr, boolean>();
  /** Expressions without user calls or waiting calls are evaluated directly (fast path). */
  private pure(e: Expr): boolean {
    const hit = this.pureCache.get(e);
    if (hit !== undefined) return hit;
    let r = true;
    const visit = (x: Expr): void => {
      if (!r) return;
      if (x.k === "call") {
        if (x.fn) { r = false; return; }
        if (!x.obj && BLOCKING.has(x.name)) { r = false; return; }
        if (x.obj && x.obj.ty.k === "obj" && isBlockingMethod(x.obj.ty.cls, x.name)) { r = false; return; }
        if (x.obj) visit(x.obj);
        x.args.forEach(visit);
        return;
      }
      for (const v of Object.values(x)) if (v && typeof v === "object" && "k" in v && "line" in v) visit(v as Expr); else if (Array.isArray(v)) v.forEach((y) => y && typeof y === "object" && "k" in y && visit(y as Expr));
    };
    visit(e);
    this.pureCache.set(e, r);
    return r;
  }

  private *ev(e: Expr, f: Box[]): Gen<Value> {
    if (this.pure(e)) return this.evalSync(e, f);
    switch (e.k) {
      case "call": {
        if (e.fn) {
          const args: (Value | Box)[] = [];
          for (let i = 0; i < e.args.length; i++) args.push(e.fn.params[i].ref ? this.ref(e.args[i], f) : yield* this.ev(e.args[i], f));
          this.tick(this.cost.stmt * 2);
          const r = yield* this.call(e.fn, args);
          return r ?? 0;
        }
        const args: Value[] = [];
        for (const a of e.args) args.push(yield* this.ev(a, f));
        return yield* this.blocking(e, args, f);
      }
      case "assign": { const v = yield* this.ev(e.value, f); return this.assign(e, v, f); }
      case "bin": {
        if (e.op === "&&") return this.truthy(yield* this.ev(e.a, f)) && this.truthy(yield* this.ev(e.b, f)) ? 1 : 0;
        if (e.op === "||") return this.truthy(yield* this.ev(e.a, f)) || this.truthy(yield* this.ev(e.b, f)) ? 1 : 0;
        const a = yield* this.ev(e.a, f); const b = yield* this.ev(e.b, f);
        return this.binop(e, a, b);
      }
      case "un": return this.unop(e, yield* this.ev(e.a, f));
      case "cond": return this.truthy(yield* this.ev(e.c, f)) ? yield* this.ev(e.a, f) : yield* this.ev(e.b, f);
      case "cast": return this.store(yield* this.ev(e.a, f), e.to);
      case "index": { const i = yield* this.ev(e.i, f); return this.indexRead(e, f, i as number); }
      case "list": { const out: number[] = []; for (const x of e.items) out.push((yield* this.ev(x, f)) as number); return out; }
      default: return this.evalSync(e, f);
    }
  }

  evalSync(e: Expr, f: Box[]): Value {
    switch (e.k) {
      case "num": return e.v;
      case "str": return e.v;
      case "sizeof": return e.bytes;
      case "list": return e.items.map((x) => this.evalSync(x, f) as number);
      case "id": {
        if (!e.slot) return e.ty.k === "obj" ? { cls: e.ty.cls, id: 0 } : 0;
        const box = e.slot.scope === "g" ? this.globals[e.slot.index] : f[e.slot.index];
        return box ? box.v : 0;
      }
      case "assign": return this.assign(e, this.evalSync(e.value, f), f);
      case "bin":
        if (e.op === "&&") return this.truthy(this.evalSync(e.a, f)) && this.truthy(this.evalSync(e.b, f)) ? 1 : 0;
        if (e.op === "||") return this.truthy(this.evalSync(e.a, f)) || this.truthy(this.evalSync(e.b, f)) ? 1 : 0;
        return this.binop(e, this.evalSync(e.a, f), this.evalSync(e.b, f));
      case "un": return this.unop(e, this.evalSync(e.a, f));
      case "upd": {
        const ref = this.ref(e.a, f);
        const old = ref.v as number;
        const nv = this.wrap(old + (e.op === "++" ? 1 : -1), e.a.ty);
        ref.v = nv;
        return e.prefix ? nv : old;
      }
      case "cond": return this.truthy(this.evalSync(e.c, f)) ? this.evalSync(e.a, f) : this.evalSync(e.b, f);
      case "cast": return this.store(this.evalSync(e.a, f), e.to);
      case "index": return this.indexRead(e, f, this.evalSync(e.i, f) as number);
      case "call": return this.builtin(e, e.args.map((a) => this.evalSync(a, f)), f);
    }
  }

  private indexRead(e: Extract<Expr, { k: "index" }>, f: Box[], i: number): Value {
    const arr = this.evalSync(e.a, f);
    if (typeof arr === "string") return i >= 0 && i < arr.length ? arr.charCodeAt(i) : 0;
    if (!Array.isArray(arr)) return 0;
    if (i < 0 || i >= arr.length) { this.hw.warn(`array index ${i} is outside the array (size ${arr.length}): on a real board this reads random memory`, e.line); return 0; }
    return arr[i];
  }

  /** A storage cell for an lvalue (variables and array elements). */
  private ref(e: Expr, f: Box[]): Box {
    if (e.k === "id" && e.slot) return e.slot.scope === "g" ? this.globals[e.slot.index] : (f[e.slot.index] ??= { v: 0 });
    if (e.k === "index") {
      const arr = this.evalSync(e.a, f);
      const i = this.evalSync(e.i, f) as number;
      if (Array.isArray(arr)) {
        if (i < 0 || i >= arr.length) { this.hw.warn(`array index ${i} is outside the array (size ${arr.length}): on a real board this overwrites other memory`, e.line); return { v: 0 }; }
        return { get v() { return arr[i]; }, set v(x: Value) { arr[i] = x as number; } };
      }
      if (e.a.k === "id" && typeof arr === "string") {
        const box = this.ref(e.a, f);
        return { get v() { return (box.v as string).charCodeAt(i) || 0; }, set v(x: Value) { const s = box.v as string; box.v = s.slice(0, i) + String.fromCharCode(x as number) + s.slice(i + 1); } };
      }
    }
    if (e.k === "id" && !e.slot) return { v: 0 };
    throw new SketchError("lvalue required", e.line);
  }

  private assign(e: Extract<Expr, { k: "assign" }>, v: Value, f: Box[]): Value {
    const ref = this.ref(e.target, f);
    let nv: Value = v;
    if (e.op !== "=") {
      const op = e.op.slice(0, -1);
      nv = this.binop({ k: "bin", op, a: e.target, b: e.value, ty: e.target.ty.k === "s" ? e.target.ty : arith(e.target.ty, e.value.ty, this.prog.target), line: e.line }, ref.v, v);
    }
    if (Array.isArray(ref.v) && Array.isArray(nv)) { ref.v = nv; return nv; }
    ref.v = this.store(nv, e.target.ty);
    return ref.v;
  }

  private binop(e: Extract<Expr, { k: "bin" }>, a: Value, b: Value): Value {
    if (e.ty.k === "s") return this.toStr(a, e.a.ty) + this.toStr(b, e.b.ty);
    if (typeof a === "string" || typeof b === "string") {
      if (e.op === "==") return a === b ? 1 : 0;
      if (e.op === "!=") return a !== b ? 1 : 0;
      return 0;
    }
    const x = a as number, y = b as number;
    // comparisons follow C: both sides converted to their common type first (so -1 < 1u is false on 32 bits)
    if (["==", "!=", "<", ">", "<=", ">="].includes(e.op)) {
      const ct = arith(e.a.ty, e.b.ty, this.prog.target);
      const p = ct.k === "int" ? this.wrap(x, ct) : x, q = ct.k === "int" ? this.wrap(y, ct) : y;
      switch (e.op) { case "==": return p === q ? 1 : 0; case "!=": return p !== q ? 1 : 0; case "<": return p < q ? 1 : 0; case ">": return p > q ? 1 : 0; case "<=": return p <= q ? 1 : 0; default: return p >= q ? 1 : 0; }
    }
    const ty = e.ty;
    if (ty.k === "f") {
      switch (e.op) { case "+": return this.wrap(x + y, ty); case "-": return this.wrap(x - y, ty); case "*": return this.wrap(x * y, ty); case "/": return this.wrap(x / y, ty); }
      return 0;
    }
    let r: number;
    switch (e.op) {
      case "+": r = x + y; break;
      case "-": r = x - y; break;
      case "*": r = ty.k === "int" && ty.bits === 32 ? Math.imul(x, y) : x * y; break;
      case "/": if (y === 0) { this.hw.warn("integer division by zero: a real board returns a meaningless number", e.line); return -1; } r = Math.trunc(x / y); break;
      case "%": if (y === 0) { this.hw.warn("modulo by zero", e.line); return 0; } r = x % y; break;
      case "&": r = x & y; break;
      case "|": r = x | y; break;
      case "^": r = x ^ y; break;
      case "<<": r = ty.k === "int" && ty.bits <= 32 ? x << y : x * 2 ** y; break;
      case ">>": r = ty.k === "int" && !ty.signed && ty.bits === 32 ? x >>> y : x >> y; break;
      default: r = 0;
    }
    return this.wrap(r, ty);
  }

  private unop(e: Extract<Expr, { k: "un" }>, a: Value): Value {
    if (typeof a !== "number") return e.op === "!" ? (this.truthy(a) ? 0 : 1) : 0;
    switch (e.op) {
      case "!": return a ? 0 : 1;
      case "-": return this.wrap(-a, e.ty);
      case "~": return this.wrap(~a, e.ty);
      default: return this.wrap(a, e.ty);
    }
  }

  // ---------------------------------------------------------------- built-ins

  toStr(v: Value, ty?: Ty, base = 10, decimals?: number): string {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return String.fromCharCode(...v.slice(0, v.indexOf(0) >= 0 ? v.indexOf(0) : v.length));
    if (typeof v !== "number") return "";
    if (ty?.k === "f" || decimals !== undefined && ty?.k !== "int") return v.toFixed(decimals ?? 2);
    if (ty?.k === "int" && ty.bits === 8 && ty.signed && base === 10 && decimals === undefined) return String.fromCharCode(v);
    if (base !== 10) return (v < 0 ? v >>> 0 : v).toString(base).toUpperCase();
    return String(v);
  }

  private rand() { // mulberry32: same numbers for the same seed
    let x = (this.seed += 0x6d2b79f5);
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  private *blocking(e: Extract<Expr, { k: "call" }>, a: Value[], f: Box[]): Gen<Value> {
    const n = (i: number) => a[i] as number;
    if (!e.obj) {
      switch (e.name) {
        case "delay": { const ms = Math.max(0, n(0)); if (ms > 0) yield ms * 1000; return 0; }
        case "delayMicroseconds": { const us = Math.max(0, n(0)); if (us > 0) yield us; return 0; }
        case "pulseIn": case "pulseInLong": {
          const r = this.hw.pulseIn(n(0), n(1), a.length > 2 ? n(2) : 1_000_000);
          if (r.waitUs > 0) yield r.waitUs;
          return r.value;
        }
      }
    } else if (e.obj.ty.k === "obj" && e.obj.ty.cls === "Serial" && isBlockingMethod("Serial", e.name)) {
      // wait for input up to the timeout, then parse what arrived
      const deadline = this.us + this.serialTimeout * 1000;
      const done = () => {
        const s = this.hw.serialInput();
        if (e.name === "readStringUntil") return s.includes(String.fromCharCode(n(0))) || s.includes(a[0] as string);
        if (e.name === "readString") return false; // reads until the timeout, as on the board
        return /-?\d/.test(s) && /[^\d.\-]/.test(s.replace(/^[^\d\-]*-?[\d.]*/, "x"));
      };
      while (!done() && this.us < deadline) yield 10_000;
      const s = this.hw.serialInput();
      if (e.name === "parseInt" || e.name === "parseFloat") {
        const m = /^[^\d\-]*(-?\d+(?:\.\d+)?)/.exec(s);
        if (!m) { this.hw.serialConsume(s.length); return 0; }
        this.hw.serialConsume(m.index + m[0].length);
        return e.name === "parseInt" ? parseInt(m[1], 10) : parseFloat(m[1]);
      }
      if (e.name === "readStringUntil") {
        const term = typeof a[0] === "string" ? a[0] : String.fromCharCode(n(0));
        const i = s.indexOf(term);
        const out = i >= 0 ? s.slice(0, i) : s;
        this.hw.serialConsume(i >= 0 ? i + term.length : s.length);
        return out;
      }
      this.hw.serialConsume(s.length);
      return s;
    }
    return this.builtin(e, a, f);
  }

  private builtin(e: Extract<Expr, { k: "call" }>, a: Value[], f: Box[]): Value {
    const n = (i: number) => a[i] as number;
    const hw = this.hw;
    if (e.obj) {
      if (e.obj.ty.k === "s") {
        const ref = e.obj.k === "id" || e.obj.k === "index" ? this.ref(e.obj, f) : { v: this.evalSync(e.obj, f) };
        const s = String(ref.v);
        switch (e.name) {
          case "length": return s.length;
          case "toInt": return parseInt(s, 10) || 0;
          case "toFloat": return parseFloat(s) || 0;
          case "indexOf": return s.indexOf(typeof a[0] === "string" ? a[0] : String.fromCharCode(n(0)), a.length > 1 ? n(1) : 0);
          case "substring": return s.substring(n(0), a.length > 1 ? n(1) : undefined);
          case "trim": ref.v = s.trim(); return 0;
          case "equals": return s === a[0] ? 1 : 0;
          case "charAt": return s.charCodeAt(n(0)) || 0;
          case "startsWith": return s.startsWith(String(a[0])) ? 1 : 0;
          case "endsWith": return s.endsWith(String(a[0])) ? 1 : 0;
          case "toUpperCase": ref.v = s.toUpperCase(); return 0;
          case "toLowerCase": ref.v = s.toLowerCase(); return 0;
          case "concat": ref.v = s + this.toStr(a[0], e.args[0].ty); return 1;
          case "c_str": return s;
        }
        return 0;
      }
      const obj = this.evalSync(e.obj, f) as { cls: string; id: number };
      if (obj.cls === "Serial") {
        switch (e.name) {
          case "begin": case "end": case "flush": return 0;
          case "setTimeout": this.serialTimeout = n(0); return 0;
          case "print": case "println": {
            const text = a.length ? this.toStr(a[0], e.args[0].ty, a.length > 1 && e.args[0].ty.k === "int" ? n(1) : 10, a.length > 1 && e.args[0].ty.k === "f" ? n(1) : undefined) : "";
            const out = e.name === "println" ? text + "\r\n" : text;
            hw.serialWrite(out);
            return out.length;
          }
          case "write": { const text = typeof a[0] === "string" ? a[0] : String.fromCharCode(n(0) & 0xff); hw.serialWrite(text); return text.length; }
          case "available": return hw.serialInput().length;
          case "read": { const s = hw.serialInput(); if (!s.length) return -1; hw.serialConsume(1); return s.charCodeAt(0); }
          case "peek": { const s = hw.serialInput(); return s.length ? s.charCodeAt(0) : -1; }
        }
        return 0;
      }
      if (obj.cls === "LiquidCrystal_I2C") {
        if (e.name === "print") { const text = this.toStr(a[0], e.args[0].ty, a.length > 1 && e.args[0].ty.k === "int" ? n(1) : 10, a.length > 1 && e.args[0].ty.k === "f" ? n(1) : undefined); hw.lcd(obj.id, "print", undefined, undefined, text); return text.length; }
        if (e.name === "setCursor") { hw.lcd(obj.id, "setCursor", n(0), n(1)); return 0; }
        hw.lcd(obj.id, e.name);
        this.tick(this.cost.io * 50); // I2C writes are slow: about 0.2 ms per command
        return 0;
      }
      if (obj.cls === "Wire") return 0;
      if (obj.cls === "Servo") {
        const st = this.servoState(obj.id);
        switch (e.name) {
          case "attach": st.pin = n(0); hw.servoAttach(obj.id, n(0)); return 1;
          case "detach": st.pin = -1; hw.servoDetach(obj.id); return 0;
          case "write": { const v = n(0); st.angle = v > 180 ? Math.max(0, Math.min(180, ((v - 544) / (2400 - 544)) * 180)) : Math.max(0, Math.min(180, v)); hw.servoWrite(obj.id, st.angle); return 0; }
          case "writeMicroseconds": st.angle = Math.max(0, Math.min(180, ((n(0) - 544) / (2400 - 544)) * 180)); hw.servoWrite(obj.id, st.angle); return 0;
          case "read": return Math.round(st.angle);
          case "attached": return st.pin >= 0 ? 1 : 0;
        }
      }
      return 0;
    }
    switch (e.name) {
      case "pinMode": hw.pinMode(n(0), n(1)); this.tick(this.cost.io); return 0;
      case "digitalWrite": hw.digitalWrite(n(0), n(1) ? 1 : 0); this.tick(this.cost.io); return 0;
      case "digitalRead": this.tick(this.cost.io); return hw.digitalRead(n(0));
      case "analogRead": this.tick(this.cost.adc); return hw.analogRead(n(0));
      case "analogWrite": hw.analogWrite(n(0), Math.max(0, Math.min(255, n(1)))); this.tick(this.cost.io); return 0;
      case "analogReadResolution": return 0;
      case "millis": return Math.floor((this.us - this.startUs) / 1000) >>> 0;
      case "micros": return Math.floor(this.us - this.startUs) >>> 0;
      case "tone": hw.tone(n(0), n(1), a.length > 2 ? n(2) : undefined); return 0;
      case "noTone": hw.noTone(n(0)); return 0;
      case "map": {
        const [x, i0, i1, o0, o1] = a as number[];
        if (i1 === i0) { hw.warn("map(): the input range is empty (division by zero)", e.line); return -1; }
        return this.wrap(Math.trunc(((x - i0) * (o1 - o0)) / (i1 - i0)) + o0, e.ty);
      }
      case "constrain": return Math.min(Math.max(n(0), n(1)), n(2));
      case "min": return Math.min(n(0), n(1));
      case "max": return Math.max(n(0), n(1));
      case "abs": return this.wrap(Math.abs(n(0)), e.ty);
      case "sq": return this.wrap(n(0) * n(0), e.ty);
      case "sqrt": return Math.sqrt(n(0));
      case "pow": return Math.pow(n(0), n(1));
      case "sin": return Math.sin(n(0));
      case "cos": return Math.cos(n(0));
      case "tan": return Math.tan(n(0));
      case "atan2": return Math.atan2(n(0), n(1));
      case "floor": return Math.floor(n(0));
      case "ceil": return Math.ceil(n(0));
      case "round": return Math.round(n(0));
      case "fabs": return Math.abs(n(0));
      case "random": { const lo = a.length > 1 ? n(0) : 0, hi = a.length > 1 ? n(1) : n(0); return hi <= lo ? lo : lo + Math.floor(this.rand() * (hi - lo)); }
      case "randomSeed": this.seed = n(0) | 0 || 1; return 0;
      case "digitalPinToInterrupt": return hw.interruptPin(n(0));
      case "attachInterrupt": {
        const fnName = e.args[1].k === "id" ? e.args[1].name : "";
        const fn = this.prog.funcs.get(fnName);
        if (!fn) throw new SketchError(`'${fnName}' is not a function`, e.line);
        this.isr.set(n(0), { fn, mode: n(2) });
        return 0;
      }
      case "detachInterrupt": this.isr.delete(n(0)); return 0;
      case "interrupts": this.irqOn = true; return 0;
      case "noInterrupts": this.irqOn = false; return 0;
      case "bitRead": return (n(0) >> n(1)) & 1;
      case "bit": return 2 ** n(0);
      case "lowByte": return n(0) & 0xff;
      case "highByte": return (n(0) >> 8) & 0xff;
      case "isDigit": return n(0) >= 48 && n(0) <= 57 ? 1 : 0;
      case "yield": return 0;
      case "String": {
        if (!a.length) return "";
        return this.toStr(a[0], e.args[0].ty, a.length > 1 && e.args[0].ty.k === "int" ? n(1) : 10, a.length > 1 && e.args[0].ty.k === "f" ? n(1) : undefined);
      }
    }
    throw new SketchError(`'${e.name}' is not available in the simulator`, e.line);
  }

  private servoStates = new Map<number, { pin: number; angle: number }>();
  private servoState(id: number) { let s = this.servoStates.get(id); if (!s) { s = { pin: -1, angle: 90 }; this.servoStates.set(id, s); } return s; }
}
