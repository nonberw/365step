import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { ArrowLeft, Camera, Download, History, Loader2, Play, Sparkles, Wand2, X } from "lucide-react";
import type { CadMeasure } from "@shared/cadLessons";
import { api } from "@/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CadMesh, ToCad } from "@/lib/cad/cad.worker";
import { cad, cadError, call, downloadPart, readyListeners, readyMs } from "@/lib/cad/client";
import CadViewport from "@/lib/cad/CadViewport";

// AI CAD designer: the student describes a part in words (or photographs a hand sketch with dimensions),
// Claude writes parametric replicad code, the browser builds it on OpenCascade, and a build error goes
// back to the AI for a fix. Every result is a version the student can return to and edit by hand.

interface Version {
  at: number;
  prompt: string;
  photo: boolean;
  code: string;
  explain: string;
  params: string[];
  ok: boolean;
}

type Designed = { code: string; explain: string; params: string[]; expect: number[]; cached?: boolean; examples?: number; mode?: string; model?: { label: string; p: number; ms: number } };

const KEY = "bsts-cad-studio";
const IDEAS = [
  "Подставка для телефона под углом 60°, с вырезом для кабеля",
  "Шестерня на 20 зубьев с отверстием под вал 5 мм",
  "Корпус для датчика 40 × 25 × 15 мм с крышкой и отверстиями под винты M3",
  "Крепление камеры на луч дрона шириной 12 мм",
  "Органайзер для ручек на 6 ячеек",
];

function load(): Version[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Version[];
  } catch {
    return [];
  }
}
function save(v: Version[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v.slice(-30)));
  } catch {
    // not critical
  }
}

/** Photo of a sketch → JPEG of at most 1280 px, as base64 without the data: prefix. */
async function compress(file: File): Promise<{ mime: string; data: string; url: string }> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { mime: "image/jpeg", data: url.split(",")[1], url };
}

