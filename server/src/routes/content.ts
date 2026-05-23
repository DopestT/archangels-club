import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query, queryOne, execute, withTransaction } from '../db/schema.js';
import { requireAuth, requireApproved, requireCreator } from '../middleware/auth.js';
import { triggerCreatorFirstPost, triggerCreatorFirstSale, triggerPurchaseConfirmation } from '../services/triggers.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'archangels_dev_secret_change_in_production'; // only used for optional auth on draft content

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
      WHERE (c.status = 'approved' OR (c.status = 'scheduled' AND c.publish_at <= NOW()))
        AND cp.is_approved = 1 AND cp.application_status = 'approved'${extraWhere}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offsetNum}
    `, params);
    // Strip media_url for non-free content — callers must use /stream-url JWT for actual playback
    const safe = (rows as any[]).map(r => ({
      ...r,
      media_url: r.access_type === 'free' ? r.media_url : null,
    }));
    res.json(safe);
  } catch (err) {
    console.error('[content] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch content.' });
  }
});

// GET /api/content/saved — list saved content for authenticated user
router.get('/saved', requireAuth, async (req, res) => {
  try {
    const rows = await query<any>(`
      SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar,
        cp.subscription_price as creator_subscription_price,
        (SELECT COUNT(*) FROM content_unlocks cu WHERE cu.content_id = c.id)::int as unlock_count,
        sc.saved_at
      FROM saved_content sc
      JOIN content c ON c.id = sc.content_id
      JOIN creator_profiles cp ON cp.id = c.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE sc.user_id = $1
        AND (c.status = 'approved' OR (c.status = 'scheduled' AND c.publish_at <= NOW()))
      ORDER BY sc.saved_at DESC
    `, [req.auth!.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved content.' });
  }
});

// GET /api/content/:id
// Public users only see approved or publish_at-elapsed scheduled content.
// The creator who owns the content and admins may see any status via Bearer token.
router.get('/:id', async (req, res) => {
  try {
    const row = await queryOne<any>(`
      SELECT c.*, cp.user_id AS creator_user_id,
        u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar,
        cp.subscription_price as creator_subscription_price,
        (SELECT COUNT(*) FROM content_unlocks cu WHERE cu.content_id = c.id) as unlock_count
      FROM content c
      JOIN creator_profiles cp ON cp.id = c.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE c.id = $1
    `, [req.params.id]);

    if (!row) { res.status(404).json({ error: 'Content not found' }); return; }

    const isPubliclyVisible =
      row.status === 'approved' ||
      (row.status === 'scheduled' && row.publish_at && new Date(row.publish_at) <= new Date());

    if (!isPubliclyVisible) {
      // Attempt optional auth — allow creator or admin to view non-public content
      const authHeader = req.headers.authorization;
      let allowed = false;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
          allowed = decoded.role === 'admin' || decoded.userId === row.creator_user_id;
        } catch {}
      }
      if (!allowed) { res.status(404).json({ error: 'Content not found' }); return; }
    }

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

    // Fans must not see non-public content at all — including free drafts that would leak media_url
    const isAdmin   = req.auth!.role === 'admin';
    const isCreator = content.creator_user_id === req.auth!.userId;
    if (!isAdmin && !isCreator) {
      const isPubliclyVisible =
        content.status === 'approved' ||
        (content.status === 'scheduled' && content.publish_at && new Date(content.publish_at) <= new Date());
      if (!isPubliclyVisible) { res.status(404).json({ error: 'Content not found' }); return; }
    }

    // Admin: unrestricted access to all content
    if (req.auth!.role === 'admin') {
      res.json({ unlocked: true, media_url: null, is_subscribed: false,
        discounted_price: null, is_admin_preview: true, is_creator_preview: false });
      return;
    }

    // Creator viewing their own content: no paywall, cannot purchase
    if (content.creator_user_id === req.auth!.userId) {
      res.json({ unlocked: true, media_url: null, is_subscribed: false,
        discounted_price: null, is_admin_preview: false, is_creator_preview: true });
      return;
    }

    if (content.access_type === 'free') {
      // Free content: return URL directly, no token needed
      res.json({ unlocked: true, media_url: content.media_url, is_subscribed: false,
        discounted_price: null, is_admin_preview: false, is_creator_preview: false });
      return;
    }

    // Check active subscription to this creator (cancelled-but-not-expired still grants access)
    const sub = await queryOne<{ id: string }>(
      `SELECT id FROM subscriptions
       WHERE subscriber_id = $1 AND creator_id = $2
         AND expires_at > NOW() AND status IN ('active','cancelled')`,
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
        // media_url omitted — client fetches via /api/content/:id/stream-url
        res.json({ unlocked: true, media_url: null, is_subscribed: true,
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
      // media_url omitted — client fetches via /api/content/:id/stream-url
      res.json({ unlocked: true, media_url: null, is_subscribed: isSubscribed,
        discounted_price: null, is_admin_preview: false, is_creator_preview: false });
    } else {
      res.json({ unlocked: false, media_url: null, is_subscribed: isSubscribed,
        discounted_price: discountedPrice, is_admin_preview: false, is_creator_preview: false });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to check access' });
  }
});

// GET /api/content/:id/stream-url — issue short-lived JWT to stream protected media
router.get('/:id/stream-url', requireAuth, async (req, res) => {
  try {
    const content = await queryOne<any>(
      `SELECT c.*, cp.user_id AS creator_user_id
       FROM content c
       JOIN creator_profiles cp ON cp.id = c.creator_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!content) { res.status(404).json({ error: 'Content not found' }); return; }

    const isAdmin   = req.auth!.role === 'admin';
    const isCreator = content.creator_user_id === req.auth!.userId;

    // Fans cannot stream non-public content
    if (!isAdmin && !isCreator) {
      const isPubliclyVisible =
        content.status === 'approved' ||
        (content.status === 'scheduled' && content.publish_at && new Date(content.publish_at) <= new Date());
      if (!isPubliclyVisible) { res.status(404).json({ error: 'Content not found' }); return; }
    }

    if (!isAdmin && !isCreator && content.access_type !== 'free') {
      if (content.access_type === 'subscribers') {
        const sub = await queryOne<{ id: string }>(
          `SELECT id FROM subscriptions
           WHERE subscriber_id = $1 AND creator_id = $2
             AND expires_at > NOW() AND status IN ('active','cancelled')`,
          [req.auth!.userId, content.creator_id]
        );
        if (!sub) { res.status(403).json({ error: 'Subscription required.' }); return; }
      }
      if (content.access_type === 'locked') {
        const unlock = await queryOne(
          'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
          [req.auth!.userId, req.params.id]
        );
        if (!unlock) { res.status(403).json({ error: 'Content not unlocked.' }); return; }
      }
    }

    const token = jwt.sign(
      { type: 'stream', contentId: req.params.id, userId: req.auth!.userId, role: req.auth!.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate stream token.' });
  }
});

