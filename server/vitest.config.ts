import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/tests/**/*.test.ts'],
    env: {
      STRIPE_SECRET_KEY: 'sk_test_fake_for_unit_tests',
    },
    // ESM + heavy deps (stripe, twilio, resend) are slow to transform on first run.
    // 30s gives headroom without masking real hangs.
    testTimeout: 30_000,
    reporters: process.env.CI
      ? [['json', { outputFile: '../test-results/server-tests.json' }], 'verbose']
      : ['verbose'],
    pool: 'forks',
  },
  server: {
    deps: {
      // Don't re-transform pre-built npm packages — let Node load them natively.
      // This dramatically speeds up collect time on first run.
      external: [
        'stripe', 'pg', 'bcryptjs', 'jsonwebtoken', 'twilio',
        'express', 'cors', 'supertest', 'resend',
      ],
    },
  },
});
