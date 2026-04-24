import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Crown, MessageCircle, CreditCard, ChevronRight, Clock, Sparkles, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sampleContent, sampleSubscriptions, sampleTransactions, sampleCreators, myVaultSummary } from '../data/seed';
import ContentCard from '../components/content/ContentCard';
import Avatar from '../components/ui/Avatar';
import StatCard from '../components/ui/StatCard';
import { formatCurrency, timeAgo } from '../lib/utils';

const unlockedContent = sampleContent.slice(0, 2);

export default function MemberDashboard() {
  const { user, isCreator } = useAuth();

  const totalSpent = sampleTransactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="min-h-screen bg-bg-primary py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-10">
          <p className="section-eyebrow mb-2">Member Dashboard</p>
          <h1 className="font-serif text-3xl text-white">
            Welcome back, {user?.display_name ?? 'Member'}
          </h1>
          <p className="text-arc-secondary text-sm mt-1">
            Your private access hub · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Unlocked Content"
            value={unlockedContent.length}
            sub="pieces in your library"
            icon={<Lock className="w-5 h-5" />}
          />
          <StatCard
            label="Active Subscriptions"
            value={sampleSubscriptions.filter((s) => s.status === 'active').length}
            sub="creators subscribed"
            icon={<Crown className="w-5 h-5" />}
          />
          <StatCard
            label="Messages"
            value={3}
            sub="1 unread"
            icon={<MessageCircle className="w-5 h-5" />}
          />
          <StatCard
            label="Total Spent"
            value={formatCurrency(totalSpent)}
            sub="across all purchases"
            icon={<CreditCard className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left col */}
          <div className="lg:col-span-2 space-y-8">

            {/* Unlocked content */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-serif text-xl text-white">Unlocked Content</h2>
                <Link to="/explore" className="text-xs text-gold hover:underline flex items-center gap-1">
                  Browse More <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {unlockedContent.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {unlockedContent.map((c) => (
                    <ContentCard key={c.id} content={{ ...c, access_type: 'free' }} />
                  ))}
                </div>
              ) : (
                <div className="card-surface p-10 text-center rounded-xl">
                  <Lock className="w-8 h-8 text-arc-muted mx-auto mb-3" />
                  <p className="text-arc-secondary text-sm">No unlocked content yet.</p>
                  <Link to="/explore" className="btn-gold mt-4 text-sm">Explore Creators</Link>
                </div>
              )}
            </div>

            {/* Subscriptions */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-serif text-xl text-white">Active Subscriptions</h2>
              </div>
              <div className="space-y-3">
                {sampleSubscriptions.map((sub) => {
                  const expiresIn = Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={sub.id} className="card-surface p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={sub.creator_avatar} name={sub.creator_name} size="sm" ring />
                        <div>
                          <p className="text-sm text-white">{sub.creator_name}</p>
                          <div className="flex items-center gap-1 text-xs text-arc-muted mt-0.5">
                            <Clock className="w-3 h-3" />
                            Renews in {expiresIn}d
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gold font-serif">{formatCurrency(sub.subscription_price ?? 0)}/mo</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          sub.status === 'active'
                            ? 'bg-arc-success/15 text-arc-success border border-arc-success/25'
                            : 'bg-arc-error/15 text-arc-error border border-arc-error/25'
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-6">
            {/* Quick links */}
            <div className="card-surface p-5 rounded-xl">
              <h3 className="font-serif text-base text-white mb-4">Quick Access</h3>
              <div className="space-y-2">
                {[
                  { to: '/explore', icon: <Crown className="w-4 h-4" />, label: 'Discover Creators' },
                  { to: '/messages', icon: <MessageCircle className="w-4 h-4" />, label: 'Messages & Requests' },
                  { to: '/explore', icon: <Lock className="w-4 h-4" />, label: 'Browse Locked Content' },
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

            {/* Recent transactions */}
            <div className="card-surface p-5 rounded-xl">
              <h3 className="font-serif text-base text-white mb-4">Recent Transactions</h3>
              <div className="space-y-3">
                {sampleTransactions.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{txn.description}</p>
                      <p className="text-xs text-arc-muted mt-0.5">{timeAgo(txn.created_at)}</p>
                    </div>
                    <span className="text-sm font-serif text-arc-error flex-shrink-0">
                      −{formatCurrency(txn.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Access Key vault */}
            <div className="rounded-xl border border-gold-border/60 bg-bg-surface p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gold" />
                  <h3 className="font-serif text-base text-white">Access Vault</h3>
                </div>
                <Link to="/keys" className="text-xs text-gold hover:underline flex items-center gap-1">
                  Manage <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                {[
                  { label: 'Available', value: myVaultSummary.available, color: 'text-gold' },
                  { label: 'Black', value: myVaultSummary.by_type.black, color: 'text-yellow-400' },
                  { label: 'Gold', value: myVaultSummary.by_type.gold, color: 'text-amber-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-bg-hover rounded-lg py-2">
                    <p className={`font-serif text-lg ${color}`}>{value}</p>
                    <p className="text-[10px] text-arc-muted">{label}</p>
                  </div>
                ))}
              </div>
              <Link to="/keys" className="flex items-center justify-center gap-2 text-xs text-arc-secondary hover:text-gold border border-white/10 hover:border-gold/30 rounded-lg py-2 transition-all">
                <Sparkles className="w-3.5 h-3.5" />
                Extend Access · Grant Entry
              </Link>
            </div>

            {/* Creator CTA — only for non-creators */}
            {!isCreator && (
              <div className="rounded-xl border border-gold-border bg-gold-muted/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-gold" />
                  <h3 className="font-serif text-base text-gold">Become a Creator</h3>
                </div>
                <p className="text-xs text-arc-secondary leading-relaxed mb-4">
                  Share exclusive content and earn from your audience. Applications are reviewed manually — only select creators are approved.
                </p>
                <Link to="/apply-creator" className="btn-gold w-full text-sm py-2.5">
                  <Crown className="w-4 h-4" />
                  Apply Now
                </Link>
              </div>
            )}

            {/* Followed creators */}
            <div className="card-surface p-5 rounded-xl">
              <h3 className="font-serif text-base text-white mb-4">Subscribed Creators</h3>
              <div className="space-y-3">
                {sampleCreators.slice(0, 3).map((c) => (
                  <Link
                    key={c.id}
                    to={`/creator/${c.username}`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar src={c.avatar_url} name={c.display_name} size="sm" ring />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white group-hover:text-gold transition-colors truncate">
                        {c.display_name}
                      </p>
                      <p className="text-xs text-arc-muted">{formatCurrency(c.subscription_price)}/mo</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-arc-muted group-hover:text-gold transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
