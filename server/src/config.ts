const REQUIRED: string[] = [
  'DATABASE_URL',
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

const RECOMMENDED: string[] = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_BUCKET_NAME',
  'AWS_REGION',
  'ADMIN_KEY',
];

export function validateConfig(): void {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[config] Missing required environment variables: ${missing.join(', ')}\n` +
      `Set these before starting the server.`
    );
  }

  const missingRec = RECOMMENDED.filter(k => !process.env[k]);
  if (missingRec.length > 0) {
    console.warn('[config] WARNING: recommended env vars not set — some features will be unavailable: %s',
      missingRec.join(', '));
  }

  console.log('[config] Environment validated OK');
}
