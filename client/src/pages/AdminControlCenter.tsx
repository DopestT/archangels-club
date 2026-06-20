import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown, Users, DollarSign, Flag, LayoutDashboard,
  UserCheck, Image, CheckCircle, XCircle, MessageSquare, AlertTriangle,
  RefreshCw, Star, ArrowDownToLine, TrendingUp, Clock, Shield,
  ChevronRight, Bug, Zap, Activity, Lock, Video, Music, FileText,
  Eye, Radio, Layers, ScrollText,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import Avatar from '../components/ui/Avatar';
import { formatCurrency, timeAgo } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/api';
import AdminSidebar from '../components/admin/AdminSidebar';
import PulseStatusPanel from '../components/pulse/PulseStatusPanel';


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

type QueueTab = 'access' | 'creators' | 'content' | 'reports' | 'transactions' | 'payouts' | 'audit';

interface AuditLogEntry {
  id: string;
  actor_admin_id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  previous_state: string | null;
  new_state: string | null;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
}

interface PayoutRequest {
  id: string;
  creator_id: string;
  display_name: string;
  email: string;
  username: string;
  amount_dollars: string;
  payment_method: string;
  notes: string;
  status: 'pending' | 'paid' | 'rejected';
  admin_note: string;
  created_at: string;
}

// ─── Content type icons ───────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <Image className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  audio: <Music className="w-3.5 h-3.5" />,
  text: <FileText className="w-3.5 h-3.5" />,
};

// ─── LiveDot ──────────────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-arc-error animate-pulse" />
      <span className="text-[10px] font-semibold tracking-widest text-arc-error">LIVE</span>
    </span>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

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

// ─── ActionBtn ────────────────────────────────────────────────────────────────

