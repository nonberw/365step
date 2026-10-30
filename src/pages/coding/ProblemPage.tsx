import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { ArrowLeft, CheckCircle2, Clock, FlaskConical, Gauge, Lightbulb, MessagesSquare, Play, RotateCcw, Send, Sparkles, XCircle } from "lucide-react";
import type { CodeLang, CodingProblem } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { runTests, warmPython, type RunOutput } from "@/lib/runner";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Segmented } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { DIFF_COLOR } from "./Problems";

interface Detail {
  problem: CodingProblem;
  last: { lang: CodeLang; code: string } | null;
  history: { lang: string; passed: number; total: number; ms: number; at: number }[];
  solved: boolean;
}

const fmtVal = (v: unknown) => {
  const s = JSON.stringify(v);
  return s && s.length > 300 ? `${s.slice(0, 297)}…` : s;
};

interface CodeReview {
  time: string;
  space: string;
  verdict: "optimal" | "good" | "slow";
  summary: string;
  good: string[];
  improve: string[];
  alternative: string;
}
const VERDICT = { optimal: { label: "Оптимально", tone: "ok" }, good: { label: "Хорошо", tone: "brand" }, slow: { label: "Можно быстрее", tone: "warn" } } as const;

export default function ProblemPage() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useApi<Detail>(`/coding/problems/${id}`);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  return <Workspace key={id} detail={data} onSubmitted={reload} />;
}

