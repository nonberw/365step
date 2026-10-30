import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { BookOpen, FileUp, FlaskConical, Inbox, Search, Send, Sigma, Sparkles } from "lucide-react";
import type { BookMeta } from "@shared/types";
import { FORMULA_SHEETS, SUBJECTS } from "@shared/textbooks";
import { api, upload } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/lib/auth";
import { ART, fmtDate, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, GreetingBanner, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Empty, Progress, Segmented } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

const LANG = { ru: "Русский", kk: "Қазақша", en: "English" } as const;

// Covers are drawn, not downloaded: a colour per subject keeps the shelf readable.
const COVER: Record<string, string> = {
  Физика: "from-[#1d1919] via-[#3a1414] to-[#b5121b]",
  Алгебра: "from-[#b5121b] to-[#5c0a0e]",
  Математика: "from-[#b5121b] to-[#5c0a0e]",
  Геометрия: "from-[#7a1f1f] to-[#1d1919]",
  Информатика: "from-[#14213d] to-[#1d1919]",
  "Английский язык": "from-[#f2b705] to-[#c46a00]",
  Химия: "from-[#1f8a4c] to-[#0e3d22]",
  Биология: "from-[#3f7d3a] to-[#14301a]",
};

export function BookCover({ book, className }: { book: Pick<BookMeta, "title" | "subject" | "grade" | "source">; className?: string }) {
  return (
    <div className={cn("relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br p-4 text-white shadow-[inset_6px_0_0_rgba(0,0,0,0.25)]", COVER[book.subject] ?? "from-[#4a4444] to-[#1d1919]", className)}>
      <div className="pointer-events-none absolute -bottom-10 -right-10 size-32 rounded-full border-[14px] border-white/10" />
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">{book.subject}</span>
      <span className="font-display text-lg font-semibold leading-tight">{book.title}</span>
      <span className="flex items-center justify-between text-xs text-white/70">
        {book.grade ? `${book.grade} класс` : "BSTS"}
        {book.source === "builtin" && <span className="rounded-full bg-white/15 px-2 py-0.5">BSTS</span>}
      </span>
    </div>
  );
}

