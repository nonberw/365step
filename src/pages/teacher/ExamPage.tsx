import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Copy, Download, EyeOff, Flag, Plus, Rocket, Save, Timer, Trash2 } from "lucide-react";
import type { ExamFull, ExamGrade, ExamLiveRow, ExamQuestion, ExamQuestionType } from "@shared/types";
import { api, download } from "@/api";
import { useApi } from "@/hooks/useApi";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading, PageHeader, Stat } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Progress } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Toggle } from "./ClassPage";
import { STATUS_RU, TYPE_RU } from "./Exams";

export default function ExamPage() {
  const { id = "" } = useParams();
  const { data, error, loading, setData } = useApi<ExamFull>(`/exams/${id}`);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error || "Контрольная не найдена"} />;
  return (
    <div className="flex flex-col gap-5">
      <Link to="/teacher/exams" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все контрольные
      </Link>
      {data.status === "draft" ? <Draft exam={data} onChange={setData} /> : data.status === "live" ? <Live exam={data} onChange={setData} /> : <Results exam={data} />}
    </div>
  );
}

// ---------- draft: review AI questions, then launch ----------

function Draft({ exam, onChange }: { exam: ExamFull; onChange: (e: ExamFull) => void }) {
  const [items, setItems] = useState(exam.items);
  const [title, setTitle] = useState(exam.title);
  const [duration, setDuration] = useState(exam.durationMin);
  const [lock, setLock] = useState(exam.lock);
  const [showResults, setShowResults] = useState(exam.showResults);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const total = items.reduce((s, q) => s + Number(q.points || 0), 0);

  const edit = (i: number, patch: Partial<ExamQuestion>) => {
    setItems(items.map((q, j) => (j === i ? { ...q, ...patch } : q)));
    setDirty(true);
  };

  async function save() {
    setBusy("save");
    setError("");
    try {
      const e = await api<ExamFull>(`/exams/${exam.id}`, { method: "PATCH", body: { title, items, durationMin: duration, lock, showResults } });
      onChange(e);
      setItems(e.items);
      setDirty(false);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy("");
    }
  }

  async function launch() {
    if (dirty && !(await save())) return;
    setBusy("launch");
    try {
      onChange(await api<ExamFull>(`/exams/${exam.id}/launch`, { body: {} }));
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  async function remove() {
    if (!confirm("Удалить черновик контрольной?")) return;
    await api(`/exams/${exam.id}`, { method: "DELETE" });
    navigate("/teacher/exams");
  }

  return (
    <>
      <PageHeader
        eyebrow={`Черновик · ${exam.className}${exam.mode === "demo" ? " · демо-режим ИИ" : ""}`}
        title={title}
        description={`${items.length} ${plural(items.length, "вопрос", "вопроса", "вопросов")} · ${total} ${plural(total, "балл", "балла", "баллов")} · ${duration} мин. Проверьте вопросы ИИ — правильные ответы отмечены зелёным.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={save} disabled={!dirty || !!busy}>
              <Save /> {busy === "save" ? "Сохраняю…" : dirty ? "Сохранить" : "Сохранено"}
            </Button>
            <Button size="lg" onClick={launch} disabled={!!busy || !items.length}>
              <Rocket /> {busy === "launch" ? "Запускаю…" : "Запустить для класса"}
            </Button>
          </div>
        }
      />
      <ErrorBox message={error} />
      <Card className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Название
          <Input value={title} onChange={(e) => (setTitle(e.target.value), setDirty(true))} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Минут
          <Input type="number" min={5} max={240} value={duration} onChange={(e) => (setDuration(Number(e.target.value)), setDirty(true))} />
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Toggle on={lock} label="Режим экзамена" onClick={() => (setLock(!lock), setDirty(true))} />
          <Toggle on={showResults} label="Показать ученикам результат" onClick={() => (setShowResults(!showResults), setDirty(true))} />
        </div>
      </Card>
      <ol className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {items.map((q, i) => (
            <motion.li key={q.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
              <QuestionEditor index={i} q={q} onChange={(p) => edit(i, p)} onRemove={() => (setItems(items.filter((_, j) => j !== i)), setDirty(true))} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TYPE_RU) as ExamQuestionType[]).map((t) => (
          <Button
            key={t}
            variant="outline"
            size="sm"
            onClick={() => {
              const id = `q${Date.now().toString(36)}`;
              setItems([...items, { id, type: t, prompt: "", points: t === "open" ? 3 : 1, answer: t === "mcq" || t === "tf" ? 0 : "", choices: t === "mcq" ? ["", "", "", ""] : t === "tf" ? ["Верно", "Неверно"] : undefined }]);
              setDirty(true);
            }}
          >
            <Plus /> {TYPE_RU[t]}
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={remove}>
          <Trash2 /> Удалить черновик
        </Button>
      </div>
    </>
  );
}

function QuestionEditor({ index, q, onChange, onRemove }: { index: number; q: ExamQuestion; onChange: (p: Partial<ExamQuestion>) => void; onRemove: () => void }) {
  const [preview, setPreview] = useState(true);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-secondary font-display text-xs font-bold text-secondary-foreground">{index + 1}</span>
        <Badge tone="soft">{TYPE_RU[q.type]}</Badge>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          баллы
          <Input type="number" min={0.5} max={10} step={0.5} value={q.points} onChange={(e) => onChange({ points: Number(e.target.value) })} className="h-8 w-16 text-xs" />
        </label>
        <button type="button" className="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setPreview(!preview)}>
          {preview ? "Редактировать" : "Просмотр"}
        </button>
        <button type="button" aria-label="Удалить вопрос" onClick={onRemove} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive">
          <Trash2 className="size-4" />
        </button>
      </div>
      {preview && q.prompt ? (
        <button type="button" className="text-left" onClick={() => setPreview(false)}>
          <RichText text={q.prompt} className="font-medium" />
        </button>
      ) : (
        <Textarea rows={2} value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} placeholder="Текст вопроса. Формулы: $x^2$" autoFocus={!q.prompt} />
      )}
      {(q.type === "mcq" || q.type === "tf") && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(q.choices ?? []).map((c, ci) => {
            const right = Number(q.answer) === ci;
            return (
              <li key={ci} className={cn("flex items-center gap-2 rounded-xl border px-2 py-1.5", right ? "border-success bg-success/10" : "border-border")}>
                <button type="button" aria-label="Отметить как верный" onClick={() => onChange({ answer: ci })} className={cn("grid size-7 shrink-0 place-items-center rounded-full border font-display text-xs font-bold", right ? "border-success bg-success text-white" : "border-border")}>
                  {right ? <Check className="size-4" /> : String.fromCharCode(65 + ci)}
                </button>
                {q.type === "tf" ? (
                  <span className="text-sm">{c}</span>
                ) : preview && c ? (
                  <RichText text={c} className="min-w-0 text-sm" />
                ) : (
                  <Input value={c} onChange={(e) => onChange({ choices: (q.choices ?? []).map((x, j) => (j === ci ? e.target.value : x)) })} className="h-8 text-sm" />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {q.type === "short" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Правильные ответы через «|» (регистр и запятая/точка не важны)
          <Input value={String(q.answer)} onChange={(e) => onChange({ answer: e.target.value })} className="border-success" />
        </label>
      )}
      {q.type === "open" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Эталонный ответ — по нему ИИ предварительно оценит работы
          <Textarea rows={3} value={String(q.answer)} onChange={(e) => onChange({ answer: e.target.value })} className="border-success" />
        </label>
      )}
      {q.explanation && preview && <RichText text={`Пояснение: ${q.explanation}`} className="text-xs text-muted-foreground" />}
    </Card>
  );
}

// ---------- live: code on the board, students in real time ----------

const STATE = {
  waiting: { label: "не начал", dot: "bg-muted-foreground/40" },
  working: { label: "пишет", dot: "bg-success animate-pulse" },
  away: { label: "вышел из экзамена", dot: "bg-primary animate-pulse" },
  submitted: { label: "сдал", dot: "bg-secondary" },
} as const;

function useNow(step = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), step);
    return () => clearInterval(t);
  }, [step]);
  return now;
}

export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

function Live({ exam, onChange }: { exam: ExamFull; onChange: (e: ExamFull) => void }) {
  const live = useApi<{ exam: ExamFull; rows: ExamLiveRow[]; now: number }>(`/exams/${exam.id}/live`, 3000);
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState(false);
  const cur = live.data?.exam ?? exam;
  const rows = live.data?.rows ?? [];
  const left = (cur.endsAt ?? now) - now;
  const count = (s: ExamLiveRow["state"]) => rows.filter((r) => r.state === s).length;

  useEffect(() => {
    if (live.data && live.data.exam.status !== "live") onChange(live.data.exam);
  }, [live.data, onChange]);

  async function act(path: string, body: object = {}) {
    setBusy(true);
    try {
      const e = await api<ExamFull>(`/exams/${exam.id}/${path}`, { body });
      if (e.status !== "live") onChange(e);
      else live.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-3xl bg-secondary p-6 text-secondary-foreground">
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/40 blur-3xl" />
          <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <span className="size-2 animate-pulse rounded-full bg-primary" /> Идёт · {cur.className}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold">{cur.title}</h1>
          <p className="mt-5 text-sm text-white/60">Код для учеников</p>
          <button type="button" onClick={() => setBig(true)} className="font-display text-5xl font-bold tracking-[0.25em] sm:text-6xl" title="Показать на весь экран для проектора">
            {cur.code}
          </button>
          <p className="mt-2 text-sm text-white/60">Ученики видят уведомление в приложении и вводят код в разделе «Контрольная по коду».</p>
        </motion.div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Осталось" value={<span className={cn("tabular", left < 5 * 60_000 && "text-primary")}>{clock(left)}</span>} />
          <Stat label="Сдали" value={`${count("submitted")}/${rows.length}`} />
          <Stat label="Пишут сейчас" value={count("working")} />
          <Stat label="Вышли из экзамена" value={<span className={cn(count("away") > 0 && "text-primary")}>{count("away")}</span>} />
          <div className="col-span-2 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => act("extend", { minutes: 5 })} disabled={busy}>
              <Timer /> +5 минут
            </Button>
            <Button
              variant="dark"
              onClick={() => confirm("Завершить контрольную? Несданные работы будут отправлены автоматически.") && act("finish")}
              disabled={busy}
            >
              <Flag /> Завершить для всех
            </Button>
          </div>
        </div>
      </div>
      <Card className="flex flex-col gap-3">
        <CardTitle>Ученики в реальном времени</CardTitle>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <motion.li key={r.studentId} layout className={cn("flex flex-col gap-2 rounded-2xl border p-3", r.state === "away" ? "border-primary bg-primary/5" : "border-border")}>
              <div className="flex items-center gap-2">
                <span className={cn("size-2.5 shrink-0 rounded-full", STATE[r.state].dot)} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                {r.state === "submitted" && r.score !== null ? (
                  <span className="font-display text-sm font-semibold tabular">
                    {r.score}/{r.maxScore}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{STATE[r.state].label}</span>
                )}
              </div>
              <Progress value={(r.answered / Math.max(1, cur.questions)) * 100} tone={r.state === "submitted" ? "ok" : "brand"} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  ответил {r.answered}/{cur.questions}
                  {r.state === "working" && ` · на вопросе ${r.current + 1}`}
                </span>
                {r.awayCount > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-primary">
                    <EyeOff className="size-3" /> выходов: {r.awayCount}
                  </span>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      </Card>
      <AnimatePresence>
        {big && (
          <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBig(false)} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-secondary text-secondary-foreground">
            <span className="font-display text-xl text-white/70">{cur.title} — введите код в BSTS AI Lab</span>
            <span className="font-display text-[18vw] font-bold leading-none tracking-[0.15em]">{cur.code}</span>
            <span className="font-display text-3xl tabular text-accent">{clock(left)}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------- results ----------

interface ResultRow {
  studentId: string;
  name: string;
  score: number | null;
  max: number;
  awayCount: number;
  submittedAt: number | null;
  answers: Record<string, string | number>;
  grades: Record<string, ExamGrade>;
}

function Results({ exam }: { exam: ExamFull }) {
  const { data, error, loading, reload } = useApi<{ questions: ExamQuestion[]; rows: ResultRow[] }>(`/exams/${exam.id}/results`);
  const [open, setOpen] = useState<string | null>(null);
  const navigate = useNavigate();
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const done = data.rows.filter((r) => r.score !== null);
  const avg = done.length ? Math.round((done.reduce((s, r) => s + (r.score ?? 0) / r.max, 0) / done.length) * 100) : null;
  const perQ = data.questions.map((q) => {
    const got = done.map((r) => r.grades[q.id]?.points ?? 0);
    return got.length ? got.reduce((a, b) => a + b, 0) / (got.length * q.points) : 0;
  });

  async function copy() {
    const r = await api<{ id: string }>(`/exams/${exam.id}/copy`, { body: {} });
    navigate(`/teacher/exams/${r.id}`);
  }

  return (
    <>
      <PageHeader
        eyebrow={`${STATUS_RU[exam.status]} · ${exam.className}`}
        title={exam.title}
        description={`${exam.questions} ${plural(exam.questions, "вопрос", "вопроса", "вопросов")} · сдали ${done.length} из ${exam.students}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => download(`/exams/${exam.id}/results.csv`, `${exam.title}.csv`)}>
              <Download /> CSV для журнала
            </Button>
            <Button variant="outline" onClick={copy}>
              <Copy /> Провести ещё раз
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Средний результат" value={avg === null ? "—" : `${avg}%`} />
        <Stat label="Сдали" value={`${done.length}/${exam.students}`} />
        <Stat label="Самый трудный вопрос" value={perQ.length ? `№${perQ.indexOf(Math.min(...perQ)) + 1}` : "—"} hint={perQ.length ? `${Math.round(Math.min(...perQ) * 100)}% баллов` : undefined} />
        <Stat label="Выходили из экзамена" value={data.rows.filter((r) => r.awayCount > 0).length} />
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Ученик</th>
              <th className="px-2 py-2 font-medium">Итог</th>
              {data.questions.map((q, i) => (
                <th key={q.id} className="px-1 py-2 text-center font-medium" title={q.prompt}>
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.studentId} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/50" onClick={() => setOpen(open === r.studentId ? null : r.studentId)}>
                <td className="px-4 py-2 font-medium">
                  {r.name}
                  {r.awayCount > 0 && <EyeOff className="ml-1.5 inline size-3.5 text-primary" aria-label={`выходил ${r.awayCount} раз`} />}
                </td>
                <td className="px-2 py-2 font-display font-semibold tabular">{r.score === null ? "—" : `${Math.round((r.score / r.max) * 100)}%`}</td>
                {data.questions.map((q) => {
                  const g = r.grades[q.id];
                  const ratio = g ? g.points / g.max : null;
                  return (
                    <td key={q.id} className="px-1 py-2 text-center">
                      <span className={cn("inline-block size-5 rounded-md", ratio === null ? "bg-muted" : ratio >= 1 ? "bg-success" : ratio > 0 ? "bg-warning" : "bg-primary/80")} title={g ? `${g.points}/${g.max}` : "нет ответа"} />
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-muted/40 text-xs text-muted-foreground">
              <td className="px-4 py-2">Решаемость</td>
              <td />
              {perQ.map((p, i) => (
                <td key={i} className="px-1 py-2 text-center tabular">
                  {Math.round(p * 100)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>
      {open && <StudentWork exam={exam} questions={data.questions} row={data.rows.find((r) => r.studentId === open)!} onGraded={reload} />}
    </>
  );
}

function StudentWork({ exam, questions, row, onGraded }: { exam: ExamFull; questions: ExamQuestion[]; row: ResultRow; onGraded: () => void }) {
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>
        Работа: {row.name} · {row.score ?? 0}/{row.max}
      </CardTitle>
      {questions.map((q, i) => {
        const a = row.answers[q.id];
        const g = row.grades[q.id];
        const shown = a === undefined ? "нет ответа" : q.choices ? q.choices[Number(a)] ?? "—" : String(a);
        return (
          <div key={q.id} className="flex flex-col gap-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-start gap-2">
              <span className="font-display text-sm font-semibold">{i + 1}.</span>
              <RichText text={q.prompt} className="flex-1 text-sm" />
            </div>
            <p className={cn("rounded-xl px-3 py-2 text-sm", g?.correct === true ? "bg-success/10" : g?.correct === false ? "bg-primary/10" : "bg-muted")}>{shown}</p>
            {q.type !== "open" && g?.correct === false && <p className="text-xs text-muted-foreground">Верно: {q.choices ? q.choices[Number(q.answer)] : String(q.answer).split("|")[0]}</p>}
            {g?.feedback && <p className="text-xs text-muted-foreground">ИИ: {g.feedback}</p>}
            {q.type === "open" && <GradeOverride examId={exam.id} studentId={row.studentId} q={q} points={g?.points ?? 0} onSaved={onGraded} />}
          </div>
        );
      })}
    </Card>
  );
}

function GradeOverride({ examId, studentId, q, points, onSaved }: { examId: string; studentId: string; q: ExamQuestion; points: number; onSaved: () => void }) {
  const [value, setValue] = useState(points);
  const [saved, setSaved] = useState(false);
  const options = Array.from({ length: q.points * 2 + 1 }, (_, i) => i / 2);
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      Баллы учителя:
      <Select
        className="h-8 w-20 text-xs"
        value={value}
        onChange={async (e) => {
          const v = Number(e.target.value);
          setValue(v);
          await api(`/exams/${examId}/grade`, { body: { studentId, questionId: q.id, points: v } });
          setSaved(true);
          onSaved();
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
      из {q.points}
      {saved && <Check className="size-4 text-success" />}
    </label>
  );
}
