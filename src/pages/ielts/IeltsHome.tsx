import { fmtExamDate as fmtDate } from "@/lib/examFormat";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookText, Gamepad2, Headphones, Mic, PenLine } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/lib/auth";
import { ART, daysUntil, plural } from "@/lib/format";
import { GreetingBanner } from "@/components/Page";
import { Badge, Card, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { CircleProgress } from "@/components/ui/circle-progress";

const SKILLS = [
  { to: "/ielts/speaking", icon: Mic, title: "Speaking", text: "Feedback on your transcript; pronunciation requires audio analysis" },
  { to: "/ielts/writing", icon: PenLine, title: "Writing", text: "Task 1 charts and Task 2 essays, with feedback highlighted in your response" },
  { to: "/ielts/reading", icon: BookText, title: "Reading", text: "Academic passages with True/False/Not Given, multiple choice and gap-fill questions" },
  { to: "/ielts/listening", icon: Headphones, title: "Listening", text: "Browser-generated dialogue and lecture audio for practice" },
  { to: "/ielts/games", icon: Gamepad2, title: "Games", text: "Keep speaking without long pauses to complete the challenge." },
];

const KIND: Record<string, string> = { writing1: "Writing Task 1", writing2: "Writing Task 2", speaking: "Speaking" };

export default function IeltsHome() {
  const { user } = useAuth();
  const history = useApi<{ id: number; kind: string; overall: number | null; at: number }[]>("/ielts/history");
  const days = daysUntil(user?.goals.ielts?.date);
  const target = user?.goals.ielts?.target;
  const last = history.data?.[0];

  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner eyebrow="IELTS Academic"
        title="IELTS"
        subtitle={days !== null ? `Until the exam: ${days} ${plural(days, "days", "days", "days")}${target ? ` Objective ${target}` : ""}` : "Set the target and date of IELTS in the profile to see the countdown."}
        image={ART.monet}
        position="center 50%"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SKILLS.map((s) => (
          <Link key={s.to} to={s.to} className="group flex flex-col gap-2 rounded-2xl border border-border p-5 hover:border-primary">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <s.icon className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold">{s.title}</span>
            <span className="text-sm text-muted-foreground">{s.text}</span>
            <ArrowRight className="mt-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
        <BandCalculator />
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle>Recent reviews</CardTitle>
            {last && <Badge tone="dark">Last result {last.overall ?? "Demo / not evaluated"}</Badge>}
          </div>
          {!history.data?.length ? (
            <p className="text-sm text-muted-foreground">No reviews yet. Start with a short Speaking practice.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {history.data.slice(0, 8).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-medium">{KIND[h.kind] ?? h.kind}</span>
                  <span className="text-muted-foreground">{fmtDate(h.at)}</span>
                  <span className="font-display text-lg font-semibold tabular">{h.overall === null ? "Not assessed" : h.overall.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">AI estimates are approximate and do not replace an official IELTS result.</p>
        </Card>
      </div>
    </div>
  );
}

const BANDS = Array.from({ length: 17 }, (_, i) => 1 + i * 0.5);

/** Overall = mean of 4 skills, rounded to the nearest half band (.25 → .5, .75 → next whole). */
function overall(scores: number[]) {
  const mean = scores.reduce((a, b) => a + b, 0) / 4;
  const whole = Math.floor(mean);
  const frac = mean - whole;
  return frac < 0.25 ? whole : frac < 0.75 ? whole + 0.5 : whole + 1;
}

function BandCalculator() {
  const [s, setS] = useState({ L: 6.5, R: 6.5, W: 6, S: 6 });
  const ov = overall(Object.values(s));
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Overall band calculator</CardTitle>
      <div className="flex items-center gap-5">
        <CircleProgress value={ov} max={9} size={110} stroke={10}>
          <p className="font-display text-3xl font-semibold tabular">{ov.toFixed(1)}</p>
        </CircleProgress>
        <div className="grid flex-1 grid-cols-2 gap-3">
          {(Object.keys(s) as (keyof typeof s)[]).map((k) => (
            <label key={k} htmlFor={`band-${k}`} className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              {{ L: "Listening", R: "Reading", W: "Writing", S: "Speaking" }[k]}
              <Select id={`band-${k}`} className="h-9" value={s[k]} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })}>
                {BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b.toFixed(1)}
                  </option>
                ))}
              </Select>
            </label>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">The overall score is the average of four skills rounded to half: .25 up to .5, .75 up to the whole.</p>
    </Card>
  );
}
