/**
 * Payment reconciliation tool.
 *
 * Usage:
 *   npm run reconcile:payments -- --dry-run
 *   npm run reconcile:payments -- --repair
 *   npm run reconcile:payments -- --repair --limit 50
 *
 * What it does:
 * 1. Pulls recent Stripe checkout sessions (last 90 days, limit configurable)
 * 2. For each paid session: checks DB for transaction + fulfillment_record
 * 3. Pulls active Stripe subscriptions: checks DB for subscription record
 * 4. Reports gaps and repairs them if --repair is passed
 */

import Stripe from 'stripe';
import { pool, queryOne, execute } from '../db/client.js';
import { fulfillCheckoutSession } from '../services/fulfillment.js';

// ── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--repair');
const LIMIT   = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? parseInt(args[i + 1] ?? '100', 10) : 100;
})();

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('ERROR: STRIPE_SECRET_KEY not set. Export it or use --env-file.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Export it or use --env-file.');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── Report accumulator ───────────────────────────────────────────────────────

interface ReportItem {
  type: 'ok' | 'missing_transaction' | 'missing_subscription' | 'missing_fulfillment' |
        'repaired' | 'repair_failed' | 'skipped_unknown_type';
  sessionId?: string;
  subscriptionId?: string;
  detail: string;
}

const report: ReportItem[] = [];

function log(item: ReportItem): void {
  report.push(item);
  const icon = {
    ok: '✓',
    missing_transaction: '✗',
    missing_subscription: '✗',
    missing_fulfillment: '!',
    repaired: '→',
    repair_failed: '✗✗',
    skipped_unknown_type: '?',
  }[item.type];
  console.log(`${icon} [${item.type}] ${item.detail}`);
}

// ── Stripe helpers ───────────────────────────────────────────────────────────

async function* listCheckoutSessions(limit: number): AsyncGenerator<Stripe.Checkout.Session> {
  let count = 0;
  let page = await stripe.checkout.sessions.list({
    limit: Math.min(limit, 100),
    expand: ['data.line_items'],
  });

  for (const session of page.data) {
    if (count >= limit) return;
    yield session;
    count++;
  }

  while (page.has_more && count < limit) {
    page = await stripe.checkout.sessions.list({
      limit: Math.min(limit - count, 100),
      starting_after: page.data[page.data.length - 1].id,
      expand: ['data.line_items'],
    });
    for (const session of page.data) {
      if (count >= limit) return;
      yield session;
      count++;
    }
  }
}

async function* listSubscriptions(): AsyncGenerator<Stripe.Subscription> {
  let page = await stripe.subscriptions.list({ limit: 100, status: 'all' });

  for (const sub of page.data) yield sub;

  while (page.has_more) {
    page = await stripe.subscriptions.list({
      limit: 100,
      starting_after: page.data[page.data.length - 1].id,
      status: 'all',
    });
    for (const sub of page.data) yield sub;
  }
}

// ── Session reconciliation ───────────────────────────────────────────────────