// POST /api/content — create content record; defaults to draft
// status: 'draft' (default) or 'pending_review' — anything else is ignored
// publish_at: ISO timestamp; if set and future, admin approval will result in 'scheduled'
router.post('/', requireAuth, requireCreator, async (req, res) => {
  try {
    const { title, description, content_type, access_type, preview_url, media_url, price, publish_at } = req.body;
    const rawStatus = req.body.status;
    const status: 'draft' | 'pending_review' = rawStatus === 'pending_review' ? 'pending_review' : 'draft';
    console.log(`[content/create] userId=${req.auth!.userId} status=${status} content_type=${content_type}`);

    if (!title || !content_type || !access_type) {
      res.status(400).json({ error: 'title, content_type, and access_type are required.' });
      return;
    }

    // Media validation is required only when submitting for review, not for drafts
    if (status === 'pending_review' && content_type !== 'text') {
      if (!media_url) {
        res.status(400).json({ error: 'A media file is required for image, video, and audio content.' });
        return;
      }
      if (
        typeof media_url !== 'string' ||
        !media_url.startsWith('https://') ||
        media_url.startsWith('data:') ||
        media_url.startsWith('/media/')
      ) {
        res.status(400).json({ error: 'Invalid media URL. Complete the upload before publishing.' });
        return;
      }
    } else if (media_url) {
      // Any provided media URL (even on a draft) must be a real HTTPS URL
      if (
        typeof media_url !== 'string' ||
        !media_url.startsWith('https://') ||
        media_url.startsWith('data:') ||
        media_url.startsWith('/media/')
      ) {
        res.status(400).json({ error: 'Invalid media URL.' });
        return;
      }
    }

    // Validate publish_at if provided — must be a valid future timestamp
    let publishAt: string | null = null;
    if (publish_at) {
      const d = new Date(publish_at as string);
      if (!isNaN(d.getTime()) && d > new Date()) publishAt = d.toISOString();
    }

    const profile = await queryOne<any>(`
      SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id
      WHERE u.id = $1 AND cp.is_approved = 1 AND cp.application_status = 'approved'
    `, [req.auth!.userId]);

    if (!profile) { res.status(403).json({ error: 'Creator account not approved.' }); return; }

    const id = crypto.randomUUID();
    await execute(
      `INSERT INTO content (id, creator_id, title, description, content_type, access_type, preview_url, media_url, price, status, publish_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, profile.id, title, description ?? '', content_type, access_type,
       preview_url ?? null, media_url ?? null, price ?? 0, status, publishAt]
    );

    // First-post trigger fires only when submitting for review, not on drafts
    if (status === 'pending_review') {
      const countResult = await queryOne<{ n: string }>(
        `SELECT COUNT(*) as n FROM content WHERE creator_id = $1 AND status != 'draft'`,
        [profile.id]
      );
      if (parseInt(countResult?.n ?? '0', 10) === 1) {
        triggerCreatorFirstPost(req.auth!.userId).catch(console.error);
      }
    }

    const message = status === 'draft' ? 'Draft saved.' : 'Content submitted for review.';
    res.status(201).json({ id, status, message });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload content.' });
  }
});

// PATCH /api/content/:id — creator update own editable content
// Editable when status is: draft, rejected, changes_requested, or failed_processing
// For rejected/changes_requested: automatically moves to pending_review and clears rejection_reason
router.patch('/:id', requireAuth, requireCreator, async (req, res) => {
  try {
    console.log(`[content/patch] userId=${req.auth!.userId} contentId=${req.params.id}`);
    const row = await queryOne<any>(
      `SELECT c.id, c.status, c.content_type, c.media_url FROM content c
       JOIN creator_profiles cp ON cp.id = c.creator_id
       WHERE c.id = $1 AND cp.user_id = $2`,
      [req.params.id, req.auth!.userId]
    );
    if (!row) { res.status(404).json({ error: 'Content not found.' }); return; }

    const editableStatuses = ['draft', 'rejected', 'changes_requested', 'failed_processing'];
    if (!editableStatuses.includes(row.status)) {
      res.status(409).json({ error: `Content in '${row.status}' state cannot be edited.` });
      return;
    }

    const { title, description, access_type, price, preview_url, media_url, publish_at, max_unlocks, subscriber_discount_pct } = req.body;
    const isResubmit = ['rejected', 'changes_requested'].includes(row.status);

    // Title cannot be empty when resubmitting
    if (title !== undefined && typeof title === 'string' && !title.trim()) {
      res.status(400).json({ error: 'Title cannot be empty.' }); return;
    }
    if (isResubmit && title !== undefined && typeof title !== 'string') {
      res.status(400).json({ error: 'Title must be a string.' }); return;
    }

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        res.status(400).json({ error: 'Price must be a non-negative number.' }); return;
      }
    }

    if (access_type !== undefined && !['free', 'locked', 'subscribers'].includes(access_type)) {
      res.status(400).json({ error: 'Invalid access_type.' }); return;
    }
    if (media_url !== undefined && media_url !== null) {
      if (typeof media_url !== 'string' || !media_url.startsWith('https://') || media_url.startsWith('data:') || media_url.startsWith('/media/')) {
        res.status(400).json({ error: 'Invalid media URL.' }); return;
      }
    }
    if (publish_at !== undefined && publish_at !== null) {
      const d = new Date(publish_at as string);
      if (isNaN(d.getTime()) || d <= new Date()) {
        res.status(400).json({ error: 'publish_at must be a valid future date.' }); return;
      }
    }

    // For resubmit: verify non-text content still has media (use existing if not updating)
    const effectiveMediaUrl = media_url !== undefined ? media_url : row.media_url;
    if (isResubmit && row.content_type !== 'text' && !effectiveMediaUrl) {
      res.status(400).json({ error: 'A media file is required before resubmitting.' }); return;
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [];
    let pIdx = 1;

    if (title               !== undefined) { setClauses.push(`title = $${pIdx++}`);                vals.push(title); }
    if (description         !== undefined) { setClauses.push(`description = $${pIdx++}`);          vals.push(description); }
    if (access_type         !== undefined) { setClauses.push(`access_type = $${pIdx++}`);          vals.push(access_type); }
    if (price               !== undefined) { setClauses.push(`price = $${pIdx++}`);                vals.push(price); }
    if (preview_url         !== undefined) { setClauses.push(`preview_url = $${pIdx++}`);          vals.push(preview_url ?? null); }
    if (media_url           !== undefined) { setClauses.push(`media_url = $${pIdx++}`);            vals.push(media_url ?? null); }
    if (publish_at          !== undefined) { setClauses.push(`publish_at = $${pIdx++}`);           vals.push(publish_at ? new Date(publish_at as string).toISOString() : null); }
    if (max_unlocks         !== undefined) { setClauses.push(`max_unlocks = $${pIdx++}`);          vals.push(max_unlocks ?? null); }
    if (subscriber_discount_pct !== undefined) { setClauses.push(`subscriber_discount_pct = $${pIdx++}`); vals.push(subscriber_discount_pct); }

    // Auto-resubmit: rejected/changes_requested → pending_review, clear rejection_reason
    if (isResubmit) {
      setClauses.push(`status = 'pending_review'`);
      setClauses.push(`rejection_reason = NULL`);
    }

    vals.push(req.params.id);
    await execute(`UPDATE content SET ${setClauses.join(', ')} WHERE id = $${pIdx}`, vals);

    const updated = await queryOne<any>('SELECT * FROM content WHERE id = $1', [req.params.id]);
    res.json({ success: true, resubmitted: isResubmit, content: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update content.' });
  }
});

// DELETE /api/content/:id — creator delete own draft (only draft status allowed)
router.delete('/:id', requireAuth, requireCreator, async (req, res) => {
  try {
    const row = await queryOne<{ status: string }>(
      `SELECT c.status FROM content c
       JOIN creator_profiles cp ON cp.id = c.creator_id
       WHERE c.id = $1 AND cp.user_id = $2`,
      [req.params.id, req.auth!.userId]
    );
    if (!row) { res.status(404).json({ error: 'Content not found.' }); return; }
    if (row.status !== 'draft') {
      res.status(409).json({ error: 'Only draft content can be deleted.' }); return;
    }
    await execute('DELETE FROM content WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete content.' });
  }
});

// POST /api/content/:id/submit — submit draft (or rejected/changes_requested) for review
router.post('/:id/submit', requireAuth, requireCreator, async (req, res) => {
  try {
    console.log(`[content/submit] received | userId=${req.auth!.userId} contentId=${req.params.id}`);
    const row = await queryOne<any>(
      `SELECT c.id, c.status, c.content_type, c.media_url FROM content c
       JOIN creator_profiles cp ON cp.id = c.creator_id
       WHERE c.id = $1 AND cp.user_id = $2`,
      [req.params.id, req.auth!.userId]
    );
    if (!row) {
      console.log(`[content/submit] not found | userId=${req.auth!.userId} contentId=${req.params.id}`);
      res.status(404).json({ error: 'Content not found.' }); return;
    }
    console.log(`[content/submit] found | status=${row.status} content_type=${row.content_type} has_media=${!!row.media_url}`);

    if (!['draft', 'rejected', 'changes_requested'].includes(row.status)) {
      console.log(`[content/submit] rejected non-submittable status | status=${row.status}`);
      res.status(409).json({ error: `Content in '${row.status}' state cannot be submitted.` }); return;
    }
    if (row.content_type !== 'text' && !row.media_url) {
      console.log(`[content/submit] rejected missing media | content_type=${row.content_type}`);
      res.status(400).json({ error: 'A media file is required before submitting for review.' }); return;
    }

    await execute(
      `UPDATE content SET status = 'pending_review', rejection_reason = NULL, updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    console.log(`[content/submit] success | contentId=${req.params.id} → pending_review`);

    // First-post trigger: fire when a creator's first non-draft is submitted
    const profile = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1', [req.auth!.userId]
    );
    if (profile) {
      const countResult = await queryOne<{ n: string }>(
        `SELECT COUNT(*) as n FROM content WHERE creator_id = $1 AND status != 'draft'`,
        [profile.id]
      );
      if (parseInt(countResult?.n ?? '0', 10) === 1) {
        triggerCreatorFirstPost(req.auth!.userId).catch(console.error);
      }
    }

    res.json({ success: true, status: 'pending_review' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit content.' });
  }
});

// POST /api/content/:id/schedule — set a future publish_at and submit for review
// After admin approval the status becomes 'scheduled' until publish_at is reached
router.post('/:id/schedule', requireAuth, requireCreator, async (req, res) => {
  try {
    const { publish_at } = req.body;
    if (!publish_at) { res.status(400).json({ error: 'publish_at is required.' }); return; }

    const publishDate = new Date(publish_at as string);
    if (isNaN(publishDate.getTime()) || publishDate <= new Date()) {
      res.status(400).json({ error: 'publish_at must be a valid future date.' }); return;
    }

    const row = await queryOne<any>(
      `SELECT c.id, c.status, c.content_type, c.media_url FROM content c
       JOIN creator_profiles cp ON cp.id = c.creator_id
       WHERE c.id = $1 AND cp.user_id = $2`,
      [req.params.id, req.auth!.userId]
    );
    if (!row) { res.status(404).json({ error: 'Content not found.' }); return; }

    if (!['draft', 'rejected', 'changes_requested'].includes(row.status)) {
      res.status(409).json({ error: `Content in '${row.status}' state cannot be scheduled.` }); return;
    }
    if (row.content_type !== 'text' && !row.media_url) {
      res.status(400).json({ error: 'A media file is required before scheduling.' }); return;
    }

    await execute(
      `UPDATE content SET status = 'pending_review', publish_at = $1, rejection_reason = NULL, updated_at = NOW() WHERE id = $2`,
      [publishDate.toISOString(), req.params.id]
    );
    res.json({ success: true, status: 'pending_review', publish_at: publishDate.toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule content.' });
  }
});

// POST /api/content/:id/cancel-schedule — revert approved scheduled content back to draft
router.post('/:id/cancel-schedule', requireAuth, requireCreator, async (req, res) => {
  try {
    const row = await queryOne<{ status: string }>(
      `SELECT c.status FROM content c
       JOIN creator_profiles cp ON cp.id = c.creator_id
       WHERE c.id = $1 AND cp.user_id = $2`,
      [req.params.id, req.auth!.userId]
    );
    if (!row) { res.status(404).json({ error: 'Content not found.' }); return; }
    if (row.status !== 'scheduled') {
      res.status(409).json({ error: 'Only scheduled content can be cancelled.' }); return;
    }
    await execute(
      `UPDATE content SET status = 'draft', publish_at = NULL, updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true, status: 'draft' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel scheduled publish.' });
  }
});

// POST /api/content/:id/unlock — admin-only manual unlock (no payment required)
// All user-facing unlocks go through /api/checkout/create → Stripe → webhook → fulfillment.
// This route is retained for admin support purposes only.
router.post('/:id/unlock', requireAuth, async (req, res) => {
  if (req.auth!.role !== 'admin') {
    res.status(403).json({ error: 'Payment required. Use the checkout flow to unlock content.' });
    return;
  }

  try {
    const content = await queryOne<any>('SELECT * FROM content WHERE id = $1', [req.params.id]);
    if (!content) { res.status(404).json({ error: 'Content not found' }); return; }

    if (content.access_type === 'free') { res.json({ unlocked: true }); return; }

    const alreadyUnlocked = await queryOne(
      'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
      [req.auth!.userId, req.params.id]
    );
    if (alreadyUnlocked) { res.json({ unlocked: true }); return; }

    const PLATFORM_FEE_RATE = 0.3;
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

// POST /api/content/:id/save — save content (only publicly visible content)
router.post('/:id/save', requireAuth, async (req, res) => {
  try {
    const content = await queryOne<any>('SELECT id, status, publish_at FROM content WHERE id = $1', [req.params.id]);
    if (!content) { res.status(404).json({ error: 'Content not found.' }); return; }

    const isPubliclyVisible =
      content.status === 'approved' ||
      (content.status === 'scheduled' && content.publish_at && new Date(content.publish_at) <= new Date());
    if (!isPubliclyVisible && req.auth!.role !== 'admin') {
      res.status(404).json({ error: 'Content not found.' }); return;
    }

    const id = crypto.randomUUID();
    await execute(
      'INSERT INTO saved_content (id, user_id, content_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, content_id) DO NOTHING',
      [id, req.auth!.userId, req.params.id]
    );
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save content.' });
  }
});

// DELETE /api/content/:id/save — unsave content
router.delete('/:id/save', requireAuth, async (req, res) => {
  try {
    await execute(
      'DELETE FROM saved_content WHERE user_id = $1 AND content_id = $2',
      [req.auth!.userId, req.params.id]
    );
    res.json({ saved: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unsave content.' });
  }
});

// GET /api/content/:id/is-saved — check if current user saved this
router.get('/:id/is-saved', requireAuth, async (req, res) => {
  try {
    const row = await queryOne(
      'SELECT id FROM saved_content WHERE user_id = $1 AND content_id = $2',
      [req.auth!.userId, req.params.id]
    );
    res.json({ saved: !!row });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check save status.' });
  }
});

export default router;
