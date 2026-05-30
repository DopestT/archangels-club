import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute } from '../db/schema.js';
import { requireAuth, requireApproved, requireAdmin } from '../middleware/auth.js';

const router = Router();

// POST /api/reviews — submit a review (must have unlocked or be subscribed)
router.post('/', requireAuth, requireApproved, async (req, res) => {
  const { content_id, rating, body } = req.body;
  const userId = req.auth!.userId;

  if (!content_id || typeof content_id !== 'string') {
    res.status(400).json({ error: 'content_id is required.' });
    return;
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    res.status(400).json({ error: 'rating must be an integer between 1 and 5.' });
    return;
  }

  // Check access: unlocked OR active subscription to the creator
  const [unlocked, subscribed] = await Promise.all([
    queryOne<{ id: string }>(
      'SELECT id FROM content_unlocks WHERE content_id = $1 AND fan_id = $2',
      [content_id, userId]
    ),
    queryOne<{ id: string }>(
      `SELECT s.id FROM subscriptions s
       JOIN content c ON c.creator_id = s.creator_id
       WHERE c.id = $1 AND s.subscriber_id = $2
         AND s.expires_at > NOW() AND s.status = 'active'`,
      [content_id, userId]
    ),
  ]);

  if (!unlocked && !subscribed) {
    res.status(403).json({ error: 'You must unlock this content or subscribe to the creator before leaving a review.' });
    return;
  }

  const id = crypto.randomUUID();
  try {
    await execute(
      `INSERT INTO content_reviews (id, content_id, reviewer_id, rating, body, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [id, content_id, userId, ratingNum, (body ?? '').trim()]
    );
    res.status(201).json({ id, status: 'pending' });
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ error: 'You have already submitted a review for this content.' });
      return;
    }
    console.error('[reviews] insert error:', err);
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

// GET /api/reviews/:contentId — public, approved reviews only
router.get('/:contentId', async (req, res) => {
  const { contentId } = req.params;
  try {
    const rows = await query<{
      id: string;
      rating: number;
      body: string;
      created_at: string;
      display_name: string;
      avatar_url: string | null;
    }>(
      `SELECT cr.id, cr.rating, cr.body, cr.created_at,
              u.display_name, u.avatar_url
       FROM content_reviews cr
       JOIN users u ON u.id = cr.reviewer_id
       WHERE cr.content_id = $1 AND cr.status = 'approved'
       ORDER BY cr.created_at DESC`,
      [contentId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[reviews] fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// GET /api/reviews/admin/pending — admin: all pending reviews
router.get('/admin/pending', requireAdmin, async (_req, res) => {
  try {
    const rows = await query<{
      id: string;
      rating: number;
      body: string;
      created_at: string;
      content_title: string;
      display_name: string;
      avatar_url: string | null;
    }>(
      `SELECT cr.id, cr.rating, cr.body, cr.created_at,
              c.title as content_title,
              u.display_name, u.avatar_url
       FROM content_reviews cr
       JOIN content c ON c.id = cr.content_id
       JOIN users u ON u.id = cr.reviewer_id
       WHERE cr.status = 'pending'
       ORDER BY cr.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[reviews] admin fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch pending reviews.' });
  }
});

// POST /api/reviews/admin/:id/approve — admin: approve a review
router.post('/admin/:id/approve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const count = await execute(
      `UPDATE content_reviews SET status = 'approved' WHERE id = $1 AND status = 'pending'`,
      [id]
    );
    if (count === 0) {
      res.status(404).json({ error: 'Review not found or already processed.' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[reviews] approve error:', err);
    res.status(500).json({ error: 'Failed to approve review.' });
  }
});

// POST /api/reviews/admin/:id/reject — admin: reject a review
router.post('/admin/:id/reject', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const count = await execute(
      `UPDATE content_reviews SET status = 'rejected' WHERE id = $1 AND status = 'pending'`,
      [id]
    );
    if (count === 0) {
      res.status(404).json({ error: 'Review not found or already processed.' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[reviews] reject error:', err);
    res.status(500).json({ error: 'Failed to reject review.' });
  }
});

export default router;
