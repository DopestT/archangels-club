/**
 * Extended Express app for stress / reliability tests.
 * Adds membersRoutes and stripeRoutes on top of the base testApp.
 * Does NOT start a server, run migrations, or connect to any real database.
 * All DB calls are mocked by the test files via vi.mock('../db/schema.js').
 */
import express from 'express';
import creatorRoutes       from '../routes/creators.js';
import contentRoutes       from '../routes/content.js';
import paymentRoutes       from '../routes/payments.js';
import adminRoutes         from '../routes/admin.js';
import accessRequestRoutes from '../routes/accessRequests.js';
import checkoutRoutes      from '../routes/checkout.js';
import webhookRoutes       from '../routes/webhooks.js';
import membersRoutes       from '../routes/members.js';
import stripeRoutes        from '../routes/stripe.js';

export function createStressTestApp() {
  const app = express();
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);
  app.use(express.json());
  app.use('/api/creators',       creatorRoutes);
  app.use('/api/content',        contentRoutes);
  app.use('/api/payments',       paymentRoutes);
  app.use('/api/checkout',       checkoutRoutes);
  app.use('/api/admin',          adminRoutes);
  app.use('/api/access-request', accessRequestRoutes);
  app.use('/api/members',        membersRoutes);
  app.use('/api/stripe',         stripeRoutes);
  return app;
}
