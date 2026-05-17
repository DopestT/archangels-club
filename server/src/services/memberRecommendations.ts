/**
 * Member Recommendation Engine — ABMIE-X
 *
 * 7 recommendation types with time-decay scoring and in-memory caching.
 * All queries are read-only, non-blocking, and safe to fail silently.
 *
 * Weighting rationale:
 *   subscribe event  → 5× (strongest purchase signal)
 *   unlock event     → 2× (clear intent)
 *   page view        → 0.3× (discovery, not commitment)
 *
 * Time decay: velocity ratio compares 7-day pace vs 30-day weekly average.
 *   ratio > 1.3 = "rising fast"   ratio = 1.0 = flat   ratio < 0.7 = slowing
 *
 * Cache policy:
 *   Global queries (no user context): 5-minute TTL
 *   Per-user queries: 10-minute TTL, keyed by userId
 */

import { query, queryOne } from '../db/client.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecommendationType =
  | 'trending'
  | 'most_collected'
  | 'similar_to_vault'
  | 'recently_active'
  | 'rising_fast'
  | 'custom_requests_open'
  | 'subscription_opportunity';

export interface MemberRecommendedCreator {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  tags: string;
  subscription_price: string;
  overall_score: string | null;
  // Explanation fields
  reason: string;
  signal: string;
  action: string;
  confidence: number;
  // Section-specific metric (rendered as subtitle)
  metric_label?: string;
  metric_value?: string | number;
}

export interface RecommendationSection {
  type: RecommendationType;
  label: string;
  description: string;
  creators: MemberRecommendedCreator[];
}

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CacheEntry { data: unknown; expiresAt: number }
const _cache = new Map<string, CacheEntry>();

const TTL_GLOBAL = 5 * 60 * 1000;   // 5 min — trending, rising, etc.
const TTL_USER   = 10 * 60 * 1000;  // 10 min — per-user sections

function getCached<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached(key: string, data: unknown, ttl: number): void {
  // Evict expired entries when cache grows large
  if (_cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of _cache) { if (now > v.expiresAt) _cache.delete(k); }
  }
  _cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// Call after any purchase event (unlock or subscribe) so the next dashboard
// load reflects the new state instead of serving stale per-user sections.
export function invalidateUserCache(userId: string): void {
  const prefixes = ['similar_vault_', 'sub_opportunity_', 'interest_profile_'];
  for (const prefix of prefixes) {
    _cache.delete(`${prefix}${userId}`);
  }
}

// ── Dynamic confidence scoring ────────────────────────────────────────────────
// Confidence reflects actual signal strength rather than a static constant.
// Each type maps its metric to a calibrated 0–1 score.

function computeConfidence(type: RecommendationType, metricValue?: string | number): number {
  const v = typeof metricValue === 'string' ? parseFloat(metricValue) : (metricValue ?? 0);
  const n = isNaN(v) ? 0 : v;

  switch (type) {
    case 'subscription_opportunity':
      // 2 unlocks → 0.75, 5 → 0.83, 10+ → 0.95
      return Math.min(0.95, 0.69 + Math.min(n, 10) * 0.026);

    case 'rising_fast':
      // velocity ratio 1.3 → 0.64, 2.0 → 0.79, 3.5+ → 0.92
      return Math.min(0.92, 0.38 + Math.min(Math.max(n - 1.0, 0), 3.5) * 0.154);

    case 'similar_to_vault':
      // matching tags: 1 → 0.58, 3 → 0.72, 5+ → 0.88
      return Math.min(0.90, 0.50 + Math.min(n, 6) * 0.067);

    case 'trending':
      // new subs 7d: 0 → 0.55, 3 → 0.71, 8+ → 0.88
      return Math.min(0.92, 0.55 + Math.min(n, 10) * 0.037);

    case 'most_collected':
      // unlocks 30d: 1 → 0.60, 5 → 0.73, 20+ → 0.90
      return Math.min(0.92, 0.56 + Math.min(n, 25) * 0.014);

    case 'recently_active':
      // days since post: 1 → 0.87, 7 → 0.76, 14 → 0.65
      return Math.max(0.58, 0.91 - n * 0.019);

    case 'custom_requests_open':
      return 0.68;

    default:
      return 0.60;
  }
}

