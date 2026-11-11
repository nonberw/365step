import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calculator, ExternalLink, Library, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";
import type { SatLesson } from "@shared/satLessons";
import { DOMAIN_EN } from "@shared/types";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { ART } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { ErrorBox, GreetingBanner, Loading, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Progress, Segmented } from "@/components/ui/card";
import { BANK_CONTEXT_KEY, LIST_KEY } from "@/lib/satBank";
import { CalculatorWorkspace, useSatTools } from "./SatTools";

type Row = SatLesson & { questions: number; right: number; total: number };

export default function Learn() {
  const [section, setSection] = useState<"math" | "rw">("math");
  const { data, error, loading } = useApi<Row[]>("/sat/lessons");
  const rows = (data ?? []).filter((l) => l.section === section);
  const domains = [...new Set(rows.map((r) => r.domain))];

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner title={"Learn SAT by skill"} subtitle={"Learn Math and Reading & Writing separately, with concise explanations, common traps, worked examples and question-bank practice."} image={ART.astronomer} position="center 25%" />
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
            <h2 className="font-display text-xl font-semibold">{DOMAIN_EN[d]}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows
                .filter((r) => r.domain === d)
                .map((l) => {
                  const pct = l.total ? Math.round((l.right / l.total) * 100) : null;
                  return (
                    <Link key={l.id} to={`/sat/learn/${l.id}`} className="group flex flex-col gap-2 rounded-2xl border border-border p-4 hover:border-primary">
                      <span className="font-display font-semibold">{l.skill}</span>
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        <RichText text={l.idea} math={l.section === "math"} className="[&>p]:inline" />
                      </span>
                      <Progress value={pct ?? 0} tone={pct !== null && pct < 60 ? "brand" : "ok"} className="mt-1" />
                      <span className="flex items-center justify-between text-xs text-muted-foreground">
                        {pct === null ? "Not attempted yet" : `${pct}% correct · ${l.total} answers`} · {l.questions} questions
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
    { href: "https://bluebook.collegeboard.org/students/download-bluebook", t: "Bluebook", d: "College Board's official app with free full-length practice tests." },
    { href: "https://satsuitequestionbank.collegeboard.org/", t: "SAT Suite Question Bank", d: "College Board's official question bank, searchable by skill." },
    { href: "https://www.khanacademy.org/test-prep/digital-sat", t: "Khan Academy", d: "Official free preparation for Digital SAT in partnership with College Board." },
  ];
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Official free materials</CardTitle>
      <p className="text-sm text-muted-foreground">College Board questions are copyrighted, so we link to the official resources. Use 365step to practise weaker skills and review mistakes.</p>
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
  if (!l) return <ErrorBox message={error || "Skill not found"} />;

  async function practice() {
    const r = await api<{ items: { id: string }[] }>(`/sat/bank?skills=${encodeURIComponent(l!.bankSkills.join("|"))}&status=all`);
    open(r.items.map((i) => i.id));
  }

  function open(ids: string[]) {
    if (!ids.length) return setMsg("There are no questions for this skill yet. Generate a new practice set with AI.");
    try {
      sessionStorage.setItem(LIST_KEY, JSON.stringify(ids));
      sessionStorage.removeItem(BANK_CONTEXT_KEY);
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
    <div className={cn("flex flex-col gap-5", !tools.desmosOpen && "max-w-4xl")}>
      {l.section === "math" && tools.panels}
      <Link to="/sat/learn" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All skills
      </Link>
      <PageHeader
        eyebrow={`${l.section === "math" ? "Math" : "Reading & Writing"} · ${DOMAIN_EN[l.domain]}`}
        title={l.skill}
        description={pct === null ? `${l.questions} in the bank` : `Your accuracy: ${pct}% · ${l.total} replies · ${l.questions} in the bank`}
        action={l.section === "math" ? <div className="flex gap-1">{tools.buttons}</div> : undefined}
      />
      <CalculatorWorkspace open={l.section === "math" && tools.desmosOpen} onClose={tools.closeDesmos} className="space-y-5">
        <Card className="bg-secondary text-secondary-foreground">
          <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            <Lightbulb className="size-4" /> Key idea
          </p>
          <RichText text={l.idea} math={l.section === "math"} className="mt-2 text-lg" />
        </Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>How to solve it</CardTitle>
            <ol className="mt-3 flex flex-col gap-2.5">
              {l.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <RichText text={s} math={l.section === "math"} />
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-warning" /> Common traps
            </CardTitle>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {l.traps.map((t) => (
                <li key={t} className="rounded-xl bg-[#fdeede] px-3 py-2 dark:bg-warning/15">
                  <RichText text={t} math={l.section === "math"} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card>
          <CardTitle>Example</CardTitle>
          <RichText text={l.example.q} math={l.section === "math"} className="mt-2 font-medium" />
          <RichText text={`→ ${l.example.a}`} math={l.section === "math"} className="mt-2 text-sm text-muted-foreground" />
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={practice}>
            <Library /> Practice: {l.questions} questions
          </Button>
          <Button size="lg" variant="outline" onClick={generate} disabled={busy}>
            <Sparkles /> {busy ? "Generating questions… (up to a minute)" : "Generate 5 new questions"}
          </Button>
          {l.section === "math" && (
            <Badge tone="soft" className="self-center">
              <Calculator className="size-3" /> Use Desmos and the reference sheet above
            </Badge>
          )}
        </div>
        <p className={cn("text-sm", msg ? "text-destructive" : "hidden")}>{msg}</p>
      </CalculatorWorkspace>
    </div>
  );
}
