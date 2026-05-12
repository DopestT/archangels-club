import { Router } from 'express';
import { requireAuth, requireApproved } from '../middleware/auth.js';

const router = Router();

// POST /api/video/process — deprecated
// Video uploads are handled via POST /api/media/upload (unified media endpoint).
// This endpoint returns 410 Gone so any stale client code fails clearly.
router.post('/process', requireAuth, requireApproved, (_req, res) => {
  res.status(410).json({
    error: 'This endpoint is no longer available. Upload video through /api/media/upload.',
  });
});

export default router;
