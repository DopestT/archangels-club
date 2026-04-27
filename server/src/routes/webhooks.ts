import { Router } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { withTransaction, queryOne, execute } from '../db/schema.js';
import { triggerPurchaseConfirmation } from '../services/triggers.js';

const router = Router();

// POST /api/webhooks/stripe — raw body required (mounted before express.json())
router.post('/stripe', async (req, res) => {
  const sig    = req.headers['stripe-signature'] as string | undefined;
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

  console.log('[webhook] received event:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session        = event.data.object as Stripe.Checkout.Session;
    const meta           = session.metadata ?? {};
    const sessionId      = session.id;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

    // Normalize metadata keys:
    //   new unified format → snake_case (user_id, creator_id, creator_user_id)
    //   old tip/subscription format → camelCase (userId, creatorId)
    //   old unlock format → user_id, creator_profile_id (no type field)
    const userId          = meta.user_id ?? meta.userId ?? null;
    const creatorProfileId = meta.creator_id ?? meta.creatorId ?? meta.creator_profile_id ?? null;
    const creatorUserIdFromMeta = meta.creator_user_id ?? null;
    const contentId       = meta.content_id ?? null;
    const paymentType     = meta.type ?? (contentId ? 'unlock' : null);
    const amountStr       = meta.amount ?? null;

    console.log('[webhook] checkout.session.completed —',
      'sessionId:', sessionId, 'type:', paymentType,
      'userId:', userId, 'creatorProfileId:', creatorProfileId,
      'contentId:', contentId ?? '(none)', 'amount:', amountStr);

    if (!userId || !paymentType) {
      console.error('[webhook] Missing required metadata — userId:', userId, 'type:', paymentType,
        'raw metadata:', JSON.stringify(meta));
      res.json({ received: true });
      return;
    }

    // ── SUBSCRIPTION ─────────────────────────────────────────────────────────
    if (paymentType === 'subscription') {
      if (!creatorProfileId) {
        console.error('[webhook] subscription: missing creatorProfileId');
        res.json({ received: true });
        return;
      }
      try {
        const creator = await queryOne<{ user_id: string }>(
          'SELECT user_id FROM creator_profiles WHERE id = $1',
          [creatorProfileId]
        );
        if (!creator) {
          console.error('[webhook] subscription: creator profile not found:', creatorProfileId);
          res.json({ received: true });
          return;
        }

        const subId    = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await execute(
          `INSERT INTO subscriptions (id, subscriber_id, creator_id, status, expires_at)
           VALUES ($1, $2, $3, 'active', $4)
           ON CONFLICT (subscriber_id, creator_id) DO UPDATE SET status = 'active', expires_at = $4`,
          [subId, userId, creatorProfileId, expiresAt]
        );
        console.log('[webhook] subscription activated:', userId, '→ creator', creatorProfileId);

        const grossAmount    = session.amount_total ? session.amount_total / 100 : Number(amountStr ?? 0);
        const platformFee    = Math.round(grossAmount * 0.2 * 100) / 100;
        const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
        const txnId          = crypto.randomUUID();

        await execute(
          `INSERT INTO transactions
             (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
              status, stripe_payment_intent_id, stripe_session_id)
           VALUES ($1, $2, $3, 'subscription', $4, $5, $6, $7, 'completed', $8, $9)`,
          [txnId, userId, creator.user_id, subId, grossAmount, platformFee, creatorEarnings,
           paymentIntentId, sessionId]
        );
        await execute(
          'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
          [creatorEarnings, creatorProfileId]
        );
        console.log('[webhook] transaction written — subscription, grossAmount:', grossAmount,
          'creatorEarnings:', creatorEarnings);
      } catch (err) {
        console.error('[webhook] subscription processing failed:', err);
      }
      res.json({ received: true });
      return;
    }

    // ── TIP ──────────────────────────────────────────────────────────────────
    if (paymentType === 'tip') {
      if (!creatorProfileId) {
        console.error('[webhook] tip: missing creatorProfileId');
        res.json({ received: true });
        return;
      }
      try {
        const creator = await queryOne<{ user_id: string }>(
          'SELECT user_id FROM creator_profiles WHERE id = $1',
          [creatorProfileId]
        );
        if (!creator) {
          console.error('[webhook] tip: creator profile not found:', creatorProfileId);
          res.json({ received: true });
          return;
        }

        const grossAmount    = session.amount_total ? session.amount_total / 100 : Number(amountStr ?? 0);
        const platformFee    = Math.round(grossAmount * 0.2 * 100) / 100;
        const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
        const txnId          = crypto.randomUUID();

        await execute(
          `INSERT INTO transactions
             (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
              status, stripe_payment_intent_id, stripe_session_id)
           VALUES ($1, $2, $3, 'tip', $4, $5, $6, $7, 'completed', $8, $9)`,
          [txnId, userId, creator.user_id, paymentIntentId ?? txnId, grossAmount, platformFee,
           creatorEarnings, paymentIntentId, sessionId]
        );
        await execute(
          'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
          [creatorEarnings, creatorProfileId]
        );
        console.log('[webhook] transaction written — tip, grossAmount:', grossAmount,
          'creatorEarnings:', creatorEarnings);
      } catch (err) {
        console.error('[webhook] tip processing failed:', err);
      }
      res.json({ received: true });
      return;
    }

    // ── UNLOCK ───────────────────────────────────────────────────────────────
    if (paymentType === 'unlock') {
      if (!contentId || !creatorProfileId) {
        console.error('[webhook] unlock: missing contentId or creatorProfileId —',
          JSON.stringify(meta));
        res.json({ received: true });
        return;
      }

      // Resolve creator user_id: prefer metadata, fall back to DB lookup
      const creatorUserId = creatorUserIdFromMeta ?? (
        (await queryOne<{ user_id: string }>(
          'SELECT user_id FROM creator_profiles WHERE id = $1',
          [creatorProfileId]
        ))?.user_id ?? null
      );
      if (!creatorUserId) {
        console.error('[webhook] unlock: could not resolve creator user_id for profile:', creatorProfileId);
        res.json({ received: true });
        return;
      }

      // Idempotency: session_id check (primary) + unlock row check (secondary)
      const existingBySession = await queryOne(
        'SELECT id FROM transactions WHERE stripe_session_id = $1',
        [sessionId]
      );
      if (existingBySession) {
        console.log('[webhook] unlock: duplicate session, skipping:', sessionId);
        res.json({ received: true });
        return;
      }
      const existingUnlock = await queryOne(
        'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
        [userId, contentId]
      );
      if (existingUnlock) {
        console.log('[webhook] unlock: already unlocked (no session record), skipping:', userId, contentId);
        res.json({ received: true });
        return;
      }

      try {
        const grossAmount    = amountStr
          ? Number(amountStr)
          : (session.amount_total ? session.amount_total / 100 : 0);
        const platformFee    = Math.round(grossAmount * 0.2 * 100) / 100;
        const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
        const txnId          = crypto.randomUUID();
        const unlockId       = crypto.randomUUID();

        await withTransaction(async (client) => {
          await client.query(
            `INSERT INTO transactions
               (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
                status, stripe_payment_intent_id, stripe_session_id)
             VALUES ($1, $2, $3, 'content', $4, $5, $6, $7, 'completed', $8, $9)`,
            [txnId, userId, creatorUserId, contentId, grossAmount, platformFee, creatorEarnings,
             paymentIntentId, sessionId]
          );
          await client.query(
            'INSERT INTO content_unlocks (id, user_id, content_id, transaction_id) VALUES ($1, $2, $3, $4)',
            [unlockId, userId, contentId, txnId]
          );
          await client.query(
            'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
            [creatorEarnings, creatorProfileId]
          );
        });

        console.log('[webhook] transaction written — unlock, grossAmount:', grossAmount,
          'creatorEarnings:', creatorEarnings);
        console.log('[webhook] unlock inserted:', userId, '→', contentId);

        const content = await queryOne<any>('SELECT title FROM content WHERE id = $1', [contentId]);
        if (content) {
          triggerPurchaseConfirmation(userId, content.title, contentId).catch(console.error);
        }

        console.log('[webhook] unlock complete: user=%s content=%s amount=%s session=%s',
          userId, contentId, grossAmount, sessionId);
      } catch (err) {
        console.error('[webhook] unlock processing failed:', err);
        res.status(500).json({ error: 'Webhook processing failed' });
        return;
      }
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    console.log('[webhook] payment_intent.succeeded:', intent.id);
  }

  res.json({ received: true });
});

export default router;
