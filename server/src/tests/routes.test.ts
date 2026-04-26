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

import { query, queryOne, execute } from '../db/schema.js';

const mockQuery   = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);
const mockExecute = vi.mocked(execute);

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
