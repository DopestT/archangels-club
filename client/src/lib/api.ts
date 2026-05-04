export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export interface NextAction {
  label: string;
  href?: string;
  action?: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  message: string;
  code?: string;
  data?: T;
  nextAction?: NextAction;
}

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
