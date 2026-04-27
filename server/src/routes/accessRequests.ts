import { Router } from 'express';
import crypto from 'crypto';
import { execute, queryOne } from '../db/schema.js';

const router = Router();

// GET /api/access-request — health check for this route
router.get('/', (_req, res) => {
  res.json({ ok: true, route: 'access-request' });
});

// POST /api/access-request
router.post('/', async (req, res) => {
  const { email, name, reason, requested_role } = req.body;

  if (!email || !name) {
    res.status(400).json({ error: 'email and name are required.' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email address.' });
    return;
  }

  const validRoles = ['fan', 'creator', 'both'];
  const role = validRoles.includes(requested_role) ? requested_role : 'fan';

  try {
    const existing = await queryOne(
      `SELECT id FROM access_requests WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    if (existing) {
      res.status(409).json({ error: 'An access request for this email already exists.' });
      return;
    }

    const id = crypto.randomUUID();
    const changed = await execute(
      `INSERT INTO access_requests (id, email, name, reason, requested_role) VALUES ($1, $2, $3, $4, $5)`,
      [id, email.toLowerCase().trim(), name.trim(), reason?.trim() ?? '', role]
    );

    if (changed === 0) {
      res.status(500).json({ error: 'Failed to save access request.' });
      return;
    }

    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error('access-request error:', err);
    res.status(500).json({ error: 'Failed to submit access request.' });
  }
});

export default router;
