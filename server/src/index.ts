console.log('STARTING SERVER...');process.stdout.write('index.ts loading\n');
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { v2 as cloudinary } from 'cloudinary';
import { pool, query, queryOne, runMigrations } from './db/schema.js';
import authRoutes from './routes/auth.js';
import creatorRoutes from './routes/creators.js';
import contentRoutes from './routes/content.js';
import messageRoutes from './routes/messages.js';
import adminRoutes from './routes/admin.js';
import videoRoutes from './routes/video.js';
import notificationRoutes from './routes/notifications.js';
import accessRequestRoutes from './routes/accessRequests.js';
import paymentRoutes from './routes/payments.js';
import webhookRoutes from './routes/webhooks.js';
import stripeRoutes from './routes/stripe.js';
import activityRoutes from './routes/activity.js';
import bugReportRoutes from './routes/bugReport.js';
import checkoutRoutes from './routes/checkout.js';
import membersRoutes from './routes/members.js';
import aiRoutes from './routes/ai.js';
import emailTestRoutes from './routes/emailTest.js';
import mediaRoutes from './routes/media.js';
import uploadRoutes from './routes/upload.js';
import verificationRoutes from './routes/verification.js';
import promoRoutes from './routes/promo.js';
import eventsRoutes from './routes/events.js';
import pulseRoutes from './routes/pulse.js';
import recommendationsRoutes from './routes/recommendations.js';
import intelligenceRoutes from './routes/intelligence.js';

const app = express();
const PORT = Number(process.env.PORT) || 5051;
if (!PORT) {
  throw new Error("PORT environment variable is required");
}

const ALLOWED_ORIGINS = [
  'https://archangelsclub.com',
  'https://www.archangelsclub.com',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:5173'] : []),
];
const corsOptions = {
  origin: (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin not allowed — ${origin}`));
  },
  credentials: true,
};
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Webhook must receive raw body for Stripe signature verification — mount before express.json()
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/access-request', accessRequestRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/admin/bug-report', bugReportRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/email', emailTestRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/pulse', pulseRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/intelligence', intelligenceRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', platform: 'Archangels Club API', build: 'v0.1.1' });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, database: 'error', detail: String(err) });
  }
});

// GET /api/health/system — admin system health page data
// Returns status of all critical infrastructure: auth, DB, Cloudinary, Stripe,
// last webhook received, recent upload/payment failures, and critical audit events.
app.get('/api/health/system', async (_req, res) => {
  const checks: Record<string, unknown> = {};
  const degraded: string[] = [];

  // Auth: check JWT secret is configured
  checks.auth = {
    ok: !!process.env.JWT_SECRET,
    configured: !!process.env.JWT_SECRET,
    note: process.env.JWT_SECRET ? null : 'JWT_SECRET not set — using insecure default',
  };
  if (!process.env.JWT_SECRET) degraded.push('auth');

  // Database
  try {
    await pool.query('SELECT 1');
    checks.database = { ok: true, status: 'connected' };
  } catch (err) {
    checks.database = { ok: false, status: 'error', detail: String(err) };
    degraded.push('database');
  }

  // Cloudinary
  const cldConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  if (cldConfigured) {
    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
        api_key: process.env.CLOUDINARY_API_KEY!,
        api_secret: process.env.CLOUDINARY_API_SECRET!,
        secure: true,
      });
      await cloudinary.api.ping();
      checks.cloudinary = { ok: true, status: 'reachable' };
    } catch (err) {
      checks.cloudinary = { ok: false, status: 'error', detail: String(err) };
      degraded.push('cloudinary');
    }
  } else {
    checks.cloudinary = { ok: false, status: 'not_configured', detail: 'Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET' };
    degraded.push('cloudinary');
  }

  // Stripe
  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
  const stripeWebhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
  if (stripeConfigured) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      await stripe.balance.retrieve();
      checks.stripe = {
        ok: true,
        status: 'reachable',
        webhook_secret_configured: stripeWebhookConfigured,
        webhook_note: stripeWebhookConfigured ? null : 'STRIPE_WEBHOOK_SECRET not set — webhook signature verification is disabled',
      };
      if (!stripeWebhookConfigured) degraded.push('stripe_webhook');
    } catch (err) {
      checks.stripe = { ok: false, status: 'error', detail: String(err), webhook_secret_configured: stripeWebhookConfigured };
      degraded.push('stripe');
    }
  } else {
    checks.stripe = { ok: false, status: 'not_configured', detail: 'Missing STRIPE_SECRET_KEY' };
    degraded.push('stripe');
  }

  // Webhook last received
  try {
    const lastWebhook = await queryOne<{ received_at: string; event_type: string }>(
      `SELECT received_at, event_type FROM payment_events ORDER BY received_at DESC LIMIT 1`
    );
    checks.webhook_last_received = lastWebhook
      ? { received_at: lastWebhook.received_at, event_type: lastWebhook.event_type }
      : { received_at: null, note: 'No webhook events recorded yet' };
  } catch {
    checks.webhook_last_received = { error: 'Could not query payment_events' };
  }

  // Last upload failure (from audit_log if available)
  try {
    const lastUploadFail = await queryOne<{ created_at: string; actor_user_id: string; metadata: unknown }>(
      `SELECT created_at, actor_user_id, metadata FROM audit_log
       WHERE event_type = 'media_upload_failed' ORDER BY created_at DESC LIMIT 1`
    );
    checks.last_upload_failure = lastUploadFail
      ? { at: lastUploadFail.created_at, creator_user_id: lastUploadFail.actor_user_id, metadata: lastUploadFail.metadata }
      : { at: null };
  } catch {
    checks.last_upload_failure = { note: 'audit_log table not yet available' };
  }

  // Last payment failure
  try {
    const lastPayFail = await queryOne<{ received_at: string; event_type: string; error_message: string }>(
      `SELECT received_at, event_type, error_message FROM payment_events
       WHERE processing_status = 'failed' ORDER BY received_at DESC LIMIT 1`
    );
    checks.last_payment_failure = lastPayFail
      ? { at: lastPayFail.received_at, event_type: lastPayFail.event_type, error: lastPayFail.error_message }
      : { at: null };
  } catch {
    checks.last_payment_failure = { error: 'Could not query payment_events' };
  }

  // Recent critical audit events (last 10)
  try {
    const recentEvents = await query<{ created_at: string; event_type: string; actor_user_id: string; status: string }>(
      `SELECT created_at, event_type, actor_user_id, status FROM audit_log
       ORDER BY created_at DESC LIMIT 10`
    );
    checks.recent_audit_events = recentEvents;
  } catch {
    checks.recent_audit_events = [];
  }

  // Fulfillment records needing attention
  try {
    const needsReview = await query<{ id: string; stripe_session_id: string; last_error: string; created_at: string }>(
      `SELECT id, stripe_session_id, last_error, created_at FROM fulfillment_records
       WHERE status IN ('failed','needs_review') ORDER BY created_at DESC LIMIT 20`
    );
    checks.fulfillment_needs_attention = needsReview;
  } catch {
    checks.fulfillment_needs_attention = [];
  }

  const overall = degraded.length === 0 ? 'healthy' : degraded.includes('database') ? 'critical' : 'degraded';
  res.status(overall === 'critical' ? 503 : 200).json({
    overall,
    degraded,
    checks,
    generated_at: new Date().toISOString(),
  });
});


async function start() {
  try {
    await runMigrations();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

