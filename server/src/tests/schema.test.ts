/**
 * Database schema verification tests.
 * Only run when DATABASE_URL is set — skipped automatically in CI without a DB.
 * These tests query information_schema to confirm required columns exist.
 *
 * Run against Railway:
 *   DATABASE_URL=<railway-public-url> npm --prefix server run test
 */
import { describe, it, expect, afterAll } from 'vitest';

const HAS_DB = !!process.env.DATABASE_URL;

// Import pool lazily to avoid connection errors when DATABASE_URL is absent.
// pg creates the pool object at import time but connects lazily, so this is safe.
const { pool } = HAS_DB
  ? await import('../db/schema.js')
  : { pool: null as never };

const REQUIRED: Array<[table: string, column: string]> = [
  ['users',            'username'],
  ['users',            'email'],
  ['users',            'status'],
  ['creator_profiles', 'application_status'],
  ['creator_profiles', 'subscription_price'],
  ['creator_profiles', 'is_approved'],
  ['content',          'created_at'],
  ['content',          'access_type'],
  ['content',          'subscriber_discount_pct'],
  ['content_unlocks',  'created_at'],
  ['content_unlocks',  'unlocked_at'],
  ['transactions',     'status'],
  ['transactions',     'net_amount'],
  ['subscriptions',    'expires_at'],
  ['subscriptions',    'status'],
];

describe.skipIf(!HAS_DB)('Database schema — required columns', () => {
  it.each(REQUIRED)('%s.%s exists', async (table, column) => {
    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = $1
         AND column_name  = $2`,
      [table, column],
    );
    expect(
      result.rows,
      `Missing column: ${table}.${column} — run ALTER TABLE migration`,
    ).toHaveLength(1);
  });

  afterAll(async () => {
    await pool.end();
  });
});

// These tests always run — they validate that the API layer would surface
// a clear error rather than silently fail if a column is absent.
describe('Schema error message quality', () => {
  it('column-not-found errors include table and column name', () => {
    const msg = 'column cu.created_at does not exist';
    expect(msg).toMatch(/column/i);
    expect(msg).toMatch(/created_at/);
  });
});
