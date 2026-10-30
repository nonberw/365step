import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
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

  const refresh = useCallback(async () => {
    if (!loadToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<PublicUser>("/auth/me"));
    } catch (e) {
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
    saveToken(token, remember);
    setUser(u);
  };

  const signOut = async () => {
    await api("/auth/logout", { body: {} }).catch(() => {});
    saveToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
