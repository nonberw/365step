import { motion } from "framer-motion";

/** Soft drifting clouds and a pale mountain line: the sky backdrop shared by the section heroes. */
export function Aurora() {
  const clouds = [
    { x: ["-10%", "8%", "-10%"], y: "8%", w: "55%", h: "34%", d: 26 },
    { x: ["55%", "40%", "55%"], y: "35%", w: "60%", h: "38%", d: 32 },
    { x: ["20%", "35%", "20%"], y: "70%", w: "50%", h: "30%", d: 28 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden" aria-hidden="true">
      {clouds.map((c, i) => (
        <motion.div key={i} className="absolute rounded-full bg-white/35 blur-3xl" style={{ top: c.y, width: c.w, height: c.h }} animate={{ left: c.x }} transition={{ duration: c.d, repeat: Infinity, ease: "easeInOut" }} />
      ))}
      <svg className="absolute bottom-0 left-0 h-16 w-full opacity-[0.14]" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path d="M0 120 L160 70 L280 105 L420 40 L560 100 L700 60 L860 115 L1000 55 L1160 105 L1300 70 L1440 100 V160 H0 Z" fill="#ffffff" />
      </svg>
    </div>
  );
}
