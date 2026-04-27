import type { ApiResponse } from './api';

export interface ActionResult<T = unknown> {
  state: 'success' | 'error';
  message: string;
  nextAction?: ApiResponse['nextAction'];
  data?: T;
}

export async function runAction<T = unknown>(
  apiCall: () => Promise<Response>
): Promise<ActionResult<T>> {
  try {
    const res = await apiCall();
    let body: Partial<ApiResponse<T>> = {};
    try { body = await res.json(); } catch {}

    // Prefer explicit ok field; fall back to HTTP status
    const succeeded = body.ok !== undefined ? body.ok : res.ok;

    if (!succeeded) {
      return { state: 'error', message: body.message || 'Something went wrong' };
    }
    return {
      state: 'success',
      message: body.message || '',
      nextAction: body.nextAction,
      data: body.data,
    };
  } catch {
    return { state: 'error', message: 'Something went wrong' };
  }
}
