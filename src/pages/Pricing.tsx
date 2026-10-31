import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/AppShell";
import { PricingCard } from "@/components/ui/dark-gradient-pricing";
import { useNotify } from "@/components/Notify";
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

const fmt = (n: number) => `${n.toLocaleString("ru-RU")} ₸`;

export function PricingBlock({ onDone }: { onDone?: () => void }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) api<Billing>("/billing").then(setBilling).catch(() => {});
  }, [user]);

  async function choose(plan: "free" | "pro" | "pro-year") {
    setError("");
    if (!user) return navigate("/register");
    if (plan === "free") return navigate("/app");
    try {
      if (billing && !billing.trialUsed) {
        await api<PublicUser>("/billing/trial", { body: {} });
        notify({ variant: "success", title: "Pro подключён", body: `${billing.trialDays} дней без ограничений ИИ.` });
      } else {
        const u = await api<PublicUser>("/billing/checkout", { body: { plan } });
        notify({ variant: "success", title: "Pro активен", body: `До ${new Date(u.planUntil ?? 0).toLocaleDateString("ru-RU")}.` });
      }
      await refresh();
      setBilling(await api<Billing>("/billing"));
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const trial = !billing || !billing.trialUsed;
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3 text-center">
        <p className="eyebrow">Тарифы</p>
        <h2 className="text-3xl font-black leading-tight sm:text-4xl md:text-5xl">Начни бесплатно, расти без лимитов</h2>
        <p className="text-base font-semibold text-muted-foreground md:text-lg">7 дней Pro при регистрации, карта не нужна. Дальше — «Старт» навсегда или Pro.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <PricingCard
          tier="Старт"
          price="0 ₸"
          bestFor="Чтобы заниматься каждый день"
          CTA={user ? "Остаться на «Старт»" : "Начать бесплатно"}
          onSelect={() => choose("free")}
          benefits={[
            { text: "Банк SAT и IELTS", checked: true },
            { text: "Пробные тесты и Blitz", checked: true },
            { text: "Растение-спутник", checked: true },
            { text: "8 ИИ-ответов в день", checked: true },
            { text: "Личный план до экзамена", checked: false },
            { text: "Speaking и Writing с ИИ без лимита", checked: false },
          ]}
        />
        <PricingCard
          tier="Pro"
          price={`${fmt(4990)}/мес`}
          bestFor="ИИ-наставник без лимитов"
          CTA={trial ? "7 дней бесплатно" : "Оформить Pro"}
          featured
          badge="Популярный"
          onSelect={() => choose("pro")}
          benefits={[
            { text: "ИИ без лимита: разборы, Speaking, Writing", checked: true },
            { text: "Личный план до даты экзамена", checked: true },
            { text: "Мастер-режим ЕНТ (IRT)", checked: true },
            { text: "Кодинг с ИИ-наставником", checked: true },
            { text: "Инженерная лаборатория", checked: true },
            { text: "Отчёты родителям по пятницам", checked: true },
          ]}
        />
        <PricingCard
          tier="Pro на год"
          price={`${fmt(39900)}/год`}
          bestFor="Выгода 33% — как 8 месяцев"
          CTA="Оформить на год"
          onSelect={() => choose("pro-year")}
          benefits={[
            { text: "Всё из Pro", checked: true },
            { text: "Четыре месяца в подарок", checked: true },
            { text: "Цена фиксируется на год", checked: true },
            { text: "Подготовка от начала учёбы до экзамена", checked: true },
            { text: "Приоритетная поддержка", checked: false },
            { text: "Индивидуальные консультации", checked: false },
          ]}
        />
      </div>
      <ErrorBox message={error} />
      {billing && (
        <p className="text-center text-sm font-semibold text-muted-foreground">
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
        <Link to={user ? "/app" : "/login"} className="text-sm font-extrabold text-primary hover:underline">
          {user ? "В кабинет" : "Войти"}
        </Link>
      </header>
      <main className="mx-auto max-w-[1180px] px-4 pb-16 pt-6">
        <PricingBlock />
      </main>
    </div>
  );
}
