import { useState } from "react";
import { PageHeader } from "@/components/Page";
import { Card, CardTitle } from "@/components/ui/card";
import { CircleProgress } from "@/components/ui/circle-progress";

// Approximate raw → scaled curves for a full-length Digital SAT
// (54 R&W questions, 44 Math questions). Real scoring depends on question
// difficulty and module routing, so this is a planning tool, not a prediction.
function scale(correct: number, total: number, hardModule: boolean) {
  const p = correct / total;
  const curved = 200 + 600 * Math.pow(p, 0.9);
  const capped = hardModule ? curved : Math.min(curved, 640);
  return Math.round(capped / 10) * 10;
}

export default function Calculator() {
  const [rw, setRw] = useState(40);
  const [math, setMath] = useState(32);
  const [rwHard, setRwHard] = useState(true);
  const [mathHard, setMathHard] = useState(true);
  const rwScore = scale(rw, 54, rwHard);
  const mathScore = scale(math, 44, mathHard);

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader eyebrow="SAT" title={"Score calculator"} description={"Estimate how many correct answers you need for your target score. This is approximate: the actual score depends on question difficulty and the second module."} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        <Card className="flex flex-col gap-6">
          <Slider id="rw" label={"Reading & Writing: correct answers"} value={rw} max={54} onChange={setRw} />
          <Toggle id="rw-hard" checked={rwHard} onChange={setRwHard} label={"Harder Reading & Writing module 2"} />
          <Slider id="math" label={"Math: correct answers"} value={math} max={44} onChange={setMath} />
          <Toggle id="math-hard" checked={mathHard} onChange={setMathHard} label={"Harder Math module 2"} />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-4 px-10">
          <CircleProgress value={rwScore + mathScore} max={1600} size={170} stroke={13}>
            <div>
              <p className="font-display text-4xl font-semibold tabular">{rwScore + mathScore}</p>
              <p className="text-xs text-muted-foreground">out of 1600</p>
            </div>
          </CircleProgress>
          <div className="grid w-full grid-cols-2 gap-3 text-center">
            <div>
              <CardTitle className="tabular">{rwScore}</CardTitle>
              <p className="text-xs text-muted-foreground">R&W</p>
            </div>
            <div>
              <CardTitle className="tabular">{mathScore}</CardTitle>
              <p className="text-xs text-muted-foreground">Math</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Slider({ id, label, value, max, onChange }: { id: string; label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium">
        {label}
        <span className="font-display text-xl font-semibold tabular">
          {value}/{max}
        </span>
      </label>
      <input id={id} type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
    </div>
  );
}

function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" className="size-4 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
