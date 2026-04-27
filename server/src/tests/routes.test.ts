import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp } from './testApp.js';

// ── Mocks (hoisted before any imports) ───────────────────────────────────────

vi.mock('../db/schema.js', () => ({
  query:           vi.fn(),
  queryOne:        vi.fn(),
  execute:         vi.fn(),
  withTransaction: vi.fn(),
  pool:            { query: vi.fn() },
  runMigrations:   vi.fn(),
}));

vi.mock('../services/triggers.js', () => ({
  triggerCreatorFirstPost:    vi.fn().mockResolvedValue(undefined),
  triggerCreatorFirstSale:    vi.fn().mockResolvedValue(undefined),
  triggerPurchaseConfirmation: vi.fn().mockResolvedValue(undefined),
  triggerAccountApproved:     vi.fn().mockResolvedValue(undefined),
}));

// Stripe mock — covers checkout.ts and webhooks.ts
vi.mock('stripe', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    id:  'cs_test_mock_session_id',
    url: 'https://checkout.stripe.com/pay/cs_test_mock',
  });
  class MockStripeError extends Error {
    type = 'StripeError'; code = 'test_error';
  }
  // Expose .errors as a static property on the constructor so
  // `err instanceof Stripe.errors.StripeError` works in the catch block.
  const MockStripe: any = vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockCreate, retrieve: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  }));
  MockStripe.errors = { StripeError: MockStripeError };
  return { default: MockStripe };
});

