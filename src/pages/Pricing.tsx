import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/AppShell";
import InkOrbitPricing, { type InkPlan } from "@/components/ui/ink-orbit-pricing";
import { ErrorBox } from "@/components/Page";
import type { PublicUser } from "@shared/types";

interface Billing {
  plan: "free" | "pro";
  planUntil: number | null;
  trialUsed: boolean;
  trialDays: number;
  ai: { used: number; limit: number | null };
  checkout: "demo" | "closed";
}

const PRO_MONTH = 4990;
const PRO_YEAR = 39900;
// 12 * 4990 = 59880; the yearly plan costs 39 900, i.e. ~3 325 a month.
const YEARLY_DISCOUNT = 1 - PRO_YEAR / 12 / PRO_MONTH;

const PLANS: InkPlan[] = [
  {
    name: "Старт",
    description: "Чтобы попробовать и заниматься каждый день.",
    price: 0,
    features: ["Банк вопросов SAT и IELTS", "Пробные тесты и Blitz", "8 ИИ-ответов в день", "Рейтинг и дуэли", "Подготовка к ЕНТ"],
    cta: "Начать бесплатно",
  },
  {
    name: "Pro",
    description: "ИИ-наставник без лимитов и личный план до экзамена.",
    price: PRO_MONTH,
    featured: true,
    badge: "7 дней в подарок",
    features: ["ИИ без лимита: разборы, Speaking, Writing", "Личный план до даты экзамена", "Мастер-режим ЕНТ (IRT)", "Кодинг с ИИ-наставником", "Инженерная лаборатория", "Отчёты родителям по пятницам"],
    cta: "Попробовать 7 дней",
  },
];

export function PricingBlock({ onDone }: { onDone?: () => void }) {
  const { user, signIn, refresh } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (user) api<Billing>("/billing").then(setBilling).catch(() => {});
  }, [user]);

  async function select(plan: string, period: "monthly" | "yearly") {
    setError("");
    setNote("");
    if (!user) return navigate("/register");
    if (plan === "Старт") return navigate("/app");
    try {
      if (billing && !billing.trialUsed) {
        await api<PublicUser>("/billing/trial", { body: {} });
        await refresh();
        setNote(`Pro подключён на ${billing.trialDays} дней`);
        onDone?.();
        return;
      }
      const u = await api<PublicUser>("/billing/checkout", { body: { plan: period === "yearly" ? "pro-year" : "pro" } });
      void signIn;
      await refresh();
      setNote(`Pro активен до ${new Date(u.planUntil ?? 0).toLocaleDateString("ru-RU")}`);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return (
    <div className="flex flex-col gap-4">
      <InkOrbitPricing theme={dark ? "dark" : "light"} plans={PLANS} yearlyDiscount={YEARLY_DISCOUNT} onSelectPlan={select} />
      <ErrorBox message={error} />
      {note && <p className="rounded-2xl bg-muted p-4 text-sm font-medium">{note}</p>}
      {billing && (
        <p className="text-center text-sm text-muted-foreground">
          {billing.plan === "pro" && billing.planUntil ? `У вас Pro до ${new Date(billing.planUntil).toLocaleDateString("ru-RU")}. ` : "Сейчас у вас тариф «Старт». "}
          {billing.ai.limit !== null ? `ИИ-ответов сегодня: ${billing.ai.used} из ${billing.ai.limit}.` : "ИИ без лимита."}
          {billing.checkout === "closed" && billing.trialUsed ? " Приём оплаты скоро откроется." : ""}
        </p>
      )}
    </div>
  );
}

export default function Pricing() {
  const { user } = useAuth();
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-5">
        <Link to="/">
          <Logo />
        </Link>
        <Link to={user ? "/app" : "/login"} className="text-sm font-semibold text-primary hover:underline">
          {user ? "В кабинет" : "Войти"}
        </Link>
      </header>
      <main className="mx-auto max-w-[1180px] px-4 pb-16">
        <PricingBlock />
      </main>
    </div>
  );
}
