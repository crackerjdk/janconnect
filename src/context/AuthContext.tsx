import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, setInMemoryToken } from '../services/api';
import type { RuntimeHealth, UserProfile } from '../types/civic';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  health: RuntimeHealth | null;
  refreshUser: () => Promise<void>;
  setSession: (token: string | null, user: UserProfile | null) => void;
  logout: () => Promise<void>;
  isModerator: boolean;
  isAdministrator: boolean;
  isGovernmentAuthority: boolean;
  isFinancialAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<RuntimeHealth | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const [meRes, healthRes] = await Promise.all([
        apiFetch<{ user: UserProfile | null }>('/api/auth/me'),
        apiFetch<RuntimeHealth>('/api/health'),
      ]);
      setUser(meRes.user);
      setHealth(healthRes);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const setSession = useCallback((token: string | null, nextUser: UserProfile | null) => {
    setInMemoryToken(token);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setInMemoryToken(null);
      setUser(null);
    }
  }, []);

  const isModerator = Boolean(user?.roles.includes('moderator') || user?.roles.includes('administrator'));
  const isAdministrator = Boolean(user?.roles.includes('administrator'));
  const isGovernmentAuthority = Boolean(user?.roles.includes('government_authority'));
  const isFinancialAdmin = Boolean(user?.roles.includes('financial_admin') || user?.roles.includes('administrator'));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        health,
        refreshUser,
        setSession,
        logout,
        isModerator,
        isAdministrator,
        isGovernmentAuthority,
        isFinancialAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
