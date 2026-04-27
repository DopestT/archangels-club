import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, DollarSign, Crown, Shield, Flag, TrendingUp,
  CheckCircle, XCircle, Clock, AlertTriangle, Eye, Lock,
  Image, Video, Music, FileText, MessageSquare, UserCheck, Send, Bug,
} from 'lucide-react';

interface AccessRequest {
  id: string;
  email: string;
  name: string;
  reason: string;
  requested_role: string;
  status: string;
  created_at: string;
}

interface Report {
  id: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter_username: string;
  reporter_name: string;
  content_title: string | null;
  creator_username: string | null;
}

import StatCard from '../components/ui/StatCard';
import Logo from '../components/brand/Logo';
import Avatar from '../components/ui/Avatar';
import { formatCurrency, timeAgo } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/api';

type Tab = 'overview' | 'access-requests' | 'creator-approvals' | 'content-approvals' | 'flagged' | 'transactions' | 'verifications';

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

  // Access requests
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [emailNotice, setEmailNotice] = useState<{ name: string; sent: boolean; error?: string } | null>(null);

  // Creator applications
  const [creatorApps, setCreatorApps] = useState<any[]>([]);
  const [creatorAppsLoading, setCreatorAppsLoading] = useState(false);
  const [approvedCreators, setApprovedCreators] = useState<any[]>([]);

  // Content queue
  const [contentQueue, setContentQueue] = useState<any[]>([]);
  const [contentQueueLoading, setContentQueueLoading] = useState(false);
  const [contentActions, setContentActions] = useState<Record<string, { status: string; reason?: string }>>({});
  const [activeRejection, setActiveRejection] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Flagged content (reports)
  const [flaggedContent, setFlaggedContent] = useState<Report[]>([]);
  const [flaggedLoading, setFlaggedLoading] = useState(false);

  // Stats + transactions
  const [stats, setStats] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Verifications
  const [verifications, setVerifications] = useState<any[]>([]);
  const [creatorKyc, setCreatorKyc] = useState<any[]>([]);
  const [verificationsLoading, setVerificationsLoading] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<string>('all');

  const pendingAccessCount = accessRequests.filter((r) => r.status === 'pending').length;
  const pendingContentCount = contentQueue.filter((r) => !contentActions[r.id]).length;
  const pendingCreatorCount = creatorApps.length;

  function adminFetch(path: string, options?: RequestInit) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers ?? {}),
      },
    });
  }

  useEffect(() => {
    loadStats();
    loadTransactions();
  }, []);

  useEffect(() => {
    if (activeTab === 'access-requests') loadAccessRequests();
    if (activeTab === 'creator-approvals') loadCreatorApps();
    if (activeTab === 'content-approvals') loadContentQueue();
    if (activeTab === 'flagged') loadFlaggedContent();
    if (activeTab === 'transactions') loadTransactions();
    if (activeTab === 'verifications') loadVerifications();
  }, [activeTab]);

  async function loadStats() {
    try {
      const res = await adminFetch('/api/admin/stats');
      const data = await res.json();
      if (!data.error) setStats(data);
    } catch {}
  }

  async function loadAccessRequests() {
    setAccessLoading(true);
    setAccessError('');
    try {
      const res = await adminFetch('/api/admin/access-requests');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAccessRequests(data);
    } catch {
      setAccessError('Failed to load requests.');
    } finally {
      setAccessLoading(false);
    }
  }

  async function loadCreatorApps() {
    setCreatorAppsLoading(true);
    try {
      const [appsRes, creatorsRes] = await Promise.all([
        adminFetch('/api/admin/creators/pending'),
        fetch(`${API_BASE}/api/creators`),
      ]);
      const apps = await appsRes.json();
      const creators = await creatorsRes.json();
      setCreatorApps(Array.isArray(apps) ? apps : []);
      setApprovedCreators(Array.isArray(creators) ? creators : []);
    } catch {} finally {
      setCreatorAppsLoading(false);
    }
  }

  async function loadContentQueue() {
    setContentQueueLoading(true);
    try {
      const res = await adminFetch('/api/admin/content-approvals');
      const data = await res.json();
      setContentQueue(Array.isArray(data) ? data : []);
    } catch {} finally {
      setContentQueueLoading(false);
    }
  }

  async function loadTransactions() {
    setTransactionsLoading(true);
    try {
      const res = await adminFetch('/api/admin/transactions');
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch {} finally {
      setTransactionsLoading(false);
    }
  }

  async function loadVerifications() {
    setVerificationsLoading(true);
    try {
      const [verRes, kycRes] = await Promise.all([
        adminFetch('/api/admin/verifications'),
        adminFetch('/api/admin/creator-verifications'),
      ]);
      const verData = await verRes.json();
      const kycData = await kycRes.json();
      setVerifications(Array.isArray(verData) ? verData : []);
      setCreatorKyc(Array.isArray(kycData) ? kycData : []);
    } catch {} finally {
      setVerificationsLoading(false);
    }
  }

  async function handleAdminVerifyAge(userId: string) {
    try {
      await adminFetch(`/api/admin/users/${userId}/verify-age`, { method: 'POST' });
      setVerifications(prev => prev.map(v =>
        v.id === userId ? { ...v, age_verification_status: 'verified', age_verified_at: new Date().toISOString() } : v
      ));
    } catch {}
  }

  async function handleCreatorKycUpdate(creatorId: string, status: string) {
    try {
      await adminFetch(`/api/admin/creators/${creatorId}/update-kyc`, {
        method: 'POST',
        body: JSON.stringify({ kyc_status: status }),
      });
      setCreatorKyc(prev => prev.map(c =>
        c.id === creatorId ? { ...c, creator_kyc_status: status } : c
      ));
    } catch {}
  }

  async function loadFlaggedContent() {
    setFlaggedLoading(true);
    try {
      const res = await adminFetch('/api/admin/reports');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFlaggedContent(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      setFlaggedLoading(false);
    }
  }

  async function handleReportDismiss(reportId: string) {
    try {
      await adminFetch(`/api/admin/reports/${reportId}/dismiss`, { method: 'POST' });
      setFlaggedContent(prev => prev.filter(r => r.id !== reportId));
    } catch {}
  }

  async function handleReportRemove(report: Report) {
    try {
      if (report.subject_type === 'content') {
        await adminFetch(`/api/admin/content/${report.subject_id}/remove`, { method: 'POST' });
      }
      await adminFetch(`/api/admin/reports/${report.id}/take-action`, { method: 'POST' });
      setFlaggedContent(prev => prev.filter(r => r.id !== report.id));
    } catch {}
  }

  async function handleAccessAction(id: string, action: 'approved' | 'rejected') {
    const endpoint = action === 'approved' ? 'approve' : 'reject';
    const req = accessRequests.find(r => r.id === id);
    try {
      const res = await adminFetch(`/api/admin/users/${id}/${endpoint}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => ({}));
      setAccessRequests((prev) => prev.filter((r) => r.id !== id));
      if (action === 'approved') {
        const notice = {
          name: req?.name ?? 'User',
          sent: data.email_sent === true,
          error: data.email_error ?? undefined,
        };
        setEmailNotice(notice);
        setTimeout(() => setEmailNotice(null), 8000);
      }
    } catch {}
  }

  async function handleCreatorAction(id: string, action: 'approve' | 'reject') {
    try {
      const res = await adminFetch(`/api/admin/creators/${id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setCreatorApps((prev) => prev.filter((a) => a.id !== id));
    } catch {}
  }

  async function copyCreatorSetupLink(id: string) {
    try {
      const res = await adminFetch(`/api/admin/creators/${id}/generate-setup-link`, { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        alert(`Setup link copied for ${data.email}\n\n${data.url}`);
      }
    } catch {
      alert('Failed to generate setup link.');
    }
  }

  async function handleContentAction(id: string, status: string, reason?: string) {
    const endpointMap: Record<string, string> = {
      approved: 'approve',
      rejected: 'reject',
      changes_requested: 'request-changes',
      removed: 'remove',
    };
    const endpoint = endpointMap[status];
    if (endpoint) {
      try {
        await adminFetch(`/api/admin/content/${id}/${endpoint}`, {
          method: 'POST',
          body: JSON.stringify({ rejection_reason: reason }),
        });
      } catch {}
    }
    setContentActions((p) => ({ ...p, [id]: { status, reason } }));
    setActiveRejection(null);
    setRejectionReason('');
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'access-requests', label: 'Access Requests', badge: pendingAccessCount },
    { id: 'creator-approvals', label: 'Creator Approvals', badge: pendingCreatorCount },
    { id: 'content-approvals', label: 'Content Approvals', badge: pendingContentCount },
    { id: 'flagged', label: 'Flagged Content', badge: stats?.openReports ?? flaggedContent.length },
    { id: 'transactions', label: 'Transactions' },
    { id: 'verifications', label: 'Verifications', badge: (stats?.pendingAgeVerifications ?? 0) + (stats?.failedVerifications ?? 0) + (stats?.pendingCreatorKyc ?? 0) },
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
          <StatCard label="Total Users" value={stats?.totalUsers ?? '—'} sub={`${stats?.approvedUsers ?? 0} approved`} trend="up" icon={<Users className="w-5 h-5" />} />
          <StatCard label="Pending Requests" value={stats?.pendingAccessRequests ?? pendingAccessCount} sub="Require review" icon={<Clock className="w-5 h-5" />} />
          <StatCard label="Platform Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} sub={`${formatCurrency(stats?.totalVolume ?? 0)} gross volume`} trend="up" icon={<DollarSign className="w-5 h-5" />} />
          <StatCard label="Content Queue" value={stats?.pendingContent ?? pendingContentCount} sub="Awaiting approval" icon={<Lock className="w-5 h-5" />} />
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
                    { label: 'Gross Volume', value: stats ? formatCurrency(stats.totalVolume) : '—' },
                    { label: 'Platform Fees (20%)', value: stats ? formatCurrency(stats.totalRevenue) : '—' },
                    { label: 'Creator Payouts', value: stats ? formatCurrency(stats.totalVolume - stats.totalRevenue) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label}><p className="text-xs text-arc-muted mb-1">{label}</p><p className="text-sm font-serif text-gold">{value}</p></div>
                  ))}
                </div>
              </div>

              {/* Recent transactions */}
              <div className="card-surface p-6 rounded-xl">
                <h2 className="font-serif text-lg text-white mb-5">Recent Transactions</h2>
                {transactions.length > 0 ? (
                  transactions.slice(0, 5).map((txn, i) => (
                    <div key={txn.id} className={`flex items-center justify-between py-3.5 ${i < Math.min(transactions.length, 5) - 1 ? 'border-b border-white/5' : ''}`}>
                      <div><p className="text-sm text-white capitalize">{txn.ref_type.replace('_', ' ')}</p><p className="text-xs text-arc-muted">{timeAgo(txn.created_at)}</p></div>
                      <div className="text-right"><p className="text-sm font-serif text-white">{formatCurrency(txn.amount)}</p><p className="text-xs text-gold">Fee: {formatCurrency(txn.platform_fee)}</p></div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-arc-muted text-center py-6">No transactions yet.</p>
                )}
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
                    { label: 'Flagged content', count: stats?.openReports ?? flaggedContent.length, tab: 'flagged' as Tab },
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

              {/* Bug Control */}
              <Link
                to="/admin/bug-control"
                className="card-surface p-5 rounded-xl border border-white/5 hover:border-gold/30 transition-colors group block"
              >
                <h3 className="font-serif text-base text-white mb-1 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-gold" />
                  Bug Control Center
                </h3>
                <p className="text-xs text-arc-muted">View test failures, API errors, and suggested fixes.</p>
                <p className="text-xs text-gold mt-2 group-hover:underline">Open →</p>
              </Link>

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

            {emailNotice && (
              <div className={`flex items-start gap-3 p-4 rounded-xl border text-xs mb-4 ${
                emailNotice.sent
                  ? 'bg-arc-success/10 border-arc-success/30 text-arc-success'
                  : 'bg-arc-error/10 border-arc-error/30 text-arc-error'
              }`}>
                {emailNotice.sent
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium">
                    {emailNotice.sent
                      ? `Setup email sent to ${emailNotice.name}`
                      : `Setup email failed for ${emailNotice.name}`}
                  </p>
                  {!emailNotice.sent && emailNotice.error && (
                    <p className="mt-0.5 opacity-80">{emailNotice.error}</p>
                  )}
                  {!emailNotice.sent && (
                    <p className="mt-0.5 opacity-70">The user was approved but did not receive the setup link. Resend manually if needed.</p>
                  )}
                </div>
                <button onClick={() => setEmailNotice(null)} className="ml-auto opacity-50 hover:opacity-100 flex-shrink-0">✕</button>
              </div>
            )}

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
                        <p className="text-xs text-arc-muted mt-0.5">Applied {timeAgo(req.created_at)} · Role requested: <span className="capitalize">{req.requested_role ?? 'fan'}</span></p>
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

            {creatorAppsLoading && (
              <div className="flex items-center justify-center py-12 text-arc-muted text-sm">Loading…</div>
            )}

            {/* Pending applications */}
            <div className="space-y-4 mb-10">
              {creatorApps.map((app) => (
                <div key={app.id} className="card-surface p-6 rounded-xl">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={app.avatar_url} name={app.display_name} size="md" />
                      <div>
                        <p className="text-white font-medium">{app.display_name}</p>
                        <p className="text-xs text-arc-muted">@{app.username} · Applied {timeAgo(app.created_at)}</p>
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {(app.tags ?? []).map((t: string) => <span key={t} className="tag-pill text-xs">{t}</span>)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      <button onClick={() => handleCreatorAction(app.id, 'approve')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-success/10 text-arc-success hover:bg-arc-success/20 border border-arc-success/25 transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleCreatorAction(app.id, 'reject')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border border-arc-error/25 transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button onClick={() => copyCreatorSetupLink(app.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-bg-hover text-arc-secondary hover:text-white border border-white/10 hover:border-gold/30 transition-colors">
                        <Send className="w-3.5 h-3.5" /> Copy Setup Link
                      </button>
                    </div>
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

                  <div className="flex gap-4 mt-3 text-xs text-arc-muted flex-wrap">
                    <span>Sub price: {formatCurrency(app.subscription_price)}/mo</span>
                    <span>Starting: {formatCurrency(app.starting_price)}</span>
                    <span>Email: {app.email}</span>
                  </div>
                </div>
              ))}

              {!creatorAppsLoading && creatorApps.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle className="w-8 h-8 text-arc-success mx-auto mb-3" />
                  <p className="text-arc-secondary text-sm">No pending creator applications.</p>
                </div>
              )}
            </div>

            {/* Active creators table */}
            <h2 className="font-serif text-xl text-white mb-4">Active Creators</h2>
            <div className="card-surface rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gold-border/40">
                    {['Creator', 'Subscribers', 'Earnings', 'Verified'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-arc-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {approvedCreators.map((c, i) => (
                    <tr key={c.id} className={i < approvedCreators.length - 1 ? 'border-b border-white/5' : ''}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar src={c.avatar_url} name={c.display_name} size="xs" />
                          <div>
                            <p className="text-sm text-white">{c.display_name}</p>
                            <p className="text-xs text-arc-muted">@{c.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-arc-secondary">{Number(c.subscriber_count ?? 0).toLocaleString()}</td>
                      <td className="px-5 py-4 text-sm text-gold font-serif">{formatCurrency(c.total_earnings ?? 0)}</td>
                      <td className="px-5 py-4">
                        {c.is_verified_creator
                          ? <CheckCircle className="w-4 h-4 text-arc-success" />
                          : <Clock className="w-4 h-4 text-amber-400" />}
                      </td>
                    </tr>
                  ))}
                  {approvedCreators.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-arc-muted text-sm">No approved creators yet.</td></tr>
                  )}
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

            {contentQueueLoading && (
              <div className="flex items-center justify-center py-12 text-arc-muted text-sm">Loading…</div>
            )}

            <div className="space-y-4">
              {contentQueue.map((item) => {
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
                            {TYPE_ICONS[item.content_type] ?? <FileText className="w-5 h-5" />}
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
                            <p className="text-xs text-arc-muted mt-1">{timeAgo(item.created_at)}</p>
                          </div>
                        </div>

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
                            <button onClick={() => handleContentAction(item.id, 'approved')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-success/10 text-arc-success hover:bg-arc-success/20 border border-arc-success/25 transition-colors">
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </button>

                            {activeRejection === item.id ? (
                              <>
                                <button onClick={() => handleContentAction(item.id, 'rejected', rejectionReason)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border border-arc-error/25 transition-colors">
                                  <XCircle className="w-3.5 h-3.5" /> Confirm Rejection
                                </button>
                                <button onClick={() => { setActiveRejection(null); setRejectionReason(''); }}
                                  className="text-xs text-arc-muted hover:text-white transition-colors">Cancel</button>
                              </>
                            ) : (
                              <button onClick={() => setActiveRejection(item.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border border-arc-error/25 transition-colors">
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            )}

                            <button onClick={() => handleContentAction(item.id, 'changes_requested')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-arc-secondary hover:text-white border border-white/10 transition-colors">
                              <MessageSquare className="w-3.5 h-3.5" /> Request Changes
                            </button>

                            <button onClick={() => handleContentAction(item.id, 'removed')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-600/25 transition-colors">
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

              {!contentQueueLoading && contentQueue.length === 0 && (
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
              <p className="text-sm text-arc-secondary">{flaggedContent.length} items require review.</p>
            </div>

            {flaggedLoading && (
              <div className="flex items-center justify-center py-16 text-arc-muted text-sm">Loading…</div>
            )}

            {!flaggedLoading && flaggedContent.length === 0 && (
              <div className="text-center py-20">
                <CheckCircle className="w-10 h-10 text-arc-success mx-auto mb-3" />
                <p className="text-arc-secondary">No flagged content to review.</p>
              </div>
            )}

            {flaggedContent.map((report) => {
              const displayTitle = report.content_title ?? `${report.subject_type} ${report.subject_id.slice(0, 8)}`;
              const reviewUrl = report.subject_type === 'content' ? `/content/${report.subject_id}` : null;
              return (
                <div key={report.id} className="card-surface p-6 rounded-xl border border-arc-error/20">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Flag className="w-4 h-4 text-arc-error flex-shrink-0" />
                        <p className="text-sm text-white font-medium truncate">{displayTitle}</p>
                      </div>
                      <p className="text-xs text-arc-secondary mb-1">Reason: {report.reason}</p>
                      {report.details && (
                        <p className="text-xs text-arc-secondary mb-1 leading-relaxed">{report.details}</p>
                      )}
                      <p className="text-xs text-arc-muted">
                        Reported by {report.reporter_name} (@{report.reporter_username}) · {timeAgo(report.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      {reviewUrl ? (
                        <a
                          href={reviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-arc-secondary hover:text-white border border-white/10 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Review
                        </a>
                      ) : (
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-arc-secondary border border-white/10 opacity-50 cursor-not-allowed">
                          <Eye className="w-3.5 h-3.5" /> Review
                        </button>
                      )}
                      <button
                        onClick={() => handleReportRemove(report)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border border-arc-error/25 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Remove
                      </button>
                      <button
                        onClick={() => handleReportDismiss(report.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-arc-success/10 text-arc-success hover:bg-arc-success/20 border border-arc-success/25 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Clear
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TRANSACTIONS ────────────────────────────────────────────────── */}
        {activeTab === 'transactions' && (
          <div className="card-surface rounded-xl overflow-hidden">
            {transactionsLoading && (
              <div className="flex items-center justify-center py-12 text-arc-muted text-sm">Loading…</div>
            )}
            {!transactionsLoading && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gold-border/40">
                    {['Type', 'Payer', 'Creator', 'Amount', 'Platform Fee', 'Payout', 'Time'].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-arc-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, i) => (
                    <tr key={txn.id} className={i < transactions.length - 1 ? 'border-b border-white/5' : ''}>
                      <td className="px-5 py-4 text-xs text-white capitalize">{txn.ref_type}</td>
                      <td className="px-5 py-4 text-xs text-arc-secondary">{txn.payer_name}</td>
                      <td className="px-5 py-4 text-xs text-arc-secondary">{txn.payee_name}</td>
                      <td className="px-5 py-4 text-sm font-serif text-white">{formatCurrency(txn.amount)}</td>
                      <td className="px-5 py-4 text-sm text-gold">{formatCurrency(txn.platform_fee)}</td>
                      <td className="px-5 py-4 text-sm text-arc-success">{formatCurrency(txn.net_amount)}</td>
                      <td className="px-5 py-4 text-xs text-arc-muted whitespace-nowrap">{timeAgo(txn.created_at)}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-arc-muted text-sm">No transactions yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── VERIFICATIONS ───────────────────────────────────────────────── */}
        {activeTab === 'verifications' && (
          <div className="space-y-8">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Pending Verification', value: stats?.pendingAgeVerifications ?? '—', color: 'text-amber-400' },
                { label: 'Verified Users', value: stats?.verifiedUsers ?? '—', color: 'text-arc-success' },
                { label: 'Failed Verifications', value: stats?.failedVerifications ?? '—', color: 'text-arc-error' },
                { label: 'Pending Creator KYC', value: stats?.pendingCreatorKyc ?? '—', color: 'text-gold' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card-surface p-4 rounded-xl text-center">
                  <p className={`font-serif text-2xl ${color}`}>{value}</p>
                  <p className="text-xs text-arc-muted mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {['all', 'not_started', 'pending', 'verified', 'failed'].map(f => (
                <button
                  key={f}
                  onClick={() => setVerificationFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                    verificationFilter === f
                      ? 'border-gold text-gold bg-gold/10'
                      : 'border-white/10 text-arc-muted hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'All Users' : f.replace('_', ' ')}
                </button>
              ))}
            </div>

            {verificationsLoading && (
              <div className="flex items-center justify-center py-12 text-arc-muted text-sm">Loading…</div>
            )}

            {/* User age verifications table */}
            {!verificationsLoading && (
              <div className="card-surface rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5">
                  <h3 className="font-serif text-base text-white">User Age Verifications</h3>
                  <p className="text-xs text-arc-muted mt-0.5">
                    Verification handled by Stripe Identity · Only status and timestamps are stored — no ID images or sensitive data.
                  </p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gold-border/40">
                      {['User', 'Status', 'Provider', 'Verified At', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-arc-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {verifications
                      .filter(v => verificationFilter === 'all' || v.age_verification_status === verificationFilter)
                      .map((v, i, arr) => {
                        const statusColors: Record<string, string> = {
                          verified:    'text-arc-success bg-arc-success/10 border-arc-success/25',
                          pending:     'text-amber-400 bg-amber-400/10 border-amber-400/25',
                          failed:      'text-arc-error bg-arc-error/10 border-arc-error/25',
                          not_started: 'text-arc-muted bg-white/5 border-white/10',
                          expired:     'text-orange-400 bg-orange-400/10 border-orange-400/25',
                        };
                        return (
                          <tr key={v.id} className={i < arr.length - 1 ? 'border-b border-white/5' : ''}>
                            <td className="px-4 py-3">
                              <p className="text-sm text-white">{v.display_name}</p>
                              <p className="text-xs text-arc-muted">{v.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusColors[v.age_verification_status] ?? statusColors.not_started}`}>
                                {(v.age_verification_status ?? 'not_started').replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-arc-muted capitalize">
                              {v.verification_provider?.replace('_', ' ') ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-arc-muted whitespace-nowrap">
                              {v.age_verified_at ? timeAgo(v.age_verified_at) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {v.age_verification_status !== 'verified' && (
                                <button
                                  onClick={() => handleAdminVerifyAge(v.id)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-arc-success/10 text-arc-success hover:bg-arc-success/20 border border-arc-success/25 transition-colors"
                                >
                                  <CheckCircle className="w-3 h-3" /> Override
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {verifications.filter(v => verificationFilter === 'all' || v.age_verification_status === verificationFilter).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-arc-muted text-sm">No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Creator KYC */}
            {!verificationsLoading && (
              <div className="card-surface rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5">
                  <h3 className="font-serif text-base text-white">Creator KYC Status</h3>
                  <p className="text-xs text-arc-muted mt-0.5">Creators must be KYC-approved before publishing paid content.</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gold-border/40">
                      {['Creator', 'KYC Status', 'App Status', 'Verified At', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-arc-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {creatorKyc.map((c, i) => {
                      const statusColors: Record<string, string> = {
                        approved:    'text-arc-success bg-arc-success/10 border-arc-success/25',
                        pending:     'text-amber-400 bg-amber-400/10 border-amber-400/25',
                        rejected:    'text-arc-error bg-arc-error/10 border-arc-error/25',
                        not_started: 'text-arc-muted bg-white/5 border-white/10',
                      };
                      return (
                        <tr key={c.id} className={i < creatorKyc.length - 1 ? 'border-b border-white/5' : ''}>
                          <td className="px-4 py-3">
                            <p className="text-sm text-white">{c.display_name}</p>
                            <p className="text-xs text-arc-muted">@{c.username}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusColors[c.creator_kyc_status] ?? statusColors.not_started}`}>
                              {(c.creator_kyc_status ?? 'not_started').replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusColors[c.application_status] ?? statusColors.not_started}`}>
                              {c.application_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-arc-muted whitespace-nowrap">
                            {c.creator_kyc_verified_at ? timeAgo(c.creator_kyc_verified_at) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {c.creator_kyc_status !== 'approved' && (
                                <button
                                  onClick={() => handleCreatorKycUpdate(c.id, 'approved')}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-arc-success/10 text-arc-success hover:bg-arc-success/20 border border-arc-success/25 transition-colors"
                                >
                                  <CheckCircle className="w-3 h-3" /> Approve
                                </button>
                              )}
                              {c.creator_kyc_status !== 'rejected' && (
                                <button
                                  onClick={() => handleCreatorKycUpdate(c.id, 'rejected')}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-arc-error/10 text-arc-error hover:bg-arc-error/20 border border-arc-error/25 transition-colors"
                                >
                                  <XCircle className="w-3 h-3" /> Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {creatorKyc.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-arc-muted text-sm">No creators found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
