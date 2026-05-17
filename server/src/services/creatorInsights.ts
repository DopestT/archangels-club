import { query, queryOne } from '../db/client.js';

export interface CreatorInsight {
  id: string;
  category: string;
  text: string;
  reason: string;
  signal: string;
  action: string;
  confidence: 'high' | 'medium' | 'low';
  priority: number;
}

export interface AdminSummary {
  id: string;
  category: string;
  label: string;
  count: number;
  description: string;
  priority: 'critical' | 'warning' | 'info';
  creators?: { username: string; display_name: string; value?: string }[];
}

export async function getCreatorCoachingInsights(
  _userId: string,
  creatorProfileId: string
): Promise<CreatorInsight[]> {
  const insights: CreatorInsight[] = [];

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [
    profileViews,
    approvedContent,
    recentUnlocks,
    activeSubs,
    oldPendingRequests,
    rejectedContent,
    lastPostRow,
    payoutRow,
    bioRow,
    totalUnlocks,
  ] = await Promise.all([
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM platform_events
       WHERE event_type = 'creator_profile_view'
         AND entity_type = 'creator'
         AND entity_id = $1
         AND created_at >= $2`,
      [creatorProfileId, thirtyDaysAgo.toISOString()]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM content
       WHERE creator_id = $1 AND status = 'approved'`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM content_unlocks cu
       JOIN content c ON c.id = cu.content_id
       WHERE c.creator_id = $1
         AND cu.unlocked_at >= $2`,
      [creatorProfileId, thirtyDaysAgo.toISOString()]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM subscriptions
       WHERE creator_id = $1 AND status = 'active'`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM custom_requests
       WHERE creator_id = $1 AND status = 'pending'
         AND created_at < $2`,
      [creatorProfileId, fortyEightHoursAgo.toISOString()]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM content
       WHERE creator_id = $1
         AND status IN ('rejected', 'changes_requested')
         AND created_at >= NOW() - INTERVAL '60 days'`,
      [creatorProfileId]
    ),
    queryOne<{ created_at: string }>(
      `SELECT created_at FROM content
       WHERE creator_id = $1 AND status = 'approved'
       ORDER BY created_at DESC LIMIT 1`,
      [creatorProfileId]
    ),
    queryOne<{ stripe_onboarding_complete: number }>(
      `SELECT stripe_onboarding_complete FROM creator_profiles WHERE id = $1`,
      [creatorProfileId]
    ),
    queryOne<{ bio: string }>(
      `SELECT bio FROM creator_profiles WHERE id = $1`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM content_unlocks cu
       JOIN content c ON c.id = cu.content_id
       WHERE c.creator_id = $1`,
      [creatorProfileId]
    ),
  ]);

  const views30d        = parseInt(profileViews?.count ?? '0', 10);
  const approvedCount   = parseInt(approvedContent?.count ?? '0', 10);
  const unlocks30d      = parseInt(recentUnlocks?.count ?? '0', 10);
  const activeSubCount  = parseInt(activeSubs?.count ?? '0', 10);
  const oldRequestCount = parseInt(oldPendingRequests?.count ?? '0', 10);
  const rejectedCount   = parseInt(rejectedContent?.count ?? '0', 10);
  const totalUnlockCount = parseInt(totalUnlocks?.count ?? '0', 10);
  const payoutReady     = !!payoutRow?.stripe_onboarding_complete;
  const bio             = bioRow?.bio ?? '';
  const lastPostDate    = lastPostRow?.created_at ? new Date(lastPostRow.created_at) : null;
  const daysSincePost   = lastPostDate
    ? Math.floor((now.getTime() - lastPostDate.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  // ── Rule 1: Payout not configured ─────────────────────────────────────────
  if (!payoutReady) {
    insights.push({
      id: 'payout_setup',
      category: 'Payout',
      text: 'Your payout account is not set up. You cannot receive earnings until Stripe Connect is configured.',
      reason: 'Stripe Connect onboarding incomplete',
      signal: 'Payout status: not configured',
      action: 'Complete payout setup in the Revenue Streams section.',
      confidence: 'high',
      priority: 1,
    });
  }

  // ── Rule 2: Repeated rejections ───────────────────────────────────────────
  if (rejectedCount >= 2) {
    insights.push({
      id: 'compliance_guidance',
      category: 'Compliance',
      text: `${rejectedCount} of your recent uploads were rejected. Reviewing the content guidelines now can prevent further delays.`,
      reason: `${rejectedCount} rejections in the last 60 days`,
      signal: `${rejectedCount} rejected or change-requested items`,
      action: 'Read the content guidelines in Creator Training, then re-submit with the required changes.',
      confidence: 'high',
      priority: 2,
    });
  }

  // ── Rule 3: Unanswered custom requests (>48h) ─────────────────────────────
  if (oldRequestCount >= 1) {
    insights.push({
      id: 'response_coaching',
      category: 'Engagement',
      text: `You have ${oldRequestCount} custom request${oldRequestCount > 1 ? 's' : ''} that ${oldRequestCount > 1 ? 'have' : 'has'} been waiting over 48 hours. Fans who get fast replies convert at 3× the rate.`,
      reason: `${oldRequestCount} pending request${oldRequestCount > 1 ? 's' : ''} older than 48 hours`,
      signal: `${oldRequestCount} unanswered custom request${oldRequestCount > 1 ? 's' : ''}`,
      action: 'Go to Messages to review and respond to pending requests.',
      confidence: 'high',
      priority: 3,
    });
  }

  // ── Rule 4: High views, low unlocks (conversion issue) ────────────────────
  if (views30d >= 20 && approvedCount > 0) {
    const unlockRate = views30d > 0 ? unlocks30d / views30d : 0;
    if (unlockRate < 0.05) {
      insights.push({
        id: 'conversion_issue',
        category: 'Pricing',
        text: 'Visitors are viewing your profile but few are purchasing. Your pricing or preview content may need adjustment.',
        reason: `${views30d} profile views but only ${unlocks30d} unlocks in 30 days`,
        signal: `${views30d} views · ${unlocks30d} unlocks · ${(unlockRate * 100).toFixed(1)}% conversion rate`,
        action: 'Try lowering the price on one drop, or add a compelling free preview image.',
        confidence: unlockRate < 0.02 ? 'high' : 'medium',
        priority: 4,
      });
    }
  }

  // ── Rule 5: Content published but zero unlocks ever ───────────────────────
  if (approvedCount > 0 && totalUnlockCount === 0) {
    insights.push({
      id: 'pricing_help',
      category: 'Pricing',
      text: 'You have approved content but no one has unlocked it yet. A lower intro price or a teaser preview can jumpstart sales.',
      reason: `${approvedCount} approved drop${approvedCount > 1 ? 's' : ''} with 0 lifetime unlocks`,
      signal: `${approvedCount} published · 0 unlocks`,
      action: 'Set your first drop to a low intro price ($3–$5) and add a preview image.',
      confidence: 'high',
      priority: 5,
    });
  }

  // ── Rule 6: No content yet ────────────────────────────────────────────────
  if (approvedCount === 0 && daysSincePost === null) {
    insights.push({
      id: 'reactivation_prompt',
      category: 'Content',
      text: "You haven't published any content yet. Your first drop is the most important step toward building an audience.",
      reason: 'No approved content found',
      signal: 'Approved content count: 0',
      action: 'Create your first drop — go to Create a Drop.',
      confidence: 'high',
      priority: 5,
    });
  }

  // ── Rule 7: Inactive 14–29 days ───────────────────────────────────────────
  if (daysSincePost !== null && daysSincePost >= 14 && daysSincePost < 30) {
    insights.push({
      id: 'inactivity_risk',
      category: 'Content',
      text: `You haven't posted in ${daysSincePost} days. Subscribers disengage quickly without fresh content.`,
      reason: `Last approved upload was ${daysSincePost} days ago`,
      signal: `Last post: ${lastPostDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      action: 'Upload a new drop today to keep your audience engaged.',
      confidence: 'medium',
      priority: 6,
    });
  }

  // ── Rule 8: Inactive 30+ days ─────────────────────────────────────────────
  if (daysSincePost !== null && daysSincePost >= 30) {
    insights.push({
      id: 'reactivation_prompt',
      category: 'Content',
      text: `It's been ${daysSincePost} days since your last upload. A new drop now can re-engage your existing subscribers.`,
      reason: `${daysSincePost} days since last approved upload`,
      signal: `Last post: ${lastPostDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      action: 'Go to Create a Drop to publish your next piece.',
      confidence: 'high',
      priority: 6,
    });
  }

  // ── Rule 9: Subscription opportunity ─────────────────────────────────────
  if (unlocks30d >= 5 && activeSubCount === 0) {
    insights.push({
      id: 'subscription_opportunity',
      category: 'Growth',
      text: 'Fans are paying to unlock individual drops, but none have subscribed. A subscription tier gives you predictable recurring income.',
      reason: `${unlocks30d} unlocks in 30 days with 0 active subscribers`,
      signal: `${unlocks30d} recent unlocks · 0 active subscribers`,
      action: 'Set a subscription price in your profile settings to unlock recurring revenue.',
      confidence: 'medium',
      priority: 7,
    });
  }

  // ── Rule 10: Profile incomplete ───────────────────────────────────────────
  if (bio.trim().length < 40) {
    insights.push({
      id: 'profile_improvement',
      category: 'Profile',
      text: 'Your bio is very short. Creators with a clear, specific bio get significantly higher conversion from profile visits.',
      reason: `Bio is ${bio.trim().length} character${bio.trim().length !== 1 ? 's' : ''}`,
      signal: bio.trim().length === 0 ? 'Bio: empty' : `Bio: "${bio.trim().slice(0, 40)}…"`,
      action: 'Edit your profile and write 2–3 sentences describing your content and what subscribers get.',
      confidence: bio.trim().length === 0 ? 'high' : 'medium',
      priority: 8,
    });
  }

  // ── Rule 11: Has content but no subscribers ───────────────────────────────
  if (activeSubCount === 0 && approvedCount >= 2) {
    insights.push({
      id: 'growth_tip',
      category: 'Growth',
      text: 'You have content but no subscribers yet. Sharing your profile link is the fastest way to get your first subscriber.',
      reason: '0 active subscribers despite published content',
      signal: `${approvedCount} drops published · 0 subscribers`,
      action: 'Copy your profile link from the Studio and share it on your other platforms.',
      confidence: 'medium',
      priority: 9,
    });
  }

  // Sort by priority and cap at 6 cards
  return insights
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6);
}

export async function getAdminIntelligenceSummaries(): Promise<AdminSummary[]> {
  const summaries: AdminSummary[] = [];

  const [
    needsSupport,
    modPressure,
    inactiveCreators,
    revenueLeaks,
    trendingCreators,
  ] = await Promise.all([
    query<{ username: string; display_name: string; overall_score: string }>(
      `SELECT u.username, u.display_name, ROUND(chs.overall_score::numeric)::text AS overall_score
       FROM creator_health_scores chs
       JOIN creator_profiles cp ON cp.id = chs.creator_id
       JOIN users u ON u.id = cp.user_id
       WHERE chs.overall_score::numeric < 40
         AND cp.is_approved = 1
       ORDER BY chs.overall_score ASC
       LIMIT 8`
    ),

    queryOne<{ pending_content: string; pending_access: string }>(
      `SELECT
         (SELECT COUNT(*) FROM content WHERE status = 'pending_review')::text AS pending_content,
         (SELECT COUNT(*) FROM access_requests WHERE status = 'pending')::text AS pending_access`
    ),

    query<{ username: string; display_name: string; days_since: string }>(
      `SELECT u.username, u.display_name,
         COALESCE(
           FLOOR(EXTRACT(DAY FROM NOW() - MAX(c.created_at)))::text,
           'never'
         ) AS days_since
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN content c ON c.creator_id = cp.id AND c.status = 'approved'
       WHERE cp.is_approved = 1
         AND u.status = 'approved'
       GROUP BY u.username, u.display_name
       HAVING MAX(c.created_at) IS NULL OR MAX(c.created_at) < NOW() - INTERVAL '30 days'
       ORDER BY MAX(c.created_at) ASC NULLS FIRST
       LIMIT 8`
    ),

    query<{ username: string; display_name: string; sub_count: string }>(
      `SELECT u.username, u.display_name, COUNT(s.id)::text AS sub_count
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       JOIN subscriptions s ON s.creator_id = cp.id AND s.status = 'active'
       WHERE cp.stripe_onboarding_complete = 0
         AND cp.is_approved = 1
       GROUP BY u.username, u.display_name
       ORDER BY COUNT(s.id) DESC
       LIMIT 6`
    ),

    query<{ username: string; display_name: string; new_subs: string; new_unlocks: string }>(
      `SELECT u.username, u.display_name,
         COUNT(DISTINCT s.id) FILTER (WHERE s.started_at >= NOW() - INTERVAL '7 days')::text AS new_subs,
         COUNT(DISTINCT cu.id) FILTER (WHERE cu.unlocked_at >= NOW() - INTERVAL '7 days')::text AS new_unlocks
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN subscriptions s ON s.creator_id = cp.id
       LEFT JOIN content c ON c.creator_id = cp.id
       LEFT JOIN content_unlocks cu ON cu.content_id = c.id
       WHERE cp.is_approved = 1
       GROUP BY u.username, u.display_name
       HAVING COUNT(DISTINCT s.id) FILTER (WHERE s.started_at >= NOW() - INTERVAL '7 days') > 0
          OR COUNT(DISTINCT cu.id) FILTER (WHERE cu.unlocked_at >= NOW() - INTERVAL '7 days') > 0
       ORDER BY (
         COUNT(DISTINCT s.id) FILTER (WHERE s.started_at >= NOW() - INTERVAL '7 days') * 3 +
         COUNT(DISTINCT cu.id) FILTER (WHERE cu.unlocked_at >= NOW() - INTERVAL '7 days')
       ) DESC
       LIMIT 6`
    ),
  ]);

  if (revenueLeaks.length > 0) {
    const totalSubs = revenueLeaks.reduce((s, c) => s + parseInt(c.sub_count, 10), 0);
    summaries.push({
      id: 'revenue_leak',
      category: 'Revenue',
      label: 'Payout Not Configured',
      count: revenueLeaks.length,
      description: `${revenueLeaks.length} creator${revenueLeaks.length > 1 ? 's' : ''} with active subscribers have not set up payouts. ${totalSubs} subscription${totalSubs !== 1 ? 's' : ''} at risk of non-payment.`,
      priority: 'critical',
      creators: revenueLeaks.map(c => ({
        username: c.username,
        display_name: c.display_name,
        value: `${c.sub_count} subs`,
      })),
    });
  }

  const pendingContent = parseInt(modPressure?.pending_content ?? '0', 10);
  const pendingAccess  = parseInt(modPressure?.pending_access ?? '0', 10);
  const totalMod = pendingContent + pendingAccess;
  if (totalMod > 0) {
    summaries.push({
      id: 'moderation_pressure',
      category: 'Moderation',
      label: 'Moderation Queue',
      count: totalMod,
      description: `${pendingContent} content item${pendingContent !== 1 ? 's' : ''} pending review · ${pendingAccess} access request${pendingAccess !== 1 ? 's' : ''} awaiting approval.`,
      priority: totalMod >= 10 ? 'critical' : 'warning',
    });
  }

  if (needsSupport.length > 0) {
    summaries.push({
      id: 'needs_support',
      category: 'Creator Health',
      label: 'Creators Needing Support',
      count: needsSupport.length,
      description: `${needsSupport.length} approved creator${needsSupport.length > 1 ? 's' : ''} with a health score below 40. These creators may be disengaging or struggling.`,
      priority: 'warning',
      creators: needsSupport.map(c => ({
        username: c.username,
        display_name: c.display_name,
        value: `${c.overall_score}/100`,
      })),
    });
  }

  if (inactiveCreators.length > 0) {
    summaries.push({
      id: 'inactive_creators',
      category: 'Engagement',
      label: 'Inactive Creators (30d+)',
      count: inactiveCreators.length,
      description: `${inactiveCreators.length} approved creator${inactiveCreators.length > 1 ? 's' : ''} have not posted in over 30 days or have no content.`,
      priority: 'info',
      creators: inactiveCreators.slice(0, 5).map(c => ({
        username: c.username,
        display_name: c.display_name,
        value: c.days_since === 'never' ? 'No posts' : `${c.days_since}d ago`,
      })),
    });
  }

  if (trendingCreators.length > 0) {
    summaries.push({
      id: 'trending_creators',
      category: 'Trending',
      label: 'Trending This Week',
      count: trendingCreators.length,
      description: `${trendingCreators.length} creator${trendingCreators.length > 1 ? 's' : ''} with notable activity in the last 7 days.`,
      priority: 'info',
      creators: trendingCreators.map(c => ({
        username: c.username,
        display_name: c.display_name,
        value: `+${c.new_subs} subs · ${c.new_unlocks} unlocks`,
      })),
    });
  }

  return summaries;
}
