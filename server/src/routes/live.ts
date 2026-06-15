import { Router } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { query, queryOne, execute } from '../db/schema.js';
import { requireAuth, requireApproved, requireCreator, requireAdmin } from '../middleware/auth.js';
import { generateStreamToken } from '../services/streaming.js';

const FRONTEND_URL    = process.env.FRONTEND_URL ?? process.env.CLIENT_URL ?? 'https://www.archangelsclub.com';
const PLATFORM_FEE    = 0.3;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomUid(): number {
  return Math.floor(Math.random() * 900000) + 100000; // 100000–999999
}

async function getAccessStatus(
  liveRoomId: string | string[],
  userId: string
): Promise<{ granted: boolean; reason?: string }> {
  const roomId = String(liveRoomId);
  const room = await queryOne<{
    access_type: string;
    creator_id: string;
    creator_user_id: string;
    status: string;
  }>(
    `SELECT access_type, creator_id, creator_user_id, status
       FROM live_rooms WHERE id = $1`,
    [roomId]
  );
  if (!room) return { granted: false, reason: 'Room not found.' };

  if (room.creator_user_id === userId) return { granted: true };

  if (room.access_type === 'free') return { granted: true };

  if (room.access_type === 'subscribers') {
    const sub = await queryOne(
      `SELECT id FROM subscriptions
         WHERE subscriber_id = $1 AND creator_id = $2
           AND expires_at > NOW() AND status IN ('active','cancelled')`,
      [userId, room.creator_id]
    );
    if (!sub) return { granted: false, reason: 'Active subscription required.' };
    return { granted: true };
  }

  if (room.access_type === 'paid') {
    const purchase = await queryOne(
      `SELECT id FROM live_access_purchases
         WHERE live_room_id = $1 AND user_id = $2 AND status = 'active'`,
      [roomId, userId]
    );
    if (!purchase) return { granted: false, reason: 'Ticket purchase required.' };
    return { granted: true };
  }

  return { granted: false, reason: 'Unknown access type.' };
}

// ── GET /api/live — public listing of active rooms ───────────────────────────

router.get('/', async (req, res) => {
  try {
    const rows = await query<any>(
      `SELECT lr.id, lr.title, lr.description, lr.access_type, lr.price_cents,
              lr.status, lr.started_at, lr.peak_viewer_count,
              u.display_name as creator_name, u.avatar_url as creator_avatar,
              u.username as creator_username, cp.id as creator_id
         FROM live_rooms lr
         JOIN creator_profiles cp ON cp.id = lr.creator_id
         JOIN users u ON u.id = cp.user_id
        WHERE lr.status = 'live'
          AND cp.is_approved = 1 AND cp.application_status = 'approved'
        ORDER BY lr.started_at DESC
        LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error('[live] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch live rooms.' });
  }
});

// ── GET /api/live/my-rooms — creator's own rooms ─────────────────────────────

router.get('/my-rooms', requireAuth, requireCreator, async (req, res) => {
  try {
    const cp = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1', [req.auth!.userId]
    );
    if (!cp) { res.status(404).json({ error: 'Creator profile not found.' }); return; }

    const rows = await query<any>(
      `SELECT id, title, description, access_type, price_cents, status,
              started_at, ended_at, peak_viewer_count, created_at
         FROM live_rooms WHERE creator_id = $1
        ORDER BY created_at DESC LIMIT 50`,
      [cp.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[live] GET /my-rooms error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
});

// ── POST /api/live — create a live room ─────────────────────────────────────

router.post('/', requireAuth, requireApproved, requireCreator, async (req, res) => {
  try {
    const { title, description, access_type, price_cents, goal_amount_cents, goal_title } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      res.status(400).json({ error: 'Title must be at least 3 characters.' });
      return;
    }
    if (!['free', 'subscribers', 'paid'].includes(access_type)) {
      res.status(400).json({ error: 'access_type must be free, subscribers, or paid.' });
      return;
    }
    if (access_type === 'paid') {
      const pc = Number(price_cents);
      if (!pc || pc < 100) {
        res.status(400).json({ error: 'Paid rooms require a price of at least $1.' });
        return;
      }
    }

    const cp = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1', [req.auth!.userId]
    );
    if (!cp) { res.status(404).json({ error: 'Creator profile not found.' }); return; }

    // Creators can only have one active/idle room at a time
    const existing = await queryOne(
      `SELECT id FROM live_rooms WHERE creator_id = $1 AND status IN ('idle','live')`,
      [cp.id]
    );
    if (existing) {
      res.status(409).json({ error: 'You already have an active live room. End it before creating a new one.' });
      return;
    }

    const id = crypto.randomUUID();
    const priceCents = access_type === 'paid' ? Number(price_cents) : null;
    const goalCents = goal_amount_cents ? Number(goal_amount_cents) : null;

    await execute(
      `INSERT INTO live_rooms
         (id, creator_id, creator_user_id, title, description, access_type, price_cents, goal_amount_cents, goal_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, cp.id, req.auth!.userId, title.trim(), description?.trim() ?? null, access_type, priceCents,
       goalCents, goal_title?.trim() ?? null]
    );

    res.status(201).json({ id });
  } catch (err) {
    console.error('[live] POST / error:', err);
    res.status(500).json({ error: 'Failed to create live room.' });
  }
});

