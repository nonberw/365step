import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { ArrowLeft, Bot, CheckCircle2, CircuitBoard, Cpu, ListChecks, RotateCcw, Send, Upload, Zap } from "lucide-react";
import { api } from "@/api";
import { RichText } from "@/components/RichText";
import { t } from "@/lib/athena/i18n";
import { Board } from "@/lib/athena/sim/board";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, Segmented } from "@/components/ui/card";
import CircuitSim from "@/components/athena/CircuitSim";
import BreadboardEditor from "@/components/athena/BreadboardEditor";
import WiringGuide from "@/components/athena/WiringGuide";
import { ARDUINO_LESSONS, arduinoLesson } from "@/lib/athena/lessons";
import { conditionText } from "@/lib/athena/sim/describe";
import { useCircuitRunner } from "@/lib/athena/sim/session";
import { useStore } from "@/lib/athena/store";
import { saveEngProgress, useEngProgress } from "./progress";

// Arduino lab: Athena IDE's breadboard simulator (a C++ interpreter on a virtual Uno with electrical checks)
// with BSTS lessons. The sketch is "flashed" into the virtual board; the task check runs it with scripted inputs.

export default function ArduinoLab() {
  const { lesson: id = ARDUINO_LESSONS[0].id } = useParams();
  const l = arduinoLesson(id);
  const nav = useNavigate();
  const project = `lab:${l.id}`;
  const { open, sketches, setSketch, setLab, playing, togglePlay } = useStore();
  const progress = useEngProgress();
  const [view, setView] = useState<"sim" | "board" | "guide">("sim");
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<{ pass: boolean; xp?: string; text?: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  useCircuitRunner();

  useEffect(() => {
    open(project, l.preset);
    const have = useStore.getState().sketches[project]?.text;
    if (!have) setSketch(project, l.starter, l.starter);
    setDraft(have ?? l.starter);
    setResult(null);
    setAnswer("");
    setLab({
      condition: l.check,
      onCheck: (r) => {
        setResult({ pass: r.pass, text: t(r.text, r.vars) });
        if (r.pass)
          saveEngProgress(`arduino:${l.id}`, 100)
            .then((x) => {
              setResult({ pass: true, xp: x.xp ? `+${x.xp} XP` : "" });
              progress.reload();
            })
            .catch(() => undefined);
      },
    });
    return () => setLab(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l.id]);

  const flashed = sketches[project]?.text ?? l.starter;
  const dirty = draft !== flashed;
  const flash = () => {
    setSketch(project, draft, l.starter);
    if (!playing) togglePlay();
  };
  const idx = ARDUINO_LESSONS.findIndex((x) => x.id === l.id);
  const done = (lid: string) => !!progress.data?.items[`arduino:${lid}`];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/engineering" className="grid size-9 place-items-center rounded-full border border-border hover:bg-muted" aria-label="Назад">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Arduino · урок {idx + 1} из {ARDUINO_LESSONS.length} · {"★".repeat(l.level)}
          </p>
          <h1 className="font-display text-2xl font-bold">{l.title}</h1>
        </div>
        <select value={l.id} onChange={(e) => nav(`/engineering/arduino/${e.target.value}`)} className="h-10 rounded-full border border-border bg-card px-4 text-sm">
          {ARDUINO_LESSONS.map((x, i) => (
            <option key={x.id} value={x.id}>
              {done(x.id) ? "✓ " : ""}
              {i + 1}. {x.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.35fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="flex flex-col gap-2">
            <p className="text-sm leading-6">{l.theory}</p>
            <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium">Задание: {l.task}</p>
            <p className="text-xs text-muted-foreground">Проверка: {conditionText(l.check)}</p>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">
              <span className="flex items-center gap-1.5 font-mono">
                <Cpu className="size-3.5 text-primary" /> sketch.ino
              </span>
              {dirty ? <span className="text-[#e0a100]">изменения не прошиты</span> : <span className="text-success">прошито в плату</span>}
            </div>
            <CodeMirror value={draft} onChange={setDraft} extensions={[cpp()]} theme={oneDark} height="380px" basicSetup={{ foldGutter: false }} />
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button onClick={flash}>
              <Upload /> Прошить и запустить
            </Button>
            <Button variant="outline" onClick={() => setDraft(l.starter)}>
              <RotateCcw /> Сначала
            </Button>
          </div>
          <Card className="flex flex-col gap-2">
            <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <Bot className="size-3.5" /> Наставник по Arduino
            </p>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setAsking(true);
                // What the board says about the code right now: a compile error is the most useful context.
                const board = new Board(useStore.getState().graph);
                const err = board.load(draft);
                const status = [err ? `Ошибка компиляции, строка ${err.line}: ${err.message}` : "", result?.text ? `Автопроверка: ${result.text}` : ""].filter(Boolean).join("; ");
                try {
                  setAnswer((await api<{ text: string }>("/eng/arduino-help", { body: { lesson: l.title, task: l.task, code: draft, status, question } })).text);
                } catch (x) {
                  setAnswer((x as Error).message);
                } finally {
                  setAsking(false);
                }
              }}
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Почему не работает? Зачем резистор? Что делает pulseIn?"
                className="h-10 min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-sm"
              />
              <Button type="submit" disabled={asking}>
                <Send /> {asking ? "Думаю…" : "Спросить"}
              </Button>
            </form>
            {answer && (
              <div className="rounded-xl bg-muted/60 p-3 text-sm">
                <RichText text={answer} />
              </div>
            )}
          </Card>
          {result && (
            <Card className={cn("flex items-center gap-2 text-sm", result.pass ? "border-success/50 text-success" : "")}>
              {result.pass ? (
                <>
                  <CheckCircle2 className="size-5" /> Задание выполнено! {result.xp}
                  {idx < ARDUINO_LESSONS.length - 1 && (
                    <Button size="sm" className="ml-auto" onClick={() => nav(`/engineering/arduino/${ARDUINO_LESSONS[idx + 1].id}`)}>
                      Следующий урок
                    </Button>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Пока не получилось — причина написана под схемой. Поправь код, прошей и проверь снова.</span>
              )}
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              {
                value: "sim",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Zap className="size-3.5" /> Симуляция
                  </span>
                ),
              },
              {
                value: "board",
                label: (
                  <span className="flex items-center gap-1.5">
                    <CircuitBoard className="size-3.5" /> Макетная плата
                  </span>
                ),
              },
              {
                value: "guide",
                label: (
                  <span className="flex items-center gap-1.5">
                    <ListChecks className="size-3.5" /> Сборка по шагам
                  </span>
                ),
              },
            ]}
          />
          <div className="rounded-3xl bg-[#14161c] p-4 text-neutral-100">{view === "sim" ? <CircuitSim /> : view === "board" ? <BreadboardEditor /> : <WiringGuide />}</div>
          <p className="text-xs text-muted-foreground">
            Симулятор из Athena IDE: интерпретатор C++ для Arduino Uno с точным временем (16 МГц), расчёт токов и напряжений, мультиметр, сгорающие без резистора светодиоды. Нажимай кнопки, крути ручки и двигай
            препятствия прямо на схеме.
          </p>
        </div>
      </div>
    </div>
  );
}
