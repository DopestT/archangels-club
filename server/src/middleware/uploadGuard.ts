import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

function resolveKey(req: Request): string {
  if (req.auth?.userId) return req.auth.userId;
  const raw = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.ip ?? '';
  return raw.replace(/^::ffff:/i, '') || 'unknown';
}

// 20 upload attempts per 15 minutes per authenticated creator; falls back to IP.
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: resolveKey,
  handler: (req, res) => {
    const key = resolveKey(req);
    console.log(`[media/upload] rate-limit hit | key=${key}`);
    res.status(429).json({
      success: false,
      error: "You're uploading quickly. Please wait a few minutes before trying again.",
    });
  },
  standardHeaders: false,
  legacyHeaders: false,
});

// Max 2 simultaneous uploads per creator (in-memory — clears on restart).
// Multi-instance deployments should move this to Redis.
const active = new Map<string, number>();

export function concurrentUploadGuard(req: Request, res: Response, next: NextFunction): void {
  const id = req.auth?.userId;
  if (!id) { next(); return; }

  const n = active.get(id) ?? 0;
  if (n >= 2) {
    console.log(`[media/upload] concurrent guard triggered | creator=${id} active=${n}`);
    res.status(429).json({
      success: false,
      error: 'You already have uploads in progress. Please wait for them to complete.',
    });
    return;
  }

  active.set(id, n + 1);
  res.on('finish', () => {
    const cur = active.get(id) ?? 1;
    if (cur <= 1) active.delete(id);
    else active.set(id, cur - 1);
  });

  next();
}
