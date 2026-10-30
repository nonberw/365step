import { useEffect, useRef, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import { ArrowRight, BookOpen, Bot, Calculator, ClipboardCheck, Code2, GraduationCap, Library, Lock, Mic, PenLine, Radio, Sparkles, Timer, Trophy, Upload, Zap } from "lucide-react";
import ElsewhereHero from "@/components/ui/elsewhere-hero";
import StickerSlapFooter from "@/components/ui/sticker-slap-footer";
import { ScrollWordReveal } from "@/components/ui/scroll-word-reveal";
import { StickyScroll } from "@/components/ui/sticky-scroll-reveal";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import NumberTicker, { type NumberTickerRef } from "@/components/ui/basic-number-ticker";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { ART, PHOTO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CodeMock, IeltsMock, SatMock, TeacherMock } from "./landing/Mocks";

/** Fades and lifts children in once they scroll into view. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

/** Image that drifts slower than the page, for depth. */
function Parallax({ src, className, strength = 80 }: { src: string; className?: string; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength]);
  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.img src={src} alt="" loading="lazy" style={{ y, scale: 1.25 }} className="absolute inset-0 size-full object-cover" />
    </div>
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
    <div ref={ref} className="border-t border-border pt-5">
      <p className="font-display text-5xl font-semibold tabular text-primary sm:text-6xl">
        <NumberTicker ref={ticker} from={0} target={to} autoStart={false} transition={{ duration: 1.8, type: "tween", ease: "easeOut" }} />
        {suffix}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

const MARQUEE = ["Digital SAT", "Desmos", "Bluebook-режим", "IELTS Speaking", "Writing с разметкой", "Python в браузере", "LeetCode-задачи", "Вайб-кодинг", "Контрольные от ИИ", "Учебники с ИИ", "Интерактивные уроки", "Рейтинг класса"];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const home = user ? (user.role === "teacher" ? "/teacher" : "/app") : "/register";

  return (
    <div className="overflow-x-clip bg-background">
      <ElsewhereHero
        brand="BSTS AI Lab"
        links={[
          { label: "SAT", href: "#how" },
          { label: "IELTS", href: "#how" },
          { label: "Кодинг", href: "#modules" },
          { label: "Учителям", href: "#teachers" },
        ]}
        navCta={user ? { label: "Открыть платформу", href: home } : { label: "Войти", href: "/login" }}
        headline="Учись с ИИ. Поступай куда мечтаешь."
        subline="Школьная платформа: SAT, IELTS и программирование в одном месте — на школьном планшете и на телефоне."
        primaryCta={{ label: user ? "Продолжить" : "Создать аккаунт", href: home }}
        listenLabel="Звук для фокуса"
        listenOffLabel="Выключить звук"
        soundHint="Включи звук для фокуса"
        signature={false}
        onNavigate={(href) => navigate(href)}
      />

      <ScrollWordReveal kicker="Зачем это школе" text="У каждого ученика появляется *личный* *репетитор*, который знает его слабые темы, а у учителя — весь класс на *одном* *экране*: кто занимается, где ошибается и кто вышел из контрольной." />

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-24 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <Counter to={236} suffix="+" label="вопросов SAT в банке, и ИИ дописывает новые" />
        <Counter to={20} label="задач по алгоритмам с тестами на JS и Python" />
        <Counter to={16} label="генераторов математики: варианты не кончаются" />
        <Counter to={4} label="навыка IELTS с оценкой по официальным критериям" />
      </section>

      <div className="relative overflow-hidden border-y border-border bg-secondary py-5 text-secondary-foreground" aria-hidden="true">
        <div className="flex w-max animate-[marquee_38s_linear_infinite] gap-10 whitespace-nowrap font-display text-2xl font-semibold">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="flex items-center gap-10">
              {m}
              <Sparkles className="size-5 text-accent" />
            </span>
          ))}
        </div>
      </div>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-20 sm:px-6">
        <Reveal>
          <p className="eyebrow">Как это выглядит</p>
          <h2 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-5xl">Листай — и посмотри платформу изнутри</h2>
        </Reveal>
        <StickyScroll
          className="mt-6"
          content={[
            { eyebrow: "Digital SAT", title: "Как в Bluebook, только с репетитором", description: "Таймер модуля, вычёркивание вариантов, маркер, справочник формул и встроенный Desmos. После ответа ИИ объясняет, где была ловушка, и делает похожий вопрос.", content: <SatMock /> },
            { eyebrow: "IELTS", title: "Говори — и получай балл за секунды", description: "Speaking по частям 1–3, Writing с ошибками прямо в тексте, Reading и Listening. Оценка по четырём критериям и план на неделю.", content: <IeltsMock /> },
            { eyebrow: "Кодинг", title: "LeetCode в школьном формате", description: "Python и JavaScript запускаются в браузере, скрытые тесты, подсказки ИИ без готового решения и уроки вайб-кодинга по целям «Информатики и ИИ».", content: <CodeMock /> },
            { eyebrow: "Учителю", title: "Контрольная за минуту и весь класс онлайн", description: "Загрузите материалы — ИИ составит контрольную. Код экзамена, запуск на весь класс, живой прогресс каждого ученика и автоматическая проверка.", content: <TeacherMock /> },
          ]}
        />
      </section>

      <section id="modules" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-24 sm:px-6">
        <Reveal>
          <p className="eyebrow">Модули</p>
          <h2 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">Всё, к чему готовится старшеклассник</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-6">
          {[
            { span: "md:col-span-4", photo: PHOTO.books, icon: Library, title: "SAT: банк, тесты, Desmos", text: "236+ вопросов, генераторы и ИИ-Remix. Отдельно учить математику и английскую часть.", points: [Timer, Calculator, Zap] },
            { span: "md:col-span-2", photo: PHOTO.writing, icon: PenLine, title: "IELTS", text: "Speaking, Writing, Reading, Listening и игры.", points: [Mic] },
            { span: "md:col-span-2", photo: PHOTO.code, icon: Code2, title: "Кодинг", text: "Задачи, уроки с ИИ и Bug Blitz.", points: [Bot] },
            { span: "md:col-span-4", photo: PHOTO.lecture, icon: BookOpen, title: "Учебники с ИИ", text: "Читай главу, спрашивай ИИ по странице, проходи тест по параграфу и открывай интерактивный разбор: предскажи → проверь → открой ответ.", points: [Sparkles] },
          ].map((m, i) => (
            <Reveal key={m.title} delay={i * 0.08} className={m.span}>
              <CardSpotlight className="flex h-full min-h-[300px] flex-col justify-end p-0">
                <img src={m.photo} alt="" loading="lazy" className="absolute inset-0 -z-0 size-full object-cover opacity-35 transition-transform duration-700 group-hover/spotlight:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
                <div className="relative p-7">
                  <span className="grid size-11 place-items-center rounded-full bg-primary">
                    <m.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-semibold">{m.title}</h3>
                  <p className="mt-2 max-w-md text-sm text-white/70">{m.text}</p>
                </div>
              </CardSpotlight>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative isolate overflow-hidden py-24">
        <Parallax src={ART.athens} className="absolute inset-0 -z-10" strength={120} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-black/70 to-background" />
        <div className="mx-auto max-w-6xl px-4 text-white sm:px-6">
          <Reveal>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-accent">Библиотека</p>
            <h2 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">Учебники, которые отвечают на вопросы</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: BookOpen, t: "Читай на любом устройстве", d: "PDF-учебники школы и встроенные главы с поиском по классам и предметам." },
              { icon: Sparkles, t: "Спроси ИИ по странице", d: "«Объясни проще», конспект, карточки и тест по параграфу за секунды." },
              { icon: Zap, t: "Интерактивный разбор", d: "Анимированная модель, предсказание, проверка и штамп за пройденную тему." },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 0.1}>
                <div className="h-full rounded-3xl bg-white/8 p-6 ring-1 ring-white/15 backdrop-blur-md">
                  <x.icon className="size-6 text-accent" />
                  <p className="mt-4 font-display text-xl font-semibold">{x.t}</p>
                  <p className="mt-2 text-sm text-white/70">{x.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-24 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <Parallax src={PHOTO.classroom} className="aspect-[4/5] rounded-3xl" strength={60} />
          </Reveal>
          <div>
            <Reveal>
              <p className="eyebrow">Для учителей</p>
              <h2 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">Урок и контрольная под контролем</h2>
            </Reveal>
            <ul className="mt-8 flex flex-col gap-5">
              {[
                { icon: Upload, t: "Загрузите материалы", d: "PDF, Word, фото страниц — ИИ составит контрольную по ним." },
                { icon: ClipboardCheck, t: "Код экзамена и запуск", d: "Своя ссылка-код для каждой контрольной, старт сразу у всего класса." },
                { icon: Radio, t: "Живой прогресс", d: "Кто пишет, сколько ответил, кто вышел из экзамена." },
                { icon: Lock, t: "Закрытый режим", d: "Выход фиксируется, вернуться можно, уйти — только по коду." },
                { icon: Trophy, t: "Проверка и аналитика", d: "Баллы сразу, открытые ответы проверяет ИИ, учитель утверждает." },
              ].map((x, i) => (
                <Reveal key={x.t} delay={i * 0.06}>
                  <li className="flex gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <x.icon className="size-5" />
                    </span>
                    <span>
                      <span className="block font-display text-lg font-semibold">{x.t}</span>
                      <span className="block text-sm text-muted-foreground">{x.d}</span>
                    </span>
                  </li>
                </Reveal>
              ))}
            </ul>
            <Reveal delay={0.3} className="mt-8 flex flex-wrap gap-3">
              <Link to="/register/teacher" className={buttonVariants({ size: "lg" })}>
                Регистрация для учителя <ArrowRight />
              </Link>
              <Link to="/register/student" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <GraduationCap /> Я ученик
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      <StickerSlapFooter
        wordmark="ai lab"
        homeHref="/"
        navLabel="войти"
        navHref="/login"
        chatHref=""
        jobsLabel="платформа"
        jobs={[
          { title: "SAT", href: "#how" },
          { title: "IELTS", href: "#how" },
          { title: "кодинг с ИИ", href: "#modules" },
          { title: "учителям", href: "#teachers" },
        ]}
        address={[]}
        contactLabel="связь"
        email=""
        note=""
        socials={[]}
        stickers={[{ kind: "burst", text: "sat" }, "smiley", "heart", { kind: "bubble", text: "ielts" }, "daisy", "bolt"]}
        credits={[
          { role: "hero", name: "Elsewhere · guglielmogiannattasio" },
          { role: "footer", name: "Sticker Slap · 21st.dev" },
          { role: "scroll", name: "Motion · Aceternity · 21st.dev" },
          { role: "картины", name: "Wikimedia Commons, public domain" },
          { role: "фото", name: "Unsplash" },
        ]}
        height="92svh"
        paper="#f3eee8"
        panel="#7b0004"
        ink="#141010"
        cream="#f8f1ea"
        accent="#ff8562"
        fontSans="'Jost', 'Noto Sans', ui-sans-serif, system-ui, sans-serif"
      />
    </div>
  );
}
