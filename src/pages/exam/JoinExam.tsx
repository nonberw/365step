import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, KeyRound, Radio } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { ErrorBox, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle } from "@/components/ui/card";

export interface ActiveExam {
  id: string;
  title: string;
  subject: string;
  endsAt: number;
  joined: boolean;
  teacher: string;
}

const LEN = 6;

export default function JoinExam() {
  const navigate = useNavigate();
  const active = useApi<ActiveExam[]>("/exams/student/active", 5000);
  const history = useApi<{ id: string; title: string; subject: string; status: string; submitted_at: number | null; score: number | null; max_score: number | null }[]>("/exams/student/history");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function join(value = code) {
    if (value.length !== LEN) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ id: string }>("/exams/student/join", { body: { code: value } });
      navigate(`/exam/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Контрольная" title="Вход по коду" description="Учитель показывает код на доске. Введи его — контрольная откроется в режиме экзамена." />
      {active.data?.map((e) => (
        <motion.div key={e.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground">
          <Radio className="size-5 animate-pulse" />
          <span className="min-w-0 flex-1 font-display font-semibold">
            {e.teacher} запустил(а) «{e.title}»
          </span>
          {e.joined ? (
            <Link to={`/exam/${e.id}`} className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-1.5 font-display text-sm font-semibold text-primary">
              Продолжить <ArrowRight className="size-4" />
            </Link>
          ) : (
            <span className="text-sm text-white/80">введи код ниже</span>
          )}
        </motion.div>
      ))}
      <Card className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 py-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <KeyRound className="size-6" />
        </span>
        <button type="button" className="relative flex gap-2" onClick={() => ref.current?.focus()} aria-label="Поле для кода">
          {Array.from({ length: LEN }, (_, i) => (
            <span key={i} className={cn("grid h-14 w-11 place-items-center rounded-xl border-2 font-display text-2xl font-bold uppercase sm:h-16 sm:w-12", i === code.length ? "border-primary" : "border-border", code[i] && "bg-muted")}>
              {code[i] ?? ""}
            </span>
          ))}
          <input
            ref={ref}
            autoFocus
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            aria-label="Код контрольной"
            value={code}
            maxLength={LEN}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, LEN);
              setCode(v);
              setError("");
              if (v.length === LEN) join(v);
            }}
            className="absolute inset-0 opacity-0"
          />
        </button>
        <ErrorBox message={error} />
        <Button size="lg" onClick={() => join()} disabled={code.length !== LEN || busy}>
          {busy ? "Подключаюсь…" : "Начать"}
        </Button>
      </Card>
      {!!history.data?.length && (
        <Card className="flex flex-col gap-2">
          <CardTitle>Мои контрольные</CardTitle>
          <ul className="flex flex-col divide-y divide-border">
            {history.data.map((h) => (
              <li key={h.id}>
                <Link to={`/exam/${h.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{h.title}</span>
                  {h.score !== null && h.max_score ? (
                    <span className="font-display font-semibold tabular">{Math.round((h.score / h.max_score) * 100)}%</span>
                  ) : (
                    <Badge tone={h.status === "live" ? "brand" : "soft"}>{h.status === "live" ? "идёт" : "сдана"}</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
