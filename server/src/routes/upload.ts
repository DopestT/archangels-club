import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, requireCreator } from '../middleware/auth.js';

const router = Router();

// POST /api/upload/sign — generate Cloudinary signature for direct client upload
router.post('/sign', requireAuth, requireCreator, (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    res.status(500).json({ error: 'Storage not configured.' });
    return;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder    = 'archangels';

  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  res.json({ signature, timestamp, api_key: apiKey, cloud_name: cloudName, folder });
});

export default router;
