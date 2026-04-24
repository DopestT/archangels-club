import { query, queryOne, execute } from '../db/schema.js';
import { randomUUID } from 'crypto';

export type NotificationType =
  | 'creator_welcome'
  | 'creator_first_post_reminder'
  | 'creator_first_post'
  | 'creator_first_sale'
  | 'creator_inactivity'
  | 'creator_weekly_summary'
  | 'creator_drop_reminder'
  | 'creator_drop_live'
  | 'user_welcome'
  | 'user_new_content'
  | 'user_drop_alert'
  | 'user_inactivity'
  | 'user_purchase'
  | 'user_scarcity_alert';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_label: string | null;
  action_url: string | null;
  status: 'unread' | 'read';
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  email_new_content: boolean;
  email_drops: boolean;
  email_purchases: boolean;
  email_weekly_summary: boolean;
  sms_drops: boolean;
  sms_major_events: boolean;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createInAppNotification(opts: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
}): Promise<Notification> {
  const id = randomUUID();
  await execute(
    `INSERT INTO notifications (id, user_id, type, channel, title, message, action_label, action_url, status)
     VALUES ($1, $2, $3, 'in_app', $4, $5, $6, $7, 'unread')`,
    [id, opts.userId, opts.type, opts.title, opts.message, opts.actionLabel ?? null, opts.actionUrl ?? null]
  );
  return {
    id,
    user_id: opts.userId,
    type: opts.type,
    title: opts.title,
    message: opts.message,
    action_label: opts.actionLabel ?? null,
    action_url: opts.actionUrl ?? null,
    status: 'unread',
    created_at: new Date().toISOString(),
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
  return query<Notification>(
    `SELECT id, user_id, type, title, message, action_label, action_url, status, created_at
     FROM notifications
     WHERE user_id = $1 AND channel = 'in_app'
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
}

export async function getUnreadCount(userId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND channel = 'in_app' AND status = 'unread'`,
    [userId]
  );
  return parseInt(row?.n ?? '0', 10);
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const changed = await execute(
    `UPDATE notifications SET status = 'read' WHERE id = $1 AND user_id = $2 AND channel = 'in_app'`,
    [notificationId, userId]
  );
  return changed > 0;
}

export async function markAllAsRead(userId: string): Promise<number> {
  return execute(
    `UPDATE notifications SET status = 'read' WHERE user_id = $1 AND channel = 'in_app' AND status = 'unread'`,
    [userId]
  );
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteNotification(notificationId: string, userId: string): Promise<boolean> {
  const changed = await execute(
    'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
  return changed > 0;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

function toPrefs(row: any): NotificationPreferences {
  return {
    user_id: row.user_id,
    email_enabled: !!row.email_enabled,
    sms_enabled: !!row.sms_enabled,
    in_app_enabled: !!row.in_app_enabled,
    email_new_content: !!row.email_new_content,
    email_drops: !!row.email_drops,
    email_purchases: !!row.email_purchases,
    email_weekly_summary: !!row.email_weekly_summary,
    sms_drops: !!row.sms_drops,
    sms_major_events: !!row.sms_major_events,
  };
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const row = await queryOne<any>(
    'SELECT * FROM notification_preferences WHERE user_id = $1',
    [userId]
  );
  if (!row) {
    await execute(
      `INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [userId]
    );
    return {
      user_id: userId,
      email_enabled: true, sms_enabled: false, in_app_enabled: true,
      email_new_content: true, email_drops: true, email_purchases: true,
      email_weekly_summary: true, sms_drops: true, sms_major_events: true,
    };
  }
  return toPrefs(row);
}

export async function updatePreferences(
  userId: string,
  prefs: Partial<Omit<NotificationPreferences, 'user_id'>>
): Promise<NotificationPreferences> {
  await execute(
    `INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [userId]
  );

  if (Object.keys(prefs).length > 0) {
    let i = 1;
    const fields = Object.keys(prefs).map((k) => `${k} = $${i++}`).join(', ');
    const values = [
      ...Object.values(prefs).map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)),
      userId,
    ];
    await execute(
      `UPDATE notification_preferences SET ${fields}, updated_at = NOW() WHERE user_id = $${i}`,
      values
    );
  }
  return getPreferences(userId);
}
