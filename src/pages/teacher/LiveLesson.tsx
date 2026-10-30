import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Lock, X } from "lucide-react";
import type { LockEvent, Work } from "@shared/types";
import { LESSONS } from "@shared/content";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, Loading, PageHeader, Stat } from "@/components/Page";
import { Badge, Segmented } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { Toggle } from "./ClassPage";

interface Live {
  classRoom: { code: string; name: string; unlockCode: string; activeLessonId: string | null; locked: boolean; aiEnabled: boolean };
  rows: { id: string; name: string; online: boolean; away: boolean; inLesson: boolean; leftCount: number; promptCount: number; lastPrompt: string | null; submitted: boolean; score: number | null; teacherGrade: number | null }[];
}

const EVENT: Record<LockEvent["type"], string> = { left: "Вышел из урока", returned: "Вернулся", unlocked: "Вышел по коду учителя" };

export default function LiveLesson() {
  const { code = "" } = useParams();
  const { data, error, loading, reload } = useApi<Live>(`/teacher/classes/${code}/live`, 2000);
  const [open, setOpen] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const c = data.classRoom;
  const online = data.rows.filter((r) => r.online).length;
  const away = data.rows.filter((r) => r.online && r.away).length;

  async function update(patch: Record<string, unknown>) {
    await api(`/teacher/classes/${c.code}/settings`, { body: patch }).catch(() => undefined);
    reload();
  }

  return (
    <div className="flex flex-col gap-5">
      <Link to={`/teacher/classes/${c.code}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {c.name}
      </Link>
      <PageHeader eyebrow="Живой урок" title={c.activeLessonId ? LESSONS.find((l) => l.id === c.activeLessonId)?.title ?? "Урок" : "Урок не начат"} description={`Код выхода из урока для учеников: ${c.unlockCode}`} />
      <div className="flex flex-wrap items-end gap-3">
        <Select aria-label="Открытый урок" className="h-10 w-auto min-w-[260px]" value={c.activeLessonId ?? ""} onChange={(e) => update({ activeLessonId: e.target.value || null })}>
          <option value="">Урок не начат</option>
          {LESSONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.grade} кл. · {l.title}
            </option>
          ))}
        </Select>
        <Toggle on={c.locked} disabled={!c.activeLessonId} onClick={() => update({ locked: !c.locked })} label={c.locked ? "Закрытый режим включён" : "Включить закрытый режим"} icon={<Lock className="size-4" />} />
        <Toggle on={c.aiEnabled} onClick={() => update({ aiEnabled: !c.aiEnabled })} label={c.aiEnabled ? "ИИ включён" : "ИИ выключен"} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="В сети" value={`${online}/${data.rows.length}`} />
        <Stat label="Сейчас вне урока" value={<span className={cn(away && "text-destructive")}>{away}</span>} />
        <Stat label="Запросов к ИИ" value={data.rows.reduce((s, r) => s + r.promptCount, 0)} />
        <Stat label="Сдали работу" value={data.rows.filter((r) => r.submitted).length} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-secondary text-left text-xs text-secondary-foreground">
            <tr>
              {["Ученик", "Статус", "Выходы", "Запросы", "Последний запрос к ИИ", "Работа"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} onClick={() => setOpen(r.id)} className={cn("cursor-pointer border-t border-border hover:bg-muted/50", r.online && r.away && "shadow-[inset_4px_0_0_var(--destructive)]")}>
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3">
                  {!r.online ? <Badge>не в сети</Badge> : r.away ? <Badge tone="bad">вне урока</Badge> : r.inLesson ? <Badge tone="ok">в уроке</Badge> : <Badge tone="warn">на главной</Badge>}
                </td>
                <td className="px-4 py-3">{r.leftCount ? <Badge tone="bad">{r.leftCount}</Badge> : "0"}</td>
                <td className="px-4 py-3 tabular">{r.promptCount}</td>
                <td className="max-w-[280px] truncate px-4 py-3 text-muted-foreground" title={r.lastPrompt ?? ""}>
                  {r.lastPrompt ?? "—"}
                </td>
                <td className="px-4 py-3">{r.teacherGrade ? <Badge tone="ok">Оценка {r.teacherGrade}</Badge> : r.submitted ? <Badge tone="brand">Сдано · {r.score}%</Badge> : <span className="text-muted-foreground">в работе</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && c.activeLessonId && <Drawer studentId={open} lessonId={c.activeLessonId} onClose={() => setOpen(null)} onGraded={reload} />}
    </div>
  );
}

function Drawer({ studentId, lessonId, onClose, onGraded }: { studentId: string; lessonId: string; onClose: () => void; onGraded: () => void }) {
  const [data, setData] = useState<{ name: string; work: Work; events: LockEvent[] } | null>(null);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ name: string; work: Work; events: LockEvent[] }>(`/teacher/students/${studentId}/work/${lessonId}`)
        .then((d) => {
          if (!alive) return;
          setData(d);
          setComment((c) => c || d.work.teacherComment);
        })
        .catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [studentId, lessonId]);

  async function grade(g: number) {
    try {
      const work = await api<Work>(`/teacher/students/${studentId}/grade/${lessonId}`, { body: { grade: g, comment } });
      setData((d) => (d ? { ...d, work } : d));
      onGraded();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/35" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(760px,100%)] flex-col bg-card shadow-2xl" aria-label="Работа ученика">
        <div className="flex items-center justify-between gap-3 bg-secondary px-5 py-4 text-secondary-foreground">
          <h2 className="font-display text-lg font-semibold">{data?.name ?? "Ученик"}</h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-white/10">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-5 overflow-y-auto p-5">
          <ErrorBox message={error} />
          {data && (
            <>
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: "preview", label: "Приложение" },
                  { value: "code", label: "Код" },
                ]}
              />
              {tab === "preview" ? (
                <iframe title="Приложение ученика" sandbox="allow-scripts" srcDoc={data.work.code} className="h-[340px] w-full rounded-2xl border border-border bg-white" />
              ) : (
                <textarea readOnly aria-label="Код ученика" value={data.work.code} className="h-[260px] w-full resize-none rounded-2xl bg-[#141212] p-4 font-mono text-xs text-[#f3eeee]" />
              )}
              <section>
                <p className="eyebrow">Журнал запросов к ИИ · {data.work.prompts.length}</p>
                {data.work.prompts.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Ученик ещё не обращался к ИИ.</p>
                ) : (
                  <ol className="mt-2 flex flex-col gap-2">
                    {data.work.prompts.map((p) => (
                      <li key={p.at} className="rounded-xl bg-muted px-3 py-2 text-sm">
                        <span className="block text-[11px] text-muted-foreground">{fmtTime(p.at)}</span>
                        {p.text}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section>
                <p className="eyebrow">Закрытый режим</p>
                {data.events.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Выходов не было.</p>
                ) : (
                  <ol className="mt-2 flex flex-col gap-1.5">
                    {data.events.map((e) => (
                      <li key={e.at + e.type} className="flex justify-between rounded-xl bg-muted px-3 py-2 text-sm">
                        {EVENT[e.type]} <span className="text-muted-foreground">{fmtTime(e.at)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              {data.work.review && (
                <section className="rounded-2xl bg-muted p-4 text-sm">
                  <p className="eyebrow">ИИ-ревью · ориентировочно {data.work.review.score}%</p>
                  <p className="mt-1">
                    <b>Получилось:</b> {data.work.review.strengths.join("; ")}
                  </p>
                  <p className="mt-1">
                    <b>Улучшить:</b> {data.work.review.fixes.join("; ")}
                  </p>
                </section>
              )}
              <section className="flex flex-col gap-3">
                <p className="eyebrow">Итоговая оценка учителя</p>
                <Textarea id="teacher-comment" rows={2} placeholder="Комментарий для ученика" value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map((g) => (
                    <button key={g} type="button" aria-pressed={data.work.teacherGrade === g} onClick={() => grade(g)} className={cn("size-11 rounded-xl border font-display text-lg font-bold", data.work.teacherGrade === g ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                      {g}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
