import { nanoid } from 'nanoid';
import { execute } from '../db/client.js';

export type EventType =
  | 'view_creator'
  | 'view_content'
  | 'search'
  | 'unlock_content'
  | 'subscribe_creator'
  | 'unsubscribe_creator'
  | 'save_content'
  | 'unsave_content'
  | 'send_message'
  | 'send_tip'
  | 'submit_custom_request'
  | 'login'
  | 'signup'
  | 'apply_creator'
  | 'publish_content'
  | 'page_view';

interface LogEventOpts {
  userId?: string | null;
  sessionId?: string | null;
  eventType: EventType | string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logEvent(opts: LogEventOpts): Promise<void> {
  try {
    await execute(
      `INSERT INTO platform_events (id, user_id, session_id, event_type, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        nanoid(),
        opts.userId ?? null,
        opts.sessionId ?? null,
        opts.eventType,
        opts.entityType ?? null,
        opts.entityId ?? null,
        JSON.stringify(opts.metadata ?? {}),
      ]
    );
  } catch {
    // Event logging must never crash the calling request
  }
}

type SignalType = 'view' | 'unlock' | 'subscribe' | 'message' | 'tip' | 'save' | 'custom_request';

const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  view: 0.5,
  unlock: 3.0,
  subscribe: 5.0,
  message: 2.0,
  tip: 4.0,
  save: 1.5,
  custom_request: 4.0,
};

export async function recordSignal(
  userId: string,
  creatorProfileId: string,
  signalType: SignalType
): Promise<void> {
  try {
    const weight = SIGNAL_WEIGHTS[signalType] ?? 1.0;
    await execute(
      `INSERT INTO engagement_signals (id, user_id, creator_id, signal_type, weight)
       VALUES ($1, $2, $3, $4, $5)`,
      [nanoid(), userId, creatorProfileId, signalType, weight]
    );
  } catch {
    // Non-fatal
  }
}
