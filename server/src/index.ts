import express from 'express';
import cors from 'cors';
import { pool, runMigrations } from './db/schema.js';
import authRoutes from './routes/auth.js';
import creatorRoutes from './routes/creators.js';
import contentRoutes from './routes/content.js';
import messageRoutes from './routes/messages.js';
import adminRoutes from './routes/admin.js';
import keyRoutes from './routes/keys.js';
import videoRoutes from './routes/video.js';
import notificationRoutes from './routes/notifications.js';
import accessRequestRoutes from './routes/accessRequests.js';
import paymentRoutes from './routes/payments.js';
import webhookRoutes from './routes/webhooks.js';
import stripeRoutes from './routes/stripe.js';

const app = express();
const PORT = Number(process.env.PORT);
if (!PORT) {
  throw new Error("PORT environment variable is required");
}

const corsOptions = {
  origin: true,
  credentials: true,
};
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Webhook must receive raw body for Stripe signature verification — mount before express.json()
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/access-request', accessRequestRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stripe', stripeRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', platform: 'Archangels Club API' });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, database: 'error', detail: String(err) });
  }
});

// TEMPORARY debug endpoints — remove before public launch
app.get('/api/debug/creators', async (_req, res) => {
  try {
    const rows = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.email, u.role, u.status, u.is_verified_creator,
             cp.application_status, cp.is_approved
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      ORDER BY u.username
    `);
    res.json(rows.rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/debug/content', async (_req, res) => {
  try {
    const rows = await pool.query(`
      SELECT c.id, c.title, c.content_type, c.access_type, c.status, c.price, c.created_at,
             u.username AS creator_username, u.display_name AS creator_name
      FROM content c
      JOIN creator_profiles cp ON cp.id = c.creator_id
      JOIN users u ON u.id = cp.user_id
      ORDER BY c.created_at DESC
      LIMIT 100
    `);
    res.json(rows.rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/debug/env', (_req, res) => {
  res.json({
    node_env: process.env.NODE_ENV ?? 'not set',
    client_url: process.env.CLIENT_URL ?? 'not set',
    stripe_key_prefix: process.env.STRIPE_SECRET_KEY
      ? process.env.STRIPE_SECRET_KEY.substring(0, 7)
      : 'not set',
    stripe_mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'live' : 'test',
    resend_configured: !!process.env.RESEND_API_KEY,
    database_url_set: !!process.env.DATABASE_URL,
    port: process.env.PORT ?? 'not set',
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
