/**
 * CreatorDashboard — Prototype B: "Studio"
 *
 * Left sidebar with nav (Content, Earnings, Audience, Settings).
 * Main area changes per nav item. Compact top bar with avatar + quick stats.
 * Feels like a proper web app / studio tool.
 */
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Upload, DollarSign, Users, TrendingUp, MessageCircle, ChevronRight,
  Star, CheckCircle, Crown, ExternalLink, Zap, Copy, Check,
  LayoutGrid, AlertCircle, Eye, Sparkles, Link2, Trash2,
  Plus, Share2, BarChart2, Lock, XCircle,
  Film, Settings, Home, BarChart,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, timeAgo } from '../lib/utils';
import { API_BASE } from '../lib/api';
import { setViewMode } from '../lib/viewMode';
import ActionButton from '../components/ui/ActionButton';
import First100Tracker from '../components/creator/First100Tracker';
import EmptyState from '../components/ui/EmptyState';
import CreatorOnboardingChecklist from '../components/creator/CreatorOnboardingChecklist';
import CreatorNextAction from '../components/creator/CreatorNextAction';
import CreatorWelcomeReveal from '../components/creator/CreatorWelcomeReveal';
import { useCreatorProgress } from '../hooks/useCreatorProgress';
import CoachingCard from '../components/creator/CoachingCard';
import type { Insight } from '../components/creator/CoachingCard';

interface StripeStatus { has_account: boolean; onboarded: boolean; account_id: string | null }
interface CreatorStats { total_earnings: number; subscriber_count: number; content_unlocks: number; tips_total: number; content_count: number }
interface Transaction { id: string; ref_type: string; amount: number; net_amount: number; payer_name: string; content_title: string | null; created_at: string }
interface CustomRequest { id: string; description: string; offered_price: number; status: string; fan_name: string; created_at: string }
interface PromoStats { views: { total: number; last_7d: number; last_30d: number }; by_source: Record<string, number>; subscribers: number; unlocks: number; conversion_rate: number }
interface InviteLink { id: string; invite_code: string; label: string; click_count: number; created_at: string }
interface ContentCounts { published: number; pending: number; issues: number }

type NavTab = 'overview' | 'content' | 'earnings' | 'audience' | 'promote';

const ACT_COLORS: Record<string, string> = {
  unlock: '#D4AF37', sub: '#10B981', tip: '#D4AF37', request: '#8B5CF6',
};

