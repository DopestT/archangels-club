import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Users } from 'lucide-react';
import type { CreatorProfile } from '../../types';
import Avatar from '../ui/Avatar';
import { VerifiedBadge } from '../ui/Badge';
import { formatCurrency, formatCompactNumber } from '../../lib/utils';

interface CreatorCardProps {
  creator: CreatorProfile;
}

export default function CreatorCard({ creator }: CreatorCardProps) {
  return (
    <Link to={`/creator/${creator.username}`} className="group block">
      <div className="card-surface overflow-hidden transition-all duration-300 group-hover:shadow-gold group-hover:-translate-y-0.5">
        {/* Cover gradient */}
        <div className="h-28 relative overflow-hidden">
          {creator.cover_image_url ? (
            <img
              src={creator.cover_image_url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gold-subtle" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-surface" />
        </div>

        <div className="px-5 pb-5">
          {/* Avatar overlapping cover */}
          <div className="relative -mt-7 mb-3 flex items-end justify-between">
            <div className="relative">
              <Avatar
                src={creator.avatar_url}
                name={creator.display_name}
                size="lg"
                ring
              />
              {creator.is_verified_creator && (
                <VerifiedBadge className="absolute -bottom-0.5 -right-0.5 w-5 h-5" />
              )}
            </div>
            <span className="members-pill text-xs mb-1">
              <Lock className="w-3 h-3" />
              Private
            </span>
          </div>

          {/* Name */}
          <div className="mb-2">
            <h3 className="font-serif text-base text-white group-hover:text-gold transition-colors">
              {creator.display_name}
            </h3>
            <p className="text-xs text-arc-muted font-sans">@{creator.username}</p>
          </div>

          {/* Bio */}
          <p className="text-xs text-arc-secondary leading-relaxed mb-4 line-clamp-2">
            {creator.bio}
          </p>

          {/* Tags */}
          {creator.tags && creator.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {creator.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="tag-pill">{tag}</span>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <div className="flex items-center gap-1 text-xs text-arc-secondary">
              <Users className="w-3.5 h-3.5" />
              <span>{formatCompactNumber(creator.subscriber_count ?? 0)} members</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-arc-muted font-sans">From</span>
              <span className="text-sm font-serif text-gold">
                {formatCurrency(creator.starting_price)}<span className="text-xs text-arc-muted">/mo</span>
              </span>
            </div>
          </div>

          {/* Subscription */}
          <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-bg-hover border border-white/5">
            <span className="text-xs text-arc-secondary">Subscribe</span>
            <span className="text-sm font-serif text-gold">
              {formatCurrency(creator.subscription_price)}<span className="text-xs text-arc-muted font-sans">/mo</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
