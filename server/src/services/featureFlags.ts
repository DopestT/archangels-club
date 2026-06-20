import { execute, query, queryOne } from '../db/schema.js';

export type FlagKey =
  | 'enable_live_rooms'
  | 'enable_gold_purchases'
  | 'enable_gold_gifts'
  | 'enable_vault_purchases'
  | 'enable_creator_uploads'
  | 'enable_creator_publishing'
  | 'enable_creator_onboarding'
  | 'enable_admin_moderation'
  | 'enable_launch_tuning_banner'
  | 'enable_email_notifications';

export const ALL_FLAGS: FlagKey[] = [
  'enable_live_rooms',
  'enable_gold_purchases',
  'enable_gold_gifts',
  'enable_vault_purchases',
  'enable_creator_uploads',
  'enable_creator_publishing',
  'enable_creator_onboarding',
  'enable_admin_moderation',
  'enable_launch_tuning_banner',
  'enable_email_notifications',
];

// Descriptions shown in the admin UI
export const FLAG_DESCRIPTIONS: Record<FlagKey, string> = {
  enable_live_rooms:          'Live streaming rooms — start, join, chat, tip',
  enable_gold_purchases:      'Gold balance top-ups and Gold-powered checkout',
  enable_gold_gifts:          'Gold gifts in Live Rooms (Patron Ladder, Room Goals)',
  enable_vault_purchases:     'Vault subscriptions and content unlock purchases',
  enable_creator_uploads:     'Creator content uploads to Cloudinary',
  enable_creator_publishing:  'Creators submitting content for review',
  enable_creator_onboarding:  'New creator applications (POST /api/creators/apply)',
  enable_admin_moderation:    'Admin write actions (approve, reject, suspend, etc.)',
  enable_launch_tuning_banner:'Maintenance/tuning banner visible to all users',
  enable_email_notifications: 'Outbound emails via Resend (transactional + marketing)',
};

// Safe defaults — all ON except the tuning banner
const DEFAULTS: Record<FlagKey, boolean> = {
  enable_live_rooms:          true,
  enable_gold_purchases:      true,
  enable_gold_gifts:          true,
  enable_vault_purchases:     true,
  enable_creator_uploads:     true,
  enable_creator_publishing:  true,
  enable_creator_onboarding:  true,
  enable_admin_moderation:    true,
  enable_launch_tuning_banner: false,
  enable_email_notifications: true,
};

interface CacheEntry { value: boolean; expiresAt: number }
const _cache = new Map<FlagKey, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds

// ENV override format:  FF_ENABLE_LIVE_ROOMS=false   (lowercase false/0 → off)
function envOverride(key: FlagKey): boolean | null {
  const envKey = 'FF_' + key.toUpperCase();
  const val = process.env[envKey];
  if (val === undefined) return null;
  return !['false', '0', 'off', 'no'].includes(val.toLowerCase());
}

export async function getFlag(key: FlagKey): Promise<boolean> {
  // Env vars are hard overrides — no caching needed, they won't change at runtime
  const override = envOverride(key);
  if (override !== null) return override;

  const now = Date.now();
  const cached = _cache.get(key);
  if (cached && now < cached.expiresAt) return cached.value;

  try {
    const row = await queryOne<{ enabled: boolean }>(
      'SELECT enabled FROM feature_flags WHERE key = $1',
      [key]
    );
    const value = row?.enabled ?? DEFAULTS[key];
    _cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
    return value;
  } catch {
    // DB not ready yet (cold start) — fall back to default
    return DEFAULTS[key];
  }
}

export async function getAllFlags(): Promise<Record<FlagKey, boolean>> {
  const result: Partial<Record<FlagKey, boolean>> = {};
  await Promise.all(
    ALL_FLAGS.map(async (k) => {
      result[k] = await getFlag(k);
    })
  );
  return result as Record<FlagKey, boolean>;
}

export async function setFlag(key: FlagKey, enabled: boolean): Promise<void> {
  await execute(
    `INSERT INTO feature_flags (key, enabled, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET enabled = $2, updated_at = NOW()`,
    [key, enabled]
  );
  // Bust cache immediately
  _cache.delete(key);
}

export async function seedDefaultFlags(): Promise<void> {
  await Promise.all(
    ALL_FLAGS.map((k) =>
      execute(
        `INSERT INTO feature_flags (key, enabled, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO NOTHING`,
        [k, DEFAULTS[k]]
      )
    )
  );
}
