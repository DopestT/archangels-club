import Stripe from 'stripe';
import crypto from 'crypto';
import { withTransaction, queryOne, execute } from '../db/schema.js';
import { triggerPurchaseConfirmation } from './triggers.js';

/**
 * Idempotent fulfillment for a completed Stripe Checkout Session.
 * Safe to call from both the webhook and the verify-session endpoint.
 * All three payment types (unlock, tip, subscription) guard against
 * duplicate processing via stripe_session_id on the transactions table.
 */
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  const meta             = session.metadata ?? {};
  const sessionId        = session.id;
  const paymentIntentId  = typeof session.payment_intent === 'string' ? session.payment_intent : null;
  const stripeSubId      = typeof session.subscription    === 'string' ? session.subscription    : null;

  const userId              = meta.user_id ?? meta.userId ?? null;
  const creatorProfileId    = meta.creator_id ?? meta.creatorId ?? meta.creator_profile_id ?? null;
  const creatorUserIdFromMeta = meta.creator_user_id ?? null;
  const contentId           = meta.content_id ?? null;
  const paymentType         = meta.type ?? (contentId ? 'unlock' : null);
  const amountStr           = meta.amount ?? null;

  if (!userId || !paymentType) {
    console.log('[fulfillment] skipping — missing userId or paymentType in metadata');
    return;
  }

  // ── SUBSCRIPTION ───────────────────────────────────────────────────────────
  if (paymentType === 'subscription') {
    if (!creatorProfileId) {
      console.error('[fulfillment] subscription: missing creatorProfileId');
      return;
    }

    const dup = await queryOne('SELECT id FROM transactions WHERE stripe_session_id = $1', [sessionId]);
    if (dup) {
      console.log('[fulfillment] subscription: duplicate session, skipping:', sessionId);
      return;
    }

    const creator = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM creator_profiles WHERE id = $1', [creatorProfileId]
    );
    if (!creator) {
      console.error('[fulfillment] subscription: creator profile not found:', creatorProfileId);
      return;
    }

    const grossAmount     = session.amount_total ? session.amount_total / 100 : Number(amountStr ?? 0);
    const platformFee     = Math.round(grossAmount * 0.2 * 100) / 100;
    const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
    const subId           = crypto.randomUUID();
    const expiresAt       = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await execute(
      `INSERT INTO subscriptions (id, subscriber_id, creator_id, status, expires_at, stripe_subscription_id)
       VALUES ($1, $2, $3, 'active', $4, $5)
       ON CONFLICT (subscriber_id, creator_id)
       DO UPDATE SET status = 'active', expires_at = $4, stripe_subscription_id = COALESCE($5, subscriptions.stripe_subscription_id)`,
      [subId, userId, creatorProfileId, expiresAt, stripeSubId]
    );

    const txnId = crypto.randomUUID();
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
    console.log('[fulfillment] subscription activated: user=%s → creator=%s amount=%s',
      userId, creatorProfileId, grossAmount);
    return;
  }

  // ── TIP ────────────────────────────────────────────────────────────────────
  if (paymentType === 'tip') {
    if (!creatorProfileId) {
      console.error('[fulfillment] tip: missing creatorProfileId');
      return;
    }

    const dup = await queryOne('SELECT id FROM transactions WHERE stripe_session_id = $1', [sessionId]);
    if (dup) {
      console.log('[fulfillment] tip: duplicate session, skipping:', sessionId);
      return;
    }

    const creator = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM creator_profiles WHERE id = $1', [creatorProfileId]
    );
    if (!creator) {
      console.error('[fulfillment] tip: creator profile not found:', creatorProfileId);
      return;
    }

    const grossAmount     = session.amount_total ? session.amount_total / 100 : Number(amountStr ?? 0);
    const platformFee     = Math.round(grossAmount * 0.2 * 100) / 100;
    const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
    const txnId           = crypto.randomUUID();

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
    console.log('[fulfillment] tip recorded: user=%s → creator=%s amount=%s',
      userId, creatorProfileId, grossAmount);
    return;
  }

  // ── UNLOCK ─────────────────────────────────────────────────────────────────
  if (paymentType === 'unlock') {
    if (!contentId || !creatorProfileId) {
      console.error('[fulfillment] unlock: missing contentId or creatorProfileId');
      return;
    }

    const creatorUserId = creatorUserIdFromMeta ?? (
      (await queryOne<{ user_id: string }>(
        'SELECT user_id FROM creator_profiles WHERE id = $1', [creatorProfileId]
      ))?.user_id ?? null
    );
    if (!creatorUserId) {
      console.error('[fulfillment] unlock: could not resolve creator user_id');
      return;
    }

    const existingBySession = await queryOne(
      'SELECT id FROM transactions WHERE stripe_session_id = $1', [sessionId]
    );
    if (existingBySession) {
      console.log('[fulfillment] unlock: duplicate session, skipping:', sessionId);
      return;
    }

    const existingUnlock = await queryOne(
      'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
      [userId, contentId]
    );
    if (existingUnlock) {
      console.log('[fulfillment] unlock: already unlocked, skipping:', userId, contentId);
      return;
    }

    const grossAmount     = amountStr
      ? Number(amountStr)
      : (session.amount_total ? session.amount_total / 100 : 0);
    const platformFee     = Math.round(grossAmount * 0.2 * 100) / 100;
    const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
    const txnId           = crypto.randomUUID();
    const unlockId        = crypto.randomUUID();

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

    console.log('[fulfillment] unlock complete: user=%s content=%s amount=%s',
      userId, contentId, grossAmount);

    const content = await queryOne<{ title: string }>('SELECT title FROM content WHERE id = $1', [contentId]);
    if (content) {
      triggerPurchaseConfirmation(userId, content.title, contentId).catch(console.error);
    }
  }
}
