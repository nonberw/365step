import { useEffect, useRef, useState, type FormEvent } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html as htmlLang } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";
import { History, Link2, Monitor, Smartphone, Tablet, TerminalSquare, Wand2 } from "lucide-react";
import { withConsole, type ConsoleLine } from "@/lib/appConsole";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Lock, Send } from "lucide-react";
import type { Lesson, Work } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useLockMode } from "@/hooks/useLockMode";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/AppShell";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Segmented } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

const SUGGESTIONS = ["Добавь заголовок и кнопку «Старт»", "Сделай цвета как у школы: чёрный и бордовый", "Объясни, как работает этот код"];

import { releasedKey } from "@/lib/lesson";

type ClassInfo = { activeLessonId: string | null; locked: boolean; aiEnabled: boolean };

export default function LessonPage() {
  const { id = "" } = useParams();
  const { data, error, loading } = useApi<{ lessons: (Lesson & { submitted: boolean })[]; classRoom: ClassInfo | null }>("/coding/lessons");
  if (loading) return <Loading />;
  if (!data)
    return (
      <div className="p-6">
        <ErrorBox message={error} />
      </div>
    );
  const lesson = data.lessons.find((l) => l.id === id);
  if (!lesson)
    return (
      <div className="p-6">
        <ErrorBox message="Урок не найден" />
      </div>
    );
  return <Workspace lesson={lesson} initialClass={data.classRoom} />;
}

