import { query, queryOne } from '../db/client.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type InsightType =
  | 'conversion_issue'
  | 'pricing_help'
  | 'payout_setup'
  | 'response_coaching'
  | 'compliance_guidance'
  | 'inactivity_risk'
  | 'subscription_opportunity'
  | 'bundle_suggestion'
  | 'profile_incomplete'
  | 'custom_request_opportunity';

export type InsightPriority = 'high' | 'medium' | 'low';

export interface CoachingCard {
  type: InsightType;
  priority: InsightPriority;
  title: string;
  body: string;
  cta_label: string;
  cta_action: string; // client-side route or modal key
  signal: string;     // factual data point backing this insight
  confidence: number; // 0–1, how certain we are the insight applies
}

export interface AdminCreatorAlert {
  creator_id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  alert_type: string;
  detail: string;
  overall_score: number | null;
}

export interface AdminIntelligenceSummary {
  creators_needing_support: AdminCreatorAlert[];
  high_potential_low_conversion: AdminCreatorAlert[];
  trending_creators: {
    creator_id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    new_subs_7d: number;
    unlocks_7d: number;
    views_7d: number;
  }[];
  inactive_creators: {
    creator_id: string;
    username: string;
    display_name: string;
    days_since_post: number;
    last_post_at: string | null;
  }[];
  moderation_pressure: {
    pending_review_count: number;
    open_reports_count: number;
    repeat_rejection_creators: number;
  };
  revenue_signals: {
    fulfillment_needs_review: number;
    earnings_no_payout_setup: number;
  };
  member_risk_signals: {
    dormant_active_members_30d: number;   // members with active sub but 0 logins in 30d
    expiring_subscriptions_7d: number;    // subs expiring in the next 7 days
  };
  generated_at: string;
}

// ── Creator coaching cards ────────────────────────────────────────────────────

