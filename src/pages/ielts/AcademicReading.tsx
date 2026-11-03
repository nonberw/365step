import { useEffect, useRef, useState } from "react";
import type { IeltsChoiceQuestion } from "@shared/types";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBox, Loading } from "@/components/Page";
import { mmss } from "@/lib/format";
import Questions, { type CheckResult } from "./Questions";

type Run = { id: string; endsAt: number; answers: Record<string, string>; result: CheckResult | null; exam: { title: string; provenance: string; passages: { id: string; title: string; passage: string; questions: IeltsChoiceQuestion[] }[] } };
export default function AcademicReading() {
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passage, setPassage] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(Promise.resolve());
  const autoFinished = useRef("");
  const runRef = useRef(run); runRef.current = run;
  useEffect(() => { api<Run | null>("/ielts/reading-exam/active").then(setRun).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const left = run ? Math.min(3600, Math.max(0, Math.ceil((run.endsAt - now) / 1000))) : 3600;
  async function finish() {
    const current = runRef.current;
    if (!current || current.result || busy) return;
    setBusy(true);
    try {
      await pending.current;
      const result = await api<CheckResult>(`/ielts/reading-exam/${current.id}/finish`, { body: { answers: runRef.current?.answers } });
      setRun((r) => r ? { ...r, result } : r);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (run && !run.result && left === 0 && !busy && autoFinished.current !== run.id) { autoFinished.current = run.id; void finish(); } }, [left, run?.id, run?.result, busy]);
  async function start() {
    setBusy(true); setError("");
    try { setRun(await api<Run>("/ielts/reading-exam/start", { body: {} })); setPassage(0); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function change(answers: Record<string, string>) {
    if (!run || left <= 0) return;
    const previous = run.answers;
    setRun({ ...run, answers });
    for (const [questionId, value] of Object.entries(answers)) if (previous[questionId] !== value) {
      pending.current = pending.current.then(async () => {
        await api(`/ielts/reading-exam/${run.id}/answer`, { body: { questionId, value } });
      }).catch((e) => { setError(`Ответ не сохранён: ${e.message}. При завершении в пределах времени будет отправлена текущая форма.`); });
    }
  }
  if (loading) return <Loading />;
  if (!run) return <Card className="space-y-4"><h2 className="font-display text-xl font-semibold">Полный авторский Academic Reading</h2><p>3 текста · 2 473 слова · 40 вопросов · 60 минут. Оригинальные вымышленные учебные кейсы. Таймер и ответы сохраняются при перезагрузке. Результат: верные ответы и процент; шкала Band не откалибрована.</p><ErrorBox message={error} /><Button onClick={start} disabled={busy}>Начать 60 минут</Button></Card>;
  const p = run.exam.passages[passage]!;
  return <div className="space-y-4">
    <Card className="flex flex-wrap items-center justify-between gap-3"><span>{run.exam.title}</span><b className="tabular">{run.result ? "Завершено" : mmss(left)}</b><span>{Object.values(run.answers).filter(Boolean).length}/40 ответов</span></Card>
    <p className="text-sm text-muted-foreground">{run.exam.provenance}</p>
    {run.result && <Card><b>{run.result.right}/40 · {run.result.percentage}%</b><p>{run.result.feedback}</p></Card>}
    <div className="flex flex-wrap gap-2">{run.exam.passages.map((p, i) => <Button key={p.id} variant={i === passage ? "default" : "outline"} onClick={() => setPassage(i)}>Текст {i + 1}</Button>)}</div>
    <ErrorBox message={error} />
    <div className="grid items-start gap-5 lg:grid-cols-2"><Card className="lg:sticky lg:top-4 lg:max-h-[75vh] lg:overflow-y-auto"><h2 className="mb-3 font-display text-xl font-semibold">{p.title}</h2><div className="space-y-4 font-serif leading-7">{p.passage.split("\n\n").map((text, i) => <p key={i}>{text}</p>)}</div></Card>
      <Questions questions={p.questions} answers={run.answers} onChange={change} result={run.result} />
    </div>
    {!run.result ? <Button onClick={finish} disabled={busy}>Завершить и проверить все 40 ответов</Button> : <Button onClick={() => { setRun(null); setError(""); }}>Новая попытка</Button>}
  </div>;
}
