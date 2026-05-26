import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Crown, Users, DollarSign, Flag, LayoutDashboard,
  UserCheck, Image, CheckCircle, XCircle, MessageSquare, AlertTriangle,
  RefreshCw, Star, ArrowDownToLine, TrendingUp, Clock, Shield,
  ChevronRight, Bug, Activity, Database, CreditCard, Cloud, Zap,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import Avatar from '../components/ui/Avatar';
import { formatCurrency, timeAgo } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/api';


// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalUsers: number;
  pendingAccessRequests: number;
  approvedUsers: number;
  totalCreators: number;
  pendingCreators: number;
  pendingContent: number;
  openReports: number;
  activeSubscriptions: number;
  totalRevenue: number;
  totalVolume: number;
}

interface AccessRequest { id: string; email: string; name: string; reason: string; requested_role: string; status: string; created_at: string; }
interface CreatorApplication { id: string; user_id: string; bio: string; pitch: string; tags: string[]; application_status: string; created_at: string; display_name: string; username: string; avatar_url: string; email: string; }
interface ContentItem { id: string; title: string; description: string; content_type: string; access_type: string; price: number; status: string; created_at: string; creator_name: string; creator_username: string; creator_avatar: string; }
interface Report { id: string; subject_type: string; subject_id: string; reason: string; details: string; status: string; created_at: string; reporter_username: string; reporter_name: string; }
interface Transaction { id: string; payer_name: string; payer_email: string; payee_name: string; ref_type: string; content_title: string | null; amount: number; platform_fee: number; net_amount: number; status: string; created_at: string; }
interface UploadFailure { id: string; status: string; failure_reason: string | null; created_at: string; updated_at: string; creator_user_id: string; email: string; display_name: string; username: string; }

type QueueTab = 'access' | 'creators' | 'content' | 'reports' | 'transactions';

interface SystemHealthCheck {
  ok?: boolean;
  status?: string;
  configured?: boolean;
  note?: string | null;
  webhook_secret_configured?: boolean;
  webhook_note?: string | null;
  detail?: string;
  received_at?: string | null;
  event_type?: string;
  error?: string;
  at?: string | null;
  creator_user_id?: string;
  metadata?: unknown;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  degraded: string[];
  generated_at: string;
  checks: {
    auth?: SystemHealthCheck;
    database?: SystemHealthCheck;
    cloudinary?: SystemHealthCheck;
    stripe?: SystemHealthCheck;
    webhook_last_received?: SystemHealthCheck;
    last_upload_failure?: SystemHealthCheck;
    last_payment_failure?: SystemHealthCheck;
    recent_audit_events?: Array<{ created_at: string; event_type: string; actor_user_id: string; status: string }>;
    fulfillment_needs_attention?: Array<{ id: string; stripe_session_id: string; last_error: string; created_at: string }>;
  };
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/admin/control-center', label: 'Control Center', icon: LayoutDashboard },
  { to: '/admin/access-requests', label: 'Access Requests', icon: UserCheck },
  { to: '/admin/creator-approvals', label: 'Creator Approvals', icon: Crown },
  { to: '/admin/content-approvals', label: 'Content Approvals', icon: Image },
  { to: '/admin/flagged', label: 'Reports', icon: Flag },
  { to: '/admin/transactions', label: 'Transactions', icon: DollarSign },
  { to: '/admin/verifications', label: 'Verifications', icon: Shield },
  { to: '/admin/bug-control', label: 'Bug Control', icon: Bug },
  { to: '/admin', label: 'Overview', icon: Users },
];

