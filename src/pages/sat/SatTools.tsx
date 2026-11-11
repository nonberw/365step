import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BookOpenCheck, Calculator, Lightbulb, X, ExternalLink } from "lucide-react";
import { api } from "@/api";
import { cn } from "@/lib/utils";
import { Inline, RichText } from "@/components/RichText";

// Bluebook-style tools: the Desmos graphing calculator (the same calculator the
// Digital SAT uses, embedded from desmos.com), the math reference sheet and an AI hint.

export function ToolButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors [&_svg]:size-5", active ? "bg-secondary text-secondary-foreground" : "hover:bg-muted")}>
      {icon}
      {label}
    </button>
  );
}

/** Both official public calculators, kept alive while hidden or switching modes. */
export function DesmosPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const id = useId();
  const [mode, setMode] = useState<"graphing" | "scientific">("graphing");
  const [scientificMounted, setScientificMounted] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;
  return (
    <div
      className={cn("flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card", !open && "hidden")}
      role="region"
      aria-label={"Desmos calculator"}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-1 border-b border-border bg-muted/60 p-2">
        <div className="flex gap-0.5 rounded-xl border border-border bg-background p-0.5" role="tablist" aria-label={"Desmos mode"}>
          {(["graphing", "scientific"] as const).map((value) => (
            <button key={value} type="button" role="tab" id={`${id}-${value}-tab`} aria-selected={mode === value} aria-controls={`${id}-${value}`} onClick={() => { setMode(value); if (value === "scientific") setScientificMounted(true); }} className={cn("rounded-lg px-2 py-1.5 text-xs font-semibold sm:px-3", mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {value === "graphing" ? "Graphing" : "Scientific"}
            </button>
          ))}
        </div>
        <span className="flex gap-0.5">
          <a href={`https://www.desmos.com/${mode === "graphing" ? "calculator" : "scientific"}?lang=en`} target="_blank" rel="noreferrer" aria-label={"Open Desmos in a new tab"} title={"Open Desmos in a new tab"} className="grid size-7 place-items-center rounded-full hover:bg-muted">
            <ExternalLink className="size-4" />
          </a>
          <button type="button" aria-label={"Close calculator"} onClick={onClose} className="grid size-7 place-items-center rounded-full hover:bg-muted">
            <X className="size-4" />
          </button>
        </span>
      </div>
      <div id={`${id}-graphing`} role="tabpanel" aria-labelledby={`${id}-graphing-tab`} className={cn("min-h-0 flex-1", mode !== "graphing" && "hidden")}>
        <iframe title="Desmos Graphing" src="https://www.desmos.com/calculator?lang=en" className="h-full w-full border-0 bg-white" allow="clipboard-write" />
      </div>
      {scientificMounted && <div id={`${id}-scientific`} role="tabpanel" aria-labelledby={`${id}-scientific-tab`} className={cn("min-h-0 flex-1", mode !== "scientific" && "hidden")}>
        <iframe title="Desmos Scientific" src="https://www.desmos.com/scientific?lang=en" className="h-full w-full border-0 bg-white" allow="clipboard-write" />
      </div>}
    </div>
  );
}

/** Opening Desmos reserves space on the left; content always remains on the right.
 * The two panes scroll independently. Phones use two rows in the same workspace. */
export function CalculatorWorkspace({ open, onClose, children, fill = false, className }: { open: boolean; onClose: () => void; children: ReactNode; fill?: boolean; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(480);
  useLayoutEffect(() => {
    if (!open || fill) return;
    const measure = () => {
      if (root.current) setHeight(Math.max(300, Math.floor(innerHeight - root.current.getBoundingClientRect().top - 24)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, fill]);
  return (
    <div ref={root} data-calculator-open={open} className={cn("min-w-0", open && "grid min-h-0 grid-rows-2 gap-4 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,0.58fr)] lg:grid-rows-1", open && fill && "h-full")} style={open && !fill ? { height } : undefined}>
      <div className={cn("min-h-0 min-w-0", !open && "hidden")}>
        <DesmosPanel open={open} onClose={onClose} />
      </div>
      <div className={cn("min-w-0", open && "min-h-0 overflow-y-auto rounded-2xl border border-border p-3 sm:p-4", className)}>{children}</div>
    </div>
  );
}

const FORMULAS: { label: string; f: string; fig: React.ReactNode }[] = [
  { label: "Circle", f: "A = \\pi r^2 \\quad C = 2\\pi r", fig: <><circle cx="40" cy="40" r="28" /><line x1="40" y1="40" x2="68" y2="40" /><text x="50" y="36">r</text></> },
  { label: "Rectangle", f: "A = \\ell w", fig: <><rect x="10" y="22" width="60" height="36" /><text x="38" y="70">ℓ</text><text x="74" y="44">w</text></> },
  { label: "Triangle", f: "A = \\tfrac{1}{2}bh", fig: <><polygon points="10,62 70,62 46,16" /><line x1="46" y1="16" x2="46" y2="62" strokeDasharray="3 3" /><text x="38" y="74">b</text><text x="50" y="44">h</text></> },
  { label: "Pythagorean theorem", f: "c^2 = a^2 + b^2", fig: <><polygon points="14,62 66,62 14,18" /><rect x="14" y="54" width="8" height="8" /><text x="36" y="74">a</text><text x="2" y="44">b</text><text x="44" y="36">c</text></> },
  { label: "Special right triangles", f: "30°\\text{-}60°\\text{-}90°:\\ x,\\ x\\sqrt{3},\\ 2x \\qquad 45°\\text{-}45°\\text{-}90°:\\ s,\\ s,\\ s\\sqrt{2}", fig: <><polygon points="10,62 70,62 10,22" /><text x="14" y="58">90°</text><text x="52" y="58">30°</text><text x="12" y="34">60°</text></> },
  { label: "Rectangular prism", f: "V = \\ell w h", fig: <><rect x="12" y="28" width="44" height="34" /><polyline points="12,28 26,16 70,16 56,28" fill="none" /><polyline points="70,16 70,50 56,62" fill="none" /></> },
  { label: "Cylinder", f: "V = \\pi r^2 h", fig: <><ellipse cx="40" cy="18" rx="22" ry="7" /><line x1="18" y1="18" x2="18" y2="60" /><line x1="62" y1="18" x2="62" y2="60" /><path d="M18 60a22 7 0 0 0 44 0" /></> },
  { label: "Sphere", f: "V = \\tfrac{4}{3}\\pi r^3", fig: <><circle cx="40" cy="40" r="26" /><ellipse cx="40" cy="40" rx="26" ry="8" strokeDasharray="3 3" /></> },
  { label: "Cone", f: "V = \\tfrac{1}{3}\\pi r^2 h", fig: <><ellipse cx="40" cy="60" rx="24" ry="7" /><line x1="16" y1="60" x2="40" y2="12" /><line x1="64" y1="60" x2="40" y2="12" /></> },
  { label: "Pyramid", f: "V = \\tfrac{1}{3}\\ell w h", fig: <><polygon points="12,60 52,60 68,46 28,46" /><line x1="12" y1="60" x2="40" y2="12" /><line x1="52" y1="60" x2="40" y2="12" /><line x1="68" y1="46" x2="40" y2="12" /></> },
];

/** The Digital SAT math reference sheet: the same facts students get on test day. */
export function ReferenceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-3" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-card p-5 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={"Math reference sheet"}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Math reference sheet</h2>
          <button type="button" aria-label={"Close reference sheet"} onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FORMULAS.map((x) => (
            <div key={x.label} className="flex items-center gap-4 rounded-2xl border border-border p-3">
              <svg viewBox="0 0 80 80" className="size-16 shrink-0 fill-none stroke-foreground [&_text]:fill-foreground [&_text]:stroke-none [&_text]:text-[10px]" strokeWidth="1.5" aria-hidden="true">
                {x.fig}
              </svg>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{x.label}</p>
                <Inline text={`$${x.f}$`} />
              </div>
            </div>
          ))}
        </div>
        <RichText
          className="mt-4 rounded-2xl bg-muted/60 p-4 text-sm"
          text={"The number of degrees of arc in the circle is $360$. The number of radians of arc in the circle is $2\\pi$. The sum of the triangle angles is $180°$."}
        />
      </div>
    </div>
  );
}

export function HintBox({ questionId, math = false }: { questionId: string; math?: boolean }) {
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setHint(""), [questionId]);
  async function load() {
    setBusy(true);
    try {
      setHint((await api<{ hint: string }>("/sat/hint", { body: { id: questionId } })).hint);
    } catch (e) {
      setHint((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (hint) {
    return (
      <div className="rounded-2xl border border-accent/60 bg-accent/10 p-4 text-sm">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-accent-foreground">
          <Lightbulb className="size-4 text-accent" /> AI hint (without the answer)
        </p>
        <RichText text={hint} math={math} />
      </div>
    );
  }
  return (
    <button type="button" onClick={load} disabled={busy} className="inline-flex items-center gap-1.5 self-start rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
      <Lightbulb className="size-3.5 text-accent" /> {busy ? "Thinking…" : "Hint"}
    </button>
  );
}

export function useSatTools() {
  const [desmos, setDesmos] = useState(false);
  const [sheet, setSheet] = useState(false);
  const buttons = (
    <>
      <ToolButton icon={<Calculator />} label="Desmos" active={desmos} onClick={() => setDesmos(!desmos)} />
      <ToolButton icon={<BookOpenCheck />} label={"Reference sheet"} active={sheet} onClick={() => setSheet(true)} />
    </>
  );
  const panels = (
    <ReferenceSheet open={sheet} onClose={() => setSheet(false)} />
  );
  return { buttons, panels, desmosOpen: desmos, closeDesmos: () => setDesmos(false) };
}
