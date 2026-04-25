import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from './client.js';
import { runMigrations } from './migrate.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret npm run create-admin');
  process.exit(1);
}

async function createAdmin() {
  await runMigrations();

  const passwordHash = await bcrypt.hash(password!, 12);
  const existing = await pool.query('SELECT id, role, status FROM users WHERE email = $1', [email!.toLowerCase()]);

  if (existing.rows.length > 0) {
    const { id, role, status } = existing.rows[0];
    await pool.query(
      `UPDATE users SET role = 'admin', status = 'approved', password_hash = $1 WHERE id = $2`,
      [passwordHash, id]
    );
    console.log(`✓ Updated existing user ${email} → role=admin status=approved (was role=${role} status=${status})`);
  } else {
    const id = crypto.randomUUID();
    const username = email!.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '_admin';
    await pool.query(
      `INSERT INTO users (id, email, username, password_hash, display_name, role, status)
       VALUES ($1, $2, $3, $4, $5, 'admin', 'approved')`,
      [id, email!.toLowerCase(), username, passwordHash, email!.split('@')[0]]
    );
    console.log(`✓ Created admin user: ${email} (id=${id})`);
  }

  console.log('Done. You can now log in and access /admin.');
  await pool.end();
}

createAdmin().catch((err) => {
  console.error('Failed to create admin user');
  console.error(err);
  if (err instanceof Error) {
    console.error(err.message);
    console.error(err.stack);
  }
  process.exit(1);
});
