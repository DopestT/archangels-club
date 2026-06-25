import { Router } from 'express';
import { queryOne, execute } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const STARTER_GOLD = 250;

router.get('/balance', async (req, res) => {
  try {
    const row = await queryOne<{ balance: number }>(
      'SELECT balance FROM gold_accounts WHERE user_id = $1',
      [req.auth!.userId],
    );
    res.json({ balance: row?.balance ?? 0 });
  } catch (err) {
    console.error('GET /gold/balance:', err);
    res.status(500).json({ error: 'Failed to load balance' });
  }
});

router.post('/claim-starter', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    // Ensure account row exists
    await execute(
      `INSERT INTO gold_accounts (user_id, balance, total_spent, starter_claimed, updated_at)
       VALUES ($1, 0, 0, false, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
    // Atomically grant only if not yet claimed
    const count = await execute(
      `UPDATE gold_accounts
       SET balance = balance + $1, starter_claimed = true, updated_at = NOW()
       WHERE user_id = $2 AND starter_claimed = false`,
      [STARTER_GOLD, userId],
    );
    const account = await queryOne<{ balance: number }>(
      'SELECT balance FROM gold_accounts WHERE user_id = $1',
      [userId],
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

export default router;
