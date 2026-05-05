import { Router } from 'express';
import { sendTestEmail } from '../services/email.js';

const router = Router();

// GET /api/email/test?to=you@example.com
router.get('/test', async (req, res) => {
  const to = String(req.query.to ?? '');
  if (!to || !to.includes('@')) {
    res.status(400).json({ success: false, error: 'Provide a valid ?to= email address.' });
    return;
  }
  try {
    const result = await sendTestEmail(to);
    res.json({ success: result.ok, messageId: result.messageId ?? null, error: result.error ?? null });
  } catch (err) {
    console.error('[email/test] threw:', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
