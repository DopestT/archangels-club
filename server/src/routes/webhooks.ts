import { Router } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { withTransaction, queryOne } from '../db/schema.js';
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
    // No secret configured — accept raw body as JSON (dev / test mode)
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
    const { user_id, content_id, creator_user_id, creator_profile_id, amount } = session.metadata ?? {};

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
          `INSERT INTO transactions (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount, status)
           VALUES ($1, $2, $3, 'content', $4, $5, $6, $7, 'completed')`,
          [txnId, user_id, creator_user_id, content_id, amountNum, platformFee, netAmount]
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

      console.log(`[webhook] Unlocked: user=${user_id} content=${content_id} amount=${amountNum}`);
    } catch (err) {
      console.error('[webhook] Processing failed:', err);
      res.status(500).json({ error: 'Webhook processing failed' });
      return;
    }
  }

  res.json({ received: true });
});

export default router;
