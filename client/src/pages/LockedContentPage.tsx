import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Lock, Unlock, Image, Video, Music, FileText, Crown, ArrowLeft,
  Shield, CheckCircle, Star, X as XIcon, AlertCircle, Eye,
} from 'lucide-react';
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
  text:  <FileText className="w-5 h-5" />,
};

interface Content {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  content_type: string;
  access_type: string;
  price: number;
  subscriber_discount_pct: number;
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

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Unlock modal ──────────────────────────────────────────────────────────────

interface UnlockModalProps {
  content: Content;
  effectivePrice: number;
  subscriberPrice: number | null;
  isSubscribed: boolean;
  paying: boolean;
  error: string | null;
  onUnlock: () => void;
  onClose: () => void;
}

function UnlockModal({
  content, effectivePrice, subscriberPrice, isSubscribed,
  paying, error, onUnlock, onClose,
}: UnlockModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-bg-surface border border-gold-border/60 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-black/60">

        {/* Preview image */}
        <div className="relative h-44 overflow-hidden bg-bg-primary">
          {content.preview_url ? (
            <>
              <img
                src={content.preview_url}
                alt=""
                className="w-full h-full object-cover locked-blur"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-arc-muted">
              {TYPE_ICONS[content.content_type]}
            </div>
          )}

          {/* Premium Drop badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/20 border border-gold/50 backdrop-blur-sm">
            <Crown className="w-3 h-3 text-gold" />
            <span className="text-[10px] font-semibold text-gold uppercase tracking-wider">Premium Drop</span>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-6">
          {/* Title */}
          <h3 className="font-serif text-xl text-white mb-1 leading-snug">{content.title}</h3>

          {/* Unlock count + posted time */}
          <div className="flex items-center gap-2 text-xs text-arc-muted mb-4 flex-wrap">
            {content.unlock_count > 0 && (
              <span>🔥 {Number(content.unlock_count).toLocaleString()} people unlocked this</span>
            )}
            {content.unlock_count > 0 && timeAgo(content.created_at) && (
              <span className="text-arc-muted/40">·</span>
            )}
            {timeAgo(content.created_at) && (
              <span>Posted {timeAgo(content.created_at)}</span>
            )}
          </div>

          {/* Price block */}
          <div className="mb-5">
            <p className="text-3xl font-serif text-gold">{formatCurrency(effectivePrice)}</p>
            {/* Show subscriber discount as an incentive to non-subscribers */}
            {!isSubscribed && subscriberPrice != null && (
              <p className="text-xs text-arc-muted mt-1">
                Subscribers pay {formatCurrency(subscriberPrice)}
              </p>
            )}
            {/* Confirm subscriber discount is applied */}
            {isSubscribed && content.subscriber_discount_pct > 0 && (
              <p className="text-xs text-arc-success mt-1">
                Subscriber discount applied
              </p>
            )}
          </div>

          {/* Error — exact message from backend */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-arc-error/10 border border-arc-error/30 mb-4">
              <AlertCircle className="w-4 h-4 text-arc-error flex-shrink-0 mt-0.5" />
              <p className="text-sm text-arc-error leading-snug">{error}</p>
            </div>
          )}

