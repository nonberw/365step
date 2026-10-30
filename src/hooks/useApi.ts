import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";

/** GET with loading and error state; `reload` refetches, `poll` refetches every N ms. */
export function useApi<T>(path: string | null, poll?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!path);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      if (alive.current) {
        setData(d);
        setError("");
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    setLoading(!!path);
    reload();
    if (!poll) return () => void (alive.current = false);
    const t = window.setInterval(reload, poll);
    return () => {
      alive.current = false;
      window.clearInterval(t);
    };
  }, [reload, poll, path]);

  return { data, setData, error, loading, reload };
}
