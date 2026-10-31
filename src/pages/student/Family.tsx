import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Check, Copy, ExternalLink, Mail, Send, Trash2, UsersRound } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { fmtDate } from "@/lib/format";
import { ErrorBox, Loading } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spotlight, Tilt } from "@/components/ui/tilt";
import { Aurora } from "@/pages/ent/EntHome";
import TelegramAssistant from "@/components/TelegramAssistant";

interface Link {
  id: string;
  parentName: string;
  email: string;
  telegram: boolean;
  url: string;
  telegramUrl: string | null;
  lastSentAt: number | null;
  createdAt: number;
}

export default function Family() {
  const { data, error, loading, setData } = useApi<{ links: Link[]; channels: { email: boolean; telegram: boolean; telegramBot: string | null } }>("/family");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const l = await api<Link>("/family", { body: { parentName: name, email } });
      setData({ ...data!, links: [...data!.links, l] });
      setName("");
      setEmail("");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#120d0d] text-white">
        <Aurora />
        <div className="relative flex flex-col gap-4 px-6 py-10 sm:px-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/80">
            <UsersRound className="size-3.5 text-[#8fb0ff]" /> Для родителей
          </span>
          <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">
            Пусть родители видят <span className="bg-gradient-to-r from-[#8fb0ff] to-[#4f7cf0] bg-clip-text text-transparent">твой прогресс</span>
          </h1>
          <p className="max-w-xl text-white/70">
            Создай личную ссылку для мамы или папы. Они увидят баллы ЕНТ, SAT и IELTS, пробники, консультации и задания учителя, а по пятницам получат короткий отчёт на почту или в Telegram. Регистрироваться им не нужно,
            а ссылку можно отключить в любой момент.
          </p>
        </div>
      </section>

      {data.channels.telegram && <TelegramAssistant />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-semibold">Добавить родителя</h2>
          <form onSubmit={add} className="flex flex-col gap-3">
            <Input aria-label="Имя родителя" placeholder="Как зовут (например, Айгуль Сериковна)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input aria-label="Почта для отчётов" type="email" placeholder="Почта для отчёта по пятницам (необязательно)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <ErrorBox message={err} />
            <Button disabled={busy || !name.trim()} className="self-start">
              <UsersRound /> {busy ? "Создаю…" : "Создать ссылку"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            {data.channels.email ? "Отчёты на почту включены." : "Отправка на почту включится, когда школа подключит почтовый сервис — до этого отчёт виден по ссылке."}{" "}
            {data.channels.telegram ? "Telegram-бот подключён." : "Telegram-бот пока не подключён."}
          </p>
        </Card>

        <div className="flex flex-col gap-3">
          {data.links.length === 0 && (
            <Card className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <UsersRound className="size-8" />
              Пока ни одной ссылки. Добавь родителя слева.
            </Card>
          )}
          {data.links.map((l, i) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Tilt rotationFactor={3} isReverse springOptions={{ stiffness: 220, damping: 22 }}>
                <div className="relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-border bg-card p-4">
                  <Spotlight size={220} className="from-primary/20 via-primary/5 to-transparent" />
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-full bg-primary font-display font-bold text-primary-foreground">{l.parentName.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-semibold">{l.parentName}</span>
                      <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {l.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="size-3" /> {l.email}
                          </span>
                        )}
                        <span>{l.telegram ? "Telegram подключён" : "Telegram не подключён"}</span>
                        {l.lastSentAt && <span>последний отчёт {fmtDate(l.lastSentAt)}</span>}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label="Отключить ссылку"
                      onClick={async () => {
                        if (!confirm(`Отключить доступ для ${l.parentName}?`)) return;
                        await api(`/family/${l.id}`, { method: "DELETE" });
                        setData({ ...data, links: data.links.filter((x) => x.id !== l.id) });
                      }}
                      className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(l.url).catch(() => {});
                        setCopied(l.id);
                        setTimeout(() => setCopied(null), 1800);
                      }}
                    >
                      {copied === l.id ? <Check /> : <Copy />} {copied === l.id ? "Скопировано" : "Скопировать ссылку"}
                    </Button>
                    <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3.5 text-xs font-semibold hover:bg-muted">
                      <ExternalLink className="size-3.5" /> Как видит родитель
                    </a>
                    {l.telegramUrl && !l.telegram && (
                      <a href={l.telegramUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#229ED9] px-3.5 text-xs font-semibold text-white">
                        <Send className="size-3.5" /> Подключить Telegram
                      </a>
                    )}
                  </div>
                </div>
              </Tilt>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
