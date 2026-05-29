/**
 * CreatorDashboard — Prototype C: "Magazine"
 *
 * Editorial layout. Large hero gradient banner with creator name in big serif.
 * Metric cards styled like magazine call-outs. Recent drops in a masonry-style grid.
 * Earnings displayed as a clean table. Opulent, editorial feel.
 */
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Upload, DollarSign, Users, TrendingUp, MessageCircle, ChevronRight,
  Star, CheckCircle, Crown, ExternalLink, Zap, Copy, Check,
  LayoutGrid, AlertCircle, Eye, Sparkles, Link2, Trash2,
  Plus, Share2, BarChart2, Lock, XCircle,
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

const ACT_COLORS: Record<string, string> = {
  unlock: '#D4AF37', sub: '#10B981', tip: '#D4AF37', request: '#8B5CF6',
};

export default function CreatorDashboardV3() {
  const { user, token, refreshUser, isVerifiedCreator } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => { document.title = 'Creator Studio — Archangels Club'; }, []);
  useEffect(() => { setViewMode('creator'); }, []);

  const [statusLoading, setStatusLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [profileSetupNeeded, setProfileSetupNeeded] = useState(false);
  const [trainingViewed, setTrainingViewed] = useState(false);
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
      .then(r => r.json())
      .then(d => { if (d.error) setProfileSetupNeeded(true); else setStats(d); })
      .catch(() => {});
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
    fetch(`${API_BASE}/api/creators/my/onboarding`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d?.steps?.training_viewed) setTrainingViewed(true); })
      .catch(() => {});
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
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
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
    } catch { setStripeError('Unable to reach server.'); setStripeLoading(false); }
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
    ...transactions.slice(0, 8).map((txn): ActivityItem => ({
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
      text: `Custom request from ${req.fan_name}`,
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

  const showContent = !(stats !== null && stats.content_count === 0);

  // Magazine-style metric cards
  const metrics = [
    {
      eyebrow: 'Lifetime Earnings',
      value: stats ? formatCurrency(stats.total_earnings) : '—',
      note: '70% of every sale',
      icon: <DollarSign className="w-6 h-6" />,
      accent: '#D4AF37',
    },
    {
      eyebrow: 'Your Audience',
      value: stats ? stats.subscriber_count.toLocaleString() : '—',
      note: 'active subscribers',
      icon: <Users className="w-6 h-6" />,
      accent: '#10B981',
    },
    {
      eyebrow: 'Content Unlocks',
      value: stats ? stats.content_unlocks.toLocaleString() : '—',
      note: 'all-time purchases',
      icon: <TrendingUp className="w-6 h-6" />,
      accent: '#D4AF37',
    },
    {
      eyebrow: 'Tips Received',
      value: stats ? formatCurrency(stats.tips_total) : '—',
      note: 'lifetime total',
      icon: <Star className="w-6 h-6" />,
      accent: '#8B5CF6',
    },
  ];

  return (
    <>
      {user && (
        <CreatorWelcomeReveal userId={user.id} firstName={firstName} isVerifiedCreator={isVerifiedCreator} />
      )}
      <div className="min-h-screen bg-bg-primary">

        {/* ── Editorial hero banner ─────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #0a0a0f 0%, #0f0e08 40%, #0a0a0f 100%)',
            minHeight: '320px',
          }}
        >
          {/* Decorative gold gradients */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.5) 50%, transparent 100%)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.25) 50%, transparent 100%)' }} />
            <div style={{ position: 'absolute', top: 0, left: '10%', width: '40%', height: '100%', background: 'radial-gradient(ellipse 60% 100% at 30% 50%, rgba(212,175,55,0.07) 0%, transparent 70%)' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, rgba(212,175,55,0.02) 0px, rgba(212,175,55,0.02) 1px, transparent 1px, transparent 80px)', backgroundSize: '80px 100%' }} />
          </div>

          <div className="relative max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 pt-16 pb-16">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-8">
              <div className="h-px flex-1 max-w-[60px]" style={{ background: 'rgba(212,175,55,0.4)' }} />
              <p className="section-eyebrow text-[11px] tracking-[0.3em]">Creator Studio</p>
              <div className="h-px flex-1 max-w-[60px]" style={{ background: 'rgba(212,175,55,0.4)' }} />
            </div>

            {/* Creator name — big editorial serif */}
            <div className="flex items-end gap-6 mb-6">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url} alt={firstName}
                  className="hidden sm:block w-24 h-24 xl:w-28 xl:h-28 rounded-full object-cover flex-shrink-0 mb-1"
                  style={{ border: '2px solid rgba(212,175,55,0.40)', boxShadow: '0 0 40px rgba(212,175,55,0.18)' }}
                />
              ) : (
                <div
                  className="hidden sm:flex w-24 h-24 xl:w-28 xl:h-28 rounded-full items-center justify-center flex-shrink-0 mb-1"
                  style={{ background: 'rgba(212,175,55,0.07)', border: '2px solid rgba(212,175,55,0.25)' }}
                >
                  <span className="font-serif text-4xl text-gold">{firstName[0]?.toUpperCase() ?? '?'}</span>
                </div>
              )}
              <div>
                <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-white leading-none tracking-tight">
                  {user?.display_name ?? firstName}
                </h1>
                {user?.username && (
                  <p className="text-arc-muted text-sm mt-3 tracking-widest">
                    @{user.username}
                    {!statusLoading && isVerifiedCreator && (
                      <span className="ml-3 inline-flex items-center gap-1.5 text-arc-success">
                        <span className="w-1.5 h-1.5 rounded-full bg-arc-success" style={{ boxShadow: '0 0 5px rgba(34,197,94,0.5)' }} />
                        Approved Creator
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Subline */}
            <p className="font-serif text-lg sm:text-xl text-arc-secondary italic max-w-xl leading-relaxed mb-10">
              Every drop you publish works for you — even while you sleep.
            </p>

            {/* Action row */}
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/upload" className="btn-gold flex items-center gap-2 px-7 py-3">
                <Upload className="w-4 h-4" />
                Create a Drop
              </Link>
              <Link
                to={`/creator/${user?.username ?? ''}`}
                className="btn-outline flex items-center gap-2 px-5 py-3 text-sm"
              >
                <Eye className="w-4 h-4" />
                View Profile
              </Link>
              <button
                onClick={copyProfileLink}
                className="flex items-center gap-2 px-5 py-3 rounded text-sm border border-white/12 text-arc-secondary hover:text-white hover:border-white/25 transition-all"
              >
                {profileLinkCopied ? <Check className="w-4 h-4 text-arc-success" /> : <Copy className="w-4 h-4" />}
                {profileLinkCopied ? 'Copied!' : 'Share Link'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────────────────── */}
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 py-12 space-y-12">

          {/* ── Payout CTA — always shown for non-onboarded creators ─────────── */}
          {stripeStatus !== null && !stripeStatus.onboarded && (
            <div
              className="flex items-start gap-5 p-6 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.10) 0%, rgba(15,15,19,0.98) 60%)',
                border: '1px solid rgba(212,175,55,0.45)',
                boxShadow: '0 0 60px rgba(212,175,55,0.10)',
              }}
            >
              <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-xl text-white mb-1">Enable payouts to start earning</p>
                <p className="text-sm text-arc-secondary leading-relaxed">
                  Connect your bank via Stripe. You keep <strong className="text-gold font-medium">70%</strong> of every payment, deposited automatically each week.
                </p>
                {stripeError && <p className="text-xs text-amber-400 mt-2">{stripeError}</p>}
              </div>
              <button
                onClick={startStripeOnboarding}
                disabled={stripeLoading}
                className="btn-gold text-sm px-6 py-3 flex-shrink-0 flex items-center gap-2"
              >
                {stripeLoading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : <ExternalLink className="w-4 h-4" />}
                {stripeLoading ? 'Connecting…' : 'Enable Payouts'}
              </button>
            </div>
          )}

          {/* ── Payouts active ────────────────────────────────────────────────── */}
          {stripeStatus?.onboarded && !hasEarnings && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-arc-success/8 border border-arc-success/20">
              <CheckCircle className="w-4 h-4 text-arc-success flex-shrink-0" />
              <p className="text-xs text-arc-success flex-1">Payouts active — you receive 70% of every sale, deposited weekly.</p>
              <button onClick={openStripeDashboard} className="text-xs text-gold hover:underline flex items-center gap-1 flex-shrink-0">
                <ExternalLink className="w-3 h-3" /> Stripe Dashboard
              </button>
            </div>
          )}

          {/* ── Content issues ────────────────────────────────────────────────── */}
          {contentCounts !== null && contentCounts.issues > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-arc-error/8 border border-arc-error/20">
              <AlertCircle className="w-4 h-4 text-arc-error flex-shrink-0" />
              <p className="text-xs text-arc-error flex-1">
                {contentCounts.issues} drop{contentCounts.issues !== 1 ? 's' : ''} need{contentCounts.issues === 1 ? 's' : ''} your attention
              </p>
              <Link to="/creator/media" className="text-xs text-gold hover:underline flex-shrink-0">Review →</Link>
            </div>
          )}

          {/* ── Profile setup ─────────────────────────────────────────────────── */}
          {profileSetupNeeded && !trainingViewed && (
            <div className="card-surface p-6 rounded-xl border border-gold/20">
              <p className="section-eyebrow mb-2">Your Studio Awaits</p>
              <h2 className="font-serif text-xl text-white mb-2">Finish setting up your studio</h2>
              <p className="text-sm text-arc-secondary leading-relaxed mb-4">Complete your creator profile to unlock drops, collections, and your first audience.</p>
              <Link to="/creator/onboarding" className="btn-gold text-sm inline-flex items-center gap-2">
                <Crown className="w-4 h-4" /> Complete Profile Setup
              </Link>
            </div>
          )}

          {/* ── Checklist + next action ───────────────────────────────────────── */}
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

          {/* ── Magazine metric call-outs ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 xl:gap-6">
            {metrics.map(({ eyebrow, value, note, icon, accent }) => (
              <div
                key={eyebrow}
                className="relative overflow-hidden rounded-2xl p-6"
                style={{
                  background: 'rgba(20,20,25,0.8)',
                  border: `1px solid rgba(${accent === '#D4AF37' ? '212,175,55' : accent === '#10B981' ? '16,185,129' : accent === '#8B5CF6' ? '139,92,246' : '212,175,55'},0.18)`,
                }}
              >
                {/* Glow orb */}
                <div
                  aria-hidden="true"
                  className="absolute -top-4 -right-4 w-20 h-20 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)` }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: accent }}>{eyebrow}</p>
                    <span style={{ color: `${accent}80` }}>{icon}</span>
                  </div>
                  <p className="font-serif text-3xl xl:text-4xl text-white leading-none mb-2">{value}</p>
                  <p className="text-xs text-arc-muted">{note}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Empty state ───────────────────────────────────────────────────── */}
          {stats !== null && stats.content_count === 0 && (
            <div
              className="rounded-2xl p-10 sm:p-14 text-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(10,10,15,0.98) 70%)',
                border: '1px solid rgba(212,175,55,0.20)',
              }}
            >
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,175,55,0.10) 0%, transparent 70%)' }} />
              <div className="relative">
                <span className="font-serif text-4xl text-gold block mb-6">✦</span>
                <h2 className="font-serif text-3xl sm:text-4xl text-white mb-3">Your studio is ready.</h2>
                <p className="text-arc-secondary leading-relaxed max-w-sm mx-auto mb-8">Your first drop is one upload away from reaching your audience.</p>
                <Link to="/upload" className="btn-gold inline-flex items-center gap-2 px-10 py-4 text-base">
                  <Upload className="w-5 h-5" /> Upload Your First Drop
                </Link>
              </div>
            </div>
          )}

          {showContent && (
            <>
              {/* ── 2-column editorial layout ──────────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 xl:gap-10">

                {/* Left wide column: activity + transactions table */}
                <div className="lg:col-span-3 space-y-8">

                  {/* Activity */}
                  <section>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-px flex-1" style={{ background: 'rgba(212,175,55,0.15)' }} />
                      <h2 className="font-serif text-2xl text-white flex-shrink-0">Studio Activity</h2>
                      <div className="h-px flex-1" style={{ background: 'rgba(212,175,55,0.15)' }} />
                    </div>
                    {activityFeed.length > 0 ? (
                      <div className="space-y-0 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        {activityFeed.slice(0, 8).map((a, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-4 px-6 py-4 ${i % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-hover'} hover:bg-bg-hover transition-colors`}
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background: `${ACT_COLORS[a.type] ?? '#D4AF37'}18`, border: `1px solid ${ACT_COLORS[a.type] ?? '#D4AF37'}30` }}
                            >
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ACT_COLORS[a.type] ?? '#D4AF37' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white leading-snug">{a.text}</p>
                              <p className="text-xs text-arc-muted mt-0.5">{a.time}</p>
                            </div>
                            {a.amount && (
                              <span
                                className="text-sm font-serif flex-shrink-0 tabular-nums"
                                style={{ color: ACT_COLORS[a.type] ?? '#D4AF37' }}
                              >
                                {a.amount}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="card-surface p-8 rounded-2xl text-center">
                        <EmptyState
                          icon={<Sparkles className="w-6 h-6" />}
                          title="Your first drop starts the story."
                          description="Publish a locked drop and share your profile to start your activity feed."
                        />
                      </div>
                    )}
                  </section>

                  {/* Transactions — clean editorial table */}
                  {transactions.length > 0 && (
                    <section>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="h-px flex-1" style={{ background: 'rgba(212,175,55,0.15)' }} />
                        <h2 className="font-serif text-2xl text-white flex-shrink-0">Transactions</h2>
                        <div className="h-px flex-1" style={{ background: 'rgba(212,175,55,0.15)' }} />
                      </div>
                      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        {/* Table header */}
                        <div className="grid grid-cols-4 px-6 py-3 bg-bg-hover border-b border-white/5">
                          <p className="text-[10px] font-bold tracking-widest uppercase text-arc-muted">From</p>
                          <p className="text-[10px] font-bold tracking-widest uppercase text-arc-muted">Type</p>
                          <p className="text-[10px] font-bold tracking-widest uppercase text-arc-muted">Net</p>
                          <p className="text-[10px] font-bold tracking-widest uppercase text-arc-muted text-right">When</p>
                        </div>
                        {transactions.slice(0, 10).map((txn, i) => (
                          <div
                            key={txn.id}
                            className={`grid grid-cols-4 px-6 py-3.5 items-center ${i % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-hover'} hover:bg-bg-hover transition-colors`}
                          >
                            <p className="text-sm text-white truncate">{txn.payer_name}</p>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: txn.ref_type === 'subscription' ? '#10B981' : txn.ref_type === 'tip' ? '#8B5CF6' : '#D4AF37' }}
                              />
                              <p className="text-xs text-arc-secondary capitalize truncate">{txn.ref_type}</p>
                            </div>
                            <p className="font-serif text-sm text-gold tabular-nums">+{formatCurrency(Number(txn.net_amount))}</p>
                            <p className="text-xs text-arc-muted text-right">{timeAgo(txn.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Custom Requests */}
                  {requests.length > 0 && (
                    <section>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="h-px flex-1" style={{ background: 'rgba(212,175,55,0.15)' }} />
                        <h2 className="font-serif text-2xl text-white flex-shrink-0 flex items-center gap-3">
                          Custom Requests
                          {pendingRequests > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300">{pendingRequests}</span>
                          )}
                        </h2>
                        <div className="h-px flex-1" style={{ background: 'rgba(212,175,55,0.15)' }} />
                      </div>
                      <div className="space-y-3">
                        {requests.map(req => (
                          <div key={req.id} className="card-surface p-5 rounded-2xl">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <p className="text-sm text-white leading-relaxed flex-1">{req.description}</p>
                              <span className="font-serif text-gold text-xl flex-shrink-0">{formatCurrency(Number(req.offered_price))}</span>
                            </div>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                                  req.status === 'pending' ? 'text-amber-400 bg-amber-400/10 border-amber-400/25'
                                  : req.status === 'accepted' ? 'text-arc-success bg-arc-success/10 border-arc-success/25'
                                  : 'text-arc-error bg-arc-error/10 border-arc-error/25'
                                }`}>{req.status === 'pending' ? 'new' : req.status}</span>
                                <span className="text-xs text-arc-muted">{timeAgo(req.created_at)} · from {req.fan_name}</span>
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
                    </section>
                  )}
                </div>

                {/* Right narrow column: health + quick actions + first100 + coaching */}
                <div className="lg:col-span-2 space-y-6">

                  {/* Quick Actions — card */}
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid rgba(212,175,55,0.18)', background: 'rgba(20,20,25,0.8)' }}
                  >
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(212,175,55,0.10)' }}>
                      <p className="section-eyebrow text-[10px] tracking-[0.25em]">Your Studio</p>
                    </div>
                    <div className="p-3 space-y-1">
                      {[
                        { to: '/upload',           icon: <Upload className="w-4 h-4" />,        label: 'Create a Drop',  primary: true },
                        { to: '/creator/media',    icon: <LayoutGrid className="w-4 h-4" />,    label: 'Media Library',  primary: false },
                        { to: `/creator/${user?.username ?? ''}`, icon: <Eye className="w-4 h-4" />, label: 'View Profile', primary: false },
                        { to: '/messages',         icon: <MessageCircle className="w-4 h-4" />, label: 'Messages',       primary: false },
                      ].map(({ to, icon, label, primary }) => (
                        <Link
                          key={to + label}
                          to={to}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all group ${
                            primary
                              ? 'bg-gold/8 border border-gold/25 text-gold hover:bg-gold/14'
                              : 'text-arc-secondary hover:text-white hover:bg-bg-hover border border-transparent'
                          }`}
                        >
                          <span className={`flex-shrink-0 ${primary ? 'text-gold' : 'text-gold/55 group-hover:text-gold/85'}`}>{icon}</span>
                          <span className={`text-xs font-medium flex-1 ${primary ? 'text-gold' : 'text-white'}`}>{label}</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-25 group-hover:opacity-60 transition-opacity" />
                        </Link>
                      ))}
                      <button
                        onClick={copyProfileLink}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-arc-secondary hover:text-white hover:bg-bg-hover border border-transparent transition-all group"
                      >
                        <span className={`flex-shrink-0 ${profileLinkCopied ? 'text-arc-success' : 'text-gold/55 group-hover:text-gold/85'}`}>
                          {profileLinkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </span>
                        <p className={`text-xs font-medium flex-1 text-left ${profileLinkCopied ? 'text-arc-success' : 'text-white'}`}>
                          {profileLinkCopied ? 'Link copied!' : 'Share Profile'}
                        </p>
                      </button>
                    </div>

                    {/* Earnings summary inside card */}
                    <div className="px-5 py-4 space-y-2.5" style={{ borderTop: '1px solid rgba(212,175,55,0.10)' }}>
                      {[
                        { icon: <Lock className="w-3.5 h-3.5" />, label: 'Locked drops', value: stats ? stats.content_unlocks.toLocaleString() : '—', unit: 'unlocks' },
                        { icon: <Crown className="w-3.5 h-3.5" />, label: 'Subscriptions', value: stats ? stats.subscriber_count.toLocaleString() : '—', unit: 'active' },
                        { icon: <Star className="w-3.5 h-3.5" />, label: 'Tips', value: stats ? formatCurrency(stats.tips_total) : '—', unit: 'lifetime' },
                      ].map(({ icon, label, value, unit }) => (
                        <div key={label} className="flex items-center gap-2.5">
                          <span className="text-gold/50">{icon}</span>
                          <span className="text-xs text-arc-secondary flex-1">{label}</span>
                          <span className="text-xs font-medium text-white tabular-nums">{value}</span>
                          <span className="text-[10px] text-arc-muted">{unit}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                        <Zap className="w-3 h-3 text-gold/60" />
                        <p className="text-[11px] text-arc-secondary">70% to you · weekly · min $50</p>
                        {stripeStatus?.onboarded && (
                          <button onClick={openStripeDashboard} className="ml-auto text-[11px] text-gold hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Stripe
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Health Score */}
                  {health && (
                    <div
                      className="rounded-2xl p-5"
                      style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(20,20,25,0.8)' }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-serif text-base text-white">Studio Health</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          health.score >= 80 ? 'text-arc-success bg-arc-success/10 border-arc-success/25'
                          : health.score >= 60 ? 'text-gold bg-gold/10 border-gold/25'
                          : 'text-amber-400 bg-amber-400/10 border-amber-400/25'
                        }`}>{health.level}</span>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-serif text-4xl text-white">{health.score}</span>
                        <div className="flex-1">
                          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${health.score}%`, background: health.score >= 80 ? '#10B981' : health.score >= 60 ? '#D4AF37' : '#F59E0B' }}
                            />
                          </div>
                          <p className="text-[10px] text-arc-muted mt-1">/100</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {health.signals.map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className={`text-[11px] ${s.ok ? 'text-arc-success' : 'text-arc-muted'}`}>{s.ok ? '✓' : '○'}</span>
                            <p className="text-[11px] text-arc-secondary">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coaching cards */}
                  {coachingCards.length > 0 && (
                    <div
                      className="rounded-2xl p-5"
                      style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(20,20,25,0.8)' }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="w-4 h-4 text-gold/70" />
                        <h3 className="font-serif text-base text-white">Studio Coaching</h3>
                      </div>
                      <div className="space-y-3">
                        {coachingCards.map(card => <CoachingCard key={card.type} insight={card} />)}
                      </div>
                    </div>
                  )}

                  {/* AI advisor */}
                  {isVerifiedCreator && (aiLoading || aiSuggestions.length > 0) && (
                    <div
                      className="rounded-2xl p-5"
                      style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(20,20,25,0.8)' }}
                    >
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

                  {/* First $100 tracker */}
                  {stats !== null && stats.total_earnings < 100 && (
                    <First100Tracker currentEarnings={stats.total_earnings} />
                  )}

                  {/* Creator Training */}
                  {!isActive && (
                    <Link
                      to="/creator/onboarding"
                      className="block rounded-2xl overflow-hidden group"
                      style={{
                        background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(10,10,15,0.97) 65%)',
                        border: '1px solid rgba(212,175,55,0.30)',
                      }}
                    >
                      <div className="p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gold/12 border border-gold/30 flex items-center justify-center flex-shrink-0">
                          <Crown className="w-5 h-5 text-gold" />
                        </div>
                        <div className="flex-1">
                          <p className="font-serif text-base text-white">Creator Training</p>
                          <p className="text-xs text-arc-secondary mt-0.5">5-minute guide to your first earnings</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gold/50 group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  )}
                </div>
              </div>

              {/* ── Promote section ───────────────────────────────────────────── */}
              <section className="pt-4">
                <div className="flex items-center gap-6 mb-8">
                  <div className="h-px flex-1" style={{ background: 'rgba(212,175,55,0.15)' }} />
                  <h2 className="font-serif text-3xl text-white flex-shrink-0">Promote</h2>
                  <div className="h-px flex-1" style={{ background: 'rgba(212,175,55,0.15)' }} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Share Links */}
                  <div className="card-surface p-6 rounded-2xl space-y-5">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-gold" />
                      <h3 className="font-serif text-lg text-white">Share Links</h3>
                    </div>
                    {[
                      { key: 'link-profile', label: 'Creator Profile', url: profileUrl },
                      { key: 'link-sub', label: 'Subscribe Page', url: subscribeUrl },
                    ].map(({ key, label, url }) => (
                      <div key={key}>
                        <p className="text-xs text-arc-muted mb-1.5">{label}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-bg-hover border border-white/8 text-xs text-arc-secondary truncate">{url}</div>
                          <ActionButton
                            onAction={() => navigator.clipboard.writeText(url)}
                            label={<Copy className="w-4 h-4" />} successLabel="Copied"
                            className="flex-shrink-0 p-2 rounded-lg bg-bg-hover border border-white/8 text-arc-secondary hover:text-gold hover:border-gold/30 transition-all"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-5 pt-2 border-t border-white/5">
                      <img src={qrUrl} alt="Profile QR" className="w-[72px] h-[72px] rounded-lg border border-gold/20 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-white mb-2">QR Code</p>
                        <a href={qrUrl} download="archangels-qr.png" className="text-xs text-gold hover:underline flex items-center gap-1">
                          <Share2 className="w-3 h-3" /> Download
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Reach stats */}
                  <div className="card-surface p-6 rounded-2xl">
                    <div className="flex items-center gap-2 mb-5">
                      <BarChart2 className="w-4 h-4 text-gold" />
                      <h3 className="font-serif text-lg text-white">Your Reach</h3>
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
                    <div className="flex items-center justify-between text-sm pt-3 border-t border-white/5">
                      <p className="text-arc-muted text-xs">Conversion Rate</p>
                      <p className="font-serif text-gold">{promoStats ? `${promoStats.conversion_rate}%` : '—'}</p>
                    </div>
                    {promoStats && Object.keys(promoStats.by_source).length > 0 && (
                      <div className="space-y-1.5 mt-3">
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
                </div>

                {/* Captions */}
                <div className="card-surface p-6 rounded-2xl mb-6">
                  <h3 className="font-serif text-lg text-white mb-4">Captions</h3>
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
                            className="flex-shrink-0 p-2 rounded-lg text-arc-muted hover:text-gold hover:bg-gold/8"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invite Links */}
                <div className="card-surface p-6 rounded-2xl">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-serif text-lg text-white">Invite Links</h3>
                      <p className="text-xs text-arc-muted mt-0.5">Up to 10 links.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text" value={newInviteLabel}
                        onChange={e => setNewInviteLabel(e.target.value)}
                        placeholder="Label (e.g. Instagram)"
                        className="input-dark text-xs py-1.5 px-3 w-36" maxLength={60}
                        onKeyDown={e => { if (e.key === 'Enter') createInviteLink(); }}
                      />
                      <button
                        onClick={createInviteLink}
                        disabled={creatingInvite || inviteLinks.length >= 10}
                        className="btn-gold text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {creatingInvite ? 'Creating…' : 'New Link'}
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
                                className="p-1.5 rounded-lg text-arc-muted hover:text-gold hover:bg-gold/8"
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
              </section>
            </>
          )}

        </div>
      </div>
    </>
  );
}
