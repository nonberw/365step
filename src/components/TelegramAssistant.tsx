import { useState } from "react";
import { Bot, Check, Send } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const COPY = {
  student: {
    title: "Мой ИИ-помощник в Telegram",
    text: "Спрашивай про своё учебное направление и выбранные экзамены, присылай фото задач. Помощник видит твои результаты на платформе, отвечает только по учёбе и честно говорит, если не уверен.",
  },
  teacher: {
    title: "ИИ-ассистент в Telegram",
    text: "Планы уроков и задания, поиск и глубокое исследование в интернете (/research), результаты класса, задания классу, консультации. Может подготовить сообщение родителям ученика — уходит только после вашей кнопки «Отправить».",
  },
};

/** The student's or teacher's own AI assistant in Telegram. */
export default function TelegramAssistant({ role = "student" }: { role?: "student" | "teacher" }) {
  const { data, setData } = useApi<{ connected: boolean; bot: string | null }>("/family/assistant");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data?.bot) return null;
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#229ED9] text-white">
        <Bot className="size-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-display text-lg font-semibold">{COPY[role].title}</span>
        <span className="text-sm text-muted-foreground">{COPY[role].text}</span>
      </span>
      {data.connected ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
            <Check className="size-4" /> Подключён
          </span>
          {data.bot && (
            <a href={`https://t.me/${data.bot}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#229ED9] px-3.5 text-xs font-semibold text-white">
              <Send className="size-3.5" /> Открыть чат
            </a>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!confirm("Отключить помощника? История переписки удалится.")) return;
              await api("/family/assistant", { method: "DELETE" });
              setData({ ...data, connected: false });
              setUrl(null);
            }}
          >
            Отключить
          </Button>
        </span>
      ) : url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#229ED9] px-5 text-sm font-semibold text-white">
          <Send className="size-4" /> Открыть Telegram и нажать Start
        </a>
      ) : (
        <Button
          disabled={busy}
          className="shrink-0"
          onClick={async () => {
            setBusy(true);
            try {
              setUrl((await api<{ url: string }>("/family/assistant", { method: "POST" })).url);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Bot /> {busy ? "Готовлю…" : "Подключить"}
        </Button>
      )}
    </Card>
  );
}