// ── GET /api/live/:id — room details ─────────────────────────────────────────

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const room = await queryOne<any>(
      `SELECT lr.id, lr.title, lr.description, lr.access_type, lr.price_cents,
              lr.status, lr.started_at, lr.ended_at, lr.peak_viewer_count,
              lr.replay_available, lr.creator_user_id,
              u.display_name as creator_name, u.avatar_url as creator_avatar,
              u.username as creator_username, cp.id as creator_id
         FROM live_rooms lr
         JOIN creator_profiles cp ON cp.id = lr.creator_id
         JOIN users u ON u.id = cp.user_id
        WHERE lr.id = $1`,
      [req.params.id]
    );

    if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }

    const isCreator = room.creator_user_id === req.auth!.userId;
    const isAdmin = req.auth!.role === 'admin';

    let accessStatus: { granted: boolean; reason?: string } = { granted: false };
    if (isCreator || isAdmin) {
      accessStatus = { granted: true };
    } else {
      accessStatus = await getAccessStatus(req.params.id, req.auth!.userId);
    }

    res.json({ ...room, access: accessStatus, is_creator: isCreator });
  } catch (err) {
    console.error('[live] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to fetch room.' });
  }
});

// ── PATCH /api/live/:id — update room (idle state only) ──────────────────────

