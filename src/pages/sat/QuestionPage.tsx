import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bookmark, Shuffle, Sparkles } from "lucide-react";
import type { SatQuestionPublic } from "@shared/types";
import { api } from "@/api";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { mmss } from "@/lib/format";
import QuestionView, { type Response } from "./QuestionView";
import { LIST_KEY } from "./Bank";
import { HintBox, useSatTools } from "./SatTools";

interface Checked {
  correct: boolean;
  answer: number | string;
  explanation: string;
}

export default function QuestionPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState<SatQuestionPublic | null>(null);
  const [saved, setSaved] = useState(false);
  const [value, setValue] = useState<Response>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [ai, setAi] = useState<{ text: string; mode: string } | null>(null);
  const [busy, setBusy] = useState<"" | "check" | "ai" | "remix">("");
  const [error, setError] = useState("");
  const [started, setStarted] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const tools = useSatTools();

  const list = useMemo<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(LIST_KEY) ?? "[]");
    } catch {
      return [];
    }
  }, []);
  const pos = list.indexOf(id);

  useEffect(() => {
    setQ(null);
    setValue(null);
    setChecked(null);
    setAi(null);
    setError("");
    setStarted(Date.now());
    api<{ question: SatQuestionPublic; saved: boolean }>(`/sat/question/${id}`)
      .then((r) => {
        setQ(r.question);
        setSaved(r.saved);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (checked) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [checked]);

  async function check() {
    if (!q || value === null) return;
    setBusy("check");
    try {
      setChecked(await api<Checked>("/sat/answer", { body: { id: q.id, response: value, ms: Date.now() - started } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function explain() {
    if (!q) return;
    setBusy("ai");
    try {
      const r = await api<{ explanation: string; mode: string }>("/sat/explain", { body: { id: q.id, response: value } });
      setAi({ text: r.explanation, mode: r.mode });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function remix() {
    if (!q) return;
    setBusy("remix");
    try {
      const r = await api<{ question: SatQuestionPublic }>("/sat/remix", { body: { id: q.id } });
      navigate(`/sat/q/${r.question.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function toggleSave() {
    if (!q) return;
    const next = !saved;
    setSaved(next);
    await api("/sat/save", { body: { id: q.id, saved: next } }).catch(() => setSaved(!next));
  }

  if (error && !q) return <ErrorBox message={error} />;
  if (!q) return <Loading />;

  return (
    <div className="flex flex-col gap-5">
      {q.section === "math" && tools.panels}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <Link to="/sat/bank" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Банк вопросов
        </Link>
        <div className="flex items-center gap-2">
          {q.section === "math" && <div className="flex gap-1">{tools.buttons}</div>}
          <Badge tone="dark" className="tabular">
            {mmss(((checked ? now : Date.now()) - started) / 1000)}
          </Badge>
          {pos >= 0 && (
            <span className="text-xs text-muted-foreground tabular">
              {pos + 1} / {list.length}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={toggleSave} aria-pressed={saved}>
            <Bookmark className={cn(saved && "fill-primary text-primary")} /> {saved ? "Сохранено" : "Сохранить"}
          </Button>
        </div>
      </div>

      <QuestionView q={q} value={value} onChange={setValue} reveal={checked ? { answer: checked.answer, correct: checked.correct } : null} />

      {!checked && <HintBox questionId={q.id} />}
      <ErrorBox message={error} />

      {checked && (
        <div className={cn("rounded-2xl p-5", checked.correct ? "bg-[#e6f6ec] dark:bg-success/15" : "bg-[#fde3e4] dark:bg-destructive/15")}>
          <p className={cn("font-display text-lg font-semibold", checked.correct ? "text-success" : "text-destructive")}>{checked.correct ? "Верно!" : "Неверно — вопрос попал в повтор ошибок"}</p>
          <RichText text={checked.explanation} className="mt-2 text-sm" />
          {ai && (
            <div className="mt-4 rounded-xl bg-card p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="size-3.5" /> Объяснение ИИ{ai.mode === "demo" ? " · демо" : ""}
              </p>
              <RichText text={ai.text} className="text-sm" />
            </div>
          )}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <Button variant="ghost" size="sm" disabled={pos <= 0} onClick={() => navigate(`/sat/q/${list[pos - 1]}`)}>
          <ArrowLeft /> Назад
        </Button>
        <div className="flex flex-wrap gap-2">
          {checked && (
            <>
              <Button variant="outline" size="sm" onClick={explain} disabled={busy !== ""}>
                <Sparkles /> {busy === "ai" ? "Объясняю…" : "Объяснить с ИИ"}
              </Button>
              <Button variant="outline" size="sm" onClick={remix} disabled={busy !== ""}>
                <Shuffle /> {busy === "remix" ? "Создаю…" : "Remix: похожий вопрос"}
              </Button>
            </>
          )}
          {!checked && (
            <Button onClick={check} disabled={value === null || busy !== ""}>
              {busy === "check" ? "Проверяю…" : "Проверить"}
            </Button>
          )}
        </div>
        <Button variant={checked ? "default" : "ghost"} size="sm" disabled={pos < 0 || pos >= list.length - 1} onClick={() => navigate(`/sat/q/${list[pos + 1]}`)}>
          Дальше <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
