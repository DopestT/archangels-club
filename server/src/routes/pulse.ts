import { Router } from 'express';
import { requireAuth, requireAdmin, requireCreator } from '../middleware/auth.js';
import { query, queryOne } from '../db/client.js';
import { computeCreatorHealth, getCreatorHealth, getAllCreatorHealthScores } from '../services/creatorHealth.js';

const router = Router();

// ── Admin: Platform-wide Pulse ───────────────────────────────────────────────

// GET /api/pulse/platform — aggregate platform stats for admin dashboard
router.get('/platform', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [users, revenue, content, subscriptions, events] = await Promise.all([
      queryOne<{ total: string; approved: string; creators: string; new_7d: string }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'approved') AS approved,
           COUNT(*) FILTER (WHERE role IN ('creator','both') AND status = 'approved') AS creators,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_7d
         FROM users`
      ),
      queryOne<{ total_cents: string; last_30d_cents: string; last_7d_cents: string }>(
        `SELECT
           COALESCE(SUM(amount * 100), 0)::bigint AS total_cents,
           COALESCE(SUM(amount * 100) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0)::bigint AS last_30d_cents,
           COALESCE(SUM(amount * 100) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::bigint AS last_7d_cents
         FROM transactions WHERE status = 'completed'`
      ),
      queryOne<{ total: string; approved: string; pending_review: string }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'approved') AS approved,
           COUNT(*) FILTER (WHERE status = 'pending_review') AS pending_review
         FROM content`
      ),
      queryOne<{ active: string; new_30d: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'active') AS active,
           COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '30 days') AS new_30d
         FROM subscriptions`
      ),
      queryOne<{ count_7d: string }>(
        `SELECT COUNT(*) AS count_7d
         FROM platform_events WHERE created_at >= NOW() - INTERVAL '7 days'`
      ),
    ]);

    res.json({
      users,
      revenue,
      content,
      subscriptions,
      events,
    });
  } catch (err) {
    console.error('[pulse] platform error:', err);
    res.status(500).json({ error: 'Failed to load platform pulse.' });
  }
});

// GET /api/pulse/creators — all creator health scores (admin)
router.get('/creators', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const scores = await getAllCreatorHealthScores();
    res.json({ creators: scores });
  } catch (err) {
    console.error('[pulse] creators error:', err);
    res.status(500).json({ error: 'Failed to load creator health scores.' });
  }
});

// POST /api/pulse/creators/:profileId/refresh — recompute health for one creator (admin)
router.post('/creators/:profileId/refresh', requireAuth, requireAdmin, async (req, res) => {
  try {
    const profileId = req.params.profileId as string;
    await computeCreatorHealth({ creatorProfileId: profileId });
    const score = await getCreatorHealth(profileId);
    res.json({ ok: true, score });
  } catch (err) {
    console.error('[pulse] refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh health score.' });
  }
});

// ── Creator: Own health score ────────────────────────────────────────────────

// GET /api/pulse/my-health — creator's own health score
router.get('/my-health', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      `SELECT id FROM creator_profiles WHERE user_id = $1`,
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Creator profile not found.' }); return; }

    // Recompute if stale (older than 1 hour) or missing
    const existing = await getCreatorHealth(profile.id);
    const stale = !existing ||
      new Date(existing.computed_at).getTime() < Date.now() - 60 * 60 * 1000;

    if (stale) await computeCreatorHealth({ creatorProfileId: profile.id });

    const score = await getCreatorHealth(profile.id);
    res.json({ score });
  } catch (err) {
    console.error('[pulse] my-health error:', err);
    res.status(500).json({ error: 'Failed to load health score.' });
  }
});

// GET /api/pulse/my-stats — 30-day daily stats for the authenticated creator
router.get('/my-stats', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      `SELECT id FROM creator_profiles WHERE user_id = $1`,
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Creator profile not found.' }); return; }

    const daily = await query(
      `SELECT stat_date, views, unlocks, new_subscribers, revenue_cents, messages_received
       FROM creator_daily_stats
       WHERE creator_id = $1 AND stat_date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY stat_date DESC`,
      [profile.id]
    );

    res.json({ daily });
  } catch (err) {
    console.error('[pulse] my-stats error:', err);
    res.status(500).json({ error: 'Failed to load creator stats.' });
  }
});

export default router;