function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside className="w-56 flex-shrink-0 min-h-screen bg-bg-surface border-r border-gold-border/30 flex flex-col">
      <div className="p-5 border-b border-gold-border/20">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-gold-gradient flex items-center justify-center shadow-gold-sm">
            <Crown className="w-3.5 h-3.5 text-bg-primary" />
          </div>
          <span className="font-serif text-white text-sm">Archangels</span>
        </Link>
        <p className="text-[10px] text-gold font-semibold tracking-widest uppercase mt-2 ml-0.5">Admin Panel</p>
      </div>
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={label}
              to={to}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-gold/10 text-gold border border-gold/20'
                  : 'text-arc-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gold-border/20">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-gold" />
          <span className="text-[10px] text-arc-muted">Admin access only</span>
        </div>
      </div>
    </aside>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
    pending_review: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
    approved: 'text-arc-success bg-arc-success/10 border-arc-success/25',
    rejected: 'text-arc-error bg-arc-error/10 border-arc-error/25',
    suspended: 'text-orange-400 bg-orange-400/10 border-orange-400/25',
    open: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
    dismissed: 'text-arc-muted bg-white/5 border-white/10',
    actioned: 'text-arc-success bg-arc-success/10 border-arc-success/25',
    changes_requested: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
    removed: 'text-arc-error bg-arc-error/10 border-arc-error/25',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${map[status] ?? map.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, icon }: { label: string; value: string | number; sub?: string; accent?: boolean; icon: React.ReactNode }) {
  return (
    <div className={`card-surface rounded-xl p-5 border ${accent ? 'border-gold/30' : 'border-gold-border/20'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-arc-muted">{label}</span>
        <span className={accent ? 'text-gold' : 'text-arc-muted'}>{icon}</span>
      </div>
      <p className={`font-serif text-2xl font-normal ${accent ? 'text-gold' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[11px] text-arc-muted mt-1">{sub}</p>}
    </div>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionBtn({ label, variant, onClick, icon }: { label: string; variant: 'green' | 'red' | 'amber' | 'ghost'; onClick: () => void; icon?: React.ReactNode }) {
  const styles = {
    green: 'bg-arc-success/10 text-arc-success hover:bg-arc-success/20 border-arc-success/25',
    red: 'bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border-arc-error/25',
    amber: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/25',
    ghost: 'bg-white/5 text-arc-muted hover:bg-white/10 border-white/10',
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${styles[variant]}`}>
      {icon}
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminControlCenter() {
  const toast = useToast();
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeQueue, setActiveQueue] = useState<QueueTab>('access');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [uploadFailures, setUploadFailures] = useState<UploadFailure[]>([]);
  const [failuresLoading, setFailuresLoading] = useState(false);

  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [creators, setCreators] = useState<CreatorApplication[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const adminFetch = useCallback(async (url: string, opts?: RequestInit) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${url}`, {
      ...opts,
      headers: { ...headers, ...(opts?.headers ?? {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error ?? 'Request failed');
    }
    return res.json();
  }, [token]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, ar, cr, co, rp, tx] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/access-requests'),
        adminFetch('/api/admin/creators/pending'),
        adminFetch('/api/admin/content-approvals'),
        adminFetch('/api/admin/reports'),
        adminFetch('/api/admin/transactions'),
      ]);
      setStats(s);
      setAccessRequests(ar);
      setCreators(cr);
      setContent(co);
      setReports(rp);
      setTransactions(tx);
    } catch (e: any) {
      toast.error('Failed to load data', e.message);
    } finally {
      setLoading(false);
    }
  }, [adminFetch, toast]);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const data = await adminFetch('/api/health/system');
      setHealth(data);
    } catch (e: any) {
      toast.error('Health check failed', e.message);
    } finally {
      setHealthLoading(false);
    }
  }, [adminFetch, toast]);

  const loadFailures = useCallback(async () => {
    setFailuresLoading(true);
    try {
      const data = await adminFetch('/api/admin/upload-failures');
      setUploadFailures(data);
    } catch {
      // non-fatal — table may not exist yet
    } finally {
      setFailuresLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => { loadAll(); loadHealth(); loadFailures(); }, []);

  async function action(endpoint: string, successMsg: string, onSuccess: () => void) {
    try {
      await adminFetch(endpoint, { method: 'POST' });
      toast.success(successMsg);
      onSuccess();
    } catch (e: any) {
      toast.error('Action failed', e.message);
    }
  }

  async function approveUser(req: AccessRequest) {
    try {
      const data = await adminFetch(`/api/admin/users/${req.id}/approve`, { method: 'POST' });
      if (data.email_sent) {
        toast.success(`${req.name} approved`, 'Setup email sent via Resend');
      } else {
        toast.success(
          `${req.name} approved`,
          data.email_error
            ? `Setup email failed: ${data.email_error}`
            : 'Setup email could not be sent — check Resend configuration'
        );
      }
      setAccessRequests(p => p.filter(r => r.id !== req.id));
    } catch (e: any) {
      toast.error('Approval failed', e.message);
    }
  }

  // ── Queue counts ──────────────────────────────────────────────────────────

  const QUEUE_TABS: { id: QueueTab; label: string; count: number }[] = [
    { id: 'access', label: 'Access Requests', count: accessRequests.length },
    { id: 'creators', label: 'Creator Approvals', count: creators.length },
    { id: 'content', label: 'Content Approvals', count: content.length },
    { id: 'reports', label: 'Reports', count: reports.length },
    { id: 'transactions', label: 'Transactions', count: transactions.length },
  ];

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm border-b border-gold-border/20 px-8 py-4 flex items-center justify-between">
          <div>
            <p className="section-eyebrow mb-0.5">Admin</p>
            <h1 className="font-serif text-xl text-white">Control Center</h1>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-arc-muted hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="px-8 py-8 space-y-10">

          {/* ── Stats Grid ───────────────────────────────────────────────── */}
          <section>
            <p className="section-eyebrow mb-4">Platform Overview</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard label="Pending Access" value={stats?.pendingAccessRequests ?? '—'} sub="Awaiting review" accent icon={<Clock className="w-4 h-4" />} />
              <StatCard label="Creator Queue" value={stats?.pendingCreators ?? '—'} sub="Pending approval" icon={<Crown className="w-4 h-4" />} />
              <StatCard label="Content Queue" value={stats?.pendingContent ?? '—'} sub="Pending review" icon={<Image className="w-4 h-4" />} />
              <StatCard label="Open Reports" value={stats?.openReports ?? '—'} sub="Require action" icon={<Flag className="w-4 h-4" />} />
              <StatCard label="Total Users" value={stats?.totalUsers ?? '—'} sub={`${stats?.approvedUsers ?? 0} approved`} icon={<Users className="w-4 h-4" />} />
              <StatCard label="Total Creators" value={stats?.totalCreators ?? '—'} sub="Approved creators" icon={<Star className="w-4 h-4" />} />
              <StatCard label="Active Subs" value={stats?.activeSubscriptions ?? '—'} sub="Current subscriptions" icon={<TrendingUp className="w-4 h-4" />} />
              <StatCard label="Platform Fees" value={stats ? formatCurrency(stats.totalRevenue) : '—'} sub="Total earned" accent icon={<DollarSign className="w-4 h-4" />} />
              <StatCard label="Total Volume" value={stats ? formatCurrency(stats.totalVolume) : '—'} sub="All transactions" icon={<DollarSign className="w-4 h-4" />} />
              <StatCard label="Pending Payouts" value="$0.00" sub="No outstanding" icon={<ArrowDownToLine className="w-4 h-4" />} />
            </div>
          </section>

          {/* ── System Health ────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="section-eyebrow">System Health</p>
              <button
                onClick={loadHealth}
                disabled={healthLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-arc-muted hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${healthLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {health ? (
              <div className="space-y-4">
                {/* Overall banner */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
                  health.overall === 'healthy'
                    ? 'bg-arc-success/10 border-arc-success/30 text-arc-success'
                    : health.overall === 'critical'
                    ? 'bg-arc-error/10 border-arc-error/30 text-arc-error'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  <Activity className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium capitalize">{health.overall}</span>
                  {health.degraded.length > 0 && (
                    <span className="text-xs opacity-75">— {health.degraded.join(', ')} degraded</span>
                  )}
                  <span className="ml-auto text-xs opacity-50">
                    {new Date(health.generated_at).toLocaleTimeString()}
                  </span>
                </div>

                {/* Service checks */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'auth', label: 'Auth', icon: <Shield className="w-3.5 h-3.5" /> },
                    { key: 'database', label: 'Database', icon: <Database className="w-3.5 h-3.5" /> },
                    { key: 'cloudinary', label: 'Cloudinary', icon: <Cloud className="w-3.5 h-3.5" /> },
                    { key: 'stripe', label: 'Stripe', icon: <CreditCard className="w-3.5 h-3.5" /> },
                  ].map(({ key, label, icon }) => {
                    const check = health.checks[key as keyof typeof health.checks] as SystemHealthCheck | undefined;
                    const ok = check?.ok ?? false;
                    return (
                      <div key={key} className={`card-surface rounded-xl p-4 border ${ok ? 'border-arc-success/20' : 'border-arc-error/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={ok ? 'text-arc-success' : 'text-arc-error'}>{icon}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ok ? 'bg-arc-success/10 text-arc-success' : 'bg-arc-error/10 text-arc-error'}`}>
                            {ok ? 'OK' : 'FAIL'}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-white">{label}</p>
                        <p className="text-[10px] text-arc-muted mt-0.5 truncate">
                          {check?.status ?? check?.detail ?? (ok ? 'operational' : 'check failed')}
                        </p>
                        {check?.note && <p className="text-[10px] text-amber-400 mt-1 truncate">{check.note}</p>}
                        {check?.webhook_note && <p className="text-[10px] text-amber-400 mt-1 truncate">{check.webhook_note}</p>}
                      </div>
                    );
                  })}
                </div>

                {/* Last failures + webhook row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="card-surface rounded-xl p-4 border border-gold-border/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-3.5 h-3.5 text-arc-muted" />
                      <span className="text-xs text-arc-muted">Webhook Last Received</span>
                    </div>
                    <p className="text-xs text-white truncate">
                      {health.checks.webhook_last_received?.received_at
                        ? new Date(health.checks.webhook_last_received.received_at).toLocaleString()
                        : health.checks.webhook_last_received?.event_type
                        ? `${health.checks.webhook_last_received.event_type}`
                        : 'None recorded'}
                    </p>
                    {health.checks.webhook_last_received?.event_type && health.checks.webhook_last_received?.received_at && (
                      <p className="text-[10px] text-arc-muted mt-0.5">{health.checks.webhook_last_received.event_type}</p>
                    )}
                  </div>
                  <div className="card-surface rounded-xl p-4 border border-gold-border/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Cloud className="w-3.5 h-3.5 text-arc-muted" />
                      <span className="text-xs text-arc-muted">Last Upload Failure</span>
                    </div>
                    <p className="text-xs text-white truncate">
                      {health.checks.last_upload_failure?.at
                        ? new Date(health.checks.last_upload_failure.at).toLocaleString()
                        : 'None recorded'}
                    </p>
                    {health.checks.last_upload_failure?.creator_user_id && (
                      <p className="text-[10px] text-arc-muted mt-0.5 truncate">
                        creator: {health.checks.last_upload_failure.creator_user_id}
                      </p>
                    )}
                  </div>
                  <div className="card-surface rounded-xl p-4 border border-gold-border/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-3.5 h-3.5 text-arc-muted" />
                      <span className="text-xs text-arc-muted">Last Payment Failure</span>
                    </div>
                    <p className="text-xs text-white truncate">
                      {health.checks.last_payment_failure?.at
                        ? new Date(health.checks.last_payment_failure.at).toLocaleString()
                        : 'None recorded'}
                    </p>
                    {(health.checks.last_payment_failure as any)?.event_type && (
                      <p className="text-[10px] text-arc-muted mt-0.5">{(health.checks.last_payment_failure as any).event_type}</p>
                    )}
                  </div>
                </div>

                {/* Fulfillment needs attention */}
                {health.checks.fulfillment_needs_attention && health.checks.fulfillment_needs_attention.length > 0 && (
                  <div className="card-surface rounded-xl p-4 border border-arc-error/30">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-3.5 h-3.5 text-arc-error" />
                      <span className="text-xs font-medium text-arc-error">
                        {health.checks.fulfillment_needs_attention.length} Fulfillment(s) Needing Attention
                      </span>
                    </div>
                    <div className="space-y-2">
                      {health.checks.fulfillment_needs_attention.slice(0, 5).map((f) => (
                        <div key={f.id} className="flex items-start gap-3 text-[11px]">
                          <span className="text-arc-muted font-mono truncate max-w-[180px]">{f.stripe_session_id}</span>
                          <span className="text-arc-error truncate flex-1">{f.last_error}</span>
                          <span className="text-arc-muted flex-shrink-0">{new Date(f.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent audit events */}
                {health.checks.recent_audit_events && health.checks.recent_audit_events.length > 0 && (
                  <div className="card-surface rounded-xl p-4 border border-gold-border/20">
                    <p className="text-xs text-arc-muted mb-3">Recent Audit Events</p>
                    <div className="space-y-1.5">
                      {health.checks.recent_audit_events.slice(0, 8).map((ev, i) => (
                        <div key={i} className="flex items-center gap-3 text-[11px]">
                          <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${ev.status === 'failure' ? 'bg-arc-error' : ev.status === 'pending' ? 'bg-amber-400' : 'bg-arc-success'}`} />
                          <span className="text-arc-muted font-mono">{new Date(ev.created_at).toLocaleTimeString()}</span>
                          <span className="text-white">{ev.event_type.replace(/_/g, ' ')}</span>
                          <span className="text-arc-muted truncate">{ev.actor_user_id ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : healthLoading ? (
              <div className="flex items-center gap-3 p-6 card-surface rounded-xl border border-gold-border/20">
                <RefreshCw className="w-4 h-4 text-arc-muted animate-spin" />
                <span className="text-xs text-arc-muted">Running health checks…</span>
              </div>
            ) : null}
          </section>

          {/* ── Upload Failures ───────────────────────────────────────────── */}
          {(uploadFailures.length > 0 || failuresLoading) && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="section-eyebrow">Upload Failures</p>
                <button onClick={loadFailures} className="flex items-center gap-1.5 text-xs text-arc-muted hover:text-white transition-colors">
                  <RefreshCw className={`w-3 h-3 ${failuresLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              {failuresLoading ? (
                <div className="flex items-center gap-3 p-4 card-surface rounded-xl border border-gold-border/20">
                  <RefreshCw className="w-4 h-4 text-arc-muted animate-spin" />
                  <span className="text-xs text-arc-muted">Loading…</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadFailures.slice(0, 10).map((f) => (
                    <div key={f.id} className="flex items-start gap-3 p-4 card-surface rounded-xl border border-arc-error/20">
                      <AlertTriangle className="w-4 h-4 text-arc-error flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-medium text-white truncate">{f.display_name || f.username}</p>
                          <span className="text-[10px] text-arc-muted">{f.email}</span>
                        </div>
                        <p className="text-[11px] text-arc-error truncate">{f.failure_reason ?? 'Unknown failure'}</p>
                        <p className="text-[10px] text-arc-muted mt-0.5">{new Date(f.updated_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Action Queues ─────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <p className="section-eyebrow">Action Queues</p>
              <div className="flex items-center gap-1">
                {QUEUE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveQueue(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                      activeQueue === tab.id
                        ? 'bg-gold/10 text-gold border border-gold/25'
                        : 'text-arc-muted hover:text-white bg-white/5 border border-transparent'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeQueue === tab.id ? 'bg-gold/20 text-gold' : 'bg-white/10 text-arc-muted'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Access Requests Queue */}
            {activeQueue === 'access' && (
              <QueueShell label="Access Requests" count={accessRequests.length} desc="Approve to grant platform access. Rejected users are notified by email.">
                {accessRequests.length === 0 && <EmptyQueue />}
                {accessRequests.map((req) => (
                  <div key={req.id} className="card-surface rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={req.name} size="sm" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">{req.name}</p>
                            <StatusBadge status={req.status} />
                          </div>
                          <p className="text-xs text-arc-muted mt-0.5">{req.email} · {timeAgo(req.created_at)} · Role: <span className="capitalize">{req.requested_role ?? 'fan'}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <ActionBtn label="Approve" variant="green" icon={<CheckCircle className="w-3.5 h-3.5" />}
                          onClick={() => approveUser(req)} />
                        <ActionBtn label="Reject" variant="red" icon={<XCircle className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/users/${req.id}/reject`, `${req.name} rejected`,
                            () => setAccessRequests((p) => p.filter((r) => r.id !== req.id)))} />
                        <ActionBtn label="More Info" variant="amber" icon={<MessageSquare className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/users/${req.id}/request-more-info`, `More info requested from ${req.name}`, () => {})} />
                        <ActionBtn label="Suspend" variant="ghost"
                          onClick={() => action(`/api/admin/users/${req.id}/suspend`, `${req.name} suspended`,
                            () => setAccessRequests((p) => p.filter((r) => r.id !== req.id)))} />
                      </div>
                    </div>
                    {req.reason && (
                      <div className="bg-bg-hover rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-gold uppercase tracking-wide mb-1">Reason for joining</p>
                        <p className="text-xs text-arc-secondary leading-relaxed">{req.reason}</p>
                      </div>
                    )}
                  </div>
                ))}
              </QueueShell>
            )}

            {/* Creator Approvals Queue */}
            {activeQueue === 'creators' && (
              <QueueShell label="Creator Applications" count={creators.length} desc="Review creator applications. Approved creators can publish content immediately.">
                {creators.length === 0 && <EmptyQueue />}
                {creators.map((app) => (
                  <div key={app.id} className="card-surface rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={app.avatar_url} name={app.display_name} size="sm" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">{app.display_name}</p>
                            <StatusBadge status={app.application_status} />
                          </div>
                          <p className="text-xs text-arc-muted mt-0.5">@{app.username} · {app.email}</p>
                          <p className="text-xs text-arc-muted mt-0.5">Applied {timeAgo(app.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <ActionBtn label="Approve" variant="green" icon={<CheckCircle className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/creators/${app.id}/approve`, `${app.display_name} approved as creator`,
                            () => setCreators((p) => p.filter((c) => c.id !== app.id)))} />
                        <ActionBtn label="Reject" variant="red" icon={<XCircle className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/creators/${app.id}/reject`, `${app.display_name} rejected`,
                            () => setCreators((p) => p.filter((c) => c.id !== app.id)))} />
                        <ActionBtn label="More Info" variant="amber" icon={<MessageSquare className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/creators/${app.id}/request-more-info`, `More info requested`, () => {})} />
                        <ActionBtn label="Suspend" variant="ghost"
                          onClick={() => action(`/api/admin/creators/${app.id}/suspend`, `${app.display_name} suspended`,
                            () => setCreators((p) => p.filter((c) => c.id !== app.id)))} />
                      </div>
                    </div>
                    {(app.bio || app.pitch) && (
                      <div className="grid grid-cols-1 gap-2">
                        {app.bio && (
                          <div className="bg-bg-hover rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-gold uppercase tracking-wide mb-1">Bio</p>
                            <p className="text-xs text-arc-secondary leading-relaxed">{app.bio}</p>
                          </div>
                        )}
                        {app.pitch && (
                          <div className="bg-bg-hover rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-gold uppercase tracking-wide mb-1">Pitch</p>
                            <p className="text-xs text-arc-secondary leading-relaxed">{app.pitch}</p>
                          </div>
                        )}
                        {app.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {app.tags.map((tag) => (
                              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </QueueShell>
            )}

            {/* Content Approvals Queue */}
            {activeQueue === 'content' && (
              <QueueShell label="Content Approvals" count={content.length} desc="Review and approve creator content. Content is not visible until approved.">
                {content.length === 0 && <EmptyQueue />}
                {content.map((item) => (
                  <div key={item.id} className="card-surface rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={item.creator_avatar} name={item.creator_name} size="sm" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white">{item.title}</p>
                            <StatusBadge status={item.status} />
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-arc-muted uppercase tracking-wide">{item.content_type}</span>
                          </div>
                          <p className="text-xs text-arc-muted mt-0.5">by {item.creator_name} · {formatCurrency(item.price)} · {timeAgo(item.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <ActionBtn label="Approve" variant="green" icon={<CheckCircle className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/content/${item.id}/approve`, `"${item.title}" approved — now live`,
                            () => setContent((p) => p.filter((c) => c.id !== item.id)))} />
                        <ActionBtn label="Reject" variant="red" icon={<XCircle className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/content/${item.id}/reject`, `"${item.title}" rejected`,
                            () => setContent((p) => p.filter((c) => c.id !== item.id)))} />
                        <ActionBtn label="Request Changes" variant="amber" icon={<MessageSquare className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/content/${item.id}/request-changes`, `Changes requested on "${item.title}"`,
                            () => setContent((p) => p.filter((c) => c.id !== item.id)))} />
                        <ActionBtn label="Remove" variant="ghost" icon={<XCircle className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/content/${item.id}/remove`, `"${item.title}" removed`,
                            () => setContent((p) => p.filter((c) => c.id !== item.id)))} />
                      </div>
                    </div>
                    {item.description && (
                      <div className="bg-bg-hover rounded-lg p-3">
                        <p className="text-xs text-arc-secondary leading-relaxed">{item.description}</p>
                      </div>
                    )}
                  </div>
                ))}
              </QueueShell>
            )}

            {/* Reports Queue */}
            {activeQueue === 'reports' && (
              <QueueShell label="Open Reports" count={reports.length} desc="Review user-submitted reports. Take action or dismiss as appropriate.">
                {reports.length === 0 && <EmptyQueue />}
                {reports.map((rpt) => (
                  <div key={rpt.id} className="card-surface rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-medium text-white capitalize">{rpt.subject_type} Report</p>
                          <StatusBadge status={rpt.status} />
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-arc-error/10 border border-arc-error/20 text-arc-error">{rpt.reason}</span>
                        </div>
                        <p className="text-xs text-arc-muted">Reported by {rpt.reporter_name} (@{rpt.reporter_username}) · {timeAgo(rpt.created_at)}</p>
                        <p className="text-xs text-arc-muted mt-0.5">Subject ID: <span className="font-mono text-arc-secondary">{rpt.subject_id}</span></p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <ActionBtn label="Dismiss" variant="ghost"
                          onClick={() => action(`/api/admin/reports/${rpt.id}/dismiss`, 'Report dismissed',
                            () => setReports((p) => p.filter((r) => r.id !== rpt.id)))} />
                        <ActionBtn label="Take Action" variant="amber" icon={<AlertTriangle className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/reports/${rpt.id}/take-action`, 'Action taken on report',
                            () => setReports((p) => p.filter((r) => r.id !== rpt.id)))} />
                        <ActionBtn label="Escalate" variant="red" icon={<ChevronRight className="w-3.5 h-3.5" />}
                          onClick={() => action(`/api/admin/reports/${rpt.id}/escalate`, 'Report escalated',
                            () => setReports((p) => p.filter((r) => r.id !== rpt.id)))} />
                      </div>
                    </div>
                    {rpt.details && (
                      <div className="bg-bg-hover rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-arc-muted uppercase tracking-wide mb-1">Details</p>
                        <p className="text-xs text-arc-secondary leading-relaxed">{rpt.details}</p>
                      </div>
                    )}
                  </div>
                ))}
              </QueueShell>
            )}
            {/* Transactions */}
            {activeQueue === 'transactions' && (
              <QueueShell label="Transactions" count={transactions.length} desc="All completed payments. Platform fee is 30%, creator receives 70%.">
                {transactions.length === 0 && <EmptyQueue />}
                {transactions.map((tx) => (
                  <div key={tx.id} className="card-surface rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-medium text-white truncate">{tx.content_title ?? tx.ref_type}</p>
                          <StatusBadge status={tx.status} />
                        </div>
                        <p className="text-xs text-arc-muted">
                          <span className="text-arc-secondary">{tx.payer_name}</span>
                          <span className="text-arc-muted"> → </span>
                          <span className="text-arc-secondary">{tx.payee_name}</span>
                          <span className="text-arc-muted"> · {timeAgo(tx.created_at)}</span>
                        </p>
                        <p className="text-[10px] text-arc-muted mt-0.5">{tx.payer_email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-serif text-lg text-gold">${Number(tx.amount).toFixed(2)}</p>
                        <p className="text-[10px] text-arc-muted mt-0.5">
                          Fee: <span className="text-arc-secondary">${Number(tx.platform_fee).toFixed(2)}</span>
                          {' · '}Creator: <span className="text-arc-success">${Number(tx.net_amount).toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </QueueShell>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// ─── Queue Shell ──────────────────────────────────────────────────────────────

function QueueShell({ label, count, desc, children }: { label: string; count: number; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-lg text-white">{label}</h2>
          <p className="text-xs text-arc-secondary mt-0.5">{count} pending · {desc}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EmptyQueue() {
  return (
    <div className="flex items-center justify-center py-16 rounded-xl border border-dashed border-white/10">
      <div className="text-center">
        <CheckCircle className="w-8 h-8 text-arc-success/50 mx-auto mb-3" />
        <p className="text-sm text-arc-muted">All clear — no pending items.</p>
      </div>
    </div>
  );
}
