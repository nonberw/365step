import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { plantGrowth } from "@shared/plants";
import { Aurora } from "@/components/Aurora";
import { Plant } from "@/components/Plant";
import { HeroPill, StarIcon } from "@/components/ui/hero-pill";

/** Section banner shared by every module: the sky with drifting clouds, a 21st Hero Pill, a serif headline
 *  and the student's plant on the right. `image` and `position` are kept for existing callers. */
export function GreetingBanner({ title, subtitle, eyebrow, action, children }: { title: string; subtitle?: string; eyebrow?: string; image?: string; position?: string; action?: ReactNode; children?: ReactNode }) {
  const { user } = useAuth();
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#2f69cf_0%,#4f8ae0_55%,#8ab7ef_100%)] text-white">
      <Aurora />
      <div className="relative flex items-end gap-4 px-6 py-7 sm:px-8 sm:py-9">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow && <HeroPill tone="glass" icon={<StarIcon />} text={eyebrow} className="mb-3" />}
            <h1 className="font-display text-[28px] font-bold leading-tight [text-shadow:0_2px_18px_rgba(24,61,154,0.35)] sm:text-[38px]">{title}</h1>
            {subtitle && <p className="mt-1.5 max-w-xl text-sm text-white/90 sm:text-[15px]">{subtitle}</p>}
            {children}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {user?.plant && (
          <div className="hidden w-24 shrink-0 md:block" title="Твоё растение растёт от заданий в любом разделе">
            <Plant species={user.plant} stage={plantGrowth(user.xp).stage} mood="happy" />
          </div>
        )}
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
