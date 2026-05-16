console.log('STARTING SERVER...');process.stdout.write('index.ts loading\n');
import express from 'express';
import cors from 'cors';
import { pool, runMigrations } from './db/schema.js';
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

