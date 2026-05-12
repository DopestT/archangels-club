import { Router } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { queryOne, execute, withTransaction, query } from '../db/schema.js';
import { fulfillCheckoutSession } from '../services/fulfillment.js';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

/** Extract safe, non-secret summary fields from a Stripe event object. */
function buildRawSummary(event: Stripe.Event): Record<string, unknown> {
  const obj = event.data.object as unknown as Record<string, unknown>;
  const safe: Record<string, unknown> = { id: obj['id'], object: obj['object'] };
  for (const k of ['status','amount','amount_paid','amount_due','currency',
                   'billing_reason','collection_method','customer_email']) {
    if (obj[k] !== undefined) safe[k] = obj[k];
  }
  return safe;
}

/** Upsert a payment_events row. Returns the row id. */
async function recordEvent(
  event: Stripe.Event,
  fields: {
    stripeObjectId?: string | null;
    stripeCustomerId?: string | null;
    stripeSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeInvoiceId?: string | null;
    userId?: string | null;
    creatorId?: string | null;
    amountCents?: number | null;
    currency?: string | null;
  }
): Promise<{ id: string; isDuplicate: boolean }> {
  const rowId = crypto.randomUUID();
  const summary = buildRawSummary(event);

  const result = await queryOne<{ id: string; processing_status: string }>(
    `INSERT INTO payment_events
       (id, stripe_event_id, event_type, stripe_object_id, stripe_customer_id,
        stripe_session_id, stripe_payment_intent_id, stripe_subscription_id,
        stripe_invoice_id, user_id, creator_id, amount_cents, currency, raw_summary,
        processing_status, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'received', NOW())
     ON CONFLICT (stripe_event_id) DO UPDATE SET processing_status = 'skipped_duplicate'
     RETURNING id, processing_status`,
    [
      rowId, event.id, event.type,
      fields.stripeObjectId ?? null,
      fields.stripeCustomerId ?? null,
      fields.stripeSessionId ?? null,
      fields.stripePaymentIntentId ?? null,
      fields.stripeSubscriptionId ?? null,
      fields.stripeInvoiceId ?? null,
      fields.userId ?? null,
      fields.creatorId ?? null,
      fields.amountCents ?? null,
      fields.currency ?? 'usd',
      JSON.stringify(summary),
    ]
  );

  const id = result!.id;
  const isDuplicate = result!.processing_status === 'skipped_duplicate';
  return { id, isDuplicate };
}

async function markEventProcessed(eventRowId: string): Promise<void> {
  await execute(
    `UPDATE payment_events SET processing_status = 'processed', processed_at = NOW() WHERE id = $1`,
    [eventRowId]
  );
}

async function markEventFailed(eventRowId: string, error: string): Promise<void> {
  await execute(
    `UPDATE payment_events SET processing_status = 'failed', error_message = $1, processed_at = NOW() WHERE id = $2`,
    [error.slice(0, 2000), eventRowId]
  );
}

// ── Event handlers ───────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<void> {
  const meta = session.metadata ?? {};
  const stripeSubId = typeof session.subscription === 'string' ? session.subscription : null;
  const piId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

  const { id: eventRowId, isDuplicate } = await recordEvent(event, {
    stripeObjectId: session.id,
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
    stripeSessionId: session.id,
    stripePaymentIntentId: piId,
    stripeSubscriptionId: stripeSubId,
    userId: meta.user_id ?? meta.userId ?? null,
    creatorId: meta.creator_id ?? meta.creatorId ?? null,
    amountCents: session.amount_total ?? null,
    currency: session.currency ?? 'usd',
  });
  if (isDuplicate) return;

  try {
    await fulfillCheckoutSession(session, event.id);
    await markEventProcessed(eventRowId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] checkout.session.completed fulfillment failed:', msg);
    await markEventFailed(eventRowId, msg);
  }
}

