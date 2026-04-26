import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Lock, Heart, MessageCircle, Star, Crown, Send, AlertTriangle, Users, Clock, Unlock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ContentCard from '../components/content/ContentCard';
import Avatar from '../components/ui/Avatar';
import { VerifiedBadge } from '../components/ui/Badge';
import { formatCurrency, formatCompactNumber, timeAgo } from '../lib/utils';
import type { CreatorProfile, Content } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://archangels-club-production.up.railway.app';

type Tab = 'posts' | 'drops' | 'about' | 'reviews';


export default function CreatorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { isAuthenticated, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [tipping, setTipping] = useState(false);
  const [tipAmount, setTipAmount] = useState('10');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError('');

    Promise.all([
      fetch(`${API_BASE}/api/creators/${username}`).then((r) => r.json()),
      fetch(`${API_BASE}/api/creators/${username}/content`).then((r) => r.json()),
    ])
      .then(([creatorData, contentData]) => {
        if (creatorData.error) {
          setError(creatorData.error);
        } else {
          setCreator(creatorData);
          setContent(Array.isArray(contentData) ? contentData : []);
        }
      })
      .catch(() => {
        setError('Unable to load creator profile.');
      })
      .finally(() => setLoading(false));
  }, [username]);

  async function startCheckout(type: 'tip' | 'subscription') {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!creator) return;

    setCheckoutError('');
    setCheckoutLoading(true);

    const body: Record<string, unknown> = { type, creatorId: creator.id };
    if (type === 'tip') body.amount = Number(tipAmount);

    console.log(`[checkout] starting ${type} for creator:`, creator.username, body);

    try {
      console.log('[checkout] POST /api/stripe/checkout');
      const res = await fetch(`${API_BASE}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      console.log('[checkout] response:', res.status, data);

      if (!res.ok || !data.url) {
        setCheckoutError(data.error || 'Failed to start checkout. Please try again.');
        setCheckoutLoading(false);
        return;
      }
      console.log('[checkout] redirecting to Stripe:', data.url?.substring(0, 60));
      setRedirecting(true);
      window.location.href = data.url;
    } catch (err) {
      console.error('[checkout] fetch error:', err);
      setCheckoutError('Unable to reach the server. Please try again.');
      setCheckoutLoading(false);
    }
  }

  function handleTip() {
    setTipping(false);
    startCheckout('tip');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center mb-6">
          <Lock className="w-7 h-7 text-gold" />
        </div>
        <h2 className="font-serif text-2xl text-white mb-2 text-center">This profile is private</h2>
        <p className="text-arc-secondary text-sm mb-1 text-center max-w-sm">
          {error?.includes('not found') || !error
            ? 'This creator may have changed their handle, or this profile is invite-only.'
            : error}
        </p>
        <p className="text-xs text-arc-muted mb-8 text-center">All creators on Archangels Club are verified and hand-selected.</p>
        <div className="flex items-center gap-3">
          <Link to="/explore" className="btn-gold text-sm px-6">
            <Crown className="w-4 h-4" />
            Explore Creators
          </Link>
          <Link to="/signup" className="btn-outline text-sm px-6">Request Invite</Link>
        </div>
      </div>
    );
  }

  const drops = content.filter((c) => c.access_type === 'locked');
  const posts = content;
  const firstDrop = drops[0] ?? null;
  const lastDropAt = content.length > 0
    ? content.reduce((a, b) => a.created_at > b.created_at ? a : b).created_at
    : null;
  const totalUnlocks = content.reduce((sum, c) => sum + Number(c.unlock_count ?? 0), 0);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'posts', label: 'Posts', count: posts.length },
    { id: 'drops', label: 'Private Drops', count: drops.length },
    { id: 'about', label: 'About' },
    { id: 'reviews', label: 'Reviews' },
  ];

  return (
    <div className="bg-bg-primary min-h-screen">
      {/* Checkout redirect overlay */}
      {redirecting && (
        <div className="fixed inset-0 z-50 bg-bg-primary/97 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-14 h-14 border-2 border-gold/30 border-t-gold rounded-full animate-spin mb-6" />
          <p className="font-serif text-2xl text-white mb-2">Redirecting to checkout</p>
          <p className="text-sm text-arc-muted">Secure payment via Stripe. You'll be returned here after.</p>
        </div>
      )}

      {/* Cover */}
      <div className="relative h-64 sm:h-80 overflow-hidden">
        {creator.cover_image_url ? (
          <img src={creator.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gold-subtle via-bg-surface to-bg-primary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-primary/30 to-bg-primary" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile header */}
        <div className="relative -mt-16 sm:-mt-20 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            {/* Avatar + name */}
            <div className="flex items-end gap-4">
              <div className="relative">
                <Avatar
                  src={creator.avatar_url ?? undefined}
                  name={creator.display_name ?? creator.username ?? ''}
                  size="2xl"
                  ring
                />
                {creator.is_verified_creator && (
                  <VerifiedBadge className="absolute bottom-1 right-1 w-6 h-6" />
                )}
              </div>
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="font-serif text-2xl sm:text-3xl text-white">{creator.display_name}</h1>
                  {creator.is_verified_creator && (
                    <span className="text-xs text-blue-400 border border-blue-400/30 px-2 py-0.5 rounded-full">Verified</span>
                  )}
                </div>
                <p className="text-arc-secondary text-sm">@{creator.username}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col items-end gap-2 mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTipping(!tipping)}
                  className="btn-outline text-sm px-3 py-2"
                >
                  <Heart className="w-4 h-4" />
                  Tip
                </button>
                <Link to="/messages" className="btn-outline text-sm px-3 py-2">
                  <MessageCircle className="w-4 h-4" />
                  Message
                </Link>
                {firstDrop ? (
                  <Link to={`/content/${firstDrop.id}`} className="btn-gold text-sm">
                    <Unlock className="w-4 h-4" />
                    Unlock First Drop · {formatCurrency(firstDrop.price)}
                  </Link>
                ) : (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-sans font-medium text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-full">
                      Most Popular
                    </span>
                    <button
                      onClick={() => startCheckout('subscription')}
                      disabled={checkoutLoading}
                      className="btn-gold text-sm"
                    >
                      <Crown className="w-4 h-4" />
                      {checkoutLoading ? 'Loading…' : `Subscribe · ${formatCurrency(creator.subscription_price)}/mo`}
                    </button>
                  </div>
                )}
              </div>

              {/* Subscribe secondary (shown when firstDrop is the primary) */}
              {firstDrop && (
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-sans font-medium text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-full">
                      Most Popular
                    </span>
                    <button
                      onClick={() => startCheckout('subscription')}
                      disabled={checkoutLoading}
                      className="btn-outline text-sm"
                    >
                      <Crown className="w-4 h-4" />
                      {checkoutLoading ? 'Loading…' : `Subscribe · ${formatCurrency(creator.subscription_price)}/mo`}
                    </button>
                  </div>
                  <p className="text-[10px] text-arc-muted">All drops included · Cancel anytime</p>
                </div>
              )}
            </div>
          </div>

          {/* Checkout error */}
          {checkoutError && (
            <div className="mt-3 p-3 rounded-xl bg-arc-error/10 border border-arc-error/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-arc-error flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-arc-error">{checkoutError}</p>
                <button
                  onClick={() => setCheckoutError('')}
                  className="text-[10px] text-arc-muted hover:text-white mt-1 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Tip panel */}
          {tipping && (
            <div className="mt-4 p-5 card-surface rounded-xl">
              <h4 className="font-serif text-sm text-white mb-3">Send a Tip to {creator.display_name}</h4>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {['5', '10', '25', '50', '100'].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTipAmount(amt)}
                    className={`px-4 py-2 rounded-lg text-sm font-sans transition-all ${
                      tipAmount === amt
                        ? 'bg-gold text-bg-primary'
                        : 'bg-bg-hover text-arc-secondary hover:text-white border border-white/10'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
                <input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="input-dark w-28 text-sm"
                  placeholder="Custom"
                  min="1"
                />
              </div>
              <button onClick={handleTip} disabled={checkoutLoading} className="btn-gold text-sm">
                <Send className="w-4 h-4" />
                {checkoutLoading ? 'Redirecting…' : `Send $${tipAmount} Tip →`}
              </button>
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 p-5 card-surface rounded-xl mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Users className="w-3.5 h-3.5 text-gold" />
              <span className="font-serif text-xl text-gold">{formatCompactNumber(Number(creator.subscriber_count) || 0)}</span>
            </div>
            <div className="text-xs text-arc-secondary">Subscribers</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Clock className="w-3.5 h-3.5 text-gold" />
              <span className="font-serif text-xl text-gold">{lastDropAt ? timeAgo(lastDropAt) : '—'}</span>
            </div>
            <div className="text-xs text-arc-secondary">Last Drop</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Unlock className="w-3.5 h-3.5 text-gold" />
              <span className="font-serif text-xl text-gold">{formatCompactNumber(totalUnlocks)}</span>
            </div>
            <div className="text-xs text-arc-secondary">Total Unlocks</div>
          </div>
        </div>

        {/* Custom request CTA */}
        <div className="flex items-center justify-between p-4 card-surface rounded-xl mb-8 gap-4">
          <div>
            <p className="text-sm text-white font-sans font-medium mb-0.5">Request Custom Content</p>
            <p className="text-xs text-arc-secondary">Send a private request directly to {creator.display_name}. 24h response guarantee.</p>
          </div>
          <Link to="/messages" className="btn-outline text-sm flex-shrink-0">
            <MessageCircle className="w-4 h-4" />
            Request
          </Link>
        </div>

        {/* Tags */}
        {creator.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {creator.tags.map((tag) => (
              <span key={tag} className="tag-pill">{tag}</span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gold-border/40 mb-8">
          <div className="flex gap-1">
            {tabs.map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-5 py-3 text-sm font-sans transition-all border-b-2 -mb-px ${
                  activeTab === id
                    ? 'border-gold text-gold'
                    : 'border-transparent text-arc-secondary hover:text-white'
                }`}
              >
                {label}
                {count !== undefined && (
                  <span className="ml-1.5 text-xs opacity-60">({count})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="pb-20">
          {(activeTab === 'posts' || activeTab === 'drops') && (
            <div>
              {(activeTab === 'posts' ? posts : drops).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {(activeTab === 'posts' ? posts : drops).map((item) => (
                    <ContentCard key={item.id} content={item} showCreator={false} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 max-w-sm mx-auto">
                  <div className="w-14 h-14 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center mx-auto mb-5">
                    <Lock className="w-6 h-6 text-gold" />
                  </div>
                  <h3 className="font-serif text-lg text-white mb-2">
                    {activeTab === 'drops' ? 'Private drops incoming' : 'Content coming soon'}
                  </h3>
                  <p className="text-arc-secondary text-sm mb-6">
                    Subscribe now to be notified the moment {creator.display_name} drops new exclusive content.
                  </p>
                  <button
                    onClick={() => startCheckout('subscription')}
                    disabled={checkoutLoading}
                    className="btn-gold text-sm"
                  >
                    <Crown className="w-4 h-4" />
                    Subscribe · {formatCurrency(creator.subscription_price)}/mo
                  </button>
                  <p className="text-xs text-arc-muted mt-2">Cancel anytime · No commitment</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="max-w-2xl space-y-5">
              <div className="card-surface p-8 rounded-xl">
                <h3 className="font-serif text-xl text-white mb-4">About {creator.display_name}</h3>
                <p className="text-arc-secondary leading-relaxed mb-6">{creator.bio}</p>
                <div className="divider-gold my-6" />
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Member Since', value: new Date(creator.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
                    { label: 'Content Type', value: creator.tags.join(', ') || '—' },
                    { label: 'Subscription', value: `${formatCurrency(creator.subscription_price)}/month` },
                    { label: 'Starting Price', value: `From ${formatCurrency(creator.starting_price)}` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-arc-muted mb-1">{label}</p>
                      <p className="text-sm text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subscription value card */}
              <div className="card-surface p-6 rounded-xl border border-gold-border/50">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-4 h-4 text-gold" />
                      <span className="text-sm font-sans font-medium text-white">Monthly Subscription</span>
                      <span className="text-[10px] font-medium text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-full">Most Popular</span>
                    </div>
                    <p className="font-serif text-2xl text-gold">{formatCurrency(creator.subscription_price)}<span className="text-sm text-arc-muted font-sans">/mo</span></p>
                  </div>
                </div>
                <ul className="space-y-2 mb-5">
                  {[
                    'Exclusive subscriber-only posts + discounts on drops',
                    'Priority on custom content requests',
                    'Subscriber-exclusive content',
                    'Cancel anytime — no commitment',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-arc-secondary">
                      <span className="w-1 h-1 rounded-full bg-gold flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => startCheckout('subscription')}
                  disabled={checkoutLoading}
                  className="btn-gold w-full justify-center text-sm"
                >
                  <Crown className="w-4 h-4" />
                  {checkoutLoading ? 'Redirecting…' : `Subscribe Now · ${formatCurrency(creator.subscription_price)}/mo`}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="max-w-2xl">
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center mx-auto mb-4">
                  <Star className="w-5 h-5 text-gold" />
                </div>
                <p className="text-arc-secondary text-sm mb-1">No reviews yet.</p>
                <p className="text-xs text-arc-muted">Reviews from subscribers will appear here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
