/**
 * Member Interest Profiling — ABMIE-X
 *
 * Builds a lightweight interest profile from a member's vault behavior:
 * unlocks, subscriptions, saves, and page views. Used by the AI layer to
 * personalise recommendations without rerunning expensive SQL on every request.
 *
 * Tag affinity is weighted by action type:
 *   subscribe = 5× (strongest signal)
 *   unlock    = 2×
 *   save      = 1×
 *   page view = 0.3×
 *
 * Recency decay: signals older than 30 days contribute at 50% weight.
 */

import { query, queryOne } from '../db/client.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TagAffinity {
  tag: string;
  weight: number;
  unlock_count: number;
  sub_count: number;
}

export interface MemberInterestProfile {
  user_id: string;
  top_tags: TagAffinity[];           // Sorted by weight desc, max 10
  engagement_recency_days: number;   // Days since last unlock/sub/save; -1 if none
  avg_unlock_price: number;          // Mean price of unlocked content; 0 if no unlocks
  total_signal_weight: number;       // Sum of all weighted signals (vault depth)
  has_unlock_history: boolean;
  has_sub_history: boolean;
  profile_generated_at: string;      // ISO timestamp
}

// ── Profile computation ───────────────────────────────────────────────────────

export async function getMemberInterestProfile(userId: string): Promise<MemberInterestProfile> {
  const [tagRows, metricsRow, recencyRow] = await Promise.all([
    // Tag affinity: aggregate weighted signals from unlocks and subscriptions
    query<{ tag: string; weight: number; unlock_count: number; sub_count: number }>(
      `WITH unlock_tags AS (
         SELECT
           tag_value AS tag,
           CASE
             WHEN cu.unlocked_at >= NOW() - INTERVAL '30 days' THEN 2.0
             ELSE 1.0
           END AS weight,
           1 AS unlock_count,
           0 AS sub_count
         FROM content_unlocks cu
         JOIN content c ON c.id = cu.content_id
         JOIN creator_profiles cp ON cp.id = c.creator_id
         CROSS JOIN LATERAL jsonb_array_elements_text(
           CASE WHEN cp.tags ~ '^\[' THEN cp.tags::jsonb ELSE '[]'::jsonb END
         ) AS tag_value
         WHERE cu.user_id = $1
       ),
       sub_tags AS (
         SELECT
           tag_value AS tag,
           CASE
             WHEN s.started_at >= NOW() - INTERVAL '30 days' THEN 5.0
             ELSE 2.5
           END AS weight,
           0 AS unlock_count,
           1 AS sub_count
         FROM subscriptions s
         JOIN creator_profiles cp ON cp.id = s.creator_id
         CROSS JOIN LATERAL jsonb_array_elements_text(
           CASE WHEN cp.tags ~ '^\[' THEN cp.tags::jsonb ELSE '[]'::jsonb END
         ) AS tag_value
         WHERE s.subscriber_id = $1
       ),
       all_signals AS (
         SELECT * FROM unlock_tags
         UNION ALL
         SELECT * FROM sub_tags
       )
       SELECT
         tag,
         ROUND(SUM(weight)::numeric, 2)      AS weight,
         SUM(unlock_count)::int              AS unlock_count,
         SUM(sub_count)::int                 AS sub_count
       FROM all_signals
       GROUP BY tag
       ORDER BY weight DESC
       LIMIT 10`,
      [userId]
    ),

    // Engagement metrics: avg unlock price, total signals, has history flags
    queryOne<{
      total_signal_weight: string;
      avg_unlock_price: string;
      has_unlocks: string;
      has_subs: string;
    }>(
      `SELECT
         COALESCE(
           (SELECT SUM(es.weight) FROM engagement_signals es
            WHERE es.user_id = $1 AND es.created_at >= NOW() - INTERVAL '60 days'),
           0
         ) AS total_signal_weight,
         COALESCE(
           (SELECT AVG(c.price) FROM content_unlocks cu
            JOIN content c ON c.id = cu.content_id
            WHERE cu.user_id = $1),
           0
         ) AS avg_unlock_price,
         (SELECT COUNT(*) > 0 FROM content_unlocks WHERE user_id = $1)::int AS has_unlocks,
         (SELECT COUNT(*) > 0 FROM subscriptions WHERE subscriber_id = $1)::int AS has_subs`,
      [userId]
    ),

    // Recency: days since last meaningful engagement
    queryOne<{ last_event_at: string | null }>(
      `SELECT MAX(event_at) AS last_event_at FROM (
         SELECT unlocked_at AS event_at FROM content_unlocks WHERE user_id = $1
         UNION ALL
         SELECT started_at FROM subscriptions WHERE subscriber_id = $1
         UNION ALL
         SELECT created_at FROM saved_content WHERE user_id = $1
       ) AS events`,
      [userId]
    ),
  ]);

  const lastEvent = recencyRow?.last_event_at ? new Date(recencyRow.last_event_at) : null;
  const recencyDays = lastEvent
    ? Math.round((Date.now() - lastEvent.getTime()) / 86_400_000)
    : -1;

  return {
    user_id: userId,
    top_tags: (tagRows ?? []).map(r => ({
      tag: r.tag,
      weight: parseFloat(String(r.weight)),
      unlock_count: Number(r.unlock_count),
      sub_count: Number(r.sub_count),
    })),
    engagement_recency_days: recencyDays,
    avg_unlock_price: parseFloat(metricsRow?.avg_unlock_price ?? '0'),
    total_signal_weight: parseFloat(metricsRow?.total_signal_weight ?? '0'),
    has_unlock_history: parseInt(metricsRow?.has_unlocks ?? '0', 10) === 1,
    has_sub_history: parseInt(metricsRow?.has_subs ?? '0', 10) === 1,
    profile_generated_at: new Date().toISOString(),
  };
}
