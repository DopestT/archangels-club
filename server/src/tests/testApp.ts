/**
 * Lightweight Express app for unit tests.
 * Does NOT start a server, run migrations, or connect to any real database.
 * DB is mocked by the test files themselves via vi.mock('../db/schema.js').
 */
import express from 'express';
import creatorRoutes from '../routes/creators.js';
import contentRoutes from '../routes/content.js';
import paymentRoutes from '../routes/payments.js';
import adminRoutes from '../routes/admin.js';
import accessRequestRoutes from '../routes/accessRequests.js';
import checkoutRoutes from '../routes/checkout.js';
import webhookRoutes from '../routes/webhooks.js';

export function createTestApp() {
  const app = express();
  // Webhook needs raw body for Stripe sig verification; in tests sig is skipped,
  // but express.raw still lets us send JSON as raw Buffer and have it parsed.
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);
  app.use(express.json());
  app.use('/api/creators', creatorRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/checkout', checkoutRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/access-request', accessRequestRoutes);
  return app;
}
