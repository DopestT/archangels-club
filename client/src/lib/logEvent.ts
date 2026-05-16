import { API_BASE } from './api';

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('arc_auth');
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

// Deduplicate: suppress repeated events for the same entity within 60s
const _seen = new Map<string, number>();

interface LogEventOpts {
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}

export function logEvent(opts: LogEventOpts): void {
  const key = `${opts.event_type}:${opts.entity_type ?? ''}:${opts.entity_id ?? ''}`;
  const now = Date.now();
  const last = _seen.get(key) ?? 0;
  if (now - last < 60_000) return;
  _seen.set(key, now);

  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(opts),
  }).catch(() => {});
}
