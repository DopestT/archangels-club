import Stripe from 'stripe';
import crypto from 'crypto';
import { withTransaction, queryOne, execute } from '../db/schema.js';
import { triggerPurchaseConfirmation } from './triggers.js';
import { recordSignal, logEvent } from './events.js';
import { invalidateUserCache } from './memberRecommendations.js';
import { sendFulfillmentEscalationAlert } from './email.js';

// PostgreSQL unique_violation error code — thrown when a UNIQUE constraint fires.
// Used to detect concurrent fulfillment races and treat them as idempotent success.
function isUniqueViolation(err: unknown): boolean {
  return (err as any)?.code === '23505';
}

// ── Fulfillment record helpers ───────────────────────────────────────────────

const MAX_FULFILLMENT_ATTEMPTS = 5;

async function initFulfillmentRecord(
  sessionId: string,
  eventId: string | null,
  userId: string,
  creatorId: string | null,
  purchaseType: string
): Promise<{ id: string; alreadyFulfilled: boolean; shouldEscalate: boolean }> {
  const id = crypto.randomUUID();
  const result = await queryOne<{ id: string; status: string; attempts: number }>(
    `INSERT INTO fulfillment_records
       (id, stripe_session_id, stripe_event_id, user_id, creator_id, purchase_type, status, attempts)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0)
     ON CONFLICT (stripe_session_id)
       DO UPDATE SET attempts = fulfillment_records.attempts + 1,
                     stripe_event_id = COALESCE(EXCLUDED.stripe_event_id, fulfillment_records.stripe_event_id),
                     updated_at = NOW()
     RETURNING id, status, attempts`,
    [id, sessionId, eventId, userId, creatorId, purchaseType]
  );
  const status = result!.status;
  const attempts = result!.attempts;
  return {
    id: result!.id,
    alreadyFulfilled: status === 'fulfilled',
    shouldEscalate: status !== 'fulfilled' && attempts >= MAX_FULFILLMENT_ATTEMPTS,
  };
}

