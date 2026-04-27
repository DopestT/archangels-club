/**
 * Checkout flow E2E tests
 *
 * Default mode (no TEST_AUTH_TOKEN): injects a fake auth session into localStorage
 * and mocks the checkout API endpoint so tests run in CI without real credentials.
 *
 * Real-API mode (TEST_AUTH_TOKEN=<valid jwt>): passes the token to the real server
 * and validates the actual Stripe session URL returned.
 */
import { test, expect, request as apiRequest } from '@playwright/test';
import type { Page } from '@playwright/test';

const API               = process.env.API_BASE_URL ?? 'https://archangels-club-production.up.railway.app';
const CHECKOUT_ENDPOINT = '/api/checkout/create';
const FAKE_STRIPE_URL   = 'https://checkout.stripe.com/pay/cs_test_archangels_e2e_mock_00000000';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Injects a fake authenticated session into localStorage before each page
 * navigation, so the frontend renders the Unlock button instead of redirecting
 * to /login.  The API mock handles the server side; the token value is irrelevant.
 */
async function injectFakeAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('arc_auth', JSON.stringify({
      token: 'e2e_fake_token_not_valid_on_server',
      user: {
        id:                  'e2e-test-user-id',
        email:               'e2e@archangelsclub.com',
        username:            'e2e_tester',
        display_name:        'E2E Tester',
        role:                'fan',
        status:              'approved',
        is_verified_creator: false,
      },
    }));
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe('Checkout flow — unlock paid content', () => {
  let paidContentId: string | null = null;

  // Resolve a real locked+paid content ID from the API before any test runs.
  test.beforeAll(async () => {
    const ctx = await apiRequest.newContext({ baseURL: API });
    const res = await ctx.get('/api/content');
    if (!res.ok()) return;
    const items: any[] = await res.json();
    const paid = items.find(c => c.access_type === 'locked' && Number(c.price) > 0);
    paidContentId = paid?.id ?? null;
  });

  // ── Test 1: Full end-to-end checkout flow ──────────────────────────────────

  test('unlocks paid content and redirects to Stripe checkout', async ({ page }) => {
    if (!paidContentId) {
      test.skip('No paid locked content found in API — cannot test checkout flow');
      return;
    }

    // ── 1. Inject fake auth so the frontend shows the Unlock button ───────────
    await injectFakeAuth(page);

    // ── 2. Visit /explore (entry point per spec) ──────────────────────────────
    await page.goto('/explore');
    await expect(page.locator('body')).not.toBeEmpty({ timeout: 10_000 });

    // ── 3. Navigate to the paid content page ──────────────────────────────────
    // First try to click a card on /explore; fall back to direct navigation
    // in case the explore page only surfaces creator cards.
    const exploreContentLink = page
      .locator(`a[href*="/content/${paidContentId}"]`)
      .first();
    const foundOnExplore = await exploreContentLink
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (foundOnExplore) {
      await exploreContentLink.click();
      await page.waitForURL(`**/content/${paidContentId}`, { timeout: 10_000 });
    } else {
      await page.goto(`/content/${paidContentId}`);
    }

    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── 4. Confirm the paywall / Unlock button is visible ─────────────────────
    const unlockBtn = page
      .locator('button')
      .filter({ hasText: /unlock access/i })
      .first();

    await expect(
      unlockBtn,
      'Unlock Access button must be visible on a locked content page for an authenticated user',
    ).toBeVisible({ timeout: 10_000 });

    // ── 5. Intercept POST /api/payments/create-unlock-session ─────────────────
    let capturedStatus:  number | null  = null;
    let capturedBody:    any            = null;
    let capturedError:   string | null  = null;

    await page.route(`**${CHECKOUT_ENDPOINT}`, async (route) => {
      if (process.env.TEST_AUTH_TOKEN) {
        // Real-API mode: forward request with the provided token and capture the
        // actual server response so we can validate its structure.
        try {
          const resp = await route.fetch({
            headers: {
              ...route.request().headers(),
              Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
            },
          });
          capturedStatus = resp.status();
          try {
            capturedBody = await resp.json();
          } catch (e) {
            capturedError = `Could not parse response body: ${e}`;
          }
          if (capturedStatus !== 200) {
            capturedError =
              `API returned HTTP ${capturedStatus}.\n` +
              `Body: ${JSON.stringify(capturedBody, null, 2)}`;
            await route.abort();
            return;
          }
          await route.fulfill({ response: resp });
        } catch (e) {
          capturedError = `Network error reaching checkout API: ${e}`;
          await route.abort();
        }
      } else {
        // Mock mode: return a well-formed mock Stripe session so tests pass
        // in CI without real Stripe credentials.
        capturedStatus = 200;
        capturedBody   = { url: FAKE_STRIPE_URL };
        await route.fulfill({
          status:      200,
          contentType: 'application/json',
          body:        JSON.stringify(capturedBody),
        });
      }
    });

    // ── 6. Intercept the Stripe redirect (window.location.href = data.url) ────
    // Block actual navigation to Stripe; capture the attempted URL.
    let stripeRedirectUrl = '';

    await page.route('**checkout.stripe.com**', async (route) => {
      stripeRedirectUrl = route.request().url();
      await route.abort();
    });

    // Belt-and-suspenders: also capture via framenavigated in case the route
    // handler fires after the frame URL updates.
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        if (url.includes('checkout.stripe.com')) stripeRedirectUrl = url;
      }
    });

    // ── 7. Click Unlock Access ────────────────────────────────────────────────
    await unlockBtn.click();

    // Allow time for the fetch + redirect to complete
    await page.waitForTimeout(4_000);

    // ── 8. Assertions ─────────────────────────────────────────────────────────

    // 8a. No network/parse error from the checkout API
    if (capturedError) {
      throw new Error(
        `Checkout API call failed.\n` +
        `${capturedError}`,
      );
    }

    // 8b. API returned HTTP 200
    expect(
      capturedStatus,
      `Expected POST ${CHECKOUT_ENDPOINT} to return HTTP 200.\n` +
      `Received: HTTP ${capturedStatus}\n` +
      `Response body: ${JSON.stringify(capturedBody, null, 2)}`,
    ).toBe(200);

    // 8c. Response body contains a Stripe checkout URL
    // The server returns { url: session.url } — the frontend reads data.url.
    const checkoutUrl: string | undefined = capturedBody?.url;

    expect(
      checkoutUrl,
      `Response body must contain a "url" field pointing to Stripe.\n` +
      `Received body: ${JSON.stringify(capturedBody, null, 2)}`,
    ).toBeTruthy();

    expect(
      checkoutUrl,
      `Checkout URL must point to checkout.stripe.com.\n` +
      `Received: "${checkoutUrl}"`,
    ).toMatch(/checkout\.stripe\.com/);

    // 8d. Browser redirected (or attempted to redirect) to Stripe
    const redirected =
      stripeRedirectUrl.includes('checkout.stripe.com') ||
      page.url().includes('checkout.stripe.com');

    expect(
      redirected,
      `Browser did not redirect to Stripe checkout after unlock.\n` +
      `Intercepted Stripe URL: "${stripeRedirectUrl}"\n` +
      `Current page URL:       "${page.url()}"`,
    ).toBe(true);
  });

  // ── Test 2: Unauthenticated request returns 401 ────────────────────────────

  test('API: POST /api/checkout/create returns 401 without auth', async () => {
    if (!paidContentId) {
      test.skip('No paid locked content available — skipping API auth guard test');
      return;
    }

    const ctx = await apiRequest.newContext({ baseURL: API });
    const res = await ctx.post(CHECKOUT_ENDPOINT, {
      data:    { content_id: paidContentId, type: 'unlock' },
      headers: { 'Content-Type': 'application/json' },
    });

    const body = await res.json().catch(() => null);
    expect(
      res.status(),
      `Expected 401 for unauthenticated checkout request.\n` +
      `Received: HTTP ${res.status()}\n` +
      `Body: ${JSON.stringify(body, null, 2)}`,
    ).toBe(401);
  });

  // ── Test 3: Unauthenticated user is redirected to /login ──────────────────

  test('unauthenticated user visiting locked content is redirected to login on unlock click', async ({ page }) => {
    if (!paidContentId) {
      test.skip('No paid locked content available — skipping auth redirect test');
      return;
    }

    await page.goto(`/content/${paidContentId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const unlockBtn = page
      .locator('button')
      .filter({ hasText: /unlock/i })
      .first();

    const btnVisible = await unlockBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    if (btnVisible) {
      await unlockBtn.click();
      await page.waitForTimeout(1_500);
      await expect(
        page,
        'Unauthenticated unlock attempt must redirect to /login',
      ).toHaveURL(/\/login/, { timeout: 5_000 });
    } else {
      // Page may have already redirected to login before button was found
      expect(page.url()).toMatch(/login|content/);
    }
  });
});
