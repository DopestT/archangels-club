import { Router } from 'express';
import Stripe from 'stripe';
import { queryOne, execute } from '../db/schema.js';
import { fulfillCheckoutSession } from '../services/fulfillment.js';

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

  console.log('[webhook] received event:', event.type, event.id);

  // ── Event-level idempotency ──────────────────────────────────────────────
  const alreadyProcessed = await queryOne(
    'SELECT event_id FROM stripe_processed_events WHERE event_id = $1',
    [event.id]
  );
  if (alreadyProcessed) {
    console.log('[webhook] duplicate event, skipping:', event.id);
    res.json({ received: true });
    return;
  }
  await execute(
    'INSERT INTO stripe_processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [event.id]
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await fulfillCheckoutSession(session);
    } catch (err) {
      console.error('[webhook] fulfillment failed:', err);
      res.status(500).json({ error: 'Webhook processing failed' });
      return;
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    console.log('[webhook] payment_intent.succeeded:', intent.id);
  }

  res.json({ received: true });
});

export default router;
