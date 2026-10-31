import { Check } from "lucide-react";
import { PLANTS, PLANT_SPECIES, STAGE_NAMES, plantGrowth, type PlantSpecies } from "@shared/plants";
import { cn } from "@/lib/utils";

// The study companion drawn in SVG: a smiling pot and a plant that grows through five stages.

const GREEN = "#58cc02";
const GREEN_DARK = "#3f9f00";
const POT = "#d9774a";
const POT_RIM = "#ee9466";
const BASE_Y = 164; // top of the soil

const pick = <T,>(arr: readonly T[], stage: number) => arr[stage - 1]!;

function Leaf({ x, y, rot, scale = 1, color = GREEN }: { x: number; y: number; rot: number; scale?: number; color?: string }) {
  return <path d="M0 0 C 8 -11, 24 -11, 32 0 C 24 11, 8 11, 0 0 Z" fill={color} transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`} />;
}

function Petals({ cx, cy, r, count, color, center }: { cx: number; cy: number; r: number; count: number; color: string; center: string }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <ellipse key={i} cx={cx} cy={cy - r * 0.95} rx={r * 0.38} ry={r * 0.72} fill={color} transform={`rotate(${(360 / count) * i} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.46} fill={center} />
    </g>
  );
}

function Cactus({ s }: { s: number }) {
  const w = pick([24, 30, 36, 40, 44], s);
  const h = pick([22, 36, 52, 68, 82], s);
  const top = BASE_Y - h;
  return (
    <g>
      {s >= 3 && <path d={`M${100 + w / 2 - 3} ${BASE_Y - h * 0.42} h16 v-${h * 0.3}`} fill="none" stroke="#4fb41a" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />}
      {s >= 4 && <path d={`M${100 - w / 2 + 3} ${BASE_Y - h * 0.58} h-16 v-${h * 0.26}`} fill="none" stroke="#4fb41a" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />}
      <rect x={100 - w / 2} y={top} width={w} height={h + 4} rx={w / 2} fill="#58cc02" />
      <path d={`M100 ${top + 6} V${BASE_Y - 4}`} stroke="#3f9f00" strokeWidth={2.5} strokeLinecap="round" opacity={0.55} />
      {s >= 2 &&
        [0.3, 0.55, 0.8].map((k, i) => (
          <g key={i} stroke="#f7fbf2" strokeWidth={1.8} strokeLinecap="round">
            <path d={`M${100 - w / 2 + 4} ${top + h * k} l-4 -3`} />
            <path d={`M${100 + w / 2 - 4} ${top + h * k - 5} l4 -3`} />
          </g>
        ))}
      {s >= 5 && (
        <g>
          <Petals cx={100} cy={top - 3} r={11} count={6} color="#ff8fb1" center="#ffc800" />
        </g>
      )}
    </g>
  );
}

function Flower({ s }: { s: number }) {
  const h = pick([22, 44, 66, 86, 102], s);
  const top = BASE_Y - h;
  return (
    <g>
      <path d={`M100 ${BASE_Y} Q 97 ${BASE_Y - h * 0.5} 100 ${top}`} fill="none" stroke={GREEN_DARK} strokeWidth={5} strokeLinecap="round" />
      <Leaf x={100} y={BASE_Y - h * 0.38} rot={-28} scale={0.55 + s * 0.1} />
      <Leaf x={100} y={BASE_Y - h * 0.5} rot={208} scale={0.55 + s * 0.1} />
      {s >= 3 && (
        <>
          <Leaf x={100} y={BASE_Y - h * 0.72} rot={-35} scale={0.5 + s * 0.08} color={GREEN_DARK} />
          <Leaf x={100} y={BASE_Y - h * 0.8} rot={215} scale={0.5 + s * 0.08} color={GREEN_DARK} />
        </>
      )}
      {s === 1 && (
        <>
          <Leaf x={100} y={top} rot={-40} scale={0.6} />
          <Leaf x={100} y={top} rot={220} scale={0.6} />
        </>
      )}
      {s === 2 && <ellipse cx={100} cy={top - 4} rx={7} ry={10} fill={GREEN} />}
      {s === 3 && (
        <g>
          <ellipse cx={100} cy={top - 6} rx={9} ry={13} fill="#ff8fb1" />
          <path d={`M91 ${top - 2} Q100 ${top + 6} 109 ${top - 2}`} fill={GREEN} />
        </g>
      )}
      {s >= 4 && <Petals cx={100} cy={top - 8} r={s === 4 ? 17 : 21} count={s === 4 ? 6 : 8} color="#ff8fb1" center="#ffc800" />}
      {s >= 5 && (
        <g>
          <path d={`M100 ${BASE_Y - h * 0.55} Q 122 ${BASE_Y - h * 0.62} 130 ${BASE_Y - h * 0.82}`} fill="none" stroke={GREEN_DARK} strokeWidth={4} strokeLinecap="round" />
          <Petals cx={130} cy={BASE_Y - h * 0.86} r={11} count={6} color="#c9a7ff" center="#ffc800" />
          <path d="M70 70 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#ffc800" />
        </g>
      )}
    </g>
  );
}

