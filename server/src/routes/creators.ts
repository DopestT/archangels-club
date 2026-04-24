import { Router } from 'express';
import { db } from '../db/schema.js';
import { requireAuth, requireCreator } from '../middleware/auth.js';

const router = Router();

// GET /api/creators — list approved creators
router.get('/', (req, res) => {
  const { tag, sort = 'popular', q } = req.query;

  let sql = `
    SELECT cp.*, u.display_name, u.username, u.avatar_url, u.is_verified_creator,
      (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') as subscriber_count,
      (SELECT COUNT(*) FROM content c WHERE c.creator_id = cp.id AND c.status = 'published') as content_count
    FROM creator_profiles cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.is_approved = 1
  `;

  const params: unknown[] = [];

  if (q) {
    sql += ` AND (u.display_name LIKE ? OR cp.bio LIKE ? OR u.username LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (tag) {
    sql += ` AND cp.tags LIKE ?`;
    params.push(`%${tag}%`);
  }

  const orderMap: Record<string, string> = {
    popular: 'subscriber_count DESC',
    newest: 'cp.created_at DESC',
    'price-low': 'cp.subscription_price ASC',
    'price-high': 'cp.subscription_price DESC',
  };
  sql += ` ORDER BY ${orderMap[sort as string] ?? 'subscriber_count DESC'}`;

  const rows = db.prepare(sql).all(...params) as any[];
  res.json(rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) })));
});

// GET /api/creators/:username
router.get('/:username', (req, res) => {
  const row = db.prepare(`
    SELECT cp.*, u.display_name, u.username, u.avatar_url, u.is_verified_creator,
      (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') as subscriber_count,
      (SELECT COUNT(*) FROM content c WHERE c.creator_id = cp.id AND c.status = 'published') as content_count
    FROM creator_profiles cp
    JOIN users u ON u.id = cp.user_id
    WHERE u.username = ?
  `).get(req.params.username) as any;

  if (!row) { res.status(404).json({ error: 'Creator not found' }); return; }
  res.json({ ...row, tags: JSON.parse(row.tags) });
});

// GET /api/creators/:username/content
router.get('/:username/content', (req, res) => {
  const creator = db.prepare(`
    SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id WHERE u.username = ?
  `).get(req.params.username) as any;

  if (!creator) { res.status(404).json({ error: 'Creator not found' }); return; }

  const rows = db.prepare(`
    SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar
    FROM content c
    JOIN creator_profiles cp ON cp.id = c.creator_id
    JOIN users u ON u.id = cp.user_id
    WHERE c.creator_id = ? AND c.status = 'published'
    ORDER BY c.created_at DESC
  `).all(creator.id);

  res.json(rows);
});

// PATCH /api/creators/profile — update own profile
router.patch('/profile', requireAuth, requireCreator, (req, res) => {
  const { bio, cover_image_url, tags, subscription_price, starting_price } = req.body;

  const profile = db.prepare(`
    SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id WHERE u.id = ?
  `).get(req.auth!.userId) as any;

  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

  db.prepare(`
    UPDATE creator_profiles SET
      bio = COALESCE(?, bio),
      cover_image_url = COALESCE(?, cover_image_url),
      tags = COALESCE(?, tags),
      subscription_price = COALESCE(?, subscription_price),
      starting_price = COALESCE(?, starting_price)
    WHERE id = ?
  `).run(bio, cover_image_url, tags ? JSON.stringify(tags) : null, subscription_price, starting_price, profile.id);

  res.json({ success: true });
});

export default router;
