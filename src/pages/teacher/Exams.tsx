import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, FileText, FileUp, ImageIcon, Radio, Sparkles, Trash2, Wand2 } from "lucide-react";
import type { ExamFull, ExamQuestionType, ExamSummary, MaterialInfo } from "@shared/types";
import { api, upload } from "@/api";
import { useApi } from "@/hooks/useApi";
import { ART, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, GreetingBanner, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Empty } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Toggle } from "./ClassPage";

export const TYPE_RU: Record<ExamQuestionType, string> = { mcq: "Выбор ответа", tf: "Верно / неверно", short: "Короткий ответ", open: "Развёрнутый ответ" };
export const STATUS_RU = { draft: "Черновик", live: "Идёт", finished: "Завершена" } as const;

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);

export default function Exams() {
  const exams = useApi<ExamSummary[]>("/exams", 10_000);
  const live = exams.data?.filter((e) => e.status === "live") ?? [];
  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner title="Контрольные с ИИ" subtitle="Загрузите учебные материалы — Claude составит вопросы, вы проверите их и запустите для всего класса по коду. Прохождение видно в реальном времени." image={ART.athens} position="center 40%" />
      {live.map((e) => (
        <Link key={e.id} to={`/teacher/exams/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground">
          <span className="flex items-center gap-3">
            <Radio className="size-5 animate-pulse" />
            <span className="font-display font-semibold">
              Идёт: {e.title} · {e.className}
            </span>
          </span>
          <span className="flex items-center gap-3 font-display">
            код <b className="tracking-[0.2em]">{e.code}</b> · сдали {e.submitted}/{e.students} <ArrowRight className="size-4" />
          </span>
        </Link>
      ))}
      <Creator onCreated={exams.reload} />
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">Все контрольные</h2>
        {exams.loading ? (
          <Loading />
        ) : exams.error ? (
          <ErrorBox message={exams.error} />
        ) : !exams.data?.length ? (
          <Empty title="Контрольных пока нет">Создайте первую по своим материалам — это займёт пару минут.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border">
            {exams.data.map((e) => (
              <li key={e.id} className="border-b border-border last:border-b-0">
                <Link to={`/teacher/exams/${e.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {e.className} · {e.questions} вопросов · {e.durationMin} мин · {fmtDate(e.createdAt)}
                    </span>
                  </span>
                  {e.status !== "draft" && (
                    <span className="text-xs tabular text-muted-foreground">
                      сдали {e.submitted}/{e.students}
                    </span>
                  )}
                  <Badge tone={e.status === "live" ? "brand" : e.status === "finished" ? "ok" : "soft"}>{STATUS_RU[e.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Creator({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const overview = useApi<{ classes: { code: string; name: string; students: number }[] }>("/teacher/overview");
  const materials = useApi<MaterialInfo[]>("/exams/materials");
  const [picked, setPicked] = useState<string[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", grade: "", classCode: "", count: 10, durationMin: 30, difficulty: "mixed", language: "ru", instructions: "", notes: "" });
  const [types, setTypes] = useState<ExamQuestionType[]>(["mcq", "tf", "short", "open"]);
  const [lock, setLock] = useState(true);
  const [showResults, setShowResults] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const classCode = form.classCode || overview.data?.classes[0]?.code || "";

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    for (const f of Array.from(files)) {
      setUploading((u) => [...u, f.name]);
      try {
        const m = await upload<MaterialInfo>("/exams/materials", f);
        materials.setData((list) => [m, ...(list ?? [])]);
        setPicked((p) => [...p, m.id]);
        if (!form.title) setForm((s) => ({ ...s, title: s.title || m.title }));
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      } finally {
        setUploading((u) => u.filter((n) => n !== f.name));
      }
    }
  }

  async function removeMaterial(id: string) {
    await api(`/exams/materials/${id}`, { method: "DELETE" }).catch(() => {});
    materials.setData((list) => list?.filter((m) => m.id !== id) ?? null);
    setPicked((p) => p.filter((x) => x !== id));
  }

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const exam = await api<ExamFull>("/exams/generate", { body: { ...form, classCode, count: Number(form.count), durationMin: Number(form.durationMin), types, lock, showResults, materialIds: picked } });
      onCreated();
      navigate(`/teacher/exams/${exam.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <CardTitle className="flex items-center gap-2">
        <Wand2 className="size-5 text-primary" /> Новая контрольная
      </CardTitle>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-3">
          <p className="font-display text-sm font-semibold">1. Материалы</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              addFiles(e.dataTransfer.files);
            }}
            className={cn("flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center transition-colors hover:border-primary", drag && "border-primary bg-primary/5")}
          >
            <FileUp className="size-8 text-primary" />
            <span className="font-display font-semibold">Перетащите файлы или нажмите</span>
            <span className="text-xs text-muted-foreground">PDF, DOCX, TXT, фото доски или конспекта · до 32 МБ</span>
          </button>
          <input ref={input} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,image/*" onChange={(e) => addFiles(e.target.files)} />
          {uploading.map((n) => (
            <p key={n} className="animate-pulse text-sm text-muted-foreground">
              Загружаю и читаю «{n}»…
            </p>
          ))}
          {materials.data && materials.data.length > 0 && (
            <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              {materials.data.map((m) => {
                const on = picked.includes(m.id);
                return (
                  <motion.li key={m.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2", on ? "border-primary bg-primary/5" : "border-border")}>
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={on} aria-label={`Использовать «${m.title}»`} onChange={() => setPicked(on ? picked.filter((x) => x !== m.id) : [...picked, m.id])} />
                    {m.kind === "image" ? <ImageIcon className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{m.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.kind.toUpperCase()} · {kb(m.size)}
                        {m.pages ? ` · ${m.pages} стр.` : ""}
                        {m.kind !== "image" && ` · ${m.chars.toLocaleString("ru-RU")} знаков`}
                      </span>
                    </span>
                    <button type="button" aria-label="Удалить материал" onClick={() => removeMaterial(m.id)} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
          <Field label="Или вставьте текст / тему" htmlFor="ex-notes" hint="Конспект урока, параграф, список тем">
            <Textarea id="ex-notes" rows={4} value={form.notes} onChange={set("notes")} placeholder="Например: Законы Ньютона, 7 класс. Первый закон — инерция…" />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-display text-sm font-semibold">2. Настройки</p>
          <Field label="Название" htmlFor="ex-title">
            <Input id="ex-title" value={form.title} onChange={set("title")} placeholder="Контрольная: Фотосинтез" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Класс" htmlFor="ex-class">
              <Select id="ex-class" value={classCode} onChange={set("classCode")}>
                {overview.data?.classes.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Предмет" htmlFor="ex-subject">
              <Input id="ex-subject" value={form.subject} onChange={set("subject")} placeholder="Биология" />
            </Field>
            <Field label="Параллель" htmlFor="ex-grade">
              <Input id="ex-grade" value={form.grade} onChange={set("grade")} placeholder="7" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Вопросов" htmlFor="ex-count">
              <Input id="ex-count" type="number" min={3} max={30} value={form.count} onChange={set("count")} />
            </Field>
            <Field label="Минут" htmlFor="ex-dur">
              <Input id="ex-dur" type="number" min={5} max={240} value={form.durationMin} onChange={set("durationMin")} />
            </Field>
            <Field label="Сложность" htmlFor="ex-diff">
              <Select id="ex-diff" value={form.difficulty} onChange={set("difficulty")}>
                <option value="easy">Базовая</option>
                <option value="mixed">Смешанная</option>
                <option value="hard">Повышенная</option>
              </Select>
            </Field>
            <Field label="Язык" htmlFor="ex-lang">
              <Select id="ex-lang" value={form.language} onChange={set("language")}>
                <option value="ru">Русский</option>
                <option value="kk">Қазақша</option>
                <option value="en">English</option>
              </Select>
            </Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Типы вопросов</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_RU) as ExamQuestionType[]).map((t) => (
                <Toggle key={t} on={types.includes(t)} label={TYPE_RU[t]} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])} />
              ))}
            </div>
          </div>
          <Field label="Пожелания для ИИ" htmlFor="ex-instr" hint="Необязательно">
            <Textarea id="ex-instr" rows={2} value={form.instructions} onChange={set("instructions")} placeholder="Больше задач на применение, без вопросов про даты" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Toggle on={lock} label="Режим экзамена (как Bluebook)" onClick={() => setLock(!lock)} />
            <Toggle on={showResults} label="Показать ученикам результат" onClick={() => setShowResults(!showResults)} />
          </div>
        </div>
      </div>
      <ErrorBox message={error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={generate} disabled={busy || !classCode || !types.length || uploading.length > 0}>
          <Sparkles /> {busy ? "Claude составляет вопросы… (до минуты)" : "Составить контрольную с ИИ"}
        </Button>
        <span className="text-xs text-muted-foreground">Сначала откроется черновик: вопросы можно поправить до запуска.</span>
      </div>
    </Card>
  );
}
