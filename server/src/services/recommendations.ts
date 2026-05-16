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
): Promise<CreatorRow[]> {
  // Fetch creators the user is NOT already subscribed to, ranked by:
  // 1. Existing engagement affinity (signal weight sum)
  // 2. Creator health overall score
  // 3. Subscriber count
  return query<CreatorRow>(
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
): Promise<CreatorRow[]> {
  // Creators who share tags with a given creator, excluding themselves
  const source = await queryOne<{ tags: string }>(
    `SELECT tags FROM creator_profiles WHERE id = $1`,
    [creatorProfileId]
  );
  if (!source) return [];

  let parsedTags: string[] = [];
  try { parsedTags = JSON.parse(source.tags); } catch { parsedTags = []; }
  if (parsedTags.length === 0) return [];

  // Use jsonb containment for any tag overlap
  return query<CreatorRow>(
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
}
