import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Lock, Unlock, Image, Video, Music, FileText, Crown, ArrowLeft, Shield } from 'lucide-react';
import { sampleContent } from '../data/seed';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { formatCurrency } from '../lib/utils';

const TYPE_ICONS = {
  image: <Image className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
  audio: <Music className="w-5 h-5" />,
  text: <FileText className="w-5 h-5" />,
};

export default function LockedContentPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const content = sampleContent.find((c) => c.id === id);

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-2xl text-white mb-2">Content Not Found</h2>
          <Link to="/explore" className="btn-outline mt-4">Back to Explore</Link>
        </div>
      </div>
    );
  }

  const isLocked = content.access_type !== 'free' && !unlocked;
  const badgeType = content.access_type === 'free' ? 'free' : content.access_type === 'subscribers' ? 'subscribers' : 'locked';

  function handleUnlock() {
    if (!isAuthenticated) return;
    setLoading(true);
    setTimeout(() => {
      setUnlocked(true);
      setLoading(false);
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-bg-primary py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back */}
        <Link
          to={content.creator_username ? `/creator/${content.creator_username}` : '/explore'}
          className="inline-flex items-center gap-2 text-sm text-arc-secondary hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </Link>

        {/* Media preview / unlock zone */}
        <div className="relative rounded-2xl overflow-hidden mb-6 bg-bg-surface border border-gold-border/50"
          style={{ minHeight: '400px' }}
        >
          {content.preview_url && (
            <img
              src={content.preview_url}
              alt={isLocked ? '' : content.title}
              className={`w-full object-cover transition-all duration-700 ${
                isLocked ? 'locked-blur' : ''
              }`}
              style={{ maxHeight: '520px' }}
            />
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

              {isAuthenticated ? (
                <button
                  onClick={handleUnlock}
                  disabled={loading}
                  className="btn-gold px-8 py-3.5 text-base gap-3"
                >
                  {loading ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                  {loading ? 'Unlocking…' : content.access_type === 'locked'
                    ? `Unlock Access · ${formatCurrency(content.price)}`
                    : 'Subscribe to Unlock'}
                </button>
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

          {/* Content type pill */}
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
                {content.unlock_count && (
                  <span className="text-xs text-arc-muted">{content.unlock_count.toLocaleString()} unlocks</span>
                )}
              </div>
              <h1 className="font-serif text-2xl text-white mb-2">{content.title}</h1>
              <p className="text-arc-secondary leading-relaxed text-sm">{content.description}</p>
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
              <Link
                to={`/creator/${content.creator_username}`}
                className="flex items-center gap-3 group"
              >
                <Avatar src={content.creator_avatar} name={content.creator_name} size="sm" ring />
                <div>
                  <p className="text-sm text-white group-hover:text-gold transition-colors">
                    {content.creator_name}
                  </p>
                  <p className="text-xs text-arc-muted">@{content.creator_username}</p>
                </div>
              </Link>
              <Link to={`/creator/${content.creator_username}`} className="btn-outline text-xs px-4 py-2">
                View Profile
              </Link>
            </div>
          )}
        </div>

        {/* Age verification / compliance note */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-bg-surface border border-white/5">
          <Shield className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-xs text-arc-muted leading-relaxed">
            This content is restricted to verified adult members (18+). All creators are age-verified.
            Content is moderated for platform compliance. By unlocking, you confirm you are 18 or older.
          </p>
        </div>
      </div>
    </div>
  );
}
