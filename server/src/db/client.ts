import { Pool, PoolClient } from 'pg';

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required in production.\n' +
    'Set it in your Railway / Render environment variables.\n' +
    'Get the pooled connection string from your Neon project dashboard.'
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err);
});

/** Returns all rows. */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows;
}

/** Returns the first row or null. */
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const { rows } = await pool.query(sql, params);
  return (rows[0] as T) ?? null;
}

/** Runs an INSERT / UPDATE / DELETE and returns the row count. */
export async function execute(sql: string, params?: any[]): Promise<number> {
  const { rowCount } = await pool.query(sql, params);
  return rowCount ?? 0;
}

const DEADLOCK_DETECTED = '40P01';

/** Runs a set of operations inside a BEGIN / COMMIT block. Rolls back on error.
 *  Automatically retries up to 3 times on PostgreSQL deadlock (40P01). */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      if ((err as any)?.code === DEADLOCK_DETECTED && attempt < 3) {
        lastErr = err;
        console.warn('[db] deadlock detected, retrying transaction (attempt %d/3)', attempt);
        await new Promise(r => setTimeout(r, attempt * 50));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
  throw lastErr;
}
