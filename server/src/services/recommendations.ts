import { query, queryOne } from '../db/client.js';

interface CreatorRow {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  tags: string;
  subscription_price: string;
  overall_score: string | null;
  sub_count: string;
  affinity: string | null;
}

export interface RecommendedCreator extends CreatorRow {
  reason: string;       // Why this creator was recommended (user-facing)
  signal: string;       // The underlying data point
  action: string;       // What to do next
  confidence: number;   // 0–1
}

function buildExplanation(row: CreatorRow): Pick<RecommendedCreator, 'reason' | 'signal' | 'action' | 'confidence'> {
  const affinity = parseFloat(row.affinity ?? '0');
  const health = parseFloat(row.overall_score ?? '0');
  const subs = parseInt(row.sub_count, 10);

  if (affinity >= 5.0) {
    return {
      reason: 'You\'ve engaged with their content before',
      signal: `${affinity.toFixed(1)} affinity score from your recent interactions`,
      action: 'View profile',
      confidence: Math.min(0.95, 0.7 + affinity * 0.02),
    };
  }
  if (affinity >= 1.0) {
    return {
      reason: 'You\'ve viewed their profile recently',
      signal: `Engagement signal: ${affinity.toFixed(1)}`,
      action: 'Explore their content',
      confidence: 0.65,
    };
  }
  if (health >= 75) {
    return {
      reason: 'Highly active creator with strong engagement',
      signal: `Creator health score: ${health.toFixed(0)}/100`,
      action: 'Subscribe for regular content',
      confidence: 0.7,
    };
  }
  if (subs >= 20) {
    return {
      reason: `Popular with ${subs} active subscribers`,
      signal: `${subs} members are subscribed`,
      action: 'See what they offer',
      confidence: 0.6,
    };
  }
  return {
    reason: 'Matches your interests',
    signal: 'Based on platform activity',
    action: 'View profile',
    confidence: 0.5,
  };
}

interface ContentRow {
  id: string;
  title: string;
  description: string;
  content_type: string;
  access_type: string;
  price: string;
  preview_url: string | null;
  creator_username: string;
  creator_display_name: string;
  creator_avatar: string | null;
  unlock_count: string;
}

export async function getCreatorRecommendations(
  userId: string,
  limit = 8
): Promise<RecommendedCreator[]> {
  const rows = await query<CreatorRow>(
    `SELECT
       cp.id,
       cp.user_id,
       u.username,
       u.display_name,
       u.avatar_url,
       cp.bio,
       cp.tags,
       cp.subscription_price,
       chs.overall_score,
       (SELECT COUNT(*) FROM subscriptions s2
        WHERE s2.creator_id = cp.id AND s2.status = 'active') AS sub_count,
       (SELECT COALESCE(SUM(es.weight), 0)
        FROM engagement_signals es
        WHERE es.user_id = $1 AND es.creator_id = cp.id
          AND es.created_at >= NOW() - INTERVAL '60 days') AS affinity
     FROM creator_profiles cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
     WHERE cp.is_approved = 1
       AND u.status = 'approved'
       AND cp.id NOT IN (
         SELECT creator_id FROM subscriptions
         WHERE subscriber_id = $1 AND status = 'active'
       )
       AND cp.user_id != $1
     ORDER BY
       affinity DESC NULLS LAST,
       COALESCE(chs.overall_score, 0) DESC,
       sub_count DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map(r => ({ ...r, ...buildExplanation(r) }));
}

export async function getTrendingContent(limit = 12): Promise<ContentRow[]> {
  // Content with most unlocks in last 7 days, approved only
  return query<ContentRow>(
    `SELECT
       c.id,
       c.title,
       c.description,
       c.content_type,
       c.access_type,
       c.price,
       c.preview_url,
       u.username AS creator_username,
       u.display_name AS creator_display_name,
       u.avatar_url AS creator_avatar,
       COUNT(cu.id) AS unlock_count
     FROM content c
     JOIN creator_profiles cp ON cp.id = c.creator_id
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN content_unlocks cu ON cu.content_id = c.id
       AND cu.unlocked_at >= NOW() - INTERVAL '7 days'
     WHERE c.status = 'approved'
       AND cp.is_approved = 1
     GROUP BY c.id, u.username, u.display_name, u.avatar_url
     ORDER BY unlock_count DESC, c.created_at DESC
     LIMIT $1`,
    [limit]
  );
}

export async function getSimilarCreators(
  creatorProfileId: string,
  limit = 5
): Promise<RecommendedCreator[]> {
  const source = await queryOne<{ tags: string }>(
    `SELECT tags FROM creator_profiles WHERE id = $1`,
    [creatorProfileId]
  );
  if (!source) return [];

  let parsedTags: string[] = [];
  try { parsedTags = JSON.parse(source.tags); } catch { parsedTags = []; }
  if (parsedTags.length === 0) return [];

  const rows = await query<CreatorRow>(
    `SELECT
       cp.id,
       cp.user_id,
       u.username,
       u.display_name,
       u.avatar_url,
       cp.bio,
       cp.tags,
       cp.subscription_price,
       chs.overall_score,
       (SELECT COUNT(*) FROM subscriptions s2
        WHERE s2.creator_id = cp.id AND s2.status = 'active') AS sub_count,
       NULL AS affinity
     FROM creator_profiles cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN creator_health_scores chs ON chs.creator_id = cp.id
     WHERE cp.id != $1
       AND cp.is_approved = 1
       AND u.status = 'approved'
       AND cp.tags::jsonb ?| $2::text[]
     ORDER BY COALESCE(chs.overall_score, 0) DESC
     LIMIT $3`,
    [creatorProfileId, parsedTags, limit]
  );
  return rows.map(r => ({
    ...r,
    reason: 'Similar content style',
    signal: 'Shares tags with this creator',
    action: 'View profile',
    confidence: 0.6,
  }));
}