vi.mock('../services/email.js', () => ({
  sendSetPasswordEmail:          vi.fn().mockResolvedValue(undefined),
  sendUserWelcome:               vi.fn().mockResolvedValue(undefined),
  sendUserRejected:              vi.fn().mockResolvedValue(undefined),
  sendUserMoreInfoRequested:     vi.fn().mockResolvedValue(undefined),
  sendCreatorWelcome:            vi.fn().mockResolvedValue(undefined),
  sendCreatorRejected:           vi.fn().mockResolvedValue(undefined),
  sendContentApproved:           vi.fn().mockResolvedValue(undefined),
  sendContentRejected:           vi.fn().mockResolvedValue(undefined),
  sendContentChangesRequested:   vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

// Default JWT secret matches server/src/middleware/auth.ts fallback
const JWT_SECRET = 'archangels_dev_secret_change_in_production';

function makeToken(role = 'fan', userId = 'test-user-id') {
  return jwt.sign({ userId, role }, JWT_SECRET);
}

import { query, queryOne, execute, withTransaction } from '../db/schema.js';

const mockQuery        = vi.mocked(query);
const mockQueryOne     = vi.mocked(queryOne);
const mockExecute      = vi.mocked(execute);
const mockWithTxn      = vi.mocked(withTransaction);

const app = createTestApp();

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/creators ─────────────────────────────────────────────────────────

describe('GET /api/creators', () => {
  it('returns 200 with a JSON array', async () => {
    mockQuery.mockResolvedValue([
      {
        id: 'cp-1', username: 'arialuxe', display_name: 'Aria Luxe',
        subscription_price: '14.99', subscriber_count: '5', content_count: '5',
        is_approved: 1,
      },
    ]);
    const res = await request(app).get('/api/creators');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('response items contain expected fields', async () => {
    mockQuery.mockResolvedValue([
      { id: 'cp-1', username: 'arialuxe', display_name: 'Aria Luxe', subscription_price: '14.99' },
    ]);
    const res = await request(app).get('/api/creators');
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('username');
    expect(res.body[0]).toHaveProperty('display_name');
  });

  it('returns empty array when no approved creators', async () => {
    mockQuery.mockResolvedValue([]);
    const res = await request(app).get('/api/creators');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── GET /api/content ──────────────────────────────────────────────────────────

describe('GET /api/content', () => {
  it('returns 200 with a JSON array', async () => {
    mockQuery.mockResolvedValue([
      { id: 'c-1', title: 'Test Drop', access_type: 'locked', price: '9.99', status: 'approved' },
    ]);
    const res = await request(app).get('/api/content');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('accepts sort=trending param without error', async () => {
    mockQuery.mockResolvedValue([]);
    const res = await request(app).get('/api/content?sort=trending');
    expect(res.status).toBe(200);
  });

  it('accepts sort=rising param without error', async () => {
    mockQuery.mockResolvedValue([]);
    const res = await request(app).get('/api/content?sort=rising');
    expect(res.status).toBe(200);
  });
});

// ── GET /api/content/:id ──────────────────────────────────────────────────────

describe('GET /api/content/:id', () => {
  it('returns 404 when content does not exist', async () => {
    mockQueryOne.mockResolvedValue(null);
    const res = await request(app).get('/api/content/nonexistent-id');
    expect(res.status).toBe(404);
  });

  it('strips media_url from locked content', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'c-1', title: 'Locked', access_type: 'locked', price: '9.99',
      media_url: 'https://secret.example.com/file.jpg', status: 'approved',
    });
    const res = await request(app).get('/api/content/c-1');
    expect(res.status).toBe(200);
    expect(res.body.media_url).toBeNull();
  });

  it('does not strip media_url from free content', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'c-2', title: 'Free Drop', access_type: 'free', price: '0',
      media_url: 'https://cdn.example.com/free.jpg', status: 'approved',
    });
    const res = await request(app).get('/api/content/c-2');
    expect(res.status).toBe(200);
    expect(res.body.media_url).toBe('https://cdn.example.com/free.jpg');
  });

  it('strips media_url from subscribers content', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'c-3', title: 'Sub Only', access_type: 'subscribers', price: '0',
      media_url: 'https://cdn.example.com/sub.jpg', status: 'approved',
    });
    const res = await request(app).get('/api/content/c-3');
    expect(res.status).toBe(200);
    expect(res.body.media_url).toBeNull();
  });
});

// ── POST /api/payments/create-unlock-session ─────────────────────────────────

describe('POST /api/payments/create-unlock-session', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app)
      .post('/api/payments/create-unlock-session')
      .send({ content_id: 'c-1' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .post('/api/payments/create-unlock-session')
      .set('Authorization', 'Bearer not-a-valid-jwt')
      .send({ content_id: 'c-1' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when content_id is missing', async () => {
    const token = makeToken('fan');
    // requireApproved checks user status
    mockQueryOne.mockResolvedValueOnce({ status: 'approved' });
    const res = await request(app)
      .post('/api/payments/create-unlock-session')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/content_id/i);
  });

  it('returns 404 when content does not exist', async () => {
    const token = makeToken('fan');
    mockQueryOne
      .mockResolvedValueOnce({ status: 'approved' }) // requireApproved
      .mockResolvedValueOnce(null);                  // content lookup
    const res = await request(app)
      .post('/api/payments/create-unlock-session')
      .set('Authorization', `Bearer ${token}`)
      .send({ content_id: 'nonexistent' });
    expect(res.status).toBe(404);
  });
});

// ── Admin: duplicate username prevention ──────────────────────────────────────

describe('Admin: POST /api/admin/users/:id/approve', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/admin/users/req-1/approve');
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    const token = makeToken('fan');
    const res = await request(app)
      .post('/api/admin/users/req-1/approve')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('does not return 500 when username is already taken (collision handled)', async () => {
    const token = makeToken('admin');
    mockQueryOne
      .mockResolvedValueOnce({ email: 'testuser@example.com', name: 'Test User' }) // access_requests row
      .mockResolvedValueOnce(null)                                                  // no existing user by email
      .mockResolvedValueOnce({ id: 'existing-user-1' })                            // 'testuser' is taken
      .mockResolvedValueOnce(null);                                                 // 'testuser2' is free
    mockExecute
      .mockResolvedValueOnce(1) // INSERT users
      .mockResolvedValueOnce(1) // INSERT password_resets
      .mockResolvedValueOnce(1); // UPDATE access_requests

    const res = await request(app)
      .post('/api/admin/users/req-1/approve')
      .set('Authorization', `Bearer ${token}`);

    // The handler must NOT crash with 500 even when the first username is taken
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(200);
  });
});

