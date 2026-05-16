import { query, queryOne, execute } from '../db/client.js';

interface HealthInput {
  creatorProfileId: string;
}

interface ContentRow { created_at: string }
interface SubRow { started_at: string }
interface TransRow { net_amount: string; created_at: string }
interface HealthRow {
  creator_id: string;
  overall_score: string;
  posting_score: string;
  engagement_score: string;
  revenue_score: string;
  retention_score: string;
  streak_days: number;
  last_post_at: string | null;
  computed_at: string;
}

export async function computeCreatorHealth(opts: HealthInput): Promise<void> {
  const { creatorProfileId } = opts;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // ── Posting score ──────────────────────────────────────────────────────────
  // Based on approved content published in last 30 days
  const recentContent = await query<ContentRow>(
    `SELECT created_at FROM content
     WHERE creator_id = $1 AND status = 'approved'
       AND created_at >= $2
     ORDER BY created_at DESC`,
    [creatorProfileId, thirtyDaysAgo.toISOString()]
  );

  const lastPost = recentContent[0]?.created_at ?? null;
  const postCount30d = recentContent.length;
  // Target: 8+ posts / 30 days = 100; linear below
  const postingScore = Math.min(100, (postCount30d / 8) * 100);

  // Streak: consecutive days with at least one post (from most recent back)
  let streakDays = 0;
  if (recentContent.length > 0) {
    const postDates = new Set(
      recentContent.map(r => new Date(r.created_at).toISOString().slice(0, 10))
    );
    let cursor = new Date(now);
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (!postDates.has(key)) break;
      streakDays++;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
      if (streakDays > 365) break;
    }
  }

  // ── Engagement score ────────────────────────────────────────────────────────
  // Based on 30-day signals (views, unlocks, messages)
  const signalRows = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(weight), 0) AS total
     FROM engagement_signals
     WHERE creator_id = $1 AND created_at >= $2`,
    [creatorProfileId, thirtyDaysAgo.toISOString()]
  );
  const signalSum = parseFloat(signalRows?.total ?? '0');
  // Target: 50 weighted signals / 30 days = 100
  const engagementScore = Math.min(100, (signalSum / 50) * 100);

  // ── Revenue score ───────────────────────────────────────────────────────────
  // 30-day vs 90-day avg — upward trend = high score
  const rev30 = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(net_amount), 0) AS total
     FROM transactions
     WHERE payee_id = (SELECT user_id FROM creator_profiles WHERE id = $1)
       AND status = 'completed' AND created_at >= $2`,
    [creatorProfileId, thirtyDaysAgo.toISOString()]
  );
  const rev90Rows = await query<TransRow>(
    `SELECT net_amount, created_at FROM transactions
     WHERE payee_id = (SELECT user_id FROM creator_profiles WHERE id = $1)
       AND status = 'completed' AND created_at >= $2`,
    [creatorProfileId, ninetyDaysAgo.toISOString()]
  );
  const total30 = parseFloat(rev30?.total ?? '0');
  // Monthly avg over 90 days
  const total90Monthly = rev90Rows.reduce((s, r) => s + parseFloat(r.net_amount), 0) / 3;
  let revenueScore = 50; // neutral baseline
  if (total90Monthly > 0) {
    const ratio = total30 / total90Monthly;
    // ratio 1.0 = same as avg = 50; 2.0+ = 100; 0 = 0
    revenueScore = Math.min(100, Math.max(0, ratio * 50));
  } else if (total30 > 0) {
    revenueScore = 70; // earning but no prior history — good sign
  }

  // ── Retention score ─────────────────────────────────────────────────────────
  // Ratio of still-active subs vs total subs ever
  const totalSubs = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM subscriptions WHERE creator_id = $1`,
    [creatorProfileId]
  );
  const activeSubs = await queryOne<{ active: string }>(
    `SELECT COUNT(*) AS active FROM subscriptions
     WHERE creator_id = $1 AND status = 'active'`,
    [creatorProfileId]
  );
  const tTotal = parseInt(totalSubs?.total ?? '0', 10);
  const tActive = parseInt(activeSubs?.active ?? '0', 10);
  const retentionScore = tTotal > 0 ? Math.min(100, (tActive / tTotal) * 100) : 50;

  // ── Overall ─────────────────────────────────────────────────────────────────
  const overall =
    postingScore * 0.3 +
    engagementScore * 0.3 +
    revenueScore * 0.25 +
    retentionScore * 0.15;

  await execute(
    `INSERT INTO creator_health_scores
       (creator_id, posting_score, engagement_score, revenue_score, retention_score,
        overall_score, streak_days, last_post_at, computed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (creator_id) DO UPDATE SET
       posting_score    = EXCLUDED.posting_score,
       engagement_score = EXCLUDED.engagement_score,
       revenue_score    = EXCLUDED.revenue_score,
       retention_score  = EXCLUDED.retention_score,
       overall_score    = EXCLUDED.overall_score,
       streak_days      = EXCLUDED.streak_days,
       last_post_at     = EXCLUDED.last_post_at,
       computed_at      = NOW()`,
    [
      creatorProfileId,
      postingScore.toFixed(2),
      engagementScore.toFixed(2),
      revenueScore.toFixed(2),
      retentionScore.toFixed(2),
      overall.toFixed(2),
      streakDays,
      lastPost,
    ]
  );
}

export async function getCreatorHealth(creatorProfileId: string): Promise<HealthRow | null> {
  return queryOne<HealthRow>(
    `SELECT * FROM creator_health_scores WHERE creator_id = $1`,
    [creatorProfileId]
  );
}

export async function getAllCreatorHealthScores(): Promise<HealthRow[]> {
  return query<HealthRow>(
    `SELECT chs.*, cp.user_id,
            u.display_name, u.username, u.avatar_url
     FROM creator_health_scores chs
     JOIN creator_profiles cp ON cp.id = chs.creator_id
     JOIN users u ON u.id = cp.user_id
     ORDER BY chs.overall_score DESC`
  );
}
