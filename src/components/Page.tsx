import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Greeting banner on a sky gradient with soft clouds (same look as the landing hero).
 *  `image` and `position` are kept for existing callers; the sky replaces the painting. */
export function GreetingBanner({ title, subtitle, action, children }: { title: string; subtitle?: string; image?: string; position?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl text-white">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#3a6fd0_0%,#5e95e6_45%,#9cc2f2_100%)]" />
      <div aria-hidden className="absolute -right-10 -top-6 -z-10 h-32 w-80 rounded-full bg-white/35 blur-3xl" />
      <div aria-hidden className="absolute -bottom-10 left-1/3 -z-10 h-28 w-96 rounded-full bg-white/30 blur-3xl" />
      <div className="flex flex-col gap-4 px-6 py-7 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-9">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-semibold leading-tight sm:text-[34px]">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-sm text-white/80 sm:text-[15px]">{subtitle}</p>}
          {children}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </section>
  );
}

export function PageHeader({ eyebrow, title, description, action, className }: { eyebrow?: string; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight sm:text-[32px]">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</div>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

export function Loading({ label = "Загружаю…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ message, className }: { message: string; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("rounded-xl bg-[#fde3e4] px-4 py-3 text-sm text-destructive dark:bg-destructive/15", className)}>
      {message}
    </p>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-border bg-card p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 break-words font-display text-[22px] font-semibold leading-tight tabular sm:text-[28px]">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