export default function CadStudio() {
  const [versions, setVersions] = useState<Version[]>(load);
  const [current, setCurrent] = useState(() => load().at(-1)?.code ?? "");
  const [prompt, setPrompt] = useState("");
  const [photo, setPhoto] = useState<{ mime: string; data: string; url: string } | null>(null);
  const [meshes, setMeshes] = useState<CadMesh[]>([]);
  const [measure, setMeasure] = useState<CadMeasure | null>(null);
  const [kernel, setKernel] = useState(readyMs !== null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cad();
    const f = () => setKernel(true);
    readyListeners.add(f);
    return () => void readyListeners.delete(f);
  }, []);

  const lastMeasure = useRef<CadMeasure | null>(null);
  async function build(code: string): Promise<string | null> {
    const r = await call({ type: "run", code } as ToCad);
    if (r.type === "error") return cadError(r.message);
    if (r.type === "built") {
      setMeshes(r.meshes);
      setMeasure(r.measure);
      lastMeasure.current = r.measure;
    }
    return null;
  }

  /** The model announced the size it meant; a part that came out different gets sent back (axes may be swapped). */
  function sizeMismatch(expect: number[]): string | null {
    const m = lastMeasure.current;
    if (!m || expect.length !== 3 || expect.some((x) => !(x > 0))) return null;
    const got = [...m.bbox].sort((a, b) => a - b);
    const want = [...expect].sort((a, b) => a - b);
    const off = got.some((g, i) => Math.abs(g - want[i]) > Math.max(2, want[i] * 0.1));
    return off ? `Габариты получились ${m.bbox.map((v) => v.toFixed(1)).join(" × ")} мм, а ты указал ${expect.join(" × ")} мм. Найди, где размер не совпал, и исправь.` : null;
  }

  useEffect(() => {
    if (kernel && current) void build(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kernel]);

  async function design(useLocal = true, text = prompt) {
    if (!text.trim() && !photo) return;
    setLastPrompt(text.trim());
    setError("");
    let code = "";
    let res: Designed | null = null;
    let err: string | null = null;
    let verified = false;
    const started = performance.now();
    try {
      // Agent loop (as in cadsmith): generate → build on the kernel → measure → send any error or size mismatch back.
      for (let attempt = 0; attempt < 3; attempt++) {
        setBusy(attempt === 0 ? "ИИ проектирует деталь…" : `ИИ исправляет: ${err?.slice(0, 80)}… (попытка ${attempt})`);
        res = await api<Designed>("/eng/cad-ai", {
          body: { prompt: text.trim(), code: attempt ? code : current || undefined, error: err ?? undefined, image: attempt === 0 && photo ? { mime: photo.mime, data: photo.data } : undefined, local: useLocal },
        });
        code = res.code;
        setBusy("Строю на OpenCascade и сверяю размеры…");
        err = (await build(code)) ?? sizeMismatch(res.expect);
        if (!err) {
          verified = true;
          break;
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
      return;
    }
    setBusy("");
    if (!res) return;
    setStats(
      `${((performance.now() - started) / 1000).toFixed(1)} с${res.mode === "local" && res.model ? ` · своя модель BSTS узнала «${res.model.label}» с уверенностью ${Math.round(res.model.p * 100)} % за ${res.model.ms} мс, без запроса к Claude` : ""}${res.cached ? " · из кэша" : ""}${res.examples ? ` · примеров из библиотеки: ${res.examples}` : ""}${verified ? " · размеры сверены" : ""}`,
    );
    const m = lastMeasure.current;
    if (m && !photo) void api("/eng/cad-library", { body: { prompt: text.trim(), code, bbox: m.bbox, volume: m.volume, verified } }).catch(() => undefined);
    const v: Version = { at: Date.now(), prompt: text.trim() || "по фото эскиза", photo: !!photo, code, explain: res.explain, params: res.params, ok: !err };
    const next = [...versions, v];
    setVersions(next);
    save(next);
    setCurrent(code);
    setPrompt("");
    setPhoto(null);
    if (err) setError(`ИИ не смог построить деталь без ошибок: ${err}. Опиши её иначе или поправь код вручную.`);
  }

  async function runManual() {
    setBusy("Строю на OpenCascade…");
    setError((await build(current)) ?? "");
    setBusy("");
  }

  const last = versions.at(-1);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/engineering/cad/box" className="grid size-9 place-items-center rounded-full border border-border hover:bg-muted" aria-label="К урокам CAD">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">CAD-лаборатория</p>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Sparkles className="size-6 text-primary" /> ИИ-конструктор
          </h1>
        </div>
        <Button variant="outline" onClick={() => downloadPart("detal", "stl").then((e) => e && setError(e))} disabled={!meshes.length}>
          <Download /> STL
        </Button>
        <Button variant="outline" onClick={() => downloadPart("detal", "step").then((e) => e && setError(e))} disabled={!meshes.length}>
          <Download /> STEP
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.3fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Опиши деталь словами или сфотографируй эскиз на бумаге с размерами. ИИ напишет параметрическую модель — потом можно попросить изменить её («сделай стенки толще», «добавь отверстие под винт») или поправить
              числа в коде самому.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={current ? "Что изменить? Например: увеличь высоту до 80 мм и скругли углы" : "Например: подставка для телефона под углом 60° с вырезом для кабеля"}
              className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm"
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void design();
              }}
            />
            {photo && (
              <div className="relative w-fit">
                <img src={photo.url} alt="Эскиз" className="h-24 rounded-xl border border-border object-cover" />
                <button type="button" onClick={() => setPhoto(null)} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-foreground text-background" aria-label="Убрать фото">
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => design()} disabled={!!busy || (!prompt.trim() && !photo) || !kernel}>
                {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} {current ? "Изменить деталь" : "Создать деталь"}
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!!busy}>
                <Camera /> Фото эскиза
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto(await compress(f));
                  e.target.value = "";
                }}
              />
              {current && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCurrent("");
                    setMeshes([]);
                    setMeasure(null);
                  }}
                >
                  Новая деталь
                </Button>
              )}
            </div>
            {busy && <p className="text-xs text-muted-foreground">{busy}</p>}
            {!busy && stats && <p className="text-xs text-muted-foreground">Готово за {stats}</p>}
            {!busy && stats.includes("своя модель") && (
              <Button
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={() => {
                  setCurrent("");
                  void design(false, lastPrompt);
                }}
              >
                <Sparkles /> Не то? Сделать через Claude
              </Button>
            )}
            {!current && !busy && (
              <div className="flex flex-wrap gap-1.5">
                {IDEAS.map((i) => (
                  <button key={i} type="button" onClick={() => setPrompt(i)} className="rounded-full bg-muted px-3 py-1 text-xs hover:bg-muted/70">
                    {i}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {last && current === last.code && (
            <Card className="flex flex-col gap-2 text-sm">
              <p>{last.explain}</p>
              {last.params.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {last.params.map((p) => (
                    <code key={p} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
                      {p}
                    </code>
                  ))}
                </div>
              )}
            </Card>
          )}

          {current && (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">
                <span className="font-mono">part.js — меняй параметры и нажми «Построить»</span>
                <Button size="sm" variant="ghost" onClick={runManual} disabled={!!busy}>
                  <Play /> Построить
                </Button>
              </div>
              <CodeMirror value={current} onChange={setCurrent} extensions={[javascript()]} theme={oneDark} height="300px" basicSetup={{ foldGutter: false }} />
            </Card>
          )}

          {versions.length > 0 && (
            <Card className="flex flex-col gap-2">
              <p className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                <History className="size-3.5" /> Версии
              </p>
              {[...versions].reverse().map((v) => (
                <button
                  key={v.at}
                  type="button"
                  onClick={() => {
                    setCurrent(v.code);
                    void build(v.code);
                  }}
                  className={cn("flex flex-col rounded-xl px-3 py-2 text-left text-sm hover:bg-muted", current === v.code && "bg-primary/10")}
                >
                  <span className="line-clamp-1 font-medium">
                    {v.photo ? "📷 " : ""}
                    {v.prompt}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(v.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {v.ok ? "" : " · с ошибкой"}
                  </span>
                </button>
              ))}
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <CadViewport meshes={meshes} measure={measure} kernel={kernel} />
          {error && <Card className="border-destructive/40 text-sm text-destructive">{error}</Card>}
          <p className="text-xs text-muted-foreground">Модель строится на ядре OpenCascade прямо в браузере. ИИ может ошибиться в размерах — проверь габариты в углу и поправь параметры перед печатью.</p>
        </div>
      </div>
    </div>
  );
}
