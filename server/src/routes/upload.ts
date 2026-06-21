import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, requireCreator } from '../middleware/auth.js';
import { requireFlag } from '../middleware/featureGate.js';
import { queryOne } from '../db/schema.js';

const router = Router();

// POST /api/upload/sign — generate Cloudinary signature for direct client upload
// Note: new uploads should use POST /api/media/upload instead.
// This endpoint remains for compatibility. Type is 'upload' (public delivery)
// so that preview_url thumbnails are accessible without signing.
router.post('/sign', requireAuth, requireCreator, requireFlag('enable_creator_uploads'), async (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    res.status(500).json({ error: 'Storage not configured.' });
    return;
  }

  // Look up creator profile for per-creator folder structure
  let creatorFolder = 'archangels/creators/shared';
  try {
    const profile = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (profile) {
      const resourceType = (req.body?.resource_type as string) || 'image';
      const subFolder    = resourceType === 'video' ? 'videos' : resourceType === 'raw' ? 'audio' : 'images';
      creatorFolder = `archangels/creators/${profile.id}/${subFolder}`;
    }
  } catch {
    // Use shared fallback — don't fail the request
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder    = creatorFolder;

  // No type= in signature → defaults to 'upload' (public CDN delivery)
  // This ensures preview_url thumbnails load without signed URLs
  const toSign    = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  res.json({ signature, timestamp, api_key: apiKey, cloud_name: cloudName, folder });
});

export default router;
