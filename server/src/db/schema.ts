import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../archangels.db');

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'fan' CHECK(role IN ('fan','creator','both','admin')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended','banned')),
      is_verified_creator INTEGER NOT NULL DEFAULT 0,
      date_of_birth TEXT,
      reason_for_joining TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS creator_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bio TEXT NOT NULL DEFAULT '',
      cover_image_url TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      content_categories TEXT NOT NULL DEFAULT '[]',
      subscription_price REAL NOT NULL DEFAULT 9.99,
      starting_price REAL NOT NULL DEFAULT 4.99,
      is_approved INTEGER NOT NULL DEFAULT 0,
      application_status TEXT NOT NULL DEFAULT 'pending' CHECK(application_status IN ('pending','approved','rejected','suspended')),
      pitch TEXT NOT NULL DEFAULT '',
      total_earnings REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS content (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content_type TEXT NOT NULL CHECK(content_type IN ('image','video','audio','text')),
      access_type TEXT NOT NULL CHECK(access_type IN ('free','locked','subscribers')),
      preview_url TEXT,
      media_url TEXT,
      price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('draft','pending_review','approved','rejected','removed')),
      max_unlocks INTEGER,
      current_unlocks INTEGER NOT NULL DEFAULT 0,
      available_until TEXT,
      subscriber_discount_pct INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bundles (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      bundle_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bundle_contents (
      bundle_id TEXT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
      content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
      PRIMARY KEY (bundle_id, content_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      payer_id TEXT NOT NULL REFERENCES users(id),
      payee_id TEXT NOT NULL REFERENCES users(id),
      ref_type TEXT NOT NULL CHECK(ref_type IN ('content','tip','subscription','custom_request')),
      ref_id TEXT NOT NULL,
      amount REAL NOT NULL,
      platform_fee REAL NOT NULL,
      net_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed','refunded','disputed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      subscriber_id TEXT NOT NULL REFERENCES users(id),
      creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','expired')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      UNIQUE(subscriber_id, creator_id)
    );

    CREATE TABLE IF NOT EXISTS custom_requests (
      id TEXT PRIMARY KEY,
      fan_id TEXT NOT NULL REFERENCES users(id),
      creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
      description TEXT NOT NULL,
      offered_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','completed','cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id),
      receiver_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      custom_request_id TEXT REFERENCES custom_requests(id),
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS content_unlocks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      content_id TEXT NOT NULL REFERENCES content(id),
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, content_id)
    );

    CREATE TABLE IF NOT EXISTS access_keys (
      id TEXT PRIMARY KEY,
      key_type TEXT NOT NULL CHECK(key_type IN ('standard','gold','black')),
      status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','used','expired','transferred')),
      inviter_id TEXT NOT NULL REFERENCES users(id),
      assigned_to_user_id TEXT REFERENCES users(id),
      invite_code TEXT UNIQUE NOT NULL,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS key_drops (
      id TEXT PRIMARY KEY,
      drop_name TEXT NOT NULL,
      drop_description TEXT NOT NULL DEFAULT '',
      key_type TEXT NOT NULL CHECK(key_type IN ('standard','gold','black')),
      quantity INTEGER NOT NULL,
      claimed INTEGER NOT NULL DEFAULT 0,
      eligible_tiers TEXT NOT NULL DEFAULT '["connector","inner_circle","gatekeeper"]',
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS key_drop_claims (
      id TEXT PRIMARY KEY,
      drop_id TEXT NOT NULL REFERENCES key_drops(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      key_id TEXT NOT NULL REFERENCES access_keys(id),
      claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(drop_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      key_id TEXT NOT NULL REFERENCES access_keys(id),
      inviter_id TEXT NOT NULL REFERENCES users(id),
      invitee_id TEXT REFERENCES users(id),
      invite_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      earnings REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS key_listings (
      id TEXT PRIMARY KEY,
      key_id TEXT NOT NULL REFERENCES access_keys(id),
      lister_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','claimed','cancelled')),
      listed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_content_creator ON content(creator_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_payer ON transactions(payer_id);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
    CREATE INDEX IF NOT EXISTS idx_access_keys_inviter ON access_keys(inviter_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_id);
    CREATE INDEX IF NOT EXISTS idx_bundles_creator ON bundles(creator_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'in_app' CHECK(channel IN ('email','sms','in_app')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      action_label TEXT,
      action_url TEXT,
      status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','read','sent','failed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      sms_enabled INTEGER NOT NULL DEFAULT 0,
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      email_new_content INTEGER NOT NULL DEFAULT 1,
      email_drops INTEGER NOT NULL DEFAULT 1,
      email_purchases INTEGER NOT NULL DEFAULT 1,
      email_weekly_summary INTEGER NOT NULL DEFAULT 1,
      sms_drops INTEGER NOT NULL DEFAULT 1,
      sms_major_events INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, status, created_at);
  `);

  // Migrate users table
  const existingUserCols = new Set(
    (db.pragma('table_info(users)') as { name: string }[]).map((r) => r.name)
  );
  if (!existingUserCols.has('phone')) {
    db.exec(`ALTER TABLE users ADD COLUMN phone TEXT;`);
  }

  // Migrate existing content table — safe to run repeatedly (no-op if column exists)
  const scarcityCols: [string, string][] = [
    ['max_unlocks',           'INTEGER'],
    ['current_unlocks',       'INTEGER NOT NULL DEFAULT 0'],
    ['available_until',       'TEXT'],
    ['subscriber_discount_pct','INTEGER NOT NULL DEFAULT 0'],
  ];
  const existingCols = new Set(
    (db.pragma('table_info(content)') as { name: string }[]).map((r) => r.name)
  );
  for (const [col, def] of scarcityCols) {
    if (!existingCols.has(col)) {
      db.exec(`ALTER TABLE content ADD COLUMN ${col} ${def};`);
    }
  }
}

initSchema();
