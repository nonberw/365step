import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronLeft, ChevronRight, FlaskConical, Layers, Lightbulb, ListChecks, MessageCircle, NotebookPen, RefreshCw, ScrollText, Send, Stamp, Trash2, X } from "lucide-react";
import type { BookMeta, BookNote } from "@shared/types";
import type { BookChapter } from "@shared/textbooks";
import { api, fetchBlob } from "@/api";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { explainerDoc, handcrafted } from "./explainers";

interface BookData {
  meta: BookMeta;
  chapters: BookChapter[] | null;
  pages: string[] | null;
  notes: BookNote[];
  progress: { place: string | null; stamps: string[] };
}

type Action = "explain" | "summary" | "quiz" | "cards" | "ask" | "interactive";

type Answer =
  | { action: "explain" | "ask"; text: string; mode: string }
  | { action: "summary"; points: string[]; terms: { term: string; def: string }[]; mode: string }
  | { action: "quiz"; items: { q: string; choices: string[]; answer: number; why: string }[]; mode: string }
  | { action: "cards"; cards: { front: string; back: string }[]; mode: string }
  | { action: "interactive"; explainer: Parameters<typeof explainerDoc>[0]; mode: string };

export default function Reader() {
  const { id = "" } = useParams();
  const { data, error, loading, setData } = useApi<BookData>(`/library/${id}`);
  const [params, setParams] = useSearchParams();
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error || "Учебник не найден"} />;

  const { meta } = data;
  const places = data.chapters ? data.chapters.map((c) => c.id) : Array.from({ length: meta.places }, (_, i) => String(i + 1));
  const place = params.get("p") ?? data.progress.place ?? places[0];
  const index = Math.max(0, places.indexOf(place));
  const go = (i: number) => {
    const next = places[Math.min(places.length - 1, Math.max(0, i))];
    setParams({ p: next }, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const chapter = data.chapters?.[index];
  const stamped = data.progress.stamps.includes(places[index]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/library" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Библиотека
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="min-w-0 flex-1 truncate font-display font-semibold">{meta.title}</span>
        {stamped && (
          <Badge tone="ok">
            <Stamp className="size-3" /> понято
          </Badge>
        )}
      </div>
      <PlaceNav data={data} index={index} go={go} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <AnimatePresence mode="wait">
            <motion.div key={places[index]} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {chapter ? (
                <Card className="px-5 py-6 sm:px-8">
                  <h1 className="font-display text-2xl font-semibold">{chapter.title}</h1>
                  <RichText text={chapter.text} className="mt-3 text-[16px] leading-7" />
                </Card>
              ) : meta.format === "pdf" ? (
                <PdfPage bookId={meta.id} page={index + 1} />
              ) : (
                <Card className="px-5 py-6 sm:px-8">
                  <RichText text={data.pages?.[index] ?? ""} className="text-[16px] leading-7" />
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
              <ChevronLeft /> Назад
            </Button>
            <span className="text-sm tabular text-muted-foreground">
              {index + 1} / {places.length}
            </span>
            <Button variant="outline" onClick={() => go(index + 1)} disabled={index === places.length - 1}>
              Дальше <ChevronRight />
            </Button>
          </div>
          <Interactive key={places[index]} bookId={meta.id} place={places[index]} unit={chapter ? "главы" : "страницы"} builtin={chapter?.explainer ? handcrafted(chapter.explainer) : null} onStamp={(stamps) => setData({ ...data, progress: { ...data.progress, stamps } })} />
        </div>
        <StudyPanel key={places[index]} data={data} place={places[index]} onNotes={(notes) => setData({ ...data, notes })} />
      </div>
      <SaveProgress bookId={meta.id} place={places[index]} />
    </div>
  );
}

function SaveProgress({ bookId, place }: { bookId: string; place: string }) {
  useEffect(() => {
    const t = setTimeout(() => api(`/library/${bookId}/progress`, { body: { place } }).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [bookId, place]);
  return null;
}

function PlaceNav({ data, index, go }: { data: BookData; index: number; go: (i: number) => void }) {
  const [page, setPage] = useState(String(index + 1));
  useEffect(() => setPage(String(index + 1)), [index]);
  if (data.chapters)
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {data.chapters.map((c, i) => (
          <button key={c.id} type="button" onClick={() => go(i)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm", i === index ? "border-secondary bg-secondary text-secondary-foreground" : "border-border hover:bg-muted")}>
            {data.progress.stamps.includes(c.id) && <Stamp className="size-3.5 text-success" />}
            {c.title}
            {c.explainer && <FlaskConical className="size-3.5 text-primary" />}
          </button>
        ))}
      </div>
    );
  return (
    <form
      className="flex items-center gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        go(Number(page) - 1);
      }}
    >
      Страница
      <Input value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} className="h-9 w-20 text-center" aria-label="Номер страницы" />
      из {data.meta.places}
    </form>
  );
}

// ---------- PDF ----------

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: object) => { promise: Promise<void>; cancel: () => void } }> };
const docs = new Map<string, Promise<PdfDoc>>();

