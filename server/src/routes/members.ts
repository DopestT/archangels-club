import { Router } from 'express';
import { query, queryOne } from '../db/schema.js';
import { requireAuth, requireApproved } from '../middleware/auth.js';

const router = Router();

// GET /api/members/my/stats
router.get('/my/stats', requireAuth, requireApproved, async (req, res) => {
  try {
    const [unlocked, subscriptions, messages, spent] = await Promise.all([
      queryOne<{ n: string }>(
        'SELECT COUNT(*) as n FROM content_unlocks WHERE user_id = $1',
        [req.auth!.userId]
      ),
      queryOne<{ n: string }>(
        "SELECT COUNT(*) as n FROM subscriptions WHERE subscriber_id = $1 AND status = 'active' AND expires_at > NOW()",
        [req.auth!.userId]
      ),
      queryOne<{ n: string }>(
        'SELECT COUNT(*) as n FROM messages WHERE receiver_id = $1 AND read_at IS NULL',
        [req.auth!.userId]
      ),
      queryOne<{ total: string }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE payer_id = $1 AND status = 'completed'",
        [req.auth!.userId]
      ),
    ]);

    res.json({
      unlocked_count:      parseInt(unlocked?.n ?? '0', 10),
      subscription_count:  parseInt(subscriptions?.n ?? '0', 10),
      unread_messages:     parseInt(messages?.n ?? '0', 10),
      total_spent:         parseFloat(spent?.total ?? '0'),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch member stats.' });
  }
});

// GET /api/members/my/unlocked — paginated unlocked content
router.get('/my/unlocked', requireAuth, requireApproved, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const rows = await query<any>(`
      SELECT c.*, u.display_name as creator_name, u.username as creator_username,
             u.avatar_url as creator_avatar, cp.subscription_price as creator_subscription_price,
             (SELECT COUNT(*) FROM content_unlocks cu WHERE cu.content_id = c.id)::int as unlock_count,
             cu.unlocked_at
      FROM content_unlocks cu
      JOIN content c ON c.id = cu.content_id
      JOIN creator_profiles cp ON cp.id = c.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE cu.user_id = $1
      ORDER BY cu.unlocked_at DESC
      LIMIT $2 OFFSET $3
    `, [req.auth!.userId, limit, offset]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unlocked content.' });
  }
});

// GET /api/members/my/subscriptions — active subscriptions with creator info
router.get('/my/subscriptions', requireAuth, requireApproved, async (req, res) => {
  try {
    const rows = await query<any>(`
      SELECT s.id, s.status, s.started_at, s.expires_at,
             cp.id as creator_id, u.display_name, u.username, u.avatar_url,
             cp.subscription_price, cp.bio
      FROM subscriptions s
      JOIN creator_profiles cp ON cp.id = s.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE s.subscriber_id = $1 AND s.status = 'active' AND s.expires_at > NOW()
      ORDER BY s.started_at DESC
    `, [req.auth!.userId]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscriptions.' });
  }
});

export default router;
