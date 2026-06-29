import { Router } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { query, queryOne, execute } from '../db/schema.js';
import { requireAuth, requireCreator } from '../middleware/auth.js';
import { requireFlag } from '../middleware/featureGate.js';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? process.env.CLIENT_URL ?? 'https://www.archangelsclub.com';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// GET /api/creators — list approved creators
router.get('/', async (req, res) => {
  try {
    const { tag, sort = 'popular', q } = req.query;

    let sql = `
      SELECT cp.*, u.display_name, u.username, u.avatar_url, u.is_verified_creator,
        (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') as subscriber_count,
        (SELECT COUNT(*) FROM content c WHERE c.creator_id = cp.id AND (c.status = 'approved' OR (c.status = 'scheduled' AND c.publish_at <= NOW()))) as content_count,
        (SELECT c2.media_url FROM content c2
           WHERE c2.creator_id = cp.id AND c2.content_type = 'video' AND c2.media_url IS NOT NULL
             AND (c2.status = 'approved' OR (c2.status = 'scheduled' AND c2.publish_at <= NOW()))
           ORDER BY c2.created_at DESC LIMIT 1) as preview_video_url
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.is_approved = 1
    `;

    const params: unknown[] = [];
    let idx = 1;

    if (q) {
      sql += ` AND (u.display_name ILIKE $${idx} OR cp.bio ILIKE $${idx + 1} OR u.username ILIKE $${idx + 2})`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      idx += 3;
    }

    if (tag) {
      sql += ` AND cp.tags ILIKE $${idx}`;
      params.push(`%${tag}%`);
      idx++;
    }

    const orderMap: Record<string, string> = {
      popular: 'subscriber_count DESC',
      newest: 'cp.created_at DESC',
      'price-low': 'cp.subscription_price ASC',
      'price-high': 'cp.subscription_price DESC',
    };
    sql += ` ORDER BY ${orderMap[sort as string] ?? 'subscriber_count DESC'}`;

    const rows = await query<any>(sql, params);
    res.json(rows.map((r) => ({ ...r, tags: JSON.parse(r.tags ?? '[]') })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch creators.' });
  }
});

// GET /api/creators/stats — public platform stats for landing page
router.get('/stats', async (_req, res) => {
  try {
    const [creators, members, content] = await Promise.all([
      queryOne<{ n: string }>(`SELECT COUNT(*) as n FROM creator_profiles WHERE is_approved = 1`),
      queryOne<{ n: string }>(`SELECT COUNT(*) as n FROM users WHERE status = 'approved'`),
      queryOne<{ n: string }>(`SELECT COUNT(*) as n FROM content WHERE status = 'approved' OR (status = 'scheduled' AND publish_at <= NOW())`),
    ]);
    res.json({
      creator_count: parseInt(creators?.n ?? '0'),
      member_count: parseInt(members?.n ?? '0'),
      content_count: parseInt(content?.n ?? '0'),
    });
  } catch {
    res.json({ creator_count: 0, member_count: 0, content_count: 0 });
  }
});

// POST /api/creators/apply — authenticated user submits creator application
router.post('/apply', requireAuth, requireFlag('enable_creator_onboarding'), async (req, res) => {
  try {
    const { bio, tags, categories, subscription_price, starting_price, pitch } = req.body;

    if (!bio || String(bio).trim().length < 10) {
      res.status(400).json({ error: 'Bio is required (min 10 characters).' });
      return;
    }

    // Prevent duplicates
    const existing = await queryOne<{ id: string; application_status: string }>(
      'SELECT id, application_status FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (existing) {
      res.status(409).json({
        error: 'You already have a creator application.',
        id: existing.id,
        status: existing.application_status,
      });
      return;
    }

    const id = crypto.randomUUID();
    const tagsArr = Array.isArray(tags)
      ? tags
      : String(tags ?? '').split(',').map((t: string) => t.trim()).filter(Boolean);
    const catsArr = Array.isArray(categories) ? categories : [];

    await execute(
      `INSERT INTO creator_profiles
         (id, user_id, bio, tags, content_categories, subscription_price, starting_price, pitch, application_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
      [id, req.auth!.userId, String(bio).trim(),
       JSON.stringify(tagsArr), JSON.stringify(catsArr),
       parseFloat(subscription_price) || 9.99,
       parseFloat(starting_price) || 4.99,
       String(pitch ?? '').trim()]
    );

    console.log(`[creator/apply] application submitted userId=${req.auth!.userId} profileId=${id}`);
    res.status(201).json({ success: true, id, status: 'pending' });
  } catch (err) {
    console.error('[creator/apply] error:', err);
    res.status(500).json({ error: 'Failed to submit application.' });
  }
});

// GET /api/creators/my/stats — creator's own stats (must be before /:username)
router.get('/my/stats', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string; total_earnings: string; subscription_price: string; starting_price: string }>(
      'SELECT id, total_earnings, subscription_price, starting_price FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Creator profile not found.' }); return; }

    const [subs, unlocks, tips, posts] = await Promise.all([
      queryOne<{ n: string }>(
        `SELECT COUNT(*) as n FROM subscriptions
         WHERE creator_id = $1 AND expires_at > NOW() AND status IN ('active','cancelled')`,
        [profile.id]
      ),
      queryOne<{ n: string; total: string }>(
        `SELECT COUNT(*) as n, COALESCE(SUM(net_amount), 0) as total
         FROM transactions WHERE payee_id = $1 AND ref_type = 'content' AND status = 'completed'`,
        [req.auth!.userId]
      ),
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(net_amount), 0) as total
         FROM transactions WHERE payee_id = $1 AND ref_type = 'tip' AND status = 'completed'`,
        [req.auth!.userId]
      ),
      queryOne<{ n: string }>(
        `SELECT COUNT(*) as n FROM content WHERE creator_id = $1`,
        [profile.id]
      ),
    ]);

    res.json({
      total_earnings: parseFloat(profile.total_earnings) || 0,
      subscriber_count: parseInt(subs?.n ?? '0', 10),
      content_unlocks: parseInt(unlocks?.n ?? '0', 10),
      tips_total: parseFloat(tips?.total ?? '0'),
      content_count: parseInt(posts?.n ?? '0', 10),
      subscription_price: parseFloat(profile.subscription_price) || 9.99,
      starting_price: parseFloat(profile.starting_price) || 4.99,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// GET /api/creators/my/transactions — creator's recent earnings (must be before /:username)
router.get('/my/transactions', requireAuth, requireCreator, async (req, res) => {
  try {
    const rows = await query(`
      SELECT t.id, t.ref_type, t.amount, t.net_amount, t.created_at,
             payer.display_name as payer_name,
             c.title as content_title
      FROM transactions t
      JOIN users payer ON payer.id = t.payer_id
      LEFT JOIN content c ON c.id = t.ref_id AND t.ref_type = 'content'
      WHERE t.payee_id = $1 AND t.status = 'completed'
      ORDER BY t.created_at DESC
      LIMIT 20
    `, [req.auth!.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

// GET /api/creators/my/content — authenticated creator's own content, all statuses
// Query params: status, content_type, limit (max 100), offset
router.get('/my/content', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (!profile) { res.json([]); return; }

    // Optional filters
    const rawStatus      = typeof req.query.status       === 'string' ? req.query.status       : null;
    const rawContentType = typeof req.query.content_type === 'string' ? req.query.content_type : null;
    const limit          = Math.min(Math.max(parseInt(req.query.limit  as string, 10) || 100, 1), 100);
    const offset         = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    // Validate optional filter values against allowed sets to prevent injection
    const VALID_STATUSES      = new Set(['draft', 'pending_review', 'approved', 'rejected', 'removed', 'scheduled', 'changes_requested', 'failed_processing']);
    const VALID_CONTENT_TYPES = new Set(['image', 'video', 'audio', 'text']);
    const statusFilter      = rawStatus      && VALID_STATUSES.has(rawStatus)      ? rawStatus      : null;
    const contentTypeFilter = rawContentType && VALID_CONTENT_TYPES.has(rawContentType) ? rawContentType : null;

    const params: unknown[] = [profile.id];
    let extraWhere = '';
    let paramIdx = 2;

    if (statusFilter) {
      extraWhere += ` AND c.status = $${paramIdx++}`;
      params.push(statusFilter);
    }
    if (contentTypeFilter) {
      extraWhere += ` AND c.content_type = $${paramIdx++}`;
      params.push(contentTypeFilter);
    }
    params.push(limit, offset);

    const rows = await query(`
      SELECT
        c.id,
        c.title,
        c.description,
        c.content_type,
        c.access_type,
        c.price,
        c.status,
        c.preview_url,
        c.media_url,
        c.max_unlocks,
        c.available_until,
        c.subscriber_discount_pct,
        c.publish_at,
        c.updated_at,
        c.rejection_reason,
        c.created_at,
        (SELECT COUNT(*) FROM content_unlocks cu WHERE cu.content_id = c.id)::int AS unlock_count
      FROM content c
      WHERE c.creator_id = $1${extraWhere}
      ORDER BY c.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, params);

    // Enrich with computed fields; return all DB values directly now that schema has them
    const enriched = (rows as any[]).map(r => ({
      id:                      r.id,
      title:                   r.title || 'Untitled Drop',
      caption:                 r.description ?? '',
      content_type:            r.content_type,
      access_type:             r.access_type,
      price:                   Number(r.price) || 0,
      status:                  r.status,
      preview_url:             r.preview_url ?? null,
      thumbnail_url:           r.preview_url ?? null,   // no separate thumbnail column
      media_url:               r.media_url ?? null,     // creator may access own media_url
      max_unlocks:             r.max_unlocks ?? null,
      available_until:         r.available_until ?? null,
      subscriber_discount_pct: Number(r.subscriber_discount_pct) || 0,
      unlock_count:            Number(r.unlock_count) || 0,
      earnings_estimate:       Math.round(Number(r.price) * Number(r.unlock_count) * 0.7 * 100) / 100,
      created_at:              r.created_at,
      updated_at:              r.updated_at ?? r.created_at,
      scheduled_for:           r.publish_at ?? null,
      rejection_reason:        r.rejection_reason ?? null,
    }));

    res.json(enriched);
  } catch (err) {
    console.error('[creators/my/content] error:', err);
    res.status(500).json({ error: 'Failed to fetch content.' });
  }
});

// GET /api/creators/my/onboarding — computed onboarding step state
router.get('/my/onboarding', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{
      id: string;
      bio: string;
      cover_image_url: string | null;
      subscription_price: string;
      stripe_onboarding_complete: number;
      custom_requests_enabled: number;
      onboarding_dismissed: number;
      training_viewed: number;
      total_earnings: string;
    }>(
      `SELECT id, bio, cover_image_url, subscription_price, stripe_onboarding_complete,
              custom_requests_enabled, onboarding_dismissed, training_viewed, total_earnings
       FROM creator_profiles WHERE user_id = $1`,
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Creator profile not found.' }); return; }

    const contentRow = await queryOne<{ n: string }>(
      `SELECT COUNT(*) as n FROM content WHERE creator_id = $1`,
      [profile.id]
    );

    const totalEarnings = parseFloat(profile.total_earnings) || 0;

    res.json({
      steps: {
        profile_complete: profile.bio.trim().length >= 50 && !!profile.cover_image_url,
        payout_setup: profile.stripe_onboarding_complete === 1,
        first_upload: parseInt(contentRow?.n ?? '0', 10) > 0,
        subscription_price_set: parseFloat(profile.subscription_price) !== 9.99,
        custom_requests_enabled: profile.custom_requests_enabled === 1,
        training_viewed: profile.training_viewed === 1,
      },
      dismissed: profile.onboarding_dismissed === 1,
      total_earnings: totalEarnings,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch onboarding state.' });
  }
});

// GET /api/creators/my/requests — creator's custom requests (must be before /:username)
router.get('/my/requests', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1', [req.auth!.userId]
    );
    if (!profile) { res.json([]); return; }

    const rows = await query(`
      SELECT cr.id, cr.description, cr.offered_price, cr.status, cr.created_at,
             u.display_name as fan_name, u.avatar_url as fan_avatar
      FROM custom_requests cr
      JOIN users u ON u.id = cr.fan_id
      WHERE cr.creator_id = $1
      ORDER BY cr.created_at DESC
      LIMIT 20
    `, [profile.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests.' });
  }
});

// GET /api/creators/my/health — rules-based creator health score
router.get('/my/health', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<any>(
      `SELECT cp.*, u.display_name, u.avatar_url
       FROM creator_profiles cp JOIN users u ON u.id = cp.user_id
       WHERE cp.user_id = $1`,
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Creator profile not found.' }); return; }

    const [subRow, contentRow, unlockRow, requestRow, recentUploadRow] = await Promise.all([
      queryOne<{ total: string; new_30d: string }>(
        `SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '30 days') AS new_30d
         FROM subscriptions WHERE creator_id = $1 AND status = 'active'`,
        [profile.id]
      ),
      queryOne<{ approved: string; total: string }>(
        `SELECT COUNT(*) FILTER (WHERE status = 'approved') AS approved, COUNT(*) AS total
         FROM content WHERE creator_id = $1`,
        [profile.id]
      ),
      queryOne<{ n: string }>(
        `SELECT COUNT(*) AS n FROM content_unlocks cu
         JOIN content c ON c.id = cu.content_id
         WHERE c.creator_id = $1`,
        [profile.id]
      ),
      queryOne<{ total: string; responded: string }>(
        `SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status IN ('accepted','rejected','completed')) AS responded
         FROM custom_requests WHERE creator_id = $1`,
        [profile.id]
      ),
      queryOne<{ last_at: string | null }>(
        `SELECT MAX(created_at) AS last_at FROM content WHERE creator_id = $1 AND status = 'approved'`,
        [profile.id]
      ),
    ]);

    const subs = parseInt(subRow?.total ?? '0');
    const newSubs30d = parseInt(subRow?.new_30d ?? '0');
    const approvedContent = parseInt(contentRow?.approved ?? '0');
    const totalUnlocks = parseInt(unlockRow?.n ?? '0');
    const totalRequests = parseInt(requestRow?.total ?? '0');
    const respondedRequests = parseInt(requestRow?.responded ?? '0');

    const daysSinceUpload = recentUploadRow?.last_at
      ? (Date.now() - new Date(recentUploadRow.last_at).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    const subsScore = Math.min(subs / 50 * 25, 25);
    const contentScore = Math.min(approvedContent / 10 * 20, 20);
    const unlockScore = approvedContent > 0 ? Math.min((totalUnlocks / approvedContent) / 3 * 20, 20) : 0;
    const requestScore = totalRequests > 0 ? (respondedRequests / totalRequests) * 15 : 10;
    const recencyScore = daysSinceUpload < 7 ? 20 : daysSinceUpload < 14 ? 15 : daysSinceUpload < 30 ? 8 : 0;

    const score = Math.round(subsScore + contentScore + unlockScore + requestScore + recencyScore);
    const level = score >= 80 ? 'Elite' : score >= 60 ? 'Rising' : score >= 40 ? 'Active' : score >= 20 ? 'Building' : 'New';

    const signals: { label: string; ok: boolean; note: string }[] = [
      { label: 'Content Library', ok: approvedContent >= 3, note: approvedContent >= 3 ? `${approvedContent} approved drops` : `${approvedContent} approved — aim for 3+` },
      { label: 'Audience Growth', ok: newSubs30d > 0, note: newSubs30d > 0 ? `+${newSubs30d} subscribers this month` : 'No new subscribers this month' },
      { label: 'Upload Consistency', ok: daysSinceUpload < 14, note: daysSinceUpload < 7 ? 'Uploaded this week' : daysSinceUpload < 14 ? 'Uploaded recently' : `${Math.round(daysSinceUpload)} days since last drop` },
      { label: 'Custom Requests', ok: totalRequests === 0 || respondedRequests / totalRequests > 0.5, note: totalRequests === 0 ? 'No requests yet' : `${respondedRequests}/${totalRequests} responded` },
      { label: 'Payout Ready', ok: profile.stripe_onboarding_complete === 1, note: profile.stripe_onboarding_complete === 1 ? 'Stripe connected' : 'Connect Stripe to receive payouts' },
    ];

    res.json({ score, level, signals, subs, approvedContent, totalUnlocks });
  } catch (err) {
    console.error('[creators/my/health] error:', err);
    res.status(500).json({ error: 'Failed to compute health score.' });
  }
});

// ─── STRIPE CONNECT ONBOARDING ───────────────────────────────────────────────

// POST /api/creators/connect/onboard
// Creates or resumes a Stripe Connect Express account for the creator.
// Called when creator clicks "Enable Payouts".
router.post('/connect/onboard', requireAuth, requireCreator, async (req, res) => {
  try {
    const stripe = getStripe();

    // Auto-create creator profile if the approved creator somehow lacks one
    await execute(
      `INSERT INTO creator_profiles (id, user_id, bio, is_approved, application_status)
       VALUES ($1, $2, '', 1, 'approved')
       ON CONFLICT (user_id) DO NOTHING`,
      [crypto.randomUUID(), req.auth!.userId]
    );

    const profile = await queryOne<{
      id: string;
      stripe_account_id: string | null;
      stripe_onboarding_complete: number;
    }>(
      `SELECT id, stripe_account_id, stripe_onboarding_complete
       FROM creator_profiles WHERE user_id = $1`,
      [req.auth!.userId]
    );

    if (!profile) {
      res.status(500).json({ error: 'Failed to initialize creator profile.' });
      return;
    }

    // Already fully onboarded — nothing to do
    if (profile.stripe_onboarding_complete === 1 && profile.stripe_account_id) {
      res.json({ already_complete: true });
      return;
    }

    let stripeAccountId = profile.stripe_account_id;

    // Create a new Connect Express account if one doesn't exist yet
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
        settings: {
          payouts: {
            schedule: { interval: 'weekly', weekly_anchor: 'friday' },
          },
        },
      });

      stripeAccountId = account.id;

      await execute(
        `UPDATE creator_profiles
           SET stripe_account_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [stripeAccountId, profile.id]
      );

      console.log('[connect/onboard] created Stripe Connect account=%s for creator=%s',
        stripeAccountId, profile.id);
    }

    // Always generate a fresh Account Link (they expire after ~5 minutes)
    const accountLink = await stripe.accountLinks.create({
      account:     stripeAccountId,
      refresh_url: `${FRONTEND_URL}/studio?connect=refresh`,
      return_url:  `${FRONTEND_URL}/studio?connect=complete`,
      type:        'account_onboarding',
    });

    console.log('[connect/onboard] generated account link for account=%s', stripeAccountId);
    res.json({ url: accountLink.url });

  } catch (err) {
    const stripeErr = err as any;
    if (stripeErr?.type?.startsWith('Stripe')) {
      console.error('[connect/onboard] Stripe error — type:%s code:%s message:%s',
        stripeErr.type, stripeErr.code, stripeErr.message);
      if (stripeErr.message?.includes('managing losses') || stripeErr.message?.includes('platform-profile')) {
        res.status(503).json({ error: 'Payout setup is temporarily unavailable. Please try again later.' });
        return;
      }
    } else {
      console.error('[connect/onboard] error:', err);
    }
    res.status(500).json({ error: 'Payout setup failed. Please try again.' });
  }
});

// GET /api/creators/connect/status
// Verifies onboarding is complete after Stripe redirects back.
// Marks stripe_onboarding_complete = 1 in DB if account is ready.
router.get('/connect/status', requireAuth, requireCreator, async (req, res) => {
  try {
    const stripe = getStripe();

    const profile = await queryOne<{
      id: string;
      stripe_account_id: string | null;
      stripe_onboarding_complete: number;
    }>(
      `SELECT id, stripe_account_id, stripe_onboarding_complete
       FROM creator_profiles WHERE user_id = $1`,
      [req.auth!.userId]
    );

    if (!profile) {
      res.status(404).json({ error: 'Creator profile not found.' });
      return;
    }

    if (!profile.stripe_account_id) {
      res.json({ complete: false, reason: 'No Stripe account linked yet.' });
      return;
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    const isComplete =
      account.details_submitted &&
      !account.requirements?.currently_due?.length &&
      !account.requirements?.past_due?.length;

    if (isComplete && profile.stripe_onboarding_complete !== 1) {
      await execute(
        `UPDATE creator_profiles
           SET stripe_onboarding_complete = 1, updated_at = NOW()
         WHERE id = $1`,
        [profile.id]
      );
      console.log('[connect/status] onboarding complete for creator=%s account=%s',
        profile.id, profile.stripe_account_id);
    }

    res.json({
      complete:          isComplete || profile.stripe_onboarding_complete === 1,
      details_submitted: account.details_submitted,
      payouts_enabled:   account.payouts_enabled,
      charges_enabled:   account.charges_enabled,
      currently_due:     account.requirements?.currently_due ?? [],
      past_due:          account.requirements?.past_due ?? [],
    });

  } catch (err) {
    console.error('[connect/status] error:', err);
    res.status(500).json({ error: 'Failed to check payout status.' });
  }
});

// GET /api/creators/connect/dashboard
// Returns a Stripe Express dashboard login link for the creator.
router.get('/connect/dashboard', requireAuth, requireCreator, async (req, res) => {
  try {
    const stripe = getStripe();

    const profile = await queryOne<{
      id: string;
      stripe_account_id: string | null;
      stripe_onboarding_complete: number;
    }>(
      `SELECT id, stripe_account_id, stripe_onboarding_complete
       FROM creator_profiles WHERE user_id = $1`,
      [req.auth!.userId]
    );

    if (!profile?.stripe_account_id) {
      res.status(400).json({ error: 'Payout account not set up yet.' });
      return;
    }

    if (profile.stripe_onboarding_complete !== 1) {
      res.status(400).json({ error: 'Payout onboarding not complete.' });
      return;
    }

    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
    res.json({ url: loginLink.url });

  } catch (err) {
    console.error('[connect/dashboard] error:', err);
    res.status(500).json({ error: 'Failed to generate payout dashboard link.' });
  }
});

// GET /api/creators/trending — rules-based trending (most activity this week)
router.get('/trending', async (_req, res) => {
  try {
    const rows = await query<any>(
      `SELECT cp.id, u.display_name, u.username, u.avatar_url, u.is_verified_creator,
         cp.subscription_price, cp.tags, cp.bio,
         (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') AS subscriber_count,
         (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.started_at > NOW() - INTERVAL '7 days') AS new_subs_7d,
         (SELECT COUNT(*) FROM content_unlocks cu JOIN content c ON c.id = cu.content_id WHERE c.creator_id = cp.id AND cu.unlocked_at > NOW() - INTERVAL '7 days') AS unlocks_7d,
         (SELECT COUNT(*) FROM content c WHERE c.creator_id = cp.id AND (c.status = 'approved' OR (c.status = 'scheduled' AND c.publish_at <= NOW()))) AS content_count
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.is_approved = 1 AND u.status = 'approved'
       ORDER BY (new_subs_7d * 3 + unlocks_7d) DESC
       LIMIT 12`,
      []
    );
    res.json(rows.map(r => ({ ...r, tags: JSON.parse(r.tags ?? '[]') })));
  } catch (err) {
    console.error('[creators/trending] error:', err);
    res.status(500).json({ error: 'Failed to fetch trending creators.' });
  }
});

// GET /api/creators/:username
router.get('/:username', async (req, res) => {
  try {
    const slug = req.params.username.toLowerCase();
    console.log('[creator lookup]', slug);

    const row = await queryOne<any>(`
      SELECT cp.*, u.display_name, u.username, u.avatar_url, u.is_verified_creator,
        (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') as subscriber_count,
        (SELECT COUNT(*) FROM content c WHERE c.creator_id = cp.id AND (c.status = 'approved' OR (c.status = 'scheduled' AND c.publish_at <= NOW()))) as content_count
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE LOWER(u.username) = $1
         OR LOWER(REPLACE(u.display_name, ' ', '')) = $1
    `, [slug]);

    if (!row) {
      console.log('[creator lookup] not found:', slug);
      res.status(404).json({
        error: 'Creator not found',
        slug,
        hint: 'Check /api/debug/creators to see all creator slugs in the database',
      });
      return;
    }
    res.json({ ...row, tags: JSON.parse(row.tags ?? '[]') });
  } catch (err) {
    console.error('[creator lookup] error:', err);
    res.status(500).json({ error: 'Failed to fetch creator.' });
  }
});

// GET /api/creators/:username/content
router.get('/:username/content', async (req, res) => {
  try {
    const slug = req.params.username.toLowerCase();
    const creator = await queryOne<any>(`
      SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id
      WHERE LOWER(u.username) = $1 OR LOWER(REPLACE(u.display_name, ' ', '')) = $1
    `, [slug]);

    if (!creator) { res.status(404).json({ error: 'Creator not found' }); return; }

    const rows = await query(`
      SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar
      FROM content c
      JOIN creator_profiles cp ON cp.id = c.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE c.creator_id = $1
        AND (c.status = 'approved' OR (c.status = 'scheduled' AND c.publish_at <= NOW()))
      ORDER BY c.created_at DESC
    `, [creator.id]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch creator content.' });
  }
});

// GET /api/creators/:username/similar — other approved creators ordered by subscribers
router.get('/:username/similar', async (req, res) => {
  try {
    const slug = req.params.username.toLowerCase();
    const creator = await queryOne<{ id: string }>(
      `SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id
       WHERE LOWER(u.username) = $1 OR LOWER(REPLACE(u.display_name, ' ', '')) = $1`,
      [slug]
    );
    if (!creator) { res.json([]); return; }

    const rows = await query<any>(`
      SELECT cp.id, cp.subscription_price, cp.starting_price, cp.tags,
             u.display_name, u.username, u.avatar_url, u.is_verified_creator,
             (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') as subscriber_count
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.is_approved = 1 AND cp.id != $1
      ORDER BY subscriber_count DESC
      LIMIT 4
    `, [creator.id]);

    res.json(rows.map((r: any) => ({ ...r, tags: JSON.parse(r.tags ?? '[]') })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch similar creators.' });
  }
});

// PATCH /api/creators/profile — update own profile
router.patch('/profile', requireAuth, requireCreator, async (req, res) => {
  try {
    const {
      bio, cover_image_url, tags, subscription_price, starting_price,
      custom_requests_enabled, onboarding_dismissed, training_viewed,
    } = req.body;

    const profile = await queryOne<any>(`
      SELECT cp.id FROM creator_profiles cp JOIN users u ON u.id = cp.user_id WHERE u.id = $1
    `, [req.auth!.userId]);

    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

    await execute(`
      UPDATE creator_profiles SET
        bio = COALESCE($1, bio),
        cover_image_url = COALESCE($2, cover_image_url),
        tags = COALESCE($3, tags),
        subscription_price = COALESCE($4, subscription_price),
        starting_price = COALESCE($5, starting_price),
        custom_requests_enabled = COALESCE($6, custom_requests_enabled),
        onboarding_dismissed = COALESCE($7, onboarding_dismissed),
        training_viewed = COALESCE($8, training_viewed)
      WHERE id = $9
    `, [
      bio ?? null,
      cover_image_url ?? null,
      tags ? JSON.stringify(tags) : null,
      subscription_price ?? null,
      starting_price ?? null,
      custom_requests_enabled != null ? (custom_requests_enabled ? 1 : 0) : null,
      onboarding_dismissed != null ? (onboarding_dismissed ? 1 : 0) : null,
      training_viewed != null ? (training_viewed ? 1 : 0) : null,
      profile.id,
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ── Payout Requests ──────────────────────────────────────────────────────────

// POST /api/creators/payout-requests — creator submits a payout request
router.post('/payout-requests', requireAuth, requireCreator, async (req, res) => {
  const { amount_dollars, payment_method = 'bank_transfer', notes = '' } = req.body;
  const amount = parseFloat(amount_dollars);
  if (!amount || amount < 10) {
    res.status(400).json({ error: 'Minimum payout request is $10.00.' });
    return;
  }
  const VALID_METHODS = ['bank_transfer', 'paypal', 'venmo', 'zelle', 'check', 'other'];
  if (!VALID_METHODS.includes(payment_method)) {
    res.status(400).json({ error: 'Invalid payment method.' });
    return;
  }
  try {
    const id = crypto.randomUUID();
    await execute(
      `INSERT INTO payout_requests (id, creator_id, amount_dollars, payment_method, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, req.auth!.userId, amount.toFixed(2), payment_method, (notes ?? '').slice(0, 1000)]
    );
    res.status(201).json({ id, status: 'pending' });
  } catch (err) {
    console.error('[payout-requests] error:', err);
    res.status(500).json({ error: 'Failed to submit payout request.' });
  }
});

// GET /api/creators/payout-requests — creator lists own requests
router.get('/payout-requests', requireAuth, requireCreator, async (req, res) => {
  try {
    const rows = await query<{
      id: string; amount_dollars: string; payment_method: string;
      notes: string; status: string; admin_note: string; created_at: string;
    }>(
      `SELECT id, amount_dollars, payment_method, notes, status, admin_note, created_at
       FROM payout_requests
       WHERE creator_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.auth!.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load payout requests.' });
  }
});

export default router;