          {/* Primary CTA */}
          <button
            onClick={onUnlock}
            disabled={paying}
            className="btn-gold w-full py-3.5 text-base gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {paying ? (
              <><Spinner /> Preparing checkout…</>
            ) : (
              <>🔓 Unlock Now</>
            )}
          </button>

          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={paying}
            className="w-full text-xs text-arc-muted hover:text-arc-secondary mt-3 py-2 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {/* Stripe note */}
          <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-white/5">
            <Shield className="w-3 h-3 text-arc-muted" />
            <p className="text-[10px] text-arc-muted">Instant access after payment · Secure checkout via Stripe</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LockedContentPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, token, isApproved, isAdmin } = useAuth();

  const [content,       setContent]       = useState<Content | null>(null);
  const [unlocked,      setUnlocked]      = useState(false);
  const [mediaUrl,      setMediaUrl]      = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [paying,        setPaying]        = useState(false);
  const [redirecting,   setRedirecting]   = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [isSubscribed,    setIsSubscribed]    = useState(false);
  const [discountedPrice, setDiscountedPrice] = useState<number | null>(null);
  const [isAdminPreview,  setIsAdminPreview]  = useState(false);
  const [isCreatorPreview, setIsCreatorPreview] = useState(false);
  const [showModal,       setShowModal]       = useState(false);
  const [moreContent,   setMoreContent]   = useState<GlobalContent[]>([]);

  const paymentSuccess  = searchParams.get('payment') === 'success';
  const alreadyUnlocked = searchParams.get('unlocked') === 'true';

  // Load content
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`${API_BASE}/api/content/${id}`)
      .then(r => r.json())
      .then(data => { if (!data.error) setContent(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Load more content from same creator
  useEffect(() => {
    if (!content?.creator_id) return;
    fetch(`${API_BASE}/api/content?creator_id=${encodeURIComponent(content.creator_id)}&exclude_id=${encodeURIComponent(content.id)}&limit=4`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMoreContent(data); })
      .catch(() => {});
  }, [content?.creator_id, content?.id]);

  // Check unlock status / subscriber discount once content + token known
  useEffect(() => {
    if (!content || !token || content.access_type === 'free') return;
    if (paymentSuccess || alreadyUnlocked) {
      fetchAccess();
      return;
    }
    fetch(`${API_BASE}/api/content/${id}/my-access`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.is_subscribed !== undefined) setIsSubscribed(!!data.is_subscribed);
        if (data.discounted_price != null) setDiscountedPrice(Number(data.discounted_price));
        if (data.is_admin_preview)   setIsAdminPreview(true);
        if (data.is_creator_preview) setIsCreatorPreview(true);
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
      .then(r => r.json())
      .then(data => {
        if (data.unlocked) {
          setUnlocked(true);
          setMediaUrl(data.media_url ?? null);
        } else if (retries > 0) {
          setTimeout(() => fetchAccess(retries - 1, delayMs), delayMs);
        } else {
          setError("Payment received — your access is being confirmed. Refresh in a moment if the content hasn't unlocked.");
        }
      })
      .catch(err => {
        if (retries > 0) setTimeout(() => fetchAccess(retries - 1, delayMs), delayMs);
        else setError(err instanceof Error ? err.message : String(err));
      });
  }

  function openModal() {
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(`/content/${id}`)}`);
      return;
    }
    setError(null);
    setShowModal(true);
  }

  async function handleUnlock() {
    if (!token) return;

    setPaying(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/checkout/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content_id: id, type: 'unlock' }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        setPaying(false);
        setError(`Server returned status ${res.status} with an unparseable response.`);
        return;
      }

      if (!res.ok) {
        setPaying(false);
        setError(data.error ?? `Server error (HTTP ${res.status})`);
        return;
      }

      if (data.already_unlocked) {
        setUnlocked(true);
        setPaying(false);
        setShowModal(false);
        return;
      }

      if (!data.url) {
        setPaying(false);
        setError('Checkout session created but no URL was returned. Please try again.');
        return;
      }

      setShowModal(false);
      setRedirecting(true);
      window.location.href = data.url;

    } catch (err) {
      setPaying(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center mb-6">
          <Lock className="w-7 h-7 text-gold" />
        </div>
        <h2 className="font-serif text-2xl text-white mb-2 text-center">Unlock to view this drop</h2>
        <p className="text-arc-secondary text-sm mb-1 text-center max-w-sm">
          This content is restricted to verified members. Request your invite to unlock exclusive drops.
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

  const isLocked      = content.access_type !== 'free' && !unlocked;
  const badgeType     = content.access_type === 'free' ? 'free' : content.access_type === 'subscribers' ? 'subscribers' : 'locked';
  const previewMode   = isAdminPreview ? 'Admin Preview Mode' : isCreatorPreview ? 'Creator Preview Mode' : null;
  const canPurchase   = isAuthenticated && (isApproved || isAdmin) && content.access_type === 'locked'
                        && !isAdminPreview && !isCreatorPreview;

  // Effective price this user pays (discounted if subscribed)
  const effectivePrice = discountedPrice ?? Number(content.price);

  // Subscriber price shown to non-subscribers as an incentive
  const subscriberPrice = (!isSubscribed && content.subscriber_discount_pct > 0)
    ? Math.round(Number(content.price) * (1 - content.subscriber_discount_pct / 100) * 100) / 100
    : null;

  return (
    <div className="min-h-screen bg-bg-primary py-12">

      {/* Unlock modal */}
      {showModal && (
        <UnlockModal
          content={content}
          effectivePrice={effectivePrice}
          subscriberPrice={subscriberPrice}
          isSubscribed={isSubscribed}
          paying={paying}
          error={error}
          onUnlock={handleUnlock}
          onClose={() => { if (!paying) setShowModal(false); }}
        />
      )}

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

        {/* Preview mode banner — admin / creator */}
        {previewMode && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6">
            <Eye className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-400">{previewMode}</p>
              <p className="text-xs text-amber-400/60 mt-0.5">
                {isAdminPreview
                  ? 'You are viewing this content as an administrator. Paywall is bypassed.'
                  : 'You are viewing your own content. Purchases are disabled.'}
              </p>
            </div>
          </div>
        )}

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
        <div
          className="relative rounded-2xl overflow-hidden mb-6 bg-bg-surface border border-gold-border/50"
          style={{ minHeight: '400px' }}
        >
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

          {/* Lock overlay — opens modal on click, no direct API call */}
          {isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-bg-primary/70 backdrop-blur-sm">
              <div className="w-20 h-20 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center shadow-gold">
                <Lock className="w-8 h-8 text-gold" />
              </div>
              <div className="text-center">
                <p className="font-serif text-2xl text-white mb-1">Locked Content</p>
                {content.access_type === 'locked' && content.price > 0 && (
                  <p className="text-3xl font-serif text-gold">{formatCurrency(effectivePrice)}</p>
                )}
                {content.access_type === 'subscribers' && (
                  <p className="text-sm text-arc-secondary">Subscribers only</p>
                )}
              </div>

              {canPurchase ? (
                <button
                  onClick={openModal}
                  className="btn-gold px-8 py-3.5 text-base gap-3"
                >
                  <Unlock className="w-4 h-4" />
                  Unlock for {formatCurrency(effectivePrice)}
                </button>
              ) : isAuthenticated ? (
                <p className="text-sm text-arc-secondary">Your account is pending approval.</p>
              ) : (
                <div className="text-center">
                  <Link to="/signup" className="btn-gold px-8 py-3.5 text-base mb-3 flex items-center gap-2 justify-center">
                    <Crown className="w-4 h-4" />
                    Request Access to Unlock
                  </Link>
                  <p className="text-xs text-arc-muted">
                    Members only ·{' '}
                    <Link to="/login" className="text-gold hover:underline">Already a member?</Link>
                  </p>
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
                  <span className="text-xs text-arc-muted">
                    {Number(content.unlock_count).toLocaleString()} unlocks
                  </span>
                )}
              </div>
              <h1 className="font-serif text-2xl text-white mb-2">{content.title}</h1>
              <p className="text-arc-secondary leading-relaxed text-sm">{content.description}</p>
              <p className="text-xs text-arc-muted mt-2">{timeAgo(content.created_at)}</p>
            </div>
            {content.access_type === 'locked' && content.price > 0 && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-arc-muted mb-0.5">Price</p>
                {discountedPrice != null ? (
                  <>
                    <p className="font-serif text-2xl text-gold">{formatCurrency(discountedPrice)}</p>
                    <p className="text-sm text-arc-muted line-through">{formatCurrency(content.price)}</p>
                  </>
                ) : (
                  <p className="font-serif text-2xl text-gold">{formatCurrency(content.price)}</p>
                )}
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

        {/* Subscription upsell */}
        {content.access_type === 'locked' && (content.creator_subscription_price ?? 0) > 0 && (
          <div className="mt-5 p-5 rounded-xl bg-gold-muted border border-gold-border flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold-border flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white mb-0.5">
                Subscribe to {content.creator_name}
              </p>
              <p className="text-xs text-arc-secondary mb-3">
                Get exclusive subscriber posts + discounts on locked drops for {formatCurrency(content.creator_subscription_price!)} / month — cancel anytime.
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
              <h2 className="font-serif text-lg text-white">More from {content.creator_name}</h2>
              <Link to={`/creator/${content.creator_username}`} className="text-xs text-gold hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {moreContent.map(item => (
                <ContentCard key={item.id} content={item} showCreator={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
