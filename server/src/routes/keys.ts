import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/schema.js';
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

// GET /api/keys/vault — user's key vault + summary
router.get('/vault', requireAuth, requireApproved, (req, res) => {
  const userId = req.auth!.userId;

  const keys = db.prepare(`
    SELECT k.*, u.display_name as invitee_name, u.avatar_url as invitee_avatar
    FROM access_keys k
    LEFT JOIN users u ON u.id = k.assigned_to_user_id
    WHERE k.inviter_id = ?
    ORDER BY k.created_at DESC
  `).all(userId) as any[];

  const referrals = db.prepare(`
    SELECT r.*, u.display_name as invitee_name, u.avatar_url as invitee_avatar
    FROM referrals r
    LEFT JOIN users u ON u.id = r.invitee_id
    WHERE r.inviter_id = ?
    ORDER BY r.created_at DESC
  `).all(userId) as any[];

  const successfulInvites = referrals.filter((r: any) => r.status === 'approved').length;
  const earningsTotal = referrals.reduce((sum: number, r: any) => sum + r.earnings, 0);

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
});

// POST /api/keys/transfer — transfer a key to another user
router.post('/transfer', requireAuth, requireApproved, (req, res) => {
  const { key_id, recipient_username } = req.body;
  const senderId = req.auth!.userId;

  const key = db.prepare(`SELECT * FROM access_keys WHERE id = ? AND inviter_id = ?`).get(key_id, senderId) as any;
  if (!key) { res.status(404).json({ error: 'Key not found or not yours.' }); return; }
  if (key.status !== 'unused') { res.status(400).json({ error: 'Only unused keys can be transferred.' }); return; }

  const recipient = db.prepare(`SELECT id, status FROM users WHERE username = ?`).get(recipient_username) as any;
  if (!recipient) { res.status(404).json({ error: 'Recipient not found.' }); return; }
  if (recipient.status !== 'approved') { res.status(400).json({ error: 'Recipient account is not approved.' }); return; }
  if (recipient.id === senderId) { res.status(400).json({ error: 'Cannot transfer to yourself.' }); return; }

  // Monthly transfer limit check
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const transfersThisMonth = (db.prepare(`
    SELECT COUNT(*) as n FROM access_keys
    WHERE inviter_id = ? AND status = 'transferred' AND created_at >= ?
  `).get(senderId, monthStart.toISOString()) as any).n;

  if (transfersThisMonth >= MAX_TRANSFERS_PER_MONTH) {
    res.status(429).json({ error: `Maximum ${MAX_TRANSFERS_PER_MONTH} transfers per month reached.` });
    return;
  }

  db.transaction(() => {
    db.prepare(`UPDATE access_keys SET status = 'transferred', assigned_to_user_id = ? WHERE id = ?`).run(recipient.id, key_id);

    const newKeyId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO access_keys (id, key_type, status, inviter_id, assigned_to_user_id, invite_code)
      VALUES (?, ?, 'unused', ?, ?, ?)
    `).run(newKeyId, key.key_type, recipient.id, null, generateInviteCode(key.key_type));

    const refId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO referrals (id, key_id, inviter_id, invitee_id, invite_code, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(refId, newKeyId, senderId, recipient.id, key.invite_code);
  })();

  res.json({ success: true, platform_fee_rate: TRANSFER_FEE_RATE });
});

// GET /api/keys/drops — active drops
router.get('/drops', requireAuth, requireApproved, (req, res) => {
  const drops = db.prepare(`
    SELECT * FROM key_drops
    WHERE is_active = 1 AND end_time > datetime('now')
    ORDER BY start_time ASC
  `).all();
  res.json(drops);
});

// POST /api/keys/drops/:id/claim — claim a key from a drop
router.post('/drops/:id/claim', requireAuth, requireApproved, (req, res) => {
  const userId = req.auth!.userId;
  const drop = db.prepare(`SELECT * FROM key_drops WHERE id = ? AND is_active = 1`).get(req.params.id) as any;

  if (!drop) { res.status(404).json({ error: 'Drop not found or inactive.' }); return; }
  if (new Date(drop.start_time) > new Date()) { res.status(400).json({ error: 'Drop has not started yet.' }); return; }
  if (new Date(drop.end_time) < new Date()) { res.status(400).json({ error: 'Drop has ended.' }); return; }
  if (drop.claimed >= drop.quantity) { res.status(400).json({ error: 'Drop is fully claimed.' }); return; }

  const alreadyClaimed = db.prepare(`SELECT id FROM key_drop_claims WHERE drop_id = ? AND user_id = ?`).get(drop.id, userId);
  if (alreadyClaimed) { res.status(409).json({ error: 'Already claimed a key from this drop.' }); return; }

  const keyId = crypto.randomUUID();
  const claimId = crypto.randomUUID();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO access_keys (id, key_type, status, inviter_id, invite_code)
      VALUES (?, ?, 'unused', ?, ?)
    `).run(keyId, drop.key_type, userId, generateInviteCode(drop.key_type));

    db.prepare(`
      INSERT INTO key_drop_claims (id, drop_id, user_id, key_id) VALUES (?, ?, ?, ?)
    `).run(claimId, drop.id, userId, keyId);

    db.prepare(`UPDATE key_drops SET claimed = claimed + 1 WHERE id = ?`).run(drop.id);
  })();

  res.status(201).json({ success: true, key_id: keyId });
});

