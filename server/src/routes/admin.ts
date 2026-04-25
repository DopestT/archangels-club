import { Router } from 'express';
import { query, queryOne, execute } from '../db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { triggerAccountApproved } from '../services/triggers.js';
import {
  sendUserWelcome, sendUserRejected, sendUserMoreInfoRequested,
  sendCreatorWelcome, sendCreatorRejected,
  sendContentApproved, sendContentRejected, sendContentChangesRequested,
} from '../services/email.js';

const router = Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [
      [totalUsers], [pendingAccessRequests], [approvedUsers],
      [totalCreators], [pendingCreators], [pendingContent],
      [openReports], [activeSubscriptions], revenueRow,
    ] = await Promise.all([
      query<{ n: string }>(`SELECT COUNT(*) as n FROM users`),
      query<{ n: string }>(`SELECT COUNT(*) as n FROM access_requests WHERE status = 'pending'`),
      query<{ n: string }>(`SELECT COUNT(*) as n FROM users WHERE status = 'approved'`),
      query<{ n: string }>(`SELECT COUNT(*) as n FROM creator_profiles WHERE application_status = 'approved'`),
      query<{ n: string }>(`SELECT COUNT(*) as n FROM creator_profiles WHERE application_status = 'pending'`),
      query<{ n: string }>(`SELECT COUNT(*) as n FROM content WHERE status = 'pending_review'`),
      query<{ n: string }>(`SELECT COUNT(*) as n FROM reports WHERE status = 'open'`),
      query<{ n: string }>(`SELECT COUNT(*) as n FROM subscriptions WHERE status = 'active'`),
      queryOne<{ total_fee: string; total_volume: string }>(
        `SELECT SUM(platform_fee) as total_fee, SUM(amount) as total_volume FROM transactions WHERE status = 'completed'`
      ),
    ]);

    res.json({
      totalUsers: parseInt(totalUsers?.n ?? '0', 10),
      pendingAccessRequests: parseInt(pendingAccessRequests?.n ?? '0', 10),
      approvedUsers: parseInt(approvedUsers?.n ?? '0', 10),
      totalCreators: parseInt(totalCreators?.n ?? '0', 10),
      pendingCreators: parseInt(pendingCreators?.n ?? '0', 10),
      pendingContent: parseInt(pendingContent?.n ?? '0', 10),
      openReports: parseInt(openReports?.n ?? '0', 10),
      activeSubscriptions: parseInt(activeSubscriptions?.n ?? '0', 10),
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
      `SELECT id, email, name, reason, status, created_at
       FROM access_requests ORDER BY created_at DESC`
    );
    console.log(`[admin] access-requests: ${rows.length} rows`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests.' });
  }
});

