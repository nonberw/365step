import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calculator, ExternalLink, Library, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";
import type { SatLesson } from "@shared/satLessons";
import { DOMAIN_RU } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { ART } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, GreetingBanner, Loading, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Progress, Segmented } from "@/components/ui/card";
import { LIST_KEY } from "./Bank";
import { useSatTools } from "./SatTools";

type Row = SatLesson & { questions: number; right: number; total: number };

export default function Learn() {
  const [section, setSection] = useState<"math" | "rw">("math");
  const { data, error, loading } = useApi<Row[]>("/sat/lessons");
  const rows = (data ?? []).filter((l) => l.section === section);
  const domains = [...new Set(rows.map((r) => r.domain))];

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner title="Учить SAT по навыкам" subtitle="Математика и английская часть отдельно: короткий разбор навыка, ловушки, пример, практика из банка и новые вопросы от ИИ." image={ART.astronomer} position="center 25%" />
      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { value: "math", label: "Math" },
          { value: "rw", label: "Reading & Writing" },
        ]}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        domains.map((d) => (
          <section key={d} className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold">{DOMAIN_RU[d]}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows
                .filter((r) => r.domain === d)
                .map((l) => {
                  const pct = l.total ? Math.round((l.right / l.total) * 100) : null;
                  return (
                    <Link key={l.id} to={`/sat/learn/${l.id}`} className="group flex flex-col gap-2 rounded-2xl border border-border p-4 hover:border-primary">
                      <span className="font-display font-semibold">{l.skill}</span>
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        <RichText text={l.idea} className="[&>p]:inline" />
                      </span>
                      <Progress value={pct ?? 0} tone={pct !== null && pct < 60 ? "brand" : "ok"} className="mt-1" />
                      <span className="flex items-center justify-between text-xs text-muted-foreground">
                        {pct === null ? "ещё не решал" : `${pct}% верно · ${l.total} ответов`} · {l.questions} вопросов
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </Link>
                  );
                })}
            </div>
          </section>
        ))
      )}
      <OfficialResources />
    </div>
  );
}

export function OfficialResources() {
  const links = [
    { href: "https://bluebook.collegeboard.org/students/download-bluebook", t: "Bluebook", d: "Официальное приложение College Board с бесплатными полными пробными тестами." },
    { href: "https://satsuitequestionbank.collegeboard.org/", t: "SAT Suite Question Bank", d: "Официальный банк заданий College Board с фильтрами по навыкам." },
    { href: "https://www.khanacademy.org/test-prep/digital-sat", t: "Khan Academy", d: "Официальная бесплатная подготовка к Digital SAT в партнёрстве с College Board." },
  ];
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Официальные бесплатные материалы</CardTitle>
      <p className="text-sm text-muted-foreground">Задания College Board защищены авторским правом, поэтому мы не копируем их, а даём прямые ссылки. Решай их там, а в Нурбек Чурбек тренируй слабые навыки и разбирай ошибки с ИИ.</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {links.map((l) => (
          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="flex flex-col gap-1 rounded-xl border border-border p-3 hover:border-primary">
            <span className="flex items-center gap-1.5 font-display font-semibold">
              {l.t} <ExternalLink className="size-3.5" />
            </span>
            <span className="text-xs text-muted-foreground">{l.d}</span>
          </a>
        ))}
      </div>
    </Card>
  );
}

export function SkillPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi<Row[]>("/sat/lessons");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const tools = useSatTools();
  const l = data?.find((x) => x.id === id);
  if (loading) return <Loading />;
  if (!l) return <ErrorBox message={error || "Навык не найден"} />;

  async function practice() {
    const r = await api<{ items: { id: string }[] }>(`/sat/bank?skills=${encodeURIComponent(l!.bankSkills.join("|"))}&status=all`);
    open(r.items.map((i) => i.id));
  }

  function open(ids: string[]) {
    if (!ids.length) return setMsg("Вопросов по навыку пока нет — сгенерируй их с ИИ.");
    try {
      sessionStorage.setItem(LIST_KEY, JSON.stringify(ids));
    } catch {
      // prev/next is a convenience
    }
    navigate(`/sat/q/${ids[0]}`);
  }

  async function generate() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ ids: string[] }>("/sat/generate", { body: { lessonId: l!.id, count: 5 } });
      reload();
      open(r.ids);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pct = l.total ? Math.round((l.right / l.total) * 100) : null;
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      {l.section === "math" && tools.panels}
      <Link to="/sat/learn" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все навыки
      </Link>
      <PageHeader
        eyebrow={`${l.section === "math" ? "Math" : "Reading & Writing"} · ${DOMAIN_RU[l.domain]}`}
        title={l.skill}
        description={pct === null ? `${l.questions} вопросов в банке` : `Твоя точность ${pct}% · ${l.total} ответов · ${l.questions} вопросов в банке`}
        action={l.section === "math" ? <div className="flex gap-1">{tools.buttons}</div> : undefined}
      />
      <Card className="bg-secondary text-secondary-foreground">
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          <Lightbulb className="size-4" /> Главная идея
        </p>
        <RichText text={l.idea} className="mt-2 text-lg" />
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Как решать</CardTitle>
          <ol className="mt-3 flex flex-col gap-2.5">
            {l.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">{i + 1}</span>
                <RichText text={s} />
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-warning" /> Ловушки
          </CardTitle>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {l.traps.map((t) => (
              <li key={t} className="rounded-xl bg-[#fdeede] px-3 py-2 dark:bg-warning/15">
                <RichText text={t} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <CardTitle>Пример</CardTitle>
        <RichText text={l.example.q} className="mt-2 font-medium" />
        <RichText text={`→ ${l.example.a}`} className="mt-2 text-sm text-muted-foreground" />
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={practice}>
          <Library /> Практика: {l.questions} вопросов
        </Button>
        <Button size="lg" variant="outline" onClick={generate} disabled={busy}>
          <Sparkles /> {busy ? "ИИ пишет вопросы… (до минуты)" : "Ещё 5 новых вопросов от ИИ"}
        </Button>
        {l.section === "math" && (
          <Badge tone="soft" className="self-center">
            <Calculator className="size-3" /> Desmos и формулы — кнопки сверху
          </Badge>
        )}
      </div>
      <p className={cn("text-sm", msg ? "text-destructive" : "hidden")}>{msg}</p>
    </div>
  );
}
