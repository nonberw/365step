import { clsx } from "clsx";
import { motion } from "framer-motion";

// Bento grid from 21st.dev (bento). Cards and headings come in as props.

export interface BentoItem {
  eyebrow: string;
  title: string;
  description: string;
  /** background image of the card */
  image: string;
}

export default function FUIBentoGridDark({ title, subtitle, items }: { title: string; subtitle: string; items: BentoItem[] }) {
  const classes = [
    "max-lg:rounded-t-4xl lg:col-span-3 lg:rounded-tl-4xl",
    "lg:col-span-3 lg:rounded-tr-4xl",
    "lg:col-span-2 lg:rounded-bl-4xl",
    "lg:col-span-2",
    "max-lg:rounded-b-4xl lg:col-span-2 lg:rounded-br-4xl",
  ];
  return (
    <div className="container mx-auto flex flex-col px-4 py-10 sm:px-10">
      <h2 className="text-3xl font-black tracking-tight md:text-5xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-xl font-bold tracking-tight text-muted-foreground md:text-2xl/8">{subtitle}</p>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-14 lg:grid-cols-6 lg:grid-rows-2">
        {items.slice(0, 5).map((it, i) => (
          <BentoCard
            key={it.title}
            eyebrow={it.eyebrow}
            title={it.title}
            description={it.description}
            graphic={<div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${it.image})` }} />}
            className={classes[i]}
          />
        ))}
      </div>
    </div>
  );
}

export function BentoCard({
  dark = false,
  className = "",
  eyebrow,
  title,
  description,
  graphic,
  fade = [],
}: {
  dark?: boolean;
  className?: string;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  graphic?: React.ReactNode;
  fade?: ("top" | "bottom")[];
}) {
  return (
    <motion.div
      initial="idle"
      whileHover="active"
      variants={{ idle: {}, active: {} }}
      data-dark={dark ? "true" : undefined}
      className={clsx(className, "group relative flex flex-col overflow-hidden rounded-3xl", "transform-gpu bg-[#0f1a33] shadow-[0_6px_0_0_#0b1014] ring-1 ring-white/10", "data-[dark]:bg-gray-800 data-[dark]:ring-white/15")}
    >
      <div className="relative h-[22rem] shrink-0 overflow-hidden">
        {graphic}
        {fade.includes("top") && <div className="absolute inset-0 bg-gradient-to-b from-white to-50% opacity-25" />}
        {fade.includes("bottom") && <div className="absolute inset-0 bg-gradient-to-t from-white to-50% opacity-25" />}
      </div>
      <div className="relative isolate z-20 mt-[-110px] h-[14rem] bg-gradient-to-t from-[#0f1a33] via-[#0f1a33]/85 to-transparent p-8 text-white backdrop-blur-sm">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8fb0ff]">{eyebrow}</h3>
        <p className="mt-1 text-2xl/8 font-extrabold tracking-tight">{title}</p>
        <p className="mt-2 max-w-[600px] text-sm/6 text-white/75">{description}</p>
      </div>
    </motion.div>
  );
}
