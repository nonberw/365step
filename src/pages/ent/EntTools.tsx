import { useState, type ReactNode } from "react";
import { Calculator, FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";

// The ENT testing program has a built-in calculator and a periodic table for the whole test.

function Panel({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div
      role="dialog"
      aria-label={title}
      className={cn(
        "fixed inset-x-2 bottom-2 z-40 flex max-h-[80dvh] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-border sm:inset-x-auto sm:right-4 sm:bottom-4",
        wide ? "sm:w-[880px] sm:max-w-[calc(100vw-2rem)]" : "sm:w-80",
      )}
    >
      <div className="flex items-center justify-between bg-secondary px-4 py-2 text-secondary-foreground">
        <span className="font-display text-sm font-semibold">{title}</span>
        <button type="button" aria-label="Закрыть" onClick={onClose} className="grid size-7 place-items-center rounded-full hover:bg-white/15">
          <X className="size-4" />
        </button>
      </div>
      <div className="overflow-auto p-3">{children}</div>
    </div>
  );
}

// ---------- calculator: a small expression parser, no eval ----------

function evaluate(src: string): number {
  const s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
  let i = 0;
  const peek = () => s[i];
  const num = (): number => {
    if (peek() === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") throw new Error("Скобка");
      i++;
      return v;
    }
    if (s.startsWith("√", i)) {
      i++;
      return Math.sqrt(factor());
    }
    if (peek() === "-") {
      i++;
      return -factor();
    }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) throw new Error("Ошибка");
    i += m[0].length;
    return Number(m[0]);
  };
  const factor = (): number => {
    let v = num();
    while (peek() === "^") {
      i++;
      v = Math.pow(v, num());
    }
    if (peek() === "%") {
      i++;
      v /= 100;
    }
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const v = expr();
  if (i !== s.length || !Number.isFinite(v)) throw new Error("Ошибка");
  return v;
}

export function EntCalculator({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "^", "+", "(", ")", "√", "%"];
  const calc = () => {
    try {
      setResult(String(Math.round(evaluate(input) * 1e10) / 1e10));
    } catch {
      setResult("Ошибка");
    }
  };
  return (
    <Panel title="Калькулятор" onClose={onClose}>
      <div className="mb-3 rounded-xl bg-muted px-3 py-2 text-right font-mono">
        <div className="min-h-6 break-all text-sm text-muted-foreground">{input || "0"}</div>
        <div className="min-h-8 text-2xl font-semibold tabular">{result}</div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setInput((v) => v + k)}
            className={cn("h-11 rounded-lg font-display text-lg font-semibold", /[0-9.]/.test(k) ? "bg-muted hover:bg-muted/70" : "bg-secondary/10 hover:bg-secondary/20")}
          >
            {k}
          </button>
        ))}
        <button type="button" onClick={() => (setInput(""), setResult(""))} className="col-span-2 h-11 rounded-lg bg-muted font-display font-semibold hover:bg-muted/70">
          C
        </button>
        <button type="button" onClick={calc} className="col-span-2 h-11 rounded-lg bg-primary font-display text-lg font-semibold text-primary-foreground">
          =
        </button>
      </div>
    </Panel>
  );
}

// ---------- periodic table: relative atomic masses rounded as in school tables ----------

const ELEMENTS =
  "H 1|He 4|Li 7|Be 9|B 11|C 12|N 14|O 16|F 19|Ne 20|Na 23|Mg 24|Al 27|Si 28|P 31|S 32|Cl 35.5|Ar 40|K 39|Ca 40|Sc 45|Ti 48|V 51|Cr 52|Mn 55|Fe 56|Co 59|Ni 59|Cu 64|Zn 65|Ga 70|Ge 73|As 75|Se 79|Br 80|Kr 84|Rb 85.5|Sr 88|Y 89|Zr 91|Nb 93|Mo 96|Tc 98|Ru 101|Rh 103|Pd 106|Ag 108|Cd 112|In 115|Sn 119|Sb 122|Te 128|I 127|Xe 131|Cs 133|Ba 137|La 139|Ce 140|Pr 141|Nd 144|Pm 145|Sm 150|Eu 152|Gd 157|Tb 159|Dy 162.5|Ho 165|Er 167|Tm 169|Yb 173|Lu 175|Hf 178.5|Ta 181|W 184|Re 186|Os 190|Ir 192|Pt 195|Au 197|Hg 201|Tl 204|Pb 207|Bi 209|Po 209|At 210|Rn 222|Fr 223|Ra 226|Ac 227|Th 232|Pa 231|U 238|Np 237|Pu 244|Am 243|Cm 247|Bk 247|Cf 251|Es 252|Fm 257|Md 258|No 259|Lr 262|Rf 267|Db 268|Sg 269|Bh 270|Hs 269|Mt 278|Ds 281|Rg 282|Cn 285|Nh 286|Fl 289|Mc 290|Lv 293|Ts 294|Og 294"
    .split("|")
    .map((e, i) => {
      const [sym, mass] = e.split(" ");
      return { z: i + 1, sym: sym!, mass: mass! };
    });

