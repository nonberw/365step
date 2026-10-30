import { useNavigate, useSearchParams } from "react-router-dom";
import { Bookmark, CheckCircle2, Circle, XCircle } from "lucide-react";
import type { SatDomain, SatQuestionSummary, SatSection } from "@shared/types";
import { DIFFICULTY_RU, DOMAIN_RU, SAT_DOMAINS } from "@shared/types";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { Empty, Badge, Segmented } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBox, Loading, PageHeader } from "@/components/Page";

export const LIST_KEY = "bsts-sat-list";

export default function Bank() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const section = (params.get("section") ?? "") as SatSection | "";
  const domain = (params.get("domain") ?? "") as SatDomain | "";
  const difficulty = params.get("difficulty") ?? "";
  const status = params.get("status") ?? "all";
  const page = Number(params.get("page") ?? 0);
  const skills = params.get("skills") ?? "";
  const query = new URLSearchParams({ ...(section && { section }), ...(domain && { domain }), ...(difficulty && { difficulty }), ...(skills && { skills }), status, page: String(page) });
  const { data, error, loading } = useApi<{ total: number; page: number; items: SatQuestionSummary[] }>(`/sat/bank?${query}`);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next);
  };

  const open = (id: string) => {
    try {
      sessionStorage.setItem(LIST_KEY, JSON.stringify(data?.items.map((i) => i.id) ?? []));
    } catch {
      // prev/next navigation is a convenience
    }
    navigate(`/sat/q/${id}`);
  };

  const domains = section ? SAT_DOMAINS[section] : [...SAT_DOMAINS.rw, ...SAT_DOMAINS.math];

  return (
    <div>
      <PageHeader
        eyebrow="SAT"
        title="Банк вопросов"
        description="Фильтруй по разделу, домену, сложности и статусу. Ошибки сами попадают в повтор."
        action={
          <Button variant="outline" onClick={() => data?.items[0] && open(data.items[0].id)} disabled={!data?.items.length}>
            Начать с первого
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={section || "all"}
            onChange={(v) => update({ section: v === "all" ? "" : v, domain: "" })}
            options={[
              { value: "all", label: "Все" },
              { value: "rw", label: "Reading & Writing" },
              { value: "math", label: "Math" },
            ]}
          />
          <Select aria-label="Домен" className="h-9 w-auto min-w-[220px] text-xs" value={domain} onChange={(e) => update({ domain: e.target.value })}>
            <option value="">Все домены</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_RU[d]}
              </option>
            ))}
          </Select>
          <Select aria-label="Сложность" className="h-9 w-auto text-xs" value={difficulty} onChange={(e) => update({ difficulty: e.target.value })}>
            <option value="">Любая сложность</option>
            {[1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_RU[d as 1 | 2 | 3]}
              </option>
            ))}
          </Select>
        </div>
        <Segmented
          value={status}
          onChange={(v) => update({ status: v })}
          options={[
            { value: "all", label: "Все" },
            { value: "new", label: "Новые" },
            { value: "wrong", label: "Повтор ошибок" },
            { value: "correct", label: "Решённые" },
            { value: "saved", label: "Сохранённые" },
          ]}
        />
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !data?.items.length ? (
        <Empty title={status === "wrong" ? "Ошибок для повтора нет" : "Ничего не найдено"}>{status === "wrong" ? "Отлично! Все прошлые ошибки исправлены." : "Попробуй убрать часть фильтров."}</Empty>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">Найдено: {data.total}</p>
          <ul className="overflow-hidden rounded-2xl border border-border">
            {data.items.map((q) => (
              <li key={q.id} className="border-b border-border last:border-b-0">
                <button type="button" onClick={() => open(q.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60">
                  {q.status === "correct" ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : q.status === "wrong" ? <XCircle className="size-5 shrink-0 text-destructive" /> : <Circle className="size-5 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{q.preview}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{q.section === "rw" ? "R&W" : "Math"}</span>·<span>{DOMAIN_RU[q.domain]}</span>·<span>{q.skill}</span>
                    </span>
                  </span>
                  {q.saved && <Bookmark className="size-4 shrink-0 fill-primary text-primary" />}
                  <Badge tone={q.difficulty === 3 ? "bad" : q.difficulty === 2 ? "warn" : "ok"} className="shrink-0">
                    {DIFFICULTY_RU[q.difficulty]}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
          {data.total > 40 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => update({ page: String(page - 1) })}>
                Назад
              </Button>
              <span className="text-sm tabular text-muted-foreground">
                {page + 1} / {Math.ceil(data.total / 40)}
              </span>
              <Button variant="outline" size="sm" disabled={(page + 1) * 40 >= data.total} onClick={() => update({ page: String(page + 1) })}>
                Дальше
              </Button>
            </div>
          )}
        </>
      )}
      <p className={cn("mt-6 text-xs text-muted-foreground")}>
        Все вопросы — оригинальные задания в формате Digital SAT, написанные для BSTS, и варианты из генераторов. Официальные задания College Board не копируются; бесплатные официальные материалы есть в приложении{" "}
        <a href="https://bluebook.collegeboard.org" target="_blank" rel="noreferrer" className="underline">
          Bluebook
        </a>
        .
      </p>
    </div>
  );
}
