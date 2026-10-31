import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Bot, Box, CircuitBoard, Code2, Cpu, Plane, Sparkles } from "lucide-react";
import { ARDUINO_LESSONS } from "@/lib/athena/lessons";
import { CAD_LESSONS } from "@shared/cadLessons";
import { MISSIONS } from "@shared/droneMissions";
import { Progress } from "@/components/ui/card";
import { Spotlight, Tilt } from "@/components/ui/tilt";
import { Aurora } from "@/pages/ent/EntHome";
import { useEngProgress } from "./progress";

export default function EngineeringHub() {
  const { data } = useEngProgress();
  const count = (prefix: string, ids: string[]) => ids.filter((id) => data?.items[`${prefix}:${id}`]).length;
  const drone = count(
    "drone",
    MISSIONS.filter((m) => m.xp).map((m) => m.id),
  );
  const droneTotal = MISSIONS.filter((m) => m.xp).length;
  const cad = count(
    "cad",
    CAD_LESSONS.map((l) => l.id),
  );

  const arduino = count(
    "arduino",
    ARDUINO_LESSONS.map((l) => l.id),
  );

  const labs = [
    {
      to: "/engineering/drone",
      icon: Plane,
      title: "Дроны",
      text: "Собери квадрокоптер из реальных деталей, посчитай тягу и прочность и подними его в 3D-симуляторе с честной физикой. Миссии: кольца, доставка, PID-настройка, шторм и автопилот на коде.",
      progress: [drone, droneTotal] as const,
      tint: "from-[#4cc2ff]/25",
    },
    {
      to: `/engineering/cad/${CAD_LESSONS[0].id}`,
      icon: Box,
      title: "CAD и 3D-моделирование",
      text: "Проектируй детали кодом на ядре OpenCascade (как во FreeCAD): эскизы, выдавливание, отверстия, скругления, тела вращения. Каждая деталь проверяется по размерам, экспорт в STL для 3D-печати.",
      progress: [cad, CAD_LESSONS.length] as const,
      tint: "from-[#8fb0ff]/25",
    },
    {
      to: `/engineering/arduino/${ARDUINO_LESSONS[0].id}`,
      icon: CircuitBoard,
      title: "Arduino и электроника",
      text: "Схема на макетной плате и прошивка на C++, которая работает прямо в браузере: светодиоды, кнопки, датчик расстояния, сервопривод, дисплей и робот. Мультиметр и честная электрика — без резистора светодиод сгорит.",
      progress: [arduino, ARDUINO_LESSONS.length] as const,
      tint: "from-[#e6b422]/25",
    },
    {
      to: "/coding",
      icon: Code2,
      title: "Алгоритмы",
      text: "Задачи как на LeetCode — по темам и паттернам, с тестами, ИИ-разбором решения и режимом собеседования.",
      tint: "from-[#a78bfa]/25",
    },
    {
      to: "/coding/lessons",
      icon: Bot,
      title: "Вайб-кодинг",
      text: "Создавай игры, сайты и приложения вместе с ИИ: учимся ставить задачу, проверять результат и улучшать его.",
      tint: "from-[#2bb673]/25",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#0d1117] text-white">
        <Aurora />
        <div className="relative flex flex-col gap-4 px-6 py-10 sm:px-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/80">
            <Cpu className="size-3.5 text-[#8fb0ff]" /> Инженерная лаборатория
          </span>
          <h1 className="max-w-3xl font-display text-4xl font-bold sm:text-5xl">
            Придумай. Спроектируй. <span className="bg-gradient-to-r from-[#4cc2ff] via-[#a78bfa] to-[#8fb0ff] bg-clip-text text-transparent">Подними в воздух.</span>
          </h1>
          <p className="max-w-2xl text-white/70">
            Здесь инженерия как в настоящем конструкторском бюро: детали из каталога, расчёты по формулам физики, CAD-модели для 3D-печати и симулятор, где ошибка в расчёте — это падение дрона, а не двойка.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-white/60">
            {["Физика полёта 6DOF", "Каскадный PID", "OpenCascade CAD", "Экспорт STL / STEP", "Автопилот на JavaScript", "Arduino в браузере"].map((t) => (
              <span key={t} className="rounded-full border border-white/10 px-3 py-1">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {labs.map((l, i) => (
          <motion.div key={l.to} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Tilt rotationFactor={4} isReverse springOptions={{ stiffness: 220, damping: 22 }}>
              <Link to={l.to} className={`group relative flex h-full flex-col gap-3 overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${l.tint} to-card p-6`}>
                <Spotlight size={260} className="from-primary/20 via-primary/5 to-transparent" />
                <span className="grid size-12 place-items-center rounded-2xl bg-card shadow-sm">
                  <l.icon className="size-6 text-primary" />
                </span>
                <span className="font-display text-2xl font-bold">{l.title}</span>
                <span className="text-sm text-muted-foreground">{l.text}</span>
                {l.progress && (
                  <span className="mt-auto flex flex-col gap-1">
                    <Progress value={(l.progress[0] / l.progress[1]) * 100} />
                    <span className="text-xs text-muted-foreground">
                      Пройдено {l.progress[0]} из {l.progress[1]}
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                  Открыть <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            </Tilt>
          </motion.div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-3xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
        <span>Симулятор Arduino, формулы прочности и CAD-ядро взяты из проекта Athena IDE (лаборатория железа).</span>
      </div>
    </div>
  );
}
