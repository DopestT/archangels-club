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

/** Runs a set of operations inside a BEGIN / COMMIT block. Rolls back on error. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
