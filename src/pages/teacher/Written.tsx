import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Check, ImagePlus, RefreshCw, ScanText, Sparkles, Trash2, X } from "lucide-react";
import { api, fetchBlob, upload } from "@/api";
import { useApi } from "@/hooks/useApi";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Aurora } from "@/pages/ent/EntHome";

interface Check {
  id: string;
  classCode: string;
  studentId: string;
  student: string;
  title: string;
  task: string;
  criteria: string;
  max: number;
  images: number;
  result: null | { transcript: string; criteria: { name: string; points: number; max: number; comment: string }[]; score: number; feedback: string; unreadable: boolean; mode: string };
  finalScore: number | null;
  comment: string;
  createdAt: number;
  checkedAt: number | null;
}

interface Data {
  classes: { code: string; name: string }[];
  students: { id: string; name: string; classCode: string }[];
  checks: Check[];
}

/** Phone photos are 3–10 MB: shrink to 1600 px JPEG in the browser before upload. */
async function compress(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.82));
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

const PRESETS = [
  { label: "СОР / СОЧ", text: "По дескрипторам: каждый верно выполненный дескриптор — 1 балл. Учитывать ход решения, а не только ответ." },
  { label: "Задачи", text: "Верный ответ — 1 балл; верный ход решения — 1 балл; оформление и единицы измерения — 1 балл за задачу." },
  { label: "Эссе", text: "Содержание и аргументы — 4; структура — 3; грамотность — 3." },
];

