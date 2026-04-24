import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/messages — conversations for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    // DISTINCT ON is PostgreSQL-specific and correctly gets the last message per conversation
    const rows = await query(`
      WITH last_messages AS (
        SELECT DISTINCT ON (
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END
        )
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS partner_id,
          content AS last_message,
          created_at AS last_message_at
        FROM messages
        WHERE sender_id = $1 OR receiver_id = $1
        ORDER BY
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END,
          created_at DESC
      )
      SELECT
        lm.partner_id,
        u.display_name AS partner_name,
        u.avatar_url AS partner_avatar,
        lm.last_message,
        lm.last_message_at,
        (
          SELECT COUNT(*) FROM messages
          WHERE receiver_id = $1 AND sender_id = lm.partner_id AND read_at IS NULL
        ) AS unread_count
      FROM last_messages lm
      JOIN users u ON u.id = lm.partner_id
      ORDER BY lm.last_message_at DESC
    `, [userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// GET /api/messages/:partnerId — thread
router.get('/:partnerId', requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;

    await execute(
      'UPDATE messages SET read_at = NOW() WHERE receiver_id = $1 AND sender_id = $2 AND read_at IS NULL',
      [userId, req.params.partnerId]
    );

    const rows = await query(`
      SELECT m.*, u.display_name AS sender_name, u.avatar_url AS sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [userId, req.params.partnerId]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch thread.' });
  }
});

// POST /api/messages — send message
router.post('/', requireAuth, async (req, res) => {
  try {
    const { receiver_id, content, custom_request_id } = req.body;
    if (!receiver_id || !content?.trim()) {
      res.status(400).json({ error: 'receiver_id and content are required.' });
      return;
    }
    const id = crypto.randomUUID();
    await execute(
      'INSERT INTO messages (id, sender_id, receiver_id, content, custom_request_id) VALUES ($1, $2, $3, $4, $5)',
      [id, req.auth!.userId, receiver_id, content.trim(), custom_request_id ?? null]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// POST /api/messages/custom-request — send a custom content request
router.post('/custom-request', requireAuth, async (req, res) => {
  try {
    const { creator_id, description, offered_price } = req.body;
    if (!creator_id || !description || offered_price === undefined) {
      res.status(400).json({ error: 'creator_id, description, and offered_price are required.' });
      return;
    }
    const id = crypto.randomUUID();
    await execute(
      'INSERT INTO custom_requests (id, fan_id, creator_id, description, offered_price) VALUES ($1, $2, $3, $4, $5)',
      [id, req.auth!.userId, creator_id, description, offered_price]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create custom request.' });
  }
});

// PATCH /api/messages/custom-request/:id — creator updates request status
router.patch('/custom-request/:id', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['accepted', 'rejected', 'completed', 'cancelled'];
    if (!valid.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
      return;
    }
    await execute('UPDATE custom_requests SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update request.' });
  }
});

export default router;
