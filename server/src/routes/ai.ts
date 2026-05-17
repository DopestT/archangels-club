import { Router } from 'express';
import OpenAI from 'openai';
import { query, queryOne } from '../db/schema.js';
import { requireAuth, requireCreator, requireAdmin } from '../middleware/auth.js';
import { getAffinityPicksForUser, getMemberGuidanceTips } from '../services/memberRecommendations.js';

const router = Router();

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function openai() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function chatJSON(prompt: string, maxTokens = 600): Promise<unknown> {
  const completion = await openai().chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
  });
  const raw = completion.choices[0]?.message?.content ?? '{}';
  return JSON.parse(raw);
}

// POST /api/ai/sales-message
router.post('/sales-message', async (req, res) => {
  const { userId, creatorId, contentId, contentTitle, price, lastPurchaseAt } = req.body;

  if (!userId || !creatorId || !contentId || !contentTitle || price === undefined) {
    res.status(400).json({ error: 'userId, creatorId, contentId, contentTitle, and price are required.' });
    return;
  }

  if (lastPurchaseAt) {
    const msSinceLastPurchase = Date.now() - new Date(lastPurchaseAt).getTime();
    if (msSinceLastPurchase < THREE_DAYS_MS) {
      res.json({ skipped: true, reason: 'User purchased recently.' });
      return;
    }
  }

  try {
    const completion = await openai().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Write a short, enticing sales message under 25 words for this exclusive content: "${contentTitle}" priced at $${price}. Be direct and compelling.`,
        },
      ],
      max_tokens: 60,
    });

    const message = completion.choices[0]?.message?.content?.trim() ?? '';
    res.json({ message });
  } catch (err) {
    console.error('[ai/sales-message] error:', err);
    res.status(500).json({ error: 'Failed to generate sales message' });
  }
});

// POST /api/ai/creator-insights
// Requires: creator auth. Returns actionable suggestions based on real creator data.
router.post('/creator-insights', requireAuth, requireCreator, async (req, res) => {
  try {
    const userId = req.auth!.userId;

    const profile = await queryOne<any>(
      `SELECT cp.*, u.display_name, u.username
       FROM creator_profiles cp JOIN users u ON u.id = cp.user_id
       WHERE cp.user_id = $1`,
      [userId]
    );
    if (!profile) {
      res.status(404).json({ error: 'Creator profile not found.' });
      return;
    }

    const [contentRows, statsRow, recentTxns, pendingRequests] = await Promise.all([
      query<any>(
        `SELECT title, price, content_type, access_type, current_unlocks, status
         FROM content WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [profile.id]
      ),
      queryOne<any>(
        `SELECT
          (SELECT COUNT(*) FROM subscriptions WHERE creator_id = $1 AND status = 'active') AS subscriber_count,
          (SELECT COALESCE(SUM(net_amount),0) FROM transactions WHERE payee_id = $2 AND created_at > NOW() - INTERVAL '30 days') AS revenue_30d,
          (SELECT COUNT(*) FROM transactions WHERE payee_id = $2 AND created_at > NOW() - INTERVAL '30 days') AS txn_count_30d,
          (SELECT COUNT(*) FROM content WHERE creator_id = $1 AND status = 'approved') AS approved_count,
          (SELECT COUNT(*) FROM content WHERE creator_id = $1 AND status = 'pending_review') AS pending_count`,
        [profile.id, userId]
      ),
      query<any>(
        `SELECT ref_type, amount FROM transactions WHERE payee_id = $1 AND created_at > NOW() - INTERVAL '30 days' ORDER BY created_at DESC LIMIT 10`,
        [userId]
      ),
      query<any>(
        `SELECT COUNT(*) AS n FROM custom_requests WHERE creator_id = $1 AND status = 'pending'`,
        [profile.id]
      ),
    ]);

    const prompt = `You are an advisor for a premium, members-only creator platform called Archangels Club.
The platform takes 30% and pays creators 70%. Membership is exclusive and private.

Creator data (REAL — do not invent numbers):
- Display name: ${profile.display_name}
- Subscription price: $${profile.subscription_price}/mo
- Starting content price: $${profile.starting_price}
- Active subscribers: ${statsRow?.subscriber_count ?? 0}
- Revenue last 30 days: $${parseFloat(statsRow?.revenue_30d ?? 0).toFixed(2)}
- Transactions last 30 days: ${statsRow?.txn_count_30d ?? 0}
- Approved content pieces: ${statsRow?.approved_count ?? 0}
- Content pending review: ${statsRow?.pending_count ?? 0}
- Pending custom requests: ${pendingRequests[0]?.n ?? 0}
- Recent content (title, price, type, unlocks): ${JSON.stringify(contentRows.slice(0, 8).map(c => ({ title: c.title, price: c.price, type: c.content_type, unlocks: c.current_unlocks })))}

Generate exactly 5 concise, actionable suggestions covering a mix of: pricing, upload timing, content titles/descriptions, bundles, profile optimization, subscriber growth, and custom request handling.
Only reference REAL numbers from the data above. Do not invent metrics.
Each suggestion must be specific (not generic advice).

Return JSON: { "suggestions": [{ "category": string, "text": string }] }
Category options: "Pricing" | "Content" | "Profile" | "Growth" | "Custom Requests" | "Bundles"`;

    const result = await chatJSON(prompt, 700) as { suggestions: { category: string; text: string }[] };
    res.json({ suggestions: result.suggestions ?? [] });
  } catch (err) {
    console.error('[ai/creator-insights] error:', err);
    res.status(500).json({ error: 'Failed to generate insights.' });
  }
});

