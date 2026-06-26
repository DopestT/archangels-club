import { Router } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { query, queryOne, execute, withTransaction } from '../db/schema.js';
import { requireAuth, requireApproved } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const STARTER_GOLD = 250;
const PLATFORM_FEE_RATE = 0.3;
const GOLD_TO_USD = 0.01; // 1 Gold = $0.01 (closed-platform credit, not withdrawable)
const FRONTEND_URL = process.env.FRONTEND_URL ?? process.env.CLIENT_URL ?? 'https://www.archangelsclub.com';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export const GOLD_PACKAGES = [
  { id: 'gold_500',   gold: 500,   price_cents: 499,  label: '500 Gold',    badge: null        },
  { id: 'gold_1100',  gold: 1100,  price_cents: 999,  label: '1,100 Gold',  badge: 'Popular'   },
  { id: 'gold_3000',  gold: 3000,  price_cents: 2499, label: '3,000 Gold',  badge: null        },
  { id: 'gold_6500',  gold: 6500,  price_cents: 4999, label: '6,500 Gold',  badge: 'Best Value'},
  { id: 'gold_14000', gold: 14000, price_cents: 9999, label: '14,000 Gold', badge: null        },
] as const;

async function ensureGoldAccount(userId: string) {
  await execute(
    `INSERT INTO gold_accounts (user_id, balance, total_spent, total_gold_purchased, starter_claimed, updated_at)
     VALUES ($1, 0, 0, 0, false, NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

// GET /balance
router.get('/balance', async (req, res) => {
  try {
    const row = await queryOne<{ balance: number; total_gold_purchased: number; total_spent: number }>(
      'SELECT balance, total_gold_purchased, total_spent FROM gold_accounts WHERE user_id = $1',
      [req.auth!.userId],
    );
    res.json({
      balance: row?.balance ?? 0,
      total_gold_purchased: row?.total_gold_purchased ?? 0,
      total_spent: row?.total_spent ?? 0,
    });
  } catch (err) {
    console.error('GET /gold/balance:', err);
    res.status(500).json({ error: 'Failed to load balance' });
  }
});

// GET /packages
router.get('/packages', (_req, res) => {
  res.json({ packages: GOLD_PACKAGES });
});

// GET /transactions
router.get('/transactions', async (req, res) => {
  try {
    const rows = await query<{
      id: string; type: string; gold_amount: number; usd_amount: string | null; note: string; created_at: string;
    }>(
      `SELECT id, type, gold_amount, usd_amount, note, created_at
         FROM gold_transactions WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 50`,
      [req.auth!.userId],
    );
    res.json({ transactions: rows });
  } catch (err) {
    console.error('GET /gold/transactions:', err);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

// POST /claim-starter — 250 free Gold, once per account
router.post('/claim-starter', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    await ensureGoldAccount(userId);
    const count = await execute(
      `UPDATE gold_accounts
       SET balance = balance + $1, starter_claimed = true, updated_at = NOW()
       WHERE user_id = $2 AND starter_claimed = false`,
      [STARTER_GOLD, userId],
    );
    if (count > 0) {
      await execute(
        `INSERT INTO gold_transactions (id, user_id, type, gold_amount, note, created_at)
         VALUES ($1, $2, 'starter', $3, 'Starter Gold bonus', NOW())`,
        [crypto.randomUUID(), userId, STARTER_GOLD],
      );
    }
    const account = await queryOne<{ balance: number }>(
      'SELECT balance FROM gold_accounts WHERE user_id = $1', [userId],
    );
    res.json({
      balance: account?.balance ?? 0,
      granted: count > 0 ? STARTER_GOLD : 0,
      already_claimed: count === 0,
    });
  } catch (err) {
    console.error('POST /gold/claim-starter:', err);
    res.status(500).json({ error: 'Failed to claim starter Gold' });
  }
});

// POST /checkout — Stripe checkout for a Gold package
router.post('/checkout', requireApproved, async (req, res) => {
  try {
    const { package_id, return_url } = req.body as { package_id?: string; return_url?: string };
    const pkg = GOLD_PACKAGES.find(p => p.id === package_id);
    if (!pkg) { res.status(400).json({ error: 'Invalid Gold package.' }); return; }
    if (req.auth!.role === 'admin') {
      res.status(403).json({ error: 'Admin accounts cannot purchase Gold.' });
      return;
    }

    const stripe = getStripe();
    const userId = req.auth!.userId;
    const base = return_url ?? `${FRONTEND_URL}/dashboard`;
    const successUrl = `${base}${base.includes('?') ? '&' : '?'}gold_added=1&gold_amount=${pkg.gold}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${pkg.label} — Archangels Club Gold`,
            description: 'Closed-platform digital credits for gifts and premium interactions. Not redeemable for cash.',
          },
          unit_amount: pkg.price_cents,
        },
        quantity: 1,
      }],
      metadata: {
        type:       'gold_purchase',
        user_id:    userId,
        package_id: pkg.id,
        gold_amount: String(pkg.gold),
        usd_amount:  (pkg.price_cents / 100).toFixed(2),
      },
      success_url: successUrl,
      cancel_url:  base,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('POST /gold/checkout:', err);
    res.status(500).json({ error: 'Failed to create Gold checkout.' });
  }
});

// POST /live-gift — instant Gold gift in a live room (no Stripe redirect)
router.post('/live-gift', requireApproved, async (req, res) => {
  try {
    const {
      room_id, creator_id, gift_id, gift_name, gold_cost,
      privacy = 'public', message,
    } = req.body as {
      room_id: string; creator_id: string; gift_id: string; gift_name: string;
      gold_cost: number; privacy?: 'public' | 'private' | 'ghost'; message?: string;
    };

    if (!room_id || !creator_id || !gift_id || !gift_name || !(gold_cost > 0)) {
      res.status(400).json({ error: 'Missing required fields.' });
      return;
    }

    const userId = req.auth!.userId;
    const creator = await queryOne<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM creator_profiles WHERE id = $1', [creator_id],
    );
    if (!creator) { res.status(404).json({ error: 'Creator not found.' }); return; }
    if (creator.user_id === userId) { res.status(403).json({ error: 'Cannot gift yourself.' }); return; }

    await ensureGoldAccount(userId);

    // Atomic deduction — zero-row update means insufficient balance
    const deducted = await execute(
      `UPDATE gold_accounts
       SET balance = balance - $1, total_spent = total_spent + $1, updated_at = NOW()
       WHERE user_id = $2 AND balance >= $1`,
      [gold_cost, userId],
    );
    if (deducted === 0) {
      res.status(402).json({ error: 'Not enough Gold.', code: 'insufficient_gold' });
      return;
    }

    // USD accounting (1 Gold = $0.01)
    const usdAmount       = Math.round(gold_cost * GOLD_TO_USD * 100) / 100;
    const platformFee     = Math.round(usdAmount * PLATFORM_FEE_RATE * 100) / 100;
    const creatorEarnings = Math.round((usdAmount - platformFee) * 100) / 100;

    const userRow = await queryOne<{ display_name: string }>(
      'SELECT display_name FROM users WHERE id = $1', [userId],
    );
    const displayName = privacy === 'public'
      ? (userRow?.display_name ?? 'Member')
      : privacy === 'private' ? 'Private Patron' : 'Anonymous';

    const txnId    = crypto.randomUUID();
    const tipId    = crypto.randomUUID();
    const goldTxId = crypto.randomUUID();

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO transactions
           (id, payer_id, payee_id, ref_type, ref_id, amount, platform_fee, net_amount,
            status, stripe_payment_intent_id, stripe_session_id, currency)
         VALUES ($1, $2, $3, 'tip', $4, $5, $6, $7, 'completed', NULL, NULL, 'usd')`,
        [txnId, userId, creator.user_id, tipId, usdAmount, platformFee, creatorEarnings],
      );
      // amount_cents = gold_cost so patron level thresholds stay accurate
      await client.query(
        `INSERT INTO live_tips
           (id, live_room_id, tipper_id, creator_id, transaction_id, amount_cents,
            stripe_session_id, display_name, message, privacy, gift_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, 'completed')`,
        [tipId, room_id, userId, creator_id, txnId, gold_cost,
         displayName, message ?? null, privacy, gift_id],
      );
      await client.query(
        `INSERT INTO gold_transactions
           (id, user_id, type, gold_amount, usd_amount, creator_id, room_id, gift_id, note, created_at)
         VALUES ($1, $2, 'gift', $3, $4, $5, $6, $7, $8, NOW())`,
        [goldTxId, userId, gold_cost, usdAmount, creator_id, room_id, gift_id,
         `${gift_name} sent in live room`],
      );
      await client.query(
        'UPDATE creator_profiles SET total_earnings = total_earnings + $1 WHERE id = $2',
        [creatorEarnings, creator_id],
      );
    });

    const account = await queryOne<{ balance: number }>(
      'SELECT balance FROM gold_accounts WHERE user_id = $1', [userId],
    );
    res.json({
      success: true,
      new_balance: account?.balance ?? 0,
      gift_id, gift_name, display_name: displayName, privacy,
    });
  } catch (err) {
    console.error('POST /gold/live-gift:', err);
    res.status(500).json({ error: 'Failed to send gift.' });
  }
});

export default router;
