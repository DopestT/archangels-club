import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute } from '../db/schema.js';
import { requireAuth, requireCreator } from '../middleware/auth.js';

const router = Router();

const VALID_SOURCES = ['profile', 'drop', 'social', 'invite', 'explore', 'recommendation', 'direct'] as const;

// POST /api/promo/track — log a profile/content view (public, no auth required)
router.post('/track', async (req, res) => {
  try {
    const { creator_id, source, ref_code } = req.body;
    if (!creator_id || typeof creator_id !== 'string') {
      res.status(400).json({ error: 'creator_id required' });
      return;
    }

    const src = VALID_SOURCES.includes(source) ? source : 'direct';

    await execute(
      `INSERT INTO creator_page_views (id, creator_id, source, ref_code)
       VALUES ($1, $2, $3, $4)`,
      [crypto.randomUUID(), creator_id, src, ref_code ?? null]
    );

    if (src === 'invite' && ref_code) {
      await execute(
        `UPDATE creator_invite_links SET click_count = click_count + 1 WHERE invite_code = $1`,
        [ref_code]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[promo] track error:', err);
    res.json({ ok: false });
  }
});

// GET /api/promo/my/stats — creator's promo analytics
router.get('/my/stats', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Profile not found.' }); return; }

    const [viewsRow, bySource, subscribers, unlocks] = await Promise.all([
      queryOne<{ total: string; last_7d: string; last_30d: string }>(
        `SELECT
          COUNT(*)                                                       AS total,
          COUNT(*) FILTER (WHERE viewed_at > NOW() - INTERVAL '7 days') AS last_7d,
          COUNT(*) FILTER (WHERE viewed_at > NOW() - INTERVAL '30 days') AS last_30d
         FROM creator_page_views WHERE creator_id = $1`,
        [profile.id]
      ),
      query<{ source: string; n: string }>(
        `SELECT source, COUNT(*) AS n FROM creator_page_views WHERE creator_id = $1
         GROUP BY source ORDER BY n DESC`,
        [profile.id]
      ),
      queryOne<{ n: string }>(
        `SELECT COUNT(*) AS n FROM subscriptions WHERE creator_id = $1 AND status = 'active'`,
        [profile.id]
      ),
      queryOne<{ n: string }>(
        `SELECT COUNT(*) AS n FROM content_unlocks cu
         JOIN content c ON c.id = cu.content_id WHERE c.creator_id = $1`,
        [profile.id]
      ),
    ]);

    const totalViews = parseInt(viewsRow?.total ?? '0', 10);
    const totalSubs  = parseInt(subscribers?.n ?? '0', 10);
    const conversionRate = totalViews > 0
      ? parseFloat(((totalSubs / totalViews) * 100).toFixed(1))
      : 0;

    const bySourceMap = bySource.reduce<Record<string, number>>((acc, row) => {
      acc[row.source] = parseInt(row.n, 10);
      return acc;
    }, {});

    res.json({
      views: {
        total:   totalViews,
        last_7d:  parseInt(viewsRow?.last_7d  ?? '0', 10),
        last_30d: parseInt(viewsRow?.last_30d ?? '0', 10),
      },
      by_source:       bySourceMap,
      subscribers:     totalSubs,
      unlocks:         parseInt(unlocks?.n ?? '0', 10),
      conversion_rate: conversionRate,
    });
  } catch (err) {
    console.error('[promo] stats error:', err);
    res.status(500).json({ error: 'Failed to fetch promo stats.' });
  }
});

// GET /api/promo/my/invites — list invite links
router.get('/my/invites', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (!profile) { res.json([]); return; }

    const rows = await query(
      `SELECT id, invite_code, label, click_count, created_at
       FROM creator_invite_links WHERE creator_id = $1 ORDER BY created_at DESC`,
      [profile.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invite links.' });
  }
});

// POST /api/promo/my/invites — create invite link
router.post('/my/invites', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Profile not found.' }); return; }

    const count = await queryOne<{ n: string }>(
      'SELECT COUNT(*) AS n FROM creator_invite_links WHERE creator_id = $1',
      [profile.id]
    );
    if (parseInt(count?.n ?? '0', 10) >= 10) {
      res.status(400).json({ error: 'Maximum 10 invite links per creator.' });
      return;
    }

    const { label = 'Invite Link' } = req.body;
    const inviteCode = crypto.randomBytes(6).toString('hex');
    const id = crypto.randomUUID();

    await execute(
      `INSERT INTO creator_invite_links (id, creator_id, invite_code, label)
       VALUES ($1, $2, $3, $4)`,
      [id, profile.id, inviteCode, String(label).slice(0, 60)]
    );

    res.status(201).json({ id, invite_code: inviteCode, label, click_count: 0, created_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invite link.' });
  }
});

// DELETE /api/promo/my/invites/:id — delete invite link
router.delete('/my/invites/:id', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Profile not found.' }); return; }

    const changed = await execute(
      'DELETE FROM creator_invite_links WHERE id = $1 AND creator_id = $2',
      [req.params.id, profile.id]
    );
    if (changed === 0) { res.status(404).json({ error: 'Link not found.' }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invite link.' });
  }
});

export default router;