function Workspace({ lesson, initialClass }: { lesson: Lesson; initialClass: ClassInfo | null }) {
  const navigate = useNavigate();
  const [cls, setCls] = useState<ClassInfo | null>(initialClass);
  const released = (() => {
    try {
      return sessionStorage.getItem(releasedKey(lesson.id)) === "1";
    } catch {
      return false;
    }
  })();
  const locked = !!cls?.locked && cls.activeLessonId === lesson.id && !released;
  const lock = useLockMode(locked);
  const [work, setWork] = useState<Work | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<"" | "vibe" | "submit">("");
  const [error, setError] = useState("");
  const [view, setView] = useState<"preview" | "code" | "console">("preview");
  const [device, setDevice] = useState<"full" | "tablet" | "phone">("full");
  const [logs, setLogs] = useState<ConsoleLine[]>([]);
  const [versions, setVersions] = useState<{ id: number; note: string; at: number }[] | null>(null);
  const [shared, setShared] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockCode, setUnlockCode] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    api<Work>(`/coding/lessons/${lesson.id}/work`)
      .then(setWork)
      .catch((e) => setError(e.message));
  }, [lesson.id]);

  // Presence for the teacher's live panel; also picks up lock / AI changes.
  useEffect(() => {
    const beat = () =>
      api<ClassInfo>("/coding/presence", { body: { lessonId: lesson.id, away: document.hidden } })
        .then(setCls)
        .catch(() => {});
    beat();
    const t = setInterval(beat, 5000);
    return () => clearInterval(t);
  }, [lesson.id]);

  // console.log and errors from the app arrive by postMessage from the sandbox.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data as { bsts?: string } & ConsoleLine;
      if (d?.bsts === "console") setLogs((l) => [...l.slice(-199), { level: d.level, text: d.text, at: d.at }]);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  useEffect(() => setLogs([]), [work?.code]);

  async function openVersions() {
    if (versions) return setVersions(null);
    try {
      setVersions(await api<{ id: number; note: string; at: number }[]>(`/coding/lessons/${lesson.id}/versions`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function restore(v: number) {
    try {
      setWork(await api<Work>(`/coding/lessons/${lesson.id}/restore`, { body: { version: v } }));
      setVersions(null);
      setView("preview");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function share() {
    try {
      const r = await api<{ token: string }>(`/coding/lessons/${lesson.id}/share`, { body: {} });
      const url = `${location.origin}/share/${r.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setShared(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const errors = logs.filter((l) => l.level === "error");

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "end" });
  }, [work?.prompts.length, busy]);

  const submitted = !!work?.submittedAt;
  const aiOff = cls ? !cls.aiEnabled : false;

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy("vibe");
    setError("");
    try {
      const r = await api<{ work: Work }>(`/coding/lessons/${lesson.id}/vibe`, { body: { prompt: text } });
      setWork(r.work);
      setPrompt("");
      setView("preview");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  function editCode(code: string) {
    if (!work) return;
    setWork({ ...work, code });
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api(`/coding/lessons/${lesson.id}/work`, { method: "PUT", body: { code } }).catch((e) => setError(e.message));
    }, 600);
  }

  async function submit() {
    setBusy("submit");
    setError("");
    try {
      setWork(await api<Work>(`/coding/lessons/${lesson.id}/submit`, { body: {} }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function tryUnlock(e: FormEvent) {
    e.preventDefault();
    setUnlockError("");
    try {
      await api("/coding/unlock", { body: { code: unlockCode } });
      try {
        sessionStorage.setItem(releasedKey(lesson.id), "1");
      } catch {
        // the server already logged the unlock
      }
      await lock.release();
      navigate("/coding/lessons");
    } catch (err) {
      setUnlockError((err as Error).message);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-secondary px-4 py-3 text-secondary-foreground" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <div className="flex min-w-0 items-center gap-3">
          <Logo className="text-white" />
          <span className="truncate text-sm text-white/70">
            {lesson.grade} кл. · {lesson.title}
          </span>
          {locked && (
            <span className="flex items-center gap-1 text-xs font-semibold text-accent">
              <Lock className="size-3.5" /> Закрытый режим
            </span>
          )}
        </div>
        {locked ? (
          <Button variant="outline" size="sm" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={() => setUnlockOpen(true)}>
            Выйти по коду учителя
          </Button>
        ) : (
          <Link to="/coding/lessons" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
            <ArrowLeft className="size-4" /> К урокам
          </Link>
        )}
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[400px_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-border bg-card lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-2 border-b border-border p-4">
            <p className="eyebrow">{lesson.objective}</p>
            <h1 className="font-display text-lg font-semibold leading-snug">{lesson.task}</h1>
            {lesson.steps && (
              <details className="text-sm" open={!work?.prompts.length}>
                <summary className="cursor-pointer font-medium text-primary">План по шагам ({lesson.steps.length})</summary>
                <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
                  {lesson.steps.map((st) => (
                    <li key={st}>{st}</li>
                  ))}
                </ol>
              </details>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Как будут оценивать</summary>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {lesson.rubric.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </details>
          </div>
          <div className="flex max-h-[40vh] min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 lg:max-h-none" aria-live="polite">
            {work?.prompts.length === 0 && (
              <div className="max-w-[92%] self-start rounded-2xl bg-muted px-3.5 py-2.5 text-sm">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-primary">ИИ-помощник</span>
                Опиши первый шаг словами. Лучше маленькими шагами: сначала каркас, потом логика, потом красота.
              </div>
            )}
            {work?.prompts.map((p) => (
              <div key={p.at} className="contents">
                <div className="max-w-[92%] self-end rounded-2xl bg-secondary px-3.5 py-2.5 text-sm text-secondary-foreground">{p.text}</div>
                <div className="max-w-[92%] self-start whitespace-pre-wrap rounded-2xl bg-muted px-3.5 py-2.5 text-sm">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-primary">Сгенерировано ИИ{p.mode === "demo" ? " · демо" : ""}</span>
                  {p.reply}
                </div>
              </div>
            ))}
            {busy === "vibe" && <div className="self-start rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">Собираю код…</div>}
            <div ref={chatEnd} />
          </div>
          <form onSubmit={send} className="flex flex-col gap-2 border-t border-border p-3">
            {aiOff ? (
              <p className="rounded-xl bg-muted px-3 py-2 text-sm">Учитель выключил ИИ-помощника. Пиши код сам во вкладке «Код».</p>
            ) : (
              <>
                {work?.prompts.length === 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => setPrompt(s)} className="rounded-full bg-muted px-3 py-1 text-xs hover:bg-muted/70">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <Textarea
                  id="prompt"
                  aria-label="Запрос к ИИ"
                  rows={3}
                  disabled={submitted}
                  placeholder={submitted ? "Работа сдана" : "Что сделать дальше? Например: «добавь таймер на 20 секунд»"}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Запросы видит учитель</span>
                  <Button size="sm" disabled={!prompt.trim() || !!busy || submitted}>
                    <Send /> {busy === "vibe" ? "Думаю…" : "Отправить"}
                  </Button>
                </div>
              </>
            )}
            <ErrorBox message={error} />
          </form>
        </aside>

        <section className="flex min-h-[60vh] min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "preview", label: "Приложение" },
                { value: "code", label: "Код" },
                {
                  value: "console",
                  label: (
                    <span className="flex items-center gap-1">
                      <TerminalSquare className="size-3.5" /> Консоль{errors.length ? <span className="rounded-full bg-destructive px-1.5 text-[10px] text-white">{errors.length}</span> : null}
                    </span>
                  ),
                },
              ]}
            />
            {view === "preview" && (
              <div className="flex rounded-full border border-border p-0.5">
                {(
                  [
                    ["full", Monitor, "Компьютер"],
                    ["tablet", Tablet, "Планшет"],
                    ["phone", Smartphone, "Телефон"],
                  ] as const
                ).map(([d, Icon, label]) => (
                  <button
                    key={d}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => setDevice(d)}
                    className={cn("grid size-7 place-items-center rounded-full", device === d ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted")}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
            )}
            <div className="relative ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={openVersions} disabled={!work}>
                <History /> Версии
              </Button>
              <Button size="sm" variant="outline" onClick={share} disabled={!work}>
                <Link2 /> Поделиться
              </Button>
              {versions && (
                <div className="absolute right-0 top-10 z-20 flex max-h-80 w-80 flex-col gap-1 overflow-auto rounded-2xl border border-border bg-card p-2 shadow-xl">
                  {!versions.length && <p className="p-2 text-sm text-muted-foreground">Версий пока нет — они появляются после запросов к ИИ и правок кода.</p>}
                  {versions.map((v, i) => (
                    <button key={v.id} type="button" disabled={submitted || i === 0} onClick={() => restore(v.id)} className="flex flex-col rounded-xl px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-60">
                      <span className="line-clamp-1">{v.note}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {i === 0 ? " · текущая" : " · вернуть"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button size="sm" onClick={submit} disabled={!work || submitted || !!busy}>
              {busy === "submit" ? "Проверяю…" : submitted ? "Сдано" : "Сдать работу"}
            </Button>
          </div>
          {work &&
            (view === "preview" ? (
              <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-muted/40 p-3">
                <iframe
                  title="Твоё приложение"
                  sandbox="allow-scripts allow-modals"
                  srcDoc={withConsole(work.code)}
                  className={cn("min-h-[420px] rounded-2xl border border-border bg-white shadow-sm transition-all", device === "full" ? "w-full" : device === "tablet" ? "w-[768px] max-w-full" : "w-[390px] max-w-full")}
                />
              </div>
            ) : view === "code" ? (
              <div className="m-3 min-h-0 flex-1 overflow-hidden rounded-2xl">
                <CodeMirror value={work.code} onChange={editCode} editable={!submitted} extensions={[htmlLang()]} theme={oneDark} height="100%" style={{ height: "100%" }} aria-label="Код приложения" />
              </div>
            ) : (
              <div className="m-3 flex min-h-0 flex-1 flex-col gap-2 overflow-auto rounded-2xl bg-[#141212] p-4 font-mono text-[12.5px] text-[#f3eeee]">
                {!logs.length && <span className="text-white/40">Здесь появятся console.log и ошибки приложения. Открой вкладку «Приложение» и поработай с ним.</span>}
                {logs.map((l, i) => (
                  <div key={i} className={cn("whitespace-pre-wrap", l.level === "error" ? "text-[#ff8a8a]" : l.level === "warn" ? "text-[#ffd479]" : "")}>
                    {l.level === "error" ? "✖ " : l.level === "warn" ? "⚠ " : "› "}
                    {l.text}
                  </div>
                ))}
                {errors.length > 0 && !submitted && !aiOff && (
                  <Button
                    size="sm"
                    className="mt-2 self-start"
                    disabled={!!busy}
                    onClick={() => {
                      setPrompt(
                        `В приложении ошибки в консоли, найди причину и исправь, ничего больше не меняя:\n${errors
                          .slice(-3)
                          .map((e) => e.text)
                          .join("\n")}`,
                      );
                    }}
                  >
                    <Wand2 /> Попросить ИИ исправить
                  </Button>
                )}
              </div>
            ))}
          {shared && (
            <p className="mx-4 rounded-xl bg-primary/10 px-3 py-2 text-xs">
              Ссылка скопирована:{" "}
              <a className="font-semibold text-primary underline" href={shared} target="_blank" rel="noreferrer">
                {shared}
              </a>{" "}
              — это снимок приложения сейчас; после изменений поделись заново.
            </p>
          )}
          <p className="px-4 pb-2 text-[11px] text-muted-foreground">Код создан с помощью ИИ и проверен учеником. Приложение работает в изолированной песочнице.</p>
          {work?.review && (
            <div className="grid grid-cols-1 gap-4 border-t border-border bg-card p-4 sm:grid-cols-[auto_1fr_1fr]">
              <div>
                <p className="font-display text-4xl font-bold text-primary">{work.review.score}%</p>
                <p className="text-xs text-muted-foreground">ориентировочно, ИИ</p>
                {work.teacherGrade && <Badge tone="ok">Учитель: {work.teacherGrade}</Badge>}
              </div>
              <div className="text-sm">
                <b>Получилось</b>
                <ul className="mt-1 list-disc pl-5">
                  {work.review.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="text-sm">
                <b>Что улучшить</b>
                <ul className="mt-1 list-disc pl-5">
                  {work.review.fixes.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                {work.teacherComment && <p className="mt-2">Учитель: {work.teacherComment}</p>}
              </div>
            </div>
          )}
        </section>
      </div>

      {locked && !lock.started && (
        <Overlay badge="Закрытый режим" title="Учитель начал урок" text="Экран перейдёт в полноэкранный режим. Если свернёшь приложение или откроешь другую вкладку, урок встанет на паузу, а учитель увидит отметку.">
          <Button size="lg" className="w-full" onClick={lock.start}>
            Начать урок
          </Button>
        </Overlay>
      )}
      {locked && lock.started && lock.away && (
        <Overlay badge="Урок на паузе" title="Ты вышел из урока" text="Учитель уже видит отметку о выходе. Вернись, чтобы продолжить работу.">
          <Button size="lg" className="w-full" onClick={lock.comeBack}>
            Вернуться в урок
          </Button>
        </Overlay>
      )}
      {unlockOpen && (
        <Overlay badge="Выход из урока" title="Нужен код учителя" text="Выйти из закрытого режима можно только по коду, который знает учитель.">
          <form onSubmit={tryUnlock} className="flex flex-col gap-3">
            <Input
              id="unlock-code"
              aria-label="Код учителя"
              type="password"
              inputMode="numeric"
              autoFocus
              value={unlockCode}
              onChange={(e) => setUnlockCode(e.target.value)}
              className="border-white/20 bg-black/40 text-white"
            />
            {unlockError && <p className="text-sm text-accent">{unlockError}</p>}
            <div className="flex gap-2">
              <Button className="flex-1">Выйти</Button>
              <Button type="button" variant="outline" className="flex-1 border-white/30 bg-transparent text-white hover:bg-white/10" onClick={() => setUnlockOpen(false)}>
                Остаться
              </Button>
            </div>
          </form>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ badge, title, text, children }: { badge: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-6">
      <div className={cn("w-full max-w-md rounded-3xl bg-secondary p-7 text-white ring-1 ring-white/10")}>
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          <Lock className="size-3.5" /> {badge}
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold">{title}</h2>
        <p className="mb-5 mt-2 text-sm text-white/70">{text}</p>
        {children}
      </div>
    </div>
  );
}
