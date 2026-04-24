import { Router } from 'express';
import { query, queryOne, execute } from '../db/schema.js';
import { requireAuth, requireCreator } from '../middleware/auth.js';

const router = Router();

// GET /api/creators — list approved creators
router.get('/', async (req, res) => {
  try {
    const { tag, sort = 'popular', q } = req.query;

    let sql = `
      SELECT cp.*, u.display_name, u.username, u.avatar_url, u.is_verified_creator,
        (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') as subscriber_count,
        (SELECT COUNT(*) FROM content c WHERE c.creator_id = cp.id AND c.status = 'approved') as content_count
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.is_approved = 1
    `;

    const params: unknown[] = [];
    let idx = 1;

    if (q) {
      sql += ` AND (u.display_name ILIKE $${idx} OR cp.bio ILIKE $${idx + 1} OR u.username ILIKE $${idx + 2})`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      idx += 3;
    }

    if (tag) {
      sql += ` AND cp.tags ILIKE $${idx}`;
      params.push(`%${tag}%`);
      idx++;
    }

    const orderMap: Record<string, string> = {
      popular: 'subscriber_count DESC',
      newest: 'cp.created_at DESC',
      'price-low': 'cp.subscription_price ASC',
      'price-high': 'cp.subscription_price DESC',
    };
    sql += ` ORDER BY ${orderMap[sort as string] ?? 'subscriber_count DESC'}`;

    const rows = await query<any>(sql, params);
    res.json(rows.map((r) => ({ ...r, tags: JSON.parse(r.tags ?? '[]') })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch creators.' });
  }
});

// GET /api/creators/:username
router.get('/:username', async (req, res) => {
  try {
    const row = await queryOne<any>(`
      SELECT cp.*, u.display_name, u.username, u.avatar_url, u.is_verified_creator,
        (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') as subscriber_count,
        (SELECT COUNT(*) FROM content c WHERE c.creator_id = cp.id AND c.status = 'approved') as content_count
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE u.username = $1
    `, [req.params.username]);

    if (!row) { res.status(404).json({ error: 'Creator not found' }); return; }
    res.json({ ...row, tags: JSON.parse(row.tags ?? '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch creator.' });
  }
});

// GET /api/creators/:username/content
router.get('/:username/content', async (req, res) => {
  try {
    const creator = await queryOne<any>(`
      SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id WHERE u.username = $1
    `, [req.params.username]);

    if (!creator) { res.status(404).json({ error: 'Creator not found' }); return; }

    const rows = await query(`
      SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar
      FROM content c
      JOIN creator_profiles cp ON cp.id = c.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE c.creator_id = $1 AND c.status = 'approved'
      ORDER BY c.created_at DESC
    `, [creator.id]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch creator content.' });
  }
});

// PATCH /api/creators/profile — update own profile
router.patch('/profile', requireAuth, requireCreator, async (req, res) => {
  try {
    const { bio, cover_image_url, tags, subscription_price, starting_price } = req.body;

    const profile = await queryOne<any>(`
      SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id WHERE u.id = $1
    `, [req.auth!.userId]);

    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

    await execute(`
      UPDATE creator_profiles SET
        bio = COALESCE($1, bio),
        cover_image_url = COALESCE($2, cover_image_url),
        tags = COALESCE($3, tags),
        subscription_price = COALESCE($4, subscription_price),
        starting_price = COALESCE($5, starting_price)
      WHERE id = $6
    `, [bio ?? null, cover_image_url ?? null,
        tags ? JSON.stringify(tags) : null,
        subscription_price ?? null, starting_price ?? null,
        profile.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