function Workspace({ detail, onSubmitted }: { detail: Detail; onSubmitted: () => void }) {
  const p = detail.problem;
  const draftKey = `bsts-code-${p.id}`;
  const [lang, setLang] = useState<CodeLang>(detail.last?.lang ?? "python");
  const [codes, setCodes] = useState<Record<CodeLang, string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (saved) return saved;
    } catch {
      // drafts are a convenience
    }
    return { ...p.starter, ...(detail.last ? { [detail.last.lang]: detail.last.code } : {}) };
  });
  const [tab, setTab] = useState<"desc" | "hints" | "history" | "review" | "interview">("desc");
  const [reviewData, setReviewData] = useState<CodeReview | null>(null);
  const [reviewErr, setReviewErr] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [custom, setCustom] = useState("");
  const [customOut, setCustomOut] = useState<string | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [aiHint, setAiHint] = useState("");
  const [out, setOut] = useState<(RunOutput & { kind: "run" | "submit" }) | null>(null);
  const [busy, setBusy] = useState<"" | "run" | "submit" | "hint">("");
  const [verdict, setVerdict] = useState<{ accepted: boolean; xp: number } | null>(null);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    if (lang === "python") warmPython();
  }, [lang]);

  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(codes));
    } catch {
      // drafts are a convenience
    }
  }, [codes, draftKey]);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  async function askReview() {
    setBusy("hint");
    setReviewErr("");
    try {
      setReviewData(await api<CodeReview>(`/coding/problems/${p.id}/review`, { body: {} }));
    } catch (e) {
      setReviewErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function say(text: string) {
    const next = [...chat, { role: "user" as const, text }];
    setChat(next);
    setDraft("");
    setBusy("hint");
    try {
      const r = await api<{ reply: string }>(`/coding/problems/${p.id}/interview`, { body: { lang, code, messages: next, minutes: startedAt ? Math.round((Date.now() - startedAt) / 60000) : 0 } });
      setChat([...next, { role: "assistant", text: r.reply }]);
    } catch (e) {
      setChat([...next, { role: "assistant", text: `⚠ ${(e as Error).message}` }]);
    } finally {
      setBusy("");
    }
  }

  async function runCustom() {
    let args: unknown;
    try {
      args = JSON.parse(`[${custom}]`);
    } catch {
      setCustomOut("Не получилось прочитать аргументы. Пиши через запятую, как в JSON: [1, 2, 3], 4");
      return;
    }
    setBusy("run");
    const r = await runTests(lang, code, p, [{ args: args as unknown[], expected: null }]);
    setBusy("");
    const res = r.results[0];
    setCustomOut(r.error ?? (res?.error ? `Ошибка: ${res.error}` : `Результат: ${fmtVal(res?.got)} · ${res?.ms.toFixed(1)} мс${r.logs.length ? `\n${r.logs.join("\n")}` : ""}`));
  }

  const extensions = useMemo(() => [lang === "python" ? python() : javascript()], [lang]);
  const code = codes[lang];

  async function run(kind: "run" | "submit") {
    setBusy(kind);
    setVerdict(null);
    const tests = kind === "run" ? p.tests.slice(0, p.visible) : p.tests;
    const started = performance.now();
    const r = await runTests(lang, code, p, tests);
    setOut({ ...r, kind });
    if (kind === "submit") {
      const passed = r.results.filter((x) => x.passed).length;
      try {
        setVerdict(await api<{ accepted: boolean; xp: number }>(`/coding/problems/${p.id}/submit`, { body: { lang, code, passed: r.error ? 0 : passed, ms: Math.round(performance.now() - started) } }));
        onSubmitted();
      } catch {
        setVerdict({ accepted: passed === p.tests.length && !r.error, xp: 0 });
      }
    }
    setBusy("");
  }

  async function hint() {
    setBusy("hint");
    const failing = out
      ? (out.error ??
        out.results
          .filter((r) => !r.passed)
          .map((r) => `тест ${r.index + 1}: ожидалось ${fmtVal(r.expected)}, получено ${r.error ?? fmtVal(r.got)}`)
          .join("; "))
      : "";
    try {
      const r = await api<{ hint: string }>(`/coding/problems/${p.id}/hint`, { body: { lang, code, failing } });
      setAiHint(r.hint);
      setTab("hints");
    } catch (e) {
      setAiHint((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const passedCount = out?.results.filter((r) => r.passed).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/coding" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все задачи
      </Link>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold">{p.title}</h1>
            {detail.solved && <Badge tone="ok">Решена</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("font-semibold", DIFF_COLOR[p.difficulty])}>{p.difficulty}</span>
            {p.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "desc", label: "Условие" },
              { value: "hints", label: "Подсказки" },
              { value: "history", label: `Попытки (${detail.history.length})` },
              { value: "review", label: "Разбор ИИ" },
              { value: "interview", label: "Собеседование" },
            ]}
          />
          {tab === "desc" && (
            <div className="flex flex-col gap-4 text-[15px]">
              <RichText text={p.statement.replace(/`([^`]+)`/g, "**$1**")} />
              {p.examples.map((ex, i) => (
                <div key={i} className="rounded-xl bg-muted/60 p-3 font-mono text-[13px]">
                  <p className="mb-1 font-sans text-xs font-semibold text-muted-foreground">Пример {i + 1}</p>
                  <p>
                    <b>Вход:</b> {ex.input}
                  </p>
                  <p>
                    <b>Выход:</b> {ex.output}
                  </p>
                  {ex.explain && <p className="text-muted-foreground">{ex.explain}</p>}
                </div>
              ))}
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Ограничения</p>
                <ul className="list-disc pl-5 text-sm">
                  {p.constraints.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {tab === "hints" && (
            <div className="flex flex-col gap-3 text-sm">
              {p.hints.slice(0, hintsShown).map((h, i) => (
                <p key={i} className="rounded-xl bg-muted/60 p-3">
                  <Lightbulb className="mr-1.5 inline size-4 text-accent" />
                  {h}
                </p>
              ))}
              {hintsShown < p.hints.length && (
                <Button variant="outline" size="sm" className="self-start" onClick={() => setHintsShown(hintsShown + 1)}>
                  Показать подсказку {hintsShown + 1}
                </Button>
              )}
              {aiHint && (
                <div className="rounded-xl border border-primary/40 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="size-3.5" /> Подсказка ИИ по твоему коду
                  </p>
                  <RichText text={aiHint} />
                </div>
              )}
            </div>
          )}
          {tab === "review" && (
            <div className="flex flex-col gap-3 text-sm">
              {!detail.solved && !verdict?.accepted && (
                <p className="text-muted-foreground">Разбор доступен после того, как задача принята. ИИ оценит сложность твоего решения, стиль и расскажет другой подход — как ревьюер в настоящей команде.</p>
              )}
              {(detail.solved || verdict?.accepted) && !reviewData && (
                <Button className="self-start" onClick={askReview} disabled={busy !== ""}>
                  <Gauge /> {busy === "hint" ? "Разбираю…" : "Разобрать моё решение"}
                </Button>
              )}
              {reviewErr && <ErrorBox message={reviewErr} />}
              {reviewData && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={VERDICT[reviewData.verdict].tone}>{VERDICT[reviewData.verdict].label}</Badge>
                    <Badge>Время {reviewData.time}</Badge>
                    <Badge>Память {reviewData.space}</Badge>
                  </div>
                  <RichText text={reviewData.summary} />
                  {reviewData.good.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-success">Что хорошо</p>
                      {reviewData.good.map((g) => (
                        <p key={g}>— {g}</p>
                      ))}
                    </div>
                  )}
                  {reviewData.improve.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-primary">Что улучшить</p>
                      {reviewData.improve.map((g) => (
                        <p key={g}>— {g}</p>
                      ))}
                    </div>
                  )}
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Другой подход</p>
                    <RichText text={reviewData.alternative} />
                  </div>
                </>
              )}
            </div>
          )}
          {tab === "interview" && (
            <div className="flex flex-col gap-3 text-sm">
              {!startedAt ? (
                <>
                  <p className="text-muted-foreground">
                    Тренировка технического собеседования: ИИ-интервьюер попросит рассказать идею, задаст вопросы про сложность и крайние случаи, а в конце поставит оценку по четырём критериям. Решение он не подскажет —
                    как на настоящем интервью. На задачу даётся 30 минут.
                  </p>
                  <Button
                    className="self-start"
                    onClick={() => {
                      setStartedAt(Date.now());
                      setChat([]);
                      void say("Здравствуйте! Я готов начать.");
                    }}
                  >
                    <MessagesSquare /> Начать собеседование
                  </Button>
                </>
              ) : (
                <>
                  <span className={cn("flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold", now - startedAt > 30 * 60000 ? "bg-destructive/15 text-destructive" : "bg-muted")}>
                    <Clock className="size-3.5" /> {Math.floor((now - startedAt) / 60000)}:{String(Math.floor(((now - startedAt) / 1000) % 60)).padStart(2, "0")} из 30:00
                  </span>
                  <div className="flex max-h-[380px] flex-col gap-2 overflow-auto">
                    {chat.slice(1).map((m, i) => (
                      <div key={i} className={cn("max-w-[90%] rounded-2xl px-3 py-2", m.role === "assistant" ? "self-start bg-muted" : "self-end bg-primary text-primary-foreground")}>
                        {m.role === "assistant" ? <RichText text={m.text} /> : m.text}
                      </div>
                    ))}
                    {busy === "hint" && <p className="text-xs text-muted-foreground">Интервьюер думает…</p>}
                  </div>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draft.trim()) void say(draft.trim());
                    }}
                  >
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Расскажи идею или ответь на вопрос…" className="h-10 min-w-0 flex-1 rounded-full border border-border bg-card px-4" />
                    <Button type="submit" disabled={busy !== "" || !draft.trim()}>
                      <Send />
                    </Button>
                  </form>
                  <Button variant="outline" size="sm" className="self-start" disabled={busy !== ""} onClick={() => void say("Я закончил. Дайте, пожалуйста, итоговую оценку.")}>
                    Завершить и получить оценку
                  </Button>
                </>
              )}
            </div>
          )}
          {tab === "history" && (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {detail.history.length === 0 && <li className="py-2 text-muted-foreground">Пока нет отправок</li>}
              {detail.history.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className={h.passed === h.total ? "font-semibold text-success" : "text-destructive"}>{h.passed === h.total ? "Accepted" : `${h.passed}/${h.total} тестов`}</span>
                  <span className="text-muted-foreground">{h.lang}</span>
                  <span className="text-muted-foreground">{fmtDate(h.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Язык" className="h-9 w-auto text-xs" value={lang} onChange={(e) => setLang(e.target.value as CodeLang)}>
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript</option>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setCodes({ ...codes, [lang]: p.starter[lang] })}>
              <RotateCcw /> Сбросить
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={hint} disabled={busy !== ""}>
                <Sparkles /> {busy === "hint" ? "Думаю…" : "Подсказка ИИ"}
              </Button>
              <Button variant="dark" size="sm" onClick={() => run("run")} disabled={busy !== ""}>
                <Play /> {busy === "run" ? "Запускаю…" : "Запустить"}
              </Button>
              <Button size="sm" onClick={() => run("submit")} disabled={busy !== ""}>
                <Send /> {busy === "submit" ? "Проверяю…" : "Отправить"}
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <CodeMirror
              value={code}
              height="420px"
              theme={dark ? oneDark : "light"}
              extensions={extensions}
              onChange={(v) => setCodes((c) => ({ ...c, [lang]: v }))}
              basicSetup={{ tabSize: 4 }}
              aria-label="Редактор кода"
            />
          </div>
          <details className="rounded-2xl border border-border px-4 py-2 text-sm">
            <summary className="flex cursor-pointer items-center gap-2 font-medium">
              <FlaskConical className="size-4 text-primary" /> Свой тест
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Аргументы через запятую в формате JSON, например: {p.tests[0] ? p.tests[0].args.map(fmtVal).join(", ").slice(0, 80) : "[1, 2], 3"}</span>
              <div className="flex gap-2">
                <input value={custom} onChange={(e) => setCustom(e.target.value)} className="h-9 min-w-0 flex-1 rounded-full border border-border bg-card px-3 font-mono text-xs" placeholder={p.params.join(", ")} />
                <Button size="sm" variant="outline" onClick={runCustom} disabled={busy !== "" || !custom.trim()}>
                  <Play /> Выполнить
                </Button>
              </div>
              {customOut && <pre className="whitespace-pre-wrap rounded-xl bg-muted p-3 font-mono text-xs">{customOut}</pre>}
            </div>
          </details>
          {lang === "python" && busy !== "" && !out && <p className="text-xs text-muted-foreground">Первый запуск Python загружает интерпретатор в браузер, это займёт несколько секунд.</p>}

          {verdict && (
            <div className={cn("flex items-center gap-3 rounded-2xl p-4", verdict.accepted ? "bg-[#e3f3ea] dark:bg-success/15" : "bg-[#fde3e4] dark:bg-destructive/15")}>
              {verdict.accepted ? <CheckCircle2 className="size-6 text-success" /> : <XCircle className="size-6 text-destructive" />}
              <div>
                <p className={cn("font-display text-lg font-semibold", verdict.accepted ? "text-success" : "text-destructive")}>{verdict.accepted ? "Accepted" : "Wrong Answer"}</p>
                <p className="text-sm text-muted-foreground">
                  Пройдено {passedCount} из {p.tests.length} тестов{verdict.xp ? ` · +${verdict.xp} XP` : ""}
                </p>
              </div>
            </div>
          )}

          {out && (
            <div className="rounded-2xl border border-border p-4">
              <p className="mb-3 text-sm font-semibold">
                {out.kind === "run" ? "Открытые тесты" : "Все тесты"}: {passedCount}/{out.kind === "run" ? p.visible : p.tests.length}
              </p>
              {out.error && <pre className="mb-3 whitespace-pre-wrap rounded-xl bg-[#fde3e4] p-3 font-mono text-xs text-destructive dark:bg-destructive/15">{out.error}</pre>}
              <div className="flex flex-col gap-2">
                {out.results.map((r) => {
                  const hidden = r.index >= p.visible;
                  return (
                    <div key={r.index} className={cn("rounded-xl border p-3 font-mono text-xs", r.passed ? "border-success/40" : "border-destructive/40")}>
                      <p className={cn("mb-1 font-sans text-xs font-semibold", r.passed ? "text-success" : "text-destructive")}>
                        Тест {r.index + 1} {hidden && "(скрытый)"} · {r.passed ? "пройден" : "не пройден"} · {r.ms.toFixed(1)} мс
                      </p>
                      {(!hidden || !r.passed) && (
                        <>
                          {!hidden && <p>Вход: {p.tests[r.index]!.args.map(fmtVal).join(", ")}</p>}
                          <p>Ожидалось: {fmtVal(r.expected)}</p>
                          <p>Получено: {r.error ? <span className="text-destructive">{r.error}</span> : fmtVal(r.got)}</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {out.logs.length > 0 && (
                <>
                  <p className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">Вывод print / console.log</p>
                  <pre className="max-h-40 overflow-auto rounded-xl bg-muted p-3 font-mono text-xs">{out.logs.join("\n")}</pre>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
