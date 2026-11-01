import { useEffect, useState } from "react";
import { Lightbulb, Plus, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/lib/auth";
import { useNotify } from "@/components/Notify";
import { ErrorBox, Loading } from "@/components/Page";
import { Card, Empty } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Plant } from "@/components/Plant";
import { plantGrowth } from "@shared/plants";
import { cn } from "@/lib/utils";

// Essay drafts with an AI coach: brainstorming questions, an outline of the student's own ideas and rubric feedback.
// The coach never writes the essay — that rule is shown to the student and enforced in the server prompt.

type Kind = "common-app" | "why-us" | "ucas" | "motivation";

interface Feedback {
  overall: string;
  scores: { name: string; score: number; comment: string }[];
  comments: { quote: string; comment: string }[];
  questions: string[];
  nextSteps: string[];
  mode: "ai" | "demo";
}

interface Essay {
  id: string;
  kind: Kind;
  title: string;
  prompt: string;
  text: string;
  feedback: Feedback | null;
  updated_at: number;
}

const KIND: Record<Kind, { label: string; limit: number; unit: "words" | "chars" }> = {
  "common-app": { label: "Common App · personal statement", limit: 650, unit: "words" },
  "why-us": { label: "Supplement «Why us»", limit: 300, unit: "words" },
  ucas: { label: "UCAS personal statement", limit: 4000, unit: "chars" },
  motivation: { label: "Мотивационное письмо (Европа)", limit: 700, unit: "words" },
};

const PROMPTS: Record<Kind, string[]> = {
  "common-app": [
    "Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.",
    "The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?",
    "Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?",
    "Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?",
    "Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.",
    "Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?",
    "Share an essay on any topic of your choice. It can be one you've already written, one that responds to a different prompt, or one of your own design.",
  ],
  "why-us": ["Why are you interested in this university? (обычно 150–300 слов — уточни на сайте вуза)"],
  ucas: [
    "1. Why do you want to study this course or subject?",
    "2. How have your qualifications and studies helped you to prepare for this course or subject?",
    "3. What else have you done to prepare outside of education, and why are these experiences useful?",
  ],
  motivation: ["Почему эта программа и этот вуз, что ты уже сделал по теме и чего хочешь достичь"],
};

const count = (text: string, unit: "words" | "chars") => (unit === "words" ? text.trim().split(/\s+/).filter(Boolean).length : text.length);

