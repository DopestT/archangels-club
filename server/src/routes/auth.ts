import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, execute } from '../db/schema.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, username, password, display_name, date_of_birth, reason_for_joining } = req.body;

    if (!email || !username || !password || !display_name) {
      res.status(400).json({ error: 'All fields are required.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const existing = await queryOne(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing) {
      res.status(409).json({ error: 'Email or username already taken.' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();

    await execute(
      `INSERT INTO users (id, email, username, password_hash, display_name, role, status, date_of_birth, reason_for_joining)
       VALUES ($1, $2, $3, $4, $5, 'fan', 'pending', $6, $7)`,
      [id, email.toLowerCase(), username.toLowerCase(), password_hash, display_name,
       date_of_birth ?? null, reason_for_joining ?? null]
    );

    res.status(201).json({ message: 'Application received. Your access request is under review.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await queryOne<any>(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    if (!user.password_hash) {
      res.status(403).json({ error: 'Please set your password first. Check your email for the setup link.' });
      return;
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    if (user.status === 'pending') {
      res.status(403).json({ error: 'Your membership is still pending approval.' });
      return;
    }
    if (user.status === 'rejected' || user.status === 'banned') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role });
    const { password_hash: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.post('/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const reset = await queryOne<any>(
      'SELECT * FROM password_resets WHERE token = $1',
      [token]
    );
    if (!reset) {
      res.status(400).json({ error: 'Invalid or expired link.' });
      return;
    }
    if (reset.used) {
      res.status(400).json({ error: 'This link has already been used.' });
      return;
    }
    if (new Date() > new Date(reset.expires_at)) {
      res.status(400).json({ error: 'This link has expired. Contact support for a new one.' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    await execute('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, reset.email]);
    await execute('UPDATE password_resets SET used = true WHERE id = $1', [reset.id]);

    console.log(`[auth] Password set for: ${reset.email}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[auth] set-password error:', err);
    res.status(500).json({ error: 'Failed to set password.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT id, email, username, display_name, avatar_url, role, status, is_verified_creator,
              date_of_birth, reason_for_joining, created_at
       FROM users WHERE id = $1`,
      [req.auth!.userId]
    );
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

export default router;
