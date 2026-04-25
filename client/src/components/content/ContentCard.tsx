import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Image, Video, Music, FileText, Eye } from 'lucide-react';
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

  return (
    <Link to={`/content/${content.id}`} className="group block" onClick={() => console.log('Clicked content:', content.id, content.title)}>
      <div className="card-surface overflow-hidden transition-all duration-300 group-hover:shadow-gold group-hover:-translate-y-0.5">
        {/* Preview image */}
        <div className="relative h-52 overflow-hidden bg-bg-hover">
          {content.preview_url && (
            <img
              src={content.preview_url}
              alt={isLocked ? '' : content.title}
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                isLocked ? 'locked-blur' : ''
              }`}
            />
          )}

          {/* Locked overlay */}
          {isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-primary/60 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center">
                <Lock className="w-5 h-5 text-gold" />
              </div>
              {content.access_type === 'locked' && content.price > 0 && (
                <span className="font-serif text-xl text-gold">{formatCurrency(content.price)}</span>
              )}
            </div>
          )}

          {/* Top row badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <Badge type={badgeType} />
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
              <Eye className="w-3.5 h-3.5" />
              <span>{formatCompactNumber(content.unlock_count ?? 0)} unlocks</span>
            </div>
            <span className="text-xs text-arc-muted">{timeAgo(content.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
