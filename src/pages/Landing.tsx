import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { Sparkles } from "lucide-react";
import { PLANTS, STAGE_NAMES, STAGE_XP, type PlantSpecies } from "@shared/plants";
import { PrismaHero } from "@/components/ui/prisma-hero";
import FUIBentoGridDark from "@/components/ui/bento";
import { Hero10 } from "@/components/ui/hero-10";
import { Hero } from "@/components/ui/hero-1";
import RotatingEarth from "@/components/ui/wireframe-dotted-globe";
import StickerSlapFooter from "@/components/ui/sticker-slap-footer";
import { ScrollWordReveal } from "@/components/ui/scroll-word-reveal";
import { StickyScroll } from "@/components/ui/sticky-scroll-reveal";
import NumberTicker, { type NumberTickerRef } from "@/components/ui/basic-number-ticker";
import { buttonVariants } from "@/components/ui/button";
import { Plant, PlantPicker } from "@/components/Plant";
import { useAuth } from "@/lib/auth";
import { PHOTO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PricingBlock } from "./Pricing";
import { CodeMock, IeltsMock, SatMock } from "./landing/Mocks";

/** Fades and lifts children in once they scroll into view. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

function Counter({ to, suffix, label }: { to: number; suffix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const ticker = useRef<NumberTickerRef>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (inView) ticker.current?.startAnimation();
  }, [inView]);
  return (
    <div ref={ref} className="rounded-3xl border-2 border-border bg-card p-6 shadow-[0_4px_0_0_var(--border)]">
      <p className="font-display text-5xl font-black tabular text-primary sm:text-6xl">
        <NumberTicker ref={ticker} from={0} target={to} autoStart={false} transition={{ duration: 1.8, type: "tween", ease: "easeOut" }} />
        {suffix}
      </p>
      <p className="mt-2 text-sm font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

/** Live demo of the companion: pick a plant and drag the slider through its five stages. */
function PlantDemo() {
  const [species, setSpecies] = useState<PlantSpecies>("sunflower");
  const [stage, setStage] = useState(3);
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[360px_1fr]">
      <div className="rounded-[2rem] border-2 border-border bg-gradient-to-b from-[#eaf8d6] to-card p-6 dark:from-[#143008]">
        <Plant species={species} stage={stage} className="mx-auto max-w-[260px]" />
        <p className="mt-2 text-center font-display text-xl font-extrabold">
          {PLANTS[species].name} · {STAGE_NAMES[stage - 1]}
        </p>
        <input type="range" min={1} max={5} step={1} value={stage} onChange={(e) => setStage(Number(e.target.value))} aria-label="Стадия роста" className="mt-4 w-full accent-[var(--primary)]" />
        <p className="mt-1 text-center text-xs font-bold text-muted-foreground">{STAGE_XP[stage - 1] === 0 ? "Старт" : `от ${STAGE_XP[stage - 1]} XP`}</p>
      </div>
      <div>
        <h3 className="mb-4 font-display text-2xl font-extrabold">Выбери спутника</h3>
        <PlantPicker value={species} onChange={setSpecies} />
        <p className="mt-4 text-sm font-semibold text-muted-foreground">Каждый верный ответ, урок и пробный тест приносят XP. Растение растёт на пяти стадиях, а если день пропущен, ничего не вянет: вернёшься — продолжите вместе.</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const home = user ? "/app" : "/register";

  return (
    <div className="overflow-x-clip bg-background">
      <PrismaHero
        brand="Нурбек Чурбек"
        nav={[
          { label: "Растение", href: "#plant" },
          { label: "Возможности", href: "#features" },
          { label: "Поступление", href: "#world" },
          { label: "Тарифы", href: "#pricing" },
          { label: user ? "Кабинет" : "Войти", href: user ? "/app" : "/login" },
        ]}
        description="Личный ИИ-наставник для SAT, IELTS, ЕНТ и программирования. План до экзамена, разбор каждой ошибки и растение, которое растёт вместе с тобой."
        cta={{ label: user ? "Продолжить" : "Начать бесплатно", href: home }}
      />

      <ScrollWordReveal kicker="Зачем это тебе" text="Репетитор стоит дорого и не всегда рядом. Здесь у тебя *личный* *наставник* 24/7: он знает твои слабые темы, строит *план* до даты экзамена и объясняет каждую ошибку." />

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <Counter to={1600} suffix="+" label="вопросов SAT в банке, и ИИ дописывает новые" />
        <Counter to={65} label="академических текстов IELTS Reading" />
        <Counter to={64} label="задачи по программированию с тестами" />
        <Counter to={4} label="растения-спутника на выбор" />
      </section>

      <section id="plant" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-24 sm:px-6">
        <Reveal>
          <p className="eyebrow">Твой спутник</p>
          <h2 className="mb-10 mt-2 max-w-3xl font-display text-4xl font-black leading-tight sm:text-5xl">Учишься — растёт растение</h2>
        </Reveal>
        <Reveal>
          <PlantDemo />
        </Reveal>
      </section>

      <section id="features" className="scroll-mt-6 bg-muted/50 py-10">
        <FUIBentoGridDark
          title="Всё для экзаменов в одном месте"
          subtitle="Банк заданий, пробные тесты и ИИ-разбор — в одном аккаунте."
          items={[
            { eyebrow: "Digital SAT", title: "Тесты как в Bluebook", description: "1600+ вопросов, таймер модуля, вычёркивание вариантов, маркер и встроенный Desmos. ИИ объясняет, где была ловушка.", image: PHOTO.books },
            { eyebrow: "IELTS", title: "Говори и пиши — получай балл", description: "Speaking по частям 1–3, Writing с разметкой ошибок, 65 текстов Reading. Оценка по четырём критериям.", image: PHOTO.writing },
            { eyebrow: "Кодинг", title: "Python и JS прямо в браузере", description: "Задачи с тестами, подсказки без готового решения и уроки вайб-кодинга.", image: PHOTO.code },
            { eyebrow: "ЕНТ", title: "Мастер-режим на IRT", description: "Подбор заданий под твой уровень, повтор ошибок и дуэли с друзьями.", image: PHOTO.classroom },
            { eyebrow: "ИИ-наставник", title: "План до даты экзамена", description: "Знает слабые темы и строит ежедневный маршрут на выбранные 20–90 минут.", image: PHOTO.lecture },
          ]}
        />
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-20 sm:px-6">
        <Reveal>
          <p className="eyebrow">Как это выглядит</p>
          <h2 className="mt-2 max-w-3xl font-display text-4xl font-black leading-tight sm:text-5xl">Листай — и посмотри платформу изнутри</h2>
        </Reveal>
        <StickyScroll
          className="mt-6"
          content={[
            { eyebrow: "Digital SAT", title: "Как в Bluebook, только с репетитором", description: "Таймер модуля, вычёркивание вариантов, маркер, справочник формул и встроенный Desmos. После ответа ИИ объясняет, где была ловушка, и делает похожий вопрос.", content: <SatMock /> },
            { eyebrow: "IELTS", title: "Говори — и получай балл за секунды", description: "Speaking по частям 1–3, Writing с ошибками прямо в тексте, Reading и Listening. Оценка по четырём критериям и план на неделю.", content: <IeltsMock /> },
            { eyebrow: "Кодинг", title: "LeetCode, но с наставником", description: "Python и JavaScript запускаются в браузере, скрытые тесты и подсказки ИИ без готового решения.", content: <CodeMock /> },
          ]}
        />
      </section>

      <Hero10
        title="Готовься к экзаменам"
        titleLine2Prefix="как в"
        titleHighlight="любимой игре"
        description="Серия дней, XP, лига недели, дуэли с друзьями и растение, которое растёт с каждым заданием. Учёба перестаёт быть обязаловкой."
        socialProof="Начни за минуту: без карты, с 7 днями Pro"
        images={[PHOTO.books, PHOTO.team, PHOTO.writing]}
        imageAlts={["Учебники", "Занятие с друзьями", "Эссе"]}
        animation="subtle"
        primaryCTA={{ ctaEnabled: true, text: "Создать аккаунт", link: home, variant: "default", size: "lg" }}
        secondaryCTA={{ ctaEnabled: true, text: "Тарифы", link: "#pricing", variant: "outline", size: "lg" }}
      />

      <section id="world" className="scroll-mt-6 bg-[#0d1a09] py-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[#9be300]">Поступление</p>
            <h2 className="mt-2 font-display text-4xl font-black leading-tight sm:text-5xl">Поступай в любую страну</h2>
            <p className="mt-4 max-w-md text-base font-semibold text-white/75">США, Великобритания, Канада, Европа и Азия: платформа подстраивает план под страну и направление, а каталог из 48 конкурсов и программ подсказывает, чем усилить профиль.</p>
            <ul className="mt-6 flex flex-wrap gap-2 text-sm font-extrabold">
              {["SAT", "IELTS", "ЕНТ", "Common App", "UCAS"].map((t) => (
                <li key={t} className="rounded-full border-2 border-[#9be300]/40 px-4 py-1.5 text-[#c7f08a]">
                  {t}
                </li>
              ))}
            </ul>
            <Link to={user ? "/admissions" : "/register"} className={cn(buttonVariants({ size: "lg" }), "mt-8")}>
              <Sparkles /> Смотреть конкурсы
            </Link>
          </Reveal>
          <Reveal delay={0.1}>
            <RotatingEarth width={560} height={520} className="mx-auto max-w-full" />
          </Reveal>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-24 sm:px-6">
        <PricingBlock />
      </section>

      <Hero eyebrow="7 дней Pro бесплатно" title="Посади своё первое растение" subtitle="Выбери цель, спутника и начни. Остальное платформа построит сама." ctaLabel={user ? "В кабинет" : "Начать бесплатно"} ctaHref={home} className="min-h-[72vh] pt-28" />

      <StickerSlapFooter
        wordmark="нурбек"
        homeHref="/"
        navLabel="войти"
        navHref="/login"
        chatHref=""
        jobsLabel="платформа"
        jobs={[
          { title: "SAT", href: "#how" },
          { title: "IELTS", href: "#how" },
          { title: "растение", href: "#plant" },
          { title: "тарифы", href: "#pricing" },
        ]}
        address={[]}
        contactLabel="связь"
        email=""
        note=""
        socials={[]}
        stickers={[{ kind: "burst", text: "sat" }, "smiley", "heart", { kind: "bubble", text: "ielts" }, "daisy", "bolt"]}
        credits={[
          { role: "hero", name: "Prisma · 21st.dev" },
          { role: "блоки", name: "Bento, Pricing, Dock · 21st.dev" },
          { role: "глобус", name: "Wireframe Dotted Globe · 21st.dev" },
          { role: "фото", name: "Unsplash" },
        ]}
        height="92svh"
        paper="#f1f8e8"
        panel="#2c7400"
        ink="#0d1a09"
        cream="#f7fbf2"
        accent="#9be300"
        fontSans="'Nunito', ui-sans-serif, system-ui, sans-serif"
      />
    </div>
  );
}
