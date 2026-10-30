import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { BookOpenCheck, Calculator, Expand, Lightbulb, Minimize2, X, ExternalLink } from "lucide-react";
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

/** Floating, draggable and resizable Desmos window; full screen on phones. */
export function DesmosPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pos, setPos] = useState({ x: 24, y: 96 });
  const [size, setSize] = useState({ w: 460, h: 560 });
  const [big, setBig] = useState(false);
  const drag = useRef<{ dx: number; dy: number; mode: "move" | "resize"; w: number; h: number; sx: number; sy: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  function down(e: RPointerEvent, mode: "move" | "resize") {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, mode, w: size.w, h: size.h, sx: e.clientX, sy: e.clientY };
  }
  function move(e: RPointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "move") setPos({ x: Math.max(0, Math.min(innerWidth - 120, e.clientX - d.dx)), y: Math.max(0, Math.min(innerHeight - 60, e.clientY - d.dy)) });
    else setSize({ w: Math.max(320, d.w + e.clientX - d.sx), h: Math.max(360, d.h + e.clientY - d.sy) });
  }

  // Keep the iframe alive once opened so graphs survive closing and reopening.
  if (!mounted) return null;
  const mobile = typeof window !== "undefined" && innerWidth < 768;
  const full = mobile || big;
  return (
    <div
      className={cn("fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl", !open && "hidden", full && "inset-2 sm:inset-6")}
      style={full ? undefined : { left: pos.x, top: pos.y, width: size.w, height: size.h }}
      role="dialog"
      aria-label="Графический калькулятор Desmos"
    >
      <div className="flex cursor-move touch-none items-center justify-between gap-2 bg-secondary px-3 py-2 text-secondary-foreground" onPointerDown={(e) => !full && down(e, "move")} onPointerMove={move} onPointerUp={() => (drag.current = null)}>
        <span className="flex items-center gap-2 font-display text-sm font-semibold">
          <Calculator className="size-4" /> Desmos
        </span>
        <span className="flex gap-1">
          <a href="https://www.desmos.com/calculator?lang=ru" target="_blank" rel="noreferrer" aria-label="Открыть Desmos в новой вкладке" title="Если калькулятор не загрузился — открой в новой вкладке" className="grid size-7 place-items-center rounded-full hover:bg-white/15">
            <ExternalLink className="size-4" />
          </a>
          {!mobile && (
            <button type="button" aria-label={big ? "Обычный размер" : "Развернуть"} onClick={() => setBig(!big)} className="grid size-7 place-items-center rounded-full hover:bg-white/15">
              {big ? <Minimize2 className="size-4" /> : <Expand className="size-4" />}
            </button>
          )}
          <button type="button" aria-label="Закрыть калькулятор" onClick={onClose} className="grid size-7 place-items-center rounded-full hover:bg-white/15">
            <X className="size-4" />
          </button>
        </span>
      </div>
      <iframe title="Desmos" src="https://www.desmos.com/calculator?lang=ru" className="min-h-0 flex-1 bg-white" allow="clipboard-write" />
      {!full && <div className="absolute bottom-0 right-0 size-5 cursor-se-resize touch-none bg-[linear-gradient(135deg,transparent_50%,var(--muted-foreground)_50%)] opacity-60" onPointerDown={(e) => down(e, "resize")} onPointerMove={move} onPointerUp={() => (drag.current = null)} aria-hidden="true" />}
    </div>
  );
}