router.patch('/:id', requireAuth, requireCreator, async (req, res) => {
  try {
    const room = await queryOne<{ creator_user_id: string; status: string }>(
      'SELECT creator_user_id, status FROM live_rooms WHERE id = $1', [req.params.id]
    );
    if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }
    if (room.creator_user_id !== req.auth!.userId) { res.status(403).json({ error: 'Not your room.' }); return; }
    if (room.status !== 'idle') { res.status(400).json({ error: 'Cannot edit a room that is live or ended.' }); return; }

    const { title, description, access_type, price_cents } = req.body;

    if (access_type && !['free', 'subscribers', 'paid'].includes(access_type)) {
      res.status(400).json({ error: 'Invalid access_type.' });
      return;
    }

    await execute(
      `UPDATE live_rooms
          SET title = COALESCE($1, title),
              description = COALESCE($2, description),
              access_type = COALESCE($3, access_type),
              price_cents = CASE WHEN $3 = 'paid' THEN $4 ELSE
                            CASE WHEN $3 IN ('free','subscribers') THEN NULL ELSE price_cents END END,
              updated_at = NOW()
        WHERE id = $5`,
      [
        title?.trim() ?? null,
        description?.trim() ?? null,
        access_type ?? null,
        price_cents ? Number(price_cents) : null,
        req.params.id,
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[live] PATCH /:id error:', err);
    res.status(500).json({ error: 'Failed to update room.' });
  }
});

// ── POST /api/live/:id/start — go live ───────────────────────────────────────

router.post('/:id/start', requireAuth, requireCreator, async (req, res) => {
  try {
    const room = await queryOne<{ creator_user_id: string; status: string }>(
      'SELECT creator_user_id, status FROM live_rooms WHERE id = $1', [req.params.id]
    );
    if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }
    if (room.creator_user_id !== req.auth!.userId) { res.status(403).json({ error: 'Not your room.' }); return; }
    if (room.status === 'live') { res.status(409).json({ error: 'Room is already live.' }); return; }
    if (room.status === 'ended') { res.status(400).json({ error: 'Ended rooms cannot be restarted.' }); return; }

    await execute(
      `UPDATE live_rooms SET status = 'live', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    // Generate host token
    const uid = 1; // host always gets UID 1
    const tokenResult = generateStreamToken(String(req.params.id), uid, 'host');

    res.json({ ok: true, stream: tokenResult });
  } catch (err) {
    console.error('[live] POST /:id/start error:', err);
    res.status(500).json({ error: 'Failed to start room.' });
  }
});

// ── POST /api/live/:id/end — end stream (creator or admin) ───────────────────

router.post('/:id/end', requireAuth, async (req, res) => {
  try {
    const room = await queryOne<{ creator_user_id: string; status: string }>(
      'SELECT creator_user_id, status FROM live_rooms WHERE id = $1', [req.params.id]
    );
    if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }

    const isCreator = room.creator_user_id === req.auth!.userId;
    const isAdmin = req.auth!.role === 'admin';
    if (!isCreator && !isAdmin) { res.status(403).json({ error: 'Not authorized.' }); return; }
    if (room.status === 'ended') { res.status(400).json({ error: 'Room already ended.' }); return; }

    await execute(
      `UPDATE live_rooms
          SET status = 'ended', ended_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [req.params.id]
    );

    if (isAdmin && !isCreator) {
      const { reason } = req.body;
      await execute(
        `INSERT INTO live_moderation_events (id, live_room_id, admin_id, action, reason)
         VALUES ($1, $2, $3, 'end_stream', $4)`,
        [crypto.randomUUID(), req.params.id, req.auth!.userId, reason ?? null]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[live] POST /:id/end error:', err);
    res.status(500).json({ error: 'Failed to end room.' });
  }
});

// ── POST /api/live/:id/token — get audience stream token ─────────────────────

router.post('/:id/token', requireAuth, requireApproved, async (req, res) => {
  try {
    const room = await queryOne<{ status: string; creator_user_id: string }>(
      'SELECT status, creator_user_id FROM live_rooms WHERE id = $1', [req.params.id]
    );
    if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }
    if (room.status !== 'live') { res.status(400).json({ error: 'Room is not live.' }); return; }

    const isCreator = room.creator_user_id === req.auth!.userId;
    const isAdmin = req.auth!.role === 'admin';

    if (!isCreator && !isAdmin) {
      const access = await getAccessStatus(req.params.id, req.auth!.userId);
      if (!access.granted) {
        res.status(403).json({ error: access.reason ?? 'Access denied.' });
        return;
      }
    }

    const role = isCreator ? 'host' : 'audience';
    const uid = isCreator ? 1 : randomUid();
    const tokenResult = generateStreamToken(String(req.params.id), uid, role);

    res.json({ stream: tokenResult, role });
  } catch (err) {
    console.error('[live] POST /:id/token error:', err);
    res.status(500).json({ error: 'Failed to generate stream token.' });
  }
});

// ── GET /api/live/:id/access — check access without token ────────────────────

router.get('/:id/access', requireAuth, async (req, res) => {
  try {
    const room = await queryOne<{ creator_user_id: string; status: string }>(
      'SELECT creator_user_id, status FROM live_rooms WHERE id = $1', [req.params.id]
    );
    if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }

    const isCreator = room.creator_user_id === req.auth!.userId;
    const isAdmin = req.auth!.role === 'admin';

    if (isCreator || isAdmin) {
      res.json({ granted: true });
      return;
    }

    const access = await getAccessStatus(req.params.id, req.auth!.userId);
    res.json(access);
  } catch (err) {
    res.status(500).json({ error: 'Failed to check access.' });
  }
});

// ── GET /api/live/:id/chat — poll chat messages ───────────────────────────────

router.get('/:id/chat', requireAuth, async (req, res) => {
  try {
    const access = await getAccessStatus(req.params.id, req.auth!.userId);
    const isAdmin = req.auth!.role === 'admin';

    const room = await queryOne<{ creator_user_id: string }>(
      'SELECT creator_user_id FROM live_rooms WHERE id = $1', [req.params.id]
    );
    const isCreator = room?.creator_user_id === req.auth!.userId;

    if (!access.granted && !isAdmin && !isCreator) {
      res.status(403).json({ error: 'Access required to view chat.' });
      return;
    }

    const after = req.query.after as string | undefined;
    const limit = Math.min(Number(req.query.limit ?? 50), 100);

    const rows = await query<any>(
      `SELECT id, user_id, display_name, message, is_deleted, is_reported, created_at
         FROM live_chat_messages
        WHERE live_room_id = $1
          AND is_deleted = false
          ${after ? 'AND created_at > $3' : ''}
        ORDER BY created_at ASC
        LIMIT $2`,
      after ? [req.params.id, limit, after] : [req.params.id, limit]
    );

    res.json(rows);
  } catch (err) {
    console.error('[live] GET /:id/chat error:', err);
    res.status(500).json({ error: 'Failed to fetch chat.' });
  }
});

// ── POST /api/live/:id/chat — send a chat message ────────────────────────────

