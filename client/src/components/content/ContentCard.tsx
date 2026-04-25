import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Image, Video, Music, FileText, Eye, Zap, Users } from 'lucide-react';
import type { Content } from '../../types';
import Avatar from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatCompactNumber, timeAgo } from '../../lib/utils';

const TYPE_ICONS = {
  image: <Image className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  audio: <Music className="w-3.5 h-3.5" />,
  text: <FileText className="w-3.5 h-3.5" />,
};

interface ContentCardProps {
  content: Content;
  showCreator?: boolean;
}

export default function ContentCard({ content, showCreator = true }: ContentCardProps) {
  const isLocked = content.access_type === 'locked' || content.access_type === 'subscribers';
  const badgeType = content.access_type === 'free' ? 'free' : content.access_type === 'subscribers' ? 'subscribers' : 'locked';

  const spotsLeft = content.max_unlocks != null
    ? content.max_unlocks - (content.unlock_count ?? 0)
    : null;
  const isScarce = spotsLeft != null && spotsLeft > 0 && spotsLeft <= 10;

  return (
    <Link to={`/content/${content.id}`} className="group block">
      <div className="card-surface overflow-hidden transition-all duration-300 group-hover:shadow-gold group-hover:-translate-y-0.5">
        {/* Preview image */}
        <div className="relative h-52 overflow-hidden bg-bg-hover">
          {content.preview_url ? (
            <img
              src={content.preview_url}
              alt={isLocked ? '' : content.title}
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                isLocked ? 'locked-blur scale-110' : ''
              }`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-arc-muted">
              {TYPE_ICONS[content.content_type]}
            </div>
          )}

          {/* Locked overlay */}
          {isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-primary/65 backdrop-blur-[2px] transition-all duration-300">
              {/* Default state */}
              <div className="flex flex-col items-center gap-2 group-hover:opacity-0 transition-opacity duration-200">
                <div className="w-11 h-11 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center">
                  <Lock className="w-5 h-5 text-gold" />
                </div>
                <span className="text-[10px] font-sans text-arc-muted uppercase tracking-widest">Members Only</span>
                {content.access_type === 'locked' && content.price > 0 && (
                  <span className="font-serif text-2xl text-gold leading-none">{formatCurrency(content.price)}</span>
                )}
                {content.access_type === 'subscribers' && (
                  <span className="text-xs text-arc-secondary">Subscribers only</span>
                )}
              </div>

              {/* Hover CTA */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="w-12 h-12 rounded-full bg-gold flex items-center justify-center shadow-gold">
                  <Lock className="w-5 h-5 text-bg-primary" />
                </div>
                <span className="font-sans font-medium text-white text-sm">
                  {content.access_type === 'locked'
                    ? content.price > 0 ? `Unlock · ${formatCurrency(content.price)}` : 'Unlock Access'
                    : 'Subscribe to View'}
                </span>
                <span className="text-[10px] text-arc-muted">Tap to unlock exclusive content</span>
              </div>
            </div>
          )}

          {/* Price overlay on free content (hover) */}
          {!isLocked && content.price > 0 && (
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="font-serif text-sm text-gold bg-bg-primary/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-gold/20">
                {formatCurrency(content.price)}
              </span>
            </div>
          )}

          {/* Top row badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Badge type={badgeType} />
              {isScarce && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-arc-error/20 border border-arc-error/40 text-arc-error text-[10px] font-sans font-medium">
                  <Zap className="w-2.5 h-2.5" />
                  {spotsLeft} left
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-primary/70 backdrop-blur-sm text-xs text-arc-secondary">
              {TYPE_ICONS[content.content_type]}
              <span className="capitalize">{content.content_type}</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          {showCreator && content.creator_name && (
            <div className="flex items-center gap-2 mb-2.5">
              <Avatar src={content.creator_avatar} name={content.creator_name} size="xs" />
              <span className="text-xs text-arc-secondary hover:text-gold transition-colors">
                {content.creator_name}
              </span>
            </div>
          )}

          <h3 className="font-serif text-base text-white mb-1.5 line-clamp-1 group-hover:text-gold transition-colors">
            {content.title}
          </h3>

          <p className="text-xs text-arc-secondary leading-relaxed line-clamp-2 mb-3">
            {content.description}
          </p>

          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex items-center gap-1 text-xs text-arc-muted">
              <Users className="w-3.5 h-3.5" />
              <span>{formatCompactNumber(content.unlock_count ?? 0)} unlocks</span>
            </div>
            <span className="text-xs text-arc-muted">{timeAgo(content.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
