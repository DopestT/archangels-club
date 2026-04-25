import React, { useState, useEffect } from 'react';
import {
  Users, DollarSign, Crown, Shield, Flag, TrendingUp,
  CheckCircle, XCircle, Clock, AlertTriangle, Eye, Lock,
  Image, Video, Music, FileText, MessageSquare, UserCheck, Key, Gift, Send, Plus,
} from 'lucide-react';
import { sampleCreators, pendingCreatorApplications, pendingContentReviews, myAccessKeys, activeKeyDrops } from '../data/seed';
import type { PendingCreatorApplication, PendingContentReview } from '../data/seed';

interface AccessRequest {
  id: string;
  email: string;
  name: string;
  reason: string;
  status: string;
  created_at: string;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'https://archangels-club-production.up.railway.app';
import StatCard from '../components/ui/StatCard';
import Logo from '../components/brand/Logo';
import Avatar from '../components/ui/Avatar';
import { formatCurrency, timeAgo } from '../lib/utils';
import type { KeyType } from '../types';
import { useAuth } from '../context/AuthContext';

const RECENT_TRANSACTIONS = [
  { id: 'at1', type: 'Subscription', amount: 39.99, fee: 8.00, at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
  { id: 'at2', type: 'Content Unlock', amount: 49.99, fee: 10.00, at: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
  { id: 'at3', type: 'Tip', amount: 100, fee: 20.00, at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { id: 'at4', type: 'Custom Request', amount: 200, fee: 40.00, at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
];

const FLAGGED_CONTENT = [
  { id: 'fc1', title: 'Suspicious Upload #42', reporter: 'user_0x1', reason: 'Potential policy violation', reported_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { id: 'fc2', title: 'Reported content from creator_3', reporter: 'user_0x2', reason: 'Undisclosed paid promotion', reported_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
];

type Tab = 'overview' | 'access-requests' | 'creator-approvals' | 'content-approvals' | 'flagged' | 'transactions' | 'keys';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <Image className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  audio: <Music className="w-3.5 h-3.5" />,
  text: <FileText className="w-3.5 h-3.5" />,
};

function UserStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: 'text-arc-success bg-arc-success/10 border-arc-success/25',
    pending: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
    rejected: 'text-arc-error bg-arc-error/10 border-arc-error/25',
    suspended: 'text-orange-400 bg-orange-400/10 border-orange-400/25',
    banned: 'text-red-600 bg-red-600/10 border-red-600/25',
  };
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}

export default function AdminDashboard({ initialTab = 'overview' }: { initialTab?: Tab }) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Access requests — fetched from API
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');

  // Creator approval actions
  const [creatorActions, setCreatorActions] = useState<Record<string, string>>({});

  // Content approval actions
  const [contentActions, setContentActions] = useState<Record<string, { status: string; reason?: string }>>({});
  const [activeRejection, setActiveRejection] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const pendingAccessCount = accessRequests.length;
  const pendingContentCount = pendingContentReviews.filter((r) => !contentActions[r.id]).length;
  const pendingCreatorCount = pendingCreatorApplications.filter((a) => !creatorActions[a.id]).length;

  useEffect(() => {
    if (activeTab === 'access-requests') loadAccessRequests();
  }, [activeTab]);

  async function loadAccessRequests() {
    setAccessLoading(true);
    setAccessError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/access-requests`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      console.log('[admin] access-requests response:', data);
      setAccessRequests(data);
    } catch (e) {
      setAccessError('Failed to load requests.');
    } finally {
      setAccessLoading(false);
    }
  }

  async function handleAccessAction(id: string, action: 'approved' | 'rejected') {
    const endpoint = action === 'approved' ? 'approve' : 'reject';
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}/${endpoint}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      setAccessRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // keep item in list if call fails
    }
  }

  function handleContentAction(id: string, status: string, reason?: string) {
    setContentActions((p) => ({ ...p, [id]: { status, reason } }));
    setActiveRejection(null);
    setRejectionReason('');
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'access-requests', label: 'Access Requests', badge: pendingAccessCount },
    { id: 'creator-approvals', label: 'Creator Approvals', badge: pendingCreatorCount },
    { id: 'content-approvals', label: 'Content Approvals', badge: pendingContentCount },
    { id: 'flagged', label: 'Flagged Content', badge: FLAGGED_CONTENT.length },
    { id: 'transactions', label: 'Transactions' },
    { id: 'keys', label: 'Access Keys' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <Logo variant="wordmark" size="sm" />
            <div className="w-px h-8 bg-gold-border/50" />
            <div>
              <p className="section-eyebrow mb-0.5">Admin</p>
              <p className="text-sm text-arc-secondary font-sans">Control Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-arc-error/10 border border-arc-error/30">
            <Shield className="w-4 h-4 text-arc-error" />
            <span className="text-xs text-arc-error font-medium">Admin Access</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Users" value="8,412" sub="↑ 124 this week" trend="up" icon={<Users className="w-5 h-5" />} />
          <StatCard label="Pending Requests" value={pendingAccessCount} sub="Require review" icon={<Clock className="w-5 h-5" />} />
          <StatCard label="Platform Revenue" value={formatCurrency(28840)} sub="↑ 18% this month" trend="up" icon={<DollarSign className="w-5 h-5" />} />
          <StatCard label="Content Queue" value={pendingContentCount} sub="Awaiting approval" icon={<Lock className="w-5 h-5" />} />
        </div>

        {/* Tabs */}
        <div className="border-b border-gold-border/40 mb-8 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map(({ id, label, badge }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-sans transition-all border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === id ? 'border-gold text-gold' : 'border-transparent text-arc-secondary hover:text-white'
                }`}
              >
                {label}
                {badge !== undefined && badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-bg-primary text-[10px] font-bold">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── OVERVIEW ───────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Revenue chart */}
              <div className="card-surface p-6 rounded-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif text-lg text-white">Platform Revenue</h2>
                  <TrendingUp className="w-5 h-5 text-gold" />
                </div>
                <div className="flex items-end gap-1.5 h-28">
                  {[30, 50, 40, 70, 55, 80, 65, 90, 75, 95, 60, 85, 70, 100, 80, 90, 75, 95, 80, 100, 85, 92, 78, 95, 85, 100, 88, 94, 90, 100].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i >= 27 ? 'linear-gradient(180deg, #D4AF37, #B8962E)' : 'rgba(212,175,55,0.2)' }} />
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: 'Gross Volume', value: formatCurrency(144200) },
                    { label: 'Platform Fees (20%)', value: formatCurrency(28840) },
                    { label: 'Creator Payouts', value: formatCurrency(115360) },
                  ].map(({ label, value }) => (
                    <div key={label}><p className="text-xs text-arc-muted mb-1">{label}</p><p className="text-sm font-serif text-gold">{value}</p></div>
                  ))}
                </div>
              </div>

