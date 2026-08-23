import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AppUser } from "@/lib/flowguard-api";

type AuthState = { user: AppUser; token: string } | null;
type AuthContextValue = { auth: AuthState; signIn: (next: NonNullable<AuthState>) => void; updateUser: (user: AppUser) => void; signOut: () => void; };
const AuthContext = createContext<AuthContextValue | null>(null);
const storageKey = "flowguard-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) as AuthState : null;
  });
  const value = useMemo<AuthContextValue>(() => ({
    auth,
    signIn: next => { localStorage.setItem(storageKey, JSON.stringify(next)); setAuth(next); },
    updateUser: user => setAuth(current => {
      if (!current) return current;
      const next = { ...current, user };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    }),
    signOut: () => { localStorage.removeItem(storageKey); setAuth(null); },
  }), [auth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
