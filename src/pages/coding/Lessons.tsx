import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import type { Lesson, LessonTrack } from "@shared/types";
import { TRACKS } from "@shared/vibeLessons";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { ART } from "@/lib/format";
import { ErrorBox, GreetingBanner, Loading } from "@/components/Page";
import { Badge } from "@/components/ui/card";

type Row = Lesson & { submitted: boolean; score: number | null; teacherGrade: number | null };

export default function Lessons() {
  const { data, error, loading } = useApi<{ lessons: Row[]; classRoom: { activeLessonId: string | null; locked: boolean } | null }>("/coding/lessons");
  const [track, setTrack] = useState<LessonTrack | "">("");
  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner
        title="Уроки вайб-кодинга"
        subtitle="Опиши идею словами — ИИ собирает приложение, а ты проверяешь и улучшаешь его. Шесть направлений: игры, веб, наука, инженерия, продукты и проверка ИИ. У каждого урока — план по шагам."
        image={ART.painting}
        position="center 30%"
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setTrack("")} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", !track ? "bg-secondary text-secondary-foreground" : "bg-muted hover:bg-muted/70")}>
              Все ({data!.lessons.length})
            </button>
            {TRACKS.map((t) => {
              const n = data!.lessons.filter((l) => l.track === t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.blurb}
                  onClick={() => setTrack(t.id)}
                  className={cn("rounded-full px-4 py-1.5 text-sm font-medium", track === t.id ? "bg-secondary text-secondary-foreground" : "bg-muted hover:bg-muted/70")}
                >
                  {t.title} · {n.filter((l) => l.submitted).length}/{n.length}
                </button>
              );
            })}
          </div>
          <ol className="flex flex-col gap-3">
            {data!.lessons
              .filter((l) => !track || l.track === track)
              .map((l) => {
                const live = data!.classRoom?.activeLessonId === l.id;
                return (
                  <li key={l.id}>
                    <Link to={`/coding/lessons/${l.id}`} className="group flex items-center gap-4 rounded-2xl border border-border p-4 hover:border-primary">
                      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary text-center font-display text-xs font-bold leading-tight text-secondary-foreground">
                        {l.grade}
                        <br />
                        кл.
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-lg font-semibold">{l.title}</span>
                          {live && <Badge tone="brand">{data!.classRoom?.locked && <Lock className="size-3" />} Урок идёт</Badge>}
                        </span>
                        <span className="block text-sm text-muted-foreground">{l.objective}</span>
                      </span>
                      {l.teacherGrade ? <Badge tone="ok">Оценка {l.teacherGrade}</Badge> : l.submitted ? <Badge>Сдано · {l.score}%</Badge> : <Badge tone="dark">+{l.xp} XP</Badge>}
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </Link>
                  </li>
                );
              })}
          </ol>
        </>
      )}
    </div>
  );
}