              {/* Recent transactions */}
              <div className="card-surface p-6 rounded-xl">
                <h2 className="font-serif text-lg text-white mb-5">Recent Transactions</h2>
                {RECENT_TRANSACTIONS.map((txn, i) => (
                  <div key={txn.id} className={`flex items-center justify-between py-3.5 ${i < RECENT_TRANSACTIONS.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <div><p className="text-sm text-white">{txn.type}</p><p className="text-xs text-arc-muted">{timeAgo(txn.at)}</p></div>
                    <div className="text-right"><p className="text-sm font-serif text-white">{formatCurrency(txn.amount)}</p><p className="text-xs text-gold">Fee: {formatCurrency(txn.fee)}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              {/* Pending actions summary */}
              <div className="card-surface p-5 rounded-xl border border-amber-500/20">
                <h3 className="font-serif text-base text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Pending Actions
                </h3>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Access requests', count: pendingAccessCount, tab: 'access-requests' as Tab },
                    { label: 'Creator applications', count: pendingCreatorCount, tab: 'creator-approvals' as Tab },
                    { label: 'Content approvals', count: pendingContentCount, tab: 'content-approvals' as Tab },
                    { label: 'Flagged content', count: FLAGGED_CONTENT.length, tab: 'flagged' as Tab },
                  ].map(({ label, count, tab }) => (
                    <button
                      key={label}
                      onClick={() => setActiveTab(tab)}
                      className="w-full flex justify-between items-center hover:bg-bg-hover rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                    >
                      <span className="text-arc-secondary text-xs">{label}</span>
                      <span className={`text-xs font-medium ${count > 0 ? 'text-amber-400' : 'text-arc-muted'}`}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Compliance */}
              <div className="card-surface p-5 rounded-xl">
                <h3 className="font-serif text-base text-white mb-3">Compliance Status</h3>
                <div className="space-y-2.5">
                  {[
                    'Age Verification System',
                    'User Approval Flow',
                    'Content Moderation Queue',
                    'Creator ID Verification',
                    'DMCA Takedown Process',
                    'Payment Compliance',
                  ].map((label) => (
                    <div key={label} className="flex items-center gap-2.5 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 text-arc-success flex-shrink-0" />
                      <span className="text-arc-secondary">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ACCESS REQUESTS ─────────────────────────────────────────────── */}
        {activeTab === 'access-requests' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl text-white mb-1">User Access Requests</h2>
                <p className="text-sm text-arc-secondary">
                  {pendingAccessCount} pending · Approve to grant platform access, reject to deny.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-arc-muted">
                <UserCheck className="w-4 h-4 text-gold" />
                Approval required for all new accounts
              </div>
            </div>

            {accessLoading && (
              <div className="flex items-center justify-center py-16 text-arc-muted text-sm">Loading…</div>
            )}
            {accessError && (
              <div className="p-4 rounded-xl bg-arc-error/10 border border-arc-error/30 text-xs text-arc-error mb-4">{accessError}</div>
            )}
            {!accessLoading && !accessError && accessRequests.length === 0 && (
              <div className="flex items-center justify-center py-16 text-arc-muted text-sm">No access requests found.</div>
            )}
            <div className="space-y-4">
              {accessRequests.map((req) => (
                <div key={req.id} className="card-surface p-6 rounded-xl">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={undefined} name={req.name} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{req.name}</p>
                          <UserStatusBadge status={req.status} />
                        </div>
                        <p className="text-xs text-arc-muted mt-0.5">{req.email}</p>
                        <p className="text-xs text-arc-muted mt-0.5">Applied {timeAgo(req.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAccessAction(req.id, 'approved')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-success/10 text-arc-success hover:bg-arc-success/20 border border-arc-success/25 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleAccessAction(req.id, 'rejected')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border border-arc-error/25 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>

                  <div className="bg-bg-hover rounded-lg p-4">
                    <p className="text-xs font-medium text-gold mb-1.5">Reason for joining:</p>
                    <p className="text-xs text-arc-secondary leading-relaxed">{req.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CREATOR APPROVALS ───────────────────────────────────────────── */}
        {activeTab === 'creator-approvals' && (
          <div>
            <div className="mb-6">
              <h2 className="font-serif text-xl text-white mb-1">Creator Applications</h2>
              <p className="text-sm text-arc-secondary">
                {pendingCreatorCount} pending · Creators cannot publish until approved here.
              </p>
            </div>

            {/* Pending applications */}
            <div className="space-y-4 mb-10">
              {pendingCreatorApplications.map((app) => {
                const action = creatorActions[app.id];
                return (
                  <div key={app.id} className={`card-surface p-6 rounded-xl ${action ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={app.avatar_url} name={app.display_name} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{app.display_name}</p>
                            <UserStatusBadge status={action ?? 'pending'} />
                          </div>
                          <p className="text-xs text-arc-muted">@{app.username} · Applied {timeAgo(app.applied_at)}</p>
                          <div className="flex gap-1.5 mt-1.5">
                            {app.tags.map((t) => <span key={t} className="tag-pill text-xs">{t}</span>)}
                          </div>
                        </div>
                      </div>
                      {!action && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => setCreatorActions((p) => ({ ...p, [app.id]: 'approved' }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-success/10 text-arc-success hover:bg-arc-success/20 border border-arc-success/25 transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button onClick={() => setCreatorActions((p) => ({ ...p, [app.id]: 'rejected' }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border border-arc-error/25 transition-colors">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-bg-hover rounded-lg p-3">
                        <p className="text-xs font-medium text-gold mb-1.5">Bio</p>
                        <p className="text-xs text-arc-secondary leading-relaxed line-clamp-3">{app.bio}</p>
                      </div>
                      <div className="bg-bg-hover rounded-lg p-3">
                        <p className="text-xs font-medium text-gold mb-1.5">Pitch</p>
                        <p className="text-xs text-arc-secondary leading-relaxed line-clamp-3">{app.pitch}</p>
                      </div>
                    </div>

                    <div className="flex gap-4 mt-3 text-xs text-arc-muted">
                      <span>Content: {app.content_categories}</span>
                      <span>Sub price: {formatCurrency(app.subscription_price)}/mo</span>
                      <span>Starting: {formatCurrency(app.starting_price)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Existing approved creators table */}
            <h2 className="font-serif text-xl text-white mb-4">Active Creators</h2>
            <div className="card-surface rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gold-border/40">
                    {['Creator', 'Status', 'Subscribers', 'Earnings', 'Verified'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-arc-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleCreators.map((c, i) => (
                    <tr key={c.id} className={i < sampleCreators.length - 1 ? 'border-b border-white/5' : ''}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar src={c.avatar_url} name={c.display_name} size="xs" />
                          <div>
                            <p className="text-sm text-white">{c.display_name}</p>
                            <p className="text-xs text-arc-muted">@{c.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><UserStatusBadge status={c.application_status} /></td>
                      <td className="px-5 py-4 text-sm text-arc-secondary">{(c.subscriber_count ?? 0).toLocaleString()}</td>
                      <td className="px-5 py-4 text-sm text-gold font-serif">{formatCurrency(c.total_earnings)}</td>
                      <td className="px-5 py-4">
                        {c.is_verified_creator
                          ? <CheckCircle className="w-4 h-4 text-arc-success" />
                          : <Clock className="w-4 h-4 text-amber-400" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CONTENT APPROVALS ───────────────────────────────────────────── */}
        {activeTab === 'content-approvals' && (
          <div>
            <div className="mb-6">
              <h2 className="font-serif text-xl text-white mb-1">Content Approval Queue</h2>
              <p className="text-sm text-arc-secondary">
                {pendingContentCount} items pending · Content is not visible publicly until approved here.
              </p>
            </div>

            <div className="space-y-4">
              {pendingContentReviews.map((item) => {
                const action = contentActions[item.id];
                return (
                  <div key={item.id} className={`card-surface rounded-xl overflow-hidden transition-all ${action ? 'opacity-60' : ''}`}>
                    <div className="flex flex-col sm:flex-row">
                      {/* Preview */}
                      <div className="relative flex-shrink-0 w-full sm:w-40 h-32 bg-bg-hover overflow-hidden">
                        {item.preview_url ? (
                          <>
                            <img src={item.preview_url} alt="" className="w-full h-full object-cover locked-blur" />
                            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/60">
                              <Lock className="w-6 h-6 text-gold opacity-60" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-arc-muted">
                            {TYPE_ICONS[item.content_type]}
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-primary/80 text-xs text-arc-secondary">
                            {TYPE_ICONS[item.content_type]}
                            <span className="capitalize">{item.content_type}</span>
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 p-5">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar src={item.creator_avatar} name={item.creator_name} size="xs" />
                              <span className="text-xs text-arc-secondary">{item.creator_name}</span>
                              <span className="text-xs text-arc-muted">·</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                item.access_type === 'locked'
                                  ? 'text-amber-400 bg-amber-400/10 border-amber-400/25'
                                  : 'text-gold bg-gold-muted border-gold-border'
                              }`}>
                                {item.access_type === 'locked' ? `Locked · ${formatCurrency(item.price)}` : 'Subscribers only'}
                              </span>
                            </div>
                            <h3 className="font-serif text-base text-white mb-1">{item.title}</h3>
                            <p className="text-xs text-arc-secondary leading-relaxed line-clamp-2">{item.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {action
                              ? <UserStatusBadge status={action.status} />
                              : <UserStatusBadge status="pending_review" />}
                            <p className="text-xs text-arc-muted mt-1">{timeAgo(item.submitted_at)}</p>
                          </div>
                        </div>

                        {/* Rejection reason input */}
                        {activeRejection === item.id && (
                          <div className="mb-3">
                            <textarea
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Reason for rejection (sent to creator)…"
                              className="input-dark text-xs min-h-16 resize-none w-full"
                            />
                          </div>
                        )}

                        {!action && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleContentAction(item.id, 'approved')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-success/10 text-arc-success hover:bg-arc-success/20 border border-arc-success/25 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </button>

                            {activeRejection === item.id ? (
                              <>
                                <button
                                  onClick={() => handleContentAction(item.id, 'rejected', rejectionReason)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border border-arc-error/25 transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Confirm Rejection
                                </button>
                                <button
                                  onClick={() => { setActiveRejection(null); setRejectionReason(''); }}
                                  className="text-xs text-arc-muted hover:text-white transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setActiveRejection(item.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border border-arc-error/25 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            )}

                            <button
                              onClick={() => handleContentAction(item.id, 'changes_requested')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-arc-secondary hover:text-white border border-white/10 transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Request Changes
                            </button>

                            <button
                              onClick={() => handleContentAction(item.id, 'removed')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-600/25 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        )}

                        {action?.status === 'changes_requested' && (
                          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5" />
                            Changes requested — creator has been notified.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {pendingContentReviews.length === 0 && (
                <div className="text-center py-20">
                  <CheckCircle className="w-10 h-10 text-arc-success mx-auto mb-3" />
                  <p className="text-arc-secondary">No content in the review queue.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FLAGGED CONTENT ─────────────────────────────────────────────── */}
        {activeTab === 'flagged' && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="font-serif text-xl text-white mb-1">Flagged Content</h2>
              <p className="text-sm text-arc-secondary">{FLAGGED_CONTENT.length} items require review.</p>
            </div>
            {FLAGGED_CONTENT.map((item) => (
              <div key={item.id} className="card-surface p-6 rounded-xl border border-arc-error/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Flag className="w-4 h-4 text-arc-error" />
                      <p className="text-sm text-white font-medium">{item.title}</p>
                    </div>
                    <p className="text-xs text-arc-secondary mb-1">Reason: {item.reason}</p>
                    <p className="text-xs text-arc-muted">Reported by {item.reporter} · {timeAgo(item.reported_at)}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-arc-secondary hover:text-white border border-white/10">
                      <Eye className="w-3.5 h-3.5" /> Review
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-error/10 text-arc-error border border-arc-error/25">
                      <XCircle className="w-3.5 h-3.5" /> Remove
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-success/10 text-arc-success border border-arc-success/25">
                      <CheckCircle className="w-3.5 h-3.5" /> Clear
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TRANSACTIONS ────────────────────────────────────────────────── */}
        {activeTab === 'transactions' && (
          <div className="card-surface rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gold-border/40">
                  {['Type', 'Amount', 'Platform Fee (20%)', 'Creator Payout', 'Time'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-arc-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT_TRANSACTIONS.map((txn, i) => (
                  <tr key={txn.id} className={i < RECENT_TRANSACTIONS.length - 1 ? 'border-b border-white/5' : ''}>
                    <td className="px-5 py-4 text-sm text-white">{txn.type}</td>
                    <td className="px-5 py-4 text-sm font-serif text-white">{formatCurrency(txn.amount)}</td>
                    <td className="px-5 py-4 text-sm text-gold">{formatCurrency(txn.fee)}</td>
                    <td className="px-5 py-4 text-sm text-arc-success">{formatCurrency(txn.amount - txn.fee)}</td>
                    <td className="px-5 py-4 text-xs text-arc-muted">{timeAgo(txn.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ACCESS KEYS ─────────────────────────────────────────────────── */}
        {activeTab === 'keys' && <AdminKeysTab />}
      </div>
    </div>
  );
}

// ─── Admin Keys Tab ───────────────────────────────────────────────────────────

const KEY_TYPE_STYLES: Record<KeyType, { badge: string; bg: string; border: string }> = {
  black: { badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', bg: 'from-zinc-900/60 to-black', border: 'border-yellow-500/30' },
  gold: { badge: 'text-amber-400 bg-amber-400/10 border-amber-400/30', bg: 'from-amber-950/20 to-bg-surface', border: 'border-amber-400/40' },
  standard: { badge: 'text-arc-secondary bg-white/5 border-white/15', bg: 'from-bg-surface to-bg-surface', border: 'border-white/10' },
};

function AdminKeysTab() {
  const [issueType, setIssueType] = useState<KeyType>('standard');
  const [issueQty, setIssueQty] = useState('5');
  const [issueTarget, setIssueTarget] = useState('');
  const [issued, setIssued] = useState(false);
  const [dropName, setDropName] = useState('');
  const [dropType, setDropType] = useState<KeyType>('gold');
  const [dropQty, setDropQty] = useState('25');
  const [dropDuration, setDropDuration] = useState('24');
  const [dropCreated, setDropCreated] = useState(false);

  function handleIssue() {
    setIssued(true);
    setTimeout(() => setIssued(false), 3000);
  }

  function handleCreateDrop() {
    if (!dropName.trim()) return;
    setDropCreated(true);
    setTimeout(() => { setDropCreated(false); setDropName(''); }, 3000);
  }

  const totalKeys = myAccessKeys.length;
  const unusedKeys = myAccessKeys.filter((k) => k.status === 'unused').length;
  const usedKeys = myAccessKeys.filter((k) => k.status === 'used').length;
  const transferredKeys = myAccessKeys.filter((k) => k.status === 'transferred').length;

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Issued', value: totalKeys, icon: <Key className="w-4 h-4" />, color: 'text-gold' },
          { label: 'Available', value: unusedKeys, icon: <Key className="w-4 h-4" />, color: 'text-gold' },
          { label: 'Redeemed', value: usedKeys, icon: <CheckCircle className="w-4 h-4" />, color: 'text-arc-success' },
          { label: 'Transferred', value: transferredKeys, icon: <Send className="w-4 h-4" />, color: 'text-blue-400' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="card-surface p-4 rounded-xl text-center">
            <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
            <p className={`font-serif text-xl ${color}`}>{value}</p>
            <p className="text-xs text-arc-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issue Keys */}
        <div className="card-surface p-6 rounded-xl">
          <div className="flex items-center gap-2 mb-5">
            <Key className="w-4 h-4 text-gold" />
            <h3 className="font-serif text-lg text-white">Issue Keys</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-arc-secondary mb-2">Key Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['standard', 'gold', 'black'] as KeyType[]).map((t) => {
                  const s = KEY_TYPE_STYLES[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setIssueType(t)}
                      className={`py-2 rounded-lg border text-xs font-bold tracking-wider capitalize transition-all ${
                        issueType === t ? `${s.badge} ${s.border}` : 'border-white/10 text-arc-muted hover:border-white/20'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Quantity</label>
                <input
                  type="number"
                  value={issueQty}
                  onChange={(e) => setIssueQty(e.target.value)}
                  min="1" max="500"
                  className="input-dark"
                />
              </div>
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Assign to user <span className="text-arc-muted">(optional)</span></label>
                <input
                  type="text"
                  value={issueTarget}
                  onChange={(e) => setIssueTarget(e.target.value)}
                  placeholder="@username"
                  className="input-dark"
                />
              </div>
            </div>

            <button
              onClick={handleIssue}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                issued
                  ? 'bg-arc-success/10 border border-arc-success/25 text-arc-success'
                  : 'btn-gold'
              }`}
            >
              {issued ? (
                <><CheckCircle className="w-4 h-4" />{issueQty} keys issued</>
              ) : (
                <><Plus className="w-4 h-4" />Issue {issueQty} {issueType} key{parseInt(issueQty) !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>

        {/* Create Drop */}
        <div className="card-surface p-6 rounded-xl">
          <div className="flex items-center gap-2 mb-5">
            <Gift className="w-4 h-4 text-gold" />
            <h3 className="font-serif text-lg text-white">Create Key Drop</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-arc-secondary mb-1.5">Drop Name</label>
              <input
                type="text"
                value={dropName}
                onChange={(e) => setDropName(e.target.value)}
                placeholder="e.g. Summer Access Event"
                className="input-dark"
                maxLength={60}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-arc-secondary mb-1.5">Key Type</label>
                <div className="flex flex-col gap-1">
                  {(['standard', 'gold', 'black'] as KeyType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setDropType(t)}
                      className={`py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${
                        dropType === t ? KEY_TYPE_STYLES[t].badge + ' ' + KEY_TYPE_STYLES[t].border : 'border-white/10 text-arc-muted hover:border-white/20'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-arc-secondary mb-1.5">Quantity</label>
                  <input type="number" value={dropQty} onChange={(e) => setDropQty(e.target.value)} min="1" max="1000" className="input-dark" />
                </div>
                <div>
                  <label className="block text-xs text-arc-secondary mb-1.5">Duration (hours)</label>
                  <input type="number" value={dropDuration} onChange={(e) => setDropDuration(e.target.value)} min="1" max="168" className="input-dark" />
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateDrop}
              disabled={!dropName.trim()}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                dropCreated
                  ? 'bg-arc-success/10 border border-arc-success/25 text-arc-success'
                  : 'btn-outline'
              }`}
            >
              {dropCreated ? <><CheckCircle className="w-4 h-4" />Drop created</> : <><Gift className="w-4 h-4" />Schedule Drop</>}
            </button>
          </div>
        </div>
      </div>

      {/* Active drops */}
      <div className="card-surface rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-serif text-base text-white">Active &amp; Upcoming Drops</h3>
          <span className="text-xs text-arc-muted">{activeKeyDrops.length} drops</span>
        </div>
        <div className="divide-y divide-white/5">
          {activeKeyDrops.map((drop) => {
            const s = KEY_TYPE_STYLES[drop.key_type];
            const pct = Math.round((drop.claimed / drop.quantity) * 100);
            const isLive = new Date(drop.start_time) <= new Date() && new Date(drop.end_time) > new Date();
            return (
              <div key={drop.id} className="px-5 py-4 flex items-center gap-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.badge} ${s.border}`}>{drop.key_type.toUpperCase()}</span>
                    {isLive
                      ? <span className="text-[10px] text-arc-success font-medium">LIVE</span>
                      : <span className="text-[10px] text-arc-muted font-medium">UPCOMING</span>}
                  </div>
                  <p className="text-sm text-white">{drop.drop_name}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex-1 h-1 bg-white/5 rounded-full">
                      <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-arc-muted flex-shrink-0">{drop.claimed}/{drop.quantity}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="text-xs px-3 py-1.5 rounded-lg border border-arc-error/25 text-arc-error hover:bg-arc-error/10 transition-all">
                    Revoke
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Registry */}
      <div className="card-surface rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-serif text-base text-white">Key Registry</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Code', 'Type', 'Status', 'Inviter', 'Invitee', 'Created'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-medium text-arc-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myAccessKeys.map((key, i) => {
                const s = KEY_TYPE_STYLES[key.key_type];
                return (
                  <tr key={key.id} className={i < myAccessKeys.length - 1 ? 'border-b border-white/5' : ''}>
                    <td className="px-4 py-3 font-mono text-xs text-arc-secondary">{key.invite_code}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.badge} ${s.border}`}>{key.key_type.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                        key.status === 'unused' ? 'text-gold bg-gold-muted border-gold-border'
                        : key.status === 'used' ? 'text-arc-success bg-arc-success/10 border-arc-success/25'
                        : key.status === 'transferred' ? 'text-blue-400 bg-blue-500/10 border-blue-500/25'
                        : 'text-arc-muted bg-white/5 border-white/10'
                      }`}>
                        {key.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-arc-secondary">{key.inviter_id === 'admin' ? 'Admin' : key.inviter_id}</td>
                    <td className="px-4 py-3 text-xs text-arc-secondary">{key.invitee_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-arc-muted whitespace-nowrap">{timeAgo(key.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
