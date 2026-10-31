import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
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

/** Folk-style sticker: an emoji with a white die-cut outline, gently floating. */
export function Sticker({ emoji, className, rotate = 0, delay = 0, size = 56 }: { emoji: string; className?: string; rotate?: number; delay?: number; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn("sticker animate-float pointer-events-none absolute select-none leading-none", className)}
      style={{ fontSize: size, ["--r" as string]: `${rotate}deg`, animationDelay: `${delay}s` }}
    >
      {emoji}
    </span>
  );
}
