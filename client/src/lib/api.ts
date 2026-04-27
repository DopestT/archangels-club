/// <reference types="vite/client" />

// In dev the Vite proxy forwards /api → localhost:4000.
// In production set VITE_API_URL=https://your-server-url (no trailing slash).
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

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
