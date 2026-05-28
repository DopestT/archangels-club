import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';
import { queryOne } from '../db/schema.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'archangels_dev_secret_change_in_production';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface StreamTokenPayload {
  type: 'stream';
  contentId: string;
  userId: string;
  role: string;
}

// Extract resource_type and public_id from a Cloudinary private-delivery URL
function parsePrivateCloudinaryUrl(url: string): { resourceType: string; publicId: string } | null {
  // https://res.cloudinary.com/{cloud}/{resource_type}/private/v{version}/{public_id.ext}
  const match = url.match(/res\.cloudinary\.com\/[^/]+\/([^/]+)\/private\/v\d+\/(.+)/);
  if (!match) return null;
  return { resourceType: match[1], publicId: match[2] };
}

// GET /api/stream/:token — validate JWT, re-check DB access, 302 to Cloudinary URL
router.get('/:token', async (req, res) => {
  let payload: StreamTokenPayload;
  try {
    const raw = jwt.verify(req.params.token, JWT_SECRET) as StreamTokenPayload;
    if (raw.type !== 'stream') throw new Error('wrong token type');
    payload = raw;
  } catch {
    res.status(401).json({ error: 'Invalid or expired stream token.' });
    return;
  }

  try {
    const content = await queryOne<any>(
      `SELECT c.id, c.access_type, c.creator_id, c.media_url, cp.user_id AS creator_user_id
       FROM content c
       JOIN creator_profiles cp ON cp.id = c.creator_id
       WHERE c.id = $1`,
      [payload.contentId]
    );

    if (!content?.media_url) {
      res.status(404).json({ error: 'Content not found.' });
      return;
    }

    const isAdmin   = payload.role === 'admin';
    const isCreator = content.creator_user_id === payload.userId;

    if (!isAdmin && !isCreator && content.access_type !== 'free') {
      if (content.access_type === 'subscribers') {
        const sub = await queryOne<{ id: string }>(
          `SELECT id FROM subscriptions
           WHERE subscriber_id = $1 AND creator_id = $2
             AND expires_at > NOW() AND status IN ('active','cancelled')`,
          [payload.userId, content.creator_id]
        );
        if (!sub) { res.status(403).json({ error: 'Subscription required.' }); return; }
      }

      if (content.access_type === 'locked') {
        const unlock = await queryOne(
          'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
          [payload.userId, payload.contentId]
        );
        if (!unlock) { res.status(403).json({ error: 'Content not unlocked.' }); return; }
      }
    }

    // For private-type Cloudinary assets, generate a signed expiring URL
    const privateMatch = parsePrivateCloudinaryUrl(content.media_url);
    if (privateMatch) {
      const signedUrl = cloudinary.url(privateMatch.publicId, {
        resource_type: privateMatch.resourceType as 'image' | 'video' | 'raw',
        type: 'private',
        sign_url: true,
        expires_at: Math.round(Date.now() / 1000) + 900, // 15 min
      });
      res.redirect(302, signedUrl);
      return;
    }

    // Public (type: upload) assets: access already validated, redirect to raw URL
    res.redirect(302, content.media_url);
  } catch (err) {
    console.error('[stream] error:', err);
    res.status(500).json({ error: 'Failed to stream content.' });
  }
});

export default router;
