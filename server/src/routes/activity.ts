import { Router } from 'express';
import { query } from '../db/schema.js';

const router = Router();

// GET /api/activity/recent — anonymized recent transactions for social proof
router.get('/recent', async (_req, res) => {
  try {
    const rows = await query(`
      SELECT
        t.ref_type,
        t.created_at,
        c.title       AS content_title,
        u.display_name AS creator_name
      FROM transactions t
      LEFT JOIN content c ON c.id = t.ref_id AND t.ref_type = 'content'
      LEFT JOIN users u ON u.id = t.payee_id
      WHERE t.status = 'completed'
        AND t.created_at >= NOW() - INTERVAL '48 hours'
      ORDER BY t.created_at DESC
      LIMIT 20
    `, []);
    res.json(rows);
  } catch (err) {
    console.error('[activity] recent error:', err);
    res.status(500).json({ error: 'Failed to fetch activity.' });
  }
});

export default router;
