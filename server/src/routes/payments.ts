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

// POST /api/payments/create-unlock-session
router.post('/create-unlock-session', requireAuth, requireApproved, async (req, res) => {
  try {
    const { content_id } = req.body;
    if (!content_id) { res.status(400).json({ error: 'content_id required' }); return; }

    const content = await queryOne<any>(
      `SELECT c.*, cp.user_id as creator_user_id, cp.stripe_account_id, cp.stripe_onboarding_complete
       FROM content c
       JOIN creator_profiles cp ON cp.id = c.creator_id
       WHERE c.id = $1`,
      [content_id]
    );
    if (!content) { res.status(404).json({ error: 'Content not found' }); return; }
    if (content.status !== 'approved') {
      res.status(403).json({ error: 'Content is not available for purchase' });
      return;
    }
    if (content.access_type !== 'locked') {
      res.status(400).json({ error: 'Content does not require payment' });
      return;
    }
    if (!content.price || Number(content.price) <= 0) {
      res.status(400).json({ error: 'Content has no price set' });
      return;
    }
    if (!content.stripe_account_id || !content.stripe_onboarding_complete) {
      res.status(403).json({ error: 'Creator has not completed payout setup. Payment unavailable.' });
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

    const stripe = getStripe();
    const amountCents = Math.round(Number(content.price) * 100);
    const feeCents = Math.round(amountCents * 0.2);

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
      payment_intent_data: {
        application_fee_amount: feeCents,
        transfer_data: {
          destination: content.stripe_account_id,
        },
      },
      metadata: {
        user_id: req.auth!.userId,
        content_id,
        creator_user_id: content.creator_user_id,
        creator_profile_id: content.creator_id,
        amount: String(content.price),
      },
      success_url: `${CLIENT_URL}/content/${content_id}?payment=success`,
      cancel_url: `${CLIENT_URL}/content/${content_id}`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[payments] create-unlock-session error:', err);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

export default router;
