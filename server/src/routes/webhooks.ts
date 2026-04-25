import { Router } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { withTransaction, queryOne, execute } from '../db/schema.js';
import { triggerPurchaseConfirmation } from '../services/triggers.js';

const router = Router();

// POST /api/webhooks/stripe — raw body required (mounted before express.json())
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (secret && sig) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error('[webhook] Signature verification failed:', err);
      res.status(400).send('Webhook signature verification failed');
      return;
    }
  } else {
    try {
      event = (typeof req.body === 'string' || Buffer.isBuffer(req.body))
        ? JSON.parse(req.body.toString())
        : req.body as Stripe.Event;
    } catch {
      res.status(400).send('Invalid payload');
      return;
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata ?? {};
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

    // ── Subscription checkout ────────────────────────────────────────────────
    if (meta.type === 'subscription') {
      const { userId, creatorId } = meta;
      if (userId && creatorId) {
        try {
          const creator = await queryOne<{ user_id: string }>('SELECT user_id FROM creator_profiles WHERE id = $1', [creatorId]);
          if (creator) {
            const subId = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await execute(
              `INSERT INTO subscriptions (id, subscriber_id, creator_id, status, expires_at) VALUES ($1, $2, $3, 'active', $4)
               ON CONFLICT (subscriber_id, creator_id) DO UPDATE SET status = 'active', expires_at = $4`,
              [subId, userId, creatorId, expiresAt]
            );
            const txnId = crypto.randomUUID();
            const amount = session.amount_total ? session.amount_total / 100 : 0;
            const platformFee = Math.round(amount * 0.2 * 100) / 100;
            const netAmount = Math.round((amount - platformFee) * 100) / 100;
            await execute(
              `INSERT INTO transactions (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount, status, stripe_payment_intent_id)
               VALUES ($1, $2, $3, 'subscription', $4, $5, $6, $7, 'completed', $8)`,
              [txnId, userId, creator.user_id, subId, amount, platformFee, netAmount, paymentIntentId]
            );
            console.log(`[webhook] Subscription recorded: user=${userId} creator=${creatorId} amount=${amount}`);
          }
        } catch (err) {
          console.error('[webhook] Subscription processing failed:', err);
        }
      }
      res.json({ received: true });
      return;
    }

    // ── Tip checkout ─────────────────────────────────────────────────────────
    if (meta.type === 'tip') {
      const { userId, creatorId } = meta;
      if (userId && creatorId) {
        try {
          const creator = await queryOne<{ user_id: string }>('SELECT user_id FROM creator_profiles WHERE id = $1', [creatorId]);
          if (creator) {
            const txnId = crypto.randomUUID();
            const amount = session.amount_total ? session.amount_total / 100 : 0;
            const platformFee = Math.round(amount * 0.2 * 100) / 100;
            const netAmount = Math.round((amount - platformFee) * 100) / 100;
            await execute(
              `INSERT INTO transactions (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount, status, stripe_payment_intent_id)
               VALUES ($1, $2, $3, 'tip', $4, $5, $6, $7, 'completed', $8)`,
              [txnId, userId, creator.user_id, paymentIntentId ?? txnId, amount, platformFee, netAmount, paymentIntentId]
            );
            await execute(
              'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
              [netAmount, creatorId]
            );
            console.log(`[webhook] Tip recorded: user=${userId} creator=${creatorId} amount=${amount}`);
          }
        } catch (err) {
          console.error('[webhook] Tip processing failed:', err);
        }
      }
      res.json({ received: true });
      return;
    }

    // ── Content unlock checkout ───────────────────────────────────────────────
    const { user_id, content_id, creator_user_id, creator_profile_id, amount } = meta;

    if (!user_id || !content_id || !creator_user_id || !creator_profile_id || !amount) {
      console.error('[webhook] Missing metadata:', session.metadata);
      res.json({ received: true });
      return;
    }

    // Idempotency check
    const existing = await queryOne(
      'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
      [user_id, content_id]
    );
    if (existing) { res.json({ received: true }); return; }

    try {
      const amountNum = parseFloat(amount);
      const platformFee = Math.round(amountNum * 0.2 * 100) / 100;
      const netAmount = Math.round((amountNum - platformFee) * 100) / 100;
      const txnId = crypto.randomUUID();
      const unlockId = crypto.randomUUID();

      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO transactions (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount, status, stripe_payment_intent_id)
           VALUES ($1, $2, $3, 'content', $4, $5, $6, $7, 'completed', $8)`,
          [txnId, user_id, creator_user_id, content_id, amountNum, platformFee, netAmount, paymentIntentId]
        );
        await client.query(
          'INSERT INTO content_unlocks (id, user_id, content_id, transaction_id) VALUES ($1, $2, $3, $4)',
          [unlockId, user_id, content_id, txnId]
        );
        await client.query(
          'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
          [netAmount, creator_profile_id]
        );
      });

      const content = await queryOne<any>('SELECT title FROM content WHERE id = $1', [content_id]);
      if (content) {
        triggerPurchaseConfirmation(user_id, content.title, content_id).catch(console.error);
      }

      console.log(`[webhook] Unlocked: user=${user_id} content=${content_id} amount=${amountNum} intent=${paymentIntentId}`);
    } catch (err) {
      console.error('[webhook] Processing failed:', err);
      res.status(500).json({ error: 'Webhook processing failed' });
      return;
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    // Already handled via checkout.session.completed — log only
    console.log(`[webhook] payment_intent.succeeded: ${intent.id}`);
  }

  res.json({ received: true });
});

export default router;
