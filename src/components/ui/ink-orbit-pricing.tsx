// Pricing section from 21st.dev (kedhareswer/ink-orbit-pricing): a monthly/yearly toggle with a sliding pill,
// plan cards whose prices count to the new number, and an inverted, bracketed featured plan.
// No dependencies besides React.

import React from "react";

export type InkPlan = {
  name: string;
  description: string;
  /** Monthly price. `null` shows "Custom". */
  price: number | null;
  features: string[];
  cta: string;
  featured?: boolean;
  badge?: string;
};

export type InkOrbitPricingProps = {
  /** `auto` follows prefers-color-scheme. */
  theme?: "light" | "dark" | "auto";
  tag?: string;
  /** `*word*` is muted, `\n` breaks the line. */
  title?: string;
  subtitle?: string;
  plans?: InkPlan[];
  /** 0.2 = 20% off when billed yearly. 0 hides the discount chip. */
  yearlyDiscount?: number;
  currency?: string;
  defaultBilling?: "monthly" | "yearly";
  labels?: { monthly: string; yearly: string; perMonth: string; custom: string; selected: string; billedMonthly: string; billedYearly: (saving: string) => string };
  onSelectPlan?: (plan: string, billing: "monthly" | "yearly") => void;
  className?: string;
  style?: React.CSSProperties;
};

const RU_LABELS = {
  monthly: "Месяц",
  yearly: "Год",
  perMonth: "/ мес",
  custom: "Индивидуально",
  selected: "Выбрано",
  billedMonthly: "Оплата каждый месяц",
  billedYearly: (saving: string) => "Оплата за год — экономия " + saving + " в год",
};

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

function easeOutCubic(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - Math.pow(1 - c, 3);
}

function parseTitle(s: string): { text: string; muted: boolean }[][] {
  return s.split(/\n|\\n/).map((line) => {
    const out: { text: string; muted: boolean }[] = [];
    line.split("*").forEach((text, i) => {
      if (text) out.push({ text, muted: i % 2 === 1 });
    });
    return out;
  });
}

function planPrice(monthly: number | null, billing: "monthly" | "yearly", discount: number): number | null {
  if (monthly === null) return null;
  if (billing === "monthly") return monthly;
  return Math.round(monthly * (1 - clamp(discount, 0, 0.95)));
}

function yearlySaving(monthly: number | null, discount: number): number {
  if (monthly === null) return 0;
  return monthly * 12 - (planPrice(monthly, "yearly", discount) ?? 0) * 12;
}

const fmt = (n: number) => n.toLocaleString("ru-RU");

