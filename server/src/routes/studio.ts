import { Router } from 'express';
import { signStudioToken } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/studio/token
 * Service-to-service: the external live studio's backend calls this (with the
 * shared STUDIO_API_KEY) to mint a short-lived token its frontend can use to
 * connect to the gift socket and listen for `gift:sent` in a room.
 *
 * Guarded by STUDIO_API_KEY — if that env var is unset, the bridge is disabled.
 */
router.post('/token', (req, res) => {
  const expected = process.env.STUDIO_API_KEY;
  if (!expected) {
    res.status(503).json({ error: 'Studio token bridge is not configured.' });
    return;
  }

  const provided = req.header('X-Studio-Key');
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Invalid studio key.' });
    return;
  }

  const { room_id } = req.body as { room_id?: string };
  if (!room_id || typeof room_id !== 'string') {
    res.status(400).json({ error: 'room_id is required.' });
    return;
  }

  const token = signStudioToken(room_id);
  res.json({ token, expires_in: 7200 });
});

export default router;
