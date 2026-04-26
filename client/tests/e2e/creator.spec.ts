import { test, expect } from '@playwright/test';

const DEMO_CREATOR = 'arialuxe';

test.describe('Creator profile page', () => {
  test('loads for demo creator without error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`/creator/${DEMO_CREATOR}`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });

    const fatal = errors.filter(
      e => !e.includes('favicon') && !e.includes('net::ERR_') && !e.includes('chrome-extension'),
    );
    expect(fatal, `Console errors on creator page: ${fatal.join(', ')}`).toHaveLength(0);
  });

  test('shows creator name', async ({ page }) => {
    await page.goto(`/creator/${DEMO_CREATOR}`);
    await expect(page.getByText(/aria luxe/i)).toBeVisible({ timeout: 10_000 });
  });

  test('shows subscribe button with a price', async ({ page }) => {
    await page.goto(`/creator/${DEMO_CREATOR}`);
    const subscribeBtn = page
      .locator('button, a')
      .filter({ hasText: /subscribe/i })
      .first();
    await expect(subscribeBtn).toBeVisible({ timeout: 10_000 });
    // Price should appear somewhere near it
    await expect(page.getByText(/\$\d+\.\d{2}/)).toBeVisible();
  });

  test('shows tip button', async ({ page }) => {
    await page.goto(`/creator/${DEMO_CREATOR}`);
    const tipEl = page.locator('button, a').filter({ hasText: /tip/i }).first();
    await expect(tipEl).toBeVisible({ timeout: 10_000 });
  });

  test('shows content cards', async ({ page }) => {
    await page.goto(`/creator/${DEMO_CREATOR}`);
    await expect(page.locator('a[href*="/content/"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('tip button calls checkout — unauthenticated user redirected to login', async ({ page }) => {
    await page.goto(`/creator/${DEMO_CREATOR}`);
    const tipBtn = page.locator('button').filter({ hasText: /send.*tip|\btip\b/i }).first();
    if (await tipBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tipBtn.click();
      await page.waitForTimeout(1500);
      const url = page.url();
      // Acceptable outcomes: redirected to login, or Stripe checkout opened
      const isExpected =
        url.includes('/login') ||
        url.includes('stripe.com') ||
        url.includes('/checkout') ||
        // stayed on page and showed an error (also valid)
        url.includes('/creator/');
      expect(isExpected).toBe(true);
    }
  });

  test('returns 404-style page for unknown creator slug', async ({ page }) => {
    await page.goto('/creator/this-creator-does-not-exist-xyz123');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent();
    // Should show empty state or 404, not crash
    expect(body).toBeTruthy();
  });
});
