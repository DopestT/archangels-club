import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Upload, DollarSign, Users, TrendingUp, MessageCircle, Clock, ChevronRight,
  Star, CheckCircle, XCircle, Crown, ExternalLink, Zap, Copy, Check,
  LayoutGrid, AlertCircle, Eye, Sparkles, LayoutDashboard, Link2, Trash2,
  Plus, Share2, BarChart2, Lock, ArrowRight, UserCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/ui/StatCard';
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const ACT_COLORS: Record<string, string> = {
  unlock:  '#D4AF37',
  sub:     '#10B981',
  tip:     '#D4AF37',
  request: '#8B5CF6',
};

export default function CreatorDashboard() {
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
    stats,
    transactions,
    requests,
    stripeStatus?.onboarded ?? false,
    user?.avatar_url,
    contentCounts?.published ?? null,
  );

  useEffect(() => {
    if (!token) { setStatusLoading(false); return; }
    refreshUser().finally(() => setStatusLoading(false));
    fetch(`${API_BASE}/api/stripe/connect/status`, { headers: authHeaders })
      .then((r) => r.json())
      .then(setStripeStatus)
      .catch(() => { setStripeStatus({ has_account: false, onboarded: false, account_id: null }); });
    fetch(`${API_BASE}/api/creators/my/stats`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setProfileSetupNeeded(true);
        } else {
          setStats(d);
        }
      })
      .catch(() => {});
    fetch(`${API_BASE}/api/creators/my/transactions`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setTransactions(d); })
      .catch(() => {});
    fetch(`${API_BASE}/api/creators/my/requests`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setRequests(d); })
      .catch(() => {});
    fetch(`${API_BASE}/api/promo/my/stats`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setPromoStats(d); })
      .catch(() => {});
    fetch(`${API_BASE}/api/promo/my/invites`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setInviteLinks(d); })
      .catch(() => {});
    fetch(`${API_BASE}/api/creators/my/content`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setContentCounts({
            published: d.filter((c: any) => c.status === 'approved').length,
            pending:   d.filter((c: any) => c.status === 'pending_review').length,
            issues:    d.filter((c: any) => ['rejected', 'changes_requested', 'failed_processing'].includes(c.status)).length,
          });
        }
      })
      .catch(() => {});
    fetch(`${API_BASE}/api/creators/my/onboarding`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => { if (d?.steps?.training_viewed) setTrainingViewed(true); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (searchParams.get('stripe') !== 'return' || !token) return;
    setSearchParams({}, { replace: true });
    fetch(`${API_BASE}/api/stripe/connect/verify`, { method: 'POST', headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setStripeStatus((prev) => prev ? { ...prev, onboarded: data.onboarded } : null))
      .catch(() => {});
  }, [searchParams, token]);

  useEffect(() => {
    if (!token || !isVerifiedCreator) return;
    fetch(`${API_BASE}/api/creators/my/health`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d.score !== undefined) setHealth(d); })
      .catch(() => {});
    fetch(`${API_BASE}/api/intelligence/my-insights`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.insights)) setCoachingCards(d.insights); })
      .catch(() => {});
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
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        setStripeError('Session expired. Please refresh the page and try again.');
        setStripeLoading(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setStripeError(data.error ?? 'Payout setup unavailable. Please try again shortly.');
        setStripeLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setStripeError('Payout setup unavailable. Please try again shortly.');
        setStripeLoading(false);
      }
    } catch (err) {
      console.error('[stripe/connect/start] fetch error:', err);
      setStripeError('Unable to reach the server. Please try again.');
      setStripeLoading(false);
    }
  }

  async function createInviteLink() {
    if (!token) return;
    setCreatingInvite(true);
    try {
      const res = await fetch(`${API_BASE}/api/promo/my/invites`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newInviteLabel.trim() || 'Invite Link' }),
      });
      const data = await res.json();
      if (!data.error) {
        setInviteLinks((prev) => [data, ...prev]);
        setNewInviteLabel('');
      }
    } finally {
      setCreatingInvite(false);
    }
  }

  async function deleteInviteLink(id: string) {
    if (!token) return;
    await fetch(`${API_BASE}/api/promo/my/invites/${id}`, { method: 'DELETE', headers: authHeaders });
    setInviteLinks((prev) => prev.filter((l) => l.id !== id));
  }

  async function openStripeDashboard() {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/stripe/connect/dashboard-link`, {
      method: 'POST',
      headers: authHeaders,
    });
    if (res.status === 401) { console.warn('[creator] dashboard link 401 — session may be stale'); return; }
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
  }

  async function handleCustomRequest(id: string, status: 'accepted' | 'rejected') {
    try {
      const res = await fetch(`${API_BASE}/api/messages/custom-request/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    } catch {}
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending').length;

  const hasEarnings = (stats?.total_earnings ?? 0) > 0;
  const hasContent  = (contentCounts?.published ?? 0) > 0;
  const isActive    = isVerifiedCreator && (hasEarnings || hasContent || (stats?.subscriber_count ?? 0) > 0);

  type CreatorState = 'new' | 'first_unlock' | 'active' | 'rising' | 'established';
  const creatorState: CreatorState = (() => {
    if (!isVerifiedCreator || (!hasContent && !hasEarnings && (stats?.subscriber_count ?? 0) === 0)) return 'new';
    if (!hasEarnings) return 'first_unlock';
    const earnings = stats?.total_earnings ?? 0;
    const subs = stats?.subscriber_count ?? 0;
    if (earnings >= 500 || subs >= 50) return 'established';
    if (earnings >= 100 || subs >= 10) return 'rising';
    return 'active';
  })();

  const HERO_SUBTITLE: Record<CreatorState, string> = {
    new:          'Your studio awaits.',
    first_unlock: 'Your first drop is live.',
    active:       'Building momentum.',
    rising:       'Your audience is growing.',
    established:  'Your studio is performing.',
  };

  const HERO_DESCRIPTION: Record<CreatorState, string> = {
    new:          "Upload your first drop to activate your studio.",
    first_unlock: "Your first drop is live. Keep uploading to build momentum.",
    active:       "Every drop you publish builds compounding revenue. Keep going.",
    rising:       "Subscribers unlock your earning ceiling. Upload drops that reward loyalty.",
    established:  "Upload drops, grow your audience, and collect earnings — this is your command center.",
  };

  type ActivityType = 'unlock' | 'sub' | 'tip' | 'request';
  type ActivityItem = { type: ActivityType; text: string; time: string; amount: string };

  const activityFeed: ActivityItem[] = [
    ...transactions.slice(0, 6).map((txn): ActivityItem => ({
      type: txn.ref_type === 'subscription' ? 'sub'
          : txn.ref_type === 'tip' ? 'tip'
          : 'unlock',
      text: txn.ref_type === 'subscription'
        ? `${txn.payer_name} joined your audience`
        : txn.ref_type === 'tip'
        ? `${txn.payer_name} sent a tip`
        : `${txn.payer_name} unlocked ${txn.content_title ?? 'your content'}`,
      time: timeAgo(txn.created_at),
      amount: `+${formatCurrency(Number(txn.net_amount))}`,
    })),
    ...requests
      .filter((r) => r.status === 'pending')
      .slice(0, 2)
      .map((req): ActivityItem => ({
        type: 'request',
        text: `Custom request from ${req.fan_name}${req.description ? `: "${req.description.slice(0, 50)}${req.description.length > 50 ? '…' : ''}"` : ''}`,
        time: timeAgo(req.created_at),
        amount: formatCurrency(Number(req.offered_price)),
      })),
  ];

  return (
    <>
      {user && (
        <CreatorWelcomeReveal
          userId={user.id}
          firstName={firstName}
          isVerifiedCreator={isVerifiedCreator}
        />
      )}
    <div className="min-h-screen bg-bg-primary py-10 xl:py-14">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">

        {/* ── Cinematic Hero ───────────────────────────────────────────────────── */}
        <div
          className="relative mb-12 rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(212,175,55,0.07) 0%, rgba(10,10,15,0.98) 65%)',
            border: '1px solid rgba(212,175,55,0.14)',
          }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 55% 80% at 15% 50%, rgba(212,175,55,0.09) 0%, transparent 70%)',
            }}
          />
          <div className="relative px-8 py-10 sm:px-12 sm:py-14 xl:px-16">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-7 mb-8">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={firstName}
                    className="w-20 h-20 xl:w-24 xl:h-24 rounded-full object-cover"
                    style={{ border: '2px solid rgba(212,175,55,0.35)', boxShadow: '0 0 36px rgba(212,175,55,0.18)' }}
                  />
                ) : (
                  <div
                    className="w-20 h-20 xl:w-24 xl:h-24 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(212,175,55,0.08)', border: '2px solid rgba(212,175,55,0.25)', boxShadow: '0 0 36px rgba(212,175,55,0.12)' }}
                  >
                    <span className="font-serif text-3xl xl:text-4xl text-gold">{firstName[0]?.toUpperCase() ?? '?'}</span>
                  </div>
                )}
                {!statusLoading && isVerifiedCreator && (
                  <div
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gold flex items-center justify-center"
                    style={{ border: '2px solid #0A0A0F' }}
                    title="Approved Creator"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-bg-primary" />
                  </div>
                )}
              </div>

              {/* Greeting */}
              <div className="flex-1 min-w-0">
                <p className="section-eyebrow mb-3">
                  {!statusLoading && isVerifiedCreator ? 'Approved Creator' : 'Creator Studio'}
                </p>
                <h1 className="font-serif text-4xl sm:text-5xl xl:text-6xl text-white leading-none mb-2">
                  Welcome, <em className="not-italic text-gold">{firstName}.</em>
                </h1>
                <p
                  className="font-serif text-lg xl:text-xl italic leading-snug"
                  style={{ color: 'rgba(212,175,55,0.72)' }}
                >
                  {HERO_SUBTITLE[creatorState]}
                </p>
              </div>
            </div>

            {!statusLoading && (
              <p className="text-sm text-arc-secondary leading-relaxed max-w-lg mb-8">
                {!isVerifiedCreator
                  ? "Set up your profile and prepare your first drop. You'll be notified as soon as your studio is ready."
                  : HERO_DESCRIPTION[creatorState]}
              </p>
            )}

            <div
              className="flex flex-wrap items-center gap-3 pt-6"
              style={{ borderTop: '1px solid rgba(212,175,55,0.1)' }}
            >
              <Link to="/upload" className="btn-gold flex items-center gap-2 px-6 py-3">
                <Upload className="w-4 h-4" />
                Create a Drop
              </Link>
              <Link
                to={`/creator/${user?.username ?? ''}`}
                className="text-xs px-4 py-2.5 rounded-xl border border-white/12 text-arc-secondary hover:text-white hover:border-white/25 transition-all flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                View Profile
              </Link>
              <button
                onClick={copyProfileLink}
                className="text-xs px-4 py-2.5 rounded-xl border border-white/12 text-arc-secondary hover:text-white hover:border-white/25 transition-all flex items-center gap-1.5"
              >
                {profileLinkCopied
                  ? <Check className="w-3.5 h-3.5 text-arc-success" />
                  : <Copy className="w-3.5 h-3.5" />}
                {profileLinkCopied ? 'Copied!' : 'Share'}
              </button>
              {user?.username && (
                <span className="hidden xl:flex items-center gap-1.5 text-xs text-arc-muted ml-auto">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: isVerifiedCreator ? '#10B981' : 'rgba(255,255,255,0.2)', boxShadow: isVerifiedCreator ? '0 0 6px rgba(16,185,129,0.5)' : 'none' }}
                  />
                  {isVerifiedCreator ? 'Studio live · archangelsclub.com/creator/' + user.username : '@' + user.username}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Profile setup card ───────────────────────────────────────────────── */}
        {profileSetupNeeded && !trainingViewed && (
          <div className="card-surface p-6 rounded-xl mb-6 border border-gold/20">
            <p className="section-eyebrow mb-2">Your Studio Awaits</p>
            <h2 className="font-serif text-xl text-white mb-2">Finish setting up your studio</h2>
            <p className="text-sm text-arc-secondary leading-relaxed mb-4">
              Complete your creator profile to unlock drops, collections, and your first audience.
            </p>
            <Link to="/creator/onboarding" className="btn-gold text-sm inline-flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Complete Profile Setup
            </Link>
          </div>
        )}

        {/* ── Enable payouts CTA ───────────────────────────────────────────────── */}
        {stripeStatus !== null && !stripeStatus.onboarded && (creatorState === 'new' || creatorState === 'first_unlock') && (
          <div className="flex items-start gap-4 p-5 rounded-xl bg-bg-surface border border-gold/30 mb-5">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white mb-0.5">Enable payouts to start earning</p>
              <p className="text-xs text-arc-secondary leading-relaxed">
                Connect your bank via Stripe. Creators receive 70% of every payment — processed automatically.
              </p>
              {stripeError && (
                <p className="text-xs text-amber-400 mt-2">{stripeError}</p>
              )}
            </div>
            <button
              onClick={startStripeOnboarding}
              disabled={stripeLoading}
              className="btn-gold text-xs px-4 py-2 flex-shrink-0 flex items-center gap-1.5"
            >
              {stripeLoading ? (
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              {stripeLoading ? 'Connecting…' : 'Enable Payouts'}
            </button>
          </div>
        )}

        {/* ── Payouts active confirmation — only shown before first sale ────────── */}
        {stripeStatus?.onboarded && !hasEarnings && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-arc-success/8 border border-arc-success/25 mb-5">
            <CheckCircle className="w-4 h-4 text-arc-success flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-arc-success">Payouts active</p>
              <p className="text-xs text-arc-muted mt-0.5">Creators receive 70% of every sale — deposited automatically each week.</p>
            </div>
            <button onClick={openStripeDashboard} className="text-xs text-gold hover:underline flex items-center gap-1 flex-shrink-0">
              <ExternalLink className="w-3 h-3" />
              Stripe Dashboard
            </button>
          </div>
        )}

        {/* ── Content issues alert ─────────────────────────────────────────────── */}
        {contentCounts !== null && contentCounts.issues > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-arc-error/8 border border-arc-error/20 mb-5">
            <AlertCircle className="w-4 h-4 text-arc-error flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-arc-error">
                {contentCounts.issues} drop{contentCounts.issues !== 1 ? 's' : ''} need{contentCounts.issues === 1 ? 's' : ''} your attention
              </p>
              <p className="text-xs text-arc-muted mt-0.5">Review the feedback and resubmit from your media library.</p>
            </div>
            <Link to="/creator/media" className="text-xs text-gold hover:underline flex items-center gap-1 flex-shrink-0">
              Review <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* ── Launch checklist — new + early creators ──────────────────────────── */}
        {user && (progress.level === 'new' || progress.level === 'early') && (
          <CreatorOnboardingChecklist
            items={progress.checklistItems}
            completePct={progress.checklistCompletePct}
            allComplete={progress.checklistAllComplete}
            userId={user.id}
            onStripeSetup={startStripeOnboarding}
          />
        )}

        {/* ── Contextual next-action card ─────────────────────────────────────── */}
        {progress.nextAction && (
          <CreatorNextAction action={progress.nextAction} />
        )}

        {/* ── Empty state — no content yet ─────────────────────────────────────── */}
        {stats !== null && stats.content_count === 0 && (
          <div className="mb-10">
            <div
              className="rounded-2xl p-8 sm:p-10 text-center border border-gold/20 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(5,5,5,0.98) 60%)' }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,175,55,0.08) 0%, transparent 70%)' }} />
              <div className="relative">
                <span className="font-serif text-2xl text-gold leading-none block mb-4">✦</span>
                <h2 className="font-serif text-2xl sm:text-3xl text-white mb-2">Your studio is ready.</h2>
                <p className="text-arc-secondary text-sm leading-relaxed max-w-sm mx-auto mb-6">
                  Your first drop is one upload away.
                </p>
                <Link to="/upload" className="btn-gold inline-flex items-center gap-2 px-8 py-3 text-sm font-semibold">
                  <Upload className="w-4 h-4" />
                  Upload Your First Drop
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Key operational metrics ──────────────────────────────────────────── */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5 mb-10 ${stats !== null && stats.content_count === 0 ? 'hidden' : ''}`}>
          <StatCard label="Earnings"  value={stats ? formatCurrency(stats.total_earnings)    : '—'} sub="lifetime net"       icon={<DollarSign    className="w-5 h-5" />} />
          <StatCard label="Audience"  value={stats ? stats.subscriber_count.toLocaleString() : '—'} sub="active subscribers" icon={<Users         className="w-5 h-5" />} />
          <StatCard label="Unlocks"   value={stats ? stats.content_unlocks.toLocaleString()  : '—'} sub="total unlocks"      icon={<TrendingUp    className="w-5 h-5" />} />
          <StatCard label="Requests"  value={String(pendingRequests)}                               sub={pendingRequests > 0 ? 'awaiting reply' : 'custom requests'} icon={<MessageCircle className="w-5 h-5" />} />
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────────── */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-10 xl:gap-12 ${stats !== null && stats.content_count === 0 ? 'hidden' : ''}`}>

          {/* Left col */}
          <div className="lg:col-span-2 xl:col-span-3 space-y-8">

            {/* Studio Activity */}
            <div className="card-surface rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <h2 className="font-serif text-lg text-white">Studio Activity</h2>
                {activityFeed.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-arc-success flex-shrink-0"
                      style={{ animation: 'pulseSignalDot 2.2s ease-in-out infinite' }}
                    />
                    <span className="text-[9px] font-bold tracking-[0.16em] uppercase text-arc-success/70">Live</span>
                  </span>
                )}
              </div>
              {activityFeed.length > 0 ? (
                <div>
                  {activityFeed.slice(0, 7).map((a, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-6 py-3.5 ${i < Math.min(activityFeed.length, 7) - 1 ? 'border-b border-white/4' : ''}`}
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-[7px] flex-shrink-0"
                        style={{ backgroundColor: ACT_COLORS[a.type] ?? '#D4AF37' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white leading-snug">{a.text}</p>
                        <p className="text-xs text-arc-muted mt-0.5">{a.time}</p>
                      </div>
                      {a.amount && (
                        <span
                          className="text-xs font-medium flex-shrink-0 tabular-nums"
                          style={{ color: ACT_COLORS[a.type] ?? '#D4AF37' }}
                        >
                          {a.amount}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-8">
                  <EmptyState
                    icon={<Sparkles className="w-6 h-6" />}
                    title="Your first drop starts the story."
                    description="Publish a locked drop, share your profile, and give members something worth unlocking."
                  />
                </div>
              )}
            </div>

            {/* Revenue Pulse */}
            <div className="card-surface p-6 rounded-xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-serif text-lg text-white">Revenue</h2>
                {stripeStatus?.onboarded && (
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-arc-success">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-arc-success flex-shrink-0"
                      style={{ boxShadow: '0 0 5px rgba(16,185,129,0.55)' }}
                    />
                    Payouts active
                  </span>
                )}
              </div>

              {transactions.length > 0 ? (
                <>
                  <div className="flex items-end gap-1 h-12 mb-4">
                    {(() => {
                      const recent = transactions.slice(0, 8);
                      const maxAmt = Math.max(...recent.map(t => Number(t.net_amount)), 1);
                      return (
                        <>
                          {recent.map((t, i) => {
                            const pct = Math.max(12, (Number(t.net_amount) / maxAmt) * 100);
                            const barColor = t.ref_type === 'subscription' ? '#10B981' : t.ref_type === 'tip' ? '#8B5CF6' : '#D4AF37';
                            return (
                              <div
                                key={t.id}
                                style={{ height: `${pct}%`, background: barColor, opacity: 0.4 + (i / recent.length) * 0.6, flex: 1 }}
                                className="rounded-sm min-w-0"
                              />
                            );
                          })}
                          {recent.length < 8 && Array.from({ length: 8 - recent.length }).map((_, i) => (
                            <div key={`ph-${i}`} style={{ height: '12%', flex: 1 }} className="rounded-sm bg-white/6 min-w-0" />
                          ))}
                        </>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                    {[
                      { label: 'Lifetime',    value: formatCurrency(stats?.total_earnings ?? 0) },
                      { label: 'Subscribers', value: (stats?.subscriber_count ?? 0).toLocaleString() },
                      { label: 'Tips',        value: formatCurrency(stats?.tips_total ?? 0) },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <p className="font-serif text-base text-gold leading-tight">{value}</p>
                        <p className="text-[10px] text-arc-muted mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-6 flex flex-col items-center gap-2.5 text-center">
                  <div className="flex items-end gap-1 h-8 opacity-15 w-full max-w-[120px]">
                    {[30, 50, 35, 65, 40, 55, 45, 70].map((h, i) => (
                      <div key={i} style={{ height: `${h}%`, flex: 1 }} className="rounded-sm bg-gold min-w-0" />
                    ))}
                  </div>
                  <p className="text-xs text-arc-secondary">Revenue builds with every sale.</p>
                  <p className="text-[11px] text-arc-muted">Your first unlock activates this view.</p>
                </div>
              )}
            </div>

            {/* Custom requests */}
            {requests.length > 0 && (
              <div className="card-surface p-6 rounded-xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-serif text-lg text-white">Custom Requests</h2>
                  {pendingRequests > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300">
                      {pendingRequests} new
                    </span>
                  )}
                </div>
                <div className="space-y-4">
                  {requests.map((req) => (
                    <div key={req.id} className="p-4 rounded-xl bg-bg-hover border border-white/5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <p className="text-sm text-white leading-relaxed flex-1">{req.description}</p>
                        <span className="font-serif text-gold text-lg flex-shrink-0">
                          {formatCurrency(Number(req.offered_price))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                            req.status === 'pending'
                              ? 'text-amber-400 bg-amber-400/10 border-amber-400/25'
                              : req.status === 'accepted'
                              ? 'text-arc-success bg-arc-success/10 border-arc-success/25'
                              : 'text-arc-error bg-arc-error/10 border-arc-error/25'
                          }`}>
                            {req.status === 'pending' ? 'new' : req.status}
                          </span>
                          <span className="text-xs text-arc-muted">{timeAgo(req.created_at)}</span>
                          <span className="text-xs text-arc-muted">from {req.fan_name}</span>
                        </div>
                        {req.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <ActionButton
                              onAction={async () => {
                                const res = await fetch(`${API_BASE}/api/messages/custom-request/${req.id}`, {
                                  method: 'PATCH',
                                  headers: { ...authHeaders, 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'accepted' }),
                                });
                                if (!res.ok) throw new Error();
                              }}
                              onSuccess={() => setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'accepted' } : r))}
                              label={<CheckCircle className="w-4 h-4" />}
                              loadingLabel="…"
                              successLabel="✓"
                              className="p-1.5 rounded-lg bg-arc-success/10 text-arc-success hover:bg-arc-success/20 transition-colors"
                            />
                            <ActionButton
                              onAction={async () => {
                                const res = await fetch(`${API_BASE}/api/messages/custom-request/${req.id}`, {
                                  method: 'PATCH',
                                  headers: { ...authHeaders, 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'rejected' }),
                                });
                                if (!res.ok) throw new Error();
                              }}
                              onSuccess={() => setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r))}
                              label={<XCircle className="w-4 h-4" />}
                              loadingLabel="…"
                              successLabel="✓"
                              className="p-1.5 rounded-lg bg-arc-error/10 text-arc-error hover:bg-arc-error/20 transition-colors"
                            />
                          </div>
                        )}
                        {req.status === 'accepted' && (
                          <ActionButton
                            onAction={async () => {
                              const res = await fetch(`${API_BASE}/api/messages/custom-request/${req.id}`, {
                                method: 'PATCH',
                                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'completed' }),
                              });
                              if (!res.ok) throw new Error();
                            }}
                            onSuccess={() => setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'completed' } : r))}
                            label={<span className="text-xs">Mark Complete</span>}
                            loadingLabel="…"
                            successLabel="Done"
                            className="px-2.5 py-1 rounded-lg bg-arc-success/10 text-arc-success text-xs hover:bg-arc-success/20 transition-colors border border-arc-success/20"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right sidebar */}
          <div className="space-y-5">

            {/* Creator Health Score */}
            {health && (
              <div className="card-surface p-5 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-base text-white">Studio Health</h3>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                    health.score >= 80 ? 'text-arc-success bg-arc-success/10 border-arc-success/25'
                    : health.score >= 60 ? 'text-gold bg-gold/10 border-gold/25'
                    : health.score >= 40 ? 'text-amber-400 bg-amber-400/10 border-amber-400/25'
                    : 'text-arc-secondary bg-white/5 border-white/10'
                  }`}>{health.level}</span>
                </div>
                <div className="flex items-end gap-3 mb-4">
                  <span className="font-serif text-4xl text-white">{health.score}</span>
                  <span className="text-xs text-arc-muted mb-1">/100</span>
                  <div className="flex-1 ml-1 mb-1">
                    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${health.score}%`,
                          background: health.score >= 80 ? '#10B981' : health.score >= 60 ? '#D4AF37' : health.score >= 40 ? '#F59E0B' : '#6B7280',
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {health.signals.map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`text-[11px] mt-0.5 flex-shrink-0 ${s.ok ? 'text-arc-success' : 'text-arc-muted'}`}>
                        {s.ok ? '✓' : '○'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-arc-secondary">{s.label}</p>
                        <p className="text-[11px] text-arc-muted leading-snug">{s.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Studio Coaching — rules-based insights */}
            {coachingCards.length > 0 && (
              <div className="card-surface p-5 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-gold/70" />
                  <h3 className="font-serif text-base text-white">Studio Coaching</h3>
                </div>
                <div className="space-y-3">
                  {coachingCards.map(card => (
                    <CoachingCard key={card.type} insight={card} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="card-surface rounded-xl overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <p className="text-[10px] font-medium tracking-widest uppercase text-arc-muted mb-3">Your Studio</p>
                <div className="space-y-1.5">
                  {[
                    {
                      to: '/upload',
                      icon: <Upload className="w-4 h-4" />,
                      label: 'Create a Drop',
                      sub: '',
                      primary: true,
                    },
                    {
                      to: '/creator/media',
                      icon: <LayoutGrid className="w-4 h-4" />,
                      label: 'Media Library',
                      sub: contentCounts
                        ? `${contentCounts.published} live${contentCounts.pending > 0 ? ` · ${contentCounts.pending} in review` : ''}`
                        : '',
                    },
                    {
                      to: `/creator/${user?.username ?? ''}`,
                      icon: <Eye className="w-4 h-4" />,
                      label: 'View Profile',
                      sub: '',
                    },
                    {
                      to: '/messages',
                      icon: <MessageCircle className="w-4 h-4" />,
                      label: 'Messages',
                      sub: pendingRequests > 0
                        ? `${pendingRequests} request${pendingRequests !== 1 ? 's' : ''} waiting`
                        : '',
                    },
                  ].map(({ to, icon, label, sub, primary }) => (
                    <Link
                      key={to + label}
                      to={to}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
                        primary
                          ? 'bg-gold/8 border border-gold/25 text-gold hover:bg-gold/14 hover:border-gold/40'
                          : 'text-arc-secondary hover:text-white hover:bg-bg-hover border border-transparent'
                      }`}
                    >
                      <span className={`flex-shrink-0 ${primary ? 'text-gold' : 'text-gold/60 group-hover:text-gold/90'}`}>
                        {icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium leading-tight ${primary ? 'text-gold' : 'text-white'}`}>{label}</p>
                        {sub && <p className="text-[11px] text-arc-muted truncate mt-0.5">{sub}</p>}
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-30 group-hover:opacity-60 flex-shrink-0 transition-opacity" />
                    </Link>
                  ))}

                  {/* Share profile */}
                  <button
                    onClick={copyProfileLink}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-arc-secondary hover:text-white hover:bg-bg-hover border border-transparent transition-all group"
                  >
                    <span className={`flex-shrink-0 ${profileLinkCopied ? 'text-arc-success' : 'text-gold/60 group-hover:text-gold/90'}`}>
                      {profileLinkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-xs font-medium leading-tight ${profileLinkCopied ? 'text-arc-success' : 'text-white'}`}>
                        {profileLinkCopied ? 'Link copied!' : 'Share Profile'}
                      </p>
                    </div>
                    {!profileLinkCopied && (
                      <ChevronRight className="w-3.5 h-3.5 opacity-30 group-hover:opacity-60 flex-shrink-0 transition-opacity" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Revenue streams + payout */}
            <div className="card-surface p-5 rounded-xl">
              <h3 className="font-serif text-base text-white mb-3">Revenue Streams</h3>
              <div className="space-y-2 mb-5">
                {[
                  { icon: <Lock className="w-3.5 h-3.5" />, label: 'Locked drops', value: stats ? stats.content_unlocks.toLocaleString() : '—', unit: 'unlocks' },
                  { icon: <Crown className="w-3.5 h-3.5" />, label: 'Subscriptions', value: stats ? stats.subscriber_count.toLocaleString() : '—', unit: 'active' },
                  { icon: <Star className="w-3.5 h-3.5" />, label: 'Tips', value: stats ? formatCurrency(stats.tips_total) : '—', unit: 'lifetime' },
                ].map(({ icon, label, value, unit }) => (
                  <div key={label} className="flex items-center gap-2.5 py-1.5">
                    <span className="text-gold/60 flex-shrink-0">{icon}</span>
                    <span className="text-xs text-arc-secondary flex-1">{label}</span>
                    <span className="text-xs font-medium text-white tabular-nums">{value}</span>
                    <span className="text-[10px] text-arc-muted">{unit}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap className="w-3 h-3 text-gold/70" />
                  <p className="text-[11px] font-medium text-arc-secondary">70% to you · weekly · min $50</p>
                </div>
              </div>
            </div>

            {/* First $100 tracker */}
            {stats !== null && stats.total_earnings < 100 && (
              <First100Tracker currentEarnings={stats.total_earnings} />
            )}

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
                    {[80, 65, 90, 55, 75].map(w => (
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
                        Bundles: 'text-amber-300 bg-amber-300/10 border-amber-300/25',
                        'Custom Requests': 'text-violet-300 bg-violet-500/10 border-violet-500/25',
                      };
                      return (
                        <div key={i} className="flex flex-col gap-1.5">
                          <span className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full border ${catColor[s.category] ?? catColor.Profile}`}>
                            {s.category}
                          </span>
                          <p className="text-xs text-arc-secondary leading-relaxed">{s.text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Creator Training — for new creators only */}
            {!isActive && (
              <Link
                to="/creator/onboarding"
                className="block rounded-xl overflow-hidden border border-gold/35 hover:border-gold/60 transition-all group"
                style={{
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(10,10,15,0.97) 65%)',
                  boxShadow: '0 0 24px rgba(212,175,55,0.08)',
                }}
              >
                <div className="p-5">
                  <p className="section-eyebrow mb-3">Start Here</p>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gold/12 border border-gold/30 flex items-center justify-center flex-shrink-0">
                      <Crown className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="font-serif text-base text-white">Creator Training</p>
                      <p className="text-xs text-arc-secondary mt-0.5">5-minute guide to your first earnings</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gold group-hover:gap-2.5 transition-all">
                    Start Training
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )}

          </div>
        </div>

        {/* ── Promote Your Profile ───────────────────────────────────────────── */}
        {(() => {
          if (stats !== null && stats.content_count === 0) return null;
          const profileUrl = `${window.location.origin}/creator/${user?.username}`;
          const subscribeUrl = `${profileUrl}?src=invite`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(profileUrl)}&size=150x150&color=D4AF37&bgcolor=09090B&margin=12`;

          const captions = [
            { key: 'cap-profile', label: 'Profile Drop',    text: `My exclusive content is now live on Archangels Club — link in bio.\n${profileUrl}` },
            { key: 'cap-sub',     label: 'Subscriber CTA',  text: `Subscribers get full access to every private drop I post — cancel anytime.\n${subscribeUrl}` },
            { key: 'cap-drop',    label: 'Drop Alert',       text: `New drop just went live. Limited unlocks only — first come, first served.\n${profileUrl}` },
            { key: 'cap-fomo',    label: 'FOMO Push',        text: `This is only available for a limited time. Once the spots are gone, it's gone.\n${profileUrl}` },
            { key: 'cap-general', label: 'General',          text: `Exclusive content you won't find anywhere else. Everything posted on Archangels Club.\n${profileUrl}` },
          ];

          const sourceLabels: Record<string, string> = {
            invite: 'Invite Links', social: 'Social', explore: 'Explore Page',
            recommendation: 'Recommendations', drop: 'Drop Links', direct: 'Direct', profile: 'Profile Link',
          };

          return (
            <div className="mt-12 space-y-6">
              <h2 className="font-serif text-2xl text-white">Promote</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Share Links + QR */}
                <div className="card-surface p-6 rounded-xl space-y-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 className="w-4 h-4 text-gold" />
                    <h3 className="font-serif text-lg text-white">Share Links</h3>
                  </div>
                  {[
                    { key: 'link-profile', label: 'Creator Profile', url: profileUrl },
                    { key: 'link-sub',     label: 'Subscribe Page',  url: subscribeUrl },
                  ].map(({ key, label, url }) => (
                    <div key={key}>
                      <p className="text-xs text-arc-muted mb-1.5">{label}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-bg-hover border border-white/8 text-xs text-arc-secondary truncate">
                          {url}
                        </div>
                        <ActionButton
                          onAction={() => navigator.clipboard.writeText(url)}
                          label={<Copy className="w-4 h-4" />}
                          successLabel="Copied"
                          className="flex-shrink-0 p-2 rounded-lg bg-bg-hover border border-white/8 text-arc-secondary hover:text-gold hover:border-gold/30 transition-all text-xs"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-5 pt-2 border-t border-white/5">
                    <img src={qrUrl} alt="Profile QR code" className="w-[72px] h-[72px] rounded-lg border border-gold/20 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-sans text-white mb-2">QR Code</p>
                      <a href={qrUrl} download="archangels-qr.png" className="text-xs text-gold hover:underline flex items-center gap-1">
                        <Share2 className="w-3 h-3" /> Download
                      </a>
                    </div>
                  </div>
                </div>

                {/* Promo Stats */}
                <div className="card-surface p-6 rounded-xl">
                  <div className="flex items-center gap-2 mb-5">
                    <BarChart2 className="w-4 h-4 text-gold" />
                    <h3 className="font-serif text-lg text-white">Your Reach</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    {[
                      { label: 'Profile Views',    value: promoStats?.views.total ?? '—',                              sub: 'all time' },
                      { label: 'Last 7 Days',      value: promoStats?.views.last_7d ?? '—',                            sub: 'profile views' },
                      { label: 'Subscribers',      value: promoStats?.subscribers ?? stats?.subscriber_count ?? '—',   sub: 'active' },
                      { label: 'Content Unlocks',  value: promoStats?.unlocks ?? '—',                                  sub: 'total purchases' },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="p-3 rounded-xl bg-bg-hover border border-white/5">
                        <p className="text-xs text-arc-muted mb-0.5">{label}</p>
                        <p className="font-serif text-xl text-gold">{value}</p>
                        <p className="text-[10px] text-arc-muted">{sub}</p>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-arc-muted">Conversion Rate</p>
                      <p className="text-sm font-serif text-gold">{promoStats ? `${promoStats.conversion_rate}%` : '—'}</p>
                    </div>
                    {promoStats && Object.keys(promoStats.by_source).length > 0 && (
                      <div className="space-y-1.5 mt-3">
                        <p className="text-xs text-arc-muted mb-2">Traffic by Source</p>
                        {Object.entries(promoStats.by_source)
                          .sort(([, a], [, b]) => b - a)
                          .map(([src, n]) => (
                            <div key={src} className="flex items-center justify-between text-xs">
                              <span className="text-arc-secondary">{sourceLabels[src] ?? src}</span>
                              <span className="text-white font-mono">{n}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Social Captions */}
              <div className="card-surface p-6 rounded-xl">
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
                          label={<Copy className="w-4 h-4" />}
                          successLabel="Copied"
                          className="flex-shrink-0 p-2 rounded-lg text-arc-muted hover:text-gold hover:bg-gold/8 transition-all text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite Links */}
              <div className="card-surface p-6 rounded-xl">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-serif text-lg text-white">Invite Links</h3>
                    <p className="text-xs text-arc-muted mt-0.5">Up to 10 links.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newInviteLabel}
                      onChange={(e) => setNewInviteLabel(e.target.value)}
                      placeholder="Label (e.g. Instagram)"
                      className="input-dark text-xs py-1.5 px-3 w-36"
                      maxLength={60}
                      onKeyDown={(e) => { if (e.key === 'Enter') createInviteLink(); }}
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
                    {inviteLinks.map((link) => {
                      const inviteUrl = `${profileUrl}?ref=${link.invite_code}&src=invite`;
                      return (
                        <div key={link.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-hover border border-white/5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white mb-0.5">{link.label}</p>
                            <p className="text-[10px] text-arc-muted truncate">{inviteUrl}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center gap-1 text-xs text-arc-muted">
                              <Eye className="w-3 h-3" />
                              {link.click_count}
                            </div>
                            <ActionButton
                              onAction={() => navigator.clipboard.writeText(inviteUrl)}
                              label={<Copy className="w-3.5 h-3.5" />}
                              successLabel="Copied"
                              className="p-1.5 rounded-lg text-arc-muted hover:text-gold hover:bg-gold/8 transition-all text-xs"
                            />
                            <button
                              onClick={() => deleteInviteLink(link.id)}
                              className="p-1.5 rounded-lg text-arc-muted hover:text-arc-error hover:bg-arc-error/8 transition-all"
                              title="Delete link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-arc-muted text-center py-6">
                    No links yet.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
    </>
  );
}