export default function InkOrbitPricing({
  theme = "auto",
  tag = "Тарифы",
  title = "Простые *и честные*\nтарифы",
  subtitle = "7 дней Pro бесплатно. Без карты, отмена в любой момент.",
  plans = [],
  yearlyDiscount = 0.2,
  currency = "₸",
  defaultBilling = "monthly",
  labels = RU_LABELS,
  onSelectPlan,
  className = "",
  style,
}: InkOrbitPricingProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const [dark, setDark] = React.useState(theme === "dark");
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      setDark(theme === "dark");
      return;
    }
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setDark(theme === "auto" ? scheme.matches : theme === "dark");
      setReduced(motion.matches);
    };
    sync();
    scheme.addEventListener?.("change", sync);
    motion.addEventListener?.("change", sync);
    return () => {
      scheme.removeEventListener?.("change", sync);
      motion.removeEventListener?.("change", sync);
    };
  }, [theme]);

  const revealRef = React.useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    const el = revealRef.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver !== "function") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  const [billing, setBilling] = React.useState(defaultBilling);
  const [picked, setPicked] = React.useState("");
  const pickPlan = (name: string) => {
    setPicked(name);
    onSelectPlan?.(name, billing);
  };

  return (
    <div className={"ip-root " + className} data-theme={dark ? "dark" : "light"} style={style}>
      <style>{IP_CSS}</style>
      <div className="ip-shell">
        <section className="ip-sec" aria-labelledby={uid + "price"}>
          <div className="ip-reveal" ref={revealRef} data-in={inView}>
            <div className="ip-head" id={uid + "price"}>
              {tag && <span className="ip-tag">{tag}</span>}
              <h2 className="ip-h2">
                {parseTitle(title).map((line, i) => (
                  <span key={i}>
                    {line.map((run, j) =>
                      run.muted ? (
                        <span key={j} className="ip-muted" style={{ display: "inline" }}>
                          {run.text}
                        </span>
                      ) : (
                        <React.Fragment key={j}>{run.text}</React.Fragment>
                      ),
                    )}
                  </span>
                ))}
              </h2>
              {subtitle && <p className="ip-sub">{subtitle}</p>}
              <div className="ip-toggle" role="group" aria-label="Период оплаты">
                <span className="ip-toggle-pill" style={{ transform: billing === "yearly" ? "translateX(100%)" : "none" }} />
                <button type="button" aria-pressed={billing === "monthly"} onClick={() => setBilling("monthly")}>
                  {labels.monthly}
                </button>
                <button type="button" aria-pressed={billing === "yearly"} onClick={() => setBilling("yearly")}>
                  {labels.yearly}
                  {yearlyDiscount > 0 && <span className="ip-save">-{Math.round(yearlyDiscount * 100)}%</span>}
                </button>
              </div>
            </div>
            <div className="ip-plans" style={{ ["--ip-cols" as string]: String(clamp(plans.length, 1, 4)) }}>
              {plans.map((plan) => {
                const price = planPrice(plan.price, billing, yearlyDiscount);
                const saving = billing === "yearly" ? yearlySaving(plan.price, yearlyDiscount) : 0;
                const chosen = picked === plan.name;
                return (
                  <div key={plan.name} className="ip-frame">
                    {plan.featured && (
                      <>
                        <span className="ip-c ip-c-tl" aria-hidden="true" />
                        <span className="ip-c ip-c-tr" aria-hidden="true" />
                        <span className="ip-c ip-c-bl" aria-hidden="true" />
                        <span className="ip-c ip-c-br" aria-hidden="true" />
                      </>
                    )}
                    <article className={"ip-plan" + (plan.featured ? " ip-plan-hot" : "")}>
                      <div className="ip-plan-name">
                        {plan.name}
                        {plan.badge && <span className="ip-badge">{plan.badge}</span>}
                      </div>
                      <p className="ip-plan-desc">{plan.description}</p>
                      <div className="ip-price">
                        <PriceTicker value={price} currency={currency} custom={labels.custom} reduced={reduced} />
                        {price !== null && price > 0 && <span className="ip-per">{labels.perMonth}</span>}
                      </div>
                      <div className="ip-saving">{price === null || price === 0 ? " " : saving > 0 ? labels.billedYearly(fmt(saving) + " " + currency) : labels.billedMonthly}</div>
                      <ul className="ip-feats">
                        {plan.features.map((f) => (
                          <li key={f}>
                            <Check />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button type="button" className={"ip-btn " + (plan.featured ? "ip-btn-dark" : "ip-btn-ghost")} onClick={() => pickPlan(plan.name)} aria-pressed={chosen}>
                        {chosen ? (
                          <>
                            <Check /> {labels.selected}
                          </>
                        ) : (
                          <>
                            {plan.cta}
                            <Arrow />
                          </>
                        )}
                      </button>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PriceTicker({ value, currency, custom, reduced }: { value: number | null; currency: string; custom: string; reduced: boolean }) {
  const [shown, setShown] = React.useState(value ?? 0);
  const from = React.useRef(value ?? 0);
  React.useEffect(() => {
    if (value === null) return;
    if (reduced) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 500);
      const v = start + (value - start) * easeOutCubic(t);
      setShown(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  if (value === null) return <>{custom}</>;
  return (
    <>
      {fmt(Math.round(shown))} {currency}
    </>
  );
}

function Arrow() {
  return (
    <svg className="ip-arr" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 6.4 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const IP_CSS = `
.ip-root{--ip-page:#efefef;--ip-hatch:rgba(0,0,0,.06);--ip-paper:#fbfbfb;--ip-card:#f4f4f4;--ip-raise:#ffffff;--ip-ink:#151515;--ip-soft:#3d3d3d;--ip-muted:#7b7b7b;--ip-faint:#a8a8a8;--ip-line:#e2e2e2;--ip-line-strong:#cfcfcf;--ip-bracket:#c9c9c9;--ip-inv:#161616;--ip-inv-ink:#f5f5f5;--ip-inv-muted:#9a9a9a;--ip-shadow:0 1px 2px rgba(0,0,0,.05),0 8px 24px -12px rgba(0,0,0,.12);--ip-sans:"Manrope","Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;position:relative;width:100%;box-sizing:border-box;background-color:var(--ip-page);background-image:repeating-linear-gradient(135deg,var(--ip-hatch) 0 1px,transparent 1px 10px);color:var(--ip-ink);font-family:var(--ip-sans);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased;padding:28px clamp(10px,2.4vw,28px);transition:background-color .45s ease,color .45s ease}
.ip-root[data-theme="dark"]{--ip-page:#0b0b0b;--ip-hatch:rgba(255,255,255,.05);--ip-paper:#121212;--ip-card:#181818;--ip-raise:#1e1e1e;--ip-ink:#eeeeee;--ip-soft:#c9c9c9;--ip-muted:#8d8d8d;--ip-faint:#5d5d5d;--ip-line:#262626;--ip-line-strong:#363636;--ip-bracket:#444444;--ip-inv:#efefef;--ip-inv-ink:#121212;--ip-inv-muted:#646464;--ip-shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px -14px rgba(0,0,0,.7)}
.ip-root :where(*){box-sizing:border-box}
.ip-root :focus-visible{outline:2px solid var(--ip-ink);outline-offset:2px}
.ip-root :where(button){font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:inherit;letter-spacing:inherit}
.ip-root :where(svg){display:block;max-width:none;flex:none}
.ip-root :where(h2,p,ul,li){margin:0;padding:0;font-size:inherit;font-weight:inherit;list-style:none}
.ip-shell{width:100%;max-width:1180px;margin:0 auto;container-type:inline-size}
.ip-sec{position:relative;background:var(--ip-paper);border:1px solid var(--ip-line);padding:clamp(36px,6cqw,72px) clamp(16px,4cqw,48px);transition:background-color .45s,border-color .45s}
.ip-reveal{opacity:0;transform:translateY(18px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
.ip-reveal[data-in="true"]{opacity:1;transform:none}
.ip-head{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin-bottom:clamp(28px,4.5cqw,52px)}
.ip-tag{display:inline-block;padding:4px 10px;font-size:11.5px;letter-spacing:.02em;color:var(--ip-soft);background:var(--ip-card);border:1px solid var(--ip-line)}
.ip-h2{font-size:clamp(28px,4.4cqw,44px);line-height:1.08;letter-spacing:-.025em;font-weight:500}
.ip-h2>span{display:block}
.ip-muted{color:var(--ip-faint)}
.ip-sub{color:var(--ip-muted);font-size:15px;max-width:52ch}
.ip-toggle{position:relative;display:inline-grid;grid-template-columns:1fr 1fr;padding:3px;background:var(--ip-card);border:1px solid var(--ip-line)}
.ip-toggle button{position:relative;z-index:1;padding:8px 16px;font-size:13px;color:var(--ip-muted);transition:color .3s;white-space:nowrap;text-align:center}
.ip-toggle button[aria-pressed="true"]{color:var(--ip-inv-ink)}
.ip-toggle-pill{position:absolute;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);background:var(--ip-inv);transition:transform .45s cubic-bezier(.2,.8,.2,1)}
.ip-save{display:inline-block;margin-left:6px;padding:1px 5px;font-size:10.5px;border:1px solid currentColor;opacity:.8}
.ip-plans{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(16px,2.4cqw,24px);align-items:stretch}
@container (min-width:640px){.ip-plans{grid-template-columns:repeat(var(--ip-cols,3),minmax(0,1fr))}}
.ip-frame{position:relative;display:flex}
.ip-c{position:absolute;width:12px;height:12px;border-color:var(--ip-bracket);border-style:solid;border-width:0;pointer-events:none}
.ip-c-tl{top:-6px;left:-6px;border-top-width:1.5px;border-left-width:1.5px}
.ip-c-tr{top:-6px;right:-6px;border-top-width:1.5px;border-right-width:1.5px}
.ip-c-bl{bottom:-6px;left:-6px;border-bottom-width:1.5px;border-left-width:1.5px}
.ip-c-br{bottom:-6px;right:-6px;border-bottom-width:1.5px;border-right-width:1.5px}
.ip-plan{position:relative;flex:1;display:flex;flex-direction:column;gap:18px;padding:26px 22px 22px;background:var(--ip-card);border:1px solid var(--ip-line);transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s,border-color .3s}
.ip-plan:hover{transform:translateY(-4px);box-shadow:var(--ip-shadow);border-color:var(--ip-line-strong)}
.ip-plan-hot{background:var(--ip-inv);color:var(--ip-inv-ink);border-color:var(--ip-inv)}
.ip-plan-hot:hover{border-color:var(--ip-inv)}
.ip-plan-hot .ip-plan-desc,.ip-plan-hot .ip-per{color:var(--ip-inv-muted)}
.ip-plan-name{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:14px;font-weight:600}
.ip-badge{font-size:10.5px;font-weight:500;padding:3px 8px;border:1px solid currentColor;opacity:.85}
.ip-plan-desc{font-size:13px;line-height:1.5;color:var(--ip-muted);min-height:3em}
.ip-price{display:flex;align-items:baseline;gap:6px;font-size:42px;font-weight:500;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
.ip-per{font-size:13px;letter-spacing:0;color:var(--ip-muted);font-weight:400}
.ip-saving{font-size:11.5px;color:var(--ip-muted);min-height:1.3em;margin-top:-10px}
.ip-plan-hot .ip-saving{color:var(--ip-inv-muted)}
.ip-feats{display:grid;gap:10px;font-size:13px;padding-top:16px;border-top:1px dashed var(--ip-line-strong)}
.ip-plan-hot .ip-feats{border-top-color:color-mix(in srgb,var(--ip-inv-ink) 25%,transparent)}
.ip-feats li{display:flex;align-items:flex-start;gap:9px}
.ip-feats svg{margin-top:3px}
.ip-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:auto;width:100%;padding:12px 16px;font-size:13.5px;font-weight:500;line-height:1;white-space:nowrap;border-radius:2px;transition:background-color .2s,color .2s,box-shadow .25s,transform .2s cubic-bezier(.2,.8,.2,1)}
.ip-btn-dark{background:var(--ip-inv);color:var(--ip-inv-ink);box-shadow:0 0 0 3px var(--ip-paper),0 0 0 4px var(--ip-line-strong),0 6px 16px -8px rgba(0,0,0,.5)}
.ip-btn-dark:hover{box-shadow:0 0 0 3px var(--ip-paper),0 0 0 4px var(--ip-ink),0 10px 22px -10px rgba(0,0,0,.6);transform:translateY(-1px)}
.ip-plan-hot .ip-btn-dark{background:var(--ip-inv-ink);color:var(--ip-inv);box-shadow:none}
.ip-plan-hot .ip-btn-dark:hover{box-shadow:0 0 0 3px var(--ip-inv),0 0 0 4px var(--ip-inv-muted)}
.ip-btn-ghost{background:var(--ip-raise);color:var(--ip-ink);border:1px solid var(--ip-line-strong)}
.ip-btn-ghost:hover{border-color:var(--ip-ink)}
.ip-btn:active{transform:translateY(0) scale(.98)}
.ip-btn .ip-arr{transition:transform .25s cubic-bezier(.2,.8,.2,1)}
.ip-btn:hover .ip-arr{transform:translateX(3px)}
@media (prefers-reduced-motion:reduce){
.ip-reveal{opacity:1;transform:none;transition:none}
.ip-toggle-pill,.ip-toggle button,.ip-plan,.ip-btn,.ip-btn .ip-arr{transition:none}
}
`;
