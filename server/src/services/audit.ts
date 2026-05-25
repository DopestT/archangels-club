import crypto from 'crypto';
import { execute } from '../db/schema.js';

export interface AuditEventParams {
  eventType: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  status?: 'success' | 'failure' | 'pending';
  metadata?: Record<string, unknown>;
}

/**
 * Append a row to audit_log. Non-fatal — log errors are never allowed to crash
 * the calling request. Always call with .catch() or inside a try/catch.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO audit_log
       (id, event_type, actor_user_id, target_user_id, entity_type, entity_id, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      params.eventType,
      params.actorUserId ?? null,
      params.targetUserId ?? null,
      params.entityType ?? null,
      params.entityId ?? null,
      params.status ?? 'success',
      JSON.stringify(params.metadata ?? {}),
    ]
  );
}
