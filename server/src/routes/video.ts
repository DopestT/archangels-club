import { Router } from 'express';
import { requireAuth, requireApproved } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/video/process
 *
 * Stub for server-side FFmpeg processing. In production this would:
 *   1. Accept multipart upload (the raw file + VideoProcessingConfig JSON)
 *   2. Run: ffmpeg -ss <trimStart> -to <trimEnd> -i input -c:v libx264 -b:v <bitrate>
 *            [-vf "setpts=2.0*PTS"] output.mp4
 *   3. Extract thumbnail frame at trimStart if none supplied
 *   4. Upload processed file + thumbnail to object storage
 *   5. Return { mediaUrl, thumbnailUrl }
 *
 * For the demo the client handles trim/thumbnail in-browser; this endpoint
 * returns mock URLs so the upload flow is complete end-to-end.
 */
router.post('/process', requireAuth, requireApproved, (req, res) => {
  const { trimStart, trimEnd, quality, slowMotion } = req.body as {
    trimStart?: number;
    trimEnd?: number;
    quality?: 'high' | 'standard' | 'compact';
    slowMotion?: boolean;
  };

  const BITRATES = { high: '4M', standard: '2M', compact: '1M' } as const;
  const bitrate = BITRATES[quality ?? 'standard'];
  const duration = (trimEnd ?? 30) - (trimStart ?? 0);
  const effectiveDuration = slowMotion ? duration * 2 : duration;

  res.json({
    mediaUrl: `/media/processed_${Date.now()}.mp4`,
    thumbnailUrl: `/media/thumb_${Date.now()}.jpg`,
    meta: { bitrate, effectiveDuration: Math.round(effectiveDuration) },
  });
});

export default router;
