import { Router } from 'express';
import Stripe from 'stripe';
import { requireAuth, requireApproved } from '../middleware/auth.js';
import { queryOne } from '../db/schema.js';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL ?? process.env.CLIENT_URL ?? 'https://archangelsclub.com';
const PLATFORM_FEE_RATE = 0.2;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// GET /api/checkout/session/:sessionId — verify session for success page
router.get('/session/:sessionId', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(String(req.params.sessionId));
    const meta = session.metadata ?? {};

    if (meta.user_id !== req.auth!.userId && req.auth!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    res.json({
      status:         session.status,
      payment_status: session.payment_status,
      type:           meta.type ?? 'unknown',
      content_id:     meta.content_id ?? null,
      creator_id:     meta.creator_id ?? null,
      amount:         meta.amount ? Number(meta.amount) : null,
    });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      console.error('[checkout/session] Stripe error:', err.type, err.message);
    } else {
      console.error('[checkout/session] error:', err);
    }
    res.status(500).json({ error: 'Failed to retrieve session.' });
  }
});

// POST /api/checkout/create — unified checkout: unlock | tip | subscription
router.post('/create', requireAuth, requireApproved, async (req, res) => {
  const { type, content_id, creator_id, amount } = req.body;

  console.log('[checkout/create] body:', JSON.stringify(req.body));
  console.log('[checkout/create] userId:', req.auth!.userId, 'role:', req.auth!.role);

  if (req.auth!.role === 'admin') {
    res.status(403).json({ error: 'Admin users view content for free and cannot make purchases.' });
    return;
  }

  try {
    if (!type || !['unlock', 'tip', 'subscription'].includes(type)) {
      res.status(400).json({ error: 'type must be "unlock", "tip", or "subscription".' });
      return;
    }

    const stripe = getStripe();

    // ── UNLOCK ───────────────────────────────────────────────────────────────
    if (type === 'unlock') {
      if (!content_id) {
        res.status(400).json({ error: 'content_id is required for type "unlock".' });
        return;
      }

      const content = await queryOne<any>(
        `SELECT c.*, cp.id as creator_profile_id, cp.user_id as creator_user_id,
                cp.stripe_account_id, cp.stripe_onboarding_complete
         FROM content c
         JOIN creator_profiles cp ON cp.id = c.creator_id
         WHERE c.id = $1`,
        [content_id]
      );

      if (!content) {
        res.status(404).json({ error: 'Content not found.' });
        return;
      }
      console.log('[checkout/create] content found:', content.title,
        'status:', content.status, 'access_type:', content.access_type, 'price:', content.price);

      if (content.status !== 'approved') {
        res.status(403).json({ error: 'This content is not available for purchase.' });
        return;
      }
      if (content.access_type !== 'locked') {
        res.status(400).json({ error: 'This content does not require payment.' });
        return;
      }
      if (!content.price || Number(content.price) <= 0) {
        res.status(400).json({ error: 'Content has no price set.' });
        return;
      }
      if (content.creator_user_id === req.auth!.userId) {
        res.status(403).json({ error: 'You cannot purchase your own content.' });
        return;
      }

      const alreadyUnlocked = await queryOne(
        'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
        [req.auth!.userId, content_id]
      );
      if (alreadyUnlocked) {
        console.log('[checkout/create] already unlocked, skipping checkout');
        res.json({ already_unlocked: true });
        return;
      }

      const sub = await queryOne<{ id: string }>(
        `SELECT id FROM subscriptions
         WHERE subscriber_id = $1 AND creator_id = $2 AND status = 'active' AND expires_at > NOW()`,
        [req.auth!.userId, content.creator_id]
      );
      const isSubscribed = !!sub;
      const discountPct = isSubscribed ? (Number(content.subscriber_discount_pct) || 0) : 0;
      const effectivePrice = discountPct > 0
        ? Math.round(Number(content.price) * (1 - discountPct / 100) * 100) / 100
        : Number(content.price);

      console.log('[checkout/create] price calculated:', effectivePrice,
        'isSubscribed:', isSubscribed, 'discountPct:', discountPct);

      const amountCents = Math.round(effectivePrice * 100);
      const feeCents    = Math.round(amountCents * PLATFORM_FEE_RATE);
      const hasConnect  = !!content.stripe_account_id && !!content.stripe_onboarding_complete;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: content.title },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        ...(hasConnect ? {
          payment_intent_data: {
            application_fee_amount: feeCents,
            transfer_data: { destination: content.stripe_account_id },
          },
        } : {}),
        metadata: {
          type:            'unlock',
          user_id:         req.auth!.userId,
          creator_id:      content.creator_id,
          creator_user_id: content.creator_user_id,
          content_id,
          amount:          String(effectivePrice),
        },
        success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${FRONTEND_URL}/cancel`,
      });

      console.log('Stripe session URL:', session.url);
      if (!session.url) throw new Error('Stripe session created but no URL returned.');
      res.json({ url: session.url });
      return;
    }

    // ── TIP ──────────────────────────────────────────────────────────────────
    if (type === 'tip') {
      if (!creator_id) {
        res.status(400).json({ error: 'creator_id is required for type "tip".' });
        return;
      }
      const tipAmount = Number(amount);
      if (!tipAmount || tipAmount < 1) {
        res.status(400).json({ error: 'Tip amount must be at least $1.' });
        return;
      }

      const creator = await queryOne<any>(
        `SELECT cp.id, cp.user_id, cp.stripe_account_id, cp.stripe_onboarding_complete,
                u.display_name
         FROM creator_profiles cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.id = $1 AND cp.is_approved = 1 AND cp.application_status = 'approved'`,
        [creator_id]
      );
      if (!creator) {
        res.status(404).json({ error: 'Creator not found.' });
        return;
      }
      console.log('[checkout/create] creator found:', creator.display_name);

      if (creator.user_id === req.auth!.userId) {
        res.status(403).json({ error: 'You cannot tip yourself.' });
        return;
      }

      console.log('[checkout/create] price calculated:', tipAmount, '(tip)');

      const unitAmount = Math.round(tipAmount * 100);
      const feeAmount  = Math.round(unitAmount * PLATFORM_FEE_RATE);
      const hasConnect = !!creator.stripe_account_id && !!creator.stripe_onboarding_complete;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `Tip to ${creator.display_name}` },
            unit_amount: unitAmount,
          },
          quantity: 1,
        }],
        ...(hasConnect ? {
          payment_intent_data: {
            application_fee_amount: feeAmount,
            transfer_data: { destination: creator.stripe_account_id },
          },
        } : {}),
        metadata: {
          type:            'tip',
          user_id:         req.auth!.userId,
          creator_id,
          creator_user_id: creator.user_id,
          amount:          String(tipAmount),
        },
        success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${FRONTEND_URL}/cancel`,
      });

      console.log('Stripe session URL:', session.url);
      if (!session.url) throw new Error('Stripe session created but no URL returned.');
      res.json({ url: session.url });
      return;
    }

    // ── SUBSCRIPTION ─────────────────────────────────────────────────────────
    if (type === 'subscription') {
      if (!creator_id) {
        res.status(400).json({ error: 'creator_id is required for type "subscription".' });
        return;
      }

      const creator = await queryOne<any>(
        `SELECT cp.id, cp.user_id, cp.subscription_price, cp.stripe_account_id, cp.stripe_onboarding_complete,
                u.display_name
         FROM creator_profiles cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.id = $1 AND cp.is_approved = 1 AND cp.application_status = 'approved'`,
        [creator_id]
      );
      if (!creator) {
        res.status(404).json({ error: 'Creator not found.' });
        return;
      }
      console.log('[checkout/create] creator found:', creator.display_name);

      if (creator.user_id === req.auth!.userId) {
        res.status(403).json({ error: 'You cannot subscribe to yourself.' });
        return;
      }

      const subscriptionPrice = Number(creator.subscription_price);
      if (subscriptionPrice <= 0) {
        res.status(400).json({ error: 'Creator has not set a subscription price.' });
        return;
      }

      console.log('[checkout/create] price calculated:', subscriptionPrice, '(subscription)');

      const unitAmount = Math.round(subscriptionPrice * 100);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `${creator.display_name} — Monthly Subscription` },
            unit_amount: unitAmount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        metadata: {
          type:            'subscription',
          user_id:         req.auth!.userId,
          creator_id,
          creator_user_id: creator.user_id,
          amount:          String(subscriptionPrice),
        },
        success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${FRONTEND_URL}/cancel`,
      });

      console.log('Stripe session URL:', session.url);
      if (!session.url) throw new Error('Stripe session created but no URL returned.');
      res.json({ url: session.url });
      return;
    }

  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      console.error('[checkout/create] Stripe error — type:', err.type, 'code:', err.code, 'message:', err.message);
      res.status(500).json({ error: `Checkout failed: ${err.message}` });
    } else {
      console.error('[checkout/create] error:', err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Checkout failed: ${message}` });
    }
  }
});

export default router;
