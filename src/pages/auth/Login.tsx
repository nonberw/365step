import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PublicUser } from "@shared/types";
import { api } from "@/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ErrorBox } from "@/components/Page";
import AuthLayout from "./AuthLayout";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ token: string; user: PublicUser }>("/auth/login", { body: { email, password } });
      signIn(r.token, r.user, remember);
      navigate("/learn");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <p className="eyebrow">С возвращением</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Вход в 365step</h1>
      <p className="mt-2 text-sm text-muted-foreground">Один аккаунт для SAT, IELTS, ЕНТ и кода. Твоё растение ждёт.</p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Почта" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label="Пароль" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input id="remember" type="checkbox" className="size-4 accent-[var(--primary)]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Запомнить меня на этом устройстве
        </label>
        <ErrorBox message={error} />
        <Button size="lg" disabled={busy}>
          {busy ? "Вхожу…" : "Войти"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Нет аккаунта?{" "}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Зарегистрироваться
        </Link>
      </p>
      <p className="mt-6 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">На чужом или общем устройстве снимите «Запомнить меня»: после закрытия вкладки аккаунт выйдет сам.</p>
    </AuthLayout>
  );
}
