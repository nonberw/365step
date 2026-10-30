// Simple SVG chart for Writing Task 1 (synthetic data). Colours come from theme tokens.

const COLORS = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-2)"];

export default function Chart({ kind, title, unit, categories, series }: { kind: "bar" | "line"; title: string; unit: string; categories: string[]; series: { name: string; values: number[] }[] }) {
  const W = 640;
  const H = 300;
  const pad = { l: 44, r: 16, t: 16, b: 40 };
  const max = Math.max(...series.flatMap((s) => s.values));
  const top = niceMax(max);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const band = (W - pad.l - pad.r) / categories.length;
  const ticks = Array.from({ length: 5 }, (_, i) => (top / 4) * i);

  return (
    <figure className="w-full">
      <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[480px] w-full" role="img" aria-label={`${title}. ${series.map((s) => `${s.name}: ${s.values.join(", ")}`).join("; ")}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">
                {fmt(t)}
              </text>
            </g>
          ))}
          {categories.map((c, i) => (
            <text key={c} x={pad.l + band * i + band / 2} y={H - pad.b + 18} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
              {c}
            </text>
          ))}
          {kind === "bar"
            ? series.map((s, si) =>
                s.values.map((v, i) => {
                  const bw = (band * 0.7) / series.length;
                  const x = pad.l + band * i + band * 0.15 + bw * si;
                  return <rect key={`${si}-${i}`} x={x} y={y(v)} width={bw - 2} height={y(0) - y(v)} rx={3} fill={COLORS[si % COLORS.length]} />;
                }),
              )
            : series.map((s, si) => (
                <g key={s.name}>
                  <polyline fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2.5} points={s.values.map((v, i) => `${pad.l + band * i + band / 2},${y(v)}`).join(" ")} />
                  {s.values.map((v, i) => (
                    <circle key={i} cx={pad.l + band * i + band / 2} cy={y(v)} r={3.5} fill={COLORS[si % COLORS.length]} />
                  ))}
                </g>
              ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {series.map((s, si) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-sm" style={{ background: COLORS[si % COLORS.length] }} /> {s.name}
          </span>
        ))}
        <span className="ml-auto">Единицы: {unit}</span>
      </div>
    </figure>
  );
}

function niceMax(v: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  return (n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10) * pow;
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
