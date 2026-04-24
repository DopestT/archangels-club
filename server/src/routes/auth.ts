import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/schema.js';
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

    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existing) {
      res.status(409).json({ error: 'Email or username already taken.' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, display_name, role, status, date_of_birth, reason_for_joining)
      VALUES (?, ?, ?, ?, ?, 'fan', 'pending', ?, ?)
    `).run(id, email.toLowerCase(), username.toLowerCase(), password_hash, display_name, date_of_birth ?? null, reason_for_joining ?? null);

    res.status(201).json({ message: 'Application received. Your access request is under review.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase()) as any;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (user.status === 'rejected' || user.status === 'banned') {
      res.status(403).json({ error: 'Access denied.', status: user.status });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role });
    const { password_hash: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(`
    SELECT id, email, username, display_name, avatar_url, role, status, is_verified_creator,
           date_of_birth, reason_for_joining, created_at
    FROM users WHERE id = ?
  `).get(req.auth!.userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

export default router;
