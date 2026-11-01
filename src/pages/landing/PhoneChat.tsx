import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ChevronLeft, FileText, Plus, Video } from "lucide-react";
import { BrandMark } from "@/components/AppShell";
import { cn } from "@/lib/utils";

// A phone with the tutor's chat: messages pop in one after another once the phone is on screen.

export type ChatMessage = { from: "me" | "them"; text?: string; card?: ReactNode; file?: string };

function Bubble({ m }: { m: ChatMessage }) {
  const me = m.from === "me";
  return (
    <div className={cn("flex", me ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-[18px] px-3 py-2 text-[12.5px] leading-snug",
          me ? "rounded-br-[6px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" : "rounded-bl-[6px] text-[#111]",
        )}
        style={{ background: me ? "var(--bubble-me)" : "#e9e9eb" }}
      >
        {m.file && (
          <span className="mb-1 flex items-center gap-1.5 rounded-xl bg-white/20 px-2 py-1.5 text-[11px] font-semibold">
            <FileText className="size-3.5" /> {m.file}
          </span>
        )}
        {m.text}
        {m.card && <div className="mt-1.5">{m.card}</div>}
      </div>
    </div>
  );
}

export function PhoneChat({ messages, className }: { messages: ChatMessage[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className={cn("relative mx-auto w-[290px] rotate-[-4deg]", className)}>
      <div className="rounded-[46px] bg-gradient-to-b from-[#e7e9ee] via-[#c9ccd3] to-[#e7e9ee] p-[3px] shadow-[0_40px_80px_-30px_rgba(24,61,154,0.45),0_12px_30px_-12px_rgba(0,0,0,0.3)]">
        <div className="rounded-[43px] bg-[#0b0b0d] p-[9px]">
          <div className="relative flex h-[560px] flex-col overflow-hidden rounded-[35px] bg-white">
            <div className="absolute left-1/2 top-2.5 z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
            <div className="flex items-center justify-between px-4 pb-2 pt-11">
              <span className="grid size-7 place-items-center rounded-full bg-[#f1f2f4] text-[#333]">
                <ChevronLeft className="size-4" />
              </span>
              <span className="flex flex-col items-center gap-0.5">
                <BrandMark className="size-9 rounded-full" />
                <span className="text-[11px] font-semibold text-[#111]">365step ›</span>
              </span>
              <span className="grid size-7 place-items-center rounded-full bg-[#f1f2f4] text-[#333]">
                <Video className="size-3.5" />
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden px-3 pb-2">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={reduce ? false : { opacity: 0, y: 14, scale: 0.96 }}
                  animate={inView ? { opacity: 1, y: 0, scale: 1 } : undefined}
                  transition={{ delay: reduce ? 0 : 0.4 + i * 0.75, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: m.from === "me" ? "bottom right" : "bottom left" }}
                >
                  <Bubble m={m} />
                </motion.div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-3 pb-5 pt-1">
              <span className="grid size-7 place-items-center rounded-full bg-[#f1f2f4] text-[#888]">
                <Plus className="size-4" />
              </span>
              <span className="flex-1 rounded-full border border-[#e3e3e6] px-3 py-1.5 text-[11px] text-[#aaa]">iMessage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Folk-style sticker: an emoji with a white die-cut outline, gently floating. A click makes it pop,
 *  throws a burst of matching emoji out of it and shows a short caption. */
export function Sticker({ emoji, burst = [], caption, className, rotate = 0, delay = 0, size = 56 }: { emoji: string; burst?: string[]; caption?: string; className?: string; rotate?: number; delay?: number; size?: number }) {
  const reduce = useReducedMotion();
  const [pops, setPops] = useState<{ id: number; parts: { e: string; x: number; y: number; r: number; s: number }[] }[]>([]);
  const [hit, setHit] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  function pop() {
    const id = Date.now() + Math.random();
    const pool = burst.length ? burst : [emoji];
    const parts = Array.from({ length: 9 }, (_, k) => {
      const a = (Math.PI * 2 * k) / 9 + Math.random() * 0.5;
      const d = 70 + Math.random() * 60;
      return { e: pool[k % pool.length]!, x: Math.cos(a) * d, y: Math.sin(a) * d - 30, r: (Math.random() - 0.5) * 90, s: 0.9 + Math.random() * 0.7 };
    });
    setPops((p) => [...p, { id, parts }]);
    setHit((h) => h + 1);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1300);
    if (caption) {
      setShowCaption(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShowCaption(false), 1800);
    }
  }

  return (
    <span className={cn("absolute z-10", className)}>
      <motion.button
        key={hit}
        type="button"
        onClick={pop}
        aria-label={caption ?? "Наклейка"}
        initial={hit && !reduce ? { scale: 1.35, rotate: rotate - 14 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 11 }}
        className="sticker animate-float block cursor-pointer select-none leading-none outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        style={{ fontSize: size, ["--r" as string]: `${rotate}deg`, animationDelay: `${delay}s` }}
      >
        {emoji}
      </motion.button>
      {!reduce &&
        pops.map((p) =>
          p.parts.map((q, k) => (
            <motion.span
              key={`${p.id}-${k}`}
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 select-none leading-none"
              style={{ fontSize: size * 0.62 }}
              initial={{ x: "-50%", y: "-50%", opacity: 1, scale: 0.3, rotate: 0 }}
              animate={{ x: `calc(-50% + ${q.x}px)`, y: [`-50%`, `calc(-50% + ${q.y}px)`, `calc(-50% + ${q.y + 60}px)`], opacity: [1, 1, 0], scale: q.s, rotate: q.r }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              {q.e}
            </motion.span>
          )),
        )}
      <AnimatePresence>
        {showCaption && caption && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.9, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            exit={{ opacity: 0, y: -6, x: "-50%" }}
            className="pointer-events-none absolute -top-9 left-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-[0_6px_16px_-6px_rgba(24,61,154,0.6)]"
            style={{ background: "var(--bubble-me)" }}
          >
            {caption}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
