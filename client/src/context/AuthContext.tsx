import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, UserStatus } from '../types';
import { API_BASE } from '../lib/api';

const STORAGE_KEY = 'arc_auth';

interface StoredAuth { token: string; user: User }

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  userStatus: UserStatus | null;
  isPending: boolean;
  isApproved: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored: StoredAuth = JSON.parse(raw);
        setUser(stored.user);
        setToken(stored.token);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server error (HTTP ${res.status}). Please try again.`);
    }

    if (!res.ok) throw new Error(data.error ?? 'Login failed. Please try again.');

    const stored: StoredAuth = { token: data.token, user: data.user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setUser(data.user);
    setToken(data.token);
    return data.user as User;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const isCreator = user?.role === 'creator' || user?.role === 'both';
  const isAdmin = user?.role === 'admin';
  const userStatus = (user?.status as UserStatus) ?? null;
  const isPending = userStatus === 'pending';
  const isApproved = userStatus === 'approved';

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user,
      isAuthLoading,
      isCreator,
      isAdmin,
      userStatus,
      isPending,
      isApproved,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