const FORMULAS: { label: string; f: string; fig: React.ReactNode }[] = [
  { label: "Круг", f: "A = \\pi r^2 \\quad C = 2\\pi r", fig: <><circle cx="40" cy="40" r="28" /><line x1="40" y1="40" x2="68" y2="40" /><text x="50" y="36">r</text></> },
  { label: "Прямоугольник", f: "A = \\ell w", fig: <><rect x="10" y="22" width="60" height="36" /><text x="38" y="70">ℓ</text><text x="74" y="44">w</text></> },
  { label: "Треугольник", f: "A = \\tfrac{1}{2}bh", fig: <><polygon points="10,62 70,62 46,16" /><line x1="46" y1="16" x2="46" y2="62" strokeDasharray="3 3" /><text x="38" y="74">b</text><text x="50" y="44">h</text></> },
  { label: "Теорема Пифагора", f: "c^2 = a^2 + b^2", fig: <><polygon points="14,62 66,62 14,18" /><rect x="14" y="54" width="8" height="8" /><text x="36" y="74">a</text><text x="2" y="44">b</text><text x="44" y="36">c</text></> },
  { label: "Особые треугольники", f: "30°\\text{-}60°\\text{-}90°:\\ x,\\ x\\sqrt{3},\\ 2x \\qquad 45°\\text{-}45°\\text{-}90°:\\ s,\\ s,\\ s\\sqrt{2}", fig: <><polygon points="10,62 70,62 10,22" /><text x="14" y="58">90°</text><text x="52" y="58">30°</text><text x="12" y="34">60°</text></> },
  { label: "Прямоугольный параллелепипед", f: "V = \\ell w h", fig: <><rect x="12" y="28" width="44" height="34" /><polyline points="12,28 26,16 70,16 56,28" fill="none" /><polyline points="70,16 70,50 56,62" fill="none" /></> },
  { label: "Цилиндр", f: "V = \\pi r^2 h", fig: <><ellipse cx="40" cy="18" rx="22" ry="7" /><line x1="18" y1="18" x2="18" y2="60" /><line x1="62" y1="18" x2="62" y2="60" /><path d="M18 60a22 7 0 0 0 44 0" /></> },
  { label: "Шар", f: "V = \\tfrac{4}{3}\\pi r^3", fig: <><circle cx="40" cy="40" r="26" /><ellipse cx="40" cy="40" rx="26" ry="8" strokeDasharray="3 3" /></> },
  { label: "Конус", f: "V = \\tfrac{1}{3}\\pi r^2 h", fig: <><ellipse cx="40" cy="60" rx="24" ry="7" /><line x1="16" y1="60" x2="40" y2="12" /><line x1="64" y1="60" x2="40" y2="12" /></> },
  { label: "Пирамида", f: "V = \\tfrac{1}{3}\\ell w h", fig: <><polygon points="12,60 52,60 68,46 28,46" /><line x1="12" y1="60" x2="40" y2="12" /><line x1="52" y1="60" x2="40" y2="12" /><line x1="68" y1="46" x2="40" y2="12" /></> },
];

/** The Digital SAT math reference sheet: the same facts students get on test day. */
export function ReferenceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-3" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-card p-5 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Справочник формул">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Справочник формул</h2>
          <button type="button" aria-label="Закрыть справочник" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-muted">
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
          text={"Количество градусов дуги в окружности — $360$. Количество радиан дуги в окружности — $2\\pi$. Сумма углов треугольника — $180°$."}
        />
      </div>
    </div>
  );
}

export function HintBox({ questionId }: { questionId: string }) {
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
          <Lightbulb className="size-4 text-accent" /> Подсказка ИИ (без ответа)
        </p>
        <RichText text={hint} />
      </div>
    );
  }
  return (
    <button type="button" onClick={load} disabled={busy} className="inline-flex items-center gap-1.5 self-start rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
      <Lightbulb className="size-3.5 text-accent" /> {busy ? "Думаю…" : "Подсказка"}
    </button>
  );
}

export function useSatTools() {
  const [desmos, setDesmos] = useState(false);
  const [sheet, setSheet] = useState(false);
  const buttons = (
    <>
      <ToolButton icon={<Calculator />} label="Desmos" active={desmos} onClick={() => setDesmos(!desmos)} />
      <ToolButton icon={<BookOpenCheck />} label="Формулы" active={sheet} onClick={() => setSheet(true)} />
    </>
  );
  const panels = (
    <>
      <DesmosPanel open={desmos} onClose={() => setDesmos(false)} />
      <ReferenceSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
  return { buttons, panels };
}