export default function Essays() {
  const { user } = useAuth();
  const notify = useNotify();
  const list = useApi<Essay[]>("/admissions/essays");
  const [active, setActive] = useState<Essay | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "feedback" | "brainstorm">("");
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState("");
  const [ideas, setIdeas] = useState<{ questions: string[]; angles: string[]; outline: string[] } | null>(null);

  useEffect(() => {
    if (!active && list.data?.length) setActive(list.data[0]!);
  }, [list.data, active]);

  async function create(kind: Kind) {
    const e = await api<Essay>("/admissions/essays", { body: { kind, title: KIND[kind].label, prompt: PROMPTS[kind][0], text: "" } });
    await list.reload();
    setActive(e);
    setIdeas(null);
  }

  async function save(e = active) {
    if (!e) return;
    setBusy("save");
    try {
      const saved = await api<Essay>("/admissions/essays", { body: e });
      setActive(saved);
      void list.reload();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function feedback() {
    if (!active) return;
    setBusy("feedback");
    setErr("");
    try {
      await api<Essay>("/admissions/essays", { body: active });
      const fb = await api<Feedback>(`/admissions/essays/${active.id}/feedback`, { body: {} });
      setActive({ ...active, feedback: fb });
      notify({ variant: "success", title: "Отзыв готов ✍️", body: "+15 XP. Читай комментарии и правь своими словами." });
      void list.reload();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function brainstorm() {
    if (!active) return;
    setBusy("brainstorm");
    setErr("");
    try {
      setIdeas(await api("/admissions/brainstorm", { body: { kind: active.kind, prompt: active.prompt, notes } }));
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function remove(e: Essay) {
    await api(`/admissions/essays/${e.id}`, { method: "DELETE" });
    if (active?.id === e.id) setActive(null);
    await list.reload();
  }

  if (list.loading) return <Loading />;
  if (!list.data) return <ErrorBox message={list.error} />;
  const k = active ? KIND[active.kind] : null;
  const n = active && k ? count(active.text, k.unit) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          <b>ИИ здесь коуч, а не гострайтер.</b> Он задаёт вопросы, помогает с планом и честно комментирует черновик — но не пишет текст за тебя. Common App считает выдачу текста ИИ за свой обманом, а приёмные комиссии ищут именно твой голос.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="flex flex-col gap-2">
          {list.data.map((e) => (
            <div key={e.id} className={cn("flex items-center gap-2 rounded-2xl border px-3 py-2", active?.id === e.id ? "border-primary bg-primary/5" : "border-border bg-card")}>
              <button type="button" onClick={() => (setActive(e), setIdeas(null))} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-bold">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {count(e.text, KIND[e.kind].unit)} {KIND[e.kind].unit === "words" ? "слов" : "знаков"}
                </p>
              </button>
              <button type="button" onClick={() => remove(e)} aria-label="Удалить эссе" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">новое эссе</p>
          {(Object.keys(KIND) as Kind[]).map((kk) => (
            <button key={kk} type="button" onClick={() => create(kk)} className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2 text-left text-sm font-semibold hover:border-primary hover:text-primary">
              <Plus className="size-4" /> {KIND[kk].label}
            </button>
          ))}
        </aside>

        {active && k ? (
          <Card className="flex flex-col gap-3">
            <Input aria-label="Название" value={active.title} onChange={(e) => setActive({ ...active, title: e.target.value })} className="font-display text-lg font-bold" />
            <Select aria-label="Вопрос эссе" value={active.prompt} onChange={(e) => setActive({ ...active, prompt: e.target.value })}>
              {PROMPTS[active.kind].map((p) => (
                <option key={p} value={p}>
                  {p.length > 110 ? `${p.slice(0, 110)}…` : p}
                </option>
              ))}
            </Select>
            <p className="rounded-2xl bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">{active.prompt}</p>
            <textarea
              aria-label="Текст эссе"
              value={active.text}
              onChange={(e) => setActive({ ...active, text: e.target.value })}
              placeholder="Пиши своими словами. Начни с конкретной сцены — где ты, что происходит."
              className="min-h-[360px] w-full resize-y rounded-2xl border-2 border-border bg-card p-4 font-serif text-[16px] leading-7 outline-none focus:border-primary"
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("text-sm font-bold tabular", n > k.limit ? "text-destructive" : "text-muted-foreground")}>
                {n} / {k.limit} {k.unit === "words" ? "слов" : "знаков"}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => save()} disabled={busy !== ""}>
                  <Save /> {busy === "save" ? "Сохраняю…" : "Сохранить"}
                </Button>
                <Button onClick={feedback} disabled={busy !== ""}>
                  <Sparkles /> {busy === "feedback" ? "ИИ читает…" : "Отзыв ИИ"}
                </Button>
              </div>
            </div>
            <ErrorBox message={err} />
          </Card>
        ) : (
          <Empty title="Выбери тип эссе слева ✍️">Common App, «Why us», UCAS или мотивационное письмо — для каждого свои лимиты и вопросы.</Empty>
        )}

        <aside className="flex flex-col gap-4">
          {active?.feedback ? (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 shrink-0">{user?.plant && <Plant species={user.plant} stage={plantGrowth(user.xp).stage} mood="happy" />}</div>
                <p className="text-sm">{active.feedback.overall}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {active.feedback.scores.map((s) => (
                  <li key={s.name} title={s.comment}>
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{s.name}</span>
                      <span>{s.score}/5</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(s.score / 5) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {active.feedback.comments.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">по тексту</p>
                  {active.feedback.comments.map((c, i) => (
                    <div key={i} className="rounded-2xl bg-muted p-3 text-sm">
                      <mark className="hl">«{c.quote}»</mark>
                      <p className="mt-1">{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">вопросы к тебе</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {active.feedback.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">следующий черновик</p>
                <ol className="mt-1 list-decimal pl-5 text-sm">
                  {active.feedback.nextSteps.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              </div>
            </Card>
          ) : null}
          {active && (
            <Card className="flex flex-col gap-3">
              <p className="flex items-center gap-2 font-display text-lg font-bold">
                <Lightbulb className="size-5 text-[#ff9600]" /> Не знаешь, о чём писать?
              </p>
              <textarea aria-label="Заметки" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Пара фактов о себе: хобби, проекты, что тебя бесит или вдохновляет" className="min-h-[90px] rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-primary" />
              <Button variant="outline" onClick={brainstorm} disabled={busy !== ""}>
                {busy === "brainstorm" ? "Думаю…" : "Брейншторм с ИИ"}
              </Button>
              {ideas && (
                <div className="flex flex-col gap-3 text-sm">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">вопросы</p>
                    <ul className="mt-1 list-disc pl-5">{ideas.questions.map((q) => <li key={q}>{q}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">возможные углы</p>
                    <ul className="mt-1 list-disc pl-5">{ideas.angles.map((q) => <li key={q}>{q}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">план (пишешь ты)</p>
                    <ol className="mt-1 list-decimal pl-5">{ideas.outline.map((q) => <li key={q}>{q}</li>)}</ol>
                  </div>
                </div>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
