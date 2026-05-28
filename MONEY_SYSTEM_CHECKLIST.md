# Archangels Club — Money System Checklist

## Source of truth principle
- **Stripe** is source of truth for payment events
- **App DB** is source of truth for access grants after verified fulfillment
- Reconciliation tool (`npm run reconcile:payments`) bridges any gap between the two

---

## How to test subscription purchase

1. Log in as a fan account
2. Visit a creator's profile page
3. Click Subscribe → complete Stripe Checkout with a test card (`4242 4242 4242 4242`)
4. Verify webhook fires: check Railway logs for `[webhook] received: checkout.session.completed`
5. Verify fulfillment: check Railway logs for `[fulfillment] subscription activated`
6. Check DB: `SELECT * FROM subscriptions WHERE subscriber_id = '<fan_id>';`
7. Log out, log back in → subscription must still appear on MemberDashboard

---

## How to test unlock purchase

1. Log in as a fan account
2. Visit locked content on a creator's page
3. Click Unlock → complete Stripe Checkout
4. Verify `[fulfillment] unlock complete` in Railway logs
5. Check DB: `SELECT * FROM content_unlocks WHERE user_id = '<fan_id>';`
6. Hard refresh the content page → content must be accessible

---

## How to test logout/login persistence

1. Purchase a subscription as fan (see above)
2. Log out completely
3. Log back in
4. Navigate to MemberDashboard → subscription must appear
5. Navigate to subscribed creator's profile → subscriber-only content must be accessible
6. Verify via API: `curl -H "Authorization: Bearer <token>" https://www.archangelsclub.com/api/members/my/subscriptions`

---

## How to test webhook retry

1. In Stripe Dashboard → Webhooks → select your endpoint
2. Find a recent `checkout.session.completed` event
3. Click **Resend**
4. Check Railway logs for `[webhook] received: checkout.session.completed`
5. Check logs for `[webhook] skipped_duplicate` in payment_events
6. Verify DB shows NO duplicate transaction or subscription

---

## How to run reconciliation

```bash
# Dry run — shows what's missing without fixing anything
cd server
npm run reconcile:payments -- --dry-run

# Repair mode — fixes missing transactions and fulfillment records
npm run reconcile:payments -- --repair

# Limit to 50 most recent sessions
npm run reconcile:payments -- --repair --limit 50
```

Against production DB:
```bash
DATABASE_URL="<production_url>" STRIPE_SECRET_KEY="sk_live_..." \
  npm run reconcile:payments -- --dry-run
```

---

## How to verify no duplicate transactions

```sql
-- Check for duplicate stripe_session_id in transactions
SELECT stripe_session_id, COUNT(*) as n
FROM transactions
WHERE stripe_session_id IS NOT NULL
GROUP BY stripe_session_id
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Check fulfillment records for multiple fulfilled entries per session
SELECT stripe_session_id, COUNT(*) as n
FROM fulfillment_records
GROUP BY stripe_session_id
HAVING COUNT(*) > 1;
-- Should return 0 rows (UNIQUE constraint enforces this)
```

---

## How to handle a refund

1. Issue refund in Stripe Dashboard (or via API)
2. Stripe fires `charge.refunded` webhook
3. Webhook handler marks original transaction as `status='refunded'`
4. A reversal transaction is created in DB (preserves original for audit)
5. **If subscription**: cancel subscription in Stripe Dashboard; `customer.subscription.deleted` fires → DB sub set to `cancelled`
6. Verify in admin money-health: `GET /api/admin/money-health` shows refundedTransactions count

---

## How to handle a chargeback

1. Stripe fires `charge.dispute.created` webhook
2. Webhook handler marks matching transaction as `status='disputed'`
3. Respond to dispute in Stripe Dashboard
4. If dispute lost: Stripe fires `charge.dispute.funds_withdrawn` (not yet handled — flag manually)
5. If dispute won: Stripe fires `charge.dispute.funds_reinstated`

---

## How to repair a missing fulfillment

Option A — Reconciliation tool (automated):
```bash
npm run reconcile:payments -- --repair
```

Option B — Admin endpoint (if session ID is known):
```bash
curl -X GET https://www.archangelsclub.com/api/checkout/session/<session_id> \
  -H "Authorization: Bearer <admin_jwt>"
# The verify-session endpoint calls fulfillCheckoutSession() — idempotent
```

Option C — Manual DB repair (last resort):
```sql
-- Create subscription record manually
INSERT INTO subscriptions (id, subscriber_id, creator_id, status, expires_at, stripe_subscription_id)
VALUES ('<uuid>', '<user_id>', '<creator_profile_id>', 'active',
        NOW() + INTERVAL '30 days', '<stripe_sub_id>');
-- Then update fulfillment_record
UPDATE fulfillment_records SET status = 'fulfilled' WHERE stripe_session_id = '<session_id>';
```

---

## Admin money health dashboard

```bash
curl -H "Authorization: Bearer <admin_jwt>" \
  https://www.archangelsclub.com/api/admin/money-health
```

Returns:
- `summary.successfulPayments` — completed transactions
- `summary.failedFulfillments` — fulfillment_records with status=failed
- `summary.needsReviewFulfillments` — needs human review
- `summary.webhookFailures` — payment_events with status=failed
- `summary.webhookDuplicatesPrevented` — duplicate events blocked
- `summary.activeSubscriptions` — currently valid
- `summary.refundedTransactions` — refunds issued
- `summary.disputedTransactions` — chargebacks
- `summary.totalVolume` / `totalPlatformFee` / `totalCreatorNet`
- `recentWebhookFailures` — last 20 failed events with error messages
- `recentFulfillmentIssues` — last 20 failed/needs_review fulfillments

---

## Subscription renewal verification

Stripe fires `invoice.paid` with `billing_reason: 'subscription_cycle'` each renewal.

Verify handler works:
1. In Stripe Dashboard, find a subscription → Billing → Invoices
2. Click on a paid invoice → check Events tab for webhook delivery
3. In Railway logs: `[webhook] invoice.paid: renewal extended sub=<id> to <date>`
4. In DB: `SELECT expires_at, current_period_end FROM subscriptions WHERE stripe_subscription_id = '<id>';`
   — should match Stripe's `current_period_end`

---

## Remaining financial risks (as of 2026-05-10)

| Risk | Status | Mitigation |
|------|--------|-----------|
| Subscription renewal not handled | FIXED — invoice.paid handler implemented | Verify on first renewal (June 2026) |
| Mark-before-fulfill race | FIXED — payment_events updated AFTER fulfillment | |
| No dispute resolution logic | Partial — transaction marked disputed; no auto-cancel | Handle manually in Stripe Dashboard |
| funds_withdrawn / funds_reinstated events | Not handled | Monitor manually |
| Subscription cancel_at_period_end not surfaced to fan UI | Not implemented | Fan sees status=cancelled but still has access |
| Creator payout (Stripe Connect) | Partial — Connect account fields exist | Payout flow not implemented end-to-end |
