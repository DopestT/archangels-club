import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getUserNotifications, getUnreadCount, markAsRead,
  markAllAsRead, deleteNotification, getPreferences, updatePreferences,
} from '../services/notifications.js';

const router = Router();
router.use(requireAuth);

// GET /api/notifications — paginated list
router.get('/', (req, res) => {
  const userId = (req as any).userId as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const items = getUserNotifications(userId, limit);
  res.json({ notifications: items, unread: getUnreadCount(userId) });
});

// GET /api/notifications/unread-count — badge count only
router.get('/unread-count', (req, res) => {
  const userId = (req as any).userId as string;
  res.json({ count: getUnreadCount(userId) });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', (req, res) => {
  const userId = (req as any).userId as string;
  const changed = markAllAsRead(userId);
  res.json({ changed });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', (req, res) => {
  const userId = (req as any).userId as string;
  const ok = markAsRead(req.params.id, userId);
  if (!ok) return res.status(404).json({ error: 'Notification not found' });
  res.json({ ok: true });
});

// DELETE /api/notifications/:id
router.delete('/:id', (req, res) => {
  const userId = (req as any).userId as string;
  const ok = deleteNotification(req.params.id, userId);
  if (!ok) return res.status(404).json({ error: 'Notification not found' });
  res.json({ ok: true });
});

// GET /api/notifications/preferences
router.get('/preferences', (req, res) => {
  const userId = (req as any).userId as string;
  res.json(getPreferences(userId));
});

// PATCH /api/notifications/preferences
router.patch('/preferences', (req, res) => {
  const userId = (req as any).userId as string;
  const allowed = [
    'email_enabled', 'sms_enabled', 'in_app_enabled',
    'email_new_content', 'email_drops', 'email_purchases', 'email_weekly_summary',
    'sms_drops', 'sms_major_events',
  ];
  const update: Record<string, boolean> = {};
  for (const key of allowed) {
    if (key in req.body) update[key] = Boolean(req.body[key]);
  }
  res.json(updatePreferences(userId, update));
});

export default router;
