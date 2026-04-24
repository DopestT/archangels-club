import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getUserNotifications, getUnreadCount, markAsRead,
  markAllAsRead, deleteNotification, getPreferences, updatePreferences,
} from '../services/notifications.js';

const router = Router();
router.use(requireAuth);

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const [items, unread] = await Promise.all([getUserNotifications(userId, limit), getUnreadCount(userId)]);
    res.json({ notifications: items, unread });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const count = await getUnreadCount(req.auth!.userId);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count.' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  try {
    const changed = await markAllAsRead(req.auth!.userId);
    res.json({ changed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all read.' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    const ok = await markAsRead(req.params.id, req.auth!.userId);
    if (!ok) { res.status(404).json({ error: 'Notification not found' }); return; }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read.' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await deleteNotification(req.params.id, req.auth!.userId);
    if (!ok) { res.status(404).json({ error: 'Notification not found' }); return; }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification.' });
  }
});

// GET /api/notifications/preferences
router.get('/preferences', async (req, res) => {
  try {
    res.json(await getPreferences(req.auth!.userId));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch preferences.' });
  }
});

// PATCH /api/notifications/preferences
router.patch('/preferences', async (req, res) => {
  try {
    const allowed = [
      'email_enabled', 'sms_enabled', 'in_app_enabled',
      'email_new_content', 'email_drops', 'email_purchases', 'email_weekly_summary',
      'sms_drops', 'sms_major_events',
    ];
    const update: Record<string, boolean> = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = Boolean(req.body[key]);
    }
    res.json(await updatePreferences(req.auth!.userId, update));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences.' });
  }
});

export default router;
