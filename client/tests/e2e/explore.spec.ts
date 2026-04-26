import { test, expect, request as apiRequest } from '@playwright/test';

const API = process.env.API_BASE_URL ?? 'https://archangels-club-production.up.railway.app';

test.describe('Explore page', () => {
  test('loads without 404 or blank screen', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.getByText('404')).not.toBeVisible();
  });

  test('API: GET /api/creators returns at least one creator', async () => {
    const ctx = await apiRequest.newContext({ baseURL: API });
    const res = await ctx.get('/api/creators');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('username');
  });

  test('API: GET /api/content returns at least one item', async () => {
    const ctx = await apiRequest.newContext({ baseURL: API });
    const res = await ctx.get('/api/content');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  test('shows creator cards after API loads', async ({ page }) => {
    await page.goto('/explore');
    // Wait for at least one link pointing to a creator profile
    await expect(page.locator('a[href*="/creator/"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a creator card navigates to their profile', async ({ page }) => {
    await page.goto('/explore');
    const creatorLink = page.locator('a[href*="/creator/"]').first();
    await creatorLink.waitFor({ state: 'visible', timeout: 15_000 });
    await creatorLink.click();
    await expect(page).toHaveURL(/\/creator\//, { timeout: 10_000 });
  });

  test('no console errors on explore page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/explore');
    await page.waitForTimeout(2000);
    const fatal = errors.filter(
      e => !e.includes('favicon') && !e.includes('net::ERR_') && !e.includes('chrome-extension'),
    );
    expect(fatal, `Console errors on /explore: ${fatal.join(', ')}`).toHaveLength(0);
  });
});