export async function computeCreatorInsights(creatorProfileId: string): Promise<CoachingCard[]> {
  const cards: CoachingCard[] = [];

  // Fetch creator base data in one query
  const profile = await queryOne<{
    user_id: string;
    bio: string;
    tags: string;
    cover_image_url: string | null;
    stripe_onboarding_complete: number;
    total_earnings: string;
    custom_requests_enabled: number;
    subscription_price: string;
  }>(
    `SELECT user_id, bio, tags, cover_image_url, stripe_onboarding_complete,
            total_earnings, custom_requests_enabled, subscription_price
     FROM creator_profiles WHERE id = $1`,
    [creatorProfileId]
  );
  if (!profile) return [];

  // Run signal queries in parallel — these are all read-only and independent
  const [
    views30d,
    unlocks30d,
    totalContent,
    totalUnlocks,
    rejectedContent30d,
    lastPost,
    savedContent30d,
    activeSubs,
    bundleCount,
    messagesReceived30d,
    messagesSent30d,
    customRequests30d,
  ] = await Promise.all([
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM creator_page_views
       WHERE creator_id = $1 AND viewed_at >= NOW() - INTERVAL '30 days'`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM content_unlocks cu
       JOIN content c ON c.id = cu.content_id
       WHERE c.creator_id = $1 AND cu.unlocked_at >= NOW() - INTERVAL '30 days'`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM content WHERE creator_id = $1 AND status = 'approved'`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM content_unlocks cu
       JOIN content c ON c.id = cu.content_id WHERE c.creator_id = $1`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM content
       WHERE creator_id = $1 AND status = 'rejected'
         AND updated_at >= NOW() - INTERVAL '30 days'`,
      [creatorProfileId]
    ),
    queryOne<{ last_post_at: string | null }>(
      `SELECT MAX(created_at) AS last_post_at FROM content
       WHERE creator_id = $1 AND status = 'approved'`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM saved_content sc
       JOIN content c ON c.id = sc.content_id
       WHERE c.creator_id = $1 AND sc.saved_at >= NOW() - INTERVAL '30 days'`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM subscriptions WHERE creator_id = $1 AND status = 'active'`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM bundles WHERE creator_id = $1 AND status = 'active'`,
      [creatorProfileId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM messages
       WHERE receiver_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [profile.user_id]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM messages
       WHERE sender_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [profile.user_id]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM custom_requests
       WHERE creator_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [creatorProfileId]
    ),
  ]);

  const v30 = parseInt(views30d?.count ?? '0', 10);
  const u30 = parseInt(unlocks30d?.count ?? '0', 10);
  const contentCount = parseInt(totalContent?.count ?? '0', 10);
  const allTimeUnlocks = parseInt(totalUnlocks?.count ?? '0', 10);
  const rejected30 = parseInt(rejectedContent30d?.count ?? '0', 10);
  const saves30 = parseInt(savedContent30d?.count ?? '0', 10);
  const subs = parseInt(activeSubs?.count ?? '0', 10);
  const bundles = parseInt(bundleCount?.count ?? '0', 10);
  const msgReceived = parseInt(messagesReceived30d?.count ?? '0', 10);
  const msgSent = parseInt(messagesSent30d?.count ?? '0', 10);
  const customReqs = parseInt(customRequests30d?.count ?? '0', 10);
  const earnings = parseFloat(profile.total_earnings ?? '0');

  const lastPostAt = lastPost?.last_post_at ?? null;
  const daysSincePost = lastPostAt
    ? Math.floor((Date.now() - new Date(lastPostAt).getTime()) / 86400000)
    : 999;

  // ── Rule 1: Payout setup (high priority — money left on table) ───────────
  if (earnings > 0 && profile.stripe_onboarding_complete === 0) {
    cards.push({
      type: 'payout_setup',
      priority: 'high',
      title: 'Connect your payout account',
      body: `You have $${earnings.toFixed(2)} in earnings that can't be transferred until your Stripe payout account is connected.`,
      cta_label: 'Set up payouts',
      cta_action: 'go_to_payouts',
      signal: `$${earnings.toFixed(2)} pending, payout not configured`,
      confidence: 1.0,
    });
  }

  // ── Rule 2: Repeated content rejections ──────────────────────────────────
  if (rejected30 >= 2) {
    cards.push({
      type: 'compliance_guidance',
      priority: 'high',
      title: `${rejected30} posts were flagged for review`,
      body: 'Content that gets rejected often has issues with descriptions, previews, or compliance guidelines. Review the feedback on each piece to understand what to adjust.',
      cta_label: 'View content',
      cta_action: 'go_to_content',
      signal: `${rejected30} rejections in the last 30 days`,
      confidence: 0.95,
    });
  }

  // ── Rule 3: Inactivity risk ───────────────────────────────────────────────
  if (daysSincePost >= 30) {
    cards.push({
      type: 'inactivity_risk',
      priority: 'high',
      title: 'Your audience hasn\'t heard from you in a while',
      body: `It's been ${daysSincePost} days since your last approved post. Even a short update can re-engage subscribers and prevent cancellations.`,
      cta_label: 'Upload content',
      cta_action: 'go_to_upload',
      signal: `Last post ${daysSincePost} days ago`,
      confidence: 1.0,
    });
  } else if (daysSincePost >= 14) {
    cards.push({
      type: 'inactivity_risk',
      priority: 'medium',
      title: 'It\'s been two weeks since your last post',
      body: 'Regular posting keeps subscribers engaged and reduces cancellations. Try to share something new this week.',
      cta_label: 'Upload content',
      cta_action: 'go_to_upload',
      signal: `Last post ${daysSincePost} days ago`,
      confidence: 1.0,
    });
  } else if (daysSincePost >= 7 && contentCount > 0) {
    cards.push({
      type: 'inactivity_risk',
      priority: 'low',
      title: 'A week without a new post',
      body: 'Staying consistent helps subscribers feel their membership is worth it. Even a short post keeps the momentum going.',
      cta_label: 'Upload content',
      cta_action: 'go_to_upload',
      signal: `Last post ${daysSincePost} days ago`,
      confidence: 0.8,
    });
  }

  // ── Rule 4: Conversion issue (traffic but no purchases) ──────────────────
  if (v30 >= 50 && u30 < 5 && contentCount > 0) {
    cards.push({
      type: 'conversion_issue',
      priority: 'medium',
      title: 'Visitors aren\'t converting to buyers',
      body: 'You\'re getting good profile traffic but few unlocks. Consider improving previews, tightening content descriptions, or testing a lower entry price.',
      cta_label: 'Review pricing',
      cta_action: 'go_to_settings',
      signal: `${v30} profile views, ${u30} unlocks in 30 days`,
      confidence: 0.75,
    });
  }

  // ── Rule 5: Content with no unlocks ──────────────────────────────────────
  if (contentCount >= 3 && allTimeUnlocks === 0) {
    cards.push({
      type: 'pricing_help',
      priority: 'medium',
      title: 'Your content hasn\'t been unlocked yet',
      body: 'You have approved posts but no purchases. Try adjusting prices, improving previews, or sharing your profile link to drive traffic.',
      cta_label: 'Edit content',
      cta_action: 'go_to_content',
      signal: `${contentCount} approved posts, 0 purchases`,
      confidence: 0.9,
    });
  }

  // ── Rule 6: Subscription opportunity ─────────────────────────────────────
  if (saves30 >= 5 && subs < 10) {
    cards.push({
      type: 'subscription_opportunity',
      priority: 'medium',
      title: 'Fans are saving your content — capture them as subscribers',
      body: `${saves30} pieces of content were saved in the last 30 days but you only have ${subs} active subscribers. Mention your subscription in your bio or pin a free post.`,
      cta_label: 'Edit profile',
      cta_action: 'go_to_profile',
      signal: `${saves30} saves, ${subs} active subscribers`,
      confidence: 0.7,
    });
  }

  // ── Rule 7: Low reply rate ────────────────────────────────────────────────
  if (msgReceived >= 10 && msgSent < Math.floor(msgReceived * 0.2)) {
    cards.push({
      type: 'response_coaching',
      priority: 'low',
      title: 'Responding to fans builds loyalty',
      body: `You've received ${msgReceived} messages but replied to fewer than 20%. Even brief replies increase retention and tip likelihood.`,
      cta_label: 'View messages',
      cta_action: 'go_to_messages',
      signal: `${msgReceived} received, ${msgSent} sent in 30 days`,
      confidence: 0.8,
    });
  }

  // ── Rule 8: Bundle suggestion ─────────────────────────────────────────────
  if (contentCount >= 5 && bundles === 0) {
    cards.push({
      type: 'bundle_suggestion',
      priority: 'low',
      title: 'Bundle your content for higher sales',
      body: `You have ${contentCount} approved posts. Grouping related content into a bundle lets fans buy more at once and increases your average order value.`,
      cta_label: 'Create a bundle',
      cta_action: 'go_to_bundles',
      signal: `${contentCount} approved posts, no bundles`,
      confidence: 0.65,
    });
  }

  // ── Rule 9: Custom request opportunity ───────────────────────────────────
  if (msgReceived >= 5 && customReqs === 0 && profile.custom_requests_enabled === 0) {
    cards.push({
      type: 'custom_request_opportunity',
      priority: 'low',
      title: 'Enable custom requests to monetize fan messages',
      body: `Fans are messaging you but custom requests are turned off. Enabling them lets fans pay for personalized content directly.`,
      cta_label: 'Enable custom requests',
      cta_action: 'go_to_settings',
      signal: `${msgReceived} fan messages in 30 days, custom requests disabled`,
      confidence: 0.7,
    });
  }

  // ── Rule 10: Profile incomplete ───────────────────────────────────────────
  const bioShort = (profile.bio ?? '').trim().length < 50;
  const noTags = profile.tags === '[]' || profile.tags === '';
  const noCover = !profile.cover_image_url;
  if (bioShort || noTags || noCover) {
    const missing: string[] = [];
    if (bioShort) missing.push('a bio');
    if (noTags) missing.push('tags');
    if (noCover) missing.push('a cover image');
    // Elevated to medium when both bio and tags are missing — discovery impact is highest then
    const profilePriority: InsightPriority = (bioShort && noTags) ? 'medium' : 'low';
    cards.push({
      type: 'profile_incomplete',
      priority: profilePriority,
      title: 'Complete your profile to attract more visitors',
      body: `Your profile is missing ${missing.join(' and ')}. Complete profiles get significantly more views and trust from potential subscribers.`,
      cta_label: 'Edit profile',
      cta_action: 'go_to_profile',
      signal: `Missing: ${missing.join(', ')}`,
      confidence: 1.0,
    });
  }

  // ── Rule 11: Free creator with unlock activity — suggest charging ─────────
  if (parseFloat(profile.subscription_price ?? '0') === 0 && allTimeUnlocks >= 5) {
    cards.push({
      type: 'pricing_help',
      priority: 'medium',
      title: 'Your content is popular — consider a subscription price',
      body: `Fans have unlocked your content ${allTimeUnlocks} time${allTimeUnlocks !== 1 ? 's' : ''} but you're not charging for a subscription. Even a low monthly rate can turn casual fans into committed subscribers.`,
      cta_label: 'Set subscription price',
      cta_action: 'go_to_settings',
      signal: `${allTimeUnlocks} unlocks, subscription price = $0`,
      confidence: 0.80,
    });
  }

  // Sort: high → medium → low, then by confidence desc
  return cards.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return b.confidence - a.confidence;
  });
}

