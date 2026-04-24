import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User, UserRole, UserStatus } from '../types';
import { currentUser, currentCreatorUser } from '../data/seed';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  userStatus: UserStatus | null;
  isPending: boolean;
  isApproved: boolean;
  login: (role?: UserRole, status?: UserStatus) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((role: UserRole = 'fan', status: UserStatus = 'approved') => {
    if (role === 'creator' || role === 'both') {
      setUser({ ...currentCreatorUser, role, status });
    } else if (role === 'admin') {
      setUser({ ...currentUser, role: 'admin', status: 'approved', display_name: 'Admin User' });
    } else {
      setUser({ ...currentUser, role, status });
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const isCreator = user?.role === 'creator' || user?.role === 'both';
  const isAdmin = user?.role === 'admin';
  const userStatus = user?.status ?? null;
  const isPending = userStatus === 'pending';
  const isApproved = userStatus === 'approved';

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
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
