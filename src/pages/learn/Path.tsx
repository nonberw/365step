import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Crown, Dumbbell, Flame, Gift, Heart, Lock, Star, Zap } from "lucide-react";
import type { CourseId, PathNode, PathUnit, PathView } from "@shared/path";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading } from "@/components/Page";
import { Plant, PlantCard } from "@/components/Plant";
import { useNotify } from "@/components/Notify";
import { buttonVariants } from "@/components/ui/button";
import { plantGrowth } from "@shared/plants";

// The learning path (Duolingo-style): units with a winding line of nodes, and the student's plant
// standing next to the node they are on.

const ZIG = [0, 44, 72, 44, 0, -44, -72, -44];
const COURSE_KEY = "nc-course";

interface CourseInfo {
  id: CourseId;
  title: string;
  short: string;
  emoji: string;
  done: number;
  total: number;
}

const shade = (hex: string, k = 0.25) => `color-mix(in srgb, ${hex} ${100 - k * 100}%, black)`;

function NodeIcon({ n }: { n: PathNode }) {
  if (n.status === "locked") return n.kind === "chest" ? <Gift /> : <Lock />;
  if (n.kind === "chest") return <Gift />;
  if (n.kind === "review") return <Dumbbell />;
  if (n.status === "done" && n.level >= n.maxLevel) return <Crown />;
  if (n.status === "done") return <Check />;
  return <Star className="fill-current" />;
}

/** Ring around a finished node: one arc per crown. */
function CrownRing({ level, max, color }: { level: number; max: number; color: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute -inset-[10px] size-[calc(100%+20px)] -rotate-90">
      <circle cx={50} cy={50} r={r} fill="none" stroke="var(--border)" strokeWidth={5} />
      <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${(c * level) / max} ${c}`} />
    </svg>
  );
}

function NodeButton({ n, color, onClick }: { n: PathNode; color: string; onClick: () => void }) {
  const locked = n.status === "locked";
  const face = locked ? "#e5e7eb" : color;
  const style: CSSProperties = { background: face, boxShadow: `0 7px 0 0 ${locked ? "#c9ced6" : shade(color)}` };
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${n.title}: ${locked ? "закрыто" : n.status === "current" ? "сейчас здесь" : `уровень ${n.level} из ${n.maxLevel}`}`}
      className={cn("relative grid size-[70px] place-items-center rounded-full transition-transform active:translate-y-[5px] [&_svg]:size-7", locked ? "text-[#9aa1ad]" : "text-white")}
      style={style}
    >
      {n.status === "done" && n.kind !== "chest" && <CrownRing level={n.level} max={n.maxLevel} color={color} />}
      {n.status === "current" && <span className="absolute -inset-[9px] rounded-full border-[5px] opacity-40" style={{ borderColor: color }} />}
      <NodeIcon n={n} />
    </button>
  );
}

function Popover({ n, unit, course, onClose, onChest }: { n: PathNode; unit: PathUnit; course: CourseId; onClose: () => void; onChest: () => void }) {
  const locked = n.status === "locked";
  const lesson = n.kind !== "chest";
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.96, x: "-50%" }}
      animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
      className="absolute left-1/2 top-[86px] z-30 w-[290px] rounded-2xl p-4 text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.35)]"
      style={{ background: locked ? "#9aa1ad" : unit.color }}
      onClick={(e) => e.stopPropagation()}
    >
      <span aria-hidden className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rotate-45" style={{ background: locked ? "#9aa1ad" : unit.color }} />
      <p className="font-display text-lg font-bold leading-tight">{n.title}</p>
      <p className="mt-0.5 text-sm text-white/85">{locked ? "Сначала пройди все уровни перед этим" : n.href ? n.subtitle : lesson ? `${n.subtitle} · уровень ${Math.min(n.level + 1, n.maxLevel)} из ${n.maxLevel}` : n.subtitle}</p>
      {!locked &&
        (n.href ? (
          <Link
            to={n.href}
            className="mt-3 flex h-11 items-center justify-center rounded-xl bg-white font-display text-[15px] font-bold shadow-[0_4px_0_0_rgba(0,0,0,0.18)] active:translate-y-1 active:shadow-none"
            style={{ color: unit.color }}
          >
            {n.status === "done" ? "Открыть решение" : "Решить задачу"}
          </Link>
        ) : lesson ? (
          <Link
            to={`/learn/${course}/${n.id}`}
            className="mt-3 flex h-11 items-center justify-center rounded-xl bg-white font-display text-[15px] font-bold shadow-[0_4px_0_0_rgba(0,0,0,0.18)] active:translate-y-1 active:shadow-none"
            style={{ color: unit.color }}
          >
            {n.status === "done" ? (n.level >= n.maxLevel ? "Повторить ещё раз +10 XP" : "Следующий уровень +10 XP") : "Начать +10 XP"}
          </Link>
        ) : n.level > 0 ? (
          <p className="mt-3 rounded-xl bg-white/20 py-2.5 text-center text-sm font-semibold">Сундук открыт</p>
        ) : (
          <button type="button" onClick={onChest} className="mt-3 h-11 w-full rounded-xl bg-white font-display text-[15px] font-bold shadow-[0_4px_0_0_rgba(0,0,0,0.18)] active:translate-y-1 active:shadow-none" style={{ color: unit.color }}>
            Открыть сундук
          </button>
        ))}
      <button type="button" onClick={onClose} className="sr-only">
        Закрыть
      </button>
    </motion.div>
  );
}