async function loadPdf(bookId: string) {
  if (!docs.has(bookId)) {
    docs.set(
      bookId,
      (async () => {
        const [pdfjs, worker, blob] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url"), fetchBlob(`/library/${bookId}/file`)]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        return (await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise) as unknown as PdfDoc;
      })(),
    );
  }
  return docs.get(bookId)!;
}

function PdfPage({ bookId, page }: { bookId: string; page: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    let task: { cancel: () => void } | null = null;
    let alive = true;
    (async () => {
      try {
        const doc = await loadPdf(bookId);
        const p = await doc.getPage(page);
        if (!alive || !canvas.current || !box.current) return;
        const base = p.getViewport({ scale: 1 });
        const scale = (box.current.clientWidth / base.width) * zoom;
        const vp = p.getViewport({ scale: scale * devicePixelRatio });
        canvas.current.width = vp.width;
        canvas.current.height = vp.height;
        canvas.current.style.width = `${vp.width / devicePixelRatio}px`;
        const r = p.render({ canvasContext: canvas.current.getContext("2d"), viewport: vp, canvas: canvas.current });
        task = r;
        await r.promise;
      } catch (e) {
        if (alive && (e as Error).name !== "RenderingCancelledException") setError("Не удалось открыть PDF");
      }
    })();
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [bookId, page, zoom]);
  return (
    <Card className="relative overflow-hidden p-2">
      <div className="absolute right-3 top-3 z-10 flex gap-1">
        {[1, 1.5].map((z) => (
          <button key={z} type="button" onClick={() => setZoom(z)} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", zoom === z ? "bg-secondary text-secondary-foreground" : "bg-card/90 ring-1 ring-border")}>
            {z * 100}%
          </button>
        ))}
      </div>
      <div ref={box} className="overflow-auto">
        <canvas ref={canvas} className="mx-auto block bg-white" />
      </div>
      <ErrorBox message={error} />
    </Card>
  );
}

// ---------- Every Joule style interactive ----------

