import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Upload, DollarSign, Users, TrendingUp, MessageCircle, Clock, ChevronRight, Star, CheckCircle, XCircle, ShieldCheck, Crown, ExternalLink, Zap, LayoutDashboard, Copy, Link2, Trash2, Plus, Eye, Share2, BarChart2, PlayCircle, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/ui/StatCard';
import { formatCurrency, timeAgo } from '../lib/utils';
import { API_BASE } from '../lib/api';
import { setViewMode } from '../lib/viewMode';
import ActivityTicker from '../components/explore/ActivityTicker';
import ActionButton from '../components/ui/ActionButton';


interface StripeStatus { has_account: boolean; onboarded: boolean; account_id: string | null }
interface CreatorStats { total_earnings: number; subscriber_count: number; content_unlocks: number; tips_total: number; content_count: number }
interface Transaction { id: string; ref_type: string; amount: number; net_amount: number; payer_name: string; content_title: string | null; created_at: string }
interface CustomRequest { id: string; description: string; offered_price: number; status: string; fan_name: string; created_at: string }
interface PromoStats { views: { total: number; last_7d: number; last_30d: number }; by_source: Record<string, number>; subscribers: number; unlocks: number; conversion_rate: number }
interface InviteLink { id: string; invite_code: string; label: string; click_count: number; created_at: string }