// ── Admin intelligence summary ────────────────────────────────────────────────

export async function computeAdminIntelligence(): Promise<AdminIntelligenceSummary> {
  const [
    creatorsNeedingSupport,
    highPotentialLowConversion,
    trendingCreators,
    inactiveCreators,
    moderationStats,
    revenueSignals,
    memberRisk,
  ] = await Promise.all([

    // Creators needing support: low health OR repeated rejections OR earnings stuck
    query<AdminCreatorAlert>(
      `SELECT
         cp.id AS creator_id,
         u.id AS user_id,
         u.username,
         u.display_name,
         u.avatar_url,
         CASE
           WHEN COALESCE(chs.overall_score, 0) < 25 THEN 'low_health'
           WHEN rej.count >= 2 THEN 'repeated_rejections'
           WHEN cp.total_earnings > 0 AND cp.stripe_onboarding_complete = 0 THEN 'payout_blocked'
           ELSE 'inactive'
         END AS alert_type,
         CASE
           WHEN COALESCE(chs.overall_score, 0) < 25 THEN 'Overall health score below 25'
           WHEN rej.count >= 2 THEN rej.count || ' content rejections in 30 days'
           WHEN cp.total_earnings > 0 AND cp.stripe_onboarding_complete = 0
             THEN '$' || cp.total_earnings || ' pending, no payout setup'
           ELSE 'No approved content in 30+ days'
         END AS detail,
         chs.overall_score
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS count FROM content
         WHERE creator_id = cp.id AND status = 'rejected'
           AND updated_at >= NOW() - INTERVAL '30 days'
       ) rej ON true
       WHERE cp.is_approved = 1 AND u.status = 'approved'
         AND (
           COALESCE(chs.overall_score, 0) < 25
           OR rej.count >= 2
           OR (cp.total_earnings > 0 AND cp.stripe_onboarding_complete = 0)
           OR NOT EXISTS (
             SELECT 1 FROM content
             WHERE creator_id = cp.id AND status = 'approved'
               AND created_at >= NOW() - INTERVAL '30 days'
           )
         )
       ORDER BY chs.overall_score ASC NULLS FIRST
       LIMIT 20`
    ),

    // High potential, low conversion: many views but few unlocks
    query<AdminCreatorAlert>(
      `SELECT
         cp.id AS creator_id,
         u.id AS user_id,
         u.username,
         u.display_name,
         u.avatar_url,
         'high_potential_low_conversion' AS alert_type,
         pv.view_count || ' profile views, ' || COALESCE(ul.unlock_count, 0) || ' unlocks (30d)' AS detail,
         chs.overall_score
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
       JOIN LATERAL (
         SELECT COUNT(*)::int AS view_count FROM creator_page_views
         WHERE creator_id = cp.id AND viewed_at >= NOW() - INTERVAL '30 days'
       ) pv ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS unlock_count FROM content_unlocks cu
         JOIN content c ON c.id = cu.content_id
         WHERE c.creator_id = cp.id AND cu.unlocked_at >= NOW() - INTERVAL '30 days'
       ) ul ON true
       WHERE cp.is_approved = 1 AND u.status = 'approved'
         AND pv.view_count >= 30
         AND COALESCE(ul.unlock_count, 0) < GREATEST(1, pv.view_count / 20)
       ORDER BY pv.view_count DESC
       LIMIT 10`
    ),

    // Trending: most new subscribers + unlocks in 7 days
    query<{
      creator_id: string; username: string; display_name: string;
      avatar_url: string | null; new_subs_7d: number; unlocks_7d: number; views_7d: number;
    }>(
      `SELECT
         cp.id AS creator_id,
         u.username,
         u.display_name,
         u.avatar_url,
         COALESCE(s7.count, 0) AS new_subs_7d,
         COALESCE(ul7.count, 0) AS unlocks_7d,
         COALESCE(pv7.count, 0) AS views_7d
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS count FROM subscriptions
         WHERE creator_id = cp.id AND started_at >= NOW() - INTERVAL '7 days'
       ) s7 ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS count FROM content_unlocks cu
         JOIN content c ON c.id = cu.content_id
         WHERE c.creator_id = cp.id AND cu.unlocked_at >= NOW() - INTERVAL '7 days'
       ) ul7 ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS count FROM creator_page_views
         WHERE creator_id = cp.id AND viewed_at >= NOW() - INTERVAL '7 days'
       ) pv7 ON true
       WHERE cp.is_approved = 1 AND u.status = 'approved'
       ORDER BY (COALESCE(s7.count, 0) * 3 + COALESCE(ul7.count, 0) + COALESCE(pv7.count, 0) * 0.1) DESC
       LIMIT 10`
    ),

    // Inactive: no approved content in 30+ days
    query<{ creator_id: string; username: string; display_name: string; days_since_post: number; last_post_at: string | null }>(
      `SELECT
         cp.id AS creator_id,
         u.username,
         u.display_name,
         EXTRACT(DAY FROM NOW() - lp.last_post_at)::int AS days_since_post,
         lp.last_post_at::text
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       JOIN LATERAL (
         SELECT MAX(created_at) AS last_post_at FROM content
         WHERE creator_id = cp.id AND status = 'approved'
       ) lp ON true
       WHERE cp.is_approved = 1 AND u.status = 'approved'
         AND (lp.last_post_at IS NULL OR lp.last_post_at < NOW() - INTERVAL '30 days')
       ORDER BY lp.last_post_at ASC NULLS FIRST
       LIMIT 15`
    ),

    // Moderation pressure
    queryOne<{ pending: string; reports: string; repeat_rej: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM content WHERE status = 'pending_review') AS pending,
         (SELECT COUNT(*)::text FROM reports WHERE status = 'open') AS reports,
         (SELECT COUNT(DISTINCT creator_id)::text FROM content
          WHERE status = 'rejected' AND updated_at >= NOW() - INTERVAL '30 days'
          GROUP BY creator_id HAVING COUNT(*) >= 2) AS repeat_rej`
    ),

    // Revenue signals
    queryOne<{ needs_review: string; no_payout: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM fulfillment_records WHERE status = 'needs_review') AS needs_review,
         (SELECT COUNT(*)::text FROM creator_profiles
          WHERE total_earnings > 0 AND stripe_onboarding_complete = 0) AS no_payout`
    ),

    // Member churn risk signals
    queryOne<{ dormant: string; expiring: string }>(
      `SELECT
         (
           SELECT COUNT(DISTINCT s.subscriber_id)::text
           FROM subscriptions s
           WHERE s.status = 'active'
             AND NOT EXISTS (
               SELECT 1 FROM user_sessions us
               WHERE us.user_id = s.subscriber_id
                 AND us.created_at >= NOW() - INTERVAL '30 days'
             )
         ) AS dormant,
         (
           SELECT COUNT(*)::text FROM subscriptions
           WHERE status = 'active'
             AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
         ) AS expiring`
    ),
  ]);

  return {
    creators_needing_support: creatorsNeedingSupport,
    high_potential_low_conversion: highPotentialLowConversion,
    trending_creators: trendingCreators,
    inactive_creators: inactiveCreators,
    moderation_pressure: {
      pending_review_count: parseInt(moderationStats?.pending ?? '0', 10),
      open_reports_count: parseInt(moderationStats?.reports ?? '0', 10),
      repeat_rejection_creators: parseInt(moderationStats?.repeat_rej ?? '0', 10),
    },
    revenue_signals: {
      fulfillment_needs_review: parseInt(revenueSignals?.needs_review ?? '0', 10),
      earnings_no_payout_setup: parseInt(revenueSignals?.no_payout ?? '0', 10),
    },
    member_risk_signals: {
      dormant_active_members_30d: parseInt(memberRisk?.dormant ?? '0', 10),
      expiring_subscriptions_7d: parseInt(memberRisk?.expiring ?? '0', 10),
    },
    generated_at: new Date().toISOString(),
  };
}
