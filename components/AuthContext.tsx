'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginRequest, logoutRequest } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import type { AuthUser } from '@/lib/api/types';

const TOKEN_KEY = 'evo-auth-token';
const USER_KEY = 'evo-auth-user';

type AuthValue = {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    try {
      const storedToken = window.localStorage.getItem(TOKEN_KEY);
      const storedUser = window.localStorage.getItem(USER_KEY);
      if (storedToken) setToken(storedToken);
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as AuthUser;
        if (parsed?.email) setUser(parsed);
      }
    } catch {
      /* start signed out */
    }
    setReady(true);
  }, []);

  const persist = (nextToken: string | null, nextUser: AuthUser | null) => {
    setToken(nextToken);
    setUser(nextUser);
    try {
      if (nextToken && nextUser) {
        window.localStorage.setItem(TOKEN_KEY, nextToken);
        window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
      }
    } catch {
      /* storage unavailable */
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email, password);
    if (!data?.token) throw new ApiError('Login did not return a token', 500);
    persist(data.token, data.user);
    setLoginOpen(false);
  }, []);

  const logout = useCallback(async () => {
    const current = token;
    persist(null, null);
    setLoginOpen(false);
    if (current) await logoutRequest(current);
  }, [token]);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      token,
      user,
      loginOpen,
      openLogin: () => setLoginOpen(true),
      closeLogin: () => setLoginOpen(false),
      login,
      logout,
    }),
    [ready, token, user, loginOpen, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