export default function Library() {
  const { user } = useAuth();
  const books = useApi<BookMeta[]>("/library");
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [lang, setLang] = useState<"all" | "ru" | "kk" | "en">("all");
  const list = useMemo(
    () =>
      (books.data ?? []).filter(
        (b) =>
          (!q || `${b.title} ${b.author} ${b.description}`.toLowerCase().includes(q.toLowerCase())) &&
          (!subject || b.subject === subject) &&
          (!grade || b.grade === Number(grade)) &&
          (lang === "all" || b.language === lang),
      ),
    [books.data, q, subject, grade, lang],
  );
  const reading = (books.data ?? []).filter((b) => b.progress);

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner title="Библиотека" subtitle="Читай учебники прямо на платформе: ИИ объяснит страницу, сделает конспект, тест и карточки, а в главах с опытами можно предсказать результат и проверить его." image={ART.painting} position="center 35%" />

      {reading.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">Продолжить чтение</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {reading.map((b) => (
              <Link key={b.id} to={`/library/${b.id}`} className="flex w-72 shrink-0 items-center gap-3 rounded-2xl border border-border p-3 hover:border-primary">
                <BookCover book={b} className="w-14 p-1.5 [&>span:first-child]:hidden [&>span:last-child]:hidden [&>span]:text-[8px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.title}</span>
                  <span className="text-xs text-muted-foreground">{b.format === "chapters" ? "" : `стр. ${b.progress!.place} · `}штампов «Понято»: {b.progress!.stamps}</span>
                  <Progress value={(b.progress!.stamps / Math.max(1, b.format === "chapters" ? b.places : Math.min(b.places, 20))) * 100} tone="ok" className="mt-1.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, автор, тема" className="pl-9" aria-label="Поиск по библиотеке" />
        </label>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Предмет" className="h-10 w-auto" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Все предметы</option>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select aria-label="Класс" className="h-10 w-auto" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">1–11 класс</option>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1} класс
              </option>
            ))}
          </Select>
          <Segmented value={lang} onChange={setLang} options={[{ value: "all", label: "Все" }, ...(Object.keys(LANG) as (keyof typeof LANG)[]).map((k) => ({ value: k, label: LANG[k] }))]} />
        </div>
      </div>

      {books.loading ? (
        <Loading />
      ) : books.error ? (
        <ErrorBox message={books.error} />
      ) : !list.length ? (
        <Empty title="Ничего не нашлось">Попробуй другой фильтр или попроси учителя добавить учебник — форма ниже.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
              <Link to={`/library/${b.id}`} className="group flex flex-col gap-2">
                <motion.div whileHover={{ y: -6, rotate: -1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                  <BookCover book={b} />
                </motion.div>
                <span className="line-clamp-2 text-sm font-medium group-hover:text-primary">{b.title}</span>
                <span className="flex flex-wrap gap-1">
                  <Badge tone="soft">{LANG[b.language]}</Badge>
                  {b.interactive > 0 && (
                    <Badge tone="brand">
                      <FlaskConical className="size-3" /> {b.interactive} {plural(b.interactive, "опыт", "опыта", "опытов")}
                    </Badge>
                  )}
                  <Badge tone="dark">
                    <Sparkles className="size-3" /> ИИ
                  </Badge>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {user?.role === "teacher" && <UploadBook onDone={books.reload} />}
      <Formulas />
      {user?.role === "teacher" ? <Requests /> : <RequestBook />}
    </div>
  );
}

function Formulas() {
  const [subject, setSubject] = useState(FORMULA_SHEETS[0].subject);
  const sheet = FORMULA_SHEETS.find((s) => s.subject === subject)!;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Sigma className="size-5 text-primary" /> Шпаргалки формул
        </CardTitle>
        <Segmented value={subject} onChange={setSubject} options={FORMULA_SHEETS.map((s) => ({ value: s.subject, label: s.subject }))} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sheet.items.map((f) => (
          <motion.div key={f.name} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs font-semibold text-muted-foreground">{f.name}</p>
            <RichText text={`$${f.tex}$`} className="mt-1 overflow-x-auto" />
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function UploadBook({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ title: "", subject: "Физика", grade: "", language: "ru", author: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof meta) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setMeta({ ...meta, [k]: e.target.value });

  async function send() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await upload("/library", file, { "X-Book-Meta": encodeURIComponent(JSON.stringify(meta)) });
      setFile(null);
      setMeta({ ...meta, title: "", author: "", description: "" });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle className="flex items-center gap-2">
        <FileUp className="size-5 text-primary" /> Добавить учебник
      </CardTitle>
      <p className="text-sm text-muted-foreground">PDF, DOCX или TXT до 32 МБ. Загружайте только учебники, на которые у школы есть права (свои методички, открытые издания, лицензированные копии). Учебник увидят все ученики школы.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
        <button type="button" onClick={() => input.current?.click()} className={cn("flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-center text-sm hover:border-primary", file ? "border-primary bg-primary/5" : "border-border")}>
          <BookOpen className="size-8 text-primary" />
          {file ? <span className="line-clamp-3 font-medium">{file.name}</span> : <span className="text-muted-foreground">Выбрать файл</span>}
        </button>
        <input
          ref={input}
          type="file"
          hidden
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !meta.title) setMeta((m) => ({ ...m, title: f.name.replace(/\.[a-z0-9]+$/i, "") }));
          }}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Название" htmlFor="b-title" className="sm:col-span-2">
            <Input id="b-title" value={meta.title} onChange={set("title")} />
          </Field>
          <Field label="Предмет" htmlFor="b-subj">
            <Select id="b-subj" value={meta.subject} onChange={set("subject")}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Класс" htmlFor="b-grade">
              <Select id="b-grade" value={meta.grade} onChange={set("grade")}>
                <option value="">—</option>
                {Array.from({ length: 11 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Язык" htmlFor="b-lang">
              <Select id="b-lang" value={meta.language} onChange={set("language")}>
                {(Object.keys(LANG) as (keyof typeof LANG)[]).map((k) => (
                  <option key={k} value={k}>
                    {LANG[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Автор / издательство" htmlFor="b-author" className="sm:col-span-2">
            <Input id="b-author" value={meta.author} onChange={set("author")} />
          </Field>
          <Field label="Описание" htmlFor="b-desc" className="sm:col-span-2">
            <Textarea id="b-desc" rows={2} value={meta.description} onChange={set("description")} />
          </Field>
        </div>
      </div>
      <ErrorBox message={error} />
      <Button onClick={send} disabled={!file || busy} className="self-start">
        <FileUp /> {busy ? "Загружаю и читаю страницы…" : "Добавить в библиотеку"}
      </Button>
    </Card>
  );
}

function RequestBook() {
  const [form, setForm] = useState({ title: "", subject: "", grade: "", comment: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle className="flex items-center gap-2">
        <Send className="size-5 text-primary" /> Не нашёл учебник?
      </CardTitle>
      {sent ? (
        <p className="text-sm text-success">Запрос отправлен учителям. Спасибо!</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_100px]">
            <Input aria-label="Название учебника" placeholder="Название учебника" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input aria-label="Предмет" placeholder="Предмет" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <Input aria-label="Класс" placeholder="Класс" type="number" min={1} max={11} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          </div>
          <Textarea aria-label="Комментарий" rows={2} placeholder="Автор, год издания, зачем нужен" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          <ErrorBox message={error} />
          <Button
            variant="outline"
            className="self-start"
            onClick={() =>
              api("/library/requests", { body: form })
                .then(() => setSent(true))
                .catch((e: Error) => setError(e.message))
            }
          >
            <Send /> Попросить добавить
          </Button>
        </>
      )}
    </Card>
  );
}

function Requests() {
  const { data } = useApi<{ id: string; title: string; subject: string; grade: number | null; comment: string; created_at: number; first_name: string; last_name: string }[]>("/library/requests");
  if (!data?.length) return null;
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle className="flex items-center gap-2">
        <Inbox className="size-5 text-primary" /> Запросы учеников
      </CardTitle>
      <ul className="flex flex-col divide-y divide-border">
        {data.map((r) => (
          <li key={r.id} className="py-2.5 text-sm">
            <span className="font-medium">{r.title}</span>
            <span className="text-muted-foreground">
              {" "}
              · {[r.subject, r.grade && `${r.grade} класс`].filter(Boolean).join(", ")} · {r.first_name} {r.last_name} · {fmtDate(r.created_at)}
            </span>
            {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
