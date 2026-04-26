import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute, withTransaction } from '../db/schema.js';
import { requireAuth, requireApproved, requireCreator } from '../middleware/auth.js';
import { triggerCreatorFirstPost, triggerCreatorFirstSale, triggerPurchaseConfirmation } from '../services/triggers.js';

const router = Router();

// GET /api/content — browse approved content only
// Query params: sort (trending|newest|rising), limit (max 50), offset, creator_id, exclude_id
router.get('/', async (req, res) => {
  try {
    const { sort = 'newest', limit: rawLimit, offset: rawOffset, creator_id, exclude_id } = req.query;
    const rawLimitVal = parseInt(rawLimit as string, 10);
    const limit = isNaN(rawLimitVal) ? 50 : Math.min(rawLimitVal, 50);
    const rawOffsetVal = parseInt(rawOffset as string, 10);
    const offsetNum = isNaN(rawOffsetVal) ? 0 : Math.max(0, rawOffsetVal);

    const params: unknown[] = [];
    let paramIdx = 1;
    let extraWhere = '';

    if (creator_id) {
      extraWhere += ` AND c.creator_id = $${paramIdx++}`;
      params.push(creator_id);
    }
    if (exclude_id) {
      extraWhere += ` AND c.id != $${paramIdx++}`;
      params.push(exclude_id);
    }

    // score = unlock_count*3 + tip_total*5 + recent_unlocks_24h*4 + (is_new_48h ? 10 : 0)
    // rising = recent_unlocks_24h*10 + (is_new_7d ? 15 : 0) + unlock_count*2
    const orderBy = sort === 'trending'
      ? '(stats.unlock_count * 3 + stats.content_revenue * 5 + stats.recent_unlocks_24h * 4 + CASE WHEN c.created_at >= NOW() - INTERVAL \'48 hours\' THEN 10 ELSE 0 END) DESC, c.created_at DESC'
      : sort === 'rising'
      ? '(stats.recent_unlocks_24h * 10 + CASE WHEN c.created_at >= NOW() - INTERVAL \'7 days\' THEN 15 ELSE 0 END + stats.unlock_count * 2) DESC, c.created_at DESC'
      : 'c.created_at DESC';

    const rows = await query(`
      SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar,
        cp.subscription_price as creator_subscription_price,
        stats.unlock_count,
        stats.recent_unlocks_24h,
        stats.content_revenue,
        (stats.unlock_count * 3 + stats.content_revenue * 5 + stats.recent_unlocks_24h * 4 + CASE WHEN c.created_at >= NOW() - INTERVAL '48 hours' THEN 10 ELSE 0 END) AS score
      FROM content c
      JOIN creator_profiles cp ON cp.id = c.creator_id
      JOIN users u ON u.id = cp.user_id
      CROSS JOIN LATERAL (
        SELECT
          (SELECT COUNT(*) FROM content_unlocks cu WHERE cu.content_id = c.id)::int AS unlock_count,
          (SELECT COUNT(*) FROM content_unlocks cu WHERE cu.content_id = c.id AND cu.unlocked_at >= NOW() - INTERVAL '24 hours')::int AS recent_unlocks_24h,
          (SELECT COALESCE(SUM(t.net_amount), 0) FROM transactions t WHERE t.ref_type = 'content' AND t.ref_id = c.id AND t.status = 'completed') AS content_revenue
      ) stats
      WHERE c.status = 'approved' AND cp.is_approved = 1 AND cp.application_status = 'approved'${extraWhere}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offsetNum}
    `, params);
    res.json(rows);
  } catch (err) {
    console.error('[content] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch content.' });
  }
});

// GET /api/content/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await queryOne<any>(`
      SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar,
        cp.subscription_price as creator_subscription_price,
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

// GET /api/content/:id/my-access — unlock status, media_url if unlocked, subscription discount info
router.get('/:id/my-access', requireAuth, async (req, res) => {
  try {
    const content = await queryOne<any>(
      `SELECT c.*, cp.user_id AS creator_user_id
       FROM content c
       JOIN creator_profiles cp ON cp.id = c.creator_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!content) { res.status(404).json({ error: 'Content not found' }); return; }

    // Admin: unrestricted access to all content
    if (req.auth!.role === 'admin') {
      res.json({ unlocked: true, media_url: content.media_url, is_subscribed: false,
        discounted_price: null, is_admin_preview: true, is_creator_preview: false });
      return;
    }

    // Creator viewing their own content: no paywall, cannot purchase
    if (content.creator_user_id === req.auth!.userId) {
      res.json({ unlocked: true, media_url: content.media_url, is_subscribed: false,
        discounted_price: null, is_admin_preview: false, is_creator_preview: true });
      return;
    }

    if (content.access_type === 'free') {
      res.json({ unlocked: true, media_url: content.media_url, is_subscribed: false,
        discounted_price: null, is_admin_preview: false, is_creator_preview: false });
      return;
    }

    // Check active subscription to this creator
    const sub = await queryOne<{ id: string }>(
      `SELECT id FROM subscriptions
       WHERE subscriber_id = $1 AND creator_id = $2 AND status = 'active' AND expires_at > NOW()`,
      [req.auth!.userId, content.creator_id]
    );
    const isSubscribed = !!sub;
    const discountPct = isSubscribed ? (Number(content.subscriber_discount_pct) || 0) : 0;
    const discountedPrice = discountPct > 0
      ? Math.round(Number(content.price) * (1 - discountPct / 100) * 100) / 100
      : null;

    // Subscriber-only content: accessible to active subscribers without unlock fee
    if (content.access_type === 'subscribers') {
      if (isSubscribed) {
        res.json({ unlocked: true, media_url: content.media_url, is_subscribed: true,
          discounted_price: null, is_admin_preview: false, is_creator_preview: false });
      } else {
        res.json({ unlocked: false, media_url: null, is_subscribed: false,
          discounted_price: null, is_admin_preview: false, is_creator_preview: false });
      }
      return;
    }

    const unlock = await queryOne(
      'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
      [req.auth!.userId, req.params.id]
    );

    if (unlock) {
      res.json({ unlocked: true, media_url: content.media_url, is_subscribed: isSubscribed,
        discounted_price: null, is_admin_preview: false, is_creator_preview: false });
    } else {
      res.json({ unlocked: false, media_url: null, is_subscribed: isSubscribed,
        discounted_price: discountedPrice, is_admin_preview: false, is_creator_preview: false });
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
