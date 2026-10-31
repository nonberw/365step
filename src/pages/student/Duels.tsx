import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Crown, Swords, Timer, Trophy } from "lucide-react";
import type { EntQuestionPublic } from "@shared/ent";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Spotlight, Tilt } from "@/components/ui/tilt";
import { Aurora } from "@/pages/ent/EntHome";
import { ENT_IMAGE } from "@/pages/ent/visuals";

interface DuelSummary {
  id: string;
  subject: string;
  subjectName: string;
  status: "open" | "finished";
  createdAt: number;
  iChallenged: boolean;
  opponent: string;
  myScore: number | null;
  myMs: number | null;
  theirScore: number | null;
  theirMs: number | null;
  played: boolean;
  result: "win" | "loss" | "draw" | null;
}

interface DuelsData {
  classCode: string | null;
  classmates: { id: string; name: string }[];
  duels: DuelSummary[];
  league: { id: string; name: string; xp: number; wins: number; me: boolean }[];
  subjects: { id: string; name: string }[];
}

const initials = (n: string) =>
  n
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2);
const secs = (ms: number | null) => (ms ? `${Math.round(ms / 1000)} с` : "—");

export default function Duels() {
  const { data, error, loading, reload } = useApi<DuelsData>("/duels", 15_000);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  if (!data.classCode)
    return (
      <Card className="py-10 text-center">
        <p className="font-display text-xl font-semibold">Дуэли — внутри класса</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Вступи в класс по коду учителя в{" "}
          <Link to="/profile" className="font-semibold text-primary">
            профиле
          </Link>
          , и здесь появятся одноклассники и лига недели.
        </p>
      </Card>
    );
  const incoming = data.duels.filter((d) => d.status === "open" && !d.played);
  const waiting = data.duels.filter((d) => d.status === "open" && d.played);
  const finished = data.duels.filter((d) => d.status === "finished");

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#2f69cf_0%,#4f8ae0_55%,#8ab7ef_100%)] text-white">
        <Aurora />
        <div className="relative flex flex-col items-center gap-4 px-6 py-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/25 px-3 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur">
            <Swords className="size-3.5 text-[#ffd84d]" /> Дуэли ЕНТ · лига недели
          </span>
          <div className="flex items-center gap-4 sm:gap-8">
            <motion.span
              initial={{ x: -60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 120 }}
              className="grid size-16 place-items-center rounded-full bg-primary font-display text-xl font-bold sm:size-20"
            >
              ТЫ
            </motion.span>
            <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.3, type: "spring" }} className="font-display text-4xl font-black italic text-[#ffd84d] sm:text-6xl">
              VS
            </motion.span>
            <motion.span
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 120 }}
              className="grid size-16 place-items-center rounded-full bg-white/15 font-display text-xl font-bold sm:size-20"
            >
              ?
            </motion.span>
          </div>
          <h1 className="font-display text-3xl font-bold sm:text-5xl">10 заданий. Кто быстрее и точнее?</h1>
          <p className="max-w-xl text-white/70">Вызови другого ученика на дуэль по предмету ЕНТ. Оба решают одни и те же задания, побеждает больше верных ответов, при равенстве — тот, кто быстрее.</p>
        </div>
      </section>

      {incoming.length > 0 && (
        <div className="flex flex-col gap-2">
          {incoming.map((d) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
              <Swords className="size-5" />
              <span className="min-w-0 flex-1 font-display font-semibold">
                {d.iChallenged ? `Твой вызов ${d.opponent}` : `${d.opponent} вызывает тебя`} · {d.subjectName}
              </span>
              <Link to={`/duels/${d.id}`} className="rounded-full bg-white px-4 py-1.5 font-display text-sm font-semibold text-primary">
                Играть
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
        <League data={data} />
        <Challenge data={data} onCreated={reload} />
      </div>

      {(waiting.length > 0 || finished.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">Мои дуэли</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[...waiting, ...finished].map((d) => (
              <Link key={d.id} to={`/duels/${d.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary">
                <img src={ENT_IMAGE[d.subject]} alt="" className="size-12 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">против {d.opponent}</span>
                  <span className="text-xs text-muted-foreground">{d.subjectName}</span>
                </span>
                {d.status === "finished" ? (
                  <span className="flex flex-col items-end">
                    <span className="font-display text-lg font-bold tabular">
                      {d.myScore}:{d.theirScore}
                    </span>
                    <Badge tone={d.result === "win" ? "ok" : d.result === "loss" ? "bad" : "soft"}>{d.result === "win" ? "победа" : d.result === "loss" ? "поражение" : "ничья"}</Badge>
                  </span>
                ) : (
                  <Badge tone="warn">ждём соперника</Badge>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function League({ data }: { data: DuelsData }) {
  const top = data.league.slice(0, 3);
  const order = [1, 0, 2].filter((i) => top[i]);
  const height = ["h-28", "h-20", "h-16"];
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{data.classCode === "global" ? "Общая лига" : "Лига класса"} · эта неделя</p>
        <h2 className="mt-1 font-display text-xl font-semibold">Таблица лидеров</h2>
      </div>
      <div className="flex items-end justify-center gap-3 pt-2">
        {order.map((i) => {
          const p = top[i]!;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }} className="flex w-24 flex-col items-center gap-1.5">
              {i === 0 && <Crown className="size-5 text-[#f2b705]" />}
              <span className={cn("grid size-12 place-items-center rounded-full font-display font-bold", i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                {initials(p.name)}
              </span>
              <span className="w-full truncate text-center text-xs font-medium">{p.name}</span>
              <motion.span
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                className={cn("flex w-full items-start justify-center rounded-t-xl pt-2 font-display font-bold", height[i], i === 0 ? "bg-gradient-to-t from-primary to-[#8fb0ff] text-white" : "bg-muted")}
              >
                {p.xp}
              </motion.span>
            </motion.div>
          );
        })}
      </div>
      <ol className="flex flex-col divide-y divide-border">
        {data.league.map((p, i) => (
          <li key={p.id} className={cn("flex items-center gap-3 py-2 text-sm", p.me && "font-semibold text-primary")}>
            <span className="w-6 text-center font-display tabular text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              {p.name}
              {p.me && " (ты)"}
            </span>
            <span className="text-xs text-muted-foreground">{p.wins} побед</span>
            <span className="w-16 text-right font-display tabular">{p.xp} XP</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">XP недели — за задания ЕНТ, пробники и дуэли. Лига обнуляется в понедельник.</p>
    </Card>
  );
}

function Challenge({ data, onCreated }: { data: DuelsData; onCreated: () => void }) {
  const navigate = useNavigate();
  const [who, setWho] = useState<string | null>(null);
  const [subject, setSubject] = useState("math-lit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    if (!who) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ id: string }>("/duels", { body: { opponentId: who, subject } });
      onCreated();
      navigate(`/duels/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Новая дуэль</p>
        <h2 className="mt-1 font-display text-xl font-semibold">Кого вызываешь?</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.classmates.map((c) => (
          <Tilt key={c.id} rotationFactor={8} isReverse springOptions={{ stiffness: 260, damping: 20 }}>
            <button
              type="button"
              onClick={() => setWho(c.id)}
              className={cn("relative flex w-full flex-col items-center gap-2 overflow-hidden rounded-2xl border-2 p-3", who === c.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30")}
            >
              <Spotlight size={140} className="from-primary/30 via-primary/10 to-transparent" />
              <span className={cn("grid size-11 place-items-center rounded-full font-display font-bold", who === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                {initials(c.name)}
              </span>
              <span className="w-full truncate text-center text-xs font-medium">{c.name}</span>
            </button>
          </Tilt>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {data.subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSubject(s.id)}
            className={cn("flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold", subject === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
          >
            <img src={ENT_IMAGE[s.id]} alt="" className="size-6 rounded-full object-cover" />
            {s.name}
          </button>
        ))}
      </div>
      <ErrorBox message={error} />
      <Button size="lg" onClick={go} disabled={!who || busy} className="self-start">
        <Swords /> {busy ? "Готовлю задания…" : "Вызвать на дуэль"}
      </Button>
    </Card>
  );
}

// ---------- the duel itself ----------

interface DuelView extends DuelSummary {
  me: string;
  items: (EntQuestionPublic & { answer?: number; explanation?: string; given?: number | null })[];
}

export function DuelPlay() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useApi<DuelView>(`/duels/${id}`, 10_000);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  return data.played ? <DuelResult d={data} /> : <DuelRun d={data} onDone={reload} />;
}

function DuelRun({ d, onDone }: { d: DuelView; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  async function finish(final: Record<string, number>) {
    if (sent.current) return;
    sent.current = true;
    setBusy(true);
    await api(`/duels/${d.id}/submit`, { body: { answers: final, ms: Date.now() - (started ?? Date.now()) } });
    onDone();
  }

  if (!started)
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-10 text-center">
        <img src={ENT_IMAGE[d.subject]} alt="" className="size-28 rounded-3xl object-cover shadow-xl" />
        <h1 className="font-display text-3xl font-bold">
          {d.me} <span className="text-primary">vs</span> {d.opponent}
        </h1>
        <p className="text-muted-foreground">{d.subjectName} · 10 заданий · считается время</p>
        <Button size="lg" onClick={() => setStarted(Date.now())}>
          <Timer /> Старт
        </Button>
      </div>
    );

  const q = d.items[i]!;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-sm font-semibold">
          {i + 1} / {d.items.length}
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <motion.div animate={{ width: `${(i / d.items.length) * 100}%` }} className="h-full bg-gradient-to-r from-[#8fb0ff] to-primary" />
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 font-display text-sm font-bold tabular text-secondary-foreground">{Math.floor((now - started) / 1000)} с</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.15 }}>
          <Card className="flex flex-col gap-4">
            <RichText text={q.stem} className="text-lg" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => (
                <motion.button
                  key={oi}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={busy}
                  onClick={() => {
                    const next = { ...answers, [q.id]: oi };
                    setAnswers(next);
                    if (i < d.items.length - 1) setI(i + 1);
                    else finish(next);
                  }}
                  className="flex items-center gap-3 rounded-2xl border-2 border-border px-4 py-3 text-left hover:border-primary"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-display text-sm font-bold">{String.fromCharCode(65 + oi)}</span>
                  <RichText text={o} className="min-w-0" />
                </motion.button>
              ))}
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DuelResult({ d }: { d: DuelView }) {
  const done = d.status === "finished";
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link to="/duels" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все дуэли
      </Link>
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#2f69cf_0%,#4f8ae0_55%,#8ab7ef_100%)] p-8 text-center text-white">
        <Aurora />
        <div className="relative flex flex-col items-center gap-3">
          {done && d.result === "win" && (
            <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" }}>
              <Trophy className="size-14 text-[#f2b705]" />
            </motion.span>
          )}
          <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[#ffd84d]">{d.subjectName}</p>
          <div className="flex items-center gap-6">
            <span className="flex flex-col items-center">
              <span className="font-display text-6xl font-black tabular">{d.myScore}</span>
              <span className="text-sm text-white/70">{d.me}</span>
              <span className="text-xs text-white/50">{secs(d.myMs)}</span>
            </span>
            <span className="font-display text-3xl font-black italic text-[#ffd84d]">:</span>
            <span className="flex flex-col items-center">
              <span className="font-display text-6xl font-black tabular">{done ? d.theirScore : "?"}</span>
              <span className="text-sm text-white/70">{d.opponent}</span>
              <span className="text-xs text-white/50">{done ? secs(d.theirMs) : "ещё не сыграл"}</span>
            </span>
          </div>
          <p className="font-display text-2xl font-bold">{!done ? "Ждём соперника" : d.result === "win" ? "Победа!" : d.result === "loss" ? "В следующий раз получится" : "Ничья"}</p>
        </div>
      </section>
      <Card className="flex flex-col gap-3">
        <p className="font-display font-semibold">Разбор</p>
        {d.items.map((q, i) => {
          const ok = q.given === q.answer;
          return (
            <div key={q.id} className={cn("rounded-2xl border px-4 py-3 text-sm", ok ? "border-success/40 bg-success/5" : "border-primary/30 bg-primary/5")}>
              <RichText text={`**${i + 1}.** ${q.stem}`} />
              <p className="mt-1 text-xs text-muted-foreground">
                Твой ответ: {q.given !== null && q.given !== undefined ? q.options[q.given] : "—"} · верно: {q.answer !== undefined ? q.options[q.answer] : ""}
              </p>
              {!ok && q.explanation && <RichText text={q.explanation} className="mt-1 text-xs" />}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
