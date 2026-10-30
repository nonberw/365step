import { Calculator, CheckCircle2, Lock, Mic, Play, Sparkles } from "lucide-react";
import { motion } from "motion/react";

// Small animated mock-ups of real platform screens for the landing scroll story.

const frame = "relative h-full overflow-hidden rounded-3xl border border-border bg-card shadow-[0_30px_80px_-30px_rgba(60,0,2,.35)]";

export function SatMock() {
  return (
    <div className={frame}>
      <div className="flex items-center justify-between border-b border-dashed border-border px-5 py-3 text-sm">
        <span className="font-display font-semibold">Section 2, Module 1: Math</span>
        <span className="rounded-full bg-secondary px-3 py-1 font-display text-xs font-semibold text-secondary-foreground tabular">16:42</span>
        <span className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">
          <Calculator className="size-3.5" /> Desmos
        </span>
      </div>
      <div className="grid h-[calc(100%-49px)] grid-cols-2 divide-x divide-border">
        <div className="p-5">
          <span className="grid size-7 place-items-center rounded-md bg-secondary font-display text-sm font-bold text-secondary-foreground">7</span>
          <p className="mt-4 text-[15px] font-medium">The graph of y = x² − 6x + 5 is a parabola. What is the minimum value of y?</p>
          {["−4", "5", "3", "−9"].map((c, i) => (
            <motion.div
              key={c}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className={`mt-2.5 flex items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm ${i === 0 ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className={`grid size-6 place-items-center rounded-full border-2 text-xs font-bold ${i === 0 ? "border-primary bg-primary text-white" : "border-foreground/30"}`}>{"ABCD"[i]}</span>
              {c}
            </motion.div>
          ))}
        </div>
        <div className="relative bg-[#fafafa] dark:bg-[#151313]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" aria-hidden="true">
            {Array.from({ length: 11 }, (_, i) => (
              <g key={i} stroke="var(--border)">
                <line x1={i * 20} y1="0" x2={i * 20} y2="200" />
                <line x1="0" y1={i * 20} x2="200" y2={i * 20} />
              </g>
            ))}
            <line x1="0" y1="100" x2="200" y2="100" stroke="var(--muted-foreground)" />
            <line x1="100" y1="0" x2="100" y2="200" stroke="var(--muted-foreground)" />
            <motion.path
              d="M40 0 Q 160 260 160 0"
              fill="none"
              stroke="#c74440"
              strokeWidth="2.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
            />
            <motion.circle cx="100" cy="130" r="4" fill="#2d70b3" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.4 }} />
          </svg>
          <span className="absolute bottom-3 right-3 rounded-lg bg-card px-2 py-1 text-[11px] shadow">(3, −4)</span>
        </div>
      </div>
    </div>
  );
}

export function IeltsMock() {
  const bars = [
    ["Fluency", 6.5],
    ["Lexical", 7],
    ["Grammar", 6.5],
    ["Pronunciation", 7],
  ] as const;
  return (
    <div className={`${frame} flex flex-col gap-4 p-6`}>
      <div className="flex items-center gap-3">
        <span className="relative grid size-12 place-items-center rounded-full bg-primary text-white">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          <Mic className="size-5" />
        </span>
        <div>
          <p className="font-display font-semibold">Speaking Part 2</p>
          <p className="text-xs text-muted-foreground">Describe a teacher who has influenced you</p>
        </div>
        <span className="ml-auto font-display text-4xl font-semibold text-primary">7.0</span>
      </div>
      <p className="rounded-xl bg-muted/60 p-3 font-serif text-sm italic">“My chemistry teacher, honestly, changed how I see science — she let us design our own experiments…”</p>
      <div className="grid gap-3">
        {bars.map(([k, v], i) => (
          <div key={k}>
            <div className="flex justify-between text-sm">
              <span>{k}</span>
              <span className="font-display font-semibold">{v}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${(v / 9) * 100}%` }} transition={{ delay: 0.2 + i * 0.15, duration: 0.8 }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-auto flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" /> После работы над паузами: <b className="text-foreground">7.5</b>
      </p>
    </div>
  );
}

export function CodeMock() {
  const lines = ["def two_sum(nums, target):", "    seen = {}", "    for i, x in enumerate(nums):", "        if target - x in seen:", "            return [seen[target - x], i]", "        seen[x] = i"];
  return (
    <div className={`${frame} flex flex-col bg-[#141212] text-[#f3eeee]`}>
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-sm">
        <span className="font-display font-semibold">Две суммы</span>
        <span className="text-xs font-semibold text-[#7ee2a8]">Easy</span>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs">
          <Play className="size-3" /> Запустить
        </span>
      </div>
      <pre className="flex-1 p-5 font-mono text-[13px] leading-7">
        {lines.map((l, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 * i }}>
            <span className="mr-4 text-white/30">{i + 1}</span>
            {l}
          </motion.div>
        ))}
      </pre>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="m-4 flex items-center gap-3 rounded-2xl bg-[#13361f] p-4">
        <CheckCircle2 className="size-6 text-[#7ee2a8]" />
        <div>
          <p className="font-display font-semibold text-[#7ee2a8]">Accepted</p>
          <p className="text-xs text-white/60">6 из 6 тестов · 0.3 мс · +30 XP</p>
        </div>
      </motion.div>
    </div>
  );
}

export function TeacherMock() {
  const rows = [
    ["Айым Д.", "пишет", 7, 12, false],
    ["Арман Д.", "сдал", 12, 12, false],
    ["Данияр Д.", "вне экзамена", 4, 12, true],
    ["Алия Д.", "пишет", 9, 12, false],
  ] as const;
  return (
    <div className={`${frame} p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Контрольная · код K7Q2MX</p>
          <p className="font-display text-xl font-semibold">Энергия и её виды</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
          <Lock className="size-3.5" /> идёт
        </span>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {rows.map(([name, st, done, total, away], i) => (
          <motion.div key={name} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }} className={`rounded-xl border p-3 ${away ? "border-destructive/60 bg-destructive/5" : "border-border"}`}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{name}</span>
              <span className={away ? "text-destructive" : st === "сдал" ? "text-success" : "text-muted-foreground"}>{st}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div className={`h-full rounded-full ${st === "сдал" ? "bg-success" : "bg-primary"}`} initial={{ width: 0 }} animate={{ width: `${(done / total) * 100}%` }} transition={{ delay: 0.3 + 0.1 * i, duration: 0.7 }} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
