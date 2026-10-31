import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

// Product cards in the grader style: glass panels, criterion bars, a dark score tile and inline annotations.

function Bar({ label, value, max, dark }: { label: string; value: number; max: number; dark?: boolean }) {
  return (
    <div>
      <div className={cn("flex justify-between text-xs font-semibold", dark ? "text-white/80" : "text-[#1f2a2f]/80")}>
        <span>{label}</span>
        <span className="tabular">{value}</span>
      </div>
      <div className={cn("mt-1.5 h-1.5 overflow-hidden rounded-full", dark ? "bg-white/15" : "bg-[#1f2a2f]/10")}>
        <div className={cn("h-full rounded-full", dark ? "bg-white" : "bg-[#1f2a2f]")} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

export function ScoreCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass rounded-3xl p-5 text-[#1f2a2f]", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1f2a2f]/55">Digital SAT</p>
          <p className="mt-1 font-display text-lg font-bold">пробный тест №3</p>
        </div>
        <p className="font-display text-5xl font-bold tabular leading-none">
          1420<span className="ml-1 font-sans text-xs font-semibold text-[#1f2a2f]/50">/1600</span>
        </p>
      </div>
      <div className="mt-5 grid gap-3">
        <Bar label="Reading & Writing" value={700} max={800} />
        <Bar label="Math" value={720} max={800} />
        <Bar label="Алгебра" value={88} max={100} />
        <Bar label="Задачи и данные" value={64} max={100} />
      </div>
    </div>
  );
}

export function PlanCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-[#1f2a37]/85 p-5 text-white backdrop-blur-xl", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">план от ИИ на неделю</p>
      <ul className="mt-3 space-y-2 text-sm font-medium">
        {["Проценты и пропорции — 2 занятия.", "Систем уравнений больше не бояться.", "Один полный пробник в субботу."].map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#8fb0ff]" />
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-4">
        <p className="text-xs font-semibold text-white/60">прогноз после плана</p>
        <p className="mt-1 font-display text-3xl font-bold tabular">
          1480 <span className="font-sans text-xs font-semibold text-white/50">следующая цель</span>
        </p>
      </div>
    </div>
  );
}

export function SpeakingCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass rounded-3xl p-5 text-[#1f2a2f]", className)}>
      <div className="flex items-center gap-3">
        <span className="relative grid size-10 place-items-center rounded-full bg-[#0b1014] text-white">
          <Mic className="size-4" />
          <span className="absolute inset-0 animate-ping rounded-full bg-[#4f7cf0]/40" />
        </span>
        <div>
          <p className="text-sm font-bold">ИИ слушает…</p>
          <p className="text-xs text-[#1f2a2f]/55">IELTS Speaking · Part 2 · 1:24</p>
        </div>
      </div>
      <blockquote className="mt-4 rounded-2xl border-l-4 border-[#1f2a2f]/15 bg-white/40 px-4 py-3 text-sm leading-relaxed text-[#1f2a2f]/80">
        «I think the biggest advantage of remote study is flexibility — you can plan your day around when you are most productive.»
      </blockquote>
      <div className="mt-4 grid grid-cols-[120px_1fr] gap-4">
        <div className="rounded-2xl bg-[#0b1014] p-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">балл</p>
          <p className="mt-1 font-display text-4xl font-bold tabular">7.0</p>
        </div>
        <div className="grid gap-2">
          <Bar label="Fluency" value={6.5} max={9} />
          <Bar label="Lexical" value={7} max={9} />
          <Bar label="Grammar" value={6.5} max={9} />
          <Bar label="Pronunciation" value={7} max={9} />
        </div>
      </div>
    </div>
  );
}

export function WritingCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass rounded-3xl p-6 text-[#1f2a2f]", className)}>
      <div className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-xs text-[#1f2a2f]/50">365step · Writing Task 2</span>
      </div>
      <p className="mt-5 text-[15px] leading-8">
        In my opinion, <mark className="rounded bg-[#ffe3c7] px-1 text-inherit">technology have</mark> changed the way people communicate dramatically. Social media platforms{" "}
        <mark className="rounded bg-[#d9f5df] px-1 text-inherit">allow individuals to stay connected</mark> regardless of distance, although some argue this comes at a cost.
      </p>
      <div className="mt-4 flex gap-4 text-xs font-semibold text-[#1f2a2f]/60">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ffcf9f]" /> грамматика
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#9fe2ad]" /> сильная фраза
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Task Response", "6.5"],
          ["Coherence", "7"],
          ["Lexical", "6"],
          ["Grammar", "6.5"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white/60 p-3">
            <p className="text-[11px] font-semibold text-[#1f2a2f]/55">{k}</p>
            <p className="font-display text-2xl font-bold tabular">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The hero's sky: layered gradients, soft clouds and a pale mountain line, all in CSS/SVG. */
export function Sky({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#3f78d6_0%,#6fa3e8_32%,#b9d6f5_62%,#eaf2fb_82%,#f5f6f8_100%)]" />
      <div className="absolute -left-20 top-24 h-40 w-[520px] rounded-full bg-white/50 blur-3xl" />
      <div className="absolute right-[-80px] top-56 h-48 w-[620px] rounded-full bg-white/45 blur-3xl" />
      <div className="absolute left-1/3 top-[420px] h-32 w-[480px] rounded-full bg-white/60 blur-3xl" />
      <svg className="absolute bottom-[18%] left-0 w-full" viewBox="0 0 1440 220" preserveAspectRatio="none">
        <path d="M0 170 L140 110 L230 150 L360 60 L470 130 L560 95 L700 160 L820 70 L940 140 L1060 90 L1180 150 L1300 100 L1440 140 V220 H0 Z" fill="#ffffff" opacity="0.55" />
        <path d="M0 190 L180 140 L300 175 L450 120 L600 180 L760 130 L900 185 L1080 140 L1240 180 L1440 150 V220 H0 Z" fill="#ffffff" opacity="0.7" />
      </svg>
    </div>
  );
}
