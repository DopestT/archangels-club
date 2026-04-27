import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Upload, DollarSign, Users, TrendingUp, MessageCircle, Clock, ChevronRight, Star, CheckCircle, XCircle, ShieldCheck, Crown, ExternalLink, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/ui/StatCard';
import { formatCurrency, timeAgo } from '../lib/utils';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

interface StripeStatus { has_account: boolean; onboarded: boolean; account_id: string | null }
interface CreatorStats { total_earnings: number; subscriber_count: number; content_unlocks: number; tips_total: number }
interface Transaction { id: string; ref_type: string; amount: number; net_amount: number; payer_name: string; content_title: string | null; created_at: string }
interface CustomRequest { id: string; description: string; offered_price: number; status: string; fan_name: string; created_at: string }

export default function CreatorDashboard() {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [requests, setRequests] = useState<CustomRequest[]>([]);

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
          <Link to="/upload" className="btn-gold text-sm">
            <Upload className="w-4 h-4" />
            Upload Content
          </Link>
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

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                <p className="text-xs text-arc-muted text-center py-6">No transactions yet.</p>
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
                            <button
                              onClick={() => handleCustomRequest(req.id, 'accepted')}
                              title="Accept"
                              className="p-1.5 rounded-lg bg-arc-success/10 text-arc-success hover:bg-arc-success/20 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCustomRequest(req.id, 'rejected')}
                              title="Reject"
                              className="p-1.5 rounded-lg bg-arc-error/10 text-arc-error hover:bg-arc-error/20 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-arc-muted text-center py-6">No custom requests yet.</p>
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
      </div>
    </div>
  );
}