// ── Tag diversification ───────────────────────────────────────────────────────
// Prevents a section from showing 4 creators who all share the same tag cluster.
// Iterates in rank order, skipping any creator whose every tag is already at cap.
// Creators with no tags are always included.

function diversifyByTags(
  creators: MemberRecommendedCreator[],
  maxPerTag = 2
): MemberRecommendedCreator[] {
  const tagCount: Record<string, number> = {};
  const result: MemberRecommendedCreator[] = [];
  for (const c of creators) {
    let tags: string[] = [];
    try { tags = JSON.parse(c.tags); } catch {}
    if (tags.length > 0 && tags.every(t => (tagCount[t] ?? 0) >= maxPerTag)) continue;
    result.push(c);
    tags.forEach(t => { tagCount[t] = (tagCount[t] ?? 0) + 1; });
  }
  return result;
}

// ── Cross-section deduplication ───────────────────────────────────────────────
// A creator who appears in subscription_opportunity (highest intent) should NOT
// also appear in trending or similar_to_vault. Sections are processed in priority
// order; a creator is dropped from lower-priority sections once seen.

function deduplicateAcrossSections(
  sections: RecommendationSection[]
): RecommendationSection[] {
  const seenIds = new Set<string>();
  return sections
    .map(section => ({
      ...section,
      creators: section.creators.filter(c => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
      }),
    }))
    .filter(s => s.creators.length > 0);
}

// ── Helper: attach explanation and enforce shape ──────────────────────────────

function withExplanation(
  row: Record<string, unknown>,
  type: RecommendationType,
  metricValue?: string | number
): MemberRecommendedCreator {
  // Dynamic confidence replaces the former hardcoded constants.
  const confidence = computeConfidence(type, metricValue);

  const templates: Record<RecommendationType, {
    reason: string; signal: string; action: string; metric_label?: string;
  }> = {
    trending: {
      reason: 'Gaining new subscribers this week',
      signal: metricValue !== undefined ? `${metricValue} new subscribers in 7 days` : 'High 7-day velocity',
      action: 'View profile',
      metric_label: 'New subs (7d)',
    },
    most_collected: {
      reason: 'Most purchased content on the platform this month',
      signal: metricValue !== undefined ? `${metricValue} unlocks in 30 days` : 'Top unlock count',
      action: 'Explore their drops',
      metric_label: 'Unlocks (30d)',
    },
    similar_to_vault: {
      reason: 'Similar content style to creators you\'ve unlocked',
      signal: metricValue !== undefined ? `${metricValue} shared content tags` : 'Tag overlap with your vault',
      action: 'Browse their content',
      metric_label: 'Matching tags',
    },
    recently_active: {
      reason: 'Posted new content within the last 14 days',
      signal: metricValue !== undefined ? `Last post ${metricValue} days ago` : 'Recently active',
      action: 'See what\'s new',
      metric_label: 'Days since post',
    },
    rising_fast: {
      reason: 'Growing significantly faster than their 30-day average',
      signal: metricValue !== undefined ? `${Number(metricValue).toFixed(1)}× their usual pace this week` : 'Accelerating growth',
      action: 'Subscribe early',
      metric_label: 'Velocity ratio',
    },
    custom_requests_open: {
      reason: 'Accepting custom content requests',
      signal: 'Custom requests enabled — responds to fans',
      action: 'Send a request',
      metric_label: 'Open for requests',
    },
    subscription_opportunity: {
      reason: 'You\'ve already unlocked multiple pieces — subscribing could save money',
      signal: metricValue !== undefined ? `${metricValue} pieces unlocked` : 'Multiple unlocks from this creator',
      action: 'Subscribe for all-access',
      metric_label: 'Pieces unlocked',
    },
  };

  const ex = templates[type];
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    username: row.username as string,
    display_name: row.display_name as string,
    avatar_url: row.avatar_url as string | null,
    bio: (row.bio as string) ?? '',
    tags: (row.tags as string) ?? '[]',
    subscription_price: row.subscription_price as string,
    overall_score: row.overall_score as string | null,
    reason: ex.reason,
    signal: ex.signal,
    action: ex.action,
    confidence,
    metric_label: ex.metric_label,
    metric_value: metricValue,
  };
}

