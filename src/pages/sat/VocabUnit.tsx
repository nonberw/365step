import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, RotateCw, Volume2 } from "lucide-react";
import type { VocabUnit as Unit, VocabWord } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, Segmented } from "@/components/ui/card";

type Mode = "cards" | "read" | "quiz";

export default function VocabUnit() {
  const { id = "" } = useParams();
  const { data: unit, error, loading } = useApi<Unit>(`/sat/vocab/${id}`);
  const [mode, setMode] = useState<Mode>("cards");
  if (loading) return <Loading />;
  if (!unit) return <ErrorBox message={error} />;
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Link to="/sat/vocab" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все юниты
      </Link>
      <PageHeader eyebrow={unit.topic} title={unit.title} />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "cards", label: "1. Карточки" },
          { value: "read", label: "2. Текст" },
          { value: "quiz", label: "3. Квиз" },
        ]}
      />
      {mode === "cards" && <Cards words={unit.words} onDone={() => setMode("read")} />}
      {mode === "read" && (
        <Card className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Слова юнита выделены. Прочитай текст и попробуй понять каждое по контексту.</p>
          <RichText text={unit.text} className="font-serif text-[17px] leading-8 [&_strong]:rounded [&_strong]:bg-accent/30 [&_strong]:px-0.5 [&_strong]:font-semibold" />
          <Button className="self-start" onClick={() => setMode("quiz")}>
            К квизу <ArrowRight />
          </Button>
        </Card>
      )}
      {mode === "quiz" && <Quiz unit={unit} />}
    </div>
  );
}

function speak(word: string) {
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US";
    speechSynthesis.speak(u);
  } catch {
    // speech is optional
  }
}

function Cards({ words, onDone }: { words: VocabWord[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const w = words[i]!;
  const go = (d: number) => {
    setFlipped(false);
    setI((k) => Math.max(0, Math.min(words.length - 1, k + d)));
  };
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-xl [perspective:1200px]">
        <button
          type="button"
          onClick={() => setFlipped(!flipped)}
          aria-label={flipped ? "Показать слово" : "Показать значение"}
          className="relative block h-72 w-full transition-transform duration-500 [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
        >
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-3xl bg-secondary p-6 text-secondary-foreground [backface-visibility:hidden]">
            <Badge tone="brand">{w.pos}</Badge>
            <span className="font-display text-4xl font-semibold">{w.word}</span>
            <span className="text-sm text-white/60">Нажми, чтобы перевернуть</span>
          </span>
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-primary bg-card p-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="text-lg font-semibold">{w.definition}</span>
            <span className="text-primary">{w.ru}</span>
            <span className="font-serif italic text-muted-foreground">“{w.example}”</span>
            <span className="text-xs text-muted-foreground">Синонимы: {w.similar.join(", ")}</span>
          </span>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" aria-label="Предыдущее слово" onClick={() => go(-1)} disabled={i === 0}>
          <ArrowLeft />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => speak(w.word)}>
          <Volume2 /> Произнести
        </Button>
        <span className="tabular text-sm text-muted-foreground">
          {i + 1} / {words.length}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setFlipped(!flipped)}>
          <RotateCw /> Перевернуть
        </Button>
        {i < words.length - 1 ? (
          <Button variant="outline" size="icon" aria-label="Следующее слово" onClick={() => go(1)}>
            <ArrowRight />
          </Button>
        ) : (
          <Button onClick={onDone}>К тексту</Button>
        )}
      </div>
    </div>
  );
}

function Quiz({ unit }: { unit: Unit }) {
  // Definition → word, with three other words of the unit as distractors.
  const questions = useMemo(
    () =>
      unit.words.map((w, k) => {
        const others = unit.words.filter((x) => x.id !== w.id).sort(() => Math.random() - 0.5).slice(0, 3);
        const options = [...others.map((o) => o.word)];
        const pos = (k * 7) % 4;
        options.splice(pos, 0, w.word);
        return { w, options, answer: pos };
      }),
    [unit],
  );
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<{ wordId: string; correct: boolean }[]>([]);
  const [saved, setSaved] = useState<string>("");
  const q = questions[i];

  async function choose(k: number) {
    if (picked !== null || !q) return;
    setPicked(k);
    setResults((r) => [...r, { wordId: q.w.id, correct: k === q.answer }]);
  }

  async function next() {
    if (i + 1 < questions.length) {
      setI(i + 1);
      setPicked(null);
      return;
    }
    const r = await api<{ right: number; total: number }>(`/sat/vocab/${unit.id}/result`, { body: { answers: results } }).catch(() => null);
    setSaved(r ? `Результат сохранён: ${r.right} из ${r.total}. +${r.right * 2} XP` : "Не удалось сохранить результат");
    setI(questions.length);
  }

  if (i >= questions.length) {
    const right = results.filter((r) => r.correct).length;
    return (
      <Card className="flex flex-col gap-3">
        <p className="font-display text-4xl font-semibold">
          {right}/{questions.length}
        </p>
        <p className="text-sm text-muted-foreground">{saved}</p>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {results.map((r) => {
            const w = unit.words.find((x) => x.id === r.wordId)!;
            return (
              <li key={r.wordId} className={cn("rounded-lg px-3 py-1.5 text-sm", r.correct ? "bg-[#e6f6ec] dark:bg-success/15" : "bg-[#fde3e4] dark:bg-destructive/15")}>
                <b>{w.word}</b> — {w.ru}
              </li>
            );
          })}
        </ul>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground tabular">
        Вопрос {i + 1} из {questions.length}
      </p>
      <p className="text-lg font-medium">Какое слово означает: «{q!.w.definition}»?</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {q!.options.map((o, k) => (
          <button
            key={o}
            type="button"
            disabled={picked !== null}
            onClick={() => choose(k)}
            className={cn("rounded-xl border-2 px-4 py-3 text-left font-medium", picked === null ? "border-border hover:border-primary" : k === q!.answer ? "border-success bg-[#e6f6ec] dark:bg-success/15" : k === picked ? "border-destructive bg-[#fde3e4] dark:bg-destructive/15" : "border-border opacity-60")}
          >
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <>
          <p className="font-serif italic text-muted-foreground">“{q!.w.example}”</p>
          <Button className="self-start" onClick={next}>
            {i + 1 < questions.length ? "Дальше" : "Завершить"}
          </Button>
        </>
      )}
    </Card>
  );
}
