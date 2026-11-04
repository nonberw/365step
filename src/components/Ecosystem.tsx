import { useLearning } from "@/lib/learning";
import { routeAccess } from "@shared/directionPolicy";
import { EMPTY_LEARNING_PROFILE } from "@shared/directions";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarClock, Flame, Zap } from "lucide-react";
import type { Goals } from "@shared/types";
import { plantGrowth, type PlantSpecies } from "@shared/plants";
import { daysTo, longDate, monthLabel } from "@shared/examDates";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Plant } from "@/components/Plant";
import { DeadlineChip } from "@/components/Deadlines";

// What ties the sections together: one plant, one XP and streak, one set of exam dates,
// and links between sections that feed each other (the path, review of mistakes, duels, admissions).

export type ModuleId = "learn" | "sat" | "ielts" | "ent" | "code" | "admissions";

export const MODULES: Record<ModuleId, { label: string; emoji: string; to: string; color: string; blurb: string }> = {
  learn: { label: "Путь", emoji: "🌱", to: "/learn", color: "#2bb673", blurb: "ежедневные уроки" },
  sat: { label: "SAT", emoji: "📐", to: "/sat", color: "#2f5bc8", blurb: "банк, пробники, Desmos" },
  ielts: { label: "IELTS", emoji: "🎧", to: "/ielts", color: "#ff9600", blurb: "4 навыка с ИИ" },
  ent: { label: "ЕНТ", emoji: "🏛️", to: "/ent", color: "#9b5cf6", blurb: "пробники и дуэли" },
  code: { label: "Код и лаба", emoji: "💻", to: "/engineering", color: "#1cb0f6", blurb: "задачи, дроны, CAD → портфолио" },
  admissions: { label: "Поступление", emoji: "🎓", to: "/admissions", color: "#ff4b4b", blurb: "заявки, эссе, стипендии" },
};

export interface ExamCountdown {
  id: "sat" | "ielts" | "ent";
  label: string;
  date: string;
  approx: boolean;
  days: number;
}

