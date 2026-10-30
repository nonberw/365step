import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** The painting banner with a greeting, like the reference dashboard. */
export function GreetingBanner({ title, subtitle, image, position = "center 30%", action, children }: { title: string; subtitle?: string; image: string; position?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-secondary text-white">
      <img src={image} alt="" className="absolute inset-0 -z-10 size-full object-cover" style={{ objectPosition: position }} />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#1a0001]/90 via-[#1a0001]/45 to-transparent sm:bg-gradient-to-r sm:from-[#2a0002]/90 sm:via-[#2a0002]/50 sm:to-transparent" />
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