async function reconcileSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid' && session.status !== 'complete') return;

  const meta = session.metadata ?? {};
  const paymentType = meta.type ?? (meta.content_id ? 'unlock' : null);
  const userId = meta.user_id ?? meta.userId ?? null;

  if (!paymentType || !userId) {
    log({
      type: 'skipped_unknown_type',
      sessionId: session.id,
      detail: `Session ${session.id} — no type/userId in metadata, skipping`,
    });
    return;
  }

  // Check for existing transaction
  const txn = await queryOne('SELECT id FROM transactions WHERE stripe_session_id = $1', [session.id]);
  // Check for fulfillment record
  const fr  = await queryOne<{ status: string }>(
    'SELECT status FROM fulfillment_records WHERE stripe_session_id = $1', [session.id]
  );

  if (txn && fr?.status === 'fulfilled') {
    log({ type: 'ok', sessionId: session.id, detail: `Session ${session.id} (${paymentType}) — OK` });
    return;
  }

  const amount = session.amount_total ? session.amount_total / 100 : 0;
  const missing = !txn ? 'transaction' : 'fulfillment_record';
  log({
    type: txn ? 'missing_fulfillment' : 'missing_transaction',
    sessionId: session.id,
    detail: `Session ${session.id} (${paymentType} $${amount}) — missing ${missing}`,
  });

  if (DRY_RUN) return;

  // Repair: re-run fulfillment (idempotent)
  try {
    await fulfillCheckoutSession(session, null);
    log({
      type: 'repaired',
      sessionId: session.id,
      detail: `Session ${session.id} — re-fulfilled successfully`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log({
      type: 'repair_failed',
      sessionId: session.id,
      detail: `Session ${session.id} — repair failed: ${msg}`,
    });
  }
}

// ── Subscription reconciliation ──────────────────────────────────────────────

async function reconcileSubscription(stripeSub: Stripe.Subscription): Promise<void> {
  const dbSub = await queryOne<{ id: string; status: string; expires_at: string }>(
    'SELECT id, status, expires_at FROM subscriptions WHERE stripe_subscription_id = $1',
    [stripeSub.id]
  );

  const stripeStatus = stripeSub.status;
  const subAny = stripeSub as any;
  const rawPeriodEnd: number | undefined =
    subAny.current_period_end ?? (stripeSub.items?.data?.[0] as any)?.current_period_end;
  const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : null;

  if (dbSub) {
    // Check if period end needs updating
    const dbExpires = dbSub.expires_at ? new Date(dbSub.expires_at).getTime() : 0;
    const stripeExpires = rawPeriodEnd ? rawPeriodEnd * 1000 : 0;
    const periodDriftDays = Math.abs(dbExpires - stripeExpires) / (1000 * 60 * 60 * 24);

    if (periodDriftDays > 1) {
      log({
        type: 'missing_subscription',
        subscriptionId: stripeSub.id,
        detail: `Sub ${stripeSub.id} — period drift ${periodDriftDays.toFixed(1)} days (db: ${dbSub.expires_at}, stripe: ${periodEnd})`,
      });
      if (!DRY_RUN) {
        await execute(
          `UPDATE subscriptions
             SET expires_at = $1, current_period_end = $1, updated_at = NOW()
           WHERE stripe_subscription_id = $2`,
          [periodEnd, stripeSub.id]
        );
        log({ type: 'repaired', subscriptionId: stripeSub.id, detail: `Sub ${stripeSub.id} — period synced` });
      }
    } else {
      log({ type: 'ok', subscriptionId: stripeSub.id, detail: `Sub ${stripeSub.id} — OK (status=${dbSub.status})` });
    }
    return;
  }

  // No DB record at all
  if (stripeStatus === 'canceled') {
    // No need to create a record for a fully canceled subscription with no DB entry
    log({ type: 'ok', subscriptionId: stripeSub.id, detail: `Sub ${stripeSub.id} — canceled in Stripe, no DB record needed` });
    return;
  }

  log({
    type: 'missing_subscription',
    subscriptionId: stripeSub.id,
    detail: `Sub ${stripeSub.id} — active in Stripe but NO DB subscription record. Status: ${stripeStatus}, period_end: ${periodEnd}`,
  });

  if (!DRY_RUN) {
    // We can't fully repair without knowing user_id/creator_id — flag for manual review
    log({
      type: 'repair_failed',
      subscriptionId: stripeSub.id,
      detail: `Sub ${stripeSub.id} — cannot auto-repair (no metadata). Needs manual intervention.`,
    });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n=== Archangels Club Payment Reconciliation ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'REPAIR MODE'}`);
  console.log(`Session limit: ${LIMIT}\n`);

  console.log('── Checkout Sessions ──');
  let sessionCount = 0;
  for await (const session of listCheckoutSessions(LIMIT)) {
    await reconcileSession(session);
    sessionCount++;
  }

  console.log(`\n── Subscriptions ──`);
  let subCount = 0;
  for await (const sub of listSubscriptions()) {
    await reconcileSubscription(sub);
    subCount++;
  }

  // Summary
  const counts = report.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\n=== Reconciliation Summary ===`);
  console.log(`Sessions checked: ${sessionCount}`);
  console.log(`Subscriptions checked: ${subCount}`);
  console.log(`OK: ${counts['ok'] ?? 0}`);
  console.log(`Missing transactions: ${counts['missing_transaction'] ?? 0}`);
  console.log(`Missing subscriptions: ${counts['missing_subscription'] ?? 0}`);
  console.log(`Missing fulfillment records: ${counts['missing_fulfillment'] ?? 0}`);
  console.log(`Repaired: ${counts['repaired'] ?? 0}`);
  console.log(`Repair failed: ${counts['repair_failed'] ?? 0}`);
  console.log(`Skipped (unknown type): ${counts['skipped_unknown_type'] ?? 0}`);
  if (DRY_RUN) {
    console.log(`\nRun with --repair to fix the issues above.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Reconciliation failed:', err);
  pool.end().finally(() => process.exit(1));
});
