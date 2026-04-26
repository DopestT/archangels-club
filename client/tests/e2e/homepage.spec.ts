import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads and shows a heading', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });

    // Filter out known non-fatal browser noise (favicon 404, extensions, etc.)
    const fatal = consoleErrors.filter(
      e => !e.includes('favicon') && !e.includes('net::ERR_') && !e.includes('chrome-extension'),
    );
    expect(fatal, `Console errors on homepage: ${fatal.join(', ')}`).toHaveLength(0);
  });

  test('page title contains Archangels', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/archangel/i, { timeout: 10_000 });
  });

  test('shows a request-access or join CTA', async ({ page }) => {
    await page.goto('/');
    const cta = page
      .locator('a, button')
      .filter({ hasText: /join|request|access|get started|apply/i })
      .first();
    await expect(cta).toBeVisible({ timeout: 10_000 });
  });

  test('signup link navigates to auth page', async ({ page }) => {
    await page.goto('/');
    const signupLink = page.locator('a[href*="signup"], a[href*="request"]').first();
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await expect(page).toHaveURL(/signup|request|auth/i, { timeout: 5_000 });
    }
  });

  test('no blank white screen', async ({ page }) => {
    await page.goto('/');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(50);
  });
});
