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

export function ok<T>(message: string, data?: T, opts?: { code?: string; nextAction?: NextAction }): ApiResponse<T> {
  return { ok: true, message, ...(data !== undefined ? { data } : {}), ...opts };
}

export function fail(message: string, code?: string): ApiResponse {
  return { ok: false, message, ...(code ? { code } : {}) };
}
