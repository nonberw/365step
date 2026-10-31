import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Grid hero from 21st.dev (hero-1). `className` can shorten the section when it is used as a closing call to action.

interface HeroProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
}

export function Hero({ eyebrow = "Innovate Without Limits", title, subtitle, ctaLabel = "Explore Now", ctaHref = "#", className }: HeroProps) {
  return (
    <section
      id="hero"
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-b-xl px-6 pt-40 text-center md:px-8 min-h-[calc(100vh-40px)]",
        "bg-[linear-gradient(to_bottom,#fff,#ffffff_50%,#e3f3d3_88%)]",
        "dark:bg-[linear-gradient(to_bottom,#000,#0000_30%,#3a6a1d_78%,#ffffff_99%_50%)]",
        className,
      )}
    >
      {/* Grid BG */}
      <div
        className="absolute inset-0 -z-10 h-[600px] w-full opacity-80 bg-[linear-gradient(to_right,#e0efd2_1px,transparent_1px),linear-gradient(to_bottom,#e0efd2_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#2c4a1a_1px,transparent_1px),linear-gradient(to_bottom,#2c4a1a_1px,transparent_1px)] bg-[size:6rem_5rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"
      />

      {/* Radial Accent */}
      <div
        className="animate-fade-up absolute left-1/2 top-[calc(100%-90px)] h-[500px] w-[700px] -translate-x-1/2 rounded-[100%] border-[#58cc02] bg-white opacity-0 dark:bg-black md:h-[500px] md:w-[1100px] lg:top-[calc(100%-150px)] lg:h-[750px] lg:w-[140%] bg-[radial-gradient(closest-side,#fff_82%,#d9efc3)] dark:bg-[radial-gradient(closest-side,#000_82%,#58cc02)]"
      />

      {eyebrow && (
        <a href="#" className="group">
          <span className="mx-auto flex w-fit items-center justify-center rounded-3xl border-2 border-primary/20 bg-gradient-to-tr from-primary/10 via-primary/5 to-transparent px-5 py-2 text-sm font-bold uppercase tracking-tight text-muted-foreground">
            {eyebrow}
            <ChevronRight className="ml-2 inline h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </a>
      )}

      <h1 className="animate-fade-in -translate-y-4 text-balance bg-gradient-to-br from-[#17340c] from-30% to-[#17340c]/40 bg-clip-text py-6 text-5xl font-black leading-none tracking-tighter text-transparent opacity-0 sm:text-6xl md:text-7xl lg:text-8xl dark:from-white dark:to-white/40">
        {title}
      </h1>

      <p className="animate-fade-in mb-12 -translate-y-4 text-balance text-lg font-semibold tracking-tight text-muted-foreground opacity-0 md:text-xl">{subtitle}</p>

      {ctaLabel && (
        <div className="flex justify-center">
          <Button asChild size="lg" className="z-20 mt-[-20px] w-fit text-center text-lg md:w-60">
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
        </div>
      )}

      {/* Bottom Fade */}
      <div className="animate-fade-up relative mt-32 opacity-0 [perspective:2000px] after:absolute after:inset-0 after:z-50 after:[background:linear-gradient(to_top,var(--background)_10%,transparent)]" />
    </section>
  );
}
