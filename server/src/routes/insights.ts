import { Router } from 'express';
import { requireAuth, requireAdmin, requireCreator } from '../middleware/auth.js';
import { queryOne } from '../db/client.js';
import { getCreatorCoachingInsights, getAdminIntelligenceSummaries } from '../services/creatorInsights.js';

const router = Router();

// GET /api/insights/creator/coaching — rules-based coaching cards for the logged-in creator
router.get('/creator/coaching', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      `SELECT id FROM creator_profiles WHERE user_id = $1`,
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Creator profile not found.' }); return; }

    const insights = await getCreatorCoachingInsights(req.auth!.userId, profile.id);
    res.json({ insights });
  } catch (err) {
    console.error('[insights] creator/coaching error:', err);
    res.status(500).json({ error: 'Failed to compute coaching insights.' });
  }
});

// GET /api/insights/admin/summaries — intelligence summaries for the admin dashboard
router.get('/admin/summaries', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const summaries = await getAdminIntelligenceSummaries();
    res.json({ summaries });
  } catch (err) {
    console.error('[insights] admin/summaries error:', err);
    res.status(500).json({ error: 'Failed to compute admin summaries.' });
  }
});

export default router;
