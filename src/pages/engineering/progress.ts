import { api } from "@/api";
import { useApi } from "@/hooks/useApi";

// Progress in the engineering labs (drone missions, CAD lessons): best score per item, XP on the first success.

export interface EngProgress {
  items: Record<string, { score: number; at: number }>;
}

export const useEngProgress = () => useApi<EngProgress>("/eng/progress");

export const saveEngProgress = (item: string, score: number) => api<{ xp: number; best: number }>("/eng/progress", { body: { item, score } });
