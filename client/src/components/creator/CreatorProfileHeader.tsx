import React from 'react';
import { Crown, MessageCircle, Heart } from 'lucide-react';
import type { CreatorProfile } from '../../types';
import Avatar from '../ui/Avatar';
import { VerifiedBadge, GoldVerifiedBadge } from '../ui/Badge';
import { formatCurrency, formatCompactNumber } from '../../lib/utils';

interface CreatorProfileHeaderProps {
  creator: CreatorProfile;
  isSubscribed?: boolean;
  onSubscribe?: () => void;
  onTip?: () => void;
  onRequest?: () => void;
  subscribeLoading?: boolean;
}

export default function CreatorProfileHeader({ creator, isSubscribed, onSubscribe, onTip, onRequest, subscribeLoading }: CreatorProfileHeaderProps) {
  return (
    <div className="relative">
      {/* Cover */}
      <div className="h-52 sm:h-64 relative overflow-hidden rounded-t-2xl">
        {creator.cover_image_url ? (
          <img src={creator.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gold-subtle" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-surface" />
      </div>

      {/* Info row */}
      <div className="px-5 sm:px-8 pb-6" style={{ background: '#141419' }}>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 mb-5">
          <div className="relative flex-shrink-0">
            <Avatar src={creator.avatar_url} name={creator.display_name} size="xl" ring />
            {creator.is_verified_creator && (
              <GoldVerifiedBadge className="absolute -bottom-1 -right-1 w-6 h-6" />
            )}
          </div>

          <div className="flex-1 min-w-0 sm:mb-1">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h1 className="font-serif text-2xl text-white">{creator.display_name}</h1>
              {creator.is_verified_creator && <VerifiedBadge />}
            </div>
            <p className="text-arc-muted text-sm">@{creator.username}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onRequest && (
              <button onClick={onRequest} className="btn-ghost text-sm px-3 py-2 border border-white/10 rounded-lg">
                <MessageCircle className="w-4 h-4" />
                Request
              </button>
            )}
            {onTip && (
              <button onClick={onTip} className="btn-ghost text-sm px-3 py-2 border border-white/10 rounded-lg">
                <Heart className="w-4 h-4" />
                Tip
              </button>
            )}
            {onSubscribe && (
              <button onClick={onSubscribe} disabled={subscribeLoading || isSubscribed} className="btn-gold text-sm">
                <Crown className="w-4 h-4" />
                {isSubscribed ? 'Subscribed' : `Subscribe · ${formatCurrency(creator.subscription_price)}/mo`}
              </button>
            )}
          </div>
        </div>

        {/* Bio */}
        {creator.bio && (
          <p className="text-sm text-arc-secondary leading-relaxed mb-4 max-w-2xl">{creator.bio}</p>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="font-serif text-xl text-white">{formatCompactNumber(creator.subscriber_count ?? 0)}</p>
            <p className="text-xs text-arc-muted">Members</p>
          </div>
          <div>
            <p className="font-serif text-xl text-white">{formatCompactNumber(creator.content_count ?? 0)}</p>
            <p className="text-xs text-arc-muted">Posts</p>
          </div>
          <div>
            <p className="font-serif text-xl text-gold">{formatCurrency(creator.starting_price)}<span className="text-xs text-arc-muted">/mo</span></p>
            <p className="text-xs text-arc-muted">Starting price</p>
          </div>
        </div>

        {/* Tags */}
        {creator.tags && creator.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {creator.tags.map((t) => <span key={t} className="tag-pill">{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
