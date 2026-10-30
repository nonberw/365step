import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { ArrowLeft, Box, CheckCircle2, Download, Loader2, Play, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { CAD_LESSONS, cadLesson, checkCad, type CadMeasure } from "@shared/cadLessons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CadMesh, ToCad } from "@/lib/cad/cad.worker";
import { cad, cadError, call, downloadPart, readyListeners, readyMs } from "@/lib/cad/client";
import CadViewport from "@/lib/cad/CadViewport";
import { saveEngProgress, useEngProgress } from "./progress";

const readCode = (id: string) => {
  try {
    return localStorage.getItem(`bsts-cad-${id}`);
  } catch {
    return null;
  }
};
const writeCode = (id: string, v: string) => {
  try {
    localStorage.setItem(`bsts-cad-${id}`, v);
  } catch {
    // not critical
  }
};

export default function CadLab() {
  const { lesson: id = CAD_LESSONS[0].id } = useParams();
  const l = cadLesson(id);
  const nav = useNavigate();
  const progress = useEngProgress();
  const [code, setCode] = useState(() => readCode(l.id) ?? l.starter);
  const [meshes, setMeshes] = useState<CadMesh[]>([]);
  const [measure, setMeasure] = useState<CadMeasure | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kernel, setKernel] = useState(readyMs !== null);
  const [result, setResult] = useState<{ ok: boolean; notes: string[] } | null>(null);
  const [saved, setSaved] = useState("");
  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => {
    cad();
    const f = () => setKernel(true);
    readyListeners.add(f);
    return () => void readyListeners.delete(f);
  }, []);

  useEffect(() => {
    setCode(readCode(l.id) ?? l.starter);
    setResult(null);
    setSaved("");
    setMeshes([]);
    setMeasure(null);
  }, [l]);

  async function run() {
    setBusy(true);
    setError("");
    writeCode(l.id, codeRef.current);
    const r = await call({ type: "run", code: codeRef.current } as ToCad);
    setBusy(false);
    if (r.type === "error") {
      setError(cadError(r.message));
      return;
    }
    if (r.type !== "built") return;
    setMeshes(r.meshes);
    setMeasure(r.measure);
    const c = checkCad(l, r.measure);
    setResult(c);
    if (c.ok && !progress.data?.items[`cad:${l.id}`]) {
      saveEngProgress(`cad:${l.id}`, 100)
        .then((x) => {
          setSaved(x.xp ? `+${x.xp} XP` : "");
          progress.reload();
        })
        .catch(() => setSaved(""));
    }
  }

  // First build as soon as the kernel is ready.
  useEffect(() => {
    if (kernel) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kernel, l.id]);

  async function download(format: "stl" | "step") {
    const err = await downloadPart(l.id, format);
    if (err) setError(err);
  }

  const idx = CAD_LESSONS.findIndex((x) => x.id === l.id);
  const done = (lid: string) => !!progress.data?.items[`cad:${lid}`];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/engineering" className="grid size-9 place-items-center rounded-full border border-border hover:bg-muted" aria-label="Назад">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            CAD-лаборатория · урок {idx + 1} из {CAD_LESSONS.length} · {l.topic}
          </p>
          <h1 className="font-display text-2xl font-bold">{l.title}</h1>
        </div>
        <Link to="/engineering/cad-studio" className="flex h-10 items-center gap-1.5 rounded-full bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/15">
          <Sparkles className="size-4" /> ИИ-конструктор
        </Link>
        <select value={l.id} onChange={(e) => nav(`/engineering/cad/${e.target.value}`)} className="h-10 rounded-full border border-border bg-card px-4 text-sm">
          {CAD_LESSONS.map((x, i) => (
            <option key={x.id} value={x.id}>
              {done(x.id) ? "✓ " : ""}
              {i + 1}. {x.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="flex flex-col gap-2">
            <p className="text-sm leading-6">{l.theory}</p>
            <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium">Задание: {l.task}</p>
            <div className="flex flex-wrap gap-1.5">
              {l.api.map((a) => (
                <code key={a} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
                  {a}
                </code>
              ))}
            </div>
          </Card>
          <Card className="overflow-hidden p-0">
            <CodeMirror
              value={code}
              onChange={setCode}
              extensions={[javascript()]}
              theme={oneDark}
              height="360px"
              basicSetup={{ foldGutter: false }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void run();
              }}
            />
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button onClick={run} disabled={busy || !kernel}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />} {kernel ? "Построить (Ctrl+Enter)" : "Загружаю ядро CAD…"}
            </Button>
            <Button variant="outline" onClick={() => setCode(l.starter)}>
              <RotateCcw /> Сначала
            </Button>
            <Button variant="outline" onClick={() => download("stl")} disabled={!meshes.length}>
              <Download /> STL для 3D-печати
            </Button>
            <Button variant="outline" onClick={() => download("step")} disabled={!meshes.length}>
              <Download /> STEP
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <CadViewport meshes={meshes} measure={measure} kernel={kernel} />
          {error && (
            <Card className="flex gap-2 border-destructive/40 text-sm text-destructive">
              <XCircle className="mt-0.5 size-4 shrink-0" /> {error}
            </Card>
          )}
          {result && !error && (
            <Card className={cn("flex flex-col gap-2", result.ok ? "border-success/50" : "")}>
              {result.ok ? (
                <p className="flex items-center gap-2 font-semibold text-success">
                  <CheckCircle2 className="size-5" /> Деталь соответствует заданию! {saved}
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-2 font-semibold">
                    <Box className="size-5 text-primary" /> Пока не совпадает с заданием
                  </p>
                  {result.notes.map((n) => (
                    <p key={n} className="text-sm text-muted-foreground">
                      — {n}
                    </p>
                  ))}
                </>
              )}
              {result.ok && idx < CAD_LESSONS.length - 1 && (
                <Button size="sm" className="self-start" onClick={() => nav(`/engineering/cad/${CAD_LESSONS[idx + 1].id}`)}>
                  Следующий урок
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