/** Row and column of each element in the 18-column table; lanthanides and actinides go to rows 9–10. */
function place(z: number): [number, number] {
  if (z === 1) return [1, 1];
  if (z === 2) return [1, 18];
  const periods = [
    [3, 10, 2],
    [11, 18, 3],
    [19, 36, 4],
    [37, 54, 5],
    [55, 86, 6],
    [87, 118, 7],
  ] as const;
  for (const [a, b, p] of periods) {
    if (z < a || z > b) continue;
    const k = z - a;
    if (p <= 3) return [p, k < 2 ? k + 1 : k + 11];
    if (p <= 5) return [p, k + 1];
    if (k < 2) return [p, k + 1];
    if (k < 17) return [p === 6 ? 9 : 10, k + 2];
    return [p, k - 13];
  }
  return [1, 1];
}

const FAMILY = (z: number) =>
  [1, 6, 7, 8, 15, 16, 34].includes(z)
    ? "bg-[#e8f3ea]"
    : [2, 10, 18, 36, 54, 86, 118].includes(z)
      ? "bg-[#ece8f6]"
      : [9, 17, 35, 53, 85, 117].includes(z)
        ? "bg-[#fff2d6]"
        : [3, 11, 19, 37, 55, 87].includes(z)
          ? "bg-[#fde3e1]"
          : "bg-muted";

export function PeriodicTable({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="Периодическая таблица химических элементов" onClose={onClose} wide>
      <div className="grid min-w-[760px] gap-0.5" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))", gridTemplateRows: "repeat(7, auto) 10px repeat(2, auto)" }}>
        {ELEMENTS.map((e) => {
          const [r, c] = place(e.z);
          return (
            <div key={e.z} style={{ gridRow: r, gridColumn: c }} className={cn("rounded px-1 py-0.5 text-[10px] leading-tight", FAMILY(e.z))} title={`${e.sym}, Z = ${e.z}, Ar ≈ ${e.mass}`}>
              <div className="text-muted-foreground">{e.z}</div>
              <div className="font-display text-sm font-bold">{e.sym}</div>
              <div className="tabular text-muted-foreground">{e.mass}</div>
            </div>
          );
        })}
        <div style={{ gridRow: 6, gridColumn: 3 }} className="grid place-items-center rounded bg-muted/40 text-[9px] text-muted-foreground">
          57–71
        </div>
        <div style={{ gridRow: 7, gridColumn: 3 }} className="grid place-items-center rounded bg-muted/40 text-[9px] text-muted-foreground">
          89–103
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Под символом — относительная атомная масса, округлённая как в школьных таблицах.</p>
    </Panel>
  );
}

export function useEntTools() {
  const [open, setOpen] = useState<"calc" | "table" | null>(null);
  const toggle = (k: "calc" | "table") => setOpen(open === k ? null : k);
  const buttons = (
    <>
      <button
        type="button"
        onClick={() => toggle("calc")}
        className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", open === "calc" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
      >
        <Calculator className="size-4" /> Калькулятор
      </button>
      <button
        type="button"
        onClick={() => toggle("table")}
        className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", open === "table" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
      >
        <FlaskConical className="size-4" /> Таблица Менделеева
      </button>
    </>
  );
  const panels = open === "calc" ? <EntCalculator onClose={() => setOpen(null)} /> : open === "table" ? <PeriodicTable onClose={() => setOpen(null)} /> : null;
  return { buttons, panels };
}
