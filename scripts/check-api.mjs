#!/usr/bin/env node
/**
 * API health checks — hits Railway endpoints to verify the backend is live
 * and key routes return expected shapes.
 *
 * Usage: node scripts/check-api.mjs
 * Override base URL: API_BASE_URL=https://... node scripts/check-api.mjs
 */
import { fileURLToPath } from 'node:url';

const BASE    = process.env.API_BASE_URL ?? 'https://archangels-club-production.up.railway.app';
const TIMEOUT = 12_000;

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'pass' });
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    results.push({ name, status: 'fail', error: err.message });
    process.stderr.write(`  ✗ ${name}: ${err.message}\n`);
  }
}

async function fetchJSON(path, opts = {}) {
  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal, ...opts });
    let body;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

process.stdout.write(`\nAPI Health Checks → ${BASE}\n\n`);

await check('GET /api/health returns { status: "ok" }', async () => {
  const { status, body } = await fetchJSON('/api/health');
  if (status !== 200)        throw new Error(`Expected 200, got ${status}`);
  if (body?.status !== 'ok') throw new Error(`Expected status=ok, got: ${JSON.stringify(body)}`);
});

await check('GET /api/health/db — database connected', async () => {
  const { status, body } = await fetchJSON('/api/health/db');
  if (status !== 200) throw new Error(`Expected 200, got ${status}: ${JSON.stringify(body)}`);
  if (!body?.ok)      throw new Error(`DB not connected: ${JSON.stringify(body)}`);
});

await check('GET /api/creators returns non-empty array', async () => {
  const { status, body } = await fetchJSON('/api/creators');
  if (status !== 200)      throw new Error(`Expected 200, got ${status}: ${JSON.stringify(body)}`);
  if (!Array.isArray(body)) throw new Error(`Expected array, got ${typeof body}`);
  if (body.length === 0)   throw new Error('Array is empty — demo seed may not have run');
});

await check('GET /api/content returns array', async () => {
  const { status, body } = await fetchJSON('/api/content');
  if (status !== 200)      throw new Error(`Expected 200, got ${status}: ${JSON.stringify(body)}`);
  if (!Array.isArray(body)) throw new Error(`Expected array, got ${typeof body}`);
});

await check('GET /api/content?sort=trending returns array (tests cu.unlocked_at column)', async () => {
  const { status, body } = await fetchJSON('/api/content?sort=trending');
  if (status !== 200)      throw new Error(`Expected 200, got ${status}: ${JSON.stringify(body)}`);
  if (!Array.isArray(body)) throw new Error(`Expected array, got ${typeof body}`);
});

await check('GET /api/content?sort=rising returns array', async () => {
  const { status, body } = await fetchJSON('/api/content?sort=rising');
  if (status !== 200)      throw new Error(`Expected 200, got ${status}: ${JSON.stringify(body)}`);
  if (!Array.isArray(body)) throw new Error(`Expected array, got ${typeof body}`);
});

await check('GET /api/activity/recent returns array', async () => {
  const { status, body } = await fetchJSON('/api/activity/recent');
  if (status !== 200)      throw new Error(`Expected 200, got ${status}: ${JSON.stringify(body)}`);
  if (!Array.isArray(body)) throw new Error(`Expected array, got ${typeof body}`);
});

await check('GET /api/content/demo-c-aria-01 — locked item has media_url: null', async () => {
  const { status, body } = await fetchJSON('/api/content/demo-c-aria-01');
  if (status !== 200)         throw new Error(`Expected 200, got ${status}`);
  if (body.media_url !== null) throw new Error(`media_url leaked on locked content: ${body.media_url}`);
});

await check('POST /api/payments/create-unlock-session rejects unauthenticated (401)', async () => {
  const { status } = await fetchJSON('/api/payments/create-unlock-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_id: 'test' }),
  });
  if (status !== 401) throw new Error(`Expected 401, got ${status}`);
});

await check('POST /api/auth/login rejects bad credentials (400 or 401)', async () => {
  const { status } = await fetchJSON('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.com', password: 'wrongpassword123' }),
  });
  if (status !== 400 && status !== 401) throw new Error(`Expected 400/401, got ${status}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

const failed = results.filter(r => r.status === 'fail');
process.stdout.write(
  `\n${results.length} checks: ${results.length - failed.length} passed, ${failed.length} failed\n\n`,
);

process.exit(failed.length > 0 ? 1 : 0);
