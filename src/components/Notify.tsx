import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { routeAccess } from "@shared/directionPolicy";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { NotificationCard, type Variant } from "@/components/ui/notifications-5";

// App-wide notifications drawn with the 21st.dev notification card.
// Anything can call notify(); api.ts also sends one when a free account runs out of AI answers.

export interface Toast {
  variant: Variant;
  title: string;
  body?: string;
  /** internal link shown under the text */
  href?: string;
  linkLabel?: string;
}

interface Item extends Toast {
  id: number;
}

const NotifyContext = createContext<(t: Toast) => void>(() => {});
export const useNotify = () => useContext(NotifyContext);

let seq = 0;

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const {user}=useAuth();
  useEffect(()=>setItems([]),[user?.id,user?.learningProfile.version]);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const notify = useCallback(
    (t: Toast) => {
      const id = ++seq;
      setItems((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), 7000);
    },
    [dismiss],
  );

  useEffect(() => {
    const on = (e: Event) => notify((e as CustomEvent<Toast>).detail);
    window.addEventListener("nc:notify", on);
    return () => window.removeEventListener("nc:notify", on);
  }, [notify]);

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-[60] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.filter(t=>!t.href||user?.role!=='student'||routeAccess(t.href,user.learningProfile,user.goals)==='allow').map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.25 }} className="pointer-events-auto">
              <NotificationCard
                variant={t.variant}
                title={t.title}
                body={t.body}
                onDismiss={() => dismiss(t.id)}
                action={
                  t.href ? (
                    <Link to={t.href} onClick={() => dismiss(t.id)} className="mt-1 text-xs font-extrabold text-primary hover:underline">
                      {t.linkLabel ?? "Открыть"}
                    </Link>
                  ) : undefined
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotifyContext.Provider>
  );
}

/** Fire a notification from non-React code. */
export function notifyGlobal(t: Toast) {
  window.dispatchEvent(new CustomEvent("nc:notify", { detail: t }));
}
