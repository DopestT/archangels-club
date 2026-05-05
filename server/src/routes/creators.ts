import { Router } from 'express';
import crypto from 'crypto';
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

// GET /api/creators/stats — public platform stats for landing page
router.get('/stats', async (_req, res) => {
  try {
    const [creators, members, content] = await Promise.all([
      queryOne<{ n: string }>(`SELECT COUNT(*) as n FROM creator_profiles WHERE is_approved = 1`),
      queryOne<{ n: string }>(`SELECT COUNT(*) as n FROM users WHERE status = 'approved'`),
      queryOne<{ n: string }>(`SELECT COUNT(*) as n FROM content WHERE status = 'approved'`),
    ]);
    res.json({
      creator_count: parseInt(creators?.n ?? '0'),
      member_count: parseInt(members?.n ?? '0'),
      content_count: parseInt(content?.n ?? '0'),
    });
  } catch {
    res.json({ creator_count: 0, member_count: 0, content_count: 0 });
  }
});

// POST /api/creators/apply — authenticated user submits creator application
router.post('/apply', requireAuth, async (req, res) => {
  try {
    const { bio, tags, categories, subscription_price, starting_price, pitch } = req.body;

    if (!bio || String(bio).trim().length < 10) {
      res.status(400).json({ error: 'Bio is required (min 10 characters).' });
      return;
    }

    // Prevent duplicates
    const existing = await queryOne<{ id: string; application_status: string }>(
      'SELECT id, application_status FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (existing) {
      res.status(409).json({
        error: 'You already have a creator application.',
        id: existing.id,
        status: existing.application_status,
      });
      return;
    }

    const id = crypto.randomUUID();
    const tagsArr = Array.isArray(tags)
      ? tags
      : String(tags ?? '').split(',').map((t: string) => t.trim()).filter(Boolean);
    const catsArr = Array.isArray(categories) ? categories : [];

    await execute(
      `INSERT INTO creator_profiles
         (id, user_id, bio, tags, content_categories, subscription_price, starting_price, pitch, application_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
      [id, req.auth!.userId, String(bio).trim(),
       JSON.stringify(tagsArr), JSON.stringify(catsArr),
       parseFloat(subscription_price) || 9.99,
       parseFloat(starting_price) || 4.99,
       String(pitch ?? '').trim()]
    );

    console.log(`[creator/apply] application submitted userId=${req.auth!.userId} profileId=${id}`);
    res.status(201).json({ success: true, id, status: 'pending' });
  } catch (err) {
    console.error('[creator/apply] error:', err);
    res.status(500).json({ error: 'Failed to submit application.' });
  }
});

// GET /api/creators/my/stats — creator's own stats (must be before /:username)
router.get('/my/stats', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string; total_earnings: string }>(
      'SELECT id, total_earnings FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Creator profile not found.' }); return; }

    const [subs, unlocks, tips, posts] = await Promise.all([
      queryOne<{ n: string }>(
        `SELECT COUNT(*) as n FROM subscriptions WHERE creator_id = $1 AND status = 'active'`,
        [profile.id]
      ),
      queryOne<{ n: string; total: string }>(
        `SELECT COUNT(*) as n, COALESCE(SUM(net_amount), 0) as total
         FROM transactions WHERE payee_id = $1 AND ref_type = 'content' AND status = 'completed'`,
        [req.auth!.userId]
      ),
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(net_amount), 0) as total
         FROM transactions WHERE payee_id = $1 AND ref_type = 'tip' AND status = 'completed'`,
        [req.auth!.userId]
      ),
      queryOne<{ n: string }>(
        `SELECT COUNT(*) as n FROM content WHERE creator_id = $1`,
        [profile.id]
      ),
    ]);

    res.json({
      total_earnings: parseFloat(profile.total_earnings) || 0,
      subscriber_count: parseInt(subs?.n ?? '0', 10),
      content_unlocks: parseInt(unlocks?.n ?? '0', 10),
      tips_total: parseFloat(tips?.total ?? '0'),
      content_count: parseInt(posts?.n ?? '0', 10),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// GET /api/creators/my/transactions — creator's recent earnings (must be before /:username)
router.get('/my/transactions', requireAuth, requireCreator, async (req, res) => {
  try {
    const rows = await query(`
      SELECT t.id, t.ref_type, t.amount, t.net_amount, t.created_at,
             payer.display_name as payer_name,
             c.title as content_title
      FROM transactions t
      JOIN users payer ON payer.id = t.payer_id
      LEFT JOIN content c ON c.id = t.ref_id AND t.ref_type = 'content'
      WHERE t.payee_id = $1 AND t.status = 'completed'
      ORDER BY t.created_at DESC
      LIMIT 20
    `, [req.auth!.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

// GET /api/creators/my/requests — creator's custom requests (must be before /:username)
router.get('/my/requests', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1', [req.auth!.userId]
    );
    if (!profile) { res.json([]); return; }

    const rows = await query(`
      SELECT cr.id, cr.description, cr.offered_price, cr.status, cr.created_at,
             u.display_name as fan_name, u.avatar_url as fan_avatar
      FROM custom_requests cr
      JOIN users u ON u.id = cr.fan_id
      WHERE cr.creator_id = $1
      ORDER BY cr.created_at DESC
      LIMIT 20
    `, [profile.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests.' });
  }
});

// GET /api/creators/:username
router.get('/:username', async (req, res) => {
  try {
    const slug = req.params.username.toLowerCase();
    console.log('[creator lookup]', slug);

    const row = await queryOne<any>(`
      SELECT cp.*, u.display_name, u.username, u.avatar_url, u.is_verified_creator,
        (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') as subscriber_count,
        (SELECT COUNT(*) FROM content c WHERE c.creator_id = cp.id AND c.status = 'approved') as content_count
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE LOWER(u.username) = $1
         OR LOWER(REPLACE(u.display_name, ' ', '')) = $1
    `, [slug]);

    if (!row) {
      console.log('[creator lookup] not found:', slug);
      res.status(404).json({
        error: 'Creator not found',
        slug,
        hint: 'Check /api/debug/creators to see all creator slugs in the database',
      });
      return;
    }
    res.json({ ...row, tags: JSON.parse(row.tags ?? '[]') });
  } catch (err) {
    console.error('[creator lookup] error:', err);
    res.status(500).json({ error: 'Failed to fetch creator.' });
  }
});

// GET /api/creators/:username/content
router.get('/:username/content', async (req, res) => {
  try {
    const slug = req.params.username.toLowerCase();
    const creator = await queryOne<any>(`
      SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id
      WHERE LOWER(u.username) = $1 OR LOWER(REPLACE(u.display_name, ' ', '')) = $1
    `, [slug]);

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

// GET /api/creators/:username/similar — other approved creators ordered by subscribers
router.get('/:username/similar', async (req, res) => {
  try {
    const slug = req.params.username.toLowerCase();
    const creator = await queryOne<{ id: string }>(
      `SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id
       WHERE LOWER(u.username) = $1 OR LOWER(REPLACE(u.display_name, ' ', '')) = $1`,
      [slug]
    );
    if (!creator) { res.json([]); return; }

    const rows = await query<any>(`
      SELECT cp.id, cp.subscription_price, cp.starting_price, cp.tags,
             u.display_name, u.username, u.avatar_url, u.is_verified_creator,
             (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') as subscriber_count
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.is_approved = 1 AND cp.id != $1
      ORDER BY subscriber_count DESC
      LIMIT 4
    `, [creator.id]);

    res.json(rows.map((r: any) => ({ ...r, tags: JSON.parse(r.tags ?? '[]') })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch similar creators.' });
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
