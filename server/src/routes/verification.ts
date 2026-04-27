import { Router } from 'express';
import Stripe from 'stripe';
import { requireAuth, requireApproved } from '../middleware/auth.js';
import { queryOne, execute } from '../db/schema.js';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL ?? process.env.CLIENT_URL ?? 'https://archangelsclub.com';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// GET /api/verification/status — current user's age verification state
router.get('/status', requireAuth, async (req, res) => {
  try {
    const user = await queryOne<{
      age_verification_status: string;
      age_verified_at: string | null;
      verification_provider: string | null;
    }>(
      'SELECT age_verification_status, age_verified_at, verification_provider FROM users WHERE id = $1',
      [req.auth!.userId]
    );
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
    res.json(user);
  } catch (err) {
    console.error('[verification] status error:', err);
    res.status(500).json({ error: 'Failed to get verification status.' });
  }
});

// POST /api/verification/start — create Stripe Identity VerificationSession
router.post('/start', requireAuth, requireApproved, async (req, res) => {
  if (req.auth!.role === 'admin') {
    res.status(400).json({ error: 'Admins do not require age verification.' });
    return;
  }

  try {
    const user = await queryOne<{ age_verification_status: string }>(
      'SELECT age_verification_status FROM users WHERE id = $1',
      [req.auth!.userId]
    );
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

    if (user.age_verification_status === 'verified') {
      res.json({ already_verified: true });
      return;
    }

    const stripe = getStripe();

    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { user_id: req.auth!.userId },
      options: {
        document: {
          require_matching_selfie: true,
        },
      },
      return_url: `${FRONTEND_URL}/verify-age/return`,
    });

    await execute(
      `UPDATE users
         SET age_verification_status = 'pending',
             verification_provider   = 'stripe_identity',
             verification_session_id = $1
       WHERE id = $2`,
      [session.id, req.auth!.userId]
    );

    console.log('[verification] session started:', session.id, 'user:', req.auth!.userId);
    res.json({ url: session.url });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      console.error('[verification] Stripe error:', err.type, err.message);
      res.status(500).json({ error: `Verification failed: ${err.message}` });
    } else {
      console.error('[verification] error:', err);
      res.status(500).json({ error: 'Failed to start verification.' });
    }
  }
});

export default router;