/** The student's exams with dates, nearest first; IELTS dates are a month, so they are approximate. */
export function examCountdowns(goals: Goals): ExamCountdown[] {
  const list: Omit<ExamCountdown, "days">[] = [];
  if (goals.sat?.date) list.push({ id: "sat", label: `SAT ${goals.sat.target}`, date: goals.sat.date, approx: false });
  if (goals.ielts?.date) list.push({ id: "ielts", label: `IELTS ${goals.ielts.target.toFixed(1)}`, date: goals.ielts.date, approx: true });
  if (goals.ent?.date) list.push({ id: "ent", label: `ЕНТ ${goals.ent.target}`, date: goals.ent.date, approx: false });
  return list
    .map((e) => ({ ...e, days: daysTo(e.date) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days);
}

type Rel = { to: string; label: string };
const L = {
  pathSat: { to: "/learn?course=sat-math", label: "🌱 Путь · SAT Math" },
  pathRw: { to: "/learn?course=sat-rw", label: "🌱 Путь · SAT R&W" },
  pathIelts: { to: "/learn?course=ielts-reading", label: "🌱 Путь · IELTS" },
  pathEnt: { to: "/learn?course=ent", label: "🌱 Путь · ЕНТ" },
  pathNuet: { to: "/learn?course=nuet", label: "🌱 Путь · NUET" },
  pathCode: { to: "/learn?course=code", label: "🌱 Путь · Код" },
  review: { to: "/review", label: "🔁 Повтор ошибок" },
  duels: { to: "/duels", label: "⚔️ Дуэли" },
  leaderboard: { to: "/leaderboard", label: "🏆 Рейтинг" },
  admissions: { to: "/admissions", label: "🎓 Поступление" },
  library: { to: "/library", label: "📚 Библиотека" },
  engineering: { to: "/engineering", label: "🛠️ Инженерия" },
  sat: { to: "/sat", label: "📐 SAT" },
  ielts: { to: "/ielts", label: "🎧 IELTS" },
  ent: { to: "/ent", label: "🏛️ ЕНТ" },
  code: { to: "/coding", label: "💻 Код" },
  family: { to: "/family", label: "👪 Для родителей" },
  portfolio: { to: "/admissions?tab=portfolio", label: "🧰 Портфолио" },
  essays: { to: "/admissions?tab=essays", label: "✍️ Эссе с ИИ" },
  apps: { to: "/admissions?tab=apps", label: "📋 Мои заявки" },
  recs: { to: "/admissions?tab=recs", label: "🤝 Рекомендации" },
  money: { to: "/admissions?tab=money", label: "💸 Стипендии" },
  nu: { to: "/admissions?tab=nu", label: "🎯 NU и NUET" },
} satisfies Record<string, Rel>;

/** Sections that feed each other, by route prefix (longest prefix wins). */
const RELATED: [string, Rel[]][] = [
  ["/learn", [L.review, L.duels, L.nu, L.admissions]],
  ["/sat", [L.pathSat, L.pathRw, L.review, L.money]],
  ["/ielts", [L.pathIelts, L.essays, L.nu, L.library]],
  ["/ent", [L.pathEnt, L.nu, L.duels, L.review]],
  ["/duels", [L.pathEnt, L.ent, L.leaderboard, L.review]],
  ["/review", [L.pathSat, L.pathEnt, L.duels, L.leaderboard]],
  ["/coding", [L.pathCode, L.engineering, L.portfolio]],
  ["/engineering", [L.portfolio, L.pathCode, L.code]],
  ["/library", [L.ent, L.sat, L.ielts]],
  ["/admissions", [L.engineering, L.pathNuet, L.sat, L.ielts]],
  ["/leaderboard", [L.duels, L.review, L.pathSat]],
  ["/family", [L.leaderboard, L.review]],
  ["/profile", [L.family, L.leaderboard, L.admissions]],
  ["/app", [L.review, L.duels, L.admissions]],
];

function relatedFor(path: string): Rel[] {
  const hit = RELATED.filter(([p]) => path === p || path.startsWith(`${p}/`)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? [];
}

const short = (iso: string) => longDate(iso).replace(/ \d{4}$/, "");

/** Slim bar on top of every section: the plant, streak, XP, exam countdowns and related sections. */
export function EcosystemBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const {data:learning}=useLearning();
  if (!user || user.role !== "student") return null;
  const g = plantGrowth(user.xp);
  const exams = examCountdowns(user.goals);
  const related = relatedFor(pathname).filter(r=>routeAccess(r.to,user.learningProfile??EMPTY_LEARNING_PROFILE,user.goals,learning?.catalog)==='allow');
  return (
    <div className="mb-5 flex flex-col gap-2 rounded-3xl border border-border bg-[linear-gradient(135deg,#f3f7ff,#ffffff)] px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:bg-none">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold">
        <Link to="/learn" className="flex items-center gap-2 rounded-2xl pr-2 hover:bg-muted" title="Твоё растение растёт от любого задания на платформе">
          <span className="w-9 shrink-0">{user.plant ? <Plant species={user.plant} stage={g.stage} /> : <span className="text-2xl">🌱</span>}</span>
          <span className="leading-tight">
            <span className="block text-xs text-muted-foreground">мой план</span>
            {g.name}
          </span>
        </Link>
        <span className="flex items-center gap-1 text-[#ff9600]" title="Серия дней">
          <Flame className="size-4 fill-current" /> {user.streak}
        </span>
        <span className="flex items-center gap-1 text-[#1cb0f6]" title="XP со всех разделов">
          <Zap className="size-4 fill-current" /> {user.xp}
        </span>
        {exams.slice(0, 3).map((e) => (
          <Link key={e.id} to={MODULES[e.id === "ent" ? "ent" : e.id].to} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:border-primary" title={`Экзамен: ${longDate(e.date)}`}>
            <CalendarClock className="size-3.5 text-primary" />
            {e.label} · {e.approx ? monthLabel(e.date).replace(/ \d{4}$/, "") : short(e.date)} · <b className="tabular text-primary">{e.approx ? "~" : ""}
              {e.days} дн.
            </b>
          </Link>
        ))}
        <DeadlineChip />
      </div>
      {related.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">связано:</span>
          {related.map((r) => (
            <Link key={r.to} to={r.to} className="rounded-full bg-muted px-2.5 py-1 font-semibold hover:bg-primary/10 hover:text-primary">
              {r.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** The ecosystem as a picture: the plant in the middle, sections around it, joined by lines. */
export function EcosystemMap({ species = "sunflower", stage = 4, highlight, compact, className }: { species?: PlantSpecies; stage?: number; highlight?: ModuleId[]; compact?: boolean; className?: string }) {
  const ids = Object.keys(MODULES) as ModuleId[];
  const R = 38; // % radius of the ring
  const pos = ids.map((id, i) => {
    const a = (-90 + (360 / ids.length) * i) * (Math.PI / 180);
    return { id, x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) };
  });
  const lit = (id: ModuleId) => !highlight || highlight.includes(id);
  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-[460px]", className)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <circle cx={50} cy={50} r={R} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.4} strokeDasharray="1.2 1.4" />
        {pos.map((p) => (
          <motion.line key={p.id} x1={50} y1={50} x2={p.x} y2={p.y} stroke={MODULES[p.id].color} strokeOpacity={lit(p.id) ? 0.55 : 0.12} strokeWidth={0.6} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.9 }} />
        ))}
        {pos.map((p, i) => {
          const q = pos[(i + 1) % pos.length]!;
          return <line key={`r${p.id}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="currentColor" strokeOpacity={0.07} strokeWidth={0.4} />;
        })}
      </svg>
      <div className="absolute left-1/2 top-1/2 w-[30%] -translate-x-1/2 -translate-y-1/2">
        <Plant species={species} stage={stage} mood="happy" />
      </div>
      {pos.map((p, i) => {
        const m = MODULES[p.id];
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 * i, type: "spring", stiffness: 200, damping: 16 }}
            className="absolute flex w-[27%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span className={cn("grid size-12 place-items-center rounded-2xl text-2xl shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)] sm:size-14", !lit(p.id) && "opacity-35 grayscale")} style={{ background: `color-mix(in srgb, ${m.color} 16%, white)`, boxShadow: `0 4px 0 0 color-mix(in srgb, ${m.color} 45%, white)` }}>
              {m.emoji}
            </span>
            <span className={cn("mt-1.5 text-xs font-bold sm:text-sm", !lit(p.id) && "opacity-40")}>{m.label}</span>
            {!compact && <span className={cn("hidden text-[11px] leading-tight text-muted-foreground sm:block", !lit(p.id) && "opacity-40")}>{m.blurb}</span>}
          </motion.div>
        );
      })}
    </div>
  );
}