function Interactive({ bookId, place, unit, builtin, onStamp }: { bookId: string; place: string; unit: string; builtin: string | null; onStamp: (stamps: string[]) => void }) {
  const [doc, setDoc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [height, setHeight] = useState(900);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "height") return setHeight(Math.min(3000, Math.max(400, Number(e.data.h) || 900)));
      if (e.data?.type !== "stamp") return;
      api<{ stamps: string[] }>(`/library/${bookId}/progress`, { body: { place, stamp: true } })
        .then((r) => onStamp(r.stamps))
        .catch(() => {});
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [bookId, place, onStamp]);

  async function generate(fresh = false) {
    setBusy(true);
    setError("");
    try {
      const r = await api<Answer>(`/library/${bookId}/ai`, { body: { place, action: "interactive", fresh } });
      if (r.action === "interactive") setDoc(explainerDoc(r.explainer));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
          <FlaskConical className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold">Опыт: предскажи → проверь → подними клапан</span>
          <span className="text-xs text-muted-foreground">Интерактивное объяснение этой {unit}. За понятый опыт ставится штамп.</span>
        </span>
        {!doc && (
          <div className="flex flex-wrap gap-2">
            {builtin && <Button onClick={() => setDoc(builtin)}>Открыть опыт</Button>}
            <Button variant={builtin ? "outline" : "default"} onClick={() => generate()} disabled={busy}>
              {busy ? "ИИ собирает опыт… (до минуты)" : builtin ? "Новый опыт от ИИ" : "Создать опыт с ИИ"}
            </Button>
          </div>
        )}
        {doc && (
          <div className="flex gap-1">
            {doc !== builtin && (
              <Button variant="ghost" size="sm" onClick={() => generate(true)} disabled={busy}>
                <RefreshCw /> Другой
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Закрыть опыт" onClick={() => setDoc(null)}>
              <X />
            </Button>
          </div>
        )}
      </div>
      <ErrorBox message={error} />
      {doc && <iframe ref={frame} title="Интерактивное объяснение" sandbox="allow-scripts" srcDoc={doc} style={{ height }} className="w-full rounded-xl border border-border bg-[#fbf8f4]" />}
    </Card>
  );
}

// ---------- AI study panel ----------

const TABS: { id: Action | "notes"; label: string; icon: typeof Lightbulb }[] = [
  { id: "explain", label: "Объяснить", icon: Lightbulb },
  { id: "summary", label: "Конспект", icon: ScrollText },
  { id: "quiz", label: "Тест", icon: ListChecks },
  { id: "cards", label: "Карточки", icon: Layers },
  { id: "ask", label: "Спросить", icon: MessageCircle },
  { id: "notes", label: "Заметки", icon: NotebookPen },
];

function StudyPanel({ data, place, onNotes }: { data: BookData; place: string; onNotes: (n: BookNote[]) => void }) {
  const [tab, setTab] = useState<Action | "notes">("explain");
  const [answers, setAnswers] = useState<Partial<Record<Action, Answer>>>({});
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: Action, question = "") {
    setBusy(true);
    setError("");
    try {
      const r = await api<Answer>(`/library/${data.meta.id}/ai`, { body: { place, action, question } });
      if (r.action === "ask") setChat((c) => [...c, { q: question, a: r.text }]);
      else setAnswers((a) => ({ ...a, [action]: r }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (tab !== "notes" && tab !== "ask" && !answers[tab] && !busy) run(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const a = tab !== "notes" ? answers[tab] : undefined;
  return (
    <aside className="flex flex-col gap-3 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:self-start">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn("flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-xs font-semibold", tab === t.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>
      <Card className="flex min-h-[260px] flex-col gap-3 overflow-y-auto">
        {tab === "notes" ? (
          <Notes data={data} place={place} onNotes={onNotes} />
        ) : tab === "ask" ? (
          <Ask chat={chat} busy={busy} onAsk={(q) => run("ask", q)} />
        ) : busy && !a ? (
          <div className="flex flex-col gap-2">
            {[80, 95, 70, 88].map((w, i) => (
              <div key={i} className="h-3.5 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
            ))}
            <p className="mt-2 text-xs text-muted-foreground">ИИ читает страницу…</p>
          </div>
        ) : a ? (
          <AnswerView answer={a} />
        ) : null}
        <ErrorBox message={error} />
        {a && a.mode === "demo" && <p className="text-xs text-muted-foreground">Демо-режим без Claude: ответ собран из текста страницы.</p>}
      </Card>
    </aside>
  );
}

function AnswerView({ answer }: { answer: Answer }) {
  if (answer.action === "explain" || answer.action === "ask") return <RichText text={answer.text} className="text-sm" />;
  if (answer.action === "summary")
    return (
      <div className="flex flex-col gap-3 text-sm">
        <ul className="flex flex-col gap-1.5">
          {answer.points.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              <RichText text={p} />
            </li>
          ))}
        </ul>
        {answer.terms.length > 0 && (
          <dl className="flex flex-col gap-1.5 rounded-xl bg-muted/60 p-3">
            {answer.terms.map((t) => (
              <div key={t.term}>
                <dt className="font-semibold">{t.term}</dt>
                <dd className="text-muted-foreground">
                  <RichText text={t.def} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  if (answer.action === "quiz") return <Quiz items={answer.items} />;
  if (answer.action === "cards") return <Cards cards={answer.cards} />;
  return null;
}

function Quiz({ items }: { items: { q: string; choices: string[]; answer: number; why: string }[] }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const right = items.filter((q, i) => picked[i] === q.answer).length;
  return (
    <div className="flex flex-col gap-4 text-sm">
      {items.map((q, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <RichText text={`**${i + 1}.** ${q.q}`} />
          {q.choices.map((c, ci) => {
            const done = picked[i] !== undefined;
            return (
              <button
                key={ci}
                type="button"
                disabled={done}
                onClick={() => setPicked({ ...picked, [i]: ci })}
                className={cn("rounded-xl border px-3 py-1.5 text-left", !done && "hover:border-foreground/40", done && ci === q.answer && "border-success bg-success/10", done && picked[i] === ci && ci !== q.answer && "border-primary bg-primary/10")}
              >
                <RichText text={c} />
              </button>
            );
          })}
          {picked[i] !== undefined && <RichText text={q.why} className="text-xs text-muted-foreground" />}
        </div>
      ))}
      {Object.keys(picked).length === items.length && (
        <p className="rounded-xl bg-secondary px-3 py-2 font-display font-semibold text-secondary-foreground">
          Результат: {right} из {items.length}
        </p>
      )}
    </div>
  );
}

function Cards({ cards }: { cards: { front: string; back: string }[] }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const c = cards[i];
  if (!c) return <p className="text-sm text-muted-foreground">Карточек не получилось.</p>;
  return (
    <div className="flex flex-col items-center gap-3">
      <button type="button" onClick={() => setFlip(!flip)} className="w-full [perspective:900px]" aria-label="Перевернуть карточку">
        <motion.div animate={{ rotateY: flip ? 180 : 0 }} transition={{ type: "spring", stiffness: 200, damping: 22 }} className="relative h-44 w-full [transform-style:preserve-3d]">
          <div className="absolute inset-0 grid place-items-center rounded-2xl bg-secondary p-4 text-center text-secondary-foreground [backface-visibility:hidden]">
            <RichText text={c.front} />
          </div>
          <div className="absolute inset-0 grid place-items-center rounded-2xl border-2 border-primary bg-card p-4 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <RichText text={c.back} className="font-semibold" />
          </div>
        </motion.div>
      </button>
      <div className="flex items-center gap-3 text-sm">
        <Button variant="outline" size="icon" aria-label="Предыдущая" onClick={() => (setI(Math.max(0, i - 1)), setFlip(false))} disabled={i === 0}>
          <ChevronLeft />
        </Button>
        <span className="tabular text-muted-foreground">
          {i + 1} / {cards.length}
        </span>
        <Button variant="outline" size="icon" aria-label="Следующая" onClick={() => (setI(Math.min(cards.length - 1, i + 1)), setFlip(false))} disabled={i === cards.length - 1}>
          <ChevronRight />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Нажми на карточку, чтобы перевернуть</p>
    </div>
  );
}

function Ask({ chat, busy, onAsk }: { chat: { q: string; a: string }[]; busy: boolean; onAsk: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <div className="flex flex-col gap-3 text-sm">
      {!chat.length && <p className="text-muted-foreground">Спроси что угодно про эту страницу: «почему так?», «объясни пример», «где это в жизни?»</p>}
      {chat.map((m, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <p className="self-end rounded-2xl rounded-br-md bg-secondary px-3 py-2 text-secondary-foreground">{m.q}</p>
          <div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2">
            <RichText text={m.a} />
          </div>
        </div>
      ))}
      {busy && <p className="animate-pulse text-xs text-muted-foreground">ИИ думает…</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim() || busy) return;
          onAsk(q.trim());
          setQ("");
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Твой вопрос" aria-label="Вопрос к ИИ" />
        <Button type="submit" size="icon" aria-label="Отправить" disabled={busy || !q.trim()}>
          <Send />
        </Button>
      </form>
    </div>
  );
}

function Notes({ data, place, onNotes }: { data: BookData; place: string; onNotes: (n: BookNote[]) => void }) {
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);
  const notes = data.notes.filter((n) => all || n.place === place);
  const label = (p: string) => (data.chapters ? data.chapters.find((c) => c.id === p)?.title ?? p : `стр. ${p}`);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Заметка к этой странице" aria-label="Новая заметка" />
      <Button
        size="sm"
        className="self-start"
        disabled={!text.trim()}
        onClick={async () => {
          const n = await api<BookNote>(`/library/${data.meta.id}/notes`, { body: { place, text } });
          onNotes([n, ...data.notes]);
          setText("");
        }}
      >
        Сохранить
      </Button>
      <Select aria-label="Какие заметки показать" value={all ? "all" : "here"} onChange={(e) => setAll(e.target.value === "all")} className="h-8 text-xs">
        <option value="here">Заметки к этой странице</option>
        <option value="all">Все заметки по учебнику</option>
      </Select>
      {notes.map((n) => (
        <div key={n.id} className="group flex gap-2 rounded-xl bg-[#fff6d6] px-3 py-2 dark:bg-warning/15">
          <div className="min-w-0 flex-1">
            {all && <p className="text-[11px] font-semibold text-muted-foreground">{label(n.place)}</p>}
            <p className="whitespace-pre-line">{n.text}</p>
          </div>
          <button
            type="button"
            aria-label="Удалить заметку"
            onClick={async () => {
              await api(`/library/${data.meta.id}/notes/${n.id}`, { method: "DELETE" });
              onNotes(data.notes.filter((x) => x.id !== n.id));
            }}
            className="text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