async function markFulfillmentDone(recordId: string, refType: string, refId: string): Promise<void> {
  await execute(
    `UPDATE fulfillment_records
       SET status = 'fulfilled', ref_type = $2, ref_id = $3, last_error = NULL,
           fulfilled_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [recordId, refType, refId]
  );
}

async function markFulfillmentFailed(recordId: string, error: string): Promise<void> {
  await execute(
    `UPDATE fulfillment_records
       SET status = 'failed', last_error = $2, updated_at = NOW()
     WHERE id = $1`,
    [recordId, error.slice(0, 2000)]
  );
}

async function markFulfillmentNeedsReview(recordId: string, reason: string, sessionId?: string): Promise<void> {
  await execute(
    `UPDATE fulfillment_records
       SET status = 'needs_review', last_error = $2, updated_at = NOW()
     WHERE id = $1`,
    [recordId, reason.slice(0, 2000)]
  );
  if (sessionId) {
    sendFulfillmentEscalationAlert(sessionId, reason).catch(() => {});
  }
}

// ── Main fulfillment entry point ─────────────────────────────────────────────

/**
 * Idempotent fulfillment for a completed Stripe Checkout Session.
 * Safe to call from webhook, verify-session endpoint, or reconciliation.
 */
export async function fulfillCheckoutSession(
  session: Stripe.Checkout.Session,
  stripeEventId: string | null = null
): Promise<void> {
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
    console.log('[fulfillment] skipping — missing userId or paymentType in metadata session=%s', sessionId);
    return;
  }

  // ── SUBSCRIPTION ──────────────────────────────────────────────────────────
  if (paymentType === 'subscription') {
    if (!creatorProfileId) {
      console.error('[fulfillment] subscription: missing creatorProfileId session=%s', sessionId);
      return;
    }

    const { id: fId, alreadyFulfilled, shouldEscalate } = await initFulfillmentRecord(
      sessionId, stripeEventId, userId, creatorProfileId, 'subscription'
    );
    if (alreadyFulfilled) {
      console.log('[fulfillment] subscription: already fulfilled, skipping session=%s', sessionId);
      return;
    }
    if (shouldEscalate) {
      await markFulfillmentNeedsReview(fId, `Auto-escalated after ${MAX_FULFILLMENT_ATTEMPTS} failed attempts`, sessionId);
      console.error('[fulfillment] subscription: auto-escalated to needs_review session=%s', sessionId);
      return;
    }

    try {
      const dup = await queryOne('SELECT id FROM transactions WHERE stripe_session_id = $1', [sessionId]);
      if (dup) {
        console.log('[fulfillment] subscription: duplicate transaction, skipping session=%s', sessionId);
        await execute(
          `UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]
        );
        return;
      }

      const creator = await queryOne<{ user_id: string }>(
        'SELECT user_id FROM creator_profiles WHERE id = $1', [creatorProfileId]
      );
      if (!creator) {
        await markFulfillmentNeedsReview(fId, `Creator profile not found: ${creatorProfileId}`);
        console.error('[fulfillment] subscription: creator profile not found:', creatorProfileId);
        return;
      }

      const grossAmount     = session.amount_total ? session.amount_total / 100 : Number(amountStr ?? 0);
      const platformFee     = Math.round(grossAmount * 0.3 * 100) / 100;
      const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
      const subId           = crypto.randomUUID();

      // Use period end from Stripe subscription if available; otherwise 30 days
      const stripeStripeCustomer = typeof session.customer === 'string' ? session.customer : null;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await execute(
        `INSERT INTO subscriptions
           (id, subscriber_id, creator_id, status, expires_at, stripe_subscription_id,
            stripe_customer_id, current_period_end)
         VALUES ($1, $2, $3, 'active', $4, $5, $6, $4)
         ON CONFLICT (subscriber_id, creator_id)
         DO UPDATE SET
           status = 'active',
           expires_at = $4,
           stripe_subscription_id = COALESCE($5, subscriptions.stripe_subscription_id),
           stripe_customer_id = COALESCE($6, subscriptions.stripe_customer_id),
           current_period_end = $4,
           updated_at = NOW()`,
        [subId, userId, creatorProfileId, expiresAt, stripeSubId, stripeStripeCustomer]
      );

      const txnId = crypto.randomUUID();
      // Atomic: transaction insert + earnings update succeed or fail together.
      // The UNIQUE constraint on transactions(stripe_session_id) prevents double-insert
      // when webhook and session-verify fire concurrently.
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO transactions
             (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
              status, stripe_payment_intent_id, stripe_session_id, stripe_subscription_id, currency)
           VALUES ($1, $2, $3, 'subscription', $4, $5, $6, $7, 'completed', $8, $9, $10, 'usd')`,
          [txnId, userId, creator.user_id, subId, grossAmount, platformFee, creatorEarnings,
           paymentIntentId, sessionId, stripeSubId]
        );
        await client.query(
          'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
          [creatorEarnings, creatorProfileId]
        );
      });

      await markFulfillmentDone(fId, 'subscription', subId);
      console.log('[fulfillment] subscription activated: user=%s → creator=%s amount=%s session=%s',
        userId, creatorProfileId, grossAmount, sessionId);

      // Record engagement signal + platform event (non-fatal)
      recordSignal(userId, creatorProfileId, 'subscribe').catch(() => {});
      logEvent({ userId, eventType: 'subscribe_creator', entityType: 'creator', entityId: creatorProfileId, metadata: { amount: grossAmount } }).catch(() => {});
      invalidateUserCache(userId);
    } catch (err) {
      // Unique violation on transactions(stripe_session_id) means a concurrent fulfillment
      // already committed this transaction. Mark as fulfilled, not failed.
      if (isUniqueViolation(err)) {
        console.log('[fulfillment] subscription: concurrent fulfillment race — transaction already exists, marking fulfilled session=%s', sessionId);
        await execute(`UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      await markFulfillmentFailed(fId, msg);
      throw err;
    }
    return;
  }

  // ── TIP ───────────────────────────────────────────────────────────────────
  if (paymentType === 'tip') {
    if (!creatorProfileId) {
      console.error('[fulfillment] tip: missing creatorProfileId session=%s', sessionId);
      return;
    }

    const { id: fId, alreadyFulfilled, shouldEscalate } = await initFulfillmentRecord(
      sessionId, stripeEventId, userId, creatorProfileId, 'tip'
    );
    if (alreadyFulfilled) {
      console.log('[fulfillment] tip: already fulfilled, skipping session=%s', sessionId);
      return;
    }
    if (shouldEscalate) {
      await markFulfillmentNeedsReview(fId, `Auto-escalated after ${MAX_FULFILLMENT_ATTEMPTS} failed attempts`, sessionId);
      console.error('[fulfillment] tip: auto-escalated to needs_review session=%s', sessionId);
      return;
    }

    try {
      const dup = await queryOne('SELECT id FROM transactions WHERE stripe_session_id = $1', [sessionId]);
      if (dup) {
        await execute(
          `UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]
        );
        return;
      }

      const creator = await queryOne<{ user_id: string }>(
        'SELECT user_id FROM creator_profiles WHERE id = $1', [creatorProfileId]
      );
      if (!creator) {
        await markFulfillmentNeedsReview(fId, `Creator profile not found: ${creatorProfileId}`);
        console.error('[fulfillment] tip: creator profile not found:', creatorProfileId);
        return;
      }

      const grossAmount     = session.amount_total ? session.amount_total / 100 : Number(amountStr ?? 0);
      const platformFee     = Math.round(grossAmount * 0.3 * 100) / 100;
      const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
      const txnId           = crypto.randomUUID();

      // Atomic: transaction insert + earnings update succeed or fail together.
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO transactions
             (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
              status, stripe_payment_intent_id, stripe_session_id, currency)
           VALUES ($1, $2, $3, 'tip', $4, $5, $6, $7, 'completed', $8, $9, 'usd')`,
          [txnId, userId, creator.user_id, paymentIntentId ?? txnId, grossAmount, platformFee,
           creatorEarnings, paymentIntentId, sessionId]
        );
        await client.query(
          'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
          [creatorEarnings, creatorProfileId]
        );
      });

      await markFulfillmentDone(fId, 'tip', txnId);
      console.log('[fulfillment] tip recorded: user=%s → creator=%s amount=%s session=%s',
        userId, creatorProfileId, grossAmount, sessionId);

      recordSignal(userId, creatorProfileId, 'tip').catch(() => {});
      logEvent({ userId, eventType: 'send_tip', entityType: 'creator', entityId: creatorProfileId, metadata: { amount: grossAmount } }).catch(() => {});
    } catch (err) {
      // Unique violation means concurrent fulfillment already committed this tip.
      if (isUniqueViolation(err)) {
        console.log('[fulfillment] tip: concurrent fulfillment race — transaction already exists, marking fulfilled session=%s', sessionId);
        await execute(`UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      await markFulfillmentFailed(fId, msg);
      throw err;
    }
    return;
  }

  // ── LIVE TICKET ───────────────────────────────────────────────────────────
  if (paymentType === 'live_ticket') {
    const liveRoomId = meta.live_room_id ?? null;
    if (!liveRoomId || !creatorProfileId) {
      console.error('[fulfillment] live_ticket: missing live_room_id or creatorProfileId session=%s', sessionId);
      return;
    }

    const { id: fId, alreadyFulfilled, shouldEscalate } = await initFulfillmentRecord(
      sessionId, stripeEventId, userId, creatorProfileId, 'live_ticket'
    );
    if (alreadyFulfilled) return;
    if (shouldEscalate) {
      await markFulfillmentNeedsReview(fId, `Auto-escalated after ${MAX_FULFILLMENT_ATTEMPTS} failed attempts`, sessionId);
      return;
    }

    try {
      const dup = await queryOne('SELECT id FROM transactions WHERE stripe_session_id = $1', [sessionId]);
      if (dup) {
        await execute(`UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]);
        return;
      }

      const creator = await queryOne<{ user_id: string }>(
        'SELECT user_id FROM creator_profiles WHERE id = $1', [creatorProfileId]
      );
      if (!creator) {
        await markFulfillmentNeedsReview(fId, `Creator profile not found: ${creatorProfileId}`);
        return;
      }

      const grossAmount     = session.amount_total ? session.amount_total / 100 : Number(amountStr ?? 0);
      const platformFee     = Math.round(grossAmount * 0.3 * 100) / 100;
      const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
      const txnId           = crypto.randomUUID();
      const amountCents     = Math.round(grossAmount * 100);

      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO transactions
             (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
              status, stripe_payment_intent_id, stripe_session_id, currency)
           VALUES ($1, $2, $3, 'custom_request', $4, $5, $6, $7, 'completed', $8, $9, 'usd')`,
          [txnId, userId, creator.user_id, liveRoomId, grossAmount, platformFee, creatorEarnings,
           paymentIntentId, sessionId]
        );
        await client.query(
          `INSERT INTO live_access_purchases (id, live_room_id, user_id, stripe_session_id, amount_cents, status)
           VALUES ($1, $2, $3, $4, $5, 'active')
           ON CONFLICT (live_room_id, user_id)
           DO UPDATE SET status = 'active', stripe_session_id = $4, amount_cents = $5`,
          [crypto.randomUUID(), liveRoomId, userId, sessionId, amountCents]
        );
        await client.query(
          'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
          [creatorEarnings, creatorProfileId]
        );
      });

      await markFulfillmentDone(fId, 'live_ticket', liveRoomId);
      console.log('[fulfillment] live_ticket activated: user=%s room=%s amount=%s session=%s',
        userId, liveRoomId, grossAmount, sessionId);
    } catch (err) {
      if (isUniqueViolation(err)) {
        await execute(`UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      await markFulfillmentFailed(fId, msg);
      throw err;
    }
    return;
  }

  // ── LIVE TIP ──────────────────────────────────────────────────────────────
  if (paymentType === 'live_tip') {
    const liveRoomId = meta.live_room_id ?? null;
    if (!creatorProfileId) {
      console.error('[fulfillment] live_tip: missing creatorProfileId session=%s', sessionId);
      return;
    }

    const { id: fId, alreadyFulfilled, shouldEscalate } = await initFulfillmentRecord(
      sessionId, stripeEventId, userId, creatorProfileId, 'live_tip'
    );
    if (alreadyFulfilled) return;
    if (shouldEscalate) {
      await markFulfillmentNeedsReview(fId, `Auto-escalated after ${MAX_FULFILLMENT_ATTEMPTS} failed attempts`, sessionId);
      return;
    }

    try {
      const dup = await queryOne('SELECT id FROM transactions WHERE stripe_session_id = $1', [sessionId]);
      if (dup) {
        await execute(`UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]);
        return;
      }

      const creator = await queryOne<{ user_id: string }>(
        'SELECT user_id FROM creator_profiles WHERE id = $1', [creatorProfileId]
      );
      if (!creator) {
        await markFulfillmentNeedsReview(fId, `Creator profile not found: ${creatorProfileId}`);
        return;
      }

      const grossAmount     = session.amount_total ? session.amount_total / 100 : Number(amountStr ?? 0);
      const platformFee     = Math.round(grossAmount * 0.3 * 100) / 100;
      const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
      const txnId           = crypto.randomUUID();
      const tipId           = crypto.randomUUID();
      const amountCents     = Math.round(grossAmount * 100);

      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO transactions
             (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
              status, stripe_payment_intent_id, stripe_session_id, currency)
           VALUES ($1, $2, $3, 'tip', $4, $5, $6, $7, 'completed', $8, $9, 'usd')`,
          [txnId, userId, creator.user_id, paymentIntentId ?? txnId, grossAmount, platformFee,
           creatorEarnings, paymentIntentId, sessionId]
        );
        if (liveRoomId) {
          const user = await client.query<{ display_name: string }>(
            'SELECT display_name FROM users WHERE id = $1', [userId]
          );
          // Respect gift privacy setting stored in session metadata
          const tipPrivacy  = meta.tip_privacy ?? 'public';
          const displayName = tipPrivacy === 'public'
            ? (user.rows[0]?.display_name ?? 'Member')
            : 'Private Patron';
          const tipGiftType = meta.tip_gift_type ?? null;

          await client.query(
            `INSERT INTO live_tips
               (id, live_room_id, tipper_id, creator_id, transaction_id, amount_cents,
                stripe_session_id, display_name, privacy, gift_type, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed')`,
            [tipId, liveRoomId, userId, creatorProfileId, txnId, amountCents,
             sessionId, displayName, tipPrivacy, tipGiftType]
          );
        }
        await client.query(
          'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
          [creatorEarnings, creatorProfileId]
        );
      });

      await markFulfillmentDone(fId, 'live_tip', txnId);
      console.log('[fulfillment] live_tip recorded: user=%s → creator=%s amount=%s session=%s',
        userId, creatorProfileId, grossAmount, sessionId);

      recordSignal(userId, creatorProfileId, 'tip').catch(() => {});
    } catch (err) {
      if (isUniqueViolation(err)) {
        await execute(`UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      await markFulfillmentFailed(fId, msg);
      throw err;
    }
    return;
  }

  // ── GOLD PURCHASE ─────────────────────────────────────────────────────────
  if (paymentType === 'gold_purchase') {
    const goldAmount = parseInt(meta.gold_amount ?? '0', 10);
    const usdAmount  = parseFloat(meta.usd_amount ?? '0');

    if (!goldAmount || goldAmount < 1) {
      console.error('[fulfillment] gold_purchase: invalid gold_amount session=%s', sessionId);
      return;
    }

    const { id: fId, alreadyFulfilled, shouldEscalate } = await initFulfillmentRecord(
      sessionId, stripeEventId, userId, null, 'gold_purchase',
    );
    if (alreadyFulfilled) {
      console.log('[fulfillment] gold_purchase: already fulfilled session=%s', sessionId);
      return;
    }
    if (shouldEscalate) {
      await markFulfillmentNeedsReview(fId, `Auto-escalated after ${MAX_FULFILLMENT_ATTEMPTS} failed attempts`, sessionId);
      return;
    }

    try {
      await withTransaction(async (client) => {
        // Ensure account row exists
        await client.query(
          `INSERT INTO gold_accounts (user_id, balance, total_spent, total_gold_purchased, starter_claimed, updated_at)
           VALUES ($1, 0, 0, 0, false, NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [userId],
        );
        // Credit Gold balance
        await client.query(
          `UPDATE gold_accounts
           SET balance = balance + $1, total_gold_purchased = total_gold_purchased + $1, updated_at = NOW()
           WHERE user_id = $2`,
          [goldAmount, userId],
        );
        // Gold ledger entry
        await client.query(
          `INSERT INTO gold_transactions
             (id, user_id, type, gold_amount, usd_amount, stripe_payment_id, note, created_at)
           VALUES ($1, $2, 'purchase', $3, $4, $5, $6, NOW())`,
          [crypto.randomUUID(), userId, goldAmount, usdAmount, paymentIntentId,
           `Purchased ${goldAmount} Gold ($${usdAmount.toFixed(2)})`],
        );
      });

      await markFulfillmentDone(fId, 'gold_purchase', sessionId);
      console.log('[fulfillment] gold_purchase: credited %d Gold to user=%s session=%s',
        goldAmount, userId, sessionId);
    } catch (err) {
      if (isUniqueViolation(err)) {
        await execute(`UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      await markFulfillmentFailed(fId, msg);
      throw err;
    }
    return;
  }

  // ── UNLOCK ────────────────────────────────────────────────────────────────
  if (paymentType === 'unlock') {
    if (!contentId || !creatorProfileId) {
      console.error('[fulfillment] unlock: missing contentId or creatorProfileId session=%s', sessionId);
      return;
    }

    const { id: fId, alreadyFulfilled, shouldEscalate } = await initFulfillmentRecord(
      sessionId, stripeEventId, userId, creatorProfileId, 'unlock'
    );
    if (alreadyFulfilled) {
      console.log('[fulfillment] unlock: already fulfilled, skipping session=%s', sessionId);
      return;
    }
    if (shouldEscalate) {
      await markFulfillmentNeedsReview(fId, `Auto-escalated after ${MAX_FULFILLMENT_ATTEMPTS} failed attempts`, sessionId);
      console.error('[fulfillment] unlock: auto-escalated to needs_review session=%s', sessionId);
      return;
    }

    try {
      const creatorUserId = creatorUserIdFromMeta ?? (
        (await queryOne<{ user_id: string }>(
          'SELECT user_id FROM creator_profiles WHERE id = $1', [creatorProfileId]
        ))?.user_id ?? null
      );
      if (!creatorUserId) {
        await markFulfillmentNeedsReview(fId, `Could not resolve creator user_id for profile: ${creatorProfileId}`);
        console.error('[fulfillment] unlock: could not resolve creator user_id session=%s', sessionId);
        return;
      }

      const existingBySession = await queryOne(
        'SELECT id FROM transactions WHERE stripe_session_id = $1', [sessionId]
      );
      if (existingBySession) {
        await execute(
          `UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]
        );
        return;
      }

      const existingUnlock = await queryOne(
        'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
        [userId, contentId]
      );
      if (existingUnlock) {
        await execute(
          `UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]
        );
        return;
      }

      const grossAmount     = amountStr
        ? Number(amountStr)
        : (session.amount_total ? session.amount_total / 100 : 0);
      const platformFee     = Math.round(grossAmount * 0.3 * 100) / 100;
      const creatorEarnings = Math.round((grossAmount - platformFee) * 100) / 100;
      const txnId           = crypto.randomUUID();
      const unlockId        = crypto.randomUUID();

      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO transactions
             (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
              status, stripe_payment_intent_id, stripe_session_id, currency)
           VALUES ($1, $2, $3, 'content', $4, $5, $6, $7, 'completed', $8, $9, 'usd')`,
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

      await markFulfillmentDone(fId, 'content', contentId);
      console.log('[fulfillment] unlock complete: user=%s content=%s amount=%s session=%s',
        userId, contentId, grossAmount, sessionId);

      // Record engagement signal + platform event (non-fatal)
      recordSignal(userId, creatorProfileId, 'unlock').catch(() => {});
      logEvent({ userId, eventType: 'unlock_content', entityType: 'content', entityId: contentId, metadata: { amount: grossAmount, creator_id: creatorProfileId } }).catch(() => {});
      invalidateUserCache(userId);

      const content = await queryOne<{ title: string }>('SELECT title FROM content WHERE id = $1', [contentId]);
      if (content) {
        triggerPurchaseConfirmation(userId, content.title, contentId).catch(console.error);
      }
    } catch (err) {
      // Unique violation on transactions(stripe_session_id) or content_unlocks(user_id, content_id)
      // means a concurrent fulfillment already committed. Verify the unlock exists and mark done.
      if (isUniqueViolation(err)) {
        const existingNow = await queryOne(
          'SELECT id FROM content_unlocks WHERE user_id = $1 AND content_id = $2',
          [userId, contentId]
        );
        if (existingNow) {
          console.log('[fulfillment] unlock: concurrent fulfillment race — unlock already exists, marking fulfilled session=%s', sessionId);
          await execute(`UPDATE fulfillment_records SET status = 'fulfilled', updated_at = NOW() WHERE id = $1`, [fId]);
          return;
        }
      }
      const msg = err instanceof Error ? err.message : String(err);
      await markFulfillmentFailed(fId, msg);
      throw err;
    }
  }
}
