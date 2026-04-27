import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { queryOne } from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'archangels_dev_secret_change_in_production';

export interface AuthPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY) {
    req.auth = { userId: 'admin', role: 'admin' };
    console.log('[auth] admin-key bypass, role=admin');
    next();
    return;
  }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    console.log('[auth] missing or malformed Authorization header');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    console.log(`[auth] token valid — userId=${payload.userId} role=${payload.role}`);
    req.auth = payload;
    next();
  } catch (err) {
    console.log('[auth] token verification failed:', (err as Error).message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export function requireCreator(req: Request, res: Response, next: NextFunction) {
  if (!['creator', 'both', 'admin'].includes(req.auth?.role ?? '')) {
    res.status(403).json({ error: 'Creator access required' });
    return;
  }
  next();
}

export async function requireApproved(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role === 'admin') { next(); return; }
  try {
    const user = await queryOne<{ status: string }>(
      'SELECT status FROM users WHERE id = $1',
      [req.auth!.userId]
    );
    if (!user || user.status !== 'approved') {
      res.status(403).json({ error: 'Account not yet approved.', status: user?.status ?? 'unknown' });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAgeVerified(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role === 'admin') { next(); return; }
  try {
    const user = await queryOne<{ status: string; age_verification_status: string }>(
      'SELECT status, age_verification_status FROM users WHERE id = $1',
      [req.auth!.userId]
    );
    if (!user || user.status !== 'approved') {
      res.status(403).json({ error: 'Account not yet approved.', status: user?.status ?? 'unknown' });
      return;
    }
    if (user.age_verification_status !== 'verified') {
      res.status(403).json({
        error: 'Age verification required before making purchases.',
        age_verification_status: user.age_verification_status,
        code: 'age_verification_required',
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
