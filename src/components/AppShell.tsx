import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Target,
  Box,
  CircuitBoard,
  Cpu,
  Plane,
  BookOpen,
  BookText,
  Bot,
  Bug,
  Calculator,
  RotateCcw,
  Code2,
  Gamepad2,
  GraduationCap,
  Headphones,
  Home,
  Compass,
  Crown,
  Library,
  LibraryBig,
  LineChart,
  LogOut,
  Medal,
  Menu,
  Mic,
  Moon,
  PenLine,
  Sparkles,
  Sun,
  Swords,
  Timer,
  Trophy,
  User,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: typeof Home; end?: boolean };
type Group = { title?: string; items: Item[] };

const STUDENT_NAV: Group[] = [
  {
    items: [
      { to: "/app", label: "Главная", icon: Home, end: true },
      { to: "/admissions", label: "Поступление", icon: Compass },
      { to: "/library", label: "Библиотека", icon: LibraryBig },
    ],
  },
  {
    title: "ЕНТ",
    items: [
      { to: "/ent", label: "Подготовка к ЕНТ", icon: Medal, end: true },
      { to: "/ent/master", label: "Мастер-режим (IRT)", icon: Cpu },
      { to: "/review", label: "Повтор ошибок", icon: RotateCcw },
      { to: "/duels", label: "Дуэли и лига", icon: Swords },
    ],
  },
  {
    title: "SAT",
    items: [
      { to: "/sat", label: "Обзор и аналитика", icon: LineChart, end: true },
      { to: "/sat/learn", label: "Учить Math и R&W", icon: GraduationCap },
      { to: "/sat/bank", label: "Банк вопросов", icon: Library },
      { to: "/sat/test", label: "Пробный тест", icon: Timer },
      { to: "/sat/drills", label: "Тренировки", icon: Target },
      { to: "/sat/blitz", label: "Blitz", icon: Zap },
      { to: "/sat/vocab", label: "Словарь", icon: BookOpen },
      { to: "/sat/plan", label: "ИИ-план", icon: Sparkles },
      { to: "/sat/calculator", label: "Калькулятор баллов", icon: Calculator },
    ],
  },
  {
    title: "IELTS",
    items: [
      { to: "/ielts", label: "Обзор", icon: GraduationCap, end: true },
      { to: "/ielts/speaking", label: "Speaking", icon: Mic },
      { to: "/ielts/writing", label: "Writing", icon: PenLine },
      { to: "/ielts/reading", label: "Reading", icon: BookText },
      { to: "/ielts/listening", label: "Listening", icon: Headphones },
      { to: "/ielts/games", label: "Игры", icon: Gamepad2 },
    ],
  },
  {
    title: "Кодинг",
    items: [
      { to: "/coding", label: "Задачи", icon: Code2, end: true },
      { to: "/coding/lessons", label: "Уроки с ИИ", icon: Bot },
      { to: "/coding/blitz", label: "Bug Blitz", icon: Bug },
    ],
  },
  {
    title: "Инженерия",
    items: [
      { to: "/engineering", label: "Лаборатория", icon: Cpu, end: true },
      { to: "/engineering/drone", label: "Дроны", icon: Plane },
      { to: "/engineering/cad/box", label: "CAD и 3D", icon: Box },
      { to: "/engineering/cad-studio", label: "ИИ-конструктор", icon: Sparkles },
      { to: "/engineering/arduino/blink", label: "Arduino", icon: CircuitBoard },
    ],
  },
  {
    items: [
      { to: "/leaderboard", label: "Рейтинг", icon: Trophy },
      { to: "/family", label: "Для родителей", icon: UsersRound },
      { to: "/pricing", label: "Тариф Pro", icon: Crown },
      { to: "/profile", label: "Профиль", icon: User },
    ],
  },
];

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("nc-theme") === "dark";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("nc-theme", dark ? "dark" : "light");
    } catch {
      // per-viewer convenience only
    }
  }, [dark]);
  return [dark, setDark] as const;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[17px] font-extrabold tracking-wide", className)}>
      НУРБЕК <span className="text-primary">ЧУРБЕК</span>
    </span>
  );
}

export default function AppShell() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useTheme();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  if (!user) return null;
  const nav = STUDENT_NAV;

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Разделы">
      <div className="mb-3 flex items-center justify-between px-2">
        <Logo />
        <div className="flex gap-1">
          <IconButton label={dark ? "Светлая тема" : "Тёмная тема"} onClick={() => setDark(!dark)}>
            {dark ? <Sun /> : <Moon />}
          </IconButton>
          <IconButton label="Закрыть меню" onClick={() => setOpen(false)} className="lg:hidden">
            <X />
          </IconButton>
        </div>
      </div>
      {nav.map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5 py-1.5">
          {g.title && <p className="px-3 pb-1 pt-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.title}</p>}
          {g.items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-card hover:text-foreground",
                  isActive && "bg-card text-foreground shadow-sm ring-1 ring-border",
                )
              }
            >
              <it.icon className="size-4 shrink-0" aria-hidden="true" />
              {it.label}
            </NavLink>
          ))}
        </div>
      ))}
      <div className="mt-auto flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
          {user.firstName.slice(0, 1)}
          {user.lastName.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{`${user.firstName} ${user.lastName}`}</p>
          <p className="truncate text-xs text-muted-foreground">{user.plan === "pro" ? `Pro до ${new Date(user.planUntil ?? 0).toLocaleDateString("ru-RU")}` : "Тариф «Старт»"}</p>
        </div>
        <IconButton label="Выйти" onClick={signOut}>
          <LogOut />
        </IconButton>
      </div>
    </nav>
  );

  return (
    <div className="min-h-full bg-sidebar lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh lg:block">{sidebar}</aside>

      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <IconButton label="Открыть меню" onClick={() => setOpen(true)}>
          <Menu />
        </IconButton>
        <Logo />
        <span className="size-9" />
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[290px] max-w-[85vw] bg-sidebar shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <main className="min-w-0 p-2 sm:p-3 lg:py-3 lg:pl-0 lg:pr-3">
        <div className="min-h-[calc(100dvh-24px)] rounded-3xl bg-card px-4 py-5 ring-1 ring-border sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function IconButton({ label, children, onClick, className }: { label: string; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4", className)}
    >
      {children}
    </button>
  );
}
