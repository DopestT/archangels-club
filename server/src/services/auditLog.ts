import { randomUUID } from 'crypto';
import { execute, query, queryOne } from '../db/schema.js';

export type AuditAction =
  | 'creator_approved'
  | 'creator_rejected'
  | 'creator_changes_requested'
  | 'creator_status_changed'
  | 'creator_suspended'
  | 'upload_approved'
  | 'upload_rejected'
  | 'upload_changes_requested'
  | 'upload_removed'
  | 'upload_status_changed'
  | 'user_status_changed'
  | 'user_role_granted'
  | 'live_room_ended_by_admin'
  | 'live_chat_deleted_by_admin'
  | 'payout_request_reviewed';

export type AuditTargetType =
  | 'creator_profile'
  | 'user'
  | 'content'
  | 'live_room'
  | 'live_chat_message'
  | 'payout_request';

export interface AuditLogEntry {
  id: string;
  actor_admin_id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  previous_state: string | null;
  new_state: string | null;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface WriteAuditOpts {
  actorAdminId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  previousState?: string | null;
  newState?: string | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function extractReqMeta(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): { ipAddress: string | null; userAgent: string | null } {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  const ip = raw?.trim() ?? (req.ip ?? null);
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;
  return { ipAddress: ip ?? null, userAgent: ua };
}

export async function writeAuditLog(opts: WriteAuditOpts): Promise<void> {
  try {
    const adminRow = await queryOne<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [opts.actorAdminId]
    );
    await execute(
      `INSERT INTO admin_audit_logs
         (id, actor_admin_id, actor_email, action, target_type, target_id,
          previous_state, new_state, reason, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        randomUUID(),
        opts.actorAdminId,
        adminRow?.email ?? null,
        opts.action,
        opts.targetType,
        opts.targetId,
        opts.previousState ?? null,
        opts.newState ?? null,
        opts.reason ?? null,
        opts.ipAddress ?? null,
        opts.userAgent ?? null,
      ]
    );
  } catch (err) {
    console.error('[auditLog] write error:', err);
  }
}

export async function getAuditLogs(filters: {
  action?: string;
  targetType?: string;
  targetId?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (filters.action) {
    conditions.push(`action = $${idx++}`);
    values.push(filters.action);
  }
  if (filters.targetType) {
    conditions.push(`target_type = $${idx++}`);
    values.push(filters.targetType);
  }
  if (filters.targetId) {
    conditions.push(`target_id = $${idx++}`);
    values.push(filters.targetId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(filters.limit ?? 100, 500);
  const offset = filters.offset ?? 0;

  return query<AuditLogEntry>(
    `SELECT id, actor_admin_id, actor_email, action, target_type, target_id,
            previous_state, new_state, reason, ip_address, user_agent, created_at
       FROM admin_audit_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
    values
  );
}
