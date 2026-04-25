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

// GET /api/stripe/test — verify connectivity with real error detail
router.get('/test', async (_req, res) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    res.json({ connected: false, error: 'Missing STRIPE_SECRET_KEY' });
    return;
  }
  try {
    const stripe = new Stripe(key);
    await stripe.balance.retrieve();
    res.json({
      connected: true,
      mode: key.startsWith('sk_test') ? 'test' : 'live',
      key_prefix: key.substring(0, 7),
    });
  } catch (err: any) {
    res.json({
      connected: false,
      error: err.message,
      type: err.type,
      code: err.code,
    });
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

// POST /api/stripe/checkout — tip or subscription checkout session
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const { type, creatorId, amount } = req.body as {
      type: 'tip' | 'subscription';
      creatorId: string;
      amount?: number;
    };

    if (!type || !creatorId) {
      res.status(400).json({ error: 'type and creatorId are required.' });
      return;
    }

    const profile = await queryOne<any>(`
      SELECT cp.id, cp.subscription_price, cp.stripe_account_id, cp.stripe_onboarding_complete,
             u.display_name, u.username
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.id = $1
    `, [creatorId]);

    if (!profile) {
      res.status(404).json({ error: 'Creator not found.' });
      return;
    }

    console.log('[stripe/checkout] type:', type, 'creator:', profile.username, 'amount:', amount);

    const stripe = getStripe();
    const successUrl = `${CLIENT_URL}/creator/${profile.username}?payment=success&type=${type}`;
    const cancelUrl = `${CLIENT_URL}/creator/${profile.username}`;
    const hasConnect = !!profile.stripe_account_id && !!profile.stripe_onboarding_complete;

    if (type === 'tip') {
      const tipAmount = Number(amount);
      if (!tipAmount || tipAmount < 1) {
        res.status(400).json({ error: 'Tip amount must be at least $1.' });
        return;
      }

      const unitAmount = Math.round(tipAmount * 100);
      const feeAmount = Math.round(unitAmount * 0.2);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `Tip to ${profile.display_name}` },
            unit_amount: unitAmount,
          },
          quantity: 1,
        }],
        ...(hasConnect ? {
          payment_intent_data: {
            application_fee_amount: feeAmount,
            transfer_data: { destination: profile.stripe_account_id },
          },
        } : {}),
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { type: 'tip', creatorId, userId: req.auth!.userId },
      });

      res.json({ url: session.url });
      return;
    }

    if (type === 'subscription') {
      const unitAmount = Math.round(Number(profile.subscription_price) * 100);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `${profile.display_name} — Monthly Subscription` },
            unit_amount: unitAmount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { type: 'subscription', creatorId, userId: req.auth!.userId },
      });

      res.json({ url: session.url });
      return;
    }

    res.status(400).json({ error: 'type must be "tip" or "subscription".' });
  } catch (err: any) {
    console.error('[stripe/checkout] error:', err.message, err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session.' });
  }
});

export default router;
