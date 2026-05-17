import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import {
  getCreatorRecommendations,
  getTrendingContent,
  getSimilarCreators,
} from '../services/recommendations.js';
import { getMemberRecommendationSections } from '../services/memberRecommendations.js';

const router = Router();

// GET /api/recommendations/creators — personalized creator picks for the authed user
router.get('/creators', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string ?? '8', 10), 20);
    const creators = await getCreatorRecommendations(req.auth!.userId, limit);
    res.json({ creators });
  } catch (err) {
    console.error('[recs] creators error:', err);
    res.status(500).json({ error: 'Failed to load recommendations.' });
  }
});

// GET /api/recommendations/trending — trending content (anonymous-safe)
router.get('/trending', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string ?? '12', 10), 24);
    const content = await getTrendingContent(limit);
    res.json({ content });
  } catch (err) {
    console.error('[recs] trending error:', err);
    res.status(500).json({ error: 'Failed to load trending content.' });
  }
});

// GET /api/recommendations/similar/:profileId — creators similar to a given profile
router.get('/similar/:profileId', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string ?? '5', 10), 10);
    const creators = await getSimilarCreators(req.params.profileId as string, limit);
    res.json({ creators });
  } catch (err) {
    console.error('[recs] similar error:', err);
    res.status(500).json({ error: 'Failed to load similar creators.' });
  }
});

// GET /api/recommendations/member — all 7 recommendation sections for a member
// Global sections are served from cache; user-specific sections run fresh per user.
// Empty sections are omitted. Safe to call on every dashboard load.
router.get('/member', requireAuth, async (req, res) => {
  try {
    const sections = await getMemberRecommendationSections(req.auth!.userId);
    res.json({ sections });
  } catch (err) {
    console.error('[recs] member error:', err);
    res.status(500).json({ error: 'Failed to load recommendations.', sections: [] });
  }
});

export default router;
