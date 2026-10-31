import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import type { EntAnswer, EntQuestionPublic, EntType } from "@shared/ent";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import type { EntMeta } from "./EntHome";
import { EntQuestion, Passage, answered } from "./EntQuestion";
import { ENT_IMAGE } from "./visuals";
import { AnimatedRadialChart } from "@/components/ui/animated-radial-chart";
import { useEntTools } from "./EntTools";

const TYPE_RU: Record<EntType, string> = { single: "Один ответ", context: "Контекстные", multi: "Несколько ответов", match: "Соответствие" };

interface Checked {
  points: number;
  max: number;
  answer: number | number[];
  explanation: string;
}

export default function EntPractice() {
  const { subject: sid = "" } = useParams();
  const meta = useApi<EntMeta>("/ent/meta");
  const subject = meta.data?.subjects.find((s) => s.id === sid);
  const [params] = useSearchParams();
  const [type, setType] = useState<EntType | null>((params.get("type") as EntType | null) ?? null);
  const [topic, setTopic] = useState(params.get("topic") ?? "");
  const [items, setItems] = useState<EntQuestionPublic[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tools = useEntTools();

  if (meta.loading) return <Loading />;
  if (!subject) return <ErrorBox message={meta.error || "Предмет не найден"} />;
  const kind = type ?? subject.plan[0]!.type;

  async function load(fresh = false) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ items: EntQuestionPublic[] }>("/ent/practice", { body: { subject: sid, topic, type: kind, fresh } });
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      {tools.panels}
      <Link to="/ent" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Подготовка к ЕНТ
      </Link>
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative isolate overflow-hidden rounded-[1.75rem] bg-[#120d0d] text-white">
        <img src={ENT_IMAGE[sid]} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55" />
        <span className="absolute inset-0 -z-10 bg-gradient-to-r from-[#120d0d] via-[#120d0d]/80 to-transparent" />
        <div className="flex flex-col gap-3 p-6 sm:p-8">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[#9be300]">
            ЕНТ · тренировка · {subject.count} заданий в тесте, порог {subject.threshold}
          </p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{subject.name}</h1>
          <div className="flex flex-wrap gap-1.5 [&_button]:border-white/20 [&_button]:bg-white/10 [&_button]:text-white">{tools.buttons}</div>
        </div>
      </motion.header>
      {!items ? (
        <Card className="flex flex-col gap-4">
          {subject.plan.length > 1 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {subject.plan.map((p) => (
                <motion.button
                  key={p.type}
                  type="button"
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setType(p.type)}
                  className={cn("flex flex-col gap-1 rounded-2xl border-2 p-3 text-left", kind === p.type ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30")}
                >
                  <span className="font-display text-2xl font-bold">{p.count}</span>
                  <span className="text-sm font-semibold">{TYPE_RU[p.type]}</span>
                  <span className="text-xs text-muted-foreground">{p.type === "multi" || p.type === "match" ? "до 2 баллов" : "1 балл"}</span>
                </motion.button>
              ))}
            </div>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">
            Тема
            <Select value={topic} onChange={(e) => setTopic(e.target.value)} className="h-10">
              <option value="">Все темы вперемешку</option>
              {subject.topics.map((t) => {
                const st = meta.data!.topicStats[`${sid}:${t}`];
                return (
                  <option key={t} value={t}>
                    {t}
                    {st ? ` — ${Math.round((st.right / st.total) * 100)}% верно` : ""}
                  </option>
                );
              })}
            </Select>
          </label>
          <ErrorBox message={error} />
          <Button size="lg" onClick={() => load()} disabled={busy} className="self-start">
            {busy ? "ИИ готовит задания… до минуты" : `Начать: ${kind === "single" || kind === "context" ? 10 : 5} заданий`}
          </Button>
          <p className="text-xs text-muted-foreground">Задания оригинальные, составлены ИИ по открытому формату и программе ЕНТ. Новые задания сохраняются в банк школы.</p>
        </Card>
      ) : (
        <Run
          items={items}
          onMore={() => {
            setItems(null);
            load(true);
          }}
          onBack={() => setItems(null)}
        />
      )}
    </div>
  );
}

export function Run({ items, onMore, onBack }: { items: EntQuestionPublic[]; onMore: () => void; onBack: () => void }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, EntAnswer>>({});
  const [checked, setChecked] = useState<Record<string, Checked>>({});
  const [ai, setAi] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [t0, setT0] = useState(Date.now());
  const done = i >= items.length;

  if (done) {
    const got = Object.values(checked).reduce((s, c) => s + c.points, 0);
    const max = Object.values(checked).reduce((s, c) => s + c.max, 0);
    return (
      <Card className="flex flex-col items-center gap-4 py-8 text-center">
        <AnimatedRadialChart value={got} max={max} size={260} label="баллов по правилам ЕНТ" />
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onMore}>
            <Sparkles /> Ещё задания
          </Button>
          <Button variant="outline" onClick={onBack}>
            <RotateCcw /> Другая тема
          </Button>
        </div>
      </Card>
    );
  }

  const q = items[i]!;
  const c = checked[q.id];
  async function check() {
    setBusy(true);
    try {
      const r = await api<Checked>("/ent/check", { body: { id: q.id, answer: answers[q.id] ?? null, ms: Date.now() - t0 } });
      setChecked({ ...checked, [q.id]: r });
    } finally {
      setBusy(false);
    }
  }
  async function explain() {
    setBusy(true);
    try {
      const r = await api<{ text: string }>("/ent/explain", { body: { id: q.id, answer: answers[q.id] ?? null } });
      setAi({ ...ai, [q.id]: r.text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("grid grid-cols-1 gap-4", q.passage && "lg:grid-cols-[1fr_1.1fr]")}>
      {q.passage && <Passage text={q.passage} />}
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.18 }}>
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="rounded-md bg-secondary px-2.5 py-1 font-display text-sm font-bold text-secondary-foreground">
                {i + 1} / {items.length}
              </span>
              <span>
                {q.topic} · уровень {q.difficulty}
              </span>
            </div>
            <EntQuestion q={q} value={answers[q.id] ?? null} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} reveal={c?.answer ?? null} disabled={!!c} />
            {c && (
              <div className={cn("rounded-2xl px-4 py-3 text-sm", c.points === c.max ? "bg-success/10" : c.points > 0 ? "bg-warning/15" : "bg-primary/10")}>
                <p className="font-display font-semibold">
                  {c.points === c.max ? "Верно" : c.points > 0 ? "Почти: одна ошибка" : "Неверно"} · {c.points} из {c.max}
                </p>
                <RichText text={c.explanation} className="mt-1" />
                {ai[q.id] && <RichText text={ai[q.id]!} className="mt-3 border-t border-border pt-3" />}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!c ? (
                <Button onClick={check} disabled={busy || !answered(answers[q.id])}>
                  Проверить
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      setI(i + 1);
                      setT0(Date.now());
                    }}
                  >
                    Дальше <ArrowRight />
                  </Button>
                  {!ai[q.id] && (
                    <Button variant="outline" onClick={explain} disabled={busy}>
                      <Sparkles /> {busy ? "ИИ разбирает…" : "Подробный разбор от ИИ"}
                    </Button>
                  )}
                </>
              )}
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
