import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, CircleHelp, X } from "lucide-react";
import { NU, type NuCategory, type NuCheck, type NuProfile } from "@shared/admissions";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { ErrorBox, Loading } from "@/components/Page";
import { Card, Segmented } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Nazarbayev University: which admission category, how far the student's scores are from the thresholds,
// and the NUET course on the learning path.

interface NuView {
  profile: NuProfile;
  checks: NuCheck[];
  saved: boolean;
}

const CATEGORIES: { value: NuCategory; label: string }[] = [
  { value: "nuet", label: "🎯 NUET" },
  { value: "sat", label: "📐 SAT" },
  { value: "olympiad", label: "🥇 Олимпиада" },
];

const field = (v: number | undefined) => (v === undefined ? "" : String(v));
const parse = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));

function Score({ label, value, onChange, step, max }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; step: number; max: number }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
      {label}
      <Input type="number" inputMode="decimal" min={0} max={max} step={step} value={field(value)} onChange={(e) => onChange(parse(e.target.value))} />
    </label>
  );
}

export default function Nu() {
  const { data, error, loading, setData } = useApi<NuView>("/admissions/nu");
  const [p, setP] = useState<NuProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (data && !p) setP(data.profile);
  }, [data, p]);

  async function save() {
    if (!p) return;
    setBusy(true);
    setErr("");
    try {
      const saved = await api<NuView>("/admissions/nu", { method: "PUT", body: p });
      setData(saved);
      setP(saved.profile);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!data || !p) return <ErrorBox message={error} />;
  const set = (change: Partial<NuProfile>) => setP({ ...p, ...change });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <div>
            <p className="font-display text-lg font-bold">Через какую категорию поступаешь?</p>
            <p className="text-sm text-muted-foreground">Есть ещё NIS Grade 12, IB (от 30 баллов) и A-level (от ABB) — для них смотри правила приёма на сайте NU.</p>
          </div>
          <Segmented value={p.category} onChange={(v) => set({ category: v })} options={CATEGORIES} className="self-start" />
          {p.category === "nuet" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Score label="NUET Mathematics (0–120)" value={p.nuetMath} onChange={(v) => set({ nuetMath: v })} step={1} max={120} />
              <Score label="NUET Critical Thinking (0–120)" value={p.nuetCtps} onChange={(v) => set({ nuetCtps: v })} step={1} max={120} />
            </div>
          )}
          {p.category === "sat" && <Score label="SAT (лучшая попытка)" value={p.sat} onChange={(v) => set({ sat: v })} step={10} max={1600} />}
          {p.category === "olympiad" && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              Олимпиада и место
              <Input value={p.olympiad ?? ""} onChange={(e) => set({ olympiad: e.target.value || undefined })} placeholder="например: республиканская по физике, серебро, 2026" />
            </label>
          )}
          {p.category !== "olympiad" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Score label="IELTS общий" value={p.ieltsOverall} onChange={(v) => set({ ieltsOverall: v })} step={0.5} max={9} />
                <Score label="Writing" value={p.ieltsWriting} onChange={(v) => set({ ieltsWriting: v })} step={0.5} max={9} />
                <Score label="Самый низкий из L / R / S" value={p.ieltsOther} onChange={(v) => set({ ieltsOther: v })} step={0.5} max={9} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!p.ieltsOnline} onChange={(e) => set({ ieltsOnline: e.target.checked })} className="size-4 accent-[var(--primary)]" />
                сдавал IELTS Online или IELTS Indicator
              </label>
            </>
          )}
          <ErrorBox message={err} />
          <Button onClick={save} disabled={busy} className="self-start">
            {busy ? "Сохраняю…" : "Проверить и сохранить"}
          </Button>
        </Card>

        <Card className="flex flex-col gap-2">
          <p className="font-display text-lg font-bold">Проходишь ли пороги</p>
          {data.checks.map((c) => (
            <div key={c.label} className={cn("flex items-start gap-3 rounded-2xl px-3 py-2.5", c.ok === true ? "bg-success/10" : c.ok === false ? "bg-destructive/10" : "bg-muted")}>
              <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white", c.ok === true ? "bg-success" : c.ok === false ? "bg-destructive" : "bg-muted-foreground/60")}>
                {c.ok === true ? <Check className="size-4" /> : c.ok === false ? <X className="size-4" /> : <CircleHelp className="size-4" />}
              </span>
              <div className="text-sm">
                <p className="font-semibold">{c.label}</p>
                <p className="text-muted-foreground">{c.detail}</p>
              </div>
            </div>
          ))}
          {!data.saved && <p className="text-xs text-muted-foreground">Пока взял баллы из анкеты при регистрации. Поправь их и сохрани.</p>}
        </Card>
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        <Card className="flex flex-col gap-3">
          <p className="font-display text-lg font-bold">Готовься к NUET на пути 🎯</p>
          <p className="text-sm text-muted-foreground">Два раздела, как на экзамене: Mathematics и Critical Thinking & Problem Solving, по 30 вопросов за 60 минут. Вопросы на английском, разборы на русском. Каждый урок растит твоё растение.</p>
          <Link to="/learn?course=nuet" className={buttonVariants({ size: "sm" })}>
            Открыть курс NUET
          </Link>
        </Card>
        <Card className="text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 font-display text-sm font-bold text-foreground">Пороги NU</p>
          NUET: по правилам от {NU.nuetTotal} в сумме и от {NU.nuetEach} по каждому предмету; в 2025 году, по сообщениям, было {NU.nuetTotalReported} и {NU.nuetEachReported}. SAT от {NU.sat}, без суперскоринга. IELTS {NU.ielts.toFixed(1)}, Writing {NU.ieltsWriting.toFixed(1)}, остальные от {NU.ieltsOther}. Приём обычно открывается в конце сентября, окно для NUET — до ~20 ноября.
          <a href="https://admissions.nu.edu.kz" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 font-semibold text-primary">
            admissions.nu.edu.kz <ArrowUpRight className="size-3" />
          </a>
        </Card>
      </aside>
    </div>
  );
}
