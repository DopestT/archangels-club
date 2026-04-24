import { Router } from 'express';
import { query, queryOne, execute } from '../db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { triggerAccountApproved } from '../services/triggers.js';

const router = Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [[totalUsers], [pendingUsers], [approvedUsers], [totalCreators], [pendingCreators], [pendingContent], revenueRow] =
      await Promise.all([
        query<{ n: string }>(`SELECT COUNT(*) as n FROM users`),
        query<{ n: string }>(`SELECT COUNT(*) as n FROM users WHERE status = 'pending'`),
        query<{ n: string }>(`SELECT COUNT(*) as n FROM users WHERE status = 'approved'`),
        query<{ n: string }>(`SELECT COUNT(*) as n FROM creator_profiles WHERE application_status = 'approved'`),
        query<{ n: string }>(`SELECT COUNT(*) as n FROM creator_profiles WHERE application_status = 'pending'`),
        query<{ n: string }>(`SELECT COUNT(*) as n FROM content WHERE status = 'pending_review'`),
        queryOne<{ total_fee: string; total_volume: string }>(
          `SELECT SUM(platform_fee) as total_fee, SUM(amount) as total_volume FROM transactions WHERE status = 'completed'`
        ),
      ]);

    res.json({
      totalUsers: parseInt(totalUsers?.n ?? '0', 10),
      pendingUsers: parseInt(pendingUsers?.n ?? '0', 10),
      approvedUsers: parseInt(approvedUsers?.n ?? '0', 10),
      totalCreators: parseInt(totalCreators?.n ?? '0', 10),
      pendingCreators: parseInt(pendingCreators?.n ?? '0', 10),
      pendingContent: parseInt(pendingContent?.n ?? '0', 10),
      totalRevenue: parseFloat(revenueRow?.total_fee ?? '0'),
      totalVolume: parseFloat(revenueRow?.total_volume ?? '0'),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// ── Access Requests ──────────────────────────────────────────────────────────

router.get('/access-requests', async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, email, username, display_name, status, date_of_birth, reason_for_joining, created_at
       FROM users WHERE status = 'pending' ORDER BY created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests.' });
  }
});

router.patch('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['approved', 'rejected', 'suspended', 'banned'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
      return;
    }
    const changed = await execute('UPDATE users SET status = $1 WHERE id = $2', [status, req.params.id]);
    if (changed === 0) { res.status(404).json({ error: 'User not found' }); return; }

    if (status === 'approved') {
      const user = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [req.params.id]);
      triggerAccountApproved(req.params.id, user?.role === 'creator' ? 'creator' : 'fan').catch(console.error);
    }

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// ── Creator Applications ─────────────────────────────────────────────────────

router.get('/creators/pending', async (req, res) => {
  try {
    const rows = await query<any>(`
      SELECT cp.*, u.display_name, u.username, u.avatar_url, u.email, u.created_at AS user_created_at
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.application_status = 'pending'
      ORDER BY cp.created_at ASC
    `);
    res.json(rows.map((r: any) => ({
      ...r,
      tags: JSON.parse(r.tags ?? '[]'),
      content_categories: JSON.parse(r.content_categories ?? '[]'),
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch creator applications.' });
  }
});

router.patch('/creators/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['approved', 'rejected', 'suspended'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
      return;
    }
    const isApproved = status === 'approved' ? 1 : 0;
    await execute(
      'UPDATE creator_profiles SET application_status = $1, is_approved = $2 WHERE id = $3',
      [status, isApproved, req.params.id]
    );
    if (status === 'approved') {
      await execute(
        `UPDATE users SET role = 'creator', is_verified_creator = 1
         WHERE id = (SELECT user_id FROM creator_profiles WHERE id = $1)`,
        [req.params.id]
      );
      const cp = await queryOne<{ user_id: string }>('SELECT user_id FROM creator_profiles WHERE id = $1', [req.params.id]);
      if (cp) triggerAccountApproved(cp.user_id, 'creator').catch(console.error);
    }
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update creator status.' });
  }
});

// ── Content Approvals ────────────────────────────────────────────────────────

router.get('/content-approvals', async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.*, u.display_name AS creator_name, u.username AS creator_username, u.avatar_url AS creator_avatar
      FROM content c
      JOIN creator_profiles cp ON cp.id = c.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE c.status = 'pending_review'
      ORDER BY c.created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content approvals.' });
  }
});

router.patch('/content/:id/status', async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    const allowed = ['approved', 'rejected', 'removed'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
      return;
    }
    const changed = await execute('UPDATE content SET status = $1 WHERE id = $2', [status, req.params.id]);
    if (changed === 0) { res.status(404).json({ error: 'Content not found' }); return; }
    res.json({ success: true, status, rejection_reason: rejection_reason ?? null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update content status.' });
  }
});

// ── Transactions / Users (read-only) ─────────────────────────────────────────

router.get('/transactions', async (req, res) => {
  try {
    const rows = await query(`
      SELECT t.*,
        payer.display_name AS payer_name,
        payee.display_name AS payee_name
      FROM transactions t
      JOIN users payer ON payer.id = t.payer_id
      JOIN users payee ON payee.id = t.payee_id
      ORDER BY t.created_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, email, username, display_name, role, status, is_verified_creator, created_at
       FROM users ORDER BY created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

export default router;
