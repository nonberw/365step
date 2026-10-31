import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PLANTS, STAGE_NAMES, STAGE_XP, type PlantSpecies } from "@shared/plants";
import { BrandMark, Logo } from "@/components/AppShell";
import { buttonVariants } from "@/components/ui/button";
import { Plant, PlantPicker } from "@/components/Plant";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PricingBlock } from "./Pricing";
import { SatMock } from "./landing/Mocks";
import { PhoneChat, Sticker, type ChatMessage } from "./landing/PhoneChat";
import { PlanCard, ScoreCard, Sky, SpeakingCard, WritingCard } from "./landing/Showcase";

// Landing: folk's friendly chat-in-a-phone, stickers and serif headings, with grader's sky hero,
// glass product cards and alternating feature sections.

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

const CHAT: ChatMessage[] = [
  { from: "me", file: "essay_task2.docx", text: "проверь эссе плиз 🙏" },
  {
    from: "them",
    text: "готово. ielts writing — 6.5",
    card: (
      <span className="grid grid-cols-4 gap-1 rounded-xl bg-white p-1.5 text-center text-[10px] font-semibold text-[#333]">
        {[
          ["TR", "6.5"],
          ["CC", "7"],
          ["LR", "6"],
          ["GRA", "6.5"],
        ].map(([k, v]) => (
          <span key={k} className="rounded-lg bg-[#f1f3f8] py-1">
            {k}
            <b className="block text-[13px] text-[#111]">{v}</b>
          </span>
        ))}
      </span>
    ),
  },
  { from: "them", text: "3 ошибки с артиклями и два раза «however». поправишь — будет 7.0" },
  { from: "me", text: "а что завтра?" },
  { from: "them", text: "sat math, 20 минут: проценты и системы. напомню в 19:00 ⏰" },
  { from: "them", text: "кстати, твой подсолнух зацвёл 🌻" },
];

const FEATURES = [
  { emoji: "📝", bubble: "6.5 → 7.0, если уберёшь 3 ошибки", title: "разбирает каждую ошибку", text: "эссе, речь, задачи SAT и ЕНТ. объясняет, почему верно именно так, и даёт похожее задание." },
  { emoji: "🔥", bubble: "серия 12 дней. не сливай сегодня", title: "держит в тонусе", text: "серия дней, XP, лига недели и дуэли с друзьями. и растение, которое растёт вместе с тобой." },
  { emoji: "🗓️", bubble: "до sat 58 дней. сегодня — проценты", title: "строит план до экзамена", text: "знает дату экзамена и твои слабые темы. каждый день — понятный маршрут на 20–90 минут." },
  { emoji: "✈️", bubble: "пиши сюда или в telegram", title: "живёт там, где ты", text: "в браузере, на телефоне и в Telegram-боте. родителям — короткий отчёт по пятницам." },
];

function FeatureCard({ f }: { f: (typeof FEATURES)[number] }) {
  return (
    <div className="flex h-full flex-col rounded-[32px] bg-[linear-gradient(160deg,#eef1fd,#f7f8ff_60%,#ffffff)] p-7 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_10px_30px_-20px_rgba(24,61,154,0.35)]">
      <div className="relative mb-7 h-[92px]">
        <span className="sticker absolute left-0 top-0 text-[64px] leading-none" style={{ transform: "rotate(-8deg)" }}>
          {f.emoji}
        </span>
        <span className="absolute bottom-1 left-16 max-w-[240px] rounded-[18px] rounded-bl-[6px] border border-[#2f5bc8]/25 px-3.5 py-2 text-sm leading-snug text-[#0b1a3a] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_6px_14px_-8px_rgba(24,61,154,0.5)]" style={{ background: "linear-gradient(#d8e6ff,#a9c6ff)" }}>
          {f.bubble}
        </span>
      </div>
      <h3 className="font-display text-[22px] font-bold lowercase">{f.title}</h3>
      <p className="mt-2 font-display text-[16px] leading-relaxed text-[#1f2a2f]/70">{f.text}</p>
    </div>
  );
}

function Split({ eyebrow, title, italic, text, cta, href, visual, flip }: { eyebrow: string; title: string; italic: string; text: string; cta: string; href: string; visual: ReactNode; flip?: boolean }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
      <Reveal className={cn(flip && "lg:order-2")}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h2 className="mt-3 font-display text-4xl font-bold leading-[1.05] sm:text-5xl">
          {title}
          <br />
          <em className="font-medium text-[#1f2a2f]/45">{italic}</em>
        </h2>
        <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted-foreground">{text}</p>
        <Link to={href} className={cn(buttonVariants({ size: "lg" }), "mt-8")}>
          {cta} <ArrowRight />
        </Link>
      </Reveal>
      <Reveal delay={0.1} className={cn("relative", flip && "lg:order-1")}>
        <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,#c9d9ff,transparent)] opacity-70" />
        {visual}
      </Reveal>
    </section>
  );
}

