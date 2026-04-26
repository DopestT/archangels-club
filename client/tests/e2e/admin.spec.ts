import { test, expect, request as apiRequest } from '@playwright/test';

const API = process.env.API_BASE_URL ?? 'https://archangels-club-production.up.railway.app';

test.describe('Admin page — unauthenticated', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/login/, { timeout: 5_000 });
  });

  test('no console errors on the redirect', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/admin');
    await page.waitForTimeout(1000);
    const fatal = errors.filter(
      e => !e.includes('favicon') && !e.includes('net::ERR_') && !e.includes('chrome-extension'),
    );
    expect(fatal, `Console errors on /admin: ${fatal.join(', ')}`).toHaveLength(0);
  });
});

test.describe('Creator application form — unauthenticated', () => {
  test('apply-creator redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/apply-creator');
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/login|pending/, { timeout: 5_000 });
  });
});

test.describe('Backend API — auth guards', () => {
  test('POST /api/payments/create-unlock-session rejects unauthenticated', async () => {
    const ctx = await apiRequest.newContext({ baseURL: API });
    const res = await ctx.post('/api/payments/create-unlock-session', {
      data: { content_id: 'test' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/auth/login rejects invalid credentials', async () => {
    const ctx = await apiRequest.newContext({ baseURL: API });
    const res = await ctx.post('/api/auth/login', {
      data: { email: 'nobody@example.com', password: 'wrongpass' },
    });
    expect([400, 401]).toContain(res.status());
  });

  test('GET /api/health returns ok', async () => {
    const ctx = await apiRequest.newContext({ baseURL: API });
    const res = await ctx.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