router.post('/:id/chat', requireAuth, requireApproved, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }
    if (message.trim().length > 500) {
      res.status(400).json({ error: 'Message too long (max 500 chars).' });
      return;
    }

    const room = await queryOne<{ status: string; creator_user_id: string }>(
      'SELECT status, creator_user_id FROM live_rooms WHERE id = $1', [req.params.id]
    );
    if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }
    if (room.status !== 'live') { res.status(400).json({ error: 'Room is not live.' }); return; }

    const isCreator = room.creator_user_id === req.auth!.userId;
    const isAdmin = req.auth!.role === 'admin';

    if (!isCreator && !isAdmin) {
      const access = await getAccessStatus(req.params.id, req.auth!.userId);
      if (!access.granted) {
        res.status(403).json({ error: 'Access required to chat.' });
        return;
      }
    }

    const user = await queryOne<{ display_name: string }>(
      'SELECT display_name FROM users WHERE id = $1', [req.auth!.userId]
    );

    const id = crypto.randomUUID();
    const displayName = user?.display_name ?? 'Member';

    await execute(
      `INSERT INTO live_chat_messages (id, live_room_id, user_id, display_name, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, req.params.id, req.auth!.userId, displayName, message.trim()]
    );

    res.status(201).json({ id, display_name: displayName, message: message.trim() });
  } catch (err) {
    console.error('[live] POST /:id/chat error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// ── DELETE /api/live/:id/chat/:msgId — delete a chat message ─────────────────

router.delete('/:id/chat/:msgId', requireAuth, async (req, res) => {
  try {
    const msg = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM live_chat_messages WHERE id = $1 AND live_room_id = $2',
      [req.params.msgId, req.params.id]
    );
    if (!msg) { res.status(404).json({ error: 'Message not found.' }); return; }

    const room = await queryOne<{ creator_user_id: string }>(
      'SELECT creator_user_id FROM live_rooms WHERE id = $1', [req.params.id]
    );

    const isAdmin = req.auth!.role === 'admin';
    const isCreator = room?.creator_user_id === req.auth!.userId;
    const isOwner = msg.user_id === req.auth!.userId;

    if (!isAdmin && !isCreator && !isOwner) {
      res.status(403).json({ error: 'Not authorized to delete this message.' });
      return;
    }

    await execute(
      'UPDATE live_chat_messages SET is_deleted = true WHERE id = $1',
      [req.params.msgId]
    );

    if (isAdmin) {
      await execute(
        `INSERT INTO live_moderation_events (id, live_room_id, admin_id, action, target_id)
         VALUES ($1, $2, $3, 'delete_message', $4)`,
        [crypto.randomUUID(), req.params.id, req.auth!.userId, req.params.msgId]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message.' });
  }
});

// ── POST /api/live/:id/chat/:msgId/report — report a message ─────────────────

router.post('/:id/chat/:msgId/report', requireAuth, async (req, res) => {
  try {
    await execute(
      'UPDATE live_chat_messages SET is_reported = true WHERE id = $1 AND live_room_id = $2',
      [req.params.msgId, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to report message.' });
  }
});

// ── POST /api/live/:id/tip — create Stripe checkout for a live Gold gift ─────
//
// Accepts: { amount_cents, creator_id, privacy?, message? }
// privacy: 'public' | 'private' | 'ghost'  (default: 'public')
//   public  → sender name shown in room feed
//   private → shows as "Private Patron"
//   ghost   → shows as "A private gift was sent"

router.post('/:id/tip', requireAuth, requireApproved, async (req, res) => {
  try {
    const { amount_cents, creator_id, privacy = 'public', message } = req.body;

    if (!amount_cents || typeof amount_cents !== 'number' || amount_cents < 100) {
      res.status(400).json({ error: 'amount_cents must be at least 100.' });
      return;
    }
    if (!['public', 'private', 'ghost'].includes(privacy)) {
      res.status(400).json({ error: 'privacy must be public, private, or ghost.' });
      return;
    }

    const room = await queryOne<{ status: string; creator_id: string }>(
      'SELECT status, creator_id FROM live_rooms WHERE id = $1', [req.params.id]
    );
    if (!room) { res.status(404).json({ error: 'Room not found.' }); return; }
    if (room.status !== 'live') { res.status(400).json({ error: 'Room is not currently live.' }); return; }

    const resolvedCreatorId = creator_id ?? room.creator_id;
    const creator = await queryOne<{ id: string; user_id: string; stripe_account_id: string | null; stripe_onboarding_complete: number; display_name: string }>(
      `SELECT cp.id, cp.user_id, cp.stripe_account_id, cp.stripe_onboarding_complete, u.display_name
         FROM creator_profiles cp
         JOIN users u ON u.id = cp.user_id
        WHERE cp.id = $1 AND cp.is_approved = 1`,
      [resolvedCreatorId]
    );
    if (!creator) { res.status(404).json({ error: 'Creator not found.' }); return; }
    if (creator.user_id === req.auth!.userId) { res.status(403).json({ error: 'Cannot tip yourself.' }); return; }

    const stripe     = getStripe();
    const unitAmount = amount_cents;
    const feeAmount  = Math.round(unitAmount * PLATFORM_FEE);
    const hasConnect = !!creator.stripe_account_id && !!creator.stripe_onboarding_complete;
    const amountDollars = (unitAmount / 100).toFixed(2);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency:     'usd',
          product_data: { name: `Gold Gift to ${creator.display_name}` },
          unit_amount:  unitAmount,
        },
        quantity: 1,
      }],
      ...(hasConnect ? {
        payment_intent_data: {
          application_fee_amount: feeAmount,
          transfer_data: { destination: creator.stripe_account_id! },
        },
      } : {}),
      metadata: {
        type:            'live_tip',
        user_id:         req.auth!.userId,
        creator_id:      resolvedCreatorId,
        creator_user_id: creator.user_id,
        live_room_id:    String(req.params.id),
        amount:          amountDollars,
        tip_privacy:     privacy,
        ...(message ? { tip_message: message } : {}),
      },
      success_url: `${FRONTEND_URL}/live/${req.params.id}?tip=sent`,
      cancel_url:  `${FRONTEND_URL}/live/${req.params.id}`,
    });

    if (!session.url) throw new Error('No checkout URL returned.');
    res.json({ url: session.url });
  } catch (err) {
    console.error('[live] POST /:id/tip error:', err);
    res.status(500).json({ error: 'Failed to create tip checkout.' });
  }
});

// ── GET /api/live/:id/leaderboard — top tippers in a room ───────────────────

router.get('/:id/leaderboard', requireAuth, async (req, res) => {
  try {
    const access = await getAccessStatus(req.params.id, req.auth!.userId);
    const room = await queryOne<{ creator_user_id: string }>(
      'SELECT creator_user_id FROM live_rooms WHERE id = $1', [req.params.id]
    );
    const isCreator = room?.creator_user_id === req.auth!.userId;
    const isAdmin   = req.auth!.role === 'admin';
    if (!access.granted && !isCreator && !isAdmin) {
      res.status(403).json({ error: 'Access required.' }); return;
    }

    const rows = await query<{ display_name: string; total_cents: number }>(
      `SELECT display_name, SUM(amount_cents)::int AS total_cents
         FROM live_tips
        WHERE live_room_id = $1 AND status = 'completed'
        GROUP BY tipper_id, display_name
        ORDER BY total_cents DESC
        LIMIT 10`,
      [req.params.id]
    );

    const tippers = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    const raisedCents = rows.reduce((sum, r) => sum + r.total_cents, 0);
    res.json({ tippers, raised_cents: raisedCents });
  } catch (err) {
    console.error('[live] GET /:id/leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

// ── GET /api/live/admin/rooms — admin: all rooms ──────────────────────────────

router.get('/admin/rooms', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const validStatuses = ['idle', 'live', 'ended'];
    const filteredStatus = status && validStatuses.includes(status) ? status : null;
    const rows = await query<any>(
      `SELECT lr.id, lr.title, lr.status, lr.access_type, lr.price_cents,
              lr.started_at, lr.ended_at, lr.peak_viewer_count,
              u.display_name as creator_name, u.email as creator_email
         FROM live_rooms lr
         JOIN creator_profiles cp ON cp.id = lr.creator_id
         JOIN users u ON u.id = cp.user_id
        ${filteredStatus ? 'WHERE lr.status = $1' : ''}
        ORDER BY lr.created_at DESC
        LIMIT 100`,
      filteredStatus ? [filteredStatus] : []
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
});

// ── GET /api/live/admin/reports — reported chat messages ──────────────────────

router.get('/admin/reports', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await query<any>(
      `SELECT lcm.id, lcm.live_room_id, lcm.display_name, lcm.message, lcm.is_deleted,
              lcm.created_at, lr.title as room_title
         FROM live_chat_messages lcm
         JOIN live_rooms lr ON lr.id = lcm.live_room_id
        WHERE lcm.is_reported = true AND lcm.is_deleted = false
        ORDER BY lcm.created_at DESC
        LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

export default router;
