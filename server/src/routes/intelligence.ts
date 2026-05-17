import { Router } from 'express';
import { requireAuth, requireAdmin, requireCreator } from '../middleware/auth.js';
import { queryOne } from '../db/client.js';
import { computeCreatorInsights, computeAdminIntelligence } from '../services/intelligence.js';

const router = Router();

// ── Creator: coaching cards for authenticated creator ────────────────────────

// GET /api/intelligence/my-insights
// Returns coaching cards based on the creator's real signal data.
// Results are computed fresh each call — lightweight enough for on-demand use.
router.get('/my-insights', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      `SELECT id FROM creator_profiles WHERE user_id = $1`,
      [req.auth!.userId]
    );
    if (!profile) {
      res.status(404).json({ error: 'Creator profile not found.' });
      return;
    }

    const insights = await computeCreatorInsights(profile.id);
    res.json({ insights });
  } catch (err) {
    console.error('[intelligence] my-insights error:', err);
    res.status(500).json({ error: 'Failed to compute insights.' });
  }
});

// ── Admin: platform-wide intelligence ───────────────────────────────────────

// GET /api/intelligence/admin-summary
// Full platform intelligence summary: needing support, high-potential, trending,
// inactive, moderation pressure, revenue signals.
router.get('/admin-summary', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const summary = await computeAdminIntelligence();
    res.json(summary);
  } catch (err) {
    console.error('[intelligence] admin-summary error:', err);
    res.status(500).json({ error: 'Failed to compute admin intelligence.' });
  }
});

// GET /api/intelligence/creator/:profileId
// Per-creator coaching cards accessible by admin (for support view).
router.get('/creator/:profileId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const profileId = req.params.profileId as string;
    const exists = await queryOne<{ id: string }>(
      `SELECT id FROM creator_profiles WHERE id = $1`,
      [profileId]
    );
    if (!exists) {
      res.status(404).json({ error: 'Creator not found.' });
      return;
    }

    const insights = await computeCreatorInsights(profileId);
    res.json({ creator_id: profileId, insights });
  } catch (err) {
    console.error('[intelligence] creator insights error:', err);
    res.status(500).json({ error: 'Failed to compute creator insights.' });
  }
});

export default router;
