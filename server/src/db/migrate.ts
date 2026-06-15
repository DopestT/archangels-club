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

  ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
  ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

  ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
  ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';

  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

  CREATE TABLE IF NOT EXISTS stripe_processed_events (
    event_id TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ── Payment event ledger ─────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS payment_events (
    id TEXT PRIMARY KEY,
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    stripe_object_id TEXT,
    stripe_customer_id TEXT,
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    stripe_subscription_id TEXT,
    stripe_invoice_id TEXT,
    user_id TEXT,
    creator_id TEXT,
    amount_cents INTEGER,
    currency TEXT DEFAULT 'usd',
    raw_summary JSONB,
    processing_status TEXT NOT NULL DEFAULT 'received'
      CHECK(processing_status IN ('received','processed','failed','skipped_duplicate')),
    error_message TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
  );

  -- ── Fulfillment records ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS fulfillment_records (
    id TEXT PRIMARY KEY,
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_event_id TEXT,
    user_id TEXT NOT NULL,
    creator_id TEXT,
    purchase_type TEXT NOT NULL CHECK(purchase_type IN ('subscription','unlock','tip','custom_request')),
    ref_type TEXT,
    ref_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','fulfilled','failed','needs_review')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ── Missing columns on transactions ──────────────────────────────────────────
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd';
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

  -- ── Missing columns on subscriptions ─────────────────────────────────────────
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

  -- ── Indices ───────────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_payment_events_type_received ON payment_events(event_type, received_at DESC);
  CREATE INDEX IF NOT EXISTS idx_payment_events_session ON payment_events(stripe_session_id);
  CREATE INDEX IF NOT EXISTS idx_payment_events_sub ON payment_events(stripe_subscription_id);
  CREATE INDEX IF NOT EXISTS idx_payment_events_status ON payment_events(processing_status, received_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fulfillment_session ON fulfillment_records(stripe_session_id);
  CREATE INDEX IF NOT EXISTS idx_fulfillment_status ON fulfillment_records(status);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_stripe_invoice ON transactions(stripe_invoice_id);

  -- ── Creator onboarding tracking ───────────────────────────────────────────────
  ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS custom_requests_enabled SMALLINT NOT NULL DEFAULT 1;
  ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS onboarding_dismissed SMALLINT NOT NULL DEFAULT 0;
  ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS training_viewed SMALLINT NOT NULL DEFAULT 0;

  -- ── Content publishing workflow ───────────────────────────────────────────────
  -- publish_at: null = publish immediately on approval; future date = hold until then
  -- updated_at: tracks last creator edit or admin action for ordering / staleness
  -- rejection_reason: admin-provided feedback shown to creator on rejection
  ALTER TABLE content ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ;
  ALTER TABLE content ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE content ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

  -- Expand status constraint: add scheduled and failed_processing (idempotent)
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conname = 'content_status_check'
        AND pg_get_constraintdef(c.oid) LIKE '%failed_processing%'
    ) THEN
      ALTER TABLE content DROP CONSTRAINT IF EXISTS content_status_check;
      ALTER TABLE content ADD CONSTRAINT content_status_check
        CHECK(status IN ('draft','pending_review','approved','rejected','removed','changes_requested','scheduled','failed_processing'));
    END IF;
  END $$;

  -- New content defaults to draft so creators can save before submitting for review
  ALTER TABLE content ALTER COLUMN status SET DEFAULT 'draft';

  CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
  CREATE INDEX IF NOT EXISTS idx_content_publish_at ON content(publish_at) WHERE publish_at IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_content_updated_at ON content(updated_at DESC);

  -- ── Payment idempotency constraints ─────────────────────────────────────────
  -- Prevents double transaction insertion when webhook + session-verify fire concurrently.
  -- The partial index covers non-null session IDs only (tips, unlocks, subscriptions).
  -- Without this, two concurrent fulfillment calls both seeing dup=null would both
  -- INSERT and double-credit creator earnings for tips and subscriptions.
  CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_stripe_session
    ON transactions(stripe_session_id)
    WHERE stripe_session_id IS NOT NULL;

  -- Protect content_unlocks FK from cascade failures when content is removed.
  -- Restricts hard-deletion of content that has been purchased — correct behavior.
  -- (Creators can only soft-delete via status='removed'; this guards admin hard-delete.)
  -- No action needed on the constraint itself; NO ACTION is PostgreSQL's default.
  -- Adding the explicit index here so the FK lookup is fast at deletion check time.
  CREATE INDEX IF NOT EXISTS idx_content_unlocks_content ON content_unlocks(content_id);

  -- ── ABMIE-X: Platform Events (behavioral signal foundation) ─────────────────
  -- Lightweight append-only event log. Powers recommendations, creator health
  -- scoring, Pulse analytics, and future predictive intelligence layers.
  CREATE TABLE IF NOT EXISTS platform_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_platform_events_type ON platform_events(event_type, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_platform_events_user ON platform_events(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_platform_events_entity ON platform_events(entity_type, entity_id, created_at DESC);

  -- Idempotency key: client sends a UUID with each event; retries use the same key.
  -- Partial unique index (only when key is provided) prevents duplicate writes.
  ALTER TABLE platform_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_events_idempotency
    ON platform_events(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

  -- ── ABMIE-X: Engagement Signals (creator-user affinity) ─────────────────────
  -- Aggregated per (user, creator) pair. Updated on unlock/subscribe/view/message.
  -- Weight encodes signal strength; decays are applied at read time.
  CREATE TABLE IF NOT EXISTS engagement_signals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL CHECK(signal_type IN ('view','unlock','subscribe','message','tip','save','custom_request')),
    weight NUMERIC(6,3) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_signals_user_creator ON engagement_signals(user_id, creator_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_signals_creator ON engagement_signals(creator_id, signal_type, created_at DESC);

  -- ── ABMIE-X: Creator Health Scores ──────────────────────────────────────────
  -- Computed scores; recomputed nightly or on demand.
  -- Scores 0–100 where 100 = excellent health.
  CREATE TABLE IF NOT EXISTS creator_health_scores (
    creator_id TEXT PRIMARY KEY REFERENCES creator_profiles(id) ON DELETE CASCADE,
    posting_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    engagement_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    revenue_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    retention_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    last_post_at TIMESTAMPTZ,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ── ABMIE-X: Creator Daily Stats ─────────────────────────────────────────────
  -- One row per (creator, date). Upserted nightly and on fulfillment events.
  CREATE TABLE IF NOT EXISTS creator_daily_stats (
    creator_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    unlocks INTEGER NOT NULL DEFAULT 0,
    new_subscribers INTEGER NOT NULL DEFAULT 0,
    revenue_cents BIGINT NOT NULL DEFAULT 0,
    messages_received INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (creator_id, stat_date)
  );

  CREATE INDEX IF NOT EXISTS idx_creator_daily_stats_date ON creator_daily_stats(stat_date DESC);

  -- ── Infrastructure hardening ─────────────────────────────────────────────────
  -- fulfilled_at: exact timestamp when fulfillment completed (distinct from updated_at).
  ALTER TABLE fulfillment_records ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

  -- ── ABMIE-X: Platform Daily Stats ────────────────────────────────────────────
  -- Platform-wide aggregates for admin Pulse view. One row per date.
  CREATE TABLE IF NOT EXISTS platform_daily_stats (
    stat_date DATE PRIMARY KEY,
    new_users INTEGER NOT NULL DEFAULT 0,
    new_creators INTEGER NOT NULL DEFAULT 0,
    total_revenue_cents BIGINT NOT NULL DEFAULT 0,
    total_unlocks INTEGER NOT NULL DEFAULT 0,
    total_subscriptions INTEGER NOT NULL DEFAULT 0,
    active_users INTEGER NOT NULL DEFAULT 0,
    content_published INTEGER NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ── Demo/test content isolation ───────────────────────────────────────────────
  -- Marks seed and test content so it can be excluded from public listings.
  ALTER TABLE content ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

  -- Mark all existing demo seed content (fixed IDs start with 'demo-c-') and any
  -- content uploaded by demo accounts so they don't appear in the public explore feed.
  UPDATE content SET is_demo = true
  WHERE id LIKE 'demo-c-%'
     OR creator_id IN (
       SELECT id FROM creator_profiles
       WHERE user_id LIKE 'demo-user-%'
     );

  -- Backfill: auto-create approved creator_profiles for any approved creator/both
  -- users who don't have one yet. Idempotent — safe to run on every startup.
  INSERT INTO creator_profiles (id, user_id, bio, is_approved, application_status)
  SELECT gen_random_uuid()::text, u.id, '', 1, 'approved'
  FROM users u
  WHERE u.role IN ('creator', 'both')
    AND u.status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM creator_profiles cp WHERE cp.user_id = u.id
    );

  -- ── Content reviews ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS content_reviews (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK(rating BETWEEN 1 AND 5),
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(content_id, reviewer_id)
  );

  ALTER TABLE content ADD COLUMN IF NOT EXISTS content_body TEXT NOT NULL DEFAULT '';

  -- ── Legacy Works Publishing — Amazon KDP Automation ──────────────────────────

  CREATE TABLE IF NOT EXISTS lw_books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    series_name TEXT NOT NULL DEFAULT '',
    series_number INTEGER,
    genre TEXT NOT NULL,
    subgenre TEXT NOT NULL DEFAULT '',
    target_audience TEXT NOT NULL DEFAULT '',
    word_count_target INTEGER NOT NULL DEFAULT 25000,
    word_count_actual INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'idea'
      CHECK(status IN ('idea','blueprinting','generating','review','epub_ready','queued','published','cancelled')),
    pipeline_stage TEXT NOT NULL DEFAULT 'idle'
      CHECK(pipeline_stage IN ('idle','research','blueprint','generating_chapters','assembling','metadata','quality_check','complete','failed')),
    pipeline_progress INTEGER NOT NULL DEFAULT 0,
    pipeline_error TEXT,
    bisac_primary TEXT NOT NULL DEFAULT '',
    bisac_secondary TEXT NOT NULL DEFAULT '',
    keywords TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL DEFAULT '',
    author_name TEXT NOT NULL DEFAULT 'Legacy Works Publishing',
    price_usd NUMERIC(12,2) NOT NULL DEFAULT 4.99,
    kdp_asin TEXT,
    kdp_status TEXT,
    ai_disclosure BOOLEAN NOT NULL DEFAULT true,
    epub_base64 TEXT,
    cover_url TEXT,
    niche_score NUMERIC(5,2),
    niche_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS lw_chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES lw_books(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    outline TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    word_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','generating','complete','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(book_id, chapter_number)
  );

  CREATE TABLE IF NOT EXISTS lw_queue (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES lw_books(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3),
    status TEXT NOT NULL DEFAULT 'scheduled'
      CHECK(status IN ('scheduled','uploading','published','failed','cancelled')),
    kdp_upload_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(scheduled_date, slot)
  );

  CREATE TABLE IF NOT EXISTS lw_niche_research (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    genre TEXT NOT NULL,
    profitability_score NUMERIC(5,2),
    competition_score NUMERIC(5,2),
    demand_score NUMERIC(5,2),
    recommended_price NUMERIC(12,2),
    keyword_suggestions TEXT NOT NULL DEFAULT '[]',
    title_hooks TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_lw_books_status ON lw_books(status);
  CREATE INDEX IF NOT EXISTS idx_lw_chapters_book ON lw_chapters(book_id, chapter_number);
  CREATE INDEX IF NOT EXISTS idx_lw_queue_date ON lw_queue(scheduled_date, slot);

  -- ── LIVE ROOMS ───────────────────────────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS live_rooms (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
    creator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    access_type TEXT NOT NULL DEFAULT 'free'
      CHECK (access_type IN ('free', 'subscribers', 'paid')),
    price_cents INTEGER,
    status TEXT NOT NULL DEFAULT 'idle'
      CHECK (status IN ('idle', 'live', 'ended')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    peak_viewer_count INTEGER NOT NULL DEFAULT 0,
    replay_url TEXT,
    replay_available BOOLEAN NOT NULL DEFAULT false,
    replay_duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS live_access_purchases (
    id TEXT PRIMARY KEY,
    live_room_id TEXT NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_session_id TEXT,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'active', 'refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(live_room_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS live_chat_messages (
    id TEXT PRIMARY KEY,
    live_room_id TEXT NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    message TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    is_reported BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS live_tips (
    id TEXT PRIMARY KEY,
    live_room_id TEXT NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
    tipper_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
    transaction_id TEXT,
    amount_cents INTEGER NOT NULL,
    stripe_session_id TEXT,
    display_name TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'completed', 'refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS live_moderation_events (
    id TEXT PRIMARY KEY,
    live_room_id TEXT NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
    admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL
      CHECK (action IN ('end_stream', 'delete_message', 'warn_creator', 'ban_user')),
    target_id TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_live_rooms_status ON live_rooms(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_live_rooms_creator ON live_rooms(creator_id);
  CREATE INDEX IF NOT EXISTS idx_live_chat_room ON live_chat_messages(live_room_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_live_access_user ON live_access_purchases(user_id, live_room_id);
  CREATE INDEX IF NOT EXISTS idx_live_tips_room ON live_tips(live_room_id, created_at DESC);

  -- Gold economy / room goal fields
  ALTER TABLE live_rooms ADD COLUMN IF NOT EXISTS goal_amount_cents INTEGER;
  ALTER TABLE live_rooms ADD COLUMN IF NOT EXISTS goal_title TEXT;

  -- AI moderation log
  CREATE TABLE IF NOT EXISTS live_ai_moderation_log (
    id TEXT PRIMARY KEY,
    live_room_id TEXT NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
    safe BOOLEAN NOT NULL DEFAULT true,
    reason TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_live_ai_mod_room ON live_ai_moderation_log(live_room_id, checked_at DESC);

  -- Gold gift privacy (public / private / ghost) stored at fulfillment time
  ALTER TABLE live_tips ADD COLUMN IF NOT EXISTS privacy TEXT NOT NULL DEFAULT 'public';

  -- Gift type identifier for patron ladder tracking and room feed display
  ALTER TABLE live_tips ADD COLUMN IF NOT EXISTS gift_type TEXT;

  -- Patron status index: cumulative Gold by tipper per creator
  CREATE INDEX IF NOT EXISTS idx_live_tips_patron
    ON live_tips(tipper_id, creator_id) WHERE status = 'completed';

  -- Contractor payout requests (for creators who cannot use Stripe Connect)
  CREATE TABLE IF NOT EXISTS payout_requests (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_dollars NUMERIC(12,2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'paid', 'rejected')),
    admin_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_payout_requests_creator ON payout_requests(creator_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_payout_requests_status  ON payout_requests(status, created_at DESC);
`;

export async function runMigrations(): Promise<void> {
  await pool.query(DDL);
  console.log('  ✦ Database migrations complete');
}
