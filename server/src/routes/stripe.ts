import { Router } from 'express';
import Stripe from 'stripe';
import { requireAuth, requireCreator } from '../middleware/auth.js';
import { queryOne, execute } from '../db/schema.js';

const router = Router();
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// GET /api/stripe/test — verify connectivity
router.get('/test', async (_req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ connected: false, error: 'STRIPE_SECRET_KEY not configured' });
    return;
  }
  try {
    const stripe = getStripe();
    const account = await stripe.accounts.list({ limit: 1 });
    res.json({ connected: true, mode: process.env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'live' : 'test' });
  } catch (err) {
    res.status(503).json({ connected: false, error: 'Stripe connection failed' });
  }
});

// GET /api/stripe/connect/status — creator's Connect onboarding status
router.get('/connect/status', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ stripe_account_id: string | null; stripe_onboarding_complete: number }>(
      'SELECT stripe_account_id, stripe_onboarding_complete FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    res.json({
      has_account: !!profile?.stripe_account_id,
      onboarded: !!profile?.stripe_onboarding_complete,
      account_id: profile?.stripe_account_id ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Stripe status' });
  }
});

// POST /api/stripe/connect/start — create Express account (if needed) and return onboarding URL
router.post('/connect/start', requireAuth, requireCreator, async (req, res) => {
  try {
    const user = await queryOne<{ email: string; display_name: string }>(
      'SELECT email, display_name FROM users WHERE id = $1',
      [req.auth!.userId]
    );
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    let profile = await queryOne<{ id: string; stripe_account_id: string | null }>(
      'SELECT id, stripe_account_id FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );
    if (!profile) { res.status(404).json({ error: 'Creator profile not found' }); return; }

    let accountId = profile.stripe_account_id;

    if (!accountId) {
      const stripe = getStripe();
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          url: `${CLIENT_URL}/creator`,
        },
      });
      accountId = account.id;
      await execute(
        'UPDATE creator_profiles SET stripe_account_id = $1 WHERE id = $2',
        [accountId, profile.id]
      );
    }

    const stripe = getStripe();
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${CLIENT_URL}/creator?stripe=refresh`,
      return_url: `${CLIENT_URL}/creator?stripe=return`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('[stripe/connect] start error:', err);
    res.status(500).json({ error: 'Failed to start Stripe onboarding' });
  }
});

// POST /api/stripe/connect/verify — check if onboarding is complete, update DB
router.post('/connect/verify', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ id: string; stripe_account_id: string | null }>(
      'SELECT id, stripe_account_id FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );

    if (!profile?.stripe_account_id) {
      res.json({ onboarded: false });
      return;
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const onboarded = account.details_submitted;

    if (onboarded) {
      await execute(
        'UPDATE creator_profiles SET stripe_onboarding_complete = 1 WHERE id = $1',
        [profile.id]
      );
    }

    res.json({ onboarded, account_id: profile.stripe_account_id });
  } catch (err) {
    console.error('[stripe/connect] verify error:', err);
    res.status(500).json({ error: 'Failed to verify Stripe onboarding' });
  }
});

// POST /api/stripe/connect/dashboard-link — express dashboard for creator to manage payouts
router.post('/connect/dashboard-link', requireAuth, requireCreator, async (req, res) => {
  try {
    const profile = await queryOne<{ stripe_account_id: string | null; stripe_onboarding_complete: number }>(
      'SELECT stripe_account_id, stripe_onboarding_complete FROM creator_profiles WHERE user_id = $1',
      [req.auth!.userId]
    );

    if (!profile?.stripe_account_id || !profile.stripe_onboarding_complete) {
      res.status(400).json({ error: 'Stripe account not set up' });
      return;
    }

    const stripe = getStripe();
    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
    res.json({ url: loginLink.url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate dashboard link' });
  }
});

export default router;
