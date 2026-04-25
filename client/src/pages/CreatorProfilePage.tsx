import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Lock, Heart, MessageCircle, Star, Crown, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ContentCard from '../components/content/ContentCard';
import Avatar from '../components/ui/Avatar';
import { VerifiedBadge } from '../components/ui/Badge';
import { formatCurrency, formatCompactNumber } from '../lib/utils';
import type { CreatorProfile, Content } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'https://archangels-club-production.up.railway.app';

type Tab = 'posts' | 'drops' | 'about' | 'reviews';

const SAMPLE_REVIEWS = [
  { id: 'r1', name: 'Jordan M.', rating: 5, text: 'Absolutely worth every cent. The quality and exclusivity here is unmatched.', date: '3 days ago' },
  { id: 'r2', name: 'Alex R.', rating: 5, text: 'Responded to my custom request within hours. Delivered beyond expectations.', date: '1 week ago' },
  { id: 'r3', name: 'Marcus T.', rating: 5, text: 'The subscriber drop last week was fire. This is why I stay subscribed.', date: '2 weeks ago' },
];

export default function CreatorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [tipping, setTipping] = useState(false);
  const [tipAmount, setTipAmount] = useState('10');
  const [subscribed, setSubscribed] = useState(false);
  const [tipSent, setTipSent] = useState(false);

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
        console.log('[CreatorProfilePage] creator:', creatorData);
        console.log('[CreatorProfilePage] content:', contentData);
        if (creatorData.error) {
          setError(creatorData.error);
        } else {
          setCreator(creatorData);
          setContent(Array.isArray(contentData) ? contentData : []);
        }
      })
      .catch((err) => {
        console.error('[CreatorProfilePage] fetch error:', err);
        setError('Unable to load creator profile.');
      })
      .finally(() => setLoading(false));
  }, [username]);

  function handleTip() {
    setTipSent(true);
    setTipping(false);
    setTimeout(() => setTipSent(false), 3000);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-2xl text-white mb-2">Creator Not Found</h2>
          <p className="text-arc-secondary mb-4">{error || 'This creator does not exist.'}</p>
          <Link to="/explore" className="btn-outline mt-4">Back to Explore</Link>
        </div>
      </div>
    );
  }

  const drops = content.filter((c) => c.access_type === 'locked');
  const posts = content;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'posts', label: 'Posts', count: posts.length },
    { id: 'drops', label: 'Private Drops', count: drops.length },
    { id: 'about', label: 'About' },
    { id: 'reviews', label: 'Reviews', count: SAMPLE_REVIEWS.length },
  ];

  return (
    <div className="bg-bg-primary min-h-screen">
      {/* Cover */}
      <div className="relative h-64 sm:h-80 overflow-hidden">
        {creator.cover_image_url ? (
          <img src={creator.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gold-subtle" />
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
                    <span className="text-xs text-blue-400 border border-blue-400/30 px-2 py-0.5 rounded-full">
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-arc-secondary text-sm">@{creator.username}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 mb-2">
              {tipSent ? (
                <span className="text-arc-success text-sm font-sans flex items-center gap-1.5">
                  <Star className="w-4 h-4" /> Tip sent!
                </span>
              ) : (
                <button
                  onClick={() => setTipping(!tipping)}
                  className="btn-outline text-sm px-4 py-2"
                >
                  <Heart className="w-4 h-4" />
                  Tip
                </button>
              )}
              <Link to="/messages" className="btn-outline text-sm px-4 py-2">
                <MessageCircle className="w-4 h-4" />
                Message
              </Link>
              <button
                onClick={() => {
                  if (!isAuthenticated) return;
                  setSubscribed(!subscribed);
                }}
                className={subscribed ? 'btn-outline text-sm' : 'btn-gold text-sm'}
              >
                <Crown className="w-4 h-4" />
                {subscribed ? 'Subscribed' : `Subscribe · ${formatCurrency(creator.subscription_price)}/mo`}
              </button>
            </div>
          </div>

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
              <button onClick={handleTip} className="btn-gold text-sm">
                <Send className="w-4 h-4" />
                Send ${tipAmount} Tip
              </button>
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 p-5 card-surface rounded-xl mb-6">
          {[
            { label: 'Subscribers', value: formatCompactNumber(Number(creator.subscriber_count) || 0) },
            { label: 'Content Pieces', value: Number(creator.content_count) || 0 },
            { label: 'Starting Price', value: formatCurrency(creator.starting_price) },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="font-serif text-xl text-gold mb-0.5">{value}</div>
              <div className="text-xs text-arc-secondary">{label}</div>
            </div>
          ))}
        </div>

        {/* Custom request CTA */}
        <div className="flex items-center justify-between p-4 card-surface rounded-xl mb-8 gap-4">
          <div>
            <p className="text-sm text-white font-sans font-medium mb-0.5">Request Custom Content</p>
            <p className="text-xs text-arc-secondary">Send a private content request directly to {creator.display_name}.</p>
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
                  {(activeTab === 'posts' ? posts : drops).map((item) => {
                    console.log('[CreatorProfilePage] Clicked content:', item);
                    return <ContentCard key={item.id} content={item} showCreator={false} />;
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <Lock className="w-10 h-10 text-arc-muted mx-auto mb-3" />
                  <p className="text-arc-secondary">No content yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="max-w-2xl">
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
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="max-w-2xl space-y-4">
              {SAMPLE_REVIEWS.map((review) => (
                <div key={review.id} className="card-surface p-6 rounded-xl">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="text-sm font-sans font-medium text-white">{review.name}</p>
                      <div className="flex items-center gap-0.5 mt-1">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 text-gold fill-gold" />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-arc-muted">{review.date}</span>
                  </div>
                  <p className="text-sm text-arc-secondary leading-relaxed">{review.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