// ── GET /api/access-request (health) ─────────────────────────────────────────

describe('GET /api/access-request', () => {
  it('returns 200 health check', async () => {
    const res = await request(app).get('/api/access-request');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── POST /api/checkout/create — payment tests ─────────────────────────────────

// Shared locked content fixture returned by queryOne for content lookups
const LOCKED_CONTENT = {
  id: 'content-id-1', title: 'Secret Drop', status: 'approved',
  access_type: 'locked', price: '9.99',
  creator_id: 'creator-profile-id', creator_user_id: 'creator-user-id',
  subscriber_discount_pct: 0,
  stripe_account_id: null, stripe_onboarding_complete: 0,
};

const CREATOR_PROFILE = {
  id: 'creator-profile-id', user_id: 'creator-user-id',
  display_name: 'Aria Luxe', subscription_price: '9.99',
  stripe_account_id: null, stripe_onboarding_complete: 0,
  is_approved: 1, application_status: 'approved',
};

describe('POST /api/checkout/create — unlock', () => {
  it('1. creates a Stripe session and returns checkout_url', async () => {
    const token = makeToken('fan', 'fan-user-id');
    mockQueryOne
      .mockResolvedValueOnce({ status: 'approved' })   // requireApproved
      .mockResolvedValueOnce(LOCKED_CONTENT)            // content lookup
      .mockResolvedValueOnce(null)                      // not already unlocked
      .mockResolvedValueOnce(null);                     // no active subscription
    const res = await request(app)
      .post('/api/checkout/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'unlock', content_id: 'content-id-1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toMatch(/checkout\.stripe\.com/);
  });

  it('4. returns 401 without Authorization header', async () => {
    const res = await request(app)
      .post('/api/checkout/create')
      .send({ type: 'unlock', content_id: 'content-id-1' });
    expect(res.status).toBe(401);
  });

  it('5. creator cannot buy own content — returns 403', async () => {
    // creator-user-id matches the content's creator_user_id
    const token = makeToken('creator', 'creator-user-id');
    mockQueryOne
      .mockResolvedValueOnce({ status: 'approved' })   // requireApproved
      .mockResolvedValueOnce(LOCKED_CONTENT);           // content lookup
    const res = await request(app)
      .post('/api/checkout/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'unlock', content_id: 'content-id-1' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/own content/i);
  });

  it('6. admin cannot make purchases — returns 403', async () => {
    const token = makeToken('admin', 'admin-user-id');
    // requireApproved passes for admin without DB call
    const res = await request(app)
      .post('/api/checkout/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'unlock', content_id: 'content-id-1' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });
});

describe('POST /api/checkout/create — tip', () => {
  it('2. creates a Stripe session for tip and returns checkout_url', async () => {
    const token = makeToken('fan', 'fan-user-id');
    mockQueryOne
      .mockResolvedValueOnce({ status: 'approved' })   // requireApproved
      .mockResolvedValueOnce(CREATOR_PROFILE);          // creator lookup
    const res = await request(app)
      .post('/api/checkout/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'tip', creator_id: 'creator-profile-id', amount: 10 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toMatch(/checkout\.stripe\.com/);
  });

  it('returns 400 when tip amount is below $1', async () => {
    const token = makeToken('fan', 'fan-user-id');
    // amount check (< $1) fires before the creator DB lookup, so only requireApproved consumes a value
    mockQueryOne.mockResolvedValueOnce({ status: 'approved' });
    const res = await request(app)
      .post('/api/checkout/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'tip', creator_id: 'creator-profile-id', amount: 0.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least \$1/i);
  });
});

describe('POST /api/checkout/create — subscription', () => {
  it('3. creates a Stripe session for subscription and returns checkout_url', async () => {
    const token = makeToken('fan', 'fan-user-id');
    mockQueryOne
      .mockResolvedValueOnce({ status: 'approved' })   // requireApproved
      .mockResolvedValueOnce(CREATOR_PROFILE);          // creator lookup
    const res = await request(app)
      .post('/api/checkout/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'subscription', creator_id: 'creator-profile-id' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toMatch(/checkout\.stripe\.com/);
  });
});

// ── POST /api/webhooks/stripe — webhook processing ────────────────────────────

function makeWebhookBody(overrides: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_session_001',
        payment_intent: 'pi_test_001',
        amount_total: 999,
        metadata: {
          type: 'unlock',
          user_id: 'fan-user-id',
          creator_id: 'creator-profile-id',
          creator_user_id: 'creator-user-id',
          content_id: 'content-id-1',
          amount: '9.99',
        },
        ...overrides,
      },
    },
  };
}

describe('POST /api/webhooks/stripe — unlock', () => {
  beforeEach(() => {
    // withTransaction: invoke the callback with a mock pg client
    (mockWithTxn.mockImplementation as any)(async (fn: (c: any) => Promise<void>) => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) } as any;
      await fn(mockClient);
    });
    // queryOne for creator lookup (used in resolve branch when creator_user_id is in meta → skipped)
    // queryOne for existing-session check → null (not duplicate)
    // queryOne for existing-unlock check → null (not duplicate)
    // queryOne for content title after unlock
    mockQueryOne
      .mockResolvedValueOnce(null)   // existing transaction by session_id → none
      .mockResolvedValueOnce(null)   // existing unlock row → none
      .mockResolvedValueOnce({ title: 'Secret Drop' }); // content title for trigger
  });

  it('7. webhook inserts content_unlock row', async () => {
    const body = JSON.stringify(makeWebhookBody());
    const res  = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(mockWithTxn).toHaveBeenCalledOnce();
    // The transaction callback calls client.query three times:
    //   INSERT transactions, INSERT content_unlocks, UPDATE creator_profiles
    const [[txnFn]] = mockWithTxn.mock.calls;
    const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) } as any;
    await txnFn(mockClient);
    expect(mockClient.query).toHaveBeenCalledTimes(3);
    const insertUnlockCall = mockClient.query.mock.calls[1];
    expect(insertUnlockCall[0]).toMatch(/INSERT INTO content_unlocks/i);
  });

  it('8. webhook creates transaction row', async () => {
    const body = JSON.stringify(makeWebhookBody());
    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(body);
    const [[txnFn]] = mockWithTxn.mock.calls;
    const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) } as any;
    await txnFn(mockClient);
    const insertTxnCall = mockClient.query.mock.calls[0];
    expect(insertTxnCall[0]).toMatch(/INSERT INTO transactions/i);
    // Verify stripe_session_id is included in the insert
    expect(insertTxnCall[1]).toContain('cs_test_session_001');
  });

  it('9. duplicate webhook (same session_id) does not re-process', async () => {
    // The describe beforeEach already queued [null, null, {title}] — reset to override cleanly.
    mockQueryOne.mockReset();
    mockWithTxn.mockReset();
    (mockWithTxn.mockImplementation as any)(async (fn: (c: any) => Promise<void>) => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) } as any;
      await fn(mockClient);
    });
    mockQueryOne.mockResolvedValueOnce({ id: 'existing-txn-id' }); // duplicate session found

    const body = JSON.stringify(makeWebhookBody());
    const res  = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(mockWithTxn).not.toHaveBeenCalled();
  });

  it('10. creator earnings = 80% of gross amount', async () => {
    const body = JSON.stringify(makeWebhookBody());
    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(body);
    const [[txnFn]] = mockWithTxn.mock.calls;
    const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) } as any;
    await txnFn(mockClient);
    // INSERT transactions args: [..., grossAmount, platformFee, creatorEarnings, ...]
    const txnArgs = mockClient.query.mock.calls[0][1] as number[];
    // amount_total = 999 cents = $9.99
    const grossAmount     = txnArgs[4]; // index 4 = amount
    const platformFee     = txnArgs[5]; // index 5 = platform_fee
    const creatorEarnings = txnArgs[6]; // index 6 = net_amount / creator_earnings
    expect(grossAmount).toBeCloseTo(9.99, 2);
    expect(platformFee).toBeCloseTo(2.00, 2);
    expect(creatorEarnings).toBeCloseTo(7.99, 2);
  });
});
