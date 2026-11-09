import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, setSessionExpiredHandler, tokens } from "@/lib/api";
import type { Role, User } from "@/lib/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  hasRole: (...roles: Role[]) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      queryClient.clear();
    });
    if (!tokens.access) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me/")
      .then(({ data }) => setUser(data))
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, [queryClient]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post("/auth/login/", { username, password });
    tokens.set(data.access, data.refresh);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/", { refresh: tokens.refresh });
    } catch {
      /* token may already be invalid; nothing to do */
    }
    tokens.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const hasRole = useCallback(
    (...roles: Role[]) => !!user && (user.role === "admin" || roles.includes(user.role)),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, setUser, hasRole }),
    [user, loading, login, logout, hasRole],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

