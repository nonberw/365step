import { createContext, useCallback, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import type { PublicUser } from "@shared/types";
import { api, ApiError, loadToken, saveToken } from "@/api";

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  signIn: (token: string, user: PublicUser, remember?: boolean) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(!!loadToken());

  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    if (!loadToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    const token=loadToken(), sequence=++refreshSequence.current;
    try {
      const next=await api<PublicUser>("/auth/me");
      if(loadToken()===token && sequence===refreshSequence.current)setUser(next);
    } catch (e) {
      if(loadToken()!==token || sequence!==refreshSequence.current)return;
      if (e instanceof ApiError && e.status === 401) saveToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = (token: string, u: PublicUser, remember = true) => {
    refreshSequence.current++;
    saveToken(token, remember);
    setLoading(false);
    setUser(u);
  };

  const signOut = async () => {
    const pending=api("/auth/logout", { body: {} }).catch(() => {});
    refreshSequence.current++;
    saveToken(null);
    setUser(null);
    setLoading(false);
    await pending;
  };

  return <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