// POST /api/ai/member-recommendations
// Returns personalized creator picks and guidance tips from real signal data.
// Rules-based engine runs first (always fast); AI enhancement is additive if available.
// Response shape is stable: { creator_picks, guidance } — dashboard depends on this.
router.post('/member-recommendations', requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;

    // Run both in parallel — both are cached so repeat calls are instant
    const [picks, guidance] = await Promise.all([
      getAffinityPicksForUser(userId, 3),
      getMemberGuidanceTips(userId),
    ]);

    res.json({
      creator_picks: picks.map(p => ({
        username: p.username,
        display_name: p.display_name,
        reason: p.reason,
      })),
      guidance,
    });
  } catch (err) {
    console.error('[ai/member-recommendations] error:', err);
    // Always return a valid shape — never leave the dashboard in a broken state
    res.json({ creator_picks: [], guidance: [] });
  }
});

// POST /api/ai/admin-insights
// Requires: admin auth. Returns strategic platform insights.
router.post('/admin-insights', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [platformStats, revenueRow, contentStats, modStats, creatorStats] = await Promise.all([
      queryOne<any>(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE status = 'approved') AS approved_members,
          (SELECT COUNT(*) FROM users WHERE status = 'pending') AS pending_members,
          (SELECT COUNT(*) FROM creator_profiles WHERE is_approved = 1) AS active_creators,
          (SELECT COUNT(*) FROM creator_profiles WHERE application_status = 'pending') AS pending_creators`
      ),
      queryOne<any>(
        `SELECT
          COALESCE(SUM(platform_fee), 0) AS platform_revenue_30d,
          COALESCE(SUM(amount), 0) AS gross_volume_30d,
          COUNT(*) AS txn_count_30d
         FROM transactions
         WHERE created_at > NOW() - INTERVAL '30 days' AND status = 'completed'`
      ),
      queryOne<any>(
        `SELECT
          (SELECT COUNT(*) FROM content WHERE status = 'approved') AS approved_content,
          (SELECT COUNT(*) FROM content WHERE status = 'pending_review') AS pending_content,
          (SELECT COUNT(*) FROM content WHERE status = 'rejected') AS rejected_content`
      ),
      queryOne<any>(
        `SELECT COUNT(*) AS open_reports FROM reports WHERE status = 'open'`
      ),
      query<any>(
        `SELECT u.display_name, u.username,
           (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = cp.id AND s.status = 'active') AS subs,
           (SELECT COALESCE(SUM(net_amount),0) FROM transactions t WHERE t.payee_id = u.id AND t.created_at > NOW() - INTERVAL '30 days') AS revenue_30d,
           (SELECT COUNT(*) FROM content c WHERE c.creator_id = cp.id AND c.status = 'approved') AS content_count
         FROM creator_profiles cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.is_approved = 1
         ORDER BY subs DESC LIMIT 10`
      ),
    ]);

    const prompt = `You are a strategic advisor for Archangels Club, a private luxury creator platform (30% platform / 70% creator revenue split).

Platform metrics (REAL data — do not invent numbers):
- Approved members: ${platformStats?.approved_members ?? 0}
- Pending members: ${platformStats?.pending_members ?? 0}
- Active creators: ${platformStats?.active_creators ?? 0}
- Pending creator applications: ${platformStats?.pending_creators ?? 0}
- Platform revenue (last 30d): $${parseFloat(revenueRow?.platform_revenue_30d ?? 0).toFixed(2)}
- Gross transaction volume (last 30d): $${parseFloat(revenueRow?.gross_volume_30d ?? 0).toFixed(2)}
- Total transactions (last 30d): ${revenueRow?.txn_count_30d ?? 0}
- Approved content: ${contentStats?.approved_content ?? 0}
- Content pending review: ${contentStats?.pending_content ?? 0}
- Open moderation reports: ${modStats?.open_reports ?? 0}
- Top creators by subscribers: ${JSON.stringify(creatorStats.slice(0, 5).map((c: any) => ({ name: c.display_name, subs: c.subs, revenue_30d: parseFloat(c.revenue_30d).toFixed(2), content: c.content_count })))}

Generate 5 strategic platform insights across: creator coaching, revenue opportunities, moderation priorities, pricing experiments, and platform growth campaigns.
Be specific and reference only the real numbers above.

Return JSON: { "insights": [{ "category": string, "text": string, "priority": "high" | "medium" | "low" }] }
Categories: "Creator Coaching" | "Revenue" | "Moderation" | "Pricing" | "Growth" | "Content"`;

    const result = await chatJSON(prompt, 700) as {
      insights: { category: string; text: string; priority: string }[];
    };

    res.json({ insights: result.insights ?? [] });
  } catch (err) {
    console.error('[ai/admin-insights] error:', err);
    res.status(500).json({ error: 'Failed to generate insights.' });
  }
});

export default router;
