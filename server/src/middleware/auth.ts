import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { queryOne } from '../db/schema.js';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET ?? 'archangels_dev_secret_change_in_production';

export interface AuthPayload {
  userId: string;
  role: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPayload;
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

// Admin key brute-force guard: 5 attempts/minute/IP
const _adminKeyAttempts = new Map<string, { count: number; resetAt: number }>();
function isAdminKeyRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = _adminKeyAttempts.get(ip);
  if (!record || now > record.resetAt) {
    _adminKeyAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  record.count++;
  return record.count > 5;
}

// Attaches auth payload if a valid token is present; never blocks the request.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.auth = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload;
    } catch { /* anonymous — req.auth stays undefined */ }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && process.env.ADMIN_KEY) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.ip ?? '';
    if (isAdminKeyRateLimited(clientIp)) {
      res.status(429).json({ error: 'Too many admin key attempts — try again in a minute' });
      return;
    }
    if (adminKey === process.env.ADMIN_KEY) {
      req.auth = { userId: 'admin', role: 'admin' };
      console.log('[auth] admin-key bypass, role=admin');
      next();
      return;
    }
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

export async function requireCreator(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role === 'admin') { next(); return; }
  // Re-query DB role so newly-approved creators can access endpoints before re-login
  try {
    const user = await queryOne<{ role: string; status: string }>(
      'SELECT role, status FROM users WHERE id = $1',
      [req.auth!.userId]
    );
    if (!user || !['creator', 'both'].includes(user.role) || user.status !== 'approved') {
      res.status(403).json({ error: 'Creator access required' });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
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