// ── 1. Trending creators ──────────────────────────────────────────────────────
// Ranked by time-decay weighted velocity: subs×5 + unlocks×2 + views×0.3 in 7 days.

export async function getTrendingCreators(limit = 8, excludeUserId?: string): Promise<MemberRecommendedCreator[]> {
  const cacheKey = `trending_${limit}`;
  const cached = getCached<MemberRecommendedCreator[]>(cacheKey);
  if (cached) {
    return excludeUserId ? cached.filter(c => c.user_id !== excludeUserId) : cached;
  }

  const rows = await query<any>(
    `SELECT * FROM (
       SELECT
         cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
         cp.bio, cp.tags, cp.subscription_price,
         chs.overall_score,
         (
           (SELECT COUNT(*) FROM subscriptions s2
            WHERE s2.creator_id = cp.id AND s2.started_at >= NOW() - INTERVAL '7 days') * 5 +
           (SELECT COUNT(*) FROM content_unlocks cu2
            JOIN content c2 ON c2.id = cu2.content_id
            WHERE c2.creator_id = cp.id AND cu2.unlocked_at >= NOW() - INTERVAL '7 days') * 2 +
           (SELECT COUNT(*) FROM creator_page_views pv2
            WHERE pv2.creator_id = cp.id AND pv2.viewed_at >= NOW() - INTERVAL '7 days') * 0.3
         ) AS trend_score,
         (SELECT COUNT(*) FROM subscriptions s3
          WHERE s3.creator_id = cp.id AND s3.started_at >= NOW() - INTERVAL '7 days') AS new_subs_7d
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
       WHERE cp.is_approved = 1 AND u.status = 'approved'
     ) sub
     WHERE trend_score > 0
     ORDER BY trend_score DESC
     LIMIT $1`,
    [limit + 5]
  );

  const results = rows.map(r =>
    withExplanation(r, 'trending', parseInt(r.new_subs_7d, 10))
  );
  setCached(cacheKey, results, TTL_GLOBAL);
  return excludeUserId ? results.filter(c => c.user_id !== excludeUserId).slice(0, limit) : results.slice(0, limit);
}

// ── 2. Most collected ─────────────────────────────────────────────────────────
// Creators whose content was unlocked most in the last 30 days.

export async function getMostCollectedCreators(limit = 8, excludeUserId?: string): Promise<MemberRecommendedCreator[]> {
  const cacheKey = `most_collected_${limit}`;
  const cached = getCached<MemberRecommendedCreator[]>(cacheKey);
  if (cached) {
    return excludeUserId ? cached.filter(c => c.user_id !== excludeUserId).slice(0, limit) : cached.slice(0, limit);
  }

  const rows = await query<any>(
    `SELECT
       cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
       cp.bio, cp.tags, cp.subscription_price,
       chs.overall_score,
       COUNT(cu.id) AS unlocks_30d
     FROM creator_profiles cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
     JOIN content c ON c.creator_id = cp.id AND c.status = 'approved'
     JOIN content_unlocks cu ON cu.content_id = c.id
       AND cu.unlocked_at >= NOW() - INTERVAL '30 days'
     WHERE cp.is_approved = 1 AND u.status = 'approved'
     GROUP BY cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
              cp.bio, cp.tags, cp.subscription_price, chs.overall_score
     ORDER BY unlocks_30d DESC
     LIMIT $1`,
    [limit + 5]
  );

  const results = rows.map(r =>
    withExplanation(r, 'most_collected', parseInt(r.unlocks_30d, 10))
  );
  setCached(cacheKey, results, TTL_GLOBAL);
  return excludeUserId ? results.filter(c => c.user_id !== excludeUserId).slice(0, limit) : results.slice(0, limit);
}

