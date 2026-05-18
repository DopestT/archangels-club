import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, UserStatus, AgeVerificationStatus } from '../types';
import { API_BASE } from '../lib/api';

const STORAGE_KEY = 'arc_auth';

interface StoredAuth { token: string; user: User }

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isCreator: boolean;
  isVerifiedCreator: boolean;
  isAdmin: boolean;
  userStatus: UserStatus | null;
  isPending: boolean;
  isApproved: boolean;
  ageVerificationStatus: AgeVerificationStatus | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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

    console.log('[login] response status:', res.status);

    let data: any;
    try {
      data = await res.json();
      console.log('[login] response body:', data);
    } catch {
      throw new Error('Unable to sign in. Please try again.');
    }

    if (!res.ok) throw new Error(data.error ?? 'Login failed. Please try again.');

    const stored: StoredAuth = { token: data.token, user: data.user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setUser(data.user);
    setToken(data.token);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const { token: storedToken } = JSON.parse(raw) as StoredAuth;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (!res.ok) return;
      // /api/auth/me returns the user object directly (not nested under .user)
      const freshUser = await res.json() as User;
      if (freshUser?.id) {
        const updated: StoredAuth = { token: storedToken, user: freshUser };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setUser(freshUser);
      }
    } catch {}
  }, []);

  const isCreator = user?.role === 'creator' || user?.role === 'both';
  const isVerifiedCreator = user?.is_verified_creator === true;
  const isAdmin = user?.role === 'admin';
  const userStatus = (user?.status as UserStatus) ?? null;
  const isPending = userStatus === 'pending';
  const isApproved = userStatus === 'approved';
  const ageVerificationStatus = (user?.age_verification_status as AgeVerificationStatus) ?? null;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user,
      isAuthLoading,
      isCreator,
      isVerifiedCreator,
      isAdmin,
      userStatus,
      isPending,
      isApproved,
      ageVerificationStatus,
      login,
      logout,
      refreshUser,
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
