import { Router } from 'express';
import Stripe from 'stripe';
import { requireAuth, requireApproved } from '../middleware/auth.js';
import { queryOne } from '../db/schema.js';

const router = Router();
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// POST /api/checkout/create
router.post('/create', requireAuth, requireApproved, async (req, res) => {
  const { content_id, type } = req.body;

  console.log('[checkout/create] request received — userId:', req.auth!.userId,
    'content_id:', content_id, 'type:', type);

  try {
    if (!content_id) {
      res.status(400).json({ error: 'content_id is required' });
      return;
    }
    if (type !== 'unlock') {
      res.status(400).json({ error: 'type must be "unlock"' });
      return;
    }

    const content = await queryOne<any>(
      `SELECT c.*, cp.user_id as creator_user_id, cp.stripe_account_id, cp.stripe_onboarding_complete
       FROM content c
       JOIN creator_profiles cp ON cp.id = c.creator_id
       WHERE c.id = $1`,
      [content_id]
    );

    if (!content) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }
    if (content.status !== 'approved') {
      res.status(403).json({ error: 'This content is not available for purchase' });
      return;
    }
    if (content.access_type !== 'locked') {
      res.status(400).json({ error: 'This content does not require payment' });
      return;
    }
    if (!content.price || Number(content.price) <= 0) {
      res.status(400).json({ error: 'Content has no price set' });
      return;
    }

    const alreadyUnlocked = await queryOne(
      'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
      [req.auth!.userId, content_id]
    );
    if (alreadyUnlocked) {
      res.json({ already_unlocked: true, redirect_url: `${CLIENT_URL}/content/${content_id}?unlocked=true` });
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

    console.log('[checkout/create] content:', content.title,
      'basePrice:', content.price, 'isSubscribed:', isSubscribed,
      'discountPct:', discountPct, 'effectivePrice:', effectivePrice);

    const stripe = getStripe();
    const amountCents = Math.round(effectivePrice * 100);
    const feeCents    = Math.round(amountCents * 0.2);
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
        user_id:           req.auth!.userId,
        content_id,
        creator_user_id:   content.creator_user_id,
        creator_profile_id: content.creator_id,
        amount:            String(effectivePrice),
      },
      success_url: `${CLIENT_URL}/content/${content_id}?payment=success`,
      cancel_url:  `${CLIENT_URL}/content/${content_id}`,
    });

    console.log('[checkout/create] session created:', session.id,
      '→', session.url?.substring(0, 60));

    res.json({ checkout_url: session.url });

  } catch (err) {
    console.error('[checkout/create] error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Checkout failed: ${message}` });
  }
});

export default router;