async function handleSubscriptionUpdated(
  event: Stripe.Event,
  sub: Stripe.Subscription
): Promise<void> {
  const { id: eventRowId, isDuplicate } = await recordEvent(event, {
    stripeObjectId: sub.id,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : null,
    stripeSubscriptionId: sub.id,
    currency: sub.currency ?? 'usd',
  });
  if (isDuplicate) return;

  try {
    // current_period_end/start moved to SubscriptionItem in SDK v22 but still returned by API
    const subAny = sub as any;
    const periodEnd = subAny.current_period_end
      ? new Date(subAny.current_period_end * 1000).toISOString()
      : ((sub.items?.data?.[0] as any)?.current_period_end
          ? new Date((sub.items.data[0] as any).current_period_end * 1000).toISOString()
          : null);
    const periodStart = subAny.current_period_start
      ? new Date(subAny.current_period_start * 1000).toISOString()
      : ((sub.items?.data?.[0] as any)?.current_period_start
          ? new Date((sub.items.data[0] as any).current_period_start * 1000).toISOString()
          : null);

    const stripeStatus = sub.status; // active, past_due, canceled, unpaid, etc.
    const cancelAtEnd = sub.cancel_at_period_end ?? false;
    const customerId = typeof sub.customer === 'string' ? sub.customer : null;

    let appStatus: string;
    if (stripeStatus === 'active' || stripeStatus === 'trialing') {
      appStatus = 'active';
    } else if (stripeStatus === 'canceled') {
      appStatus = 'cancelled';
    } else {
      appStatus = 'active'; // keep active for past_due — still has access while Stripe retries
    }

    await execute(
      `UPDATE subscriptions
         SET status = $1,
             cancel_at_period_end = $2,
             stripe_customer_id = COALESCE($3, stripe_customer_id),
             current_period_start = COALESCE($4, current_period_start),
             current_period_end = COALESCE($5, current_period_end),
             expires_at = COALESCE($5, expires_at),
             updated_at = NOW()
       WHERE stripe_subscription_id = $6`,
      [appStatus, cancelAtEnd, customerId, periodStart, periodEnd, sub.id]
    );

    console.log('[webhook] subscription updated: stripe_sub=%s status=%s period_end=%s',
      sub.id, appStatus, periodEnd);
    await markEventProcessed(eventRowId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markEventFailed(eventRowId, msg);
    throw err;
  }
}

async function handleSubscriptionDeleted(
  event: Stripe.Event,
  sub: Stripe.Subscription
): Promise<void> {
  const { id: eventRowId, isDuplicate } = await recordEvent(event, {
    stripeObjectId: sub.id,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : null,
    stripeSubscriptionId: sub.id,
  });
  if (isDuplicate) return;

  try {
    await execute(
      `UPDATE subscriptions
         SET status = 'cancelled', cancel_at_period_end = false, updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [sub.id]
    );
    console.log('[webhook] subscription deleted/cancelled: stripe_sub=%s', sub.id);
    await markEventProcessed(eventRowId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markEventFailed(eventRowId, msg);
    throw err;
  }
}

async function handleInvoicePaid(
  event: Stripe.Event,
  invoice: Stripe.Invoice
): Promise<void> {
  const invoiceAny = invoice as any;
  // SDK v22: subscription moved to invoice.parent.subscription_details.subscription
  const stripeSubId: string | null =
    (typeof invoiceAny.subscription === 'string' ? invoiceAny.subscription : null) ??
    (typeof invoice.parent?.subscription_details?.subscription === 'string'
      ? invoice.parent.subscription_details.subscription : null);
  const piId: string | null = typeof invoiceAny.payment_intent === 'string' ? invoiceAny.payment_intent : null;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;

  const { id: eventRowId, isDuplicate } = await recordEvent(event, {
    stripeObjectId: invoice.id,
    stripeCustomerId: customerId,
    stripePaymentIntentId: piId,
    stripeSubscriptionId: stripeSubId,
    stripeInvoiceId: invoice.id,
    amountCents: invoice.amount_paid ?? null,
    currency: invoice.currency ?? 'usd',
  });
  if (isDuplicate) return;

  try {
    // Only act on subscription renewals — initial checkout is handled by checkout.session.completed
    if (!stripeSubId || invoice.billing_reason !== 'subscription_cycle') {
      console.log('[webhook] invoice.paid: not a renewal cycle, skipping fulfillment (%s)', invoice.billing_reason);
      await markEventProcessed(eventRowId);
      return;
    }

    // Find our subscription record
    const sub = await queryOne<{
      id: string; subscriber_id: string; creator_id: string; stripe_subscription_id: string;
    }>(
      'SELECT id, subscriber_id, creator_id, stripe_subscription_id FROM subscriptions WHERE stripe_subscription_id = $1',
      [stripeSubId]
    );
    if (!sub) {
      console.warn('[webhook] invoice.paid: no subscription found for stripe_sub=%s — needs review', stripeSubId);
      await markEventFailed(eventRowId, `No subscription record for stripe_subscription_id=${stripeSubId}`);
      return;
    }

    // Get period end from invoice line items
    const lineItem = invoice.lines?.data?.[0];
    const newExpiresAt = lineItem?.period?.end
      ? new Date(lineItem.period.end * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const periodStart = lineItem?.period?.start
      ? new Date(lineItem.period.start * 1000).toISOString()
      : null;

    // Check for duplicate renewal transaction
    const dupTxn = await queryOne('SELECT id FROM transactions WHERE stripe_invoice_id = $1', [invoice.id]);
    if (!dupTxn) {
      const creator = await queryOne<{ user_id: string }>(
        'SELECT user_id FROM creator_profiles WHERE id = $1', [sub.creator_id]
      );
      if (creator) {
        const grossAmount = (invoice.amount_paid ?? 0) / 100;
        const platformFee = Math.round(grossAmount * 0.2 * 100) / 100;
        const netAmount = Math.round((grossAmount - platformFee) * 100) / 100;

        await execute(
          `INSERT INTO transactions
             (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
              status, stripe_payment_intent_id, stripe_invoice_id, stripe_subscription_id, currency)
           VALUES ($1, $2, $3, 'subscription', $4, $5, $6, $7, 'completed', $8, $9, $10, $11)`,
          [crypto.randomUUID(), sub.subscriber_id, creator.user_id, sub.id,
           grossAmount, platformFee, netAmount, piId, invoice.id, stripeSubId,
           invoice.currency ?? 'usd']
        );
        await execute(
          'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
          [netAmount, sub.creator_id]
        );
      }
    }

    // Extend subscription
    await execute(
      `UPDATE subscriptions
         SET status = 'active',
             expires_at = $1,
             current_period_start = COALESCE($2, current_period_start),
             current_period_end = $1,
             updated_at = NOW()
       WHERE stripe_subscription_id = $3`,
      [newExpiresAt, periodStart, stripeSubId]
    );

    console.log('[webhook] invoice.paid: renewal extended sub=%s to %s', sub.id, newExpiresAt);
    await markEventProcessed(eventRowId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markEventFailed(eventRowId, msg);
    throw err;
  }
}

async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  invoice: Stripe.Invoice
): Promise<void> {
  const invoiceAny = invoice as any;
  const stripeSubId: string | null =
    (typeof invoiceAny.subscription === 'string' ? invoiceAny.subscription : null) ??
    (typeof invoice.parent?.subscription_details?.subscription === 'string'
      ? invoice.parent.subscription_details.subscription : null);

  const { id: eventRowId, isDuplicate } = await recordEvent(event, {
    stripeObjectId: invoice.id,
    stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : null,
    stripeSubscriptionId: stripeSubId,
    stripeInvoiceId: invoice.id,
    amountCents: invoice.amount_due ?? null,
    currency: invoice.currency ?? 'usd',
  });
  if (isDuplicate) return;

  // We don't immediately expire the subscription — Stripe will retry and will fire
  // customer.subscription.updated with status=past_due, then eventually canceled.
  console.log('[webhook] invoice.payment_failed: stripe_sub=%s invoice=%s — Stripe will retry',
    stripeSubId, invoice.id);
  await markEventProcessed(eventRowId);
}

async function handleChargeRefunded(
  event: Stripe.Event,
  charge: Stripe.Charge
): Promise<void> {
  const { id: eventRowId, isDuplicate } = await recordEvent(event, {
    stripeObjectId: charge.id,
    stripeCustomerId: typeof charge.customer === 'string' ? charge.customer : null,
    stripePaymentIntentId: typeof charge.payment_intent === 'string' ? charge.payment_intent : null,
    amountCents: charge.amount_refunded ?? null,
    currency: charge.currency ?? 'usd',
  });
  if (isDuplicate) return;

  try {
    const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
    if (piId) {
      // Find original transaction
      const origTxn = await queryOne<{
        id: string; payer_id: string; payee_id: string; ref_type: string; ref_id: string; amount: string;
      }>(
        'SELECT id, payer_id, payee_id, ref_type, ref_id, amount FROM transactions WHERE stripe_payment_intent_id = $1 LIMIT 1',
        [piId]
      );
      if (origTxn) {
        // Mark original as refunded
        await execute(
          `UPDATE transactions SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
          [origTxn.id]
        );
        // Create reversal record
        const refundAmount = (charge.amount_refunded ?? 0) / 100;
        if (refundAmount > 0) {
          await execute(
            `INSERT INTO transactions
               (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
                status, stripe_payment_intent_id, currency)
             VALUES ($1, $2, $3, $4, $5, $6, 0, $6, 'refunded', $7, $8)`,
            [crypto.randomUUID(), origTxn.payee_id, origTxn.payer_id,
             origTxn.ref_type, origTxn.ref_id, refundAmount, piId,
             charge.currency ?? 'usd']
          );
        }
        console.log('[webhook] charge.refunded: original txn=%s refund_amount=%s', origTxn.id, refundAmount);
      }
    }
    await markEventProcessed(eventRowId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markEventFailed(eventRowId, msg);
    throw err;
  }
}