// GET /api/keys/exchange — available listings
router.get('/exchange', requireAuth, requireApproved, (req, res) => {
  const rows = db.prepare(`
    SELECT kl.*, ak.key_type, u.display_name as lister_name, u.avatar_url as lister_avatar
    FROM key_listings kl
    JOIN access_keys ak ON ak.id = kl.key_id
    JOIN users u ON u.id = kl.lister_id
    WHERE kl.status = 'available' AND kl.lister_id != ?
    ORDER BY kl.listed_at DESC
    LIMIT 20
  `).all(req.auth!.userId);
  res.json(rows);
});

// POST /api/keys/:id/list — list a key on the exchange
router.post('/:id/list', requireAuth, requireApproved, (req, res) => {
  const key = db.prepare(`SELECT * FROM access_keys WHERE id = ? AND inviter_id = ? AND status = 'unused'`).get(req.params.id, req.auth!.userId);
  if (!key) { res.status(404).json({ error: 'Key not found, not yours, or already used.' }); return; }

  const listingId = crypto.randomUUID();
  db.prepare(`INSERT INTO key_listings (id, key_id, lister_id) VALUES (?, ?, ?)`).run(listingId, req.params.id, req.auth!.userId);
  res.status(201).json({ listing_id: listingId });
});

// ── Admin key routes ──────────────────────────────────────────────────────────

// POST /api/keys/admin/issue — admin issues keys
router.post('/admin/issue', requireAuth, requireAdmin, (req, res) => {
  const { key_type, quantity, assign_to_username } = req.body;
  if (!['standard', 'gold', 'black'].includes(key_type)) {
    res.status(400).json({ error: 'Invalid key type.' }); return;
  }
  const qty = Math.min(parseInt(quantity) || 1, 500);

  let assigneeId: string | null = null;
  if (assign_to_username) {
    const user = db.prepare(`SELECT id FROM users WHERE username = ?`).get(assign_to_username) as any;
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
    assigneeId = user.id;
  }

  const adminId = req.auth!.userId;
  const issued: string[] = [];

  db.transaction(() => {
    for (let i = 0; i < qty; i++) {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO access_keys (id, key_type, status, inviter_id, assigned_to_user_id, invite_code)
        VALUES (?, ?, 'unused', ?, ?, ?)
      `).run(id, key_type, adminId, assigneeId, generateInviteCode(key_type));
      issued.push(id);
    }
  })();

  res.status(201).json({ issued: issued.length, key_ids: issued });
});

// POST /api/keys/admin/drops — create a key drop
router.post('/admin/drops', requireAuth, requireAdmin, (req, res) => {
  const { drop_name, drop_description, key_type, quantity, duration_hours, eligible_tiers } = req.body;
  if (!drop_name || !key_type || !quantity) {
    res.status(400).json({ error: 'drop_name, key_type, and quantity are required.' }); return;
  }
  const id = crypto.randomUUID();
  const start = new Date();
  const end = new Date(start.getTime() + (duration_hours ?? 24) * 3600000);

  db.prepare(`
    INSERT INTO key_drops (id, drop_name, drop_description, key_type, quantity, start_time, end_time, eligible_tiers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, drop_name, drop_description ?? '', key_type, quantity, start.toISOString(), end.toISOString(),
    JSON.stringify(eligible_tiers ?? ['connector', 'inner_circle', 'gatekeeper']));

  res.status(201).json({ drop_id: id });
});

// PATCH /api/keys/admin/drops/:id/revoke — deactivate a drop
router.patch('/admin/drops/:id/revoke', requireAuth, requireAdmin, (req, res) => {
  db.prepare(`UPDATE key_drops SET is_active = 0 WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// PATCH /api/keys/admin/:id/revoke — revoke a specific key
router.patch('/admin/:id/revoke', requireAuth, requireAdmin, (req, res) => {
  db.prepare(`UPDATE access_keys SET status = 'expired' WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

export default router;
