/**
 * Stress / reliability tests — Archangels Club backend.
 *
 * ALL tests use mocked DB and Stripe. No real data is created.
 * No production systems are touched. Safe for local and CI.
 *
 * Environment: NODE_ENV is never set to 'production' by vitest.config,
 * so the JWT_SECRET startup guard in auth.ts does not fire.
 * The hardcoded fallback secret is used intentionally in tests.
 *
 * Stripe secret: vitest.config injects STRIPE_SECRET_KEY=sk_test_fake_for_unit_tests.
 * No live Stripe key is used.
 *
 * To run (from the directory that has package.json + vitest.config):
 *   cd /Users/kevinhewitt/archangels-club-git/server
 *   npx vitest run src/tests/stress.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createStressTestApp } from './stressTestApp.js';

// ── Stripe mock fns — hoisted so vi.mock factory AND beforeEach can reference them ──

const mockStripe = vi.hoisted(() => ({
  sessionCreate:          vi.fn().mockResolvedValue({ id: 'cs_stress_mock_session', url: 'https://checkout.stripe.com/pay/cs_stress_mock' }),
  sessionRetrieve:        vi.fn(),
  webhooksConstructEvent: vi.fn(),
  balanceRetrieve:        vi.fn().mockResolvedValue({}),
  accountsCreate:         vi.fn().mockResolvedValue({ id: 'acct_stress_mock' }),
  accountsRetrieve:       vi.fn().mockResolvedValue({ details_submitted: true }),
  accountsLoginLink:      vi.fn().mockResolvedValue({ url: 'https://dashboard.stripe.com/mock' }),
  accountLinksCreate:     vi.fn().mockResolvedValue({ url: 'https://connect.stripe.com/onboard/mock' }),
}));

// ── Mocks (hoisted — must be before any route imports) ───────────────────────

vi.mock('../db/schema.js', () => ({
  query:           vi.fn(),
  queryOne:        vi.fn(),
  execute:         vi.fn(),
  withTransaction: vi.fn(),
  pool:            { query: vi.fn() },
  runMigrations:   vi.fn(),
}));

vi.mock('../services/triggers.js', () => ({
  triggerCreatorFirstPost:     vi.fn().mockResolvedValue(undefined),
  triggerCreatorFirstSale:     vi.fn().mockResolvedValue(undefined),
  triggerPurchaseConfirmation: vi.fn().mockResolvedValue(undefined),
  triggerAccountApproved:      vi.fn().mockResolvedValue(undefined),
}));

vi.mock('stripe', () => {
  class MockStripeError extends Error {
    type = 'StripeError'; code = 'test_error';
  }

  class MockStripe {
    checkout  = { sessions: { create: mockStripe.sessionCreate, retrieve: mockStripe.sessionRetrieve } };
    webhooks  = { constructEvent: mockStripe.webhooksConstructEvent };
    balance   = { retrieve: mockStripe.balanceRetrieve };
    accounts  = {
      create:          mockStripe.accountsCreate,
      retrieve:        mockStripe.accountsRetrieve,
      createLoginLink: mockStripe.accountsLoginLink,
    };
    accountLinks = { create: mockStripe.accountLinksCreate };
    static errors = { StripeError: MockStripeError };
  }

  return { default: MockStripe };
});

vi.mock('../services/email.js', () => ({
  sendSetPasswordEmail:        vi.fn().mockResolvedValue(undefined),
  sendUserWelcome:             vi.fn().mockResolvedValue(undefined),
  sendUserRejected:            vi.fn().mockResolvedValue(undefined),
  sendUserMoreInfoRequested:   vi.fn().mockResolvedValue(undefined),
  sendCreatorWelcome:          vi.fn().mockResolvedValue(undefined),
  sendCreatorRejected:         vi.fn().mockResolvedValue(undefined),
  sendContentApproved:         vi.fn().mockResolvedValue(undefined),
  sendContentRejected:         vi.fn().mockResolvedValue(undefined),
  sendContentChangesRequested: vi.fn().mockResolvedValue(undefined),
  upsertContact:               vi.fn().mockResolvedValue(undefined),
}));

// ── Typed mock references ─────────────────────────────────────────────────────

import { query, queryOne, execute, withTransaction } from '../db/schema.js';
import {
  triggerPurchaseConfirmation,
  triggerCreatorFirstPost,
  triggerCreatorFirstSale,
} from '../services/triggers.js';

const mockQuery    = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);
const mockExecute  = vi.mocked(execute);
const mockWithTxn  = vi.mocked(withTransaction);

const mockTriggerPurchase  = vi.mocked(triggerPurchaseConfirmation);
const mockTriggerFirstPost = vi.mocked(triggerCreatorFirstPost);
const mockTriggerFirstSale = vi.mocked(triggerCreatorFirstSale);

// ── App and auth helpers ──────────────────────────────────────────────────────

const app = createStressTestApp();

// Matches the fallback secret in auth.ts — intentional for test-only use.
const JWT_SECRET = 'archangels_dev_secret_change_in_production';

function makeToken(role = 'fan', userId = 'stress-test-user-id'): string {
  return jwt.sign({ userId, role }, JWT_SECRET);
}

beforeEach(() => {
  // resetAllMocks clears call counts, return values, AND the mockResolvedValueOnce queue.
  // clearAllMocks does NOT clear the Once queue and causes cross-test contamination.
  vi.resetAllMocks();

  // Re-apply implementations cleared by resetAllMocks.
  mockWithTxn.mockImplementation(async (fn: any) => {
    const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) } as any;
    await fn(mockClient);
  });

  // Stripe defaults — these vi.fn() instances are shared via vi.hoisted() so we can re-apply here.
  mockStripe.sessionCreate.mockResolvedValue({ id: 'cs_stress_mock_session', url: 'https://checkout.stripe.com/pay/cs_stress_mock' });
  mockStripe.balanceRetrieve.mockResolvedValue({});
  mockStripe.accountsCreate.mockResolvedValue({ id: 'acct_stress_mock' });
  mockStripe.accountsRetrieve.mockResolvedValue({ details_submitted: true });
  mockStripe.accountsLoginLink.mockResolvedValue({ url: 'https://dashboard.stripe.com/mock' });
  mockStripe.accountLinksCreate.mockResolvedValue({ url: 'https://connect.stripe.com/onboard/mock' });

  // Trigger defaults — must return Promises or .catch() in production code will throw.
  mockTriggerPurchase.mockResolvedValue(undefined);
  mockTriggerFirstPost.mockResolvedValue(undefined);
  mockTriggerFirstSale.mockResolvedValue(undefined);
});

// ── Shared fixtures ───────────────────────────────────────────────────────────

const LOCKED_CONTENT = {
  id: 'stress-content-id', title: 'Stress Test Drop', status: 'approved',
  access_type: 'locked', price: '9.99',
  creator_id: 'stress-creator-profile-id',
  creator_user_id: 'stress-creator-user-id',
  subscriber_discount_pct: 0,
  media_url: 'https://cdn.example.com/stress-media.mp4',
  stripe_account_id: null, stripe_onboarding_complete: 0,
  is_approved: 1, application_status: 'approved',
};

const SUBSCRIBERS_CONTENT = {
  ...LOCKED_CONTENT,
  id: 'stress-sub-content-id',
  access_type: 'subscribers',
  price: '0',
};

const CREATOR_PROFILE = {
  id: 'stress-creator-profile-id', user_id: 'stress-creator-user-id',
  display_name: 'Stress Creator', subscription_price: '9.99',
  stripe_account_id: null, stripe_onboarding_complete: 0,
  is_approved: 1, application_status: 'approved',
};

function makeStressWebhookBody({
  eventId   = 'evt_stress_001',
  sessionId = 'cs_stress_session_001',
  type      = 'unlock',
}: { eventId?: string; sessionId?: string; type?: string } = {}) {
  return {
    id:   eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id:             sessionId,
        payment_intent: 'pi_stress_001',
        subscription:   type === 'subscription' ? 'sub_stress_001' : null,
        amount_total:   999,
        payment_status: 'paid',
        status:         'complete',
        metadata: {
          type,
          user_id:         'stress-test-user-id',
          creator_id:      'stress-creator-profile-id',
          creator_user_id: 'stress-creator-user-id',
          ...(type === 'unlock' ? { content_id: 'stress-content-id' } : {}),
          amount:          '9.99',
        },
      },
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 1: Duplicate checkout attempt (pre-flight already_unlocked guard)
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario 1 — duplicate checkout: pre-flight already_unlocked guard', () => {
  it('returns { already_unlocked: true } and does not return a Stripe URL', async () => {
    const token = makeToken('fan', 'stress-test-user-id');
    mockQueryOne
      .mockResolvedValueOnce({ status: 'approved' })         // requireApproved
      .mockResolvedValueOnce(LOCKED_CONTENT)                  // content lookup
      .mockResolvedValueOnce({ id: 'existing-unlock-row' });  // already unlocked

    const res = await request(app)
      .post('/api/checkout/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'unlock', content_id: 'stress-content-id' });

    expect(res.status).toBe(200);
    expect(res.body.already_unlocked).toBe(true);
    expect(res.body.url).toBeUndefined();
  });

  it('first attempt (not yet unlocked) returns a Stripe session URL', async () => {
    const token = makeToken('fan', 'stress-test-user-id');
    mockQueryOne
      .mockResolvedValueOnce({ status: 'approved' })  // requireApproved
      .mockResolvedValueOnce(LOCKED_CONTENT)           // content lookup
      .mockResolvedValueOnce(null)                     // not yet unlocked
      .mockResolvedValueOnce(null);                    // no active subscription

    const res = await request(app)
      .post('/api/checkout/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'unlock', content_id: 'stress-content-id' });

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/checkout\.stripe\.com/);
    expect(res.body.already_unlocked).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 2: Duplicate Stripe webhook delivery (event-level idempotency)
//
// Server architecture: INSERT INTO payment_events ON CONFLICT (stripe_event_id)
//   DO UPDATE SET processing_status = 'skipped_duplicate' RETURNING id, processing_status
// recordEvent() returns { id, isDuplicate: processing_status === 'skipped_duplicate' }
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario 2 — duplicate Stripe webhook delivery (event-level idempotency via payment_events)', () => {
  it('first delivery: processes event, calls withTransaction exactly once', async () => {
    // queryOne call order for a new unlock event (server architecture):
    //   1. recordEvent → INSERT INTO payment_events RETURNING → new event row
    //   2. initFulfillmentRecord → INSERT INTO fulfillment_records RETURNING → new session row
    //   3. existingBySession → SELECT FROM transactions WHERE stripe_session_id → null (new)
    //   4. existingUnlock → SELECT FROM content_unlocks → null (new)
    //   5. content title → SELECT FROM content → for triggerPurchaseConfirmation
    // creator_user_id is in metadata so no extra queryOne for creator_profiles lookup
    mockQueryOne
      .mockResolvedValueOnce({ id: 'evt-row-1', processing_status: 'received' })
      .mockResolvedValueOnce({ id: 'fulfill-row-1', status: 'pending', attempts: 0 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ title: 'Stress Drop' });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(makeStressWebhookBody({ eventId: 'evt_stress_dup_001' })));

    expect(res.status).toBe(200);
    expect(mockWithTxn).toHaveBeenCalledOnce();
  });

  it('second delivery with same event_id: event-level guard fires, withTransaction not called', async () => {
    // INSERT ON CONFLICT sets processing_status = 'skipped_duplicate' → isDuplicate = true → early return
    mockQueryOne
      .mockResolvedValueOnce({ id: 'evt-row-1', processing_status: 'skipped_duplicate' });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(makeStressWebhookBody({ eventId: 'evt_stress_dup_001' })));

    expect(res.status).toBe(200);
    expect(mockWithTxn).not.toHaveBeenCalled();
    // No markEventProcessed or markEventFailed execute calls on a duplicate event
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 3: Simultaneous unlock fulfillment (session-level dedup in fulfillment)
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario 3 — simultaneous unlock fulfillment (session-level idempotency)', () => {
  it('new event_id but same stripe_session_id: session-level guard fires, withTransaction not called', async () => {
    // Stripe retries via the dashboard generate a new event_id but carry the same session.
    // Event-level passes (new event_id). fulfillment.ts checks existingBySession → already in transactions.
    //
    // queryOne order:
    //   1. recordEvent → new event row
    //   2. initFulfillmentRecord → same session (attempts incremented), status still 'pending'
    //   3. existingBySession → already in transactions → early return (execute to mark fulfilled)
    mockQueryOne
      .mockResolvedValueOnce({ id: 'evt-row-2', processing_status: 'received' })
      .mockResolvedValueOnce({ id: 'fulfill-row-2', status: 'pending', attempts: 1 })
      .mockResolvedValueOnce({ id: 'existing-txn' });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(makeStressWebhookBody({
        eventId:   'evt_stress_retry_002',
        sessionId: 'cs_stress_session_001',
      })));

    expect(res.status).toBe(200);
    expect(mockWithTxn).not.toHaveBeenCalled();
  });

  it('new event_id, new session_id, but content_unlock row already present: secondary guard fires', async () => {
    // Edge case: event-level passes, session-level passes, but content_unlock already exists
    // (e.g. a race between two simultaneous webhook deliveries that both passed session-level).
    // The existingUnlock check in fulfillment.ts blocks withTransaction.
    //
    // queryOne order:
    //   1. recordEvent → new event row
    //   2. initFulfillmentRecord → new session row
    //   3. existingBySession → null (new session)
    //   4. existingUnlock → already present → early return (execute to mark fulfilled)
    mockQueryOne
      .mockResolvedValueOnce({ id: 'evt-row-3', processing_status: 'received' })
      .mockResolvedValueOnce({ id: 'fulfill-row-3', status: 'pending', attempts: 0 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-unlock' });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(makeStressWebhookBody({ eventId: 'evt_stress_retry_003' })));

    expect(res.status).toBe(200);
    expect(mockWithTxn).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 4: Duplicate subscription session creation
// KNOWN GAP — documents current behavior before Phase 2 fix
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario 4 — duplicate subscription session creation [KNOWN GAP — Phase 2 fix pending]', () => {
  it('KNOWN GAP: two subscription requests return Stripe URLs even when already subscribed', async () => {
    const token = makeToken('fan', 'stress-test-user-id');

    // Request 1: requireApproved passes, creator found — no pre-flight active-subscription check
    mockQueryOne
      .mockResolvedValueOnce({ status: 'approved' })
      .mockResolvedValueOnce(CREATOR_PROFILE);

    const res1 = await request(app)
      .post('/api/checkout/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'subscription', creator_id: 'stress-creator-profile-id' });

    expect(res1.status).toBe(200);
    expect(res1.body.url).toBeDefined();

    // Request 2: same user, same creator — gap: no check for existing active subscription
    mockQueryOne
      .mockResolvedValueOnce({ status: 'approved' })
      .mockResolvedValueOnce(CREATOR_PROFILE);

    const res2 = await request(app)
      .post('/api/checkout/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'subscription', creator_id: 'stress-creator-profile-id' });

    // This assertion documents current broken behavior.
    // After Phase 2 fix, update to: expect(res2.body.already_subscribed).toBe(true)
    expect(res2.status).toBe(200);
    expect(res2.body.url).toBeDefined(); // BUG: should not return a second Stripe URL
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 5: Protected media access — unauthenticated and unpermissioned callers
//
// Server architecture: my-access NEVER returns media_url.
// Clients obtain media access via a separate GET /:id/stream-url JWT endpoint.
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario 5 — protected media access via my-access endpoint', () => {
  it('5a: no Authorization header → 401', async () => {
    const res = await request(app).get('/api/content/stress-content-id/my-access');
    expect(res.status).toBe(401);
  });

  it('5b: valid JWT, locked content, no unlock, no subscription → unlocked=false, media_url=null', async () => {
    const token = makeToken('fan', 'stress-test-user-id');
    // my-access query order for locked content, non-admin, non-creator fan:
    //   1. content lookup (JOIN creator_profiles for creator_user_id)
    //   2. active subscription → null
    //   3. content_unlock → null
    mockQueryOne
      .mockResolvedValueOnce(LOCKED_CONTENT)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/content/stress-content-id/my-access')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.unlocked).toBe(false);
    expect(res.body.media_url).toBeNull();
  });

  it('5c: valid JWT, locked content, has paid unlock → unlocked=true, media_url=null (use stream-url)', async () => {
    const token = makeToken('fan', 'stress-test-user-id');
    mockQueryOne
      .mockResolvedValueOnce(LOCKED_CONTENT)
      .mockResolvedValueOnce(null)                     // no active subscription
      .mockResolvedValueOnce({ id: 'unlock-row-id' }); // content_unlock present

    const res = await request(app)
      .get('/api/content/stress-content-id/my-access')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.unlocked).toBe(true);
    // Server omits media_url from my-access; clients fetch actual URL via /stream-url JWT endpoint
    expect(res.body.media_url).toBeNull();
  });

  it('5d: valid JWT, subscriber-only content, active subscription → unlocked=true, media_url=null (use stream-url)', async () => {
    const token = makeToken('fan', 'stress-test-user-id');
    // For subscribers content: content lookup, then subscription check (no unlock check needed)
    mockQueryOne
      .mockResolvedValueOnce(SUBSCRIBERS_CONTENT)
      .mockResolvedValueOnce({ id: 'active-sub-id' }); // active subscription present

    const res = await request(app)
      .get('/api/content/stress-sub-content-id/my-access')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.unlocked).toBe(true);
    expect(res.body.is_subscribed).toBe(true);
    // Server omits media_url from my-access; clients fetch actual URL via /stream-url JWT endpoint
    expect(res.body.media_url).toBeNull();
  });

  it('5e: admin role → unrestricted access, is_admin_preview=true, media_url=null (use stream-url)', async () => {
    const token = makeToken('admin', 'stress-admin-id');
    // Admin path returns immediately after content lookup — no subscription/unlock queries
    mockQueryOne.mockResolvedValueOnce(LOCKED_CONTENT);

    const res = await request(app)
      .get('/api/content/stress-content-id/my-access')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.unlocked).toBe(true);
    expect(res.body.is_admin_preview).toBe(true);
    // Server omits media_url from my-access; clients fetch actual URL via /stream-url JWT endpoint
    expect(res.body.media_url).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 6: Expired or cancelled subscription — no media access granted
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario 6 — expired/cancelled subscription grants no media access', () => {
  it('locked content, subscription expired (SQL filters it): unlocked=false, media_url=null', async () => {
    const token = makeToken('fan', 'stress-test-user-id');
    // The subscriptions query includes `status IN ('active','cancelled') AND expires_at > NOW()`.
    // An expired row is excluded by the database — mock returns null.
    mockQueryOne
      .mockResolvedValueOnce(LOCKED_CONTENT)
      .mockResolvedValueOnce(null)  // subscription query → expired row not returned
      .mockResolvedValueOnce(null); // content_unlock → not present

    const res = await request(app)
      .get('/api/content/stress-content-id/my-access')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.unlocked).toBe(false);
    expect(res.body.media_url).toBeNull();
  });

  it('subscribers-only content, subscription expired: unlocked=false, media_url=null', async () => {
    const token = makeToken('fan', 'stress-test-user-id');
    mockQueryOne
      .mockResolvedValueOnce(SUBSCRIBERS_CONTENT)
      .mockResolvedValueOnce(null); // subscription → expired, filtered out by SQL

    const res = await request(app)
      .get('/api/content/stress-sub-content-id/my-access')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.unlocked).toBe(false);
    expect(res.body.media_url).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 7: Missing / invalid JWT on all protected routes
// ═════════════════════════════════════════════════════════════════════════════

const PROTECTED_ROUTES = [
  { method: 'get',  path: '/api/members/my/stats' },
  { method: 'get',  path: '/api/members/my/unlocked' },
  { method: 'get',  path: '/api/members/my/subscriptions' },
  { method: 'get',  path: '/api/stripe/connect/status' },
  { method: 'get',  path: '/api/content/stress-content-id/my-access' },
  { method: 'post', path: '/api/checkout/create' },
  { method: 'post', path: '/api/payments/create-unlock-session' },
];

describe('Scenario 7 — missing/invalid JWT rejected on all protected routes', () => {
  it.each(PROTECTED_ROUTES)('$method $path → 401 with no token', async ({ method, path }) => {
    const res = await (request(app) as any)[method](path);
    expect(res.status).toBe(401);
  });

  it.each(PROTECTED_ROUTES)('$method $path → 401 with malformed token', async ({ method, path }) => {
    const res = await (request(app) as any)[method](path)
      .set('Authorization', 'Bearer this.is.not.a.valid.jwt');
    expect(res.status).toBe(401);
  });

  it.each(PROTECTED_ROUTES)('$method $path → 401 with expired token', async ({ method, path }) => {
    const expired = jwt.sign({ userId: 'u1', role: 'fan' }, JWT_SECRET, { expiresIn: -1 });
    const res = await (request(app) as any)[method](path)
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 8: Admin-only and creator-only routes accessed by wrong role
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario 8 — role enforcement on restricted routes', () => {
  it('fan cannot GET /api/admin/users → 403', async () => {
    const token = makeToken('fan');
    const res = await request(app).get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('creator cannot GET /api/admin/users → 403', async () => {
    const token = makeToken('creator');
    const res = await request(app).get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('fan cannot POST /api/admin/promote-to-admin → 403', async () => {
    const token = makeToken('fan');
    const res = await request(app)
      .post('/api/admin/promote-to-admin')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'attacker@example.com' });
    expect(res.status).toBe(403);
  });

  it('fan cannot GET /api/stripe/connect/status → 403 (creator-only)', async () => {
    const token = makeToken('fan');
    const res = await request(app)
      .get('/api/stripe/connect/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('fan cannot POST /api/stripe/connect/start → 403 (creator-only)', async () => {
    const token = makeToken('fan');
    const res = await request(app)
      .post('/api/stripe/connect/start')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('fan cannot POST /api/stripe/connect/verify → 403 (creator-only)', async () => {
    const token = makeToken('fan');
    const res = await request(app)
      .post('/api/stripe/connect/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('fan cannot POST /api/stripe/connect/dashboard-link → 403 (creator-only)', async () => {
    const token = makeToken('fan');
    const res = await request(app)
      .post('/api/stripe/connect/dashboard-link')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 9: Media URL exposure in /api/members/my/unlocked
// KNOWN ISSUE H3 — documents current behavior pending Phase 2 fix
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario 9 — media URL exposure in /api/members/my/unlocked [KNOWN ISSUE H3]', () => {
  it('KNOWN ISSUE H3: raw permanent media_url is returned directly in the unlocked list', async () => {
    const token = makeToken('fan', 'stress-test-user-id');
    // requireApproved consumes one queryOne call
    mockQueryOne.mockResolvedValueOnce({ status: 'approved' });
    // The main query uses query() (array return), not queryOne
    mockQuery.mockResolvedValueOnce([{
      id: 'stress-content-id', title: 'Stress Drop', access_type: 'locked',
      media_url: 'https://cdn.example.com/stress-media.mp4',
      preview_url: null, price: '9.99', status: 'approved', created_at: new Date().toISOString(),
      content_type: 'video',
      creator_id: 'stress-creator-profile-id',
      creator_name: 'Stress Creator', creator_username: 'stresscreator', creator_avatar: null,
      unlocked_at: new Date().toISOString(),
    }]);

    const res = await request(app)
      .get('/api/members/my/unlocked')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    // Documents current behavior: raw permanent URL is exposed to the client.
    // Phase 2 TODO: update this assertion to expect(res.body[0].media_url).toBeNull()
    // once URL signing or proxied access is implemented (audit finding H3).
    expect(res.body[0].media_url).toBe('https://cdn.example.com/stress-media.mp4');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 10: Webhook retry simulation — all three idempotency layers
//
// Server architecture layers:
//   Layer 1 (event): payment_events INSERT ON CONFLICT → skipped_duplicate
//   Layer 2 (session): fulfillment_records INSERT ON CONFLICT → alreadyFulfilled
//   Layer 3 (session): existingBySession → SELECT FROM transactions WHERE stripe_session_id
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario 10 — webhook retry simulation: three deliveries, all idempotency layers verified', () => {
  it('delivery 1 of 3 — new event, new session: processes normally, withTransaction called once', async () => {
    // queryOne order: recordEvent → initFulfillmentRecord → existingBySession → existingUnlock → content title
    mockQueryOne
      .mockResolvedValueOnce({ id: 'evt-row-r10-1', processing_status: 'received' })
      .mockResolvedValueOnce({ id: 'fulfill-row-r10-1', status: 'pending', attempts: 0 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ title: 'Stress Drop' });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(makeStressWebhookBody({ eventId: 'evt_stress_r10_001' })));

    expect(res.status).toBe(200);
    expect(mockWithTxn).toHaveBeenCalledOnce();
  });

  it('delivery 2 of 3 — same event_id (Stripe retry): stopped at event-level guard (payment_events)', async () => {
    // INSERT ON CONFLICT sets processing_status = 'skipped_duplicate' → isDuplicate = true → early return
    mockQueryOne
      .mockResolvedValueOnce({ id: 'evt-row-r10-1', processing_status: 'skipped_duplicate' });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(makeStressWebhookBody({ eventId: 'evt_stress_r10_001' })));

    expect(res.status).toBe(200);
    expect(mockWithTxn).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('delivery 3 of 3 — new event_id, same session_id (dashboard re-send): stopped at session-level guard', async () => {
    // New event_id passes event-level. fulfillment_records has same session (status pending, attempts++).
    // existingBySession finds existing transaction → early return without withTransaction.
    mockQueryOne
      .mockResolvedValueOnce({ id: 'evt-row-r10-2', processing_status: 'received' })
      .mockResolvedValueOnce({ id: 'fulfill-row-r10-2', status: 'pending', attempts: 1 })
      .mockResolvedValueOnce({ id: 'existing-txn' });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(makeStressWebhookBody({
        eventId:   'evt_stress_r10_002',
        sessionId: 'cs_stress_session_001',
      })));

    expect(res.status).toBe(200);
    expect(mockWithTxn).not.toHaveBeenCalled();
  });
});
