import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Pricing card from 21st.dev (dark-gradient-pricing). `featured` highlights the card, `onSelect` makes the button work.

interface BenefitProps {
  text: string;
  checked: boolean;
}

const Benefit = ({ text, checked }: BenefitProps) => {
  return (
    <div className="flex items-center gap-3">
      {checked ? (
        <span className="grid size-4 shrink-0 place-content-center rounded-full bg-primary text-sm text-primary-foreground">
          <Check className="size-3" />
        </span>
      ) : (
        <span className="grid size-4 shrink-0 place-content-center rounded-full bg-zinc-200 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          <X className="size-3" />
        </span>
      )}
      <span className={cn("text-sm text-zinc-600 dark:text-zinc-300", !checked && "text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-500")}>{text}</span>
    </div>
  );
};

interface PricingCardProps {
  tier: string;
  price: string;
  bestFor: string;
  CTA: string;
  benefits: Array<{ text: string; checked: boolean }>;
  featured?: boolean;
  badge?: string;
  onSelect?: () => void;
  className?: string;
}

export const PricingCard = ({ tier, price, bestFor, CTA, benefits, featured, badge, onSelect, className }: PricingCardProps) => {
  return (
    <motion.div initial={{ filter: "blur(2px)" }} whileInView={{ filter: "blur(0px)" }} viewport={{ once: true }} transition={{ duration: 0.5, ease: "easeInOut", delay: 0.25 }} className="h-full">
      <Card
        className={cn(
          "relative h-full w-full overflow-hidden border-2 p-6",
          "border-zinc-200 bg-gradient-to-br from-zinc-50/50 to-zinc-100/80",
          "dark:border-zinc-700 dark:from-zinc-950/50 dark:to-zinc-900/80",
          featured && "border-primary from-[#f1f5ff] to-[#dde7ff] dark:border-primary dark:from-[#0f1a33] dark:to-[#16254a]",
          className,
        )}
      >
        {badge && <span className="absolute right-4 top-4 rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-accent-foreground">{badge}</span>}
        <div className="flex flex-col items-center border-b border-zinc-200 pb-6 dark:border-zinc-700">
          <span className="mb-6 inline-block font-display text-lg font-extrabold text-zinc-900 dark:text-zinc-50">{tier}</span>
          <span className="mb-3 inline-block font-display text-4xl font-black">{price}</span>
          <span className="bg-gradient-to-br from-zinc-700 to-zinc-900 bg-clip-text text-center text-transparent dark:from-zinc-200 dark:to-zinc-500">{bestFor}</span>
        </div>
        <div className="space-y-4 py-9">
          {benefits.map((benefit, index) => (
            <Benefit key={index} {...benefit} />
          ))}
        </div>
        <Button className="w-full" variant={featured ? "default" : "outline"} onClick={onSelect}>
          {CTA}
        </Button>
      </Card>
    </motion.div>
  );
};
