// 21st.dev — Animated Radial Chart (isaiahbjork), adapted: motion/react, BSTS red/coral arc,
// shows "value / max" instead of a percentage and an optional target mark.
import { useEffect, useId } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export function AnimatedRadialChart({
  value,
  max = 100,
  target,
  size = 280,
  duration = 1.6,
  label,
  className,
  dark,
}: {
  value: number;
  max?: number;
  target?: number | null;
  size?: number;
  duration?: number;
  label?: string;
  className?: string;
  dark?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const stroke = Math.max(12, size * 0.06);
  const radius = size * 0.38;
  const center = size / 2;
  const circumference = Math.PI * radius;
  const v = useMotionValue(0);
  const offset = useTransform(v, [0, max], [circumference, 0]);
  const shown = useTransform(v, (x) => Math.round(x));
  useEffect(() => {
    const c = animate(v, Math.min(value, max), { duration, ease: "easeOut" });
    return c.stop;
  }, [value, max, v, duration]);
  const arc = `M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`;
  const angle = target ? Math.PI * (1 - Math.min(target, max) / max) : 0;

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size * 0.62 }}>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`} className="overflow-visible">
        <defs>
          <linearGradient id={`arc-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8fb0ff" />
            <stop offset="55%" stopColor="#d12a2a" />
            <stop offset="100%" stopColor="#1f48b0" />
          </linearGradient>
          <filter id={`shadow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.25" />
          </filter>
        </defs>
        <path d={arc} fill="none" stroke={dark ? "rgba(255,255,255,0.12)" : "var(--muted)"} strokeWidth={stroke} strokeLinecap="round" />
        <motion.path d={arc} fill="none" stroke={`url(#arc-${uid})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} style={{ strokeDashoffset: offset }} filter={`url(#shadow-${uid})`} />
        {target ? (
          <g>
            <line
              x1={center + Math.cos(angle) * (radius - stroke)}
              y1={center - Math.sin(angle) * (radius - stroke)}
              x2={center + Math.cos(angle) * (radius + stroke)}
              y2={center - Math.sin(angle) * (radius + stroke)}
              stroke={dark ? "#fff" : "var(--foreground)"}
              strokeWidth={2}
            />
          </g>
        ) : null}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className={cn("font-display font-bold leading-none tabular-nums", dark ? "text-white" : "text-foreground")} style={{ fontSize: size * 0.17 }}>
          <motion.span>{shown}</motion.span>
          <span className={cn("font-semibold", dark ? "text-white/50" : "text-muted-foreground")} style={{ fontSize: size * 0.07 }}>
            {" "}
            / {max}
          </span>
        </span>
        {label && <span className={cn("mt-1 text-xs", dark ? "text-white/60" : "text-muted-foreground")}>{label}</span>}
      </div>
    </div>
  );
}
