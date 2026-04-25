import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute, withTransaction } from '../db/schema.js';
import { requireAuth, requireApproved, requireCreator } from '../middleware/auth.js';
import { triggerCreatorFirstPost, triggerCreatorFirstSale, triggerPurchaseConfirmation } from '../services/triggers.js';

const router = Router();

// GET /api/content — browse approved content only
router.get('/', async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar,
        (SELECT COUNT(*) FROM content_unlocks cu WHERE cu.content_id = c.id) as unlock_count
      FROM content c
      JOIN creator_profiles cp ON cp.id = c.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE c.status = 'approved' AND cp.is_approved = 1 AND cp.application_status = 'approved'
      ORDER BY c.created_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content.' });
  }
});

// GET /api/content/:id
router.get('/:id', async (req, res) => {
  try {
    console.log('[content] Fetching content ID:', req.params.id);
    const row = await queryOne<any>(`
      SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar,
        (SELECT COUNT(*) FROM content_unlocks cu WHERE cu.content_id = c.id) as unlock_count
      FROM content c
      JOIN creator_profiles cp ON cp.id = c.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE c.id = $1
    `, [req.params.id]);

    if (!row) { res.status(404).json({ error: 'Content not found' }); return; }

    const safeRow = { ...row };
    if (row.access_type !== 'free') safeRow.media_url = null;
    res.json(safeRow);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content.' });
  }
});

// GET /api/content/:id/my-access — returns unlock status + media_url if unlocked
router.get('/:id/my-access', requireAuth, async (req, res) => {
  try {
    const content = await queryOne<any>('SELECT * FROM content WHERE id = $1', [req.params.id]);
    if (!content) { res.status(404).json({ error: 'Content not found' }); return; }

    if (content.access_type === 'free') {
      res.json({ unlocked: true, media_url: content.media_url });
      return;
    }

    const unlock = await queryOne(
      'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
      [req.auth!.userId, req.params.id]
    );

    if (unlock) {
      res.json({ unlocked: true, media_url: content.media_url });
    } else {
      res.json({ unlocked: false, media_url: null });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to check access' });
  }
});

// POST /api/content — creator uploads (always enters pending_review)
router.post('/', requireAuth, requireCreator, async (req, res) => {
  try {
    const { title, description, content_type, access_type, preview_url, media_url, price } = req.body;

    if (!title || !content_type || !access_type) {
      res.status(400).json({ error: 'title, content_type, and access_type are required.' });
      return;
    }

    const profile = await queryOne<any>(`
      SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id
      WHERE u.id = $1 AND cp.is_approved = 1 AND cp.application_status = 'approved'
    `, [req.auth!.userId]);

    if (!profile) { res.status(403).json({ error: 'Creator account not approved.' }); return; }

    const id = crypto.randomUUID();
    await execute(
      `INSERT INTO content (id, creator_id, title, description, content_type, access_type, preview_url, media_url, price, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_review')`,
      [id, profile.id, title, description ?? '', content_type, access_type,
       preview_url ?? null, media_url ?? null, price ?? 0]
    );

    // First-post trigger (fire-and-forget)
    const countResult = await queryOne<{ n: string }>(
      'SELECT COUNT(*) as n FROM content WHERE creator_id = $1',
      [profile.id]
    );
    if (parseInt(countResult?.n ?? '0', 10) === 1) {
      triggerCreatorFirstPost(req.auth!.userId).catch(console.error);
    }

    res.status(201).json({ id, status: 'pending_review', message: 'Content submitted for review.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload content.' });
  }
});

// POST /api/content/:id/unlock — approved fans unlock paid content
router.post('/:id/unlock', requireAuth, requireApproved, async (req, res) => {
  try {
    const content = await queryOne<any>('SELECT * FROM content WHERE id = $1', [req.params.id]);
    if (!content) { res.status(404).json({ error: 'Content not found' }); return; }
    if (content.access_type === 'free') { res.json({ unlocked: true }); return; }

    const alreadyUnlocked = await queryOne(
      'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
      [req.auth!.userId, req.params.id]
    );
    if (alreadyUnlocked) { res.json({ unlocked: true }); return; }

    const PLATFORM_FEE_RATE = 0.2;
    const platformFee = Math.round(content.price * PLATFORM_FEE_RATE * 100) / 100;
    const netAmount = content.price - platformFee;

    const creator = await queryOne<any>(
      'SELECT user_id FROM creator_profiles WHERE id = $1',
      [content.creator_id]
    );

    const txnId = crypto.randomUUID();
    const unlockId = crypto.randomUUID();

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO transactions (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount, status)
         VALUES ($1, $2, $3, 'content', $4, $5, $6, $7, 'completed')`,
        [txnId, req.auth!.userId, creator.user_id, req.params.id, content.price, platformFee, netAmount]
      );
      await client.query(
        'INSERT INTO content_unlocks (id, user_id, content_id) VALUES ($1, $2, $3)',
        [unlockId, req.auth!.userId, req.params.id]
      );
      await client.query(
        'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
        [netAmount, content.creator_id]
      );
    });

    const fullContent = await queryOne<any>('SELECT * FROM content WHERE id = $1', [req.params.id]);
    res.json({ unlocked: true, content: fullContent });

    // Post-unlock triggers (fire-and-forget)
    triggerPurchaseConfirmation(req.auth!.userId, content.title, req.params.id as string).catch(console.error);
    const saleResult = await queryOne<{ n: string }>(
      `SELECT COUNT(*) as n FROM transactions WHERE payee_id = $1 AND ref_type = 'content' AND status = 'completed'`,
      [creator.user_id]
    );
    if (parseInt(saleResult?.n ?? '0', 10) === 1) {
      triggerCreatorFirstSale(creator.user_id, netAmount).catch(console.error);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlock content.' });
  }
});

export default router;
