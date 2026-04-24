import { Router } from 'express';
import { db } from '../db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { triggerAccountApproved } from '../services/triggers.js';

const router = Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const totalUsers = (db.prepare("SELECT COUNT(*) as n FROM users").get() as any).n;
  const pendingUsers = (db.prepare("SELECT COUNT(*) as n FROM users WHERE status = 'pending'").get() as any).n;
  const approvedUsers = (db.prepare("SELECT COUNT(*) as n FROM users WHERE status = 'approved'").get() as any).n;
  const totalCreators = (db.prepare("SELECT COUNT(*) as n FROM creator_profiles WHERE application_status = 'approved'").get() as any).n;
  const pendingCreators = (db.prepare("SELECT COUNT(*) as n FROM creator_profiles WHERE application_status = 'pending'").get() as any).n;
  const pendingContent = (db.prepare("SELECT COUNT(*) as n FROM content WHERE status = 'pending_review'").get() as any).n;

  const revenueRow = db.prepare(`
    SELECT SUM(platform_fee) as total_fee, SUM(amount) as total_volume
    FROM transactions WHERE status = 'completed'
  `).get() as any;

  res.json({
    totalUsers,
    pendingUsers,
    approvedUsers,
    totalCreators,
    pendingCreators,
    pendingContent,
    totalRevenue: revenueRow?.total_fee ?? 0,
    totalVolume: revenueRow?.total_volume ?? 0,
  });
});

// ── Access Requests ──────────────────────────────────────────────────────────

// GET /api/admin/access-requests — pending user signups
router.get('/access-requests', (req, res) => {
  const rows = db.prepare(`
    SELECT id, email, username, display_name, status, date_of_birth, reason_for_joining, created_at
    FROM users
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `).all();
  res.json(rows);
});

// PATCH /api/admin/users/:id/status — approve/reject/suspend/ban a user
router.patch('/users/:id/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['approved', 'rejected', 'suspended', 'banned'];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    return;
  }
  const result = db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) { res.status(404).json({ error: 'User not found' }); return; }

  if (status === 'approved') {
    const user = db.prepare("SELECT role FROM users WHERE id = ?").get(req.params.id) as any;
    triggerAccountApproved(req.params.id, user?.role === 'creator' ? 'creator' : 'fan').catch(console.error);
  }

  res.json({ success: true, status });
});

// ── Creator Applications ─────────────────────────────────────────────────────

// GET /api/admin/creators/pending
router.get('/creators/pending', (req, res) => {
  const rows = db.prepare(`
    SELECT cp.*, u.display_name, u.username, u.avatar_url, u.email, u.created_at as user_created_at
    FROM creator_profiles cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.application_status = 'pending'
    ORDER BY cp.created_at ASC
  `).all() as any[];
  res.json(rows.map((r) => ({ ...r, tags: JSON.parse(r.tags ?? '[]'), content_categories: JSON.parse(r.content_categories ?? '[]') })));
});

// PATCH /api/admin/creators/:id/status — approve/reject/suspend a creator application
router.patch('/creators/:id/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['approved', 'rejected', 'suspended'];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    return;
  }
  const isApproved = status === 'approved' ? 1 : 0;
  db.prepare("UPDATE creator_profiles SET application_status = ?, is_approved = ? WHERE id = ?").run(status, isApproved, req.params.id);
  if (status === 'approved') {
    db.prepare("UPDATE users SET role = 'creator', is_verified_creator = 1 WHERE id = (SELECT user_id FROM creator_profiles WHERE id = ?)").run(req.params.id);
    const cp = db.prepare("SELECT user_id FROM creator_profiles WHERE id = ?").get(req.params.id) as any;
    if (cp) triggerAccountApproved(cp.user_id, 'creator').catch(console.error);
  }
  res.json({ success: true, status });
});

// ── Content Approvals ────────────────────────────────────────────────────────

// GET /api/admin/content-approvals — pending review content
router.get('/content-approvals', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, u.display_name as creator_name, u.username as creator_username, u.avatar_url as creator_avatar
    FROM content c
    JOIN creator_profiles cp ON cp.id = c.creator_id
    JOIN users u ON u.id = cp.user_id
    WHERE c.status = 'pending_review'
    ORDER BY c.created_at ASC
  `).all();
  res.json(rows);
});

// PATCH /api/admin/content/:id/status — approve/reject/remove content
router.patch('/content/:id/status', (req, res) => {
  const { status, rejection_reason } = req.body;
  const allowed = ['approved', 'rejected', 'removed'];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    return;
  }
  const result = db.prepare("UPDATE content SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) { res.status(404).json({ error: 'Content not found' }); return; }
  res.json({ success: true, status, rejection_reason: rejection_reason ?? null });
});

// ── Transactions / Users (read-only) ─────────────────────────────────────────

// GET /api/admin/transactions
router.get('/transactions', (req, res) => {
  const rows = db.prepare(`
    SELECT t.*,
      payer.display_name as payer_name,
      payee.display_name as payee_name
    FROM transactions t
    JOIN users payer ON payer.id = t.payer_id
    JOIN users payee ON payee.id = t.payee_id
    ORDER BY t.created_at DESC
    LIMIT 100
  `).all();
  res.json(rows);
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const rows = db.prepare(`
    SELECT id, email, username, display_name, role, status, is_verified_creator, created_at
    FROM users ORDER BY created_at DESC LIMIT 100
  `).all();
  res.json(rows);
});

export default router;