function Sunflower({ s }: { s: number }) {
  const h = pick([22, 50, 80, 108, 128], s);
  const top = BASE_Y - h;
  return (
    <g>
      <path d={`M100 ${BASE_Y} L100 ${top}`} stroke={GREEN_DARK} strokeWidth={6.5} strokeLinecap="round" />
      <Leaf x={100} y={BASE_Y - h * 0.3} rot={-20} scale={0.7 + s * 0.12} />
      <Leaf x={100} y={BASE_Y - h * 0.42} rot={200} scale={0.7 + s * 0.12} />
      {s >= 3 && (
        <>
          <Leaf x={100} y={BASE_Y - h * 0.62} rot={-30} scale={0.6 + s * 0.1} color={GREEN_DARK} />
          <Leaf x={100} y={BASE_Y - h * 0.7} rot={210} scale={0.6 + s * 0.1} color={GREEN_DARK} />
        </>
      )}
      {s === 1 && (
        <>
          <Leaf x={100} y={top} rot={-40} scale={0.6} />
          <Leaf x={100} y={top} rot={220} scale={0.6} />
        </>
      )}
      {s === 2 && <ellipse cx={100} cy={top - 4} rx={8} ry={11} fill={GREEN} />}
      {s === 3 && (
        <g>
          <circle cx={100} cy={top - 6} r={11} fill={GREEN_DARK} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} cx={100} cy={top - 20} rx={3.6} ry={8} fill={GREEN} transform={`rotate(${i * 60} 100 ${top - 6})`} />
          ))}
        </g>
      )}
      {s === 4 && <Petals cx={100} cy={top - 12} r={22} count={12} color="#ffc800" center="#7a4a1d" />}
      {s >= 5 && (
        <g>
          <Petals cx={100} cy={top - 18} r={30} count={16} color="#ffd33d" center="#7a4a1d" />
          {[
            [-6, -4],
            [4, -7],
            [0, 3],
            [-9, 5],
            [8, 4],
            [-2, -11],
            [6, 11],
          ].map(([dx, dy], i) => (
            <circle key={i} cx={100 + dx!} cy={top - 18 + dy!} r={1.6} fill="#c28a4a" />
          ))}
          <path d="M150 52 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#ffc800" />
        </g>
      )}
    </g>
  );
}

function Sakura({ s }: { s: number }) {
  const t = pick([20, 40, 60, 80, 94], s);
  const top = BASE_Y - t;
  const n = pick([0, 0, 9, 17, 30], s);
  const R = pick([0, 0, 30, 42, 54], s);
  const cy = top - R * 0.35;
  const dots = Array.from({ length: n }, (_, i) => {
    const a = i * 2.399;
    const r = R * Math.sqrt((i + 0.5) / n);
    return { x: 100 + Math.cos(a) * r * 1.15, y: cy + Math.sin(a) * r * 0.85, big: i % 3 === 0 };
  });
  return (
    <g>
      {s >= 3 && (
        <g stroke="#8a5a3c" strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={`M100 ${top + 14} L ${100 - R * 0.6} ${top - R * 0.3}`} />
          <path d={`M100 ${top + 8} L ${100 + R * 0.62} ${top - R * 0.35}`} />
        </g>
      )}
      <path d={`M100 ${BASE_Y} C 97 ${BASE_Y - t * 0.4}, 103 ${BASE_Y - t * 0.7}, 100 ${top}`} fill="none" stroke="#8a5a3c" strokeWidth={s >= 4 ? 9 : 6.5} strokeLinecap="round" />
      {s <= 2 && (
        <>
          <Leaf x={100} y={top + 6} rot={-35} scale={0.55 + s * 0.1} />
          <Leaf x={100} y={top + 6} rot={215} scale={0.55 + s * 0.1} />
          {s === 2 && <Leaf x={100} y={top + 24} rot={-20} scale={0.5} color={GREEN_DARK} />}
        </>
      )}
      {s >= 3 && <ellipse cx={100} cy={cy} rx={R * 1.1} ry={R * 0.82} fill="#ffd6e0" opacity={0.55} />}
      {dots.map((d, i) => (
        <g key={i}>
          <circle cx={d.x} cy={d.y} r={d.big ? 8 : 6.2} fill={d.big ? "#ff9bb8" : "#ffb7c9"} />
          <circle cx={d.x} cy={d.y} r={1.6} fill="#ffe27a" />
        </g>
      ))}
      {s >= 5 && (
        <g fill="#ffb7c9">
          <ellipse cx={52} cy={140} rx={4} ry={2.4} transform="rotate(30 52 140)" />
          <ellipse cx={150} cy={128} rx={4} ry={2.4} transform="rotate(-25 150 128)" />
          <ellipse cx={142} cy={152} rx={3.4} ry={2} transform="rotate(20 142 152)" />
        </g>
      )}
    </g>
  );
}