router.post('/users/:id/approve', async (req, res) => {
  try {
    const row = await queryOne<{ email: string; name: string }>(
      `SELECT email, name FROM access_requests WHERE id = $1`,
      [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Request not found.' }); return; }
    await execute(`UPDATE access_requests SET status = 'approved' WHERE id = $1`, [req.params.id]);
    sendUserWelcome(row.email, row.name).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve request.' });
  }
});

router.post('/users/:id/reject', async (req, res) => {
  try {
    const row = await queryOne<{ email: string; name: string }>(
      `SELECT email, name FROM access_requests WHERE id = $1`, [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Request not found.' }); return; }
    await execute(`UPDATE access_requests SET status = 'rejected' WHERE id = $1`, [req.params.id]);
    sendUserRejected(row.email, row.name).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject request.' });
  }
});

router.post('/users/:id/request-more-info', async (req, res) => {
  try {
    const row = await queryOne<{ email: string; name: string }>(
      `SELECT email, name FROM access_requests WHERE id = $1`, [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Request not found.' }); return; }
    sendUserMoreInfoRequested(row.email, row.name).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send request.' });
  }
});

router.post('/users/:id/suspend', async (req, res) => {
  try {
    const changed = await execute(
      `UPDATE access_requests SET status = 'rejected' WHERE id = $1`, [req.params.id]
    );
    if (changed === 0) { res.status(404).json({ error: 'Request not found.' }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to suspend.' });
  }
});

// ── Creator Actions ───────────────────────────────────────────────────────────

router.post('/creators/:id/approve', async (req, res) => {
  try {
    const cp = await queryOne<{ user_id: string }>(`SELECT user_id FROM creator_profiles WHERE id = $1`, [req.params.id]);
    if (!cp) { res.status(404).json({ error: 'Creator not found.' }); return; }
    await execute(`UPDATE creator_profiles SET application_status = 'approved', is_approved = 1 WHERE id = $1`, [req.params.id]);
    await execute(`UPDATE users SET role = 'creator', is_verified_creator = 1 WHERE id = $1`, [cp.user_id]);
    const user = await queryOne<{ email: string; display_name: string }>(`SELECT email, display_name FROM users WHERE id = $1`, [cp.user_id]);
    if (user) sendCreatorWelcome(user.email, user.display_name).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve creator.' });
  }
});

router.post('/creators/:id/reject', async (req, res) => {
  try {
    const cp = await queryOne<{ user_id: string }>(`SELECT user_id FROM creator_profiles WHERE id = $1`, [req.params.id]);
    if (!cp) { res.status(404).json({ error: 'Creator not found.' }); return; }
    await execute(`UPDATE creator_profiles SET application_status = 'rejected' WHERE id = $1`, [req.params.id]);
    const user = await queryOne<{ email: string; display_name: string }>(`SELECT email, display_name FROM users WHERE id = $1`, [cp.user_id]);
    if (user) sendCreatorRejected(user.email, user.display_name).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject creator.' });
  }
});

router.post('/creators/:id/request-more-info', async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
});

router.post('/creators/:id/suspend', async (req, res) => {
  try {
    const changed = await execute(`UPDATE creator_profiles SET application_status = 'suspended' WHERE id = $1`, [req.params.id]);
    if (changed === 0) { res.status(404).json({ error: 'Creator not found.' }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to suspend creator.' });
  }
});

// ── Content Actions ───────────────────────────────────────────────────────────

router.post('/content/:id/approve', async (req, res) => {
  try {
    const row = await queryOne<{ creator_id: string; title: string }>(
      `SELECT creator_id, title FROM content WHERE id = $1`, [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Content not found.' }); return; }
    await execute(`UPDATE content SET status = 'approved' WHERE id = $1`, [req.params.id]);
    const user = await queryOne<{ email: string; display_name: string }>(
      `SELECT u.email, u.display_name FROM users u JOIN creator_profiles cp ON cp.user_id = u.id WHERE cp.id = $1`,
      [row.creator_id]
    );
    if (user) sendContentApproved(user.email, user.display_name, row.title).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve content.' });
  }
});

router.post('/content/:id/reject', async (req, res) => {
  try {
    const row = await queryOne<{ creator_id: string; title: string }>(
      `SELECT creator_id, title FROM content WHERE id = $1`, [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Content not found.' }); return; }
    await execute(`UPDATE content SET status = 'rejected' WHERE id = $1`, [req.params.id]);
    const user = await queryOne<{ email: string; display_name: string }>(
      `SELECT u.email, u.display_name FROM users u JOIN creator_profiles cp ON cp.user_id = u.id WHERE cp.id = $1`,
      [row.creator_id]
    );
    if (user) sendContentRejected(user.email, user.display_name, row.title).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject content.' });
  }
});

router.post('/content/:id/request-changes', async (req, res) => {
  try {
    const row = await queryOne<{ creator_id: string; title: string }>(
      `SELECT creator_id, title FROM content WHERE id = $1`, [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Content not found.' }); return; }
    await execute(`UPDATE content SET status = 'changes_requested' WHERE id = $1`, [req.params.id]);
    const user = await queryOne<{ email: string; display_name: string }>(
      `SELECT u.email, u.display_name FROM users u JOIN creator_profiles cp ON cp.user_id = u.id WHERE cp.id = $1`,
      [row.creator_id]
    );
    if (user) sendContentChangesRequested(user.email, user.display_name, row.title).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to request changes.' });
  }
});

router.post('/content/:id/remove', async (req, res) => {
  try {
    const changed = await execute(`UPDATE content SET status = 'removed' WHERE id = $1`, [req.params.id]);
    if (changed === 0) { res.status(404).json({ error: 'Content not found.' }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove content.' });
  }
});

// ── Reports ───────────────────────────────────────────────────────────────────

router.get('/reports', async (req, res) => {
  try {
    const rows = await query(`
      SELECT r.id, r.subject_type, r.subject_id, r.reason, r.details, r.status, r.created_at,
             u.username as reporter_username, u.display_name as reporter_name
      FROM reports r
      JOIN users u ON u.id = r.reporter_id
      WHERE r.status = 'open'
      ORDER BY r.created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

router.post('/reports/:id/dismiss', async (req, res) => {
  try {
    const changed = await execute(`UPDATE reports SET status = 'dismissed' WHERE id = $1`, [req.params.id]);
    if (changed === 0) { res.status(404).json({ error: 'Report not found.' }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss report.' });
  }
});

router.post('/reports/:id/take-action', async (req, res) => {
  try {
    const changed = await execute(`UPDATE reports SET status = 'actioned' WHERE id = $1`, [req.params.id]);
    if (changed === 0) { res.status(404).json({ error: 'Report not found.' }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report.' });
  }
});

router.post('/reports/:id/escalate', async (req, res) => {
  try {
    const changed = await execute(`UPDATE reports SET status = 'actioned' WHERE id = $1`, [req.params.id]);
    if (changed === 0) { res.status(404).json({ error: 'Report not found.' }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to escalate report.' });
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
        payer.display_name AS payer_name, payer.email AS payer_email,
        payee.display_name AS payee_name,
        c.title AS content_title
      FROM transactions t
      JOIN users payer ON payer.id = t.payer_id
      JOIN users payee ON payee.id = t.payee_id
      LEFT JOIN content c ON c.id = t.ref_id AND t.ref_type = 'content'
      ORDER BY t.created_at DESC
      LIMIT 200
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

// ── Role Management ───────────────────────────────────────────────────────────

router.post('/promote-to-admin', async (req, res) => {
  try {
    const { email } = req.body as { email?: string };

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const result = await execute(
      'UPDATE users SET role = $1 WHERE email = $2',
      ['admin', normalizedEmail]
    );

    if (result === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ success: true, message: `User ${normalizedEmail} promoted to admin.` });
  } catch (err) {
    console.error('Admin promotion error:', err);
    res.status(500).json({ error: 'Failed to promote user.' });
  }
});

export default router;