function ActionBtn({ label, variant, onClick, icon }: { label: string; variant: 'green' | 'red' | 'amber' | 'ghost'; onClick: () => void; icon?: React.ReactNode }) {
  const styles = {
    green: 'bg-arc-success/10 text-arc-success hover:bg-arc-success/20 border-arc-success/25',
    red: 'bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border-arc-error/25',
    amber: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/25',
    ghost: 'bg-white/5 text-arc-muted hover:bg-white/10 border-white/10',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all duration-200 ${styles[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── SignalTile ───────────────────────────────────────────────────────────────

function SignalTile({ label, value, sub, urgent, icon }: { label: string; value: string | number; sub?: string; urgent?: boolean; icon: React.ReactNode }) {
  return (
    <div
      className={`rounded-xl p-4 border transition-all duration-200 bg-bg-surface ${
        urgent ? 'border-gold/28' : 'border-white/5'
      }`}
      style={urgent ? { boxShadow: '0 0 18px rgba(212,175,55,0.10)' } : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold tracking-widest uppercase text-arc-muted">{label}</span>
        <span className={urgent ? 'text-gold/70' : 'text-arc-muted/35'}>{icon}</span>
      </div>
      <p className={`font-serif text-2xl font-normal ${urgent ? 'text-gold' : 'text-arc-muted/60'}`}>{value}</p>
      {sub && <p className="text-[11px] text-arc-muted mt-1">{sub}</p>}
    </div>
  );
}

// ─── LiveFeed ─────────────────────────────────────────────────────────────────

interface FeedItem {
  type: string;
  dotCls: string;
  icon: React.ElementType;
  text: string;
  sub: string | null | undefined;
  time: string;
}

function LiveFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Activity className="w-5 h-5 text-arc-muted/30 mb-2" />
        <p className="text-[11px] text-arc-muted">No recent activity</p>
        <p className="text-[10px] text-arc-muted/50 mt-0.5">Events will appear here as they occur</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-white/4">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.dotCls}`} />
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] text-arc-secondary leading-snug truncate">{item.text}</p>
            {item.sub && <p className="text-[10px] text-arc-muted truncate mt-0.5">{item.sub}</p>}
          </div>
          <span className="text-[9.5px] text-arc-muted/45 flex-shrink-0 tabular-nums">{timeAgo(item.time)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── QueueShell ───────────────────────────────────────────────────────────────

function QueueShell({ label, count, desc, children }: { label: string; count: number; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-base text-white">{label}</h2>
          <p className="text-[11px] text-arc-secondary mt-0.5">{count} pending · {desc}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EmptyQueue() {
  return (
    <div className="flex items-center justify-center py-14 rounded-xl border border-dashed border-white/8">
      <div className="text-center">
        <CheckCircle className="w-7 h-7 text-arc-success/40 mx-auto mb-3" />
        <p className="text-sm text-arc-muted">All clear — no pending items.</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminControlCenter() {
  const toast = useToast();
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeQueue, setActiveQueue] = useState<QueueTab>('access');
  const [loading, setLoading] = useState(false);
  const [timestamp, setTimestamp] = useState(() => new Date());

  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [creators, setCreators] = useState<CreatorApplication[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [payoutNote, setPayoutNote] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setTimestamp(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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
      const [s, ar, cr, co, rp, tx, pr, al] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/access-requests'),
        adminFetch('/api/admin/creators/pending'),
        adminFetch('/api/admin/content-approvals'),
        adminFetch('/api/admin/reports'),
        adminFetch('/api/admin/transactions'),
        adminFetch('/api/admin/payout-requests?status=pending'),
        adminFetch('/api/admin/audit-logs?limit=200'),
      ]);
      setStats(s);
      setAccessRequests(ar);
      setCreators(cr);
      setContent(co);
      setReports(rp);
      setTransactions(tx);
      if (Array.isArray(pr)) setPayoutRequests(pr);
      if (Array.isArray(al)) setAuditLogs(al);
    } catch (e: any) {
      toast.error('Failed to load data', e.message);
    } finally {
      setLoading(false);
    }
  }, [adminFetch, toast]);

  useEffect(() => { loadAll(); }, []);

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

  // ── Derived values ────────────────────────────────────────────────────────

  const urgentCount = accessRequests.length + creators.length + reports.length;

  const QUEUE_TABS: { id: QueueTab; label: string; count: number }[] = [
    { id: 'access', label: 'Access Requests', count: accessRequests.length },
    { id: 'creators', label: 'Creator Apps', count: creators.length },
    { id: 'content', label: 'Content Review', count: content.length },
    { id: 'reports', label: 'Reports', count: reports.length },
    { id: 'transactions', label: 'Transactions', count: transactions.length },
    { id: 'payouts', label: 'Payout Requests', count: payoutRequests.length },
    { id: 'audit', label: 'Audit Log', count: auditLogs.length },
  ];

  const urgentTabIds: QueueTab[] = ['access', 'creators', 'reports'];

  // ── Live feed derivation ──────────────────────────────────────────────────

  const feedItems: FeedItem[] = [
    ...transactions.slice(0, 5).map(tx => ({
      type: 'transaction',
      dotCls: 'bg-gold',
      icon: DollarSign,
      text: `${tx.payer_name} → ${tx.payee_name} · ${formatCurrency(tx.amount)}`,
      sub: tx.content_title ?? tx.ref_type,
      time: tx.created_at,
    })),
    ...accessRequests.slice(0, 3).map(r => ({
      type: 'access',
      dotCls: 'bg-blue-400',
      icon: UserCheck,
      text: `Access request: ${r.name}`,
      sub: r.email,
      time: r.created_at,
    })),
    ...creators.slice(0, 3).map(c => ({
      type: 'creator',
      dotCls: 'bg-amber-400',
      icon: Crown,
      text: `Creator application: ${c.display_name}`,
      sub: `@${c.username}`,
      time: c.created_at,
    })),
    ...reports.slice(0, 3).map(r => ({
      type: 'report',
      dotCls: 'bg-arc-error',
      icon: Flag,
      text: `Report filed: ${r.reason}`,
      sub: `by ${r.reporter_name}`,
      time: r.created_at,
    })),
    ...content.slice(0, 3).map(c => ({
      type: 'content',
      dotCls: 'bg-arc-success',
      icon: Layers,
      text: `Content submitted: "${c.title}"`,
      sub: `by ${c.creator_name}`,
      time: c.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 15);

  // ── Timestamp formatting ──────────────────────────────────────────────────

  const timeString = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateString = timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <AdminSidebar badges={{
        '/admin/access-requests': accessRequests.length,
        '/admin/creator-approvals': creators.length,
        '/admin/content-approvals': content.length,
        '/admin/flagged': reports.length,
      }} />

      <main className="flex-1 overflow-y-auto min-w-0">

        {/* ── Command Header ──────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-bg-primary/95 backdrop-blur-md border-b border-white/5">
          <div className="px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1
                    className="text-[11px] font-bold tracking-[0.18em] uppercase text-white"
                  >
                    Archangels Command Center
                  </h1>
                  <LiveDot />
                </div>
                <p className="text-[10px] text-arc-muted/60 mt-0.5 tracking-wide">Operational intelligence dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[13px] font-mono text-arc-secondary tabular-nums">{timeString}</p>
                <p className="text-[10px] text-arc-muted/60">{dateString}</p>
              </div>
              <button
                onClick={loadAll}
                disabled={loading}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] text-arc-muted hover:text-white bg-white/5 hover:bg-white/8 border border-white/8 transition-all duration-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Precision signal strip — per-type breakdown instead of generic alert */}
          {urgentCount > 0 && (
            <div className="px-8 py-2 border-t border-white/5 flex items-center gap-5 overflow-x-auto no-scrollbar">
              {accessRequests.length > 0 && (
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-[10px] text-blue-400 font-medium tabular-nums">
                    {accessRequests.length} access {accessRequests.length === 1 ? 'request' : 'requests'}
                  </span>
                </span>
              )}
              {creators.length > 0 && (
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-[10px] text-amber-400 font-medium tabular-nums">
                    {creators.length} creator {creators.length === 1 ? 'application' : 'applications'}
                  </span>
                </span>
              )}
              {reports.length > 0 && (
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-arc-error flex-shrink-0"
                    style={{ animation: 'pulseSignalDot 2s ease-in-out infinite' }}
                  />
                  <span className="text-[10px] text-arc-error font-medium tabular-nums">
                    {reports.length} open {reports.length === 1 ? 'report' : 'reports'}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="px-8 py-8 space-y-8">

          {/* ── Pulse Status ─────────────────────────────────────────────── */}
          <PulseStatusPanel
            transactions={transactions}
            accessRequests={accessRequests}
            reports={reports}
            creators={creators}
            content={content}
            loading={loading}
          />

          {/* ── Signal Board ─────────────────────────────────────────────── */}
          <section>
            <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted mb-4">Signal Board</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <SignalTile
                label="Pending Access"
                value={stats?.pendingAccessRequests ?? '—'}
                sub="Awaiting review"
                urgent={(stats?.pendingAccessRequests ?? 0) > 0}
                icon={<Clock className="w-4 h-4" />}
              />
              <SignalTile
                label="Creator Queue"
                value={stats?.pendingCreators ?? '—'}
                sub="Pending approval"
                urgent={(stats?.pendingCreators ?? 0) > 0}
                icon={<Crown className="w-4 h-4" />}
              />
              <SignalTile
                label="Content Queue"
                value={stats?.pendingContent ?? '—'}
                sub="Pending review"
                urgent={(stats?.pendingContent ?? 0) > 0}
                icon={<Image className="w-4 h-4" />}
              />
              <SignalTile
                label="Open Reports"
                value={stats?.openReports ?? '—'}
                sub="Require action"
                urgent={(stats?.openReports ?? 0) > 0}
                icon={<Flag className="w-4 h-4" />}
              />
              <SignalTile
                label="Platform Revenue"
                value={stats ? formatCurrency(stats.totalRevenue) : '—'}
                sub="Total earned"
                urgent={(stats?.totalRevenue ?? 0) > 0}
                icon={<DollarSign className="w-4 h-4" />}
              />
              <SignalTile
                label="Active Subscriptions"
                value={stats?.activeSubscriptions ?? '—'}
                sub="Current subs"
                urgent={(stats?.activeSubscriptions ?? 0) > 0}
                icon={<TrendingUp className="w-4 h-4" />}
              />
            </div>
          </section>

          {/* ── Main body 2-col ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ── Left: Priority Queue ──────────────────────────────────── */}
            <div className="lg:col-span-3 space-y-4">
              {/* Panel header */}
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted">Priority Queue</p>
              </div>

              {/* Tab bar */}
              <div className="flex flex-wrap gap-1.5">
                {QUEUE_TABS.map((tab) => {
                  const isActive = activeQueue === tab.id;
                  const isUrgent = urgentTabIds.includes(tab.id) && tab.count > 0;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveQueue(tab.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                        isActive
                          ? 'bg-gold/10 text-gold border-gold/25'
                          : isUrgent
                          ? 'text-amber-400 bg-amber-500/8 border-amber-500/20 hover:bg-amber-500/12'
                          : 'text-arc-muted bg-white/5 border-white/8 hover:text-white hover:bg-white/8'
                      }`}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            isActive
                              ? 'bg-gold/20 text-gold'
                              : isUrgent
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-white/10 text-arc-muted'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Queue panels */}
              <div className="rounded-xl border border-white/5 bg-bg-surface overflow-hidden">
                <div className="p-5">

                  {/* Access Requests */}
                  {activeQueue === 'access' && (
                    <QueueShell label="Access Requests" count={accessRequests.length} desc="Approve to grant platform access. Rejected users are notified by email.">
                      {accessRequests.length === 0 && <EmptyQueue />}
                      {accessRequests.map((req) => (
                        <div
                          key={req.id}
                          className="rounded-xl p-4 border border-white/5 hover:border-gold/20 transition-all duration-200 bg-bg-primary"
                          style={{ boxShadow: '0 0 16px rgba(251,191,36,0.06)' }}
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={req.name} size="sm" />
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-white">{req.name}</p>
                                  <StatusBadge status={req.status} />
                                </div>
                                <p className="text-[11px] text-arc-muted mt-0.5">{req.email} · {timeAgo(req.created_at)} · Role: <span className="capitalize text-arc-secondary">{req.requested_role ?? 'fan'}</span></p>
                              </div>
                            </div>
                          </div>
                          {req.reason && (
                            <div className="bg-white/4 rounded-lg p-3 mb-3 border border-white/5">
                              <p className="text-[10px] font-semibold text-gold uppercase tracking-wide mb-1">Reason for joining</p>
                              <p className="text-[12px] text-arc-secondary leading-relaxed">{req.reason}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
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
                      ))}
                    </QueueShell>
                  )}

                  {/* Creator Applications */}
                  {activeQueue === 'creators' && (
                    <QueueShell label="Creator Applications" count={creators.length} desc="Review creator applications. Approved creators can publish content immediately.">
                      {creators.length === 0 && <EmptyQueue />}
                      {creators.map((app) => (
                        <div
                          key={app.id}
                          className="rounded-xl p-4 border border-amber-500/20 hover:border-gold/25 transition-all duration-200 bg-bg-primary"
                          style={{ boxShadow: '0 0 16px rgba(251,191,36,0.06)' }}
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar src={app.avatar_url} name={app.display_name} size="sm" />
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-white">{app.display_name}</p>
                                  <StatusBadge status={app.application_status} />
                                </div>
                                <p className="text-[11px] text-arc-muted mt-0.5">@{app.username} · {app.email}</p>
                                <p className="text-[11px] text-arc-muted mt-0.5">Applied {timeAgo(app.created_at)}</p>
                              </div>
                            </div>
                          </div>
                          {(app.bio || app.pitch) && (
                            <div className="space-y-2 mb-3">
                              {app.bio && (
                                <div className="bg-white/4 rounded-lg p-3 border border-white/5">
                                  <p className="text-[10px] font-semibold text-gold uppercase tracking-wide mb-1">Bio</p>
                                  <p className="text-[12px] text-arc-secondary leading-relaxed">{app.bio}</p>
                                </div>
                              )}
                              {app.pitch && (
                                <div className="bg-white/4 rounded-lg p-3 border border-white/5">
                                  <p className="text-[10px] font-semibold text-gold uppercase tracking-wide mb-1">Pitch</p>
                                  <p className="text-[12px] text-arc-secondary leading-relaxed">{app.pitch}</p>
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
                          <div className="flex items-center gap-2 flex-wrap">
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
                      ))}
                    </QueueShell>
                  )}

                  {/* Content Review */}
                  {activeQueue === 'content' && (
                    <QueueShell label="Content Approvals" count={content.length} desc="Review and approve creator content. Content is not visible until approved.">
                      {content.length === 0 && <EmptyQueue />}
                      {content.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl p-4 border border-white/5 hover:border-gold/20 transition-all duration-200 bg-bg-primary"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <Avatar src={item.creator_avatar} name={item.creator_name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <p className="text-sm font-medium text-white truncate">{item.title}</p>
                                <StatusBadge status={item.status} />
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-arc-muted uppercase tracking-wide">
                                  {TYPE_ICONS[item.content_type] ?? null}
                                  {item.content_type}
                                </span>
                              </div>
                              <p className="text-[11px] text-arc-muted">
                                by <span className="text-arc-secondary">{item.creator_name}</span>
                                {' · '}
                                <span className="text-gold">{formatCurrency(item.price)}</span>
                                {' · '}
                                {timeAgo(item.created_at)}
                              </p>
                            </div>
                          </div>
                          {item.description && (
                            <div className="bg-white/4 rounded-lg p-3 border border-white/5 mb-3">
                              <p className="text-[12px] text-arc-secondary leading-relaxed">{item.description}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
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
                      ))}
                    </QueueShell>
                  )}

                  {/* Reports */}
                  {activeQueue === 'reports' && (
                    <QueueShell label="Open Reports" count={reports.length} desc="Review user-submitted reports. Take action or dismiss as appropriate.">
                      {reports.length === 0 && <EmptyQueue />}
                      {reports.map((rpt) => (
                        <div
                          key={rpt.id}
                          className="rounded-xl p-4 border border-arc-error/20 hover:border-arc-error/30 transition-all duration-200 bg-bg-primary"
                          style={{ boxShadow: '0 0 16px rgba(239,68,68,0.05)' }}
                        >
                          <div className="mb-3">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-medium text-white capitalize">{rpt.subject_type} Report</p>
                              <StatusBadge status={rpt.status} />
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-arc-error/10 border border-arc-error/20 text-arc-error">{rpt.reason}</span>
                            </div>
                            <p className="text-[11px] text-arc-muted">Reported by <span className="text-arc-secondary">{rpt.reporter_name}</span> (@{rpt.reporter_username}) · {timeAgo(rpt.created_at)}</p>
                            <p className="text-[11px] text-arc-muted mt-0.5">Subject ID: <span className="font-mono text-arc-secondary">{rpt.subject_id}</span></p>
                          </div>
                          {rpt.details && (
                            <div className="bg-white/4 rounded-lg p-3 border border-white/5 mb-3">
                              <p className="text-[10px] font-semibold text-arc-muted uppercase tracking-wide mb-1">Details</p>
                              <p className="text-[12px] text-arc-secondary leading-relaxed">{rpt.details}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
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
                      ))}
                    </QueueShell>
                  )}

                  {/* Transactions */}
                  {activeQueue === 'transactions' && (
                    <QueueShell label="Transactions" count={transactions.length} desc="All completed payments. Platform fee is 30%, creator receives 70%.">
                      {transactions.length === 0 && <EmptyQueue />}
                      {transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="rounded-xl p-4 border border-white/5 hover:border-gold/15 transition-all duration-200 bg-bg-primary"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="text-sm font-medium text-white truncate">{tx.content_title ?? tx.ref_type}</p>
                                <StatusBadge status={tx.status} />
                              </div>
                              <p className="text-[11px] text-arc-muted">
                                <span className="text-arc-secondary">{tx.payer_name}</span>
                                <span className="text-arc-muted mx-1.5">→</span>
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

                  {/* Payout Requests */}
                  {activeQueue === 'audit' && (
                    <QueueShell label="Audit Log" count={auditLogs.length} desc="Immutable record of every admin action. Read-only — cannot be edited from the dashboard.">
                      {auditLogs.length === 0 && <EmptyQueue />}
                      {auditLogs.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-xl p-4 border border-white/5 bg-bg-primary space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <ScrollText className="w-3.5 h-3.5 text-arc-muted shrink-0" />
                              <span className="text-xs font-mono font-medium text-gold truncate">
                                {entry.action.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span className="text-[10px] text-arc-muted shrink-0 font-mono">
                              {timeAgo(entry.created_at)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <div>
                              <span className="text-arc-muted">Admin: </span>
                              <span className="text-arc-secondary">{entry.actor_email ?? entry.actor_admin_id}</span>
                            </div>
                            <div>
                              <span className="text-arc-muted">Target: </span>
                              <span className="text-arc-secondary">{entry.target_type}</span>
                            </div>
                            {entry.previous_state && (
                              <div>
                                <span className="text-arc-muted">From: </span>
                                <span className="text-arc-secondary">{entry.previous_state}</span>
                              </div>
                            )}
                            {entry.new_state && (
                              <div>
                                <span className="text-arc-muted">To: </span>
                                <span className="text-arc-secondary">{entry.new_state}</span>
                              </div>
                            )}
                          </div>
                          {entry.reason && (
                            <p className="text-[11px] text-arc-secondary bg-white/4 px-3 py-1.5 rounded-lg border border-white/5 line-clamp-2">
                              {entry.reason}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-arc-muted font-mono">
                            <span className="truncate">ID: {entry.target_id.slice(0, 16)}…</span>
                            {entry.ip_address && <span>IP: {entry.ip_address}</span>}
                          </div>
                        </div>
                      ))}
                    </QueueShell>
                  )}

                  {activeQueue === 'payouts' && (
                    <QueueShell label="Payout Requests" count={payoutRequests.length} desc="Manual payout requests from creators not using Stripe Connect. Mark paid after processing outside the platform.">
                      {payoutRequests.length === 0 && <EmptyQueue />}
                      {payoutRequests.map((pr) => (
                        <div
                          key={pr.id}
                          className="rounded-xl p-4 border border-white/5 hover:border-gold/20 transition-all duration-200 bg-bg-primary"
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="text-sm font-medium text-white">{pr.display_name}</p>
                                <span className="text-[10px] text-arc-muted">@{pr.username}</span>
                                <StatusBadge status={pr.status} />
                              </div>
                              <p className="text-[11px] text-arc-muted">{pr.email}</p>
                              <p className="text-[11px] text-arc-muted mt-0.5">
                                Method: <span className="text-arc-secondary capitalize">{pr.payment_method.replace('_', ' ')}</span>
                                {' · '}
                                {timeAgo(pr.created_at)}
                              </p>
                              {pr.notes && (
                                <p className="text-[11px] text-arc-secondary mt-1.5 bg-white/4 px-3 py-2 rounded-lg border border-white/5">
                                  {pr.notes}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-serif text-xl text-gold">${Number(pr.amount_dollars).toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={payoutNote[pr.id] ?? ''}
                              onChange={e => setPayoutNote(prev => ({ ...prev, [pr.id]: e.target.value }))}
                              placeholder="Admin note (optional — e.g. sent via PayPal)"
                              className="w-full bg-bg-hover border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-arc-muted focus:outline-none focus:border-gold/40 transition-colors"
                              maxLength={200}
                            />
                            <div className="flex items-center gap-2 flex-wrap">
                              <ActionBtn
                                label="Mark Paid"
                                variant="green"
                                icon={<CheckCircle className="w-3.5 h-3.5" />}
                                onClick={async () => {
                                  try {
                                    await adminFetch(`/api/admin/payout-requests/${pr.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ status: 'paid', admin_note: payoutNote[pr.id] ?? '' }),
                                    });
                                    toast.success(`${pr.display_name}'s payout marked as paid`);
                                    setPayoutRequests(p => p.filter(r => r.id !== pr.id));
                                  } catch (e: any) { toast.error('Failed', e.message); }
                                }}
                              />
                              <ActionBtn
                                label="Reject"
                                variant="red"
                                icon={<XCircle className="w-3.5 h-3.5" />}
                                onClick={async () => {
                                  try {
                                    await adminFetch(`/api/admin/payout-requests/${pr.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ status: 'rejected', admin_note: payoutNote[pr.id] ?? '' }),
                                    });
                                    toast.success(`${pr.display_name}'s payout request rejected`);
                                    setPayoutRequests(p => p.filter(r => r.id !== pr.id));
                                  } catch (e: any) { toast.error('Failed', e.message); }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </QueueShell>
                  )}

                </div>
              </div>
            </div>

            {/* ── Right: Intelligence Panel ─────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Live Feed */}
              <div className="rounded-xl border border-white/5 bg-bg-surface overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted">Live Feed</p>
                    <p className="text-[11px] text-arc-secondary mt-0.5">Recent activity stream</p>
                  </div>
                  <Radio className="w-3.5 h-3.5 text-arc-success animate-pulse" />
                </div>
                <div className="px-5 py-4 max-h-[420px] overflow-y-auto">
                  <LiveFeed items={feedItems} />
                </div>
              </div>

              {/* Moderation Pressure + System */}
              <div className="rounded-xl border border-white/5 bg-bg-surface overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-white/5">
                  <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-arc-muted">Platform Health</p>
                  <p className="text-[11px] text-arc-secondary mt-0.5">Live pressure signals</p>
                </div>
                <div className="px-5 py-4 space-y-2.5">
                  {/* Dynamic pressure rows */}
                  {[
                    {
                      label: 'Access queue',
                      value: accessRequests.length,
                      threshold: 5,
                      icon: Star,
                    },
                    {
                      label: 'Creator pipeline',
                      value: creators.length,
                      threshold: 3,
                      icon: Crown,
                    },
                    {
                      label: 'Content backlog',
                      value: content.length,
                      threshold: 8,
                      icon: Image,
                    },
                    {
                      label: 'Open reports',
                      value: reports.length,
                      threshold: 3,
                      icon: Flag,
                    },
                  ].map(({ label, value, threshold, icon: Icon }) => {
                    const pct = Math.min(100, (value / threshold) * 100);
                    const hot = value >= threshold;
                    const warn = value > 0 && value < threshold;
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3 h-3 text-arc-muted/60" />
                            <span className="text-[11px] text-arc-secondary">{label}</span>
                          </div>
                          <span className={`text-[11px] font-mono font-semibold ${hot ? 'text-arc-error' : warn ? 'text-amber-400' : 'text-arc-success'}`}>
                            {value}
                          </span>
                        </div>
                        <div className="h-1 bg-white/6 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${hot ? 'bg-arc-error' : warn ? 'bg-amber-400' : 'bg-arc-success'}`}
                            style={{ width: value === 0 ? '100%' : `${Math.max(4, pct)}%`, opacity: value === 0 ? 0.25 : 1 }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Service status pills */}
                  <div className="pt-3 mt-1 border-t border-white/5 space-y-1.5">
                    {[
                      { label: 'Payments', icon: DollarSign },
                      { label: 'Auth',     icon: Shield },
                      { label: 'Payouts',  icon: ArrowDownToLine },
                      { label: 'Email',    icon: Zap },
                    ].map(({ label, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-arc-success flex-shrink-0" />
                        <Icon className="w-3 h-3 text-arc-muted/50" />
                        <span className="text-[11px] text-arc-muted">{label}</span>
                        <span className="ml-auto text-[10px] text-arc-success font-medium">Live</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <Link
                      to="/admin/bug-control"
                      className="flex items-center justify-between text-[11px] text-arc-muted hover:text-white transition-colors group"
                    >
                      <span className="flex items-center gap-2">
                        <Bug className="w-3.5 h-3.5" />
                        Bug Control Center
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
