import type { Request, Response, NextFunction } from 'express';
import { getFlag, type FlagKey } from '../services/featureFlags.js';

export function requireFlag(key: FlagKey) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const enabled = await getFlag(key);
    if (!enabled) {
      res.status(503).json({
        disabled: true,
        feature: key,
        code: 'feature_disabled',
        message: 'This feature is temporarily unavailable. Please check back soon.',
      });
      return;
    }
    next();
  };
}
