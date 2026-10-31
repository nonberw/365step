import { cn } from "@/lib/utils";

// Hero Pill from 21st.dev (originui/hero-pill). `tone="glass"` is the variant for the sky heroes.

interface HeroPillProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  text: string;
  className?: string;
  /** @default true */
  animate?: boolean;
  tone?: "default" | "glass";
}

export function HeroPill({ icon, text, className, animate = true, tone = "default", ...props }: HeroPillProps) {
  return (
    <div className={cn(animate && "animate-slide-up-fade", className)} {...props}>
      <p
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium shadow-sm transition-colors",
          tone === "glass" ? "border border-white/45 bg-white/25 text-white shadow-black/10 backdrop-blur hover:bg-white/35" : "bg-background text-foreground shadow-black/[.12] hover:bg-accent/80 dark:bg-accent",
        )}
      >
        {icon && <span className={cn("mr-2 flex shrink-0 border-r pr-2", tone === "glass" ? "border-white/40" : "border-border")}>{icon}</span>}
        {text}
      </p>
    </div>
  );
}

export function StarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} fill="none" className="transition-transform duration-300 group-hover:scale-110">
      <path className="fill-current" d="M6.958.713a1 1 0 0 0-1.916 0l-.999 3.33-3.33 1a1 1 0 0 0 0 1.915l3.33.999 1 3.33a1 1 0 0 0 1.915 0l.999-3.33 3.33-1a1 1 0 0 0 0-1.915l-3.33-.999-1-3.33Z" />
    </svg>
  );
}