const BODY: Record<PlantSpecies, (p: { s: number }) => React.JSX.Element> = { cactus: Cactus, flower: Flower, sunflower: Sunflower, sakura: Sakura };

export function Plant({ species, stage, className, label }: { species: PlantSpecies; stage: number; className?: string; label?: string }) {
  const s = Math.min(5, Math.max(1, Math.round(stage)));
  const Body = BODY[species];
  return (
    <svg viewBox="0 -44 200 284" role="img" aria-label={label ?? `${PLANTS[species].name}, стадия ${s}: ${STAGE_NAMES[s - 1]}`} className={cn("block h-auto w-full", className)}>
      <ellipse cx={100} cy={232} rx={56} ry={6} fill="#000" opacity={0.08} />
      <g className="plant-sway">
        <Body s={s} />
      </g>
      {/* pot with a face */}
      <path d="M64 172 H136 L129 224 Q128 231 121 231 H79 Q72 231 71 224 Z" fill={POT} />
      <rect x={56} y={162} width={88} height={15} rx={7.5} fill={POT_RIM} />
      <g className="plant-blink">
        <circle cx={87} cy={197} r={4.2} fill="#3b2314" />
        <circle cx={113} cy={197} r={4.2} fill="#3b2314" />
      </g>
      <circle cx={88.4} cy={195.6} r={1.3} fill="#fff" />
      <circle cx={114.4} cy={195.6} r={1.3} fill="#fff" />
      <path d="M92 207 Q100 215 108 207" fill="none" stroke="#3b2314" strokeWidth={2.6} strokeLinecap="round" />
      <ellipse cx={78} cy={206} rx={5} ry={3} fill="#ff8f8f" opacity={0.55} />
      <ellipse cx={122} cy={206} rx={5} ry={3} fill="#ff8f8f" opacity={0.55} />
    </svg>
  );
}

/** Four species to choose from, each shown at its blooming stage. */
export function PlantPicker({ value, onChange, className }: { value: PlantSpecies | null; onChange: (v: PlantSpecies) => void; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)} role="radiogroup" aria-label="Растение-спутник">
      {PLANT_SPECIES.map((sp) => {
        const on = value === sp;
        return (
          <button
            key={sp}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(sp)}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-3xl border-2 bg-card p-3 text-center transition-[transform,box-shadow,border-color]",
              on ? "border-primary shadow-[0_4px_0_0_var(--primary-edge)]" : "border-border shadow-[0_4px_0_0_var(--border)] hover:border-primary/60",
            )}
          >
            {on && (
              <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3.5" />
              </span>
            )}
            <Plant species={sp} stage={4} className="w-24" />
            <span className="font-display text-sm font-extrabold">{PLANTS[sp].name}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">{PLANTS[sp].blurb}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Companion with its stage and progress to the next one. */
export function PlantCard({ species, xp, compact, className }: { species: PlantSpecies; xp: number; compact?: boolean; className?: string }) {
  const g = plantGrowth(xp);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Plant species={species} stage={g.stage} className={compact ? "w-16 shrink-0" : "w-28 shrink-0"} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-extrabold">
          {PLANTS[species].name} · {g.name}
        </p>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(g.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Рост растения">
          <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(6, g.progress * 100)}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{g.toNext === null ? "Максимальная стадия" : `Ещё ${g.toNext} XP до стадии «${STAGE_NAMES[g.stage as 1 | 2 | 3 | 4]}»`}</p>
      </div>
    </div>
  );
}
