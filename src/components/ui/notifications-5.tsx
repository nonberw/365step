import { useState } from "react";
import { cn } from "@/lib/utils";
import { CircleCheck, Info, TriangleAlert, CircleAlert, X } from "lucide-react";

// Notification cards from 21st.dev (notifications-5). `NotificationCard` is the single card;
// the default export is the original static block, kept for reference.

export type Variant = "success" | "info" | "warning" | "error";

export const notificationConfig: Record<Variant, { icon: typeof CircleCheck; accent: string }> = {
  success: { icon: CircleCheck, accent: "text-success" },
  info: { icon: Info, accent: "text-foreground" },
  warning: { icon: TriangleAlert, accent: "text-warning" },
  error: { icon: CircleAlert, accent: "text-destructive" },
};

export function NotificationCard({ variant, title, body, onDismiss, action, className }: { variant: Variant; title: string; body?: string; onDismiss?: () => void; action?: React.ReactNode; className?: string }) {
  const { icon: Icon, accent } = notificationConfig[variant];
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-2xl border-2 border-border bg-background p-4 shadow-sm", className)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", accent)} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-extrabold">{title}</span>
        {body && <span className="text-xs text-muted-foreground">{body}</span>}
        {action}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Закрыть" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const initial: { id: number; variant: Variant; title: string; body: string }[] = [
  { id: 1, variant: "success", title: "Растение выросло", body: "Подсолнух перешёл на стадию «Расцвет»." },
  { id: 2, variant: "info", title: "Новый банк заданий", body: "Добавлено 1350 вопросов SAT." },
  { id: 3, variant: "warning", title: "Лимит ИИ почти исчерпан", body: "Осталось 2 из 8 ИИ-ответов на сегодня." },
  { id: 4, variant: "error", title: "Не получилось сохранить", body: "Проверьте соединение и повторите." },
];

export default function NotificationsBlock() {
  const [toasts, setToasts] = useState(initial);
  return (
    <section className="flex min-h-svh w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-3">
        {toasts.map((t) => (
          <NotificationCard key={t.id} {...t} onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
        {toasts.length === 0 && <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">Всё прочитано.</p>}
      </div>
    </section>
  );
}
