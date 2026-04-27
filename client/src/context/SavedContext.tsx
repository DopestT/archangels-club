import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../lib/api';
import { useAuth } from './AuthContext';

interface SavedContextValue {
  savedIds: Set<string>;
  save: (contentId: string) => Promise<Response>;
  unsave: (contentId: string) => Promise<Response>;
  isSaved: (contentId: string) => boolean;
}

const SavedContext = createContext<SavedContextValue | null>(null);

function synth(ok: boolean, message: string): Response {
  return new Response(JSON.stringify({ ok, message }), { status: ok ? 200 : 400 });
}

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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

  const save = useCallback(async (contentId: string): Promise<Response> => {
    if (!token) return synth(false, 'Sign in to save');
    setSavedIds(prev => new Set([...prev, contentId]));
    try {
      const res = await fetch(`${API_BASE}/api/content/${contentId}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setSavedIds(prev => { const n = new Set(prev); n.delete(contentId); return n; });
        return synth(false, 'Failed to save');
      }
      return synth(true, 'Saved');
    } catch {
      setSavedIds(prev => { const n = new Set(prev); n.delete(contentId); return n; });
      return synth(false, 'Failed to save');
    }
  }, [token]);

  const unsave = useCallback(async (contentId: string): Promise<Response> => {
    if (!token) return synth(false, 'Sign in to save');
    setSavedIds(prev => { const n = new Set(prev); n.delete(contentId); return n; });
    try {
      const res = await fetch(`${API_BASE}/api/content/${contentId}/save`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setSavedIds(prev => new Set([...prev, contentId]));
        return synth(false, 'Failed');
      }
      return synth(true, 'Unsaved');
    } catch {
      setSavedIds(prev => new Set([...prev, contentId]));
      return synth(false, 'Failed');
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
