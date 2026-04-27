/// <reference types="vite/client" />

// Production: calls Railway directly. Dev: Vite proxy forwards /api → localhost:4000.
export const API_BASE: string = import.meta.env.PROD
  ? 'https://archangels-club-production.up.railway.app'
  : '';

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('arc_auth');
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  return res.json();
}
