import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute, withTransaction } from '../db/schema.js';
import { requireAuth, requireApproved, requireAdmin } from '../middleware/auth.js';

const router = Router();

const TRANSFER_FEE_RATE = 0.05;
const MAX_TRANSFERS_PER_MONTH = 5;

function generateInviteCode(type: string): string {
  const prefix = type === 'black' ? 'BLK' : type === 'gold' ? 'GLD' : 'STD';
  const rand = () => Math.random().toString(36).toUpperCase().slice(2, 6);
  return `${prefix}-${rand()}-${rand()}`;
}

function getUserTier(successfulInvites: number): string {
  if (successfulInvites >= 10) return 'gatekeeper';
  if (successfulInvites >= 4) return 'inner_circle';
  return 'connector';
}

// GET /api/keys/vault
router.get('/vault', requireAuth, requireApproved, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const [keys, referrals] = await Promise.all([
      query<any>(`
        SELECT k.*, u.display_name AS invitee_name, u.avatar_url AS invitee_avatar
        FROM access_keys k
        LEFT JOIN users u ON u.id = k.assigned_to_user_id
        WHERE k.inviter_id = $1
        ORDER BY k.created_at DESC
      `, [userId]),
      query<any>(`
        SELECT r.*, u.display_name AS invitee_name, u.avatar_url AS invitee_avatar
        FROM referrals r
        LEFT JOIN users u ON u.id = r.invitee_id
        WHERE r.inviter_id = $1
        ORDER BY r.created_at DESC
      `, [userId]),
    ]);

    const successfulInvites = referrals.filter((r: any) => r.status === 'approved').length;
    const earningsTotal = referrals.reduce((sum: number, r: any) => sum + parseFloat(r.earnings ?? '0'), 0);

    res.json({
      keys,
      referrals,
      summary: {
        total: keys.length,
        available: keys.filter((k: any) => k.status === 'unused').length,
        used: keys.filter((k: any) => k.status === 'used').length,
        tier_status: getUserTier(successfulInvites),
        successful_invites: successfulInvites,
        referral_earnings_total: earningsTotal,
        by_type: {
          standard: keys.filter((k: any) => k.key_type === 'standard').length,
          gold: keys.filter((k: any) => k.key_type === 'gold').length,
          black: keys.filter((k: any) => k.key_type === 'black').length,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vault.' });
  }
});

// POST /api/keys/transfer
router.post('/transfer', requireAuth, requireApproved, async (req, res) => {
  try {
    const { key_id, recipient_username } = req.body;
    const senderId = req.auth!.userId;

    const key = await queryOne<any>(
      'SELECT * FROM access_keys WHERE id = $1 AND inviter_id = $2',
      [key_id, senderId]
    );
    if (!key) { res.status(404).json({ error: 'Key not found or not yours.' }); return; }
    if (key.status !== 'unused') { res.status(400).json({ error: 'Only unused keys can be transferred.' }); return; }

    const recipient = await queryOne<any>('SELECT id, status FROM users WHERE username = $1', [recipient_username]);
    if (!recipient) { res.status(404).json({ error: 'Recipient not found.' }); return; }
    if (recipient.status !== 'approved') { res.status(400).json({ error: 'Recipient account is not approved.' }); return; }
    if (recipient.id === senderId) { res.status(400).json({ error: 'Cannot transfer to yourself.' }); return; }

    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const transferResult = await queryOne<{ n: string }>(`
      SELECT COUNT(*) AS n FROM access_keys
      WHERE inviter_id = $1 AND status = 'transferred' AND created_at >= $2
    `, [senderId, monthStart]);

    if (parseInt(transferResult?.n ?? '0', 10) >= MAX_TRANSFERS_PER_MONTH) {
      res.status(429).json({ error: `Maximum ${MAX_TRANSFERS_PER_MONTH} transfers per month reached.` });
      return;
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE access_keys SET status = 'transferred', assigned_to_user_id = $1 WHERE id = $2`,
        [recipient.id, key_id]
      );
      const newKeyId = crypto.randomUUID();
      await client.query(
        `INSERT INTO access_keys (id, key_type, status, inviter_id, assigned_to_user_id, invite_code)
         VALUES ($1, $2, 'unused', $3, $4, $5)`,
        [newKeyId, key.key_type, recipient.id, null, generateInviteCode(key.key_type)]
      );
      const refId = crypto.randomUUID();
      await client.query(
        `INSERT INTO referrals (id, key_id, inviter_id, invitee_id, invite_code, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [refId, newKeyId, senderId, recipient.id, key.invite_code]
      );
    });

    res.json({ success: true, platform_fee_rate: TRANSFER_FEE_RATE });
  } catch (err) {
    res.status(500).json({ error: 'Failed to transfer key.' });
  }
});

// GET /api/keys/drops
router.get('/drops', requireAuth, requireApproved, async (req, res) => {
  try {
    const drops = await query(`
      SELECT * FROM key_drops
      WHERE is_active = 1 AND end_time > NOW()
      ORDER BY start_time ASC
    `);
    res.json(drops);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch drops.' });
  }
});

// POST /api/keys/drops/:id/claim
router.post('/drops/:id/claim', requireAuth, requireApproved, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const drop = await queryOne<any>('SELECT * FROM key_drops WHERE id = $1 AND is_active = 1', [req.params.id]);

    if (!drop) { res.status(404).json({ error: 'Drop not found or inactive.' }); return; }
    if (new Date(drop.start_time) > new Date()) { res.status(400).json({ error: 'Drop has not started yet.' }); return; }
    if (new Date(drop.end_time) < new Date()) { res.status(400).json({ error: 'Drop has ended.' }); return; }
    if (drop.claimed >= drop.quantity) { res.status(400).json({ error: 'Drop is fully claimed.' }); return; }

    const alreadyClaimed = await queryOne(
      'SELECT id FROM key_drop_claims WHERE drop_id = $1 AND user_id = $2',
      [drop.id, userId]
    );
    if (alreadyClaimed) { res.status(409).json({ error: 'Already claimed a key from this drop.' }); return; }

    const keyId = crypto.randomUUID();
    const claimId = crypto.randomUUID();

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO access_keys (id, key_type, status, inviter_id, invite_code)
         VALUES ($1, $2, 'unused', $3, $4)`,
        [keyId, drop.key_type, userId, generateInviteCode(drop.key_type)]
      );
      await client.query(
        'INSERT INTO key_drop_claims (id, drop_id, user_id, key_id) VALUES ($1, $2, $3, $4)',
        [claimId, drop.id, userId, keyId]
      );
      await client.query('UPDATE key_drops SET claimed = claimed + 1 WHERE id = $1', [drop.id]);
    });

    res.status(201).json({ success: true, key_id: keyId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to claim key.' });
  }
});

// GET /api/keys/exchange
router.get('/exchange', requireAuth, requireApproved, async (req, res) => {
  try {
    const rows = await query(`
      SELECT kl.*, ak.key_type, u.display_name AS lister_name, u.avatar_url AS lister_avatar
      FROM key_listings kl
      JOIN access_keys ak ON ak.id = kl.key_id
      JOIN users u ON u.id = kl.lister_id
      WHERE kl.status = 'available' AND kl.lister_id != $1
      ORDER BY kl.listed_at DESC
      LIMIT 20
    `, [req.auth!.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exchange.' });
  }
});

// POST /api/keys/:id/list
router.post('/:id/list', requireAuth, requireApproved, async (req, res) => {
  try {
    const key = await queryOne(
      `SELECT * FROM access_keys WHERE id = $1 AND inviter_id = $2 AND status = 'unused'`,
      [req.params.id, req.auth!.userId]
    );
    if (!key) { res.status(404).json({ error: 'Key not found, not yours, or already used.' }); return; }

    const listingId = crypto.randomUUID();
    await execute(
      'INSERT INTO key_listings (id, key_id, lister_id) VALUES ($1, $2, $3)',
      [listingId, req.params.id, req.auth!.userId]
    );
    res.status(201).json({ listing_id: listingId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list key.' });
  }
});

// ── Admin key routes ──────────────────────────────────────────────────────────

router.post('/admin/issue', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { key_type, quantity, assign_to_username } = req.body;
    if (!['standard', 'gold', 'black'].includes(key_type)) {
      res.status(400).json({ error: 'Invalid key type.' }); return;
    }
    const qty = Math.min(parseInt(quantity) || 1, 500);

    let assigneeId: string | null = null;
    if (assign_to_username) {
      const user = await queryOne<any>('SELECT id FROM users WHERE username = $1', [assign_to_username]);
      if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
      assigneeId = user.id;
    }

    const adminId = req.auth!.userId;
    const issued: string[] = [];

    await withTransaction(async (client) => {
      for (let i = 0; i < qty; i++) {
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO access_keys (id, key_type, status, inviter_id, assigned_to_user_id, invite_code)
           VALUES ($1, $2, 'unused', $3, $4, $5)`,
          [id, key_type, adminId, assigneeId, generateInviteCode(key_type)]
        );
        issued.push(id);
      }
    });

    res.status(201).json({ issued: issued.length, key_ids: issued });
  } catch (err) {
    res.status(500).json({ error: 'Failed to issue keys.' });
  }
});

router.post('/admin/drops', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { drop_name, drop_description, key_type, quantity, duration_hours, eligible_tiers } = req.body;
    if (!drop_name || !key_type || !quantity) {
      res.status(400).json({ error: 'drop_name, key_type, and quantity are required.' }); return;
    }
    const id = crypto.randomUUID();
    const start = new Date();
    const end = new Date(start.getTime() + (duration_hours ?? 24) * 3600000);

    await execute(
      `INSERT INTO key_drops (id, drop_name, drop_description, key_type, quantity, start_time, end_time, eligible_tiers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, drop_name, drop_description ?? '', key_type, quantity, start, end,
       JSON.stringify(eligible_tiers ?? ['connector', 'inner_circle', 'gatekeeper'])]
    );
    res.status(201).json({ drop_id: id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create drop.' });
  }
});

router.patch('/admin/drops/:id/revoke', requireAuth, requireAdmin, async (req, res) => {
  try {
    await execute('UPDATE key_drops SET is_active = 0 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke drop.' });
  }
});

router.patch('/admin/:id/revoke', requireAuth, requireAdmin, async (req, res) => {
  try {
    await execute(`UPDATE access_keys SET status = 'expired' WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke key.' });
  }
});

export default router;
