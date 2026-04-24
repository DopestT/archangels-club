import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/messages — conversations for current user
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT
      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as partner_id,
      u.display_name as partner_name,
      u.avatar_url as partner_avatar,
      m.content as last_message,
      m.created_at as last_message_at,
      (SELECT COUNT(*) FROM messages unread WHERE unread.receiver_id = ? AND unread.sender_id = partner_id AND unread.read_at IS NULL) as unread_count
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
    WHERE m.sender_id = ? OR m.receiver_id = ?
    GROUP BY partner_id
    ORDER BY m.created_at DESC
  `).all(req.auth!.userId, req.auth!.userId, req.auth!.userId, req.auth!.userId, req.auth!.userId);

  res.json(rows);
});

// GET /api/messages/:partnerId — thread
router.get('/:partnerId', requireAuth, (req, res) => {
  db.prepare(`UPDATE messages SET read_at = datetime('now') WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL`)
    .run(req.auth!.userId, req.params.partnerId);

  const rows = db.prepare(`
    SELECT m.*, u.display_name as sender_name, u.avatar_url as sender_avatar
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
  `).all(req.auth!.userId, req.params.partnerId, req.params.partnerId, req.auth!.userId);

  res.json(rows);
});

// POST /api/messages — send message
router.post('/', requireAuth, (req, res) => {
  const { receiver_id, content, custom_request_id } = req.body;
  if (!receiver_id || !content?.trim()) {
    res.status(400).json({ error: 'receiver_id and content are required.' });
    return;
  }
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO messages (id, sender_id, receiver_id, content, custom_request_id) VALUES (?, ?, ?, ?, ?)`)
    .run(id, req.auth!.userId, receiver_id, content.trim(), custom_request_id ?? null);

  res.status(201).json({ id });
});

// POST /api/messages/custom-request — send a custom content request
router.post('/custom-request', requireAuth, (req, res) => {
  const { creator_id, description, offered_price } = req.body;
  if (!creator_id || !description || offered_price === undefined) {
    res.status(400).json({ error: 'creator_id, description, and offered_price are required.' });
    return;
  }
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO custom_requests (id, fan_id, creator_id, description, offered_price) VALUES (?, ?, ?, ?, ?)`)
    .run(id, req.auth!.userId, creator_id, description, offered_price);

  res.status(201).json({ id });
});

// PATCH /api/messages/custom-request/:id — creator updates request status
router.patch('/custom-request/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  const valid = ['accepted', 'rejected', 'completed', 'cancelled'];
  if (!valid.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    return;
  }
  db.prepare(`UPDATE custom_requests SET status = ? WHERE id = ?`).run(status, req.params.id);
  res.json({ success: true });
});

export default router;
