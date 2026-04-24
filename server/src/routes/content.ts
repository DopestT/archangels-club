import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/schema.js';
import { requireAuth, requireApproved, requireCreator } from '../middleware/auth.js';
import { triggerCreatorFirstPost, triggerCreatorFirstSale, triggerPurchaseConfirmation } from '../services/triggers.js';

const router = Router();

// GET /api/content — browse approved content only
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar,
      (SELECT COUNT(*) FROM content_unlocks cu WHERE cu.content_id = c.id) as unlock_count
    FROM content c
    JOIN creator_profiles cp ON cp.id = c.creator_id
    JOIN users u ON u.id = cp.user_id
    WHERE c.status = 'approved' AND cp.is_approved = 1 AND cp.application_status = 'approved'
    ORDER BY c.created_at DESC
    LIMIT 50
  `).all();
  res.json(rows);
});

// GET /api/content/:id
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar,
      (SELECT COUNT(*) FROM content_unlocks cu WHERE cu.content_id = c.id) as unlock_count
    FROM content c
    JOIN creator_profiles cp ON cp.id = c.creator_id
    JOIN users u ON u.id = cp.user_id
    WHERE c.id = ?
  `).get(req.params.id) as any;

  if (!row) { res.status(404).json({ error: 'Content not found' }); return; }

  // Hide media_url if locked and not unlocked by viewer
  const safeRow = { ...row };
  if (row.access_type !== 'free') {
    safeRow.media_url = null;
  }
  res.json(safeRow);
});

// POST /api/content — creator uploads (always enters pending_review)
router.post('/', requireAuth, requireCreator, (req, res) => {
  const { title, description, content_type, access_type, preview_url, media_url, price } = req.body;

  if (!title || !content_type || !access_type) {
    res.status(400).json({ error: 'title, content_type, and access_type are required.' });
    return;
  }

  const profile = db.prepare(`
    SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id
    WHERE u.id = ? AND cp.is_approved = 1 AND cp.application_status = 'approved'
  `).get(req.auth!.userId) as any;

  if (!profile) { res.status(403).json({ error: 'Creator account not approved.' }); return; }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO content (id, creator_id, title, description, content_type, access_type, preview_url, media_url, price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')
  `).run(id, profile.id, title, description ?? '', content_type, access_type, preview_url ?? null, media_url ?? null, price ?? 0);

  // First-post trigger (fire-and-forget)
  const postCount = (db.prepare("SELECT COUNT(*) as n FROM content WHERE creator_id = ?").get(profile.id) as any).n;
  if (postCount === 1) {
    triggerCreatorFirstPost(req.auth!.userId).catch(console.error);
  }

  res.status(201).json({ id, status: 'pending_review', message: 'Content submitted for review.' });
});

// POST /api/content/:id/unlock — approved fans unlock paid content
router.post('/:id/unlock', requireAuth, requireApproved, (req, res) => {
  const content = db.prepare(`SELECT * FROM content WHERE id = ?`).get(req.params.id) as any;
  if (!content) { res.status(404).json({ error: 'Content not found' }); return; }
  if (content.access_type === 'free') { res.json({ unlocked: true }); return; }

  const alreadyUnlocked = db.prepare(`
    SELECT id FROM content_unlocks WHERE user_id = ? AND content_id = ?
  `).get(req.auth!.userId, req.params.id);

  if (alreadyUnlocked) { res.json({ unlocked: true }); return; }

  const PLATFORM_FEE_RATE = 0.2;
  const platformFee = Math.round(content.price * PLATFORM_FEE_RATE * 100) / 100;
  const netAmount = content.price - platformFee;

  const creator = db.prepare(`SELECT user_id FROM creator_profiles WHERE id = ?`).get(content.creator_id) as any;

  const txnId = crypto.randomUUID();
  const unlockId = crypto.randomUUID();

  const doUnlock = db.transaction(() => {
    db.prepare(`
      INSERT INTO transactions (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount, status)
      VALUES (?, ?, ?, 'content', ?, ?, ?, ?, 'completed')
    `).run(txnId, req.auth!.userId, creator.user_id, req.params.id, content.price, platformFee, netAmount);

    db.prepare(`
      INSERT INTO content_unlocks (id, user_id, content_id) VALUES (?, ?, ?)
    `).run(unlockId, req.auth!.userId, req.params.id);

    db.prepare(`
      UPDATE creator_profiles SET total_earnings = total_earnings + ? WHERE id = ?
    `).run(netAmount, content.creator_id);
  });

  doUnlock();

  const fullContent = db.prepare(`SELECT * FROM content WHERE id = ?`).get(req.params.id) as any;
  res.json({ unlocked: true, content: fullContent });

  // Post-unlock triggers (fire-and-forget after response)
  triggerPurchaseConfirmation(req.auth!.userId, content.title, req.params.id as string).catch(console.error);

  const saleCount = (db.prepare(`
    SELECT COUNT(*) as n FROM transactions WHERE payee_id = ? AND ref_type = 'content' AND status = 'completed'
  `).get(creator.user_id) as any).n;
  if (saleCount === 1) {
    triggerCreatorFirstSale(creator.user_id, netAmount).catch(console.error);
  }
});

export default router;