// ── 3. Similar to Vault ───────────────────────────────────────────────────────
// Creators sharing tags with content the member has unlocked (personalised).

export async function getSimilarToVault(userId: string, limit = 8): Promise<MemberRecommendedCreator[]> {
  const cacheKey = `similar_vault_${userId}`;
  const cached = getCached<MemberRecommendedCreator[]>(cacheKey);
  if (cached) return cached.slice(0, limit);

  // First: check if user has any unlocked content at all
  const hasUnlocks = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM content_unlocks WHERE user_id = $1`,
    [userId]
  );
  if (parseInt(hasUnlocks?.count ?? '0', 10) === 0) return [];

  const rows = await query<any>(
    `WITH user_tags AS (
       SELECT DISTINCT tag_value
       FROM content_unlocks cu
       JOIN content c ON c.id = cu.content_id
       JOIN creator_profiles cp ON cp.id = c.creator_id
       CROSS JOIN LATERAL jsonb_array_elements_text(
         CASE WHEN cp.tags ~ '^\[' THEN cp.tags::jsonb ELSE '[]'::jsonb END
       ) AS tag_value
       WHERE cu.user_id = $1
     )
     SELECT
       cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
       cp.bio, cp.tags, cp.subscription_price,
       chs.overall_score,
       COUNT(DISTINCT ut.tag_value) AS matching_tags
     FROM creator_profiles cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
     CROSS JOIN LATERAL jsonb_array_elements_text(
       CASE WHEN cp.tags ~ '^\[' THEN cp.tags::jsonb ELSE '[]'::jsonb END
     ) AS tag_value
     JOIN user_tags ut ON ut.tag_value = tag_value
     WHERE cp.is_approved = 1 AND u.status = 'approved'
       AND cp.user_id != $1
       AND cp.id NOT IN (
         SELECT creator_id FROM subscriptions
         WHERE subscriber_id = $1 AND status = 'active'
       )
       AND cp.id NOT IN (
         SELECT DISTINCT cp2.id FROM content_unlocks cu2
         JOIN content c2 ON c2.id = cu2.content_id
         JOIN creator_profiles cp2 ON cp2.id = c2.creator_id
         WHERE cu2.user_id = $1
       )
     GROUP BY cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
              cp.bio, cp.tags, cp.subscription_price, chs.overall_score
     ORDER BY matching_tags DESC, COALESCE(chs.overall_score, 0) DESC
     LIMIT $2`,
    [userId, limit]
  );

  const results = rows.map(r =>
    withExplanation(r, 'similar_to_vault', parseInt(r.matching_tags, 10))
  );
  setCached(cacheKey, results, TTL_USER);
  return results;
}

// ── 4. Recently active creators ───────────────────────────────────────────────
// Creators who posted approved content in last 14 days, scored by recency.
// Recency score: 1 / (1 + days_since_post / 7) decays from 1.0 to ~0.5 at 7 days.

export async function getRecentlyActiveCreators(limit = 8, excludeUserId?: string): Promise<MemberRecommendedCreator[]> {
  const cacheKey = `recently_active_${limit}`;
  const cached = getCached<MemberRecommendedCreator[]>(cacheKey);
  if (cached) {
    return excludeUserId ? cached.filter(c => c.user_id !== excludeUserId).slice(0, limit) : cached.slice(0, limit);
  }

  const rows = await query<any>(
    `SELECT
       cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
       cp.bio, cp.tags, cp.subscription_price,
       chs.overall_score,
       MAX(c.created_at) AS last_post_at,
       EXTRACT(DAY FROM NOW() - MAX(c.created_at))::int AS days_since_post,
       1.0 / (1.0 + EXTRACT(DAY FROM NOW() - MAX(c.created_at)) / 7.0) AS recency_score
     FROM creator_profiles cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
     JOIN content c ON c.creator_id = cp.id
       AND c.status = 'approved'
       AND c.created_at >= NOW() - INTERVAL '14 days'
     WHERE cp.is_approved = 1 AND u.status = 'approved'
     GROUP BY cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
              cp.bio, cp.tags, cp.subscription_price, chs.overall_score
     ORDER BY recency_score DESC, COALESCE(chs.overall_score, 0) DESC
     LIMIT $1`,
    [limit + 5]
  );

  const results = rows.map(r =>
    withExplanation(r, 'recently_active', parseInt(r.days_since_post, 10))
  );
  setCached(cacheKey, results, TTL_GLOBAL);
  return excludeUserId ? results.filter(c => c.user_id !== excludeUserId).slice(0, limit) : results.slice(0, limit);
}

// ── 5. Rising fast ────────────────────────────────────────────────────────────
// Creators whose 7-day pace is ≥1.3× their 30-day weekly average.
// velocity_ratio = (score_7d) / (score_30d / 4)
// A ratio of 1.3 means 30% above their own baseline — genuinely accelerating.

export async function getRisingFastCreators(limit = 8, excludeUserId?: string): Promise<MemberRecommendedCreator[]> {
  const cacheKey = `rising_fast_${limit}`;
  const cached = getCached<MemberRecommendedCreator[]>(cacheKey);
  if (cached) {
    return excludeUserId ? cached.filter(c => c.user_id !== excludeUserId).slice(0, limit) : cached.slice(0, limit);
  }

  const rows = await query<any>(
    `WITH velocity AS (
       SELECT
         cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
         cp.bio, cp.tags, cp.subscription_price,
         chs.overall_score,
         -- 7-day weighted activity
         COALESCE(
           (SELECT COUNT(*) FROM subscriptions WHERE creator_id = cp.id
            AND started_at >= NOW() - INTERVAL '7 days') * 5 +
           (SELECT COUNT(*) FROM content_unlocks cu
            JOIN content c ON c.id = cu.content_id
            WHERE c.creator_id = cp.id AND cu.unlocked_at >= NOW() - INTERVAL '7 days') * 2 +
           (SELECT COUNT(*) FROM creator_page_views
            WHERE creator_id = cp.id AND viewed_at >= NOW() - INTERVAL '7 days') * 0.3,
           0
         ) AS score_7d,
         -- 30-day total (divided by 4 = weekly average for the period)
         GREATEST(COALESCE(
           (SELECT COUNT(*) FROM subscriptions WHERE creator_id = cp.id
            AND started_at >= NOW() - INTERVAL '30 days') * 5 +
           (SELECT COUNT(*) FROM content_unlocks cu
            JOIN content c ON c.id = cu.content_id
            WHERE c.creator_id = cp.id AND cu.unlocked_at >= NOW() - INTERVAL '30 days') * 2 +
           (SELECT COUNT(*) FROM creator_page_views
            WHERE creator_id = cp.id AND viewed_at >= NOW() - INTERVAL '30 days') * 0.3,
           0
         ) / 4.0, 0.01) AS score_30d_weekly_avg
       FROM creator_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
       WHERE cp.is_approved = 1 AND u.status = 'approved'
     )
     SELECT
       *,
       ROUND((score_7d / score_30d_weekly_avg)::numeric, 2) AS velocity_ratio
     FROM velocity
     WHERE score_7d > 0
       AND (score_7d / score_30d_weekly_avg) >= 1.3
     ORDER BY velocity_ratio DESC
     LIMIT $1`,
    [limit + 5]
  );

  const results = rows.map(r =>
    withExplanation(r, 'rising_fast', parseFloat(r.velocity_ratio))
  );
  setCached(cacheKey, results, TTL_GLOBAL);
  return excludeUserId ? results.filter(c => c.user_id !== excludeUserId).slice(0, limit) : results.slice(0, limit);
}

// ── 6. Custom requests open ───────────────────────────────────────────────────
// Creators who accept custom requests and aren't overwhelmed (< 10 pending).
// Sorted by responsiveness (completed requests 30d) then health score.

export async function getCustomRequestsOpen(limit = 8, excludeUserId?: string): Promise<MemberRecommendedCreator[]> {
  const cacheKey = `custom_open_${limit}`;
  const cached = getCached<MemberRecommendedCreator[]>(cacheKey);
  if (cached) {
    return excludeUserId ? cached.filter(c => c.user_id !== excludeUserId).slice(0, limit) : cached.slice(0, limit);
  }

  const rows = await query<any>(
    `SELECT
       cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
       cp.bio, cp.tags, cp.subscription_price,
       chs.overall_score,
       COUNT(cr.id) FILTER (WHERE cr.status = 'pending') AS pending_count,
       COUNT(cr.id) FILTER (
         WHERE cr.status IN ('completed','accepted')
           AND cr.created_at >= NOW() - INTERVAL '30 days'
       ) AS completed_30d
     FROM creator_profiles cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
     LEFT JOIN custom_requests cr ON cr.creator_id = cp.id
     WHERE cp.is_approved = 1 AND u.status = 'approved'
       AND cp.custom_requests_enabled = 1
     GROUP BY cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
              cp.bio, cp.tags, cp.subscription_price, chs.overall_score
     HAVING COUNT(cr.id) FILTER (WHERE cr.status = 'pending') < 10
     ORDER BY completed_30d DESC, COALESCE(chs.overall_score, 0) DESC
     LIMIT $1`,
    [limit + 5]
  );

  const results = rows.map(r => withExplanation(r, 'custom_requests_open'));
  setCached(cacheKey, results, TTL_GLOBAL);
  return excludeUserId ? results.filter(c => c.user_id !== excludeUserId).slice(0, limit) : results.slice(0, limit);
}

// ── 7. Subscription opportunity ───────────────────────────────────────────────
// Creators the user has unlocked 2+ items from but hasn't subscribed to.
// Strong intent signal — they keep buying piecemeal.

export async function getSubscriptionOpportunities(userId: string, limit = 6): Promise<MemberRecommendedCreator[]> {
  const cacheKey = `sub_opportunity_${userId}`;
  const cached = getCached<MemberRecommendedCreator[]>(cacheKey);
  if (cached) return cached.slice(0, limit);

  const rows = await query<any>(
    `SELECT
       cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
       cp.bio, cp.tags, cp.subscription_price,
       chs.overall_score,
       COUNT(cu.id) AS user_unlock_count,
       ROUND(SUM(c.price)::numeric, 2) AS user_spend,
       ROUND(GREATEST(SUM(c.price) - cp.subscription_price, 0)::numeric, 2) AS potential_savings
     FROM creator_profiles cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
     JOIN content c ON c.creator_id = cp.id AND c.status = 'approved'
     JOIN content_unlocks cu ON cu.content_id = c.id AND cu.user_id = $1
     WHERE cp.is_approved = 1 AND u.status = 'approved'
       AND cp.id NOT IN (
         SELECT creator_id FROM subscriptions
         WHERE subscriber_id = $1 AND status = 'active'
       )
     GROUP BY cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
              cp.bio, cp.tags, cp.subscription_price, chs.overall_score
     HAVING COUNT(cu.id) >= 2
     ORDER BY user_unlock_count DESC, potential_savings DESC
     LIMIT $2`,
    [userId, limit]
  );

  const results = rows.map(r =>
    withExplanation(r, 'subscription_opportunity', parseInt(r.user_unlock_count, 10))
  );
  setCached(cacheKey, results, TTL_USER);
  return results;
}

// ── Main: all sections ────────────────────────────────────────────────────────
// Runs global queries in parallel, then merges with user-specific results.
// Empty sections are omitted. Each section capped at 6 creators.

export async function getMemberRecommendationSections(userId: string): Promise<RecommendationSection[]> {
  const CAP = 6;

  // Global queries — run in parallel (all cached independently)
  const [trending, mostCollected, recentlyActive, risingFast, customOpen] = await Promise.all([
    getTrendingCreators(CAP + 2, userId).catch(() => []),
    getMostCollectedCreators(CAP + 2, userId).catch(() => []),
    getRecentlyActiveCreators(CAP + 2, userId).catch(() => []),
    getRisingFastCreators(CAP + 2, userId).catch(() => []),
    getCustomRequestsOpen(CAP + 2, userId).catch(() => []),
  ]);

  // User-specific queries — run in parallel (cached per user)
  const [similarToVault, subOpportunities] = await Promise.all([
    getSimilarToVault(userId, CAP).catch(() => []),
    getSubscriptionOpportunities(userId, CAP).catch(() => []),
  ]);

  const sections: RecommendationSection[] = [
    // Subscription opportunity first if the user has unlocks — highest intent signal
    {
      type: 'subscription_opportunity',
      label: 'Subscribe & Save',
      description: 'You\'ve unlocked multiple pieces from these creators — a subscription gives you all-access.',
      creators: subOpportunities.slice(0, CAP),
    },
    {
      type: 'trending',
      label: 'Trending This Week',
      description: 'Gaining the most new subscribers and unlocks right now.',
      creators: trending.slice(0, CAP),
    },
    {
      type: 'similar_to_vault',
      label: 'You Might Like',
      description: 'Creators with content styles similar to your vault.',
      creators: similarToVault.slice(0, CAP),
    },
    {
      type: 'rising_fast',
      label: 'Rising Fast',
      description: 'Growing significantly faster than their own recent average.',
      creators: risingFast.slice(0, CAP),
    },
    {
      type: 'most_collected',
      label: 'Most Collected',
      description: 'Content bought most often by members in the last 30 days.',
      creators: mostCollected.slice(0, CAP),
    },
    {
      type: 'recently_active',
      label: 'Just Posted',
      description: 'Active creators who published in the last two weeks.',
      creators: recentlyActive.slice(0, CAP),
    },
    {
      type: 'custom_requests_open',
      label: 'Open for Requests',
      description: 'Creators currently accepting custom content requests.',
      creators: customOpen.slice(0, CAP),
    },
  ];

  // Apply tag diversity within each section, then deduplicate creators across sections
  const diversified = sections.map(section => ({
    ...section,
    creators: diversifyByTags(section.creators, 2),
  }));
  return deduplicateAcrossSections(diversified);
}

// ── Affinity picks (fast personalised fallback for dashboard) ─────────────────
// Top N creators by engagement signal — used when all else is empty.

export async function getAffinityPicksForUser(
  userId: string,
  limit = 4
): Promise<{ username: string; display_name: string; avatar_url: string | null; subscription_price: number; reason: string }[]> {
  const rows = await query<any>(
    `SELECT
       u.username, u.display_name, u.avatar_url,
       cp.subscription_price,
       COALESCE(SUM(es.weight), 0) AS affinity,
       (SELECT COUNT(*) FROM subscriptions s2
        WHERE s2.creator_id = cp.id AND s2.status = 'active') AS sub_count,
       chs.overall_score
     FROM creator_profiles cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
     LEFT JOIN engagement_signals es ON es.creator_id = cp.id AND es.user_id = $1
       AND es.created_at >= NOW() - INTERVAL '60 days'
     WHERE cp.is_approved = 1 AND u.status = 'approved'
       AND cp.user_id != $1
       AND cp.id NOT IN (
         SELECT creator_id FROM subscriptions
         WHERE subscriber_id = $1 AND status = 'active'
       )
     GROUP BY cp.id, cp.user_id, u.username, u.display_name, u.avatar_url,
              cp.subscription_price, chs.overall_score
     ORDER BY affinity DESC NULLS LAST,
              COALESCE(chs.overall_score, 0) DESC,
              sub_count DESC
     LIMIT $2`,
    [userId, limit]
  );

  return rows.map(r => ({
    username: r.username,
    display_name: r.display_name,
    avatar_url: r.avatar_url,
    subscription_price: parseFloat(r.subscription_price),
    reason: parseFloat(r.affinity) > 1
      ? 'Based on your recent activity'
      : parseFloat(r.overall_score ?? '0') > 60
      ? 'Highly active creator'
      : 'Popular on the platform',
  }));
}

// ── Rules-based guidance (replaces AI tips) ───────────────────────────────────
// Generates 2-3 factual, actionable guidance tips from the member's real data.

export async function getMemberGuidanceTips(userId: string): Promise<{ text: string }[]> {
  const [unlockCount, subCount, savedCount, spendRow, subOpps] = await Promise.all([
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM content_unlocks WHERE user_id = $1`, [userId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM subscriptions WHERE subscriber_id = $1 AND status = 'active'`, [userId]
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM saved_content WHERE user_id = $1`, [userId]
    ),
    queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(c.price), 0) AS total
       FROM content_unlocks cu JOIN content c ON c.id = cu.content_id
       WHERE cu.user_id = $1`, [userId]
    ),
    getSubscriptionOpportunities(userId, 1).catch(() => []),
  ]);

  const unlocks = parseInt(unlockCount?.count ?? '0', 10);
  const subs = parseInt(subCount?.count ?? '0', 10);
  const saved = parseInt(savedCount?.count ?? '0', 10);
  const totalSpend = parseFloat(spendRow?.total ?? '0');
  const tips: { text: string }[] = [];

  if (subOpps.length > 0) {
    const opp = subOpps[0];
    tips.push({
      text: `You've unlocked ${opp.metric_value} pieces from @${opp.username}. A subscription at $${parseFloat(opp.subscription_price).toFixed(2)}/mo gives you all-access — it may cost less than buying individually.`,
    });
  }

  if (unlocks === 0 && subs === 0) {
    tips.push({ text: 'Explore the platform and unlock your first piece — try browsing by the content type you enjoy most.' });
  } else if (unlocks > 0 && subs === 0) {
    tips.push({ text: `You've unlocked ${unlocks} piece${unlocks > 1 ? 's' : ''} so far. Subscribing to a creator gives you all-access to their library for a flat monthly rate.` });
  } else if (subs > 0) {
    tips.push({ text: `You have ${subs} active subscription${subs > 1 ? 's' : ''}. Check your subscribed creators for new drops — subscribers see content before anyone else.` });
  }

  if (saved > 0 && unlocks < saved) {
    tips.push({ text: `You've saved ${saved} piece${saved > 1 ? 's' : ''} to your library. Unlock them to get permanent access, or subscribe to the creator for all-access.` });
  }

  if (totalSpend > 0 && subs === 0) {
    tips.push({ text: `You've spent $${totalSpend.toFixed(2)} on individual unlocks. Compare that to a monthly subscription — you may get more value from a plan.` });
  }

  if (tips.length === 0) {
    tips.push({ text: 'Browse the Explore page to discover new creators. Filter by content type or price to find what fits your preferences.' });
  }

  return tips.slice(0, 3);
}