export default function CreatorDashboardV2() {
  const { user, token, refreshUser, isVerifiedCreator } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

  useEffect(() => { document.title = 'Creator Studio — Archangels Club'; }, []);
  useEffect(() => { setViewMode('creator'); }, []);

  const [statusLoading, setStatusLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [promoStats, setPromoStats] = useState<PromoStats | null>(null);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [newInviteLabel, setNewInviteLabel] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [contentCounts, setContentCounts] = useState<ContentCounts | null>(null);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ category: string; text: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [health, setHealth] = useState<{ score: number; level: string; signals: { label: string; ok: boolean; note: string }[] } | null>(null);
  const [coachingCards, setCoachingCards] = useState<Insight[]>([]);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const firstName = (user?.display_name ?? '').split(' ')[0] || user?.display_name || 'Creator';

  function copyProfileLink() {
    const link = `${window.location.origin}/creator/${user?.username ?? ''}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setProfileLinkCopied(true);
    setTimeout(() => setProfileLinkCopied(false), 2000);
  }

  const progress = useCreatorProgress(
    stats, transactions, requests,
    stripeStatus?.onboarded ?? false,
    user?.avatar_url,
    contentCounts?.published ?? null,
  );

  useEffect(() => {
    if (!token) { setStatusLoading(false); return; }
    refreshUser().finally(() => setStatusLoading(false));
    fetch(`${API_BASE}/api/stripe/connect/status`, { headers: authHeaders })
      .then(r => r.json()).then(setStripeStatus)
      .catch(() => setStripeStatus({ has_account: false, onboarded: false, account_id: null }));
    fetch(`${API_BASE}/api/creators/my/stats`, { headers: authHeaders })
      .then(r => r.json()).then(d => { if (!d.error) setStats(d); }).catch(() => {});
    fetch(`${API_BASE}/api/creators/my/transactions`, { headers: authHeaders })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setTransactions(d); }).catch(() => {});
    fetch(`${API_BASE}/api/creators/my/requests`, { headers: authHeaders })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setRequests(d); }).catch(() => {});
    fetch(`${API_BASE}/api/promo/my/stats`, { headers: authHeaders })
      .then(r => r.json()).then(d => { if (!d.error) setPromoStats(d); }).catch(() => {});
    fetch(`${API_BASE}/api/promo/my/invites`, { headers: authHeaders })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setInviteLinks(d); }).catch(() => {});
    fetch(`${API_BASE}/api/creators/my/content`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setContentCounts({
            published: d.filter((c: any) => c.status === 'approved').length,
            pending:   d.filter((c: any) => c.status === 'pending_review').length,
            issues:    d.filter((c: any) => ['rejected', 'changes_requested', 'failed_processing'].includes(c.status)).length,
          });
        }
      }).catch(() => {});
  }, [token]);

  useEffect(() => {
    const isReturn = searchParams.get('stripe') === 'return' || searchParams.get('connect') === 'complete';
    if (!isReturn || !token) return;
    setSearchParams({}, { replace: true });
    fetch(`${API_BASE}/api/stripe/connect/verify`, { method: 'POST', headers: authHeaders })
      .then(r => r.json())
      .then(data => setStripeStatus(prev => prev ? { ...prev, onboarded: data.onboarded } : null))
      .catch(() => {});
  }, [searchParams, token]);

  useEffect(() => {
    if (!token || !isVerifiedCreator) return;
    fetch(`${API_BASE}/api/creators/my/health`, { headers: authHeaders })
      .then(r => r.json()).then(d => { if (d.score !== undefined) setHealth(d); }).catch(() => {});
    fetch(`${API_BASE}/api/intelligence/my-insights`, { headers: authHeaders })
      .then(r => r.json()).then(d => { if (Array.isArray(d.insights)) setCoachingCards(d.insights); }).catch(() => {});
  }, [token, isVerifiedCreator]);

  useEffect(() => {
    if (!token || !isVerifiedCreator) return;
    setAiLoading(true);
    fetch(`${API_BASE}/api/ai/creator-insights`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.suggestions)) setAiSuggestions(d.suggestions); })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [token, isVerifiedCreator]);

  async function startStripeOnboarding() {
    if (!token) return;
    setStripeLoading(true);
    setStripeError(null);
    try {
      const res = await fetch(`${API_BASE}/api/stripe/connect/start`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      if (res.status === 401) { setStripeError('Session expired.'); setStripeLoading(false); return; }
      const data = await res.json();
      if (!res.ok) { setStripeError(data.error ?? 'Payout setup unavailable.'); setStripeLoading(false); return; }
      if (data.url) window.location.href = data.url;
      else { setStripeError('Payout setup unavailable.'); setStripeLoading(false); }
    } catch { setStripeError('Unable to reach the server.'); setStripeLoading(false); }
  }

  async function createInviteLink() {
    if (!token) return;
    setCreatingInvite(true);
    try {
      const res = await fetch(`${API_BASE}/api/promo/my/invites`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newInviteLabel.trim() || 'Invite Link' }),
      });
      const data = await res.json();
      if (!data.error) { setInviteLinks(prev => [data, ...prev]); setNewInviteLabel(''); }
    } finally { setCreatingInvite(false); }
  }

  async function deleteInviteLink(id: string) {
    if (!token) return;
    await fetch(`${API_BASE}/api/promo/my/invites/${id}`, { method: 'DELETE', headers: authHeaders });
    setInviteLinks(prev => prev.filter(l => l.id !== id));
  }

  async function openStripeDashboard() {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/stripe/connect/dashboard-link`, { method: 'POST', headers: authHeaders });
    if (res.status === 401) return;
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
  }

  const pendingRequests = requests.filter(r => r.status === 'pending').length;
  const hasEarnings = (stats?.total_earnings ?? 0) > 0;
  const hasContent  = (contentCounts?.published ?? 0) > 0;
  const isActive    = isVerifiedCreator && (hasEarnings || hasContent || (stats?.subscriber_count ?? 0) > 0);

  type ActivityType = 'unlock' | 'sub' | 'tip' | 'request';
  type ActivityItem = { type: ActivityType; text: string; time: string; amount: string };

  const activityFeed: ActivityItem[] = [
    ...transactions.slice(0, 6).map((txn): ActivityItem => ({
      type: txn.ref_type === 'subscription' ? 'sub' : txn.ref_type === 'tip' ? 'tip' : 'unlock',
      text: txn.ref_type === 'subscription'
        ? `${txn.payer_name} joined your audience`
        : txn.ref_type === 'tip' ? `${txn.payer_name} sent a tip`
        : `${txn.payer_name} unlocked ${txn.content_title ?? 'your content'}`,
      time: timeAgo(txn.created_at),
      amount: `+${formatCurrency(Number(txn.net_amount))}`,
    })),
    ...requests.filter(r => r.status === 'pending').slice(0, 2).map((req): ActivityItem => ({
      type: 'request',
      text: `Custom request from ${req.fan_name}${req.description ? `: "${req.description.slice(0, 40)}…"` : ''}`,
      time: timeAgo(req.created_at),
      amount: formatCurrency(Number(req.offered_price)),
    })),
  ];

  const profileUrl = `${window.location.origin}/creator/${user?.username ?? ''}`;
  const subscribeUrl = `${profileUrl}?src=invite`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(profileUrl)}&size=150x150&color=D4AF37&bgcolor=09090B&margin=12`;

  const captions = [
    { key: 'cap-profile', label: 'Profile Drop',   text: `My exclusive content is now live on Archangels Club — link in bio.\n${profileUrl}` },
    { key: 'cap-sub',     label: 'Subscriber CTA', text: `Subscribers get full access to every private drop I post — cancel anytime.\n${subscribeUrl}` },
    { key: 'cap-drop',    label: 'Drop Alert',      text: `New drop just went live. Limited unlocks only — first come, first served.\n${profileUrl}` },
    { key: 'cap-fomo',    label: 'FOMO Push',       text: `This is only available for a limited time. Once the spots are gone, it's gone.\n${profileUrl}` },
    { key: 'cap-general', label: 'General',          text: `Exclusive content you won't find anywhere else.\n${profileUrl}` },
  ];

  const sourceLabels: Record<string, string> = {
    invite: 'Invite Links', social: 'Social', explore: 'Explore Page',
    recommendation: 'Recommendations', drop: 'Drop Links', direct: 'Direct', profile: 'Profile Link',
  };

  const navItems: { id: NavTab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: 'overview',  icon: <Home className="w-4 h-4" />,       label: 'Overview' },
    { id: 'content',   icon: <Film className="w-4 h-4" />,       label: 'Content',  badge: contentCounts?.pending ?? undefined },
    { id: 'earnings',  icon: <BarChart className="w-4 h-4" />,   label: 'Earnings' },
    { id: 'audience',  icon: <Users className="w-4 h-4" />,      label: 'Audience' },
    { id: 'promote',   icon: <Share2 className="w-4 h-4" />,     label: 'Promote' },
  ];

  return (
    <>
      {user && (
        <CreatorWelcomeReveal userId={user.id} firstName={firstName} isVerifiedCreator={isVerifiedCreator} />
      )}

      <div className="min-h-screen bg-bg-primary flex flex-col">
        {/* ── Top bar ─────────────────────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-30 flex items-center gap-4 px-4 sm:px-6 py-3"
          style={{
            background: 'rgba(10,10,15,0.95)',
            borderBottom: '1px solid rgba(212,175,55,0.12)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Avatar + name */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url} alt={firstName}
                className="w-8 h-8 rounded-full object-cover"
                style={{ border: '1.5px solid rgba(212,175,55,0.35)' }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(212,175,55,0.08)', border: '1.5px solid rgba(212,175,55,0.25)' }}
              >
                <span className="font-serif text-sm text-gold">{firstName[0]?.toUpperCase() ?? '?'}</span>
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-white leading-none">{user?.display_name ?? firstName}</p>
              <p className="text-[10px] text-arc-muted mt-0.5">Creator Studio</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="hidden md:flex items-center gap-5 mx-auto">
            {[
              { label: 'Earnings', value: stats ? formatCurrency(stats.total_earnings) : '—' },
              { label: 'Audience', value: stats ? stats.subscriber_count.toLocaleString() : '—' },
              { label: 'Drops',    value: contentCounts ? contentCounts.published.toLocaleString() : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="font-serif text-sm text-white leading-none">{value}</p>
                <p className="text-[10px] text-arc-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {stripeStatus !== null && !stripeStatus.onboarded && (
              <button
                onClick={startStripeOnboarding}
                disabled={stripeLoading}
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-amber-400 border border-amber-400/30 px-3 py-1.5 rounded-lg bg-amber-400/6 hover:bg-amber-400/12 transition-all disabled:opacity-50"
              >
                <Zap className="w-3 h-3" />
                {stripeLoading ? 'Connecting…' : 'Enable Payouts'}
              </button>
            )}
            <Link to="/upload" className="btn-gold text-xs px-4 py-2 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Drop</span>
            </Link>
          </div>
        </div>

        {/* ── Body: sidebar + main ─────────────────────────────────────────────── */}
        <div className="flex flex-1 max-w-[1440px] mx-auto w-full px-0 sm:px-4 lg:px-6 xl:px-8 py-0 sm:py-6 gap-0 sm:gap-6">

          {/* ── Left sidebar ──────────────────────────────────────────────────── */}
          <aside
            className="hidden md:flex flex-col w-52 lg:w-60 flex-shrink-0"
            style={{ minHeight: 'calc(100vh - 57px)' }}
          >
            <div
              className="sticky top-[57px] flex flex-col gap-1 pt-4 pb-6 px-2 rounded-xl"
              style={{ background: 'rgba(20,20,25,0.6)', border: '1px solid rgba(212,175,55,0.08)' }}
            >
              {/* Creator info */}
              <div className="px-3 pb-4 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  {!statusLoading && isVerifiedCreator && (
                    <span className="w-1.5 h-1.5 rounded-full bg-arc-success" style={{ boxShadow: '0 0 5px rgba(34,197,94,0.5)' }} />
                  )}
                  <p className="text-[10px] text-arc-muted tracking-widest uppercase">
                    {isVerifiedCreator ? 'Live Studio' : 'Pending Approval'}
                  </p>
                </div>
                {user?.username && (
                  <p className="text-xs text-arc-secondary truncate">@{user.username}</p>
                )}
              </div>

              {/* Nav items */}
              {navItems.map(({ id, icon, label, badge }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative text-left ${
                    activeTab === id
                      ? 'bg-gold/10 border border-gold/25 text-gold'
                      : 'text-arc-secondary hover:text-white hover:bg-bg-hover border border-transparent'
                  }`}
                >
                  <span className={`flex-shrink-0 ${activeTab === id ? 'text-gold' : 'text-gold/50 group-hover:text-gold/80'}`}>
                    {icon}
                  </span>
                  <span className={`text-xs font-medium ${activeTab === id ? 'text-gold' : ''}`}>{label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-gold text-bg-primary px-1.5 py-0.5 rounded-full leading-none">
                      {badge}
                    </span>
                  )}
                </button>
              ))}

              {/* Divider */}
              <div className="mx-3 my-2 h-px bg-white/5" />

              {/* Bottom links */}
              <Link
                to="/creator/media"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-arc-muted hover:text-white hover:bg-bg-hover transition-all"
              >
                <LayoutGrid className="w-4 h-4 text-gold/40" />
                Media Library
              </Link>
              <Link
                to="/messages"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-arc-muted hover:text-white hover:bg-bg-hover transition-all relative"
              >
                <MessageCircle className="w-4 h-4 text-gold/40" />
                Messages
                {pendingRequests > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-violet-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                    {pendingRequests}
                  </span>
                )}
              </Link>
              <Link
                to="/settings"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-arc-muted hover:text-white hover:bg-bg-hover transition-all"
              >
                <Settings className="w-4 h-4 text-gold/40" />
                Settings
              </Link>

              {/* Stripe payout in sidebar for mobile fallback */}
              {stripeStatus !== null && !stripeStatus.onboarded && (
                <div className="mx-2 mt-2 p-3 rounded-xl bg-gold/6 border border-gold/20">
                  <p className="text-[10px] font-medium text-gold mb-1.5 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Payouts off
                  </p>
                  <button
                    onClick={startStripeOnboarding}
                    disabled={stripeLoading}
                    className="w-full text-[11px] text-gold border border-gold/30 px-2 py-1.5 rounded-lg hover:bg-gold/10 transition-all disabled:opacity-50"
                  >
                    {stripeLoading ? 'Connecting…' : 'Enable Payouts →'}
                  </button>
                  {stripeError && <p className="text-[10px] text-amber-400 mt-1.5">{stripeError}</p>}
                </div>
              )}
            </div>
          </aside>

          {/* ── Mobile nav tabs ────────────────────────────────────────────────── */}
          <div className="md:hidden flex items-center gap-1 overflow-x-auto no-scrollbar px-4 py-3 bg-bg-surface border-b border-white/5 w-full">
            {navItems.map(({ id, icon, label, badge }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                  activeTab === id
                    ? 'bg-gold/12 text-gold border border-gold/25'
                    : 'text-arc-secondary hover:text-white hover:bg-bg-hover border border-transparent'
                }`}
              >
                {icon}
                {label}
                {badge !== undefined && badge > 0 && (
                  <span className="bg-gold text-bg-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Main content area ─────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0 px-4 py-4 sm:py-0 sm:px-0 space-y-6">

            {/* Alerts bar */}
            <div className="space-y-3">
              {contentCounts !== null && contentCounts.issues > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-arc-error/8 border border-arc-error/20">
                  <AlertCircle className="w-4 h-4 text-arc-error flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-arc-error">
                      {contentCounts.issues} drop{contentCounts.issues !== 1 ? 's' : ''} need attention
                    </p>
                  </div>
                  <Link to="/creator/media" className="text-xs text-gold hover:underline flex-shrink-0">Review →</Link>
                </div>
              )}
              {stripeStatus?.onboarded && !hasEarnings && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-arc-success/8 border border-arc-success/20">
                  <CheckCircle className="w-4 h-4 text-arc-success flex-shrink-0" />
                  <p className="text-xs text-arc-success flex-1">Payouts active — 70% of every sale, weekly.</p>
                  <button onClick={openStripeDashboard} className="text-xs text-gold hover:underline flex-shrink-0 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Dashboard
                  </button>
                </div>
              )}
            </div>

            {/* Checklist + next action */}
            {user && (progress.level === 'new' || progress.level === 'early') && (
              <CreatorOnboardingChecklist
                items={progress.checklistItems}
                completePct={progress.checklistCompletePct}
                allComplete={progress.checklistAllComplete}
                userId={user.id}
                onStripeSetup={startStripeOnboarding}
              />
            )}
            {progress.nextAction && <CreatorNextAction action={progress.nextAction} />}

            {/* ── OVERVIEW tab ──────────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stat grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Earnings',    value: stats ? formatCurrency(stats.total_earnings)    : '—', icon: <DollarSign className="w-5 h-5" />, sub: 'lifetime net' },
                    { label: 'Subscribers', value: stats ? stats.subscriber_count.toLocaleString() : '—', icon: <Users className="w-5 h-5" />,       sub: 'active' },
                    { label: 'Unlocks',     value: stats ? stats.content_unlocks.toLocaleString()  : '—', icon: <TrendingUp className="w-5 h-5" />,  sub: 'all time' },
                    { label: 'Tips',        value: stats ? formatCurrency(stats.tips_total)        : '—', icon: <Star className="w-5 h-5" />,         sub: 'received' },
                  ].map(({ label, value, icon, sub }) => (
                    <div
                      key={label}
                      className="card-surface p-5 rounded-xl"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold tracking-widest uppercase text-arc-secondary mb-2">{label}</p>
                          <p className="font-serif text-2xl text-white">{value}</p>
                          <p className="text-[10px] text-arc-muted mt-1">{sub}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-gold-muted border border-gold-border text-gold flex-shrink-0">{icon}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Activity feed */}
                <div className="card-surface rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <h2 className="font-serif text-base text-white">Recent Activity</h2>
                    {activityFeed.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-arc-success" style={{ animation: 'pulse 2.2s ease-in-out infinite' }} />
                        <span className="text-[9px] font-bold tracking-widest uppercase text-arc-success/70">Live</span>
                      </span>
                    )}
                  </div>
                  {activityFeed.length > 0 ? (
                    <div>
                      {activityFeed.slice(0, 6).map((a, i) => (
                        <div key={i} className={`flex items-start gap-3 px-5 py-3 ${i < 5 ? 'border-b border-white/4' : ''}`}>
                          <div className="w-2 h-2 rounded-full mt-[7px] flex-shrink-0" style={{ backgroundColor: ACT_COLORS[a.type] ?? '#D4AF37' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white leading-snug">{a.text}</p>
                            <p className="text-xs text-arc-muted mt-0.5">{a.time}</p>
                          </div>
                          {a.amount && (
                            <span className="text-xs font-medium flex-shrink-0 tabular-nums" style={{ color: ACT_COLORS[a.type] ?? '#D4AF37' }}>
                              {a.amount}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-8">
                      <EmptyState
                        icon={<Sparkles className="w-6 h-6" />}
                        title="Your first drop starts the story."
                        description="Publish a locked drop and share your profile."
                      />
                    </div>
                  )}
                </div>

                {/* Health + coaching */}
                {health && (
                  <div className="card-surface p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-serif text-base text-white">Studio Health</h3>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                        health.score >= 80 ? 'text-arc-success bg-arc-success/10 border-arc-success/25'
                        : health.score >= 60 ? 'text-gold bg-gold/10 border-gold/25'
                        : 'text-amber-400 bg-amber-400/10 border-amber-400/25'
                      }`}>{health.level}</span>
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <span className="font-serif text-4xl text-white">{health.score}</span>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${health.score}%`, background: health.score >= 80 ? '#10B981' : health.score >= 60 ? '#D4AF37' : '#F59E0B' }}
                          />
                        </div>
                        <p className="text-[10px] text-arc-muted mt-1">/100 health score</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {health.signals.map((s, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className={`text-[11px] mt-0.5 flex-shrink-0 ${s.ok ? 'text-arc-success' : 'text-arc-muted'}`}>{s.ok ? '✓' : '○'}</span>
                          <p className="text-[11px] text-arc-secondary leading-snug">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {coachingCards.length > 0 && (
                  <div className="card-surface p-5 rounded-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertCircle className="w-4 h-4 text-gold/70" />
                      <h3 className="font-serif text-base text-white">Studio Coaching</h3>
                    </div>
                    <div className="space-y-3">
                      {coachingCards.map(card => <CoachingCard key={card.type} insight={card} />)}
                    </div>
                  </div>
                )}

                {stats !== null && stats.total_earnings < 100 && (
                  <First100Tracker currentEarnings={stats.total_earnings} />
                )}

                {!isActive && (
                  <Link
                    to="/creator/onboarding"
                    className="block rounded-xl border border-gold/35 hover:border-gold/60 transition-all group overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(10,10,15,0.97) 65%)' }}
                  >
                    <div className="p-5 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gold/12 border border-gold/30 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-5 h-5 text-gold" />
                      </div>
                      <div className="flex-1">
                        <p className="font-serif text-base text-white">Creator Training</p>
                        <p className="text-xs text-arc-secondary mt-0.5">5-minute guide to your first earnings</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gold/50 group-hover:text-gold transition-all" />
                    </div>
                  </Link>
                )}
              </div>
            )}

            {/* ── CONTENT tab ───────────────────────────────────────────────────── */}
            {activeTab === 'content' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl text-white">Content</h2>
                  <Link to="/upload" className="btn-gold text-xs px-4 py-2 flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" /> New Drop
                  </Link>
                </div>

                {/* Content counts */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Published', value: contentCounts?.published ?? '—', color: 'text-arc-success', bg: 'bg-arc-success/8 border-arc-success/20' },
                    { label: 'In Review',  value: contentCounts?.pending ?? '—',   color: 'text-amber-400',   bg: 'bg-amber-400/8 border-amber-400/20' },
                    { label: 'Issues',     value: contentCounts?.issues ?? '—',    color: 'text-arc-error',   bg: 'bg-arc-error/8 border-arc-error/20' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`p-4 rounded-xl border ${bg} text-center`}>
                      <p className={`font-serif text-3xl ${color}`}>{value}</p>
                      <p className="text-xs text-arc-muted mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="card-surface p-6 rounded-xl flex flex-col items-center gap-4 text-center">
                  <LayoutGrid className="w-8 h-8 text-gold/50" />
                  <div>
                    <p className="font-serif text-base text-white mb-1">Manage your media library</p>
                    <p className="text-xs text-arc-secondary">View, edit, and manage all your drops in one place.</p>
                  </div>
                  <Link to="/creator/media" className="btn-gold text-xs px-5 py-2.5">Open Media Library</Link>
                </div>

                {/* Requests */}
                {requests.length > 0 && (
                  <div className="card-surface p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-serif text-base text-white">Custom Requests</h3>
                      {pendingRequests > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300">{pendingRequests} new</span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {requests.map(req => (
                        <div key={req.id} className="p-4 rounded-xl bg-bg-hover border border-white/5">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <p className="text-sm text-white leading-relaxed flex-1">{req.description}</p>
                            <span className="font-serif text-gold text-base flex-shrink-0">{formatCurrency(Number(req.offered_price))}</span>
                          </div>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                                req.status === 'pending' ? 'text-amber-400 bg-amber-400/10 border-amber-400/25'
                                : req.status === 'accepted' ? 'text-arc-success bg-arc-success/10 border-arc-success/25'
                                : 'text-arc-error bg-arc-error/10 border-arc-error/25'
                              }`}>{req.status === 'pending' ? 'new' : req.status}</span>
                              <span className="text-xs text-arc-muted">from {req.fan_name}</span>
                            </div>
                            {req.status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <ActionButton
                                  onAction={async () => {
                                    const res = await fetch(`${API_BASE}/api/messages/custom-request/${req.id}`, {
                                      method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: 'accepted' }),
                                    });
                                    if (!res.ok) throw new Error();
                                  }}
                                  onSuccess={() => setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'accepted' } : r))}
                                  label={<CheckCircle className="w-4 h-4" />} loadingLabel="…" successLabel="✓"
                                  className="p-1.5 rounded-lg bg-arc-success/10 text-arc-success hover:bg-arc-success/20"
                                />
                                <ActionButton
                                  onAction={async () => {
                                    const res = await fetch(`${API_BASE}/api/messages/custom-request/${req.id}`, {
                                      method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: 'rejected' }),
                                    });
                                    if (!res.ok) throw new Error();
                                  }}
                                  onSuccess={() => setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r))}
                                  label={<XCircle className="w-4 h-4" />} loadingLabel="…" successLabel="✓"
                                  className="p-1.5 rounded-lg bg-arc-error/10 text-arc-error hover:bg-arc-error/20"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── EARNINGS tab ──────────────────────────────────────────────────── */}
            {activeTab === 'earnings' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl text-white">Earnings</h2>
                  {stripeStatus?.onboarded ? (
                    <button onClick={openStripeDashboard} className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/8 flex items-center gap-1.5 transition-all">
                      <ExternalLink className="w-3 h-3" /> Stripe Dashboard
                    </button>
                  ) : (
                    <button
                      onClick={startStripeOnboarding}
                      disabled={stripeLoading}
                      className="btn-gold text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {stripeLoading ? 'Connecting…' : 'Enable Payouts'}
                    </button>
                  )}
                </div>

                {stripeError && <p className="text-xs text-amber-400">{stripeError}</p>}

                {/* Big number */}
                <div
                  className="p-8 rounded-2xl text-center"
                  style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(20,20,25,0.97) 70%)', border: '1px solid rgba(212,175,55,0.20)' }}
                >
                  <p className="section-eyebrow mb-3">Lifetime Earnings</p>
                  <p className="font-serif text-5xl sm:text-6xl text-white mb-2">{stats ? formatCurrency(stats.total_earnings) : '—'}</p>
                  <p className="text-xs text-arc-muted">70% of every sale — weekly deposits via Stripe</p>
                </div>

                {/* Mini revenue bars */}
                {transactions.length > 0 && (
                  <div className="card-surface p-6 rounded-xl">
                    <h3 className="font-serif text-base text-white mb-4">Recent Revenue</h3>
                    <div className="flex items-end gap-1.5 h-20 mb-5">
                      {(() => {
                        const recent = transactions.slice(0, 12);
                        const maxAmt = Math.max(...recent.map(t => Number(t.net_amount)), 1);
                        return recent.map((t, i) => {
                          const pct = Math.max(10, (Number(t.net_amount) / maxAmt) * 100);
                          const barColor = t.ref_type === 'subscription' ? '#10B981' : t.ref_type === 'tip' ? '#8B5CF6' : '#D4AF37';
                          return (
                            <div
                              key={t.id}
                              title={`${t.ref_type} · ${formatCurrency(Number(t.net_amount))}`}
                              style={{ height: `${pct}%`, background: barColor, opacity: 0.4 + (i / recent.length) * 0.6, flex: 1 }}
                              className="rounded min-w-0 hover:opacity-100 transition-opacity cursor-default"
                            />
                          );
                        });
                      })()}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-arc-muted">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-gold inline-block" /> Unlock</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-arc-success inline-block" /> Sub</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-violet-500 inline-block" /> Tip</span>
                    </div>
                  </div>
                )}

                {/* Transaction list */}
                {transactions.length > 0 && (
                  <div className="card-surface rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/5">
                      <h3 className="font-serif text-base text-white">Transactions</h3>
                    </div>
                    <div className="divide-y divide-white/4">
                      {transactions.slice(0, 10).map((txn) => (
                        <div key={txn.id} className="flex items-center gap-4 px-5 py-3">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: txn.ref_type === 'subscription' ? '#10B981' : txn.ref_type === 'tip' ? '#8B5CF6' : '#D4AF37' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{txn.payer_name}</p>
                            <p className="text-xs text-arc-muted">{txn.ref_type}{txn.content_title ? ` · ${txn.content_title}` : ''}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-medium text-gold tabular-nums">+{formatCurrency(Number(txn.net_amount))}</p>
                            <p className="text-[10px] text-arc-muted">{timeAgo(txn.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!transactions.length && (
                  <div className="card-surface p-8 rounded-xl text-center">
                    <EmptyState
                      icon={<DollarSign className="w-6 h-6" />}
                      title="No transactions yet"
                      description="Your first sale will appear here. Publish a drop and share your profile to get started."
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── AUDIENCE tab ──────────────────────────────────────────────────── */}
            {activeTab === 'audience' && (
              <div className="space-y-6">
                <h2 className="font-serif text-xl text-white">Audience</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Subscribers',    value: stats?.subscriber_count ?? '—', sub: 'active', icon: <Users className="w-5 h-5" /> },
                    { label: 'Content Unlocks', value: stats?.content_unlocks ?? '—',   sub: 'all time', icon: <Lock className="w-5 h-5" /> },
                    { label: 'Profile Views',  value: promoStats?.views.total ?? '—',  sub: 'all time', icon: <Eye className="w-5 h-5" /> },
                    { label: 'Views (7d)',      value: promoStats?.views.last_7d ?? '—', sub: 'last week', icon: <TrendingUp className="w-5 h-5" /> },
                    { label: 'Conversion',     value: promoStats ? `${promoStats.conversion_rate}%` : '—', sub: 'view → buy', icon: <BarChart2 className="w-5 h-5" /> },
                    { label: 'Custom Requests', value: requests.length,               sub: 'total received', icon: <MessageCircle className="w-5 h-5" /> },
                  ].map(({ label, value, sub, icon }) => (
                    <div key={label} className="card-surface p-4 rounded-xl">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold tracking-widest uppercase text-arc-secondary mb-2">{label}</p>
                          <p className="font-serif text-2xl text-white">{value}</p>
                          <p className="text-[10px] text-arc-muted mt-1">{sub}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-gold-muted border border-gold-border text-gold/70 flex-shrink-0">{icon}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI Studio Advisor */}
                {isVerifiedCreator && (aiLoading || aiSuggestions.length > 0) && (
                  <div className="card-surface p-5 rounded-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-4 h-4 text-gold/70" />
                      <h3 className="font-serif text-base text-white">Studio Advisor</h3>
                      <span className="ml-auto text-[10px] text-arc-muted tracking-widest uppercase">AI</span>
                    </div>
                    {aiLoading ? (
                      <div className="space-y-3">
                        {[80, 65, 90].map(w => (
                          <div key={w} className="flex flex-col gap-1.5">
                            <div className="h-2.5 rounded-full bg-white/6 animate-pulse" style={{ width: `${w * 0.4}%` }} />
                            <div className="h-3 rounded-full bg-white/4 animate-pulse" style={{ width: `${w}%` }} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {aiSuggestions.map((s, i) => {
                          const catColor: Record<string, string> = {
                            Pricing: 'text-gold bg-gold/10 border-gold/25',
                            Growth: 'text-arc-success bg-arc-success/10 border-arc-success/25',
                            Content: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
                            Profile: 'text-arc-secondary bg-white/5 border-white/10',
                          };
                          return (
                            <div key={i} className="flex flex-col gap-1.5">
                              <span className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full border ${catColor[s.category] ?? catColor.Profile}`}>{s.category}</span>
                              <p className="text-xs text-arc-secondary leading-relaxed">{s.text}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── PROMOTE tab ───────────────────────────────────────────────────── */}
            {activeTab === 'promote' && (
              <div className="space-y-6">
                <h2 className="font-serif text-xl text-white">Promote</h2>

                {/* Share Links */}
                <div className="card-surface p-6 rounded-xl space-y-5">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-gold" />
                    <h3 className="font-serif text-base text-white">Share Links</h3>
                  </div>
                  {[
                    { key: 'link-profile', label: 'Creator Profile', url: profileUrl },
                    { key: 'link-sub',     label: 'Subscribe Page',  url: subscribeUrl },
                  ].map(({ key, label, url }) => (
                    <div key={key}>
                      <p className="text-xs text-arc-muted mb-1.5">{label}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-bg-hover border border-white/8 text-xs text-arc-secondary truncate">{url}</div>
                        <ActionButton
                          onAction={() => navigator.clipboard.writeText(url)}
                          label={<Copy className="w-4 h-4" />} successLabel="Copied"
                          className="flex-shrink-0 p-2 rounded-lg bg-bg-hover border border-white/8 text-arc-secondary hover:text-gold hover:border-gold/30 transition-all text-xs"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-5 pt-2 border-t border-white/5">
                    <img src={qrUrl} alt="Profile QR code" className="w-[72px] h-[72px] rounded-lg border border-gold/20 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white mb-2">QR Code</p>
                      <a href={qrUrl} download="archangels-qr.png" className="text-xs text-gold hover:underline flex items-center gap-1">
                        <Share2 className="w-3 h-3" /> Download
                      </a>
                    </div>
                  </div>
                </div>

                {/* Reach stats */}
                <div className="card-surface p-6 rounded-xl">
                  <div className="flex items-center gap-2 mb-5">
                    <BarChart2 className="w-4 h-4 text-gold" />
                    <h3 className="font-serif text-base text-white">Your Reach</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    {[
                      { label: 'Profile Views',   value: promoStats?.views.total ?? '—',                            sub: 'all time' },
                      { label: 'Last 7 Days',     value: promoStats?.views.last_7d ?? '—',                          sub: 'views' },
                      { label: 'Subscribers',     value: promoStats?.subscribers ?? stats?.subscriber_count ?? '—', sub: 'active' },
                      { label: 'Unlocks',         value: promoStats?.unlocks ?? '—',                                sub: 'total' },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="p-3 rounded-xl bg-bg-hover border border-white/5">
                        <p className="text-xs text-arc-muted mb-0.5">{label}</p>
                        <p className="font-serif text-xl text-gold">{value}</p>
                        <p className="text-[10px] text-arc-muted">{sub}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-arc-muted">Conversion Rate</p>
                    <p className="text-gold font-serif">{promoStats ? `${promoStats.conversion_rate}%` : '—'}</p>
                  </div>
                  {promoStats && Object.keys(promoStats.by_source).length > 0 && (
                    <div className="space-y-1.5 mt-4 pt-4 border-t border-white/5">
                      <p className="text-xs text-arc-muted mb-2">Traffic by Source</p>
                      {Object.entries(promoStats.by_source).sort(([, a], [, b]) => b - a).map(([src, n]) => (
                        <div key={src} className="flex items-center justify-between text-xs">
                          <span className="text-arc-secondary">{sourceLabels[src] ?? src}</span>
                          <span className="text-white font-mono">{n}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Captions */}
                <div className="card-surface p-6 rounded-xl">
                  <h3 className="font-serif text-base text-white mb-4">Captions</h3>
                  <div className="space-y-3">
                    {captions.map(({ key, label, text }) => (
                      <div key={key} className="p-4 rounded-xl bg-bg-hover border border-white/5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold tracking-wider uppercase text-arc-muted mb-1">{label}</p>
                            <p className="text-xs text-arc-secondary leading-relaxed whitespace-pre-line">{text}</p>
                          </div>
                          <ActionButton
                            onAction={() => navigator.clipboard.writeText(text)}
                            label={<Copy className="w-4 h-4" />} successLabel="Copied"
                            className="flex-shrink-0 p-2 rounded-lg text-arc-muted hover:text-gold hover:bg-gold/8 transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invite links */}
                <div className="card-surface p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-serif text-base text-white">Invite Links</h3>
                      <p className="text-xs text-arc-muted mt-0.5">Up to 10 links.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text" value={newInviteLabel}
                        onChange={e => setNewInviteLabel(e.target.value)}
                        placeholder="Label" className="input-dark text-xs py-1.5 px-3 w-28" maxLength={60}
                        onKeyDown={e => { if (e.key === 'Enter') createInviteLink(); }}
                      />
                      <button
                        onClick={createInviteLink}
                        disabled={creatingInvite || inviteLinks.length >= 10}
                        className="btn-gold text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {creatingInvite ? 'Creating…' : 'New'}
                      </button>
                    </div>
                  </div>
                  {inviteLinks.length > 0 ? (
                    <div className="space-y-2">
                      {inviteLinks.map(link => {
                        const inviteUrl = `${profileUrl}?ref=${link.invite_code}&src=invite`;
                        return (
                          <div key={link.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-hover border border-white/5">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white mb-0.5">{link.label}</p>
                              <p className="text-[10px] text-arc-muted truncate">{inviteUrl}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="flex items-center gap-1 text-xs text-arc-muted"><Eye className="w-3 h-3" />{link.click_count}</span>
                              <ActionButton
                                onAction={() => navigator.clipboard.writeText(inviteUrl)}
                                label={<Copy className="w-3.5 h-3.5" />} successLabel="Copied"
                                className="p-1.5 rounded-lg text-arc-muted hover:text-gold hover:bg-gold/8 text-xs"
                              />
                              <button onClick={() => deleteInviteLink(link.id)} className="p-1.5 rounded-lg text-arc-muted hover:text-arc-error hover:bg-arc-error/8">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-arc-muted text-center py-6">No invite links yet.</p>
                  )}
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  );
}
