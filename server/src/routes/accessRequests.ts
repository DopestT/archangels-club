import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute } from '../db/schema.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { email, username, reason } = req.body as {
      email?: string;
      username?: string;
      reason?: string;
    };

    // Basic field validation
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }
    if (!username || username.trim().length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 characters.' });
      return;
    }
    if (!reason || reason.trim().length < 20) {
      res.status(400).json({ error: 'Please provide a reason for joining (min. 20 characters).' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    // Check for duplicate email in access_requests
    const existingRequest = await queryOne<{ id: string }>(
      'SELECT id FROM access_requests WHERE email = $1',
      [normalizedEmail]
    );
    if (existingRequest) {
      res.status(400).json({ error: 'An access request with this email already exists.' });
      return;
    }

    // Check for duplicate email or username in users
    const existingUser = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [normalizedEmail, normalizedUsername]
    );
    if (existingUser) {
      res.status(400).json({ error: 'Email or username is already associated with an existing account.' });
      return;
    }

    const id = crypto.randomUUID();

    await execute(
      `INSERT INTO access_requests (id, email, username, reason, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [id, normalizedEmail, normalizedUsername, reason.trim()]
    );

    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error('Access request error:', err);
    res.status(500).json({ error: 'Failed to submit access request. Please try again.' });
  }
});

export default router;