function PlantDemo() {
  const [species, setSpecies] = useState<PlantSpecies>("sunflower");
  const [stage, setStage] = useState(4);
  return (
    <div className="grid items-center gap-8 rounded-[36px] bg-[linear-gradient(160deg,#eef1fd,#ffffff)] p-6 sm:p-10 lg:grid-cols-[320px_1fr]">
      <div className="rounded-[28px] bg-white p-6 shadow-[0_10px_30px_-18px_rgba(24,61,154,0.4)]">
        <Plant species={species} stage={stage} className="mx-auto max-w-[220px]" />
        <p className="mt-2 text-center font-display text-xl font-bold">
          {PLANTS[species].name} · {STAGE_NAMES[stage - 1]}
        </p>
        <input type="range" min={1} max={5} step={1} value={stage} onChange={(e) => setStage(Number(e.target.value))} aria-label="Стадия роста" className="mt-4 w-full accent-[var(--primary)]" />
        <p className="mt-1 text-center text-xs font-semibold text-muted-foreground">{STAGE_XP[stage - 1] === 0 ? "старт" : `от ${STAGE_XP[stage - 1]} XP`}</p>
      </div>
      <div>
        <PlantPicker value={species} onChange={setSpecies} />
        <p className="mt-5 font-display text-[17px] leading-relaxed text-[#1f2a2f]/70">каждый верный ответ, урок и пробник приносят XP. растение проходит пять стадий, а если день пропущен — ничего не вянет. вернёшься, и продолжите вместе.</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const home = user ? "/learn" : "/register";

  return (
    <div className="overflow-x-clip bg-background text-[#1f2a2f]">
      {/* floating glass navigation (grader) */}
      <header className="fixed inset-x-0 top-3 z-50 px-3">
        <nav className="glass mx-auto flex max-w-5xl items-center justify-between rounded-full py-2 pl-4 pr-2 shadow-[0_10px_30px_-18px_rgba(24,61,154,0.5)]" aria-label="Разделы">
          <Link to="/" aria-label="Росток — на главную">
            <Logo />
          </Link>
          <div className="hidden items-center gap-6 font-display text-[15px] font-semibold text-[#1f2a2f]/70 md:flex">
            <a href="#features" className="hover:text-[#1f2a2f]">возможности</a>
            <a href="#plant" className="hover:text-[#1f2a2f]">растение</a>
            <a href="#pricing" className="hover:text-[#1f2a2f]">тарифы</a>
          </div>
          <div className="flex items-center gap-2">
            {!user && (
              <Link to="/login" className="hidden px-3 font-display text-[15px] font-semibold text-[#1f2a2f]/70 hover:text-[#1f2a2f] sm:block">
                войти
              </Link>
            )}
            <Link to={home} className={cn(buttonVariants(), "rounded-full")}>
              {user ? "в кабинет" : "начать бесплатно"}
            </Link>
          </div>
        </nav>
      </header>

      {/* hero: grader sky + folk phone with stickers */}
      <section className="relative isolate pb-10 pt-28 sm:pt-32">
        <Sky />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="text-center text-white lg:text-left">
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass inline-block rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2a2f]/70">
              sat · ielts · ент · кодинг
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }} className="mt-5 font-display text-5xl font-bold leading-[0.98] tracking-tight [text-shadow:0_2px_24px_rgba(24,61,154,0.35)] sm:text-6xl lg:text-[62px] xl:text-7xl">
              узнай свой балл
              <br />
              <em className="font-medium text-white/80">ещё до экзамена</em>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }} className="mx-auto mt-6 max-w-lg text-lg text-white/90 lg:mx-0">
              росток — друг-репетитор в твоём телефоне. проверяет эссе и речь за секунды, показывает каждую ошибку и ведёт по плану до дня экзамена.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link to={home} className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8")}>
                {user ? "продолжить" : "начать бесплатно"} <ArrowRight />
              </Link>
              {!user && (
                <Link to="/login" className="glass inline-flex h-14 items-center rounded-full px-8 font-display text-base font-bold text-white hover:bg-white/40">
                  войти
                </Link>
              )}
            </motion.div>
            <p className="mt-4 text-sm text-white/75">7 дней Pro в подарок · без карты</p>
          </div>

          <div className="relative mx-auto h-[600px] w-full max-w-[460px]">
            <Sticker emoji="📚" className="left-0 top-6" rotate={-12} />
            <Sticker emoji="🎯" className="right-2 top-0" rotate={10} delay={1.2} />
            <Sticker emoji="🔥" className="-left-2 top-[46%]" rotate={8} delay={0.6} size={50} />
            <Sticker emoji="🏆" className="right-0 top-[42%]" rotate={-8} delay={1.8} />
            <Sticker emoji="✏️" className="bottom-10 left-4" rotate={18} delay={0.9} size={48} />
            <Sticker emoji="🌱" className="bottom-4 right-6" rotate={-6} delay={2.2} />
            <PhoneChat messages={CHAT} className="top-4" />
          </div>
        </div>

        {/* grader-style glass showcase with scores and plan */}
        <Reveal className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
          <div className="glass grid gap-4 rounded-[36px] p-4 sm:p-5 lg:grid-cols-[1.2fr_1fr]">
            <ScoreCard />
            <PlanCard />
          </div>
        </Reveal>
        <div className="mx-auto mt-6 grid max-w-6xl grid-cols-2 gap-3 px-4 sm:px-6 lg:grid-cols-4">
          {[
            ["15 сек", "средняя проверка эссе"],
            ["1600+", "вопросов SAT с разбором"],
            ["4 навыка", "все части IELTS"],
            ["48", "конкурсов и программ"],
          ].map(([v, l]) => (
            <div key={l} className="glass rounded-3xl px-5 py-4">
              <p className="font-display text-3xl font-bold">{v}</p>
              <p className="text-sm text-[#1f2a2f]/60">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* folk 2x2 cards */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
        <Reveal>
          <h2 className="max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">
            друг, который <em className="font-medium text-[#1f2a2f]/45">не даст слиться</em>
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <FeatureCard f={f} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* grader alternating sections */}
      <div className="bg-[linear-gradient(180deg,#f5f6f8,#e9f0fb_30%,#e9f0fb_70%,#f5f6f8)]">
        <Split eyebrow="speaking ai" title="твой голос." italic="оценка сразу." text="говори как на экзамене и получай ориентир по IELTS за секунды: беглость, лексика, грамматика и произношение — по отдельности, а не одной цифрой." cta="попробовать speaking" href={home} visual={<SpeakingCard />} />
        <Split flip eyebrow="writing feedback" title="каждое предложение." italic="под лупой." text="разметка прямо в твоём тексте: что поднимает балл, а что тянет вниз — по всем четырём критериям writing." cta="проверить эссе" href={home} visual={<WritingCard />} />
        <Split eyebrow="digital sat" title="как в bluebook." italic="только с репетитором." text="таймер модуля, вычёркивание вариантов, маркер и desmos. после ответа ИИ объясняет ловушку и даёт похожий вопрос." cta="решить пробник" href={home} visual={<div className="glass rounded-3xl p-3"><SatMock /></div>} />
      </div>

      <section id="plant" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
        <Reveal>
          <h2 className="mb-10 max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">
            учишься — <em className="font-medium text-[#1f2a2f]/45">растёт растение</em>
          </h2>
        </Reveal>
        <Reveal>
          <PlantDemo />
        </Reveal>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6">
        <PricingBlock />
      </section>

      {/* folk-style closing block */}
      <section className="relative isolate overflow-hidden px-4 py-24 text-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,#dfe8ff,transparent_65%)]" />
        <div className="inline-flex items-center gap-4">
          <BrandMark className="size-20 rounded-[22px]" />
          <span className="font-display text-7xl font-bold lowercase tracking-tight sm:text-8xl">росток</span>
        </div>
        <p className="mx-auto mt-5 max-w-md font-display text-xl text-[#1f2a2f]/70">друг, который доведёт тебя до экзамена</p>
        <Link to={home} className={cn(buttonVariants({ size: "lg" }), "mt-8 rounded-full px-10")}>
          {user ? "в кабинет" : "написать ростку"}
        </Link>
      </section>

      <footer className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-6 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 text-sm text-muted-foreground">© {new Date().getFullYear()} росток</p>
        </div>
        <div>
          <h3 className="font-display text-[15px] font-bold">подготовка</h3>
          <ul className="mt-4 space-y-3 font-display text-[15px] text-[#1f2a2f]/60">
            {["Digital SAT", "IELTS", "ЕНТ", "программирование"].map((t) => (
              <li key={t}>
                <Link to={home} className="hover:text-[#1f2a2f]">
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-[15px] font-bold">разделы</h3>
          <ul className="mt-4 space-y-3 font-display text-[15px] text-[#1f2a2f]/60">
            <li>
              <Link to="/pricing" className="hover:text-[#1f2a2f]">тарифы</Link>
            </li>
            <li>
              <a href="#plant" className="hover:text-[#1f2a2f]">растение</a>
            </li>
            <li>
              <Link to="/login" className="hover:text-[#1f2a2f]">войти</Link>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
