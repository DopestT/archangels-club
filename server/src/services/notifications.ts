import { db } from '../db/schema.js';
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

// ─── Create ───────────────────────────────────────────────────────────────────

export function createInAppNotification(opts: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
}): Notification {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, channel, title, message, action_label, action_url, status)
    VALUES (?, ?, ?, 'in_app', ?, ?, ?, ?, 'unread')
  `).run(id, opts.userId, opts.type, opts.title, opts.message, opts.actionLabel ?? null, opts.actionUrl ?? null);

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

export function getUserNotifications(userId: string, limit = 50): Notification[] {
  return db.prepare(`
    SELECT id, user_id, type, title, message, action_label, action_url, status, created_at
    FROM notifications
    WHERE user_id = ? AND channel = 'in_app'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit) as Notification[];
}

export function getUnreadCount(userId: string): number {
  const row = db.prepare(`
    SELECT COUNT(*) as n FROM notifications
    WHERE user_id = ? AND channel = 'in_app' AND status = 'unread'
  `).get(userId) as { n: number };
  return row.n;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function markAsRead(notificationId: string, userId: string): boolean {
  const result = db.prepare(`
    UPDATE notifications SET status = 'read'
    WHERE id = ? AND user_id = ? AND channel = 'in_app'
  `).run(notificationId, userId);
  return result.changes > 0;
}

export function markAllAsRead(userId: string): number {
  const result = db.prepare(`
    UPDATE notifications SET status = 'read'
    WHERE user_id = ? AND channel = 'in_app' AND status = 'unread'
  `).run(userId);
  return result.changes;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteNotification(notificationId: string, userId: string): boolean {
  const result = db.prepare(`
    DELETE FROM notifications WHERE id = ? AND user_id = ?
  `).run(notificationId, userId);
  return result.changes > 0;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

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

export function getPreferences(userId: string): NotificationPreferences {
  const row = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(userId) as any;
  if (!row) {
    // Insert defaults and return them
    db.prepare(`
      INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)
    `).run(userId);
    return {
      user_id: userId,
      email_enabled: true, sms_enabled: false, in_app_enabled: true,
      email_new_content: true, email_drops: true, email_purchases: true,
      email_weekly_summary: true, sms_drops: true, sms_major_events: true,
    };
  }
  return {
    ...row,
    email_enabled: !!row.email_enabled, sms_enabled: !!row.sms_enabled,
    in_app_enabled: !!row.in_app_enabled, email_new_content: !!row.email_new_content,
    email_drops: !!row.email_drops, email_purchases: !!row.email_purchases,
    email_weekly_summary: !!row.email_weekly_summary, sms_drops: !!row.sms_drops,
    sms_major_events: !!row.sms_major_events,
  };
}

export function updatePreferences(userId: string, prefs: Partial<Omit<NotificationPreferences, 'user_id'>>): NotificationPreferences {
  db.prepare(`INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)`).run(userId);

  const fields = Object.entries(prefs)
    .map(([k]) => `${k} = ?`)
    .join(', ');
  const values = Object.values(prefs).map(v => (typeof v === 'boolean' ? (v ? 1 : 0) : v));

  if (fields) {
    db.prepare(`UPDATE notification_preferences SET ${fields}, updated_at = datetime('now') WHERE user_id = ?`)
      .run(...values, userId);
  }
  return getPreferences(userId);
}
