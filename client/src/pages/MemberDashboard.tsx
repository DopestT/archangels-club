import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Crown, MessageCircle, CreditCard, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/ui/StatCard';
import ContentCard from '../components/content/ContentCard';
import Avatar from '../components/ui/Avatar';
import { formatCurrency, timeAgo } from '../lib/utils';
import { API_BASE } from '../lib/api';
import { setViewMode } from '../lib/viewMode';
import ActivityTicker from '../components/explore/ActivityTicker';
import RecommendationCard from '../components/member/RecommendationCard';
import type { MemberRecommendedCreator, RecommendationType } from '../components/member/RecommendationCard';
import type { Content } from '../types';


interface MemberStats {
  unlocked_count: number;
  subscription_count: number;
  unread_messages: number;
  total_spent: number;
}

interface Subscription {
  id: string;
  creator_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  subscription_price: number;
  started_at: string;
  expires_at: string;
}

interface AiRecs {
  creator_picks: { username: string; display_name: string; reason: string }[];
  guidance: { text: string }[];
}

export default function MemberDashboard() {
  const { user, isCreator, token } = useAuth();
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [unlocked, setUnlocked] = useState<Content[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiRecs, setAiRecs] = useState<AiRecs | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [sqlRecs, setSqlRecs] = useState<{ username: string; display_name: string; avatar_url: string | null; subscription_price: number }[]>([]);
  const [sqlRecsLoaded, setSqlRecsLoaded] = useState(false);
  const [memberSections, setMemberSections] = useState<{ type: RecommendationType; label: string; description: string; creators: MemberRecommendedCreator[] }[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);

  useEffect(() => { document.title = 'My Dashboard — Archangels Club'; }, []);
  // Mark member mode when the dashboard is explicitly visited
  useEffect(() => {
    setViewMode('member');
  }, []);

  useEffect(() => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API_BASE}/api/members/my/stats`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/api/members/my/unlocked?limit=4`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/api/members/my/subscriptions`, { headers }).then(r => r.json()),
    ])
      .then(([statsData, unlockedData, subsData]) => {
        if (!statsData.error) setStats(statsData);
        if (Array.isArray(unlockedData)) setUnlocked(unlockedData);
        if (Array.isArray(subsData)) setSubscriptions(subsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fast SQL-based recs (immediate fallback)
    fetch(`${API_BASE}/api/recommendations/creators?limit=4`, { headers })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.creators)) setSqlRecs(d.creators); })
      .catch(() => {})
      .finally(() => setSqlRecsLoaded(true));

    // Enriched member rec sections (cached server-side — fast enough)
    fetch(`${API_BASE}/api/recommendations/member`, { headers })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.sections)) setMemberSections(d.sections.filter((s: any) => s.creators?.length > 0)); })
      .catch(() => {})
      .finally(() => setSectionsLoaded(true));

    // Slow AI recs (load async)
    setAiLoading(true);
    fetch(`${API_BASE}/api/ai/member-recommendations`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(r => r.json())
      .then(d => { if (d.creator_picks || d.guidance) setAiRecs(d); })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-bg-primary py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow mb-2">Member Dashboard</p>
            <h1 className="font-serif text-3xl text-white">
              Welcome back, {user?.display_name ?? 'Member'}
            </h1>
            <p className="text-arc-secondary text-sm mt-1">
              Your private access hub · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {isCreator && (
            <Link
              to="/creator"
              onClick={() => setViewMode('creator')}
              className="btn-outline text-sm flex-shrink-0"
            >
              <Crown className="w-4 h-4" />
              Creator Studio
            </Link>
          )}
        </div>

        {/* Activity ticker */}
        <div className="mb-8 -mx-4 sm:-mx-6 lg:-mx-8">
          <ActivityTicker mode="member" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Unlocked Content"
            value={stats?.unlocked_count ?? (loading ? '—' : 0)}
            sub="pieces in your library"
            icon={<Lock className="w-5 h-5" />}
          />
          <StatCard
            label="Active Subscriptions"
            value={stats?.subscription_count ?? (loading ? '—' : 0)}
            sub="creators subscribed"
            icon={<Crown className="w-5 h-5" />}
          />
          <StatCard
            label="Messages"
            value={stats?.unread_messages ?? (loading ? '—' : 0)}
            sub="unread"
            icon={<MessageCircle className="w-5 h-5" />}
          />
          <StatCard
            label="Total Spent"
            value={stats ? formatCurrency(stats.total_spent) : (loading ? '—' : formatCurrency(0))}
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
              {unlocked.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {unlocked.map(item => (
                    <ContentCard key={item.id} content={item} showCreator />
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
              {subscriptions.length > 0 ? (
                <div className="space-y-3">
                  {subscriptions.map(sub => (
                    <Link
                      key={sub.id}
                      to={`/creator/${sub.username}`}
                      className="flex items-center justify-between p-4 card-surface rounded-xl hover:border-gold-border/50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={sub.avatar_url ?? undefined} name={sub.display_name} size="sm" ring />
                        <div>
                          <p className="text-sm text-white group-hover:text-gold transition-colors">{sub.display_name}</p>
                          <p className="text-xs text-arc-muted">@{sub.username} · {formatCurrency(sub.subscription_price)}/mo</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-arc-success">Active</p>
                        <p className="text-xs text-arc-muted">Renews {timeAgo(sub.expires_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="card-surface p-8 text-center rounded-xl">
                  <Crown className="w-8 h-8 text-arc-muted mx-auto mb-3" />
                  <p className="text-arc-secondary text-sm">No active subscriptions.</p>
                  <Link to="/explore" className="btn-outline mt-4 text-sm">Find Creators</Link>
                </div>
              )}
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
              <p className="text-xs text-arc-muted text-center py-4">No transactions yet.</p>
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

            {/* Discover creators */}
            <div className="card-surface p-5 rounded-xl">
              <h3 className="font-serif text-base text-white mb-3">Discover Creators</h3>
              <p className="text-xs text-arc-secondary mb-4">Find creators to subscribe to and unlock exclusive content.</p>
              <Link to="/explore" className="btn-outline w-full text-sm py-2.5">
                <Crown className="w-4 h-4" />
                Browse Creators
              </Link>
            </div>

            {/* Picked for You — enriched sections when available, plain SQL as fallback */}
            {(sqlRecsLoaded || sectionsLoaded || aiLoading || aiRecs) && (
              <div className="card-surface p-5 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-gold/70" />
                  <h3 className="font-serif text-base text-white">Picked for You</h3>
                </div>

                {/* Enriched sections — show all non-empty sections, up to 3 creators each */}
                {memberSections.length > 0 ? (
                  <div className="space-y-5">
                    {memberSections.map(section => (
                      <div key={section.type}>
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-arc-muted mb-0.5">
                          {section.label}
                        </p>
                        {section.description && (
                          <p className="text-[10px] text-arc-muted/60 mb-2 leading-relaxed">{section.description}</p>
                        )}
                        <div className="space-y-1.5">
                          {section.creators.slice(0, 3).map(c => (
                            <RecommendationCard
                              key={c.id}
                              creator={c}
                              type={section.type}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Plain SQL recs as fallback while sections load */
                  sqlRecs.length > 0 && (
                    <div className="space-y-2">
                      {sqlRecs.map((c, i) => (
                        <Link
                          key={i}
                          to={`/creator/${c.username}`}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-hover border border-white/5 hover:border-gold/20 transition-all group"
                        >
                          <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-serif text-gold">{c.display_name[0]?.toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">{c.display_name}</p>
                            <p className="text-[11px] text-arc-muted">@{c.username} · {formatCurrency(c.subscription_price)}/mo</p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-arc-muted opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )
                )}

                {/* AI guidance tips */}
                {aiLoading && !aiRecs && memberSections.length === 0 && (
                  <div className="space-y-2 mt-3">
                    {[75, 55, 65].map(w => (
                      <div key={w} className="h-2.5 rounded-full bg-white/5 animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                )}

                {/* AI creator picks — shown when enriched sections are absent */}
                {!aiLoading && aiRecs?.creator_picks && aiRecs.creator_picks.length > 0 && memberSections.length === 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-white/5 mt-4">
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-arc-muted mb-2">Suggested for You</p>
                    {aiRecs.creator_picks.map((p: { username: string; display_name: string; reason: string }) => (
                      <Link
                        key={p.username}
                        to={`/creator/${p.username}`}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-bg-hover border border-white/5 hover:border-gold/20 transition-all group"
                      >
                        <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-serif text-gold">{p.display_name[0]?.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{p.display_name}</p>
                          <p className="text-[10px] text-arc-muted">@{p.username}</p>
                          <p className="text-[10px] text-arc-secondary mt-0.5 leading-relaxed">{p.reason}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-arc-muted opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0 mt-1" />
                      </Link>
                    ))}
                  </div>
                )}

                {aiRecs?.guidance && aiRecs.guidance.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-white/5 mt-4">
                    <p className="text-[10px] font-medium tracking-widest uppercase text-arc-muted mb-2">Tips</p>
                    {aiRecs.guidance.map((g: { text: string }, i: number) => (
                      <p key={i} className="text-xs text-arc-secondary leading-relaxed flex gap-2">
                        <span className="text-gold flex-shrink-0 mt-0.5">·</span>
                        {g.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