export default function CreatorDashboard() {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Persist mode on mount
  useEffect(() => { setViewMode('creator'); }, []);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [promoStats, setPromoStats] = useState<PromoStats | null>(null);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [newInviteLabel, setNewInviteLabel] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/stripe/connect/status`, { headers: authHeaders })
      .then((r) => r.json())
      .then(setStripeStatus)
      .catch(() => {});
    fetch(`${API_BASE}/api/creators/my/stats`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setStats(d); })
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
  }, [token]);

  // After Stripe redirects back with ?stripe=return, verify onboarding
  useEffect(() => {
    if (searchParams.get('stripe') !== 'return' || !token) return;
    setSearchParams({}, { replace: true });
    fetch(`${API_BASE}/api/stripe/connect/verify`, { method: 'POST', headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setStripeStatus((prev) => prev ? { ...prev, onboarded: data.onboarded } : null))
      .catch(() => {});
  }, [searchParams, token]);

  async function startStripeOnboarding() {
    if (!token) return;
    setStripeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/stripe/connect/start`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // silent — user can retry
    } finally {
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
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
  }

  return (
    <div className="min-h-screen bg-bg-primary py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-10">
          <div>
            <p className="section-eyebrow mb-2">Creator Studio</p>
            <h1 className="font-serif text-3xl text-white">{user?.display_name ?? 'Creator'}</h1>
            <p className="text-arc-secondary text-sm mt-1">@{user?.username}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              onClick={() => setViewMode('member')}
              className="btn-outline text-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Member View
            </Link>
            <Link to="/upload" className="btn-gold text-sm">
              <Upload className="w-4 h-4" />
              Upload Content
            </Link>
          </div>
        </div>

        {/* Activity ticker */}
        <div className="mb-8 -mx-4 sm:-mx-6 lg:-mx-8">
          <ActivityTicker mode="creator" />
        </div>

        {/* Creator application status */}
        {user?.is_verified_creator ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-arc-success/8 border border-arc-success/25 mb-8">
            <ShieldCheck className="w-4 h-4 text-arc-success flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-arc-success">Verified Creator</p>
              <p className="text-xs text-arc-muted mt-0.5">Your profile is live and discoverable. All submitted content enters the review queue before going public.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20 mb-8">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-300">Creator Application Under Review</p>
              <p className="text-xs text-arc-muted mt-0.5 leading-relaxed">
                Your application is being reviewed by our team. You can explore the creator studio, but content uploads won't be visible until your account is approved.
                Expect a response within <strong className="text-amber-200">48–72 hours</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Stripe Connect Banner */}
        {stripeStatus !== null && !stripeStatus.onboarded && (
          <div className="flex items-start gap-4 p-5 rounded-xl bg-bg-surface border border-gold/30 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white mb-0.5">Set up payouts to start earning</p>
              <p className="text-xs text-arc-secondary leading-relaxed">
                Connect your bank account via Stripe. Once set up, 80% of every payment goes directly to you — automatically.
              </p>
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
              {stripeLoading ? 'Loading…' : 'Set Up Payouts'}
            </button>
          </div>
        )}

        {stripeStatus?.onboarded && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-arc-success/8 border border-arc-success/25 mb-8">
            <CheckCircle className="w-4 h-4 text-arc-success flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-arc-success">Payouts connected</p>
              <p className="text-xs text-arc-muted mt-0.5">Your Stripe account is set up. You'll receive 80% of every sale automatically.</p>
            </div>
            <button onClick={openStripeDashboard} className="text-xs text-gold hover:underline flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Stripe Dashboard
            </button>
          </div>
        )}

        {/* ── First-time creator screen ─────────────────────────────────── */}
        {stats !== null && stats.content_count === 0 && (
          <div className="mb-12">
            {/* Hero CTA */}
            <div
              className="rounded-2xl p-8 sm:p-12 mb-8 text-center border border-gold/20 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(5,5,5,0.98) 60%)' }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,175,55,0.08) 0%, transparent 70%)' }} />
              <div className="relative">
                <span className="font-serif text-2xl text-gold leading-none block mb-6">✦</span>
                <p className="text-xs tracking-widest uppercase text-gold font-bold mb-4">Your Studio Is Ready</p>
                <h2 className="font-serif text-3xl sm:text-4xl text-white mb-4 leading-tight">
                  Create your first locked post.
                </h2>
                <p className="text-arc-secondary text-sm leading-relaxed max-w-sm mx-auto mb-8">
                  Upload content, set a price, and publish your first exclusive drop. Everything starts here.
                </p>
                <Link to="/upload" className="btn-gold inline-flex items-center gap-2 px-8 py-3 text-sm font-semibold">
                  <Upload className="w-4 h-4" />
                  Upload First Post
                </Link>
              </div>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { step: '01', icon: <Upload className="w-5 h-5" />, label: 'Upload', desc: 'Photo, video, or audio. Set a preview and the full locked version.' },
                { step: '02', icon: <Lock className="w-5 h-5" />, label: 'Set Access', desc: 'Locked (one-time price), subscribers only, or limited drop.' },
                { step: '03', icon: <ArrowRight className="w-5 h-5" />, label: 'Publish', desc: 'Go live instantly. Members see it in the feed the moment you publish.' },
              ].map(({ step, icon, label, desc }) => (
                <div key={step} className="card-surface p-5 rounded-xl flex gap-4">
                  <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold flex-shrink-0">
                    {icon}
                  </div>
                  <div>
                    <p className="text-[10px] tracking-widest text-arc-muted uppercase mb-0.5">{step}</p>
                    <p className="text-sm font-medium text-white mb-1">{label}</p>
                    <p className="text-xs text-arc-muted leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Creator training card */}
            <Link
              to="/creator/onboarding"
              className="flex items-center gap-5 p-5 rounded-xl border border-white/8 hover:border-gold/30 bg-bg-surface transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold flex-shrink-0 group-hover:bg-gold/15 transition-colors">
                <PlayCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white mb-0.5">Watch the creator guide</p>
                <p className="text-xs text-arc-muted">5-minute walkthrough — what to post, how to price, and how to promote.</p>
              </div>
              <ChevronRight className="w-4 h-4 text-arc-muted group-hover:text-gold transition-colors flex-shrink-0" />
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 ${stats !== null && stats.content_count === 0 ? 'hidden' : ''}`}>
          <StatCard
            label="Total Earnings"
            value={stats ? formatCurrency(stats.total_earnings) : '—'}
            sub="lifetime net"
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            label="Subscribers"
            value={stats ? stats.subscriber_count.toLocaleString() : '—'}
            sub="active subscribers"
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            label="Content Unlocks"
            value={stats ? stats.content_unlocks.toLocaleString() : '—'}
            sub="total purchases"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            label="Tips Received"
            value={stats ? formatCurrency(stats.tips_total) : '—'}
            sub="lifetime tips"
            icon={<Star className="w-5 h-5" />}
          />
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 ${stats !== null && stats.content_count === 0 ? 'hidden' : ''}`}>
          {/* Left — transactions + requests */}
          <div className="lg:col-span-2 space-y-8">

            {/* Earnings chart placeholder */}
            <div className="card-surface p-6 rounded-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-serif text-lg text-white">Earnings Overview</h2>
                <select className="input-dark w-auto text-xs py-1.5 px-3">
                  <option>Last 30 days</option>
                  <option>Last 90 days</option>
                  <option>This year</option>
                </select>
              </div>
              {/* Bar chart placeholder */}
              <div className="flex items-end gap-2 h-32">
                {[40, 65, 45, 80, 60, 90, 75, 95, 55, 70, 85, 100, 72, 88, 60, 95, 80, 70, 65, 90, 75, 100, 85, 78, 92, 68, 84, 76, 88, 95].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all duration-200 hover:opacity-80"
                    style={{
                      height: `${h}%`,
                      background: i === 29
                        ? 'linear-gradient(180deg, #D4AF37, #B8962E)'
                        : 'rgba(212,175,55,0.25)',
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-arc-muted">
                <span>Apr 1</span>
                <span>Apr 15</span>
                <span>Today</span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4">
                {[
                  { label: 'Lifetime Earnings', value: stats ? formatCurrency(stats.total_earnings) : '—' },
                  { label: 'Platform Fee (20%)', value: stats ? formatCurrency(stats.total_earnings * 0.25) : '—' },
                  { label: 'Active Subscribers', value: stats ? stats.subscriber_count.toString() : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-xs text-arc-muted mb-1">{label}</p>
                    <p className="text-sm font-serif text-gold">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent transactions */}
            <div className="card-surface p-6 rounded-xl">
              <h2 className="font-serif text-lg text-white mb-5">Recent Transactions</h2>
              {transactions.length > 0 ? (
                <div className="space-y-0">
                  {transactions.map((txn, i) => (
                    <div
                      key={txn.id}
                      className={`flex items-center justify-between py-3.5 gap-4 ${
                        i < transactions.length - 1 ? 'border-b border-white/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gold-muted border border-gold-border flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-gold" />
                        </div>
                        <div>
                          <p className="text-sm text-white capitalize">{txn.ref_type.replace('_', ' ')}</p>
                          <p className="text-xs text-arc-muted">from {txn.payer_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-serif text-arc-success">+{formatCurrency(Number(txn.net_amount))}</p>
                        <p className="text-xs text-arc-muted">{timeAgo(txn.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-gold/8 border border-gold/15 flex items-center justify-center mb-3">
                    <DollarSign className="w-5 h-5 text-gold/50" />
                  </div>
                  <p className="text-sm text-arc-secondary mb-1">No earnings yet</p>
                  <p className="text-xs text-arc-muted">Transactions appear here once members unlock or subscribe.</p>
                </div>
              )}
            </div>

            {/* Custom requests */}
            <div className="card-surface p-6 rounded-xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-serif text-lg text-white">Custom Requests</h2>
                <span className="text-xs text-arc-muted">
                  {requests.filter((r) => r.status === 'pending').length} pending
                </span>
              </div>
              {requests.length > 0 ? (
                <div className="space-y-4">
                  {requests.map((req) => (
                    <div key={req.id} className="p-4 rounded-xl bg-bg-hover border border-white/5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <p className="text-sm text-white leading-relaxed flex-1">{req.description}</p>
                        <span className="font-serif text-gold text-lg flex-shrink-0">
                          {formatCurrency(Number(req.offered_price))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                            req.status === 'pending'
                              ? 'text-amber-400 bg-amber-400/10 border-amber-400/25'
                              : req.status === 'accepted'
                              ? 'text-arc-success bg-arc-success/10 border-arc-success/25'
                              : 'text-arc-error bg-arc-error/10 border-arc-error/25'
                          }`}>
                            {req.status}
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
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center mb-3">
                    <MessageCircle className="w-5 h-5 text-arc-muted" />
                  </div>
                  <p className="text-sm text-arc-secondary mb-1">No requests yet</p>
                  <p className="text-xs text-arc-muted">Custom requests from members will appear here.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right — quick actions */}
          <div className="space-y-5">
            {/* Creator training card */}
            <Link
              to="/creator/onboarding"
              className="block rounded-xl overflow-hidden border border-gold/20 hover:border-gold/40 transition-all group"
              style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(10,10,15,0.95) 60%)' }}
            >
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <Crown className="w-4.5 h-4.5 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Creator Training</p>
                    <p className="text-xs text-arc-muted">5-minute guide to your first earnings</p>
                  </div>
                </div>
                <p className="text-xs text-arc-secondary leading-relaxed mb-3">
                  Learn what to post, how to price it, and how to publish your first piece of content.
                </p>
                <div className="flex items-center gap-1.5 text-xs font-medium text-gold group-hover:gap-2.5 transition-all">
                  Start Training
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>

            <div className="card-surface p-5 rounded-xl">
              <h3 className="font-serif text-base text-white mb-4">Creator Tools</h3>
              <div className="space-y-2">
                {[
                  { to: '/upload', icon: <Upload className="w-4 h-4" />, label: 'Upload New Content' },
                  { to: '/messages', icon: <MessageCircle className="w-4 h-4" />, label: 'Messages' },
                ].map(({ to, icon, label }) => (
                  <Link
                    key={to + label}
                    to={to}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-arc-secondary hover:text-white hover:bg-bg-hover transition-all"
                  >
                    <span className="text-gold">{icon}</span>
                    {label}
                    <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Platform fee info */}
            <div className="card-surface p-5 rounded-xl border-gold-border/60">
              <h3 className="font-serif text-base text-gold mb-3">Platform Fee</h3>
              <p className="text-xs text-arc-secondary leading-relaxed mb-3">
                Archangels Club retains a 20% platform fee on all transactions. You receive 80% of all income.
              </p>
              <div className="space-y-2 text-xs">
                {[
                  ['Subscriptions', '80% to you'],
                  ['Content Unlocks', '80% to you'],
                  ['Tips', '80% to you'],
                  ['Custom Requests', '80% to you'],
                ].map(([type, payout]) => (
                  <div key={type} className="flex justify-between">
                    <span className="text-arc-muted">{type}</span>
                    <span className="text-arc-success">{payout}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-300">Payout Schedule</span>
              </div>
              <p className="text-xs text-arc-muted leading-relaxed">
                Payouts processed weekly. Minimum payout: $50. Bank transfer or crypto available.
              </p>
            </div>
          </div>
        </div>

        {/* ── Promote Your Profile ───────────────────────────────────────── */}
        {(() => {
          if (stats !== null && stats.content_count === 0) return null;
          const profileUrl = `${window.location.origin}/creator/${user?.username}`;
          const subscribeUrl = `${profileUrl}?src=invite`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(profileUrl)}&size=150x150&color=D4AF37&bgcolor=09090B&margin=12`;

          const captions = [
            { key: 'cap-profile', label: 'Profile Drop', text: `My exclusive content is now live on Archangels Club — link in bio.\n${profileUrl}` },
            { key: 'cap-sub', label: 'Subscriber CTA', text: `Subscribers get full access to every private drop I post — cancel anytime.\n${subscribeUrl}` },
            { key: 'cap-drop', label: 'Drop Alert', text: `New drop just went live. Limited unlocks only — first come, first served.\n${profileUrl}` },
            { key: 'cap-fomo', label: 'FOMO Push', text: `This is only available for a limited time. Once the spots are gone, it's gone.\n${profileUrl}` },
            { key: 'cap-general', label: 'General', text: `Exclusive content you won't find anywhere else. Everything posted on Archangels Club.\n${profileUrl}` },
          ];

          const sourceLabels: Record<string, string> = {
            invite: 'Invite Links',
            social: 'Social',
            explore: 'Explore Page',
            recommendation: 'Recommendations',
            drop: 'Drop Links',
            direct: 'Direct',
            profile: 'Profile Link',
          };

          return (
            <div className="mt-12 space-y-6">
              <div>
                <p className="section-eyebrow mb-1">Growth Tools</p>
                <h2 className="font-serif text-2xl text-white">Promote Your Profile</h2>
              </div>

              {/* Share links + stats */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Share Links + QR */}
                <div className="card-surface p-6 rounded-xl space-y-5">
                  <div className="flex items-center gap-2 mb-1">
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

                  {/* QR Code */}
                  <div className="flex items-center gap-5 pt-2 border-t border-white/5">
                    <img
                      src={qrUrl}
                      alt="Profile QR code"
                      className="w-[72px] h-[72px] rounded-lg border border-gold/20 flex-shrink-0"
                    />
                    <div>
                      <p className="text-sm font-sans text-white mb-0.5">QR Code</p>
                      <p className="text-xs text-arc-secondary mb-2">Links directly to your creator profile.</p>
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
                      { label: 'Profile Views', value: promoStats?.views.total ?? '—', sub: 'all time' },
                      { label: 'Last 7 Days', value: promoStats?.views.last_7d ?? '—', sub: 'profile views' },
                      { label: 'Subscribers', value: promoStats?.subscribers ?? stats?.subscriber_count ?? '—', sub: 'active' },
                      { label: 'Content Unlocks', value: promoStats?.unlocks ?? '—', sub: 'total purchases' },
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
                <h3 className="font-serif text-lg text-white mb-4">Ready-to-Copy Captions</h3>
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
                    <h3 className="font-serif text-lg text-white">Private Invite Links</h3>
                    <p className="text-xs text-arc-muted mt-0.5">Track which links drive the most traffic. Max 10 links.</p>
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
                    No invite links yet. Create one to track traffic from a specific source.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