export default function Written() {
  const { data, error, loading, setData } = useApi<Data>("/written");
  const [open, setOpen] = useState<Check | null>(null);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#120d0d] text-white">
        <Aurora />
        <div className="relative grid grid-cols-1 items-center gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/80">
              <ScanText className="size-3.5 text-[#ff8562]" /> Проверка по фото
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
              Сфотографируйте тетрадь — <span className="bg-gradient-to-r from-[#ff8562] to-[#ff3b3b] bg-clip-text text-transparent">ИИ проверит</span>
            </h1>
            <p className="max-w-xl text-white/70">Claude расшифрует решение, оценит его по вашим критериям и напишет отзыв ученику. Оценка предварительная: вы её подтверждаете, и она попадает в журнал.</p>
          </div>
          <div className="relative mx-auto h-44 w-64" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ rotate: 0, y: 20, opacity: 0 }}
                animate={{ rotate: (i - 1) * 8, y: 0, opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
                className="absolute inset-0 rounded-2xl border border-white/20 bg-[repeating-linear-gradient(white_0,white_22px,#cfd8e3_23px)] shadow-2xl"
                style={{ zIndex: i }}
              >
                {i === 2 && (
                  <motion.span
                    initial={{ top: "8%" }}
                    animate={{ top: ["8%", "88%", "8%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-x-3 h-0.5 rounded-full bg-[#ff3b3b] shadow-[0_0_14px_#ff3b3b]"
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <NewCheck
        data={data}
        onDone={(c) => {
          setData({ ...data, checks: [c, ...data.checks] });
          setOpen(c);
        }}
      />

      <AnimatePresence>
        {open && <Result key={open.id} c={open} onChange={(c) => (setOpen(c), setData({ ...data, checks: data.checks.map((x) => (x.id === c.id ? c : x)) }))} onClose={() => setOpen(null)} />}
      </AnimatePresence>

      {data.checks.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">Проверенные работы</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.checks.map((c) => (
              <button key={c.id} type="button" onClick={() => setOpen(c)} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-display font-semibold">{c.title}</span>
                  {c.finalScore !== null ? <Badge tone="ok">в журнале</Badge> : <Badge tone="warn">ждёт подтверждения</Badge>}
                </span>
                <span className="text-sm">{c.student}</span>
                <span className="text-xs text-muted-foreground">
                  {fmtDate(c.createdAt)} · {c.finalScore ?? c.result?.score ?? "—"} из {c.max}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NewCheck({ data, onDone }: { data: Data; onDone: (c: Check) => void }) {
  const [classCode, setClassCode] = useState(data.classes[0]?.code ?? "");
  const students = data.students.filter((s) => s.classCode === classCode);
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [task, setTask] = useState("");
  const [criteria, setCriteria] = useState("");
  const [max, setMax] = useState(10);
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const student = studentId || students[0]?.id || "";

  async function add(files: FileList | null) {
    for (const f of Array.from(files ?? []).slice(0, 6 - photos.length)) {
      if (!f.type.startsWith("image/")) continue;
      setUploading((n) => n + 1);
      try {
        const small = await compress(f);
        const r = await upload<{ id: string }>("/written/upload", small);
        setPhotos((p) => [...p, { id: r.id, url: URL.createObjectURL(small) }]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function check() {
    setBusy(true);
    setError("");
    try {
      const c = await api<Check>("/written", { body: { classCode, studentId: student, title, task, criteria, max, images: photos.map((p) => p.id) } });
      onDone(c);
      setPhotos([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data.classes.length) return <Card className="text-sm text-muted-foreground">Сначала создайте класс — работы привязываются к ученикам класса.</Card>;

  return (
    <Card className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-3">
        <p className="font-display font-semibold">1. Фото работы</p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => (e.preventDefault(), setDrag(false), add(e.dataTransfer.files))}
          className={cn(
            "flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center transition-colors hover:border-primary",
            drag ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <Camera className="size-8 text-primary" />
          <span className="font-display font-semibold">Сфотографируйте или перетащите</span>
          <span className="text-xs text-muted-foreground">до 6 страниц · фото сжимаются на устройстве</span>
        </button>
        <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => add(e.target.files)} />
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <motion.div key={p.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative">
              <img src={p.url} alt={`Страница ${i + 1}`} className="size-20 rounded-xl object-cover ring-1 ring-border" />
              <button
                type="button"
                aria-label="Убрать фото"
                onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-secondary text-secondary-foreground"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
          {uploading > 0 && (
            <span className="grid size-20 place-items-center rounded-xl bg-muted">
              <ImagePlus className="size-5 animate-pulse text-muted-foreground" />
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="font-display font-semibold">2. Кто и что</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select aria-label="Класс" value={classCode} onChange={(e) => (setClassCode(e.target.value), setStudentId(""))} className="h-10">
            {data.classes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Ученик" value={student} onChange={(e) => setStudentId(e.target.value)} className="h-10">
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <Input aria-label="Название работы" placeholder="Название: СОР по алгебре №2" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input aria-label="Максимум баллов" type="number" min={1} max={100} value={max} onChange={(e) => setMax(Number(e.target.value))} />
        </div>
        <Textarea aria-label="Задание" rows={2} placeholder="Задание (необязательно, если оно видно на фото)" value={task} onChange={(e) => setTask(e.target.value)} />
        <Textarea aria-label="Критерии" rows={3} placeholder="Критерии оценивания или дескрипторы" value={criteria} onChange={(e) => setCriteria(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setCriteria(p.text)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted">
              {p.label}
            </button>
          ))}
        </div>
        <ErrorBox message={error} />
        <Button size="lg" onClick={check} disabled={busy || !photos.length || !title.trim() || !student || uploading > 0} className="self-start">
          <Sparkles /> {busy ? "ИИ читает и проверяет… до минуты" : "Проверить с ИИ"}
        </Button>
      </div>
    </Card>
  );
}

function Photo({ checkId, n }: { checkId: string; n: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    fetchBlob(`/written/${checkId}/image/${n}`)
      .then((b) => {
        made = URL.createObjectURL(b);
        if (alive) setUrl(made);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [checkId, n]);
  return url ? <img src={url} alt={`Страница ${n + 1}`} className="w-full rounded-xl ring-1 ring-border" /> : <div className="aspect-[3/4] w-full animate-pulse rounded-xl bg-muted" />;
}

function Result({ c, onChange, onClose }: { c: Check; onChange: (c: Check) => void; onClose: () => void }) {
  const [score, setScore] = useState(c.finalScore ?? c.result?.score ?? 0);
  const [comment, setComment] = useState(c.comment || c.result?.feedback || "");
  const [busy, setBusy] = useState("");
  const r = c.result;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
      <Card className="flex flex-col gap-4 border-primary/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-primary">Результат ИИ · предварительно</p>
            <h2 className="font-display text-2xl font-semibold">
              {c.title} · {c.student}
            </h2>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={!!busy}
              onClick={async () => {
                setBusy("regrade");
                try {
                  const x = await api<Check>(`/written/${c.id}/regrade`, { body: {} });
                  onChange(x);
                  setScore(x.result?.score ?? 0);
                  setComment(x.result?.feedback ?? "");
                } finally {
                  setBusy("");
                }
              }}
            >
              <RefreshCw /> {busy === "regrade" ? "Проверяю…" : "Проверить заново"}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Закрыть" onClick={onClose}>
              <X />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          <div className="flex max-h-[70dvh] flex-col gap-2 overflow-y-auto">
            {Array.from({ length: c.images }, (_, i) => (
              <Photo key={i} checkId={c.id} n={i} />
            ))}
          </div>
          <div className="flex flex-col gap-4">
            {r?.unreadable && <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">ИИ не смог прочитать фото — переснимите при хорошем свете.</p>}
            {r && (
              <details className="rounded-xl bg-muted/50 px-3 py-2" open>
                <summary className="cursor-pointer text-sm font-semibold">Расшифровка решения</summary>
                <RichText text={r.transcript} className="mt-2 text-sm" />
              </details>
            )}
            {r && r.criteria.length > 0 && (
              <div className="flex flex-col gap-2">
                {r.criteria.map((k, i) => (
                  <div key={i} className="rounded-xl border border-border px-3 py-2 text-sm">
                    <span className="flex justify-between gap-2 font-medium">
                      {k.name}
                      <b className="font-display tabular">
                        {k.points}/{k.max}
                      </b>
                    </span>
                    <span className="text-xs text-muted-foreground">{k.comment}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-3 rounded-2xl bg-secondary p-4 text-secondary-foreground">
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/70">Итог</span>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  max={c.max}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  aria-label="Баллы"
                  className="h-11 w-24 rounded-xl bg-white/10 px-3 text-center font-display text-2xl font-bold text-white outline-none ring-1 ring-white/20 focus:ring-[#ff8562]"
                />
                <span className="font-display text-xl text-white/60">из {c.max}</span>
                {c.result && score !== c.result.score && <span className="text-xs text-[#ff8562]">ИИ предлагал {c.result.score}</span>}
              </div>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Комментарий ученику" className="border-white/20 bg-white/5 text-white" />
              <Button
                className="self-start"
                disabled={!!busy}
                onClick={async () => {
                  setBusy("confirm");
                  try {
                    onChange(await api<Check>(`/written/${c.id}/confirm`, { body: { score, comment } }));
                  } finally {
                    setBusy("");
                  }
                }}
              >
                <Check /> {c.finalScore !== null ? "Обновить в журнале" : "Подтвердить в журнал"}
              </Button>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Удалить работу и фото?")) return;
                await api(`/written/${c.id}`, { method: "DELETE" });
                location.reload();
              }}
              className="flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" /> Удалить работу
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