function UnitBanner({ unit, index }: { unit: PathUnit; index: number }) {
  const done = unit.nodes.filter((n) => n.level > 0).length;
  return (
    <div className="sticky top-[68px] z-20 flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-white" style={{ background: unit.color, boxShadow: `0 5px 0 0 ${shade(unit.color)}` }}>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">Юнит {index + 1}</p>
        <p className="truncate font-display text-xl font-bold">{unit.title}</p>
        <p className="truncate text-sm text-white/80">{unit.description}</p>
      </div>
      <span className="shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-bold tabular">
        {done}/{unit.nodes.length}
      </span>
    </div>
  );
}

export default function Path() {
  const { user, refresh } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const courses = useApi<{ courses: CourseInfo[]; suggested: CourseId }>("/path");
  const [selected, setSelected] = useState<string | null>(null);

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(COURSE_KEY);
  } catch {
    // per-viewer convenience only
  }
  const courseId = (params.get("course") ?? stored ?? courses.data?.suggested ?? null) as CourseId | null;
  const path = useApi<PathView>(courseId ? `/path/${courseId}` : null);

  useEffect(() => {
    if (!courseId) return;
    try {
      localStorage.setItem(COURSE_KEY, courseId);
    } catch {
      // per-viewer convenience only
    }
  }, [courseId]);

  if (courses.loading || path.loading) return <Loading />;
  if (!courses.data) return <ErrorBox message={courses.error} />;
  if (!path.data) return <ErrorBox message={path.error} />;
  const v = path.data;
  const pro = user?.plan === "pro";
  const stage = user ? plantGrowth(user.xp).stage : 1;

  async function openChest(nodeId: string) {
    try {
      const r = await api<{ xp: number }>(`/path/${v.course}/${nodeId}/chest`, { body: {} });
      notify({ variant: "success", title: `Сундук открыт: +${r.xp} XP`, body: "Растение стало чуть ближе к новой стадии." });
      setSelected(null);
      await Promise.all([path.reload(), refresh()]);
    } catch (e) {
      notify({ variant: "error", title: "Не получилось открыть", body: (e as Error).message });
    }
  }

  let order = 0;
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]" onClick={() => setSelected(null)}>
      <div className="mx-auto w-full max-w-[600px]">
        {/* top bar: course, streak, XP, hearts */}
        <div className="sticky top-0 z-30 -mx-1 mb-4 flex items-center justify-between gap-2 bg-card/95 px-1 py-3 backdrop-blur">
          <div className="flex gap-1.5 overflow-x-auto">
            {courses.data.courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setParams({ course: c.id })}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-sm font-bold", c.id === v.course ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}
              >
                <span aria-hidden>{c.emoji}</span>
                {c.short}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm font-bold">
            <span className="flex items-center gap-1 text-[#ff9600]" title="Серия дней">
              <Flame className="size-5 fill-current" /> {v.streak}
            </span>
            <span className="flex items-center gap-1 text-[#1cb0f6]" title="XP">
              <Zap className="size-5 fill-current" /> {user?.xp ?? 0}
            </span>
            <span className="flex items-center gap-1 text-[#ff4b4b]" title={pro ? "Pro: сердечки без ограничений" : "Сердечки на урок"}>
              <Heart className="size-5 fill-current" /> {pro ? "∞" : 5}
            </span>
          </div>
        </div>

        {v.note && <p className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground/80">{v.note}</p>}
        <div className="flex flex-col gap-10 pb-16">
          {v.units.map((unit, ui) => (
            <section key={unit.id} className="flex flex-col gap-6">
              <UnitBanner unit={unit} index={ui} />
              <div className="flex flex-col items-center gap-7 pb-2 pt-12">
                {unit.nodes.map((n) => {
                  const x = ZIG[order++ % ZIG.length]!;
                  const plantSide = x > 0 ? -1 : 1;
                  return (
                    <div key={n.id} className="relative flex justify-center" style={{ transform: `translateX(${x}px)`, zIndex: selected === n.id ? 40 : n.status === "current" ? 10 : undefined }}>
                      {n.status === "current" && (
                        <motion.span initial={{ y: 0 }} animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} className="absolute -top-11 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border-2 border-border bg-card px-3 py-1.5 font-display text-sm font-bold uppercase" style={{ color: unit.color }}>
                          {n.level > 0 ? "Ещё раз" : "Начать"}
                          <span aria-hidden className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-border bg-card" />
                        </motion.span>
                      )}
                      <NodeButton n={n} color={unit.color} onClick={() => setSelected(selected === n.id ? null : n.id)} />
                      {n.status === "current" && user?.plant && (
                        <motion.div
                          layoutId="path-plant"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 240, damping: 20 }}
                          className="pointer-events-none absolute top-1/2 w-[110px] -translate-y-[60%]"
                          style={{ [plantSide > 0 ? "left" : "right"]: "calc(100% + 26px)" }}
                        >
                          <Plant species={user.plant} stage={stage} mood="happy" />
                        </motion.div>
                      )}
                      {selected === n.id && <Popover n={n} unit={unit} course={v.course} onClose={() => setSelected(null)} onChest={() => openChest(n.id)} />}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <p className="text-center text-sm text-muted-foreground">
            Пройдено {v.done} из {v.total} уровней
          </p>
        </div>
      </div>

      {/* right rail */}
      <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        {user?.plant ? (
          <div className="rounded-3xl border border-border bg-card p-4">
            <PlantCard species={user.plant} xp={user.xp} />
          </div>
        ) : (
          <button type="button" onClick={() => navigate("/profile#plant")} className="rounded-3xl border-2 border-dashed border-primary/40 p-4 text-left font-display font-bold text-primary">
            Выбери растение-спутника — оно пойдёт с тобой по пути →
          </button>
        )}
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-bold">Цель дня</p>
            <span className="text-sm font-bold tabular text-muted-foreground">
              {Math.min(v.todayXp, v.dailyGoal)}/{v.dailyGoal} XP
            </span>
          </div>
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[#ff9600] transition-[width]" style={{ width: `${Math.min(100, (v.todayXp / v.dailyGoal) * 100)}%` }} />
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="font-display text-lg font-bold">Задания дня</p>
          <ul className="mt-3 flex flex-col gap-4">
            {v.quests.map((q) => (
              <li key={q.id}>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{q.title}</span>
                  {q.value >= q.goal ? <Check className="size-4 text-success" /> : <span className="tabular text-muted-foreground">{q.value}/{q.goal}</span>}
                </div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(q.value / q.goal) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        {!pro && (
          <div className="rounded-3xl bg-[linear-gradient(135deg,#2f5bc8,#6f95ff)] p-5 text-white">
            <p className="font-display text-lg font-bold">Pro: без ограничений</p>
            <p className="mt-1 text-sm text-white/85">Безлимитные сердечки на уроках, ИИ-разборы и личный план.</p>
            <Link to="/pricing" className={cn(buttonVariants({ variant: "outline" }), "mt-4 w-full border-white/40 bg-white text-primary")}>
              Попробовать Pro
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