async function handleDisputeCreated(
  event: Stripe.Event,
  dispute: Stripe.Dispute
): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : null;

  const { id: eventRowId, isDuplicate } = await recordEvent(event, {
    stripeObjectId: dispute.id,
    stripePaymentIntentId: typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null,
    amountCents: dispute.amount ?? null,
    currency: dispute.currency ?? 'usd',
  });
  if (isDuplicate) return;

  try {
    if (dispute.payment_intent && typeof dispute.payment_intent === 'string') {
      await execute(
        `UPDATE transactions SET status = 'disputed', updated_at = NOW()
         WHERE stripe_payment_intent_id = $1`,
        [dispute.payment_intent]
      );
    }
    console.log('[webhook] charge.dispute.created: dispute=%s charge=%s amount=%s',
      dispute.id, chargeId, dispute.amount);
    await markEventProcessed(eventRowId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markEventFailed(eventRowId, msg);
    throw err;
  }
}

// ── Main webhook route ───────────────────────────────────────────────────────

router.post('/stripe', async (req, res) => {
  const sig    = req.headers['stripe-signature'] as string | undefined;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (secret && sig) {
    try {
      event = getStripe().webhooks.constructEvent(req.body, sig, secret);
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

  console.log('[webhook] received: %s %s', event.type, event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event, event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event, event.data.object as Stripe.Invoice);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event, event.data.object as Stripe.Charge);
        break;

      case 'charge.dispute.created':
        await handleDisputeCreated(event, event.data.object as Stripe.Dispute);
        break;

      default:
        // Record unknown events for observability but don't process
        await recordEvent(event, { stripeObjectId: (event.data.object as any)?.id ?? null });
        console.log('[webhook] unhandled event type (recorded): %s', event.type);
        break;
    }
  } catch (err) {
    // Handler already recorded failure in payment_events.
    // Return 200 so Stripe does not retry endlessly for our own logic failures.
    console.error('[webhook] handler threw, event recorded as failed:', event.type, event.id, err);
  }

  res.json({ received: true });
});

export default router;
