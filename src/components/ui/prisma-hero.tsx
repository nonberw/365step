import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";

// Video hero from 21st.dev (prisma-hero): giant word-by-word headline over a looping video.
// Texts, links and the video are props; a green gradient shows while the video loads or if it is blocked.

/* ---------------- WordsPullUp ---------------- */
interface WordsPullUpProps {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  style?: React.CSSProperties;
}

export const WordsPullUp = ({ text, className = "", showAsterisk = false, style }: WordsPullUpProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const words = text.split(" ");

  return (
    <div ref={ref} className={`inline-flex flex-wrap ${className}`} style={style}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        return (
          <motion.span
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="relative inline-block"
            style={{ marginRight: isLast ? 0 : "0.25em" }}
          >
            {word}
            {showAsterisk && isLast && <span className="absolute top-[0.65em] -right-[0.3em] text-[0.31em]">*</span>}
          </motion.span>
        );
      })}
    </div>
  );
};

/* ---------------- WordsPullUpMultiStyle ---------------- */
interface Segment {
  text: string;
  className?: string;
}

export const WordsPullUpMultiStyle = ({ segments, className = "", style }: { segments: Segment[]; className?: string; style?: React.CSSProperties }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const words: { word: string; className?: string }[] = [];
  segments.forEach((seg) => seg.text.split(" ").forEach((w) => w && words.push({ word: w, className: seg.className })));

  return (
    <div ref={ref} className={`inline-flex flex-wrap justify-center ${className}`} style={style}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className={`inline-block ${w.className ?? ""}`}
          style={{ marginRight: "0.25em" }}
        >
          {w.word}
        </motion.span>
      ))}
    </div>
  );
};

/* ---------------- Hero ---------------- */
export interface PrismaHeroProps {
  brand: string;
  nav: { label: string; href: string }[];
  description: string;
  cta: { label: string; href: string };
  videoSrc?: string;
}

const VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4";

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const cls = "text-[11px] font-bold text-[#e9f7d8]/80 transition-colors hover:text-white sm:text-xs md:text-sm";
  return href.startsWith("/") ? (
    <Link to={href} className={cls}>
      {children}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {children}
    </a>
  );
};

export const PrismaHero = ({ brand, nav, description, cta, videoSrc = VIDEO }: PrismaHeroProps) => {
  return (
    <section className="h-screen min-h-[560px] w-full p-2 sm:p-3">
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#0b1014,#1f48b0_55%,#4f7cf0)] md:rounded-[2rem]">
        {/* Background video */}
        <video autoPlay loop muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" src={videoSrc} />

        {/* Green tint keeps the brand colors over any footage */}
        <div className="pointer-events-none absolute inset-0 bg-[#1f48b0]/35 mix-blend-multiply" />
        <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.5] mix-blend-overlay" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#0b0f17]/80" />

        {/* Navbar */}
        <nav className="absolute left-1/2 top-0 z-20 -translate-x-1/2" aria-label="Разделы">
          <div className="flex items-center gap-3 rounded-b-2xl bg-[#0b0f17] px-4 py-2 sm:gap-6 md:gap-10 md:rounded-b-3xl md:px-8">
            {nav.map((item) => (
              <NavLink key={item.label} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-2 sm:px-6 md:px-10">
          <div className="grid grid-cols-12 items-end gap-4">
            <div className="col-span-12 lg:col-span-8">
              <h1 className="text-[22vw] font-black leading-[0.85] tracking-[-0.06em] text-white sm:text-[18vw] md:text-[15vw] lg:text-[12vw]">
                <WordsPullUp text={brand} showAsterisk />
              </h1>
            </div>

            <div className="col-span-12 flex flex-col gap-5 pb-6 lg:col-span-4 lg:pb-10">
              <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }} className="text-sm font-semibold text-white/85 md:text-base" style={{ lineHeight: 1.25 }}>
                {description}
              </motion.p>

              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }} className="self-start">
                <Link
                  to={cta.href}
                  className="group inline-flex items-center gap-2 rounded-full bg-[#8fb0ff] py-1 pl-5 pr-1 text-sm font-extrabold text-[#0b0f17] shadow-[0_4px_0_0_#163a8f] transition-all hover:gap-3 active:translate-y-1 active:shadow-none sm:text-base"
                >
                  {cta.label}
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0b0f17] transition-transform group-hover:scale-110 sm:h-10 sm:w-10">
                    <ArrowRight className="h-4 w-4 text-[#8fb0ff]" />
                  </span>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
