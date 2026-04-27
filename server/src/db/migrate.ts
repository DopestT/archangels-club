import { pool } from './client.js';

const DDL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'fan' CHECK(role IN ('fan','creator','both','admin')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended','banned')),
    is_verified_creator SMALLINT NOT NULL DEFAULT 0,
    date_of_birth TEXT,
    reason_for_joining TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS creator_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    content_categories TEXT NOT NULL DEFAULT '[]',
    subscription_price NUMERIC(12,2) NOT NULL DEFAULT 9.99,
    starting_price NUMERIC(12,2) NOT NULL DEFAULT 4.99,
    is_approved SMALLINT NOT NULL DEFAULT 0,
    application_status TEXT NOT NULL DEFAULT 'pending' CHECK(application_status IN ('pending','approved','rejected','suspended')),
    pitch TEXT NOT NULL DEFAULT '',
    total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('draft','pending_review','approved','rejected','removed')),
    max_unlocks INTEGER,
    current_unlocks INTEGER NOT NULL DEFAULT 0,
    available_until TIMESTAMPTZ,
    subscriber_discount_pct INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS bundles (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    bundle_price NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    amount NUMERIC(12,2) NOT NULL,
    platform_fee NUMERIC(12,2) NOT NULL,
    net_amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed','refunded','disputed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    subscriber_id TEXT NOT NULL REFERENCES users(id),
    creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','expired')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE(subscriber_id, creator_id)
  );

  CREATE TABLE IF NOT EXISTS custom_requests (
    id TEXT PRIMARY KEY,
    fan_id TEXT NOT NULL REFERENCES users(id),
    creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
    description TEXT NOT NULL,
    offered_price NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','completed','cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id),
    receiver_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    custom_request_id TEXT REFERENCES custom_requests(id),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS content_unlocks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    content_id TEXT NOT NULL REFERENCES content(id),
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, content_id)
  );

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_enabled SMALLINT NOT NULL DEFAULT 1,
    sms_enabled SMALLINT NOT NULL DEFAULT 0,
    in_app_enabled SMALLINT NOT NULL DEFAULT 1,
    email_new_content SMALLINT NOT NULL DEFAULT 1,
    email_drops SMALLINT NOT NULL DEFAULT 1,
    email_purchases SMALLINT NOT NULL DEFAULT 1,
    email_weekly_summary SMALLINT NOT NULL DEFAULT 1,
    sms_drops SMALLINT NOT NULL DEFAULT 1,
    sms_major_events SMALLINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL REFERENCES users(id),
    subject_type TEXT NOT NULL CHECK(subject_type IN ('content','user','creator')),
    subject_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed','dismissed','actioned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS admin_actions (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES users(id),
    action_type TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS access_requests (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
  ALTER TABLE access_requests ALTER COLUMN username DROP NOT NULL;

  ALTER TABLE content DROP CONSTRAINT IF EXISTS content_status_check;
  ALTER TABLE content ADD CONSTRAINT content_status_check
    CHECK(status IN ('draft','pending_review','approved','rejected','removed','changes_requested'));

  CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
  CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_content_creator ON content(creator_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_payer ON transactions(payer_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_payee ON transactions(payee_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_creator ON subscriptions(creator_id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, status, created_at);
  CREATE INDEX IF NOT EXISTS idx_bundles_creator ON bundles(creator_id);

  ALTER TABLE content_unlocks ADD COLUMN IF NOT EXISTS transaction_id TEXT REFERENCES transactions(id);

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

  ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

  ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
  ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_complete SMALLINT NOT NULL DEFAULT 0;

  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

  CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session ON transactions(stripe_session_id);

  ALTER TABLE content_unlocks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  UPDATE content_unlocks SET created_at = unlocked_at WHERE created_at IS NULL;

  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_creator_profiles_user_id') THEN
      ALTER TABLE creator_profiles ADD CONSTRAINT uq_creator_profiles_user_id UNIQUE (user_id);
    END IF;
  END $$;

  CREATE TABLE IF NOT EXISTS saved_content (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, content_id)
  );

  CREATE INDEX IF NOT EXISTS idx_saved_content_user ON saved_content(user_id, saved_at DESC);

  ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS requested_role TEXT NOT NULL DEFAULT 'fan';

  -- Age verification on users
  ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verification_status TEXT NOT NULL DEFAULT 'not_started';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_provider TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_session_id TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'users_age_verification_status_check'
    ) THEN
      ALTER TABLE users ADD CONSTRAINT users_age_verification_status_check
        CHECK(age_verification_status IN ('not_started','pending','verified','failed','expired'));
    END IF;
  END $$;

  -- Creator KYC
  ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS creator_kyc_status TEXT NOT NULL DEFAULT 'not_started';
  ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS creator_kyc_session_id TEXT;
  ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS creator_kyc_verified_at TIMESTAMPTZ;

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'creator_profiles_creator_kyc_status_check'
    ) THEN
      ALTER TABLE creator_profiles ADD CONSTRAINT creator_profiles_creator_kyc_status_check
        CHECK(creator_kyc_status IN ('not_started','pending','approved','rejected'));
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_users_age_verification ON users(age_verification_status);
  CREATE INDEX IF NOT EXISTS idx_creator_kyc ON creator_profiles(creator_kyc_status);

  CREATE TABLE IF NOT EXISTS creator_page_views (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
    source TEXT NOT NULL DEFAULT 'direct',
    ref_code TEXT,
    viewer_id TEXT REFERENCES users(id),
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS creator_invite_links (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
    invite_code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL DEFAULT 'Invite Link',
    click_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_page_views_creator ON creator_page_views(creator_id, viewed_at);
  CREATE INDEX IF NOT EXISTS idx_invite_links_creator ON creator_invite_links(creator_id);
  CREATE INDEX IF NOT EXISTS idx_invite_links_code ON creator_invite_links(invite_code);
`;

export async function runMigrations(): Promise<void> {
  await pool.query(DDL);
  console.log('  ✦ Database migrations complete');
}
