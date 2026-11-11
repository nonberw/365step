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
import { newBankSeed, readBankContext, readBankIds, saveBankSequence } from "@/lib/satBank";
import { CalculatorWorkspace, HintBox, useSatTools } from "./SatTools";

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
  const [busy, setBusy] = useState<"" | "check" | "ai" | "remix" | "shuffle">("");
  const [error, setError] = useState("");
  const [started, setStarted] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const tools = useSatTools();

  const [list, setList] = useState(readBankIds);
  const pos = list.indexOf(id);
  const context = useMemo(() => pos >= 0 ? readBankContext() : null, [id, list, pos]);

  useEffect(() => {
    let current = true;
    setQ(null);
    setValue(null);
    setChecked(null);
    setAi(null);
    setError("");
    setStarted(Date.now());
    setNow(Date.now());
    setBusy("");
    api<{ question: SatQuestionPublic; saved: boolean }>(`/sat/question/${id}`)
      .then((r) => {
        if (!current) return;
        setQ(r.question);
        setSaved(r.saved);
      })
      .catch((e) => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [id]);

  async function shuffleQuestions() {
    if (!context || busy) return;
    setBusy("shuffle");
    try {
      const query = new URLSearchParams(context.query), seed = newBankSeed();
      query.set("seed", seed); query.set("shuffle", "1");
      const next = await api<{ ids: string[] }>(`/sat/bank/sequence?${query}`);
      if (!next.ids.length) { setError("There are no more questions in this selection. Go back to topics and adjust the filters."); return; }
      const back = new URLSearchParams(context.returnTo.split("?")[1]);
      back.set("seed", seed); back.set("shuffle", "1"); back.delete("page");
      saveBankSequence(next.ids, { query: query.toString(), returnTo: `/sat/bank?${back}` });
      setList(next.ids); setValue(null); setChecked(null); setAi(null); setStarted(Date.now());
      navigate(`/sat/q/${next.ids[0]}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

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
        <Link to={context?.returnTo ?? "/sat/bank"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Question Banks
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
          {context && list.length > 1 && <Button variant="outline" size="sm" onClick={shuffleQuestions} disabled={busy !== ""}><Shuffle />{busy === "shuffle" ? "Shuffling…" : "Shuffle"}</Button>}
          <Button variant="outline" size="sm" onClick={toggleSave} aria-pressed={saved}>
            <Bookmark className={cn(saved && "fill-primary text-primary")} /> {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      <CalculatorWorkspace open={q.section === "math" && tools.desmosOpen} onClose={tools.closeDesmos} className="space-y-5">
        <QuestionView key={`${q.id}:${context?.query ?? ""}`} q={q} value={value} onChange={setValue} reveal={checked ? { answer: checked.answer, correct: checked.correct } : null} />

        {!checked && <HintBox questionId={q.id} math={q.section === "math"} />}
        <ErrorBox message={error} />

        {checked && (
          <div className={cn("rounded-2xl p-5", checked.correct ? "bg-[#e6f6ec] dark:bg-success/15" : "bg-[#fde3e4] dark:bg-destructive/15")}>
            <p className={cn("font-display text-lg font-semibold", checked.correct ? "text-success" : "text-destructive")}>{checked.correct ? "Correct!" : "Incorrect — added to mistake review"}</p>
            <RichText text={checked.explanation} math={q.section === "math"} className="mt-2 text-sm" />
            {ai && (
              <div className="mt-4 rounded-xl bg-card p-4">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="size-3.5" /> AI explanation{ai.mode === "demo" ? " · demo" : ""}
                </p>
                <RichText text={ai.text} math={q.section === "math"} className="text-sm" />
              </div>
            )}
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <Button variant="ghost" size="sm" disabled={pos <= 0 || busy !== ""} onClick={() => navigate(`/sat/q/${list[pos - 1]}`)}>
            <ArrowLeft /> Back
          </Button>
          <div className="flex flex-wrap gap-2">
            {checked && (
              <>
                <Button variant="outline" size="sm" onClick={explain} disabled={busy !== ""}>
                  <Sparkles /> {busy === "ai" ? "Explaining…" : "Explain with AI"}
                </Button>
                <Button variant="outline" size="sm" onClick={remix} disabled={busy !== ""}>
                  <Shuffle /> {busy === "remix" ? "Creating…" : "Remix: similar question"}
                </Button>
              </>
            )}
            {!checked && (
              <Button onClick={check} disabled={value === null || busy !== ""}>
                {busy === "check" ? "Checking…" : "Check answer"}
              </Button>
            )}
          </div>
          <Button variant={checked ? "default" : "ghost"} size="sm" disabled={pos < 0 || pos >= list.length - 1 || busy !== ""} onClick={() => navigate(`/sat/q/${list[pos + 1]}`)}>
            Next <ArrowRight />
          </Button>
        </div>
      </CalculatorWorkspace>
    </div>
  );
}
