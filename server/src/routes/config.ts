import { Router } from 'express';
import { getAllFlags, setFlag, ALL_FLAGS, FLAG_DESCRIPTIONS, type FlagKey } from '../services/featureFlags.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/config/flags — public; clients poll this to render feature-gated UI
router.get('/flags', async (_req, res) => {
  try {
    const flags = await getAllFlags();
    res.json({ flags });
  } catch (err) {
    console.error('[config/flags] error:', err);
    // On error return all-enabled so the client never silently blocks features
    const fallback = Object.fromEntries(ALL_FLAGS.map((k) => [k, true]));
    res.json({ flags: fallback });
  }
});

// PATCH /api/config/flags/:key — admin only hot-toggle
router.patch('/flags/:key', requireAuth, requireAdmin, async (req, res) => {
  const key = req.params.key as FlagKey;
  if (!ALL_FLAGS.includes(key)) {
    res.status(400).json({ error: `Unknown flag: ${key}` });
    return;
  }
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled must be a boolean' });
    return;
  }
  try {
    await setFlag(key, enabled);
    console.log(`[config/flags] ${key} → ${enabled} by admin ${req.auth!.userId}`);
    res.json({ ok: true, key, enabled, description: FLAG_DESCRIPTIONS[key] });
  } catch (err) {
    console.error('[config/flags] set error:', err);
    res.status(500).json({ error: 'Failed to update flag' });
  }
});

export default router;
