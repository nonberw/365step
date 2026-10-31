import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimationControls, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";

/** macOS Dock from 21st.dev: cursor distance drives per-icon size (44→56px raised-cosine springs),
 *  a tooltip chip sits above the hovered tool, icons bounce on click and cast a soft floor reflection,
 *  running apps get a dot, and a ⌘K slot at the end opens a small command menu.
 *  Items, commands and the tile colors are passed in, so the dock can navigate the app. */

const EASE = [0.16, 1, 0.3, 1] as const;
const FAR = 99999;
const REST = 44;
const PEAK = 56;
const RADIUS = 110;
/** Apple's icon grid: the squircle covers ~82% of its tile. */
const PLATE = "82%";
const ICON_SHADOW = "drop-shadow(0 6px 10px var(--card-shadow, rgba(0,0,0,0.35))) drop-shadow(0 2px 3px var(--card-shadow, rgba(0,0,0,0.25)))";

export type DockApp = {
  id: string;
  label: string;
  /** any node — an <img>, an svg, or a <DockTile> */
  icon: ReactNode;
};

export type DockCommand = { label: string; key: string; run?: () => void };

/** Gradient app tile, lit top-left and settling into the brand color. */
export function DockTile({ c, children }: { c: [number, number, number]; children: ReactNode }) {
  const up = c.map((v) => Math.min(255, v + 38)).join(",");
  const dn = c.map((v) => Math.max(0, v - 46)).join(",");
  return (
    <span aria-hidden className="flex h-full w-full items-center justify-center">
      <span
        className="flex items-center justify-center rounded-[22%] text-white [&_svg]:size-[18px]"
        style={{ width: PLATE, height: PLATE, background: `linear-gradient(145deg, rgb(${up}) 0%, rgb(${c.join(",")}) 55%, rgb(${dn}) 100%)` }}
      >
        {children}
      </span>
    </span>
  );
}

function DockItem({
  mouseX,
  reduce,
  label,
  hovered,
  active = false,
  onEnter,
  onClick,
  children,
}: {
  mouseX: MotionValue<number>;
  reduce: boolean;
  label: string;
  hovered: boolean;
  active?: boolean;
  onEnter: () => void;
  onClick?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const dist = useTransform(mouseX, (x: number) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? x - (r.x + r.width / 2) : FAR;
  });
  // raised-cosine bell over the influence window: neighbors ease in and out of the peak
  const raw = useTransform(dist, (d: number) => {
    const t = Math.min(1, Math.abs(d) / RADIUS);
    return REST + (PEAK - REST) * ((1 + Math.cos(Math.PI * t)) / 2);
  });
  const size = useSpring(raw, { mass: 0.1, stiffness: 240, damping: 18 });
  const bounce = useAnimationControls();
  const click = () => {
    if (!reduce) void bounce.start({ y: [0, -12, 0], transition: { duration: 0.4, ease: EASE } });
    onClick?.();
  };

  return (
    <button ref={ref} aria-label={label} onMouseEnter={onEnter} onFocus={onEnter} onClick={click} className="relative flex flex-col items-center outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <motion.span animate={bounce} style={{ width: reduce ? REST : size, height: reduce ? REST : size, filter: ICON_SHADOW }} className="relative z-10 block overflow-hidden rounded-[10px]">
        {children}
      </motion.span>
      {active && <span aria-hidden className="absolute -bottom-[1px] left-1/2 z-10 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-foreground/80" />}
      <motion.span
        aria-hidden
        style={{ width: reduce ? REST : size, height: reduce ? REST * 0.5 : size }}
        className="pointer-events-none absolute left-1/2 top-full mt-[3px] -translate-x-1/2 overflow-hidden rounded-[10px] opacity-25 [transform:translateX(-50%)_scaleY(-1)] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.5),transparent_65%)]"
      >
        {children}
      </motion.span>
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, y: 10, scaleY: 0.5, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scaleY: 1, x: "-50%" }}
            exit={{ opacity: 0, y: 10, scaleY: 0.5, x: "-50%" }}
            transition={{ duration: 0.22, ease: EASE }}
            style={{ transformOrigin: "bottom center", background: "var(--surface, var(--card))" }}
            className="pointer-events-none absolute -top-9 left-1/2 z-20 whitespace-nowrap rounded-md border border-foreground/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/70 shadow-[0_8px_24px_var(--card-shadow,rgba(0,0,0,0.25))]"
          >
            {label}
            <span aria-hidden className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-foreground/[0.06]" style={{ background: "var(--surface, var(--card))" }} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export default function MacOsDock({
  items,
  commands = [],
  commandLabel = "Command menu",
  activeIds = [],
  onSelect,
  className = "",
}: {
  items: DockApp[];
  commands?: DockCommand[];
  commandLabel?: string;
  /** tools marked with the macOS running-app dot */
  activeIds?: string[];
  onSelect?: (item: DockApp) => void;
  className?: string;
}) {
  const reduce = !!useReducedMotion();
  const mouseX = useMotionValue(FAR);
  const [hovered, setHovered] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      onMouseMove={(e) => {
        if (!reduce) mouseX.set(e.clientX);
      }}
      onMouseLeave={() => {
        mouseX.set(FAR);
        setHovered(null);
      }}
      className={`relative flex items-end gap-2 rounded-3xl p-3 ${className}`}
      style={{
        background: "linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 4%, var(--card)), var(--card))",
        boxShadow: ["inset 0 0 0 2px var(--border)", "inset 0 1px 0 color-mix(in srgb, var(--foreground) 10%, transparent)", "0 12px 32px rgba(23,52,12,0.22)"].join(", "),
      }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-4 top-px h-px rounded-full" style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--foreground) 30%, transparent), transparent)" }} />
      {items.map((it) => (
        <DockItem key={it.id} mouseX={mouseX} reduce={reduce} label={it.label} hovered={hovered === it.id} active={activeIds.includes(it.id)} onEnter={() => setHovered(it.id)} onClick={() => onSelect?.(it)}>
          {it.icon}
        </DockItem>
      ))}

      {commands.length > 0 && (
        <>
          <div className="mx-1 h-8 w-px self-center bg-foreground/[0.1]" />
          <DockItem mouseX={mouseX} reduce={reduce} label={commandLabel} hovered={hovered === "⌘K" && !menuOpen} onEnter={() => setHovered("⌘K")} onClick={() => setMenuOpen((o) => !o)}>
            <span className="flex h-full w-full items-center justify-center">
              <span className="flex items-center justify-center rounded-[22%] border border-foreground/[0.08] bg-foreground/[0.05] text-[12px] font-bold text-foreground/70" style={{ width: PLATE, height: PLATE }}>
                ⌘K
              </span>
            </span>
          </DockItem>
        </>
      )}

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            role="menu"
            aria-label={commandLabel}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
            style={{ transformOrigin: "bottom right", background: "var(--card)", boxShadow: "0 16px 40px rgba(23,52,12,0.25)" }}
            className="absolute bottom-full right-0 z-30 mb-3 w-[220px] rounded-2xl border-2 border-border p-1"
          >
            {commands.map((c) => (
              <button
                key={c.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  c.run?.();
                }}
                className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[12px] font-bold text-foreground/75 transition-colors duration-150 hover:bg-muted hover:text-foreground"
              >
                {c.label}
                <span className="rounded border border-foreground/[0.1] px-1 text-[9px] text-foreground/40">{c.key}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
