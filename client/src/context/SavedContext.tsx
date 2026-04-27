import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../lib/api';
import { useAuth } from './AuthContext';

interface SavedContextValue {
  savedIds: Set<string>;
  save: (contentId: string) => Promise<void>;
  unsave: (contentId: string) => Promise<void>;
  isSaved: (contentId: string) => boolean;
}

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Load all saved content IDs once after login
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setSavedIds(new Set());
      return;
    }
    fetch(`${API_BASE}/api/content/saved`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((rows: Array<{ id: string }>) => {
        if (Array.isArray(rows)) {
          setSavedIds(new Set(rows.map(r => r.id)));
        }
      })
      .catch(() => {});
  }, [isAuthenticated, token]);

  const save = useCallback(async (contentId: string) => {
    if (!token) return;
    setSavedIds(prev => new Set([...prev, contentId]));
    try {
      await fetch(`${API_BASE}/api/content/${contentId}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setSavedIds(prev => { const next = new Set(prev); next.delete(contentId); return next; });
    }
  }, [token]);

  const unsave = useCallback(async (contentId: string) => {
    if (!token) return;
    setSavedIds(prev => { const next = new Set(prev); next.delete(contentId); return next; });
    try {
      await fetch(`${API_BASE}/api/content/${contentId}/save`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setSavedIds(prev => new Set([...prev, contentId]));
    }
  }, [token]);

  const isSaved = useCallback((contentId: string) => savedIds.has(contentId), [savedIds]);

  return (
    <SavedContext.Provider value={{ savedIds, save, unsave, isSaved }}>
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used within SavedProvider');
  return ctx;
}
