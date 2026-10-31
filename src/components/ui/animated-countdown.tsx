// 21st.dev — Animated Countdown (nexus-ui), adapted: motion/react, Russian labels, BSTS colours.
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type Unit = "days" | "hours" | "minutes" | "seconds";
type TimeLeft = Record<Unit, number>;

const LABELS: Record<Unit, [string, string, string]> = {
  days: ["день", "дня", "дней"],
  hours: ["час", "часа", "часов"],
  minutes: ["минута", "минуты", "минут"],
  seconds: ["секунда", "секунды", "секунд"],
};

const plural = (n: number, [one, few, many]: [string, string, string]) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

function timeLeft(target: number): TimeLeft {
  const s = Math.max(0, Math.floor((target - Date.now()) / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

function Digit({ value }: { value: string }) {
  const reduce = useReducedMotion() === true;
  return (
    <span className="relative inline-grid min-w-[2ch] place-items-center tabular-nums">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={reduce ? false : { y: 14, opacity: 0, filter: "blur(4px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { y: -14, opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: reduce ? 0.05 : 0.28, ease: "easeOut" }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function AnimatedCountdown({ target, units = ["days", "hours", "minutes", "seconds"], className, dark }: { target: number; units?: Unit[]; className?: string; dark?: boolean }) {
  const [left, setLeft] = React.useState(() => timeLeft(target));
  React.useEffect(() => {
    const t = setInterval(() => setLeft(timeLeft(target)), 1000);
    return () => clearInterval(t);
  }, [target]);
  return (
    <div className={cn("grid w-fit max-w-full grid-cols-4 gap-1.5 sm:gap-2", className)} role="timer" aria-label="Обратный отсчёт">
      {units.map((u, i) => (
        <motion.div
          key={u}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
          whileHover={{ y: -3 }}
          className={cn(
            "relative flex min-w-0 flex-col items-center overflow-hidden rounded-2xl border px-2 py-2.5 text-center sm:min-w-[5.4rem] sm:px-3 sm:py-3",
            dark ? "border-white/10 bg-white/[0.06] text-white" : "border-border bg-card",
          )}
        >
          <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#8fb0ff] to-transparent" />
          <span className="font-display text-2xl font-bold leading-none sm:text-4xl">
            <Digit value={String(left[u]).padStart(2, "0")} />
          </span>
          <span className={cn("mt-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] sm:text-[10px] sm:tracking-[0.16em]", dark ? "text-white/55" : "text-muted-foreground")}>{plural(left[u], LABELS[u])}</span>
        </motion.div>
      ))}
    </div>
  );
}
