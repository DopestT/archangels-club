import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Lock, Unlock, Image, Video, Music, FileText, Crown, ArrowLeft, Shield, CheckCircle, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import ContentCard from '../components/content/ContentCard';
import type { Content as GlobalContent } from '../types';
import { formatCurrency, timeAgo } from '../lib/utils';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <Image className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
  audio: <Music className="w-5 h-5" />,
  text: <FileText className="w-5 h-5" />,
};

interface Content {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  content_type: string;
  access_type: string;
  price: number;
  status: string;
  preview_url: string | null;
  media_url: string | null;
  creator_name: string;
  creator_username: string;
  creator_avatar: string | null;
  creator_subscription_price?: number;
  unlock_count: number;
  created_at: string;
}

export default function LockedContentPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, token, isApproved, isAdmin } = useAuth();

  const [content, setContent] = useState<Content | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreContent, setMoreContent] = useState<GlobalContent[]>([]);

  const paymentSuccess = searchParams.get('payment') === 'success';
  const alreadyUnlocked = searchParams.get('unlocked') === 'true';

  useEffect(() => {
    if (!id) {
      setError('Invalid content ID');
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/content/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          console.error('Missing content:', id, '— server said:', data.error);
          setError(data.error);
          return;
        }
        setContent(data);
      })
      .catch((err) => {
        console.error('Fetch error for content', id, err);
        setError('Failed to load content');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch more content from same creator once content loads
  useEffect(() => {
    if (!content?.creator_id) return;
    fetch(`${API_BASE}/api/content?creator_id=${encodeURIComponent(content.creator_id)}&exclude_id=${encodeURIComponent(content.id)}&limit=4`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMoreContent(data); })
      .catch(() => {});
  }, [content?.creator_id, content?.id]);

  // Check unlock status once content + token are known
  useEffect(() => {
    if (!content || !token || content.access_type === 'free') return;
    if (paymentSuccess || alreadyUnlocked) {
      // Payment just completed — fetch media
      fetchAccess();
      return;
    }
    fetch(`${API_BASE}/api/content/${id}/my-access`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.unlocked) {
          setUnlocked(true);
          setMediaUrl(data.media_url ?? null);
        }
      })
      .catch(() => {});
  }, [content, token, paymentSuccess, alreadyUnlocked]);

  function fetchAccess(retries = 5, delayMs = 2000) {
    if (!token || !id) return;
    fetch(`${API_BASE}/api/content/${id}/my-access`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.unlocked) {
          setUnlocked(true);
          setMediaUrl(data.media_url ?? null);
        } else if (retries > 0) {
          // Webhook may not have fired yet — retry
          setTimeout(() => fetchAccess(retries - 1, delayMs), delayMs);
        }
      })
      .catch(() => {
        if (retries > 0) setTimeout(() => fetchAccess(retries - 1, delayMs), delayMs);
      });
  }

  async function handleUnlock() {
    if (!token) return;
    setPaying(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/payments/create-unlock-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content_id: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Payment failed. Please try again.');
        setPaying(false);
        return;
      }
      if (data.already_unlocked) {
        setUnlocked(true);
        setPaying(false);
        return;
      }
      setRedirecting(true);
      window.location.href = data.url;
    } catch {
      setError('Unable to reach checkout. Please check your connection and try again.');
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center mb-6">
          <Lock className="w-7 h-7 text-gold" />
        </div>
        <h2 className="font-serif text-2xl text-white mb-2 text-center">This drop is members-only</h2>
        <p className="text-arc-secondary text-sm mb-1 text-center max-w-sm">
          {error && !error.toLowerCase().includes('not found')
            ? error
            : 'This content is restricted to verified members. Request your invite to unlock exclusive drops.'}
        </p>
        <p className="text-xs text-arc-muted mb-8 text-center">All content on Archangels Club is age-verified and moderated.</p>
        <div className="flex items-center gap-3">
          <Link to="/signup" className="btn-gold text-sm px-6">
            <Crown className="w-4 h-4" />
            Request Invite
          </Link>
          <Link to="/explore" className="btn-outline text-sm px-6">Explore Creators</Link>
        </div>
      </div>
    );
  }

  const isLocked = content.access_type !== 'free' && !unlocked;
  const badgeType = content.access_type === 'free' ? 'free' : content.access_type === 'subscribers' ? 'subscribers' : 'locked';
  const canPurchase = isAuthenticated && (isApproved || isAdmin) && content.access_type === 'locked';

  return (
    <div className="min-h-screen bg-bg-primary py-12">
      {/* Checkout redirect overlay */}
      {redirecting && (
        <div className="fixed inset-0 z-50 bg-bg-primary/97 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-14 h-14 border-2 border-gold/30 border-t-gold rounded-full animate-spin mb-6" />
          <p className="font-serif text-2xl text-white mb-2">Redirecting to checkout</p>
          <p className="text-sm text-arc-muted max-w-xs text-center">
            Secure payment via Stripe. You'll be returned here automatically after payment.
          </p>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to={content.creator_username ? `/creator/${content.creator_username}` : '/explore'}
          className="inline-flex items-center gap-2 text-sm text-arc-secondary hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </Link>

        {/* Payment success banner */}
        {paymentSuccess && unlocked && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-arc-success/10 border border-arc-success/30 mb-6">
            <CheckCircle className="w-5 h-5 text-arc-success flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-arc-success">Payment successful — access unlocked</p>
              <p className="text-xs text-arc-secondary mt-0.5">You now have full access to this content.</p>
            </div>
          </div>
        )}

        {/* Media area */}
        <div className="relative rounded-2xl overflow-hidden mb-6 bg-bg-surface border border-gold-border/50" style={{ minHeight: '400px' }}>
          {content.preview_url && (
            <img
              src={content.preview_url}
              alt={isLocked ? '' : content.title}
              className={`w-full object-cover transition-all duration-700 ${isLocked ? 'locked-blur' : ''}`}
              style={{ maxHeight: '520px' }}
            />
          )}

          {!content.preview_url && !mediaUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-surface">
              <div className="text-arc-muted">{TYPE_ICONS[content.content_type]}</div>
            </div>
          )}

          {unlocked && mediaUrl && content.content_type === 'image' && (
            <img src={mediaUrl} alt={content.title} className="w-full object-cover" style={{ maxHeight: '520px' }} />
          )}

          {unlocked && mediaUrl && content.content_type === 'video' && (
            <video src={mediaUrl} controls className="w-full" style={{ maxHeight: '520px' }} />
          )}

          {isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-bg-primary/70 backdrop-blur-sm">
              <div className="w-20 h-20 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center shadow-gold">
                <Lock className="w-8 h-8 text-gold" />
              </div>
              <div className="text-center">
                <p className="font-serif text-2xl text-white mb-1">Locked Content</p>
                {content.access_type === 'locked' && content.price > 0 && (
                  <p className="text-3xl font-serif text-gold">{formatCurrency(content.price)}</p>
                )}
                {content.access_type === 'subscribers' && (
                  <p className="text-sm text-arc-secondary">Subscribers only</p>
                )}
              </div>

              {error && (
                <p className="text-sm text-arc-error bg-arc-error/10 border border-arc-error/30 px-4 py-2 rounded-lg">{error}</p>
              )}

              {canPurchase ? (
                <button
                  onClick={handleUnlock}
                  disabled={paying}
                  className="btn-gold px-8 py-3.5 text-base gap-3"
                >
                  {paying ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                  {paying ? 'Redirecting to checkout…' : content.access_type === 'locked'
                    ? `Unlock Access · ${formatCurrency(content.price)}`
                    : 'Subscribe to Unlock'}
                </button>
              ) : isAuthenticated ? (
                <p className="text-sm text-arc-secondary">Your account is pending approval.</p>
              ) : (
                <div className="text-center">
                  <Link to="/signup" className="btn-gold px-8 py-3.5 text-base mb-3 flex items-center gap-2 justify-center">
                    <Crown className="w-4 h-4" />
                    Request Access to Unlock
                  </Link>
                  <p className="text-xs text-arc-muted">Members only · <Link to="/login" className="text-gold hover:underline">Already a member?</Link></p>
                </div>
              )}
            </div>
          )}

          {unlocked && (
            <div className="absolute top-4 left-4">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-arc-success/15 border border-arc-success/30 text-xs text-arc-success font-sans">
                <Unlock className="w-3 h-3" />
                Unlocked
              </span>
            </div>
          )}

          <div className="absolute top-4 right-4">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-primary/70 backdrop-blur-sm text-xs text-arc-secondary font-sans">
              {TYPE_ICONS[content.content_type]}
              <span className="capitalize">{content.content_type}</span>
            </span>
          </div>
        </div>

        {/* Content info */}
        <div className="card-surface p-7 rounded-xl mb-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge type={badgeType} />
                {content.unlock_count > 0 && (
                  <span className="text-xs text-arc-muted">{Number(content.unlock_count).toLocaleString()} unlocks</span>
                )}
              </div>
              <h1 className="font-serif text-2xl text-white mb-2">{content.title}</h1>
              <p className="text-arc-secondary leading-relaxed text-sm">{content.description}</p>
              <p className="text-xs text-arc-muted mt-2">{timeAgo(content.created_at)}</p>
            </div>
            {content.access_type === 'locked' && content.price > 0 && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-arc-muted mb-0.5">Price</p>
                <p className="font-serif text-2xl text-gold">{formatCurrency(content.price)}</p>
              </div>
            )}
          </div>

          {content.creator_name && (
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <Link to={`/creator/${content.creator_username}`} className="flex items-center gap-3 group">
                <Avatar src={content.creator_avatar ?? undefined} name={content.creator_name} size="sm" ring />
                <div>
                  <p className="text-sm text-white group-hover:text-gold transition-colors">{content.creator_name}</p>
                  <p className="text-xs text-arc-muted">@{content.creator_username}</p>
                </div>
              </Link>
              <Link to={`/creator/${content.creator_username}`} className="btn-outline text-xs px-4 py-2">
                View Profile
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-bg-surface border border-white/5">
          <Shield className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-xs text-arc-muted leading-relaxed">
            This content is restricted to verified adult members (18+). All creators are age-verified.
            Content is moderated for platform compliance. By unlocking, you confirm you are 18 or older.
          </p>
        </div>

        {/* Subscription upsell — shown on paid pieces that have a subscription option */}
        {content.access_type === 'locked' && (content.creator_subscription_price ?? 0) > 0 && (
          <div className="mt-5 p-5 rounded-xl bg-gold-muted border border-gold-border flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold-border flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white mb-0.5">
                Subscribe to {content.creator_name} for full access
              </p>
              <p className="text-xs text-arc-secondary mb-3">
                Get unlimited access to all content for {formatCurrency(content.creator_subscription_price!)} / month — cancel anytime.
              </p>
              <Link
                to={`/creator/${content.creator_username}`}
                className="inline-flex items-center gap-2 btn-gold text-sm px-5 py-2.5"
              >
                <Crown className="w-4 h-4" />
                Subscribe · {formatCurrency(content.creator_subscription_price!)} / mo
              </Link>
            </div>
          </div>
        )}

        {/* More from this creator */}
        {moreContent.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-lg text-white">
                More from {content.creator_name}
              </h2>
              <Link
                to={`/creator/${content.creator_username}`}
                className="text-xs text-gold hover:underline"
              >
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {moreContent.map((item) => (
                <ContentCard key={item.id} content={item} showCreator={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
