import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Image, Video, Music, FileText, Eye, Zap, Users, Flame, Sparkles, Bookmark } from 'lucide-react';
import type { Content } from '../../types';
import Avatar from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatCompactNumber, timeAgo } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useSaved } from '../../context/SavedContext';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <Image className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  audio: <Music className="w-3.5 h-3.5" />,
  text:  <FileText className="w-3.5 h-3.5" />,
};

function seededViewers(id: string): number {
  const n = id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return 5 + (n % 16);
}

interface ContentCardProps {
  content: Content;
  showCreator?: boolean;
}

export default function ContentCard({ content, showCreator = true }: ContentCardProps) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isAuthenticated } = useAuth();
  const { isSaved, save, unsave } = useSaved();

  const saved = isSaved(content.id);

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) return;
    if (saved) {
      await unsave(content.id);
    } else {
      await save(content.id);
    }
  }

  const isLocked = content.access_type === 'locked' || content.access_type === 'subscribers';
  const badgeType = content.access_type === 'free' ? 'free' : content.access_type === 'subscribers' ? 'subscribers' : 'locked';
  const unlockCount = Number(content.unlock_count ?? 0);

  const spotsLeft = content.max_unlocks != null ? content.max_unlocks - unlockCount : null;
  const isAlmostGone = spotsLeft != null && spotsLeft > 0 && spotsLeft <= 10;
  const isTrending = !isAlmostGone && (unlockCount > 5 || (content.score ?? 0) >= 20);
  const isNew = Date.now() - new Date(content.created_at).getTime() < 86_400_000;
  const viewers = seededViewers(content.id);

  // Blur: heavy at rest, reduced on hover to tease the preview
  const imgBlur = isLocked ? (hovered ? 4 : 13) : 0;

  function onMouseEnter() {
    setHovered(true);
    if (videoRef.current && content.media_url) {
      videoRef.current.play().catch(() => {});
      timerRef.current = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }, 5000);
    }
  }

  function onMouseLeave() {
    setHovered(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  return (
    <Link
      to={`/content/${content.id}`}
      className="group block"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="card-surface overflow-hidden transition-all duration-300 group-hover:shadow-gold group-hover:-translate-y-0.5">

        {/* ── Media area ─────────────────────────────────────────────────── */}
        <div className="relative h-52 overflow-hidden bg-bg-hover">

          {/* Preview image */}
          {content.preview_url ? (
            <img
              src={content.preview_url}
              alt={isLocked ? '' : content.title}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: imgBlur > 0 ? `blur(${imgBlur}px) brightness(0.85)` : undefined,
                transform: hovered ? 'scale(1.06)' : isLocked ? 'scale(1.04)' : 'scale(1)',
                transition: 'filter 0.5s ease, transform 0.6s ease',
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-arc-muted">
              {TYPE_ICONS[content.content_type]}
            </div>
          )}

          {/* Video preview — plays on hover, blurred if locked */}
          {content.content_type === 'video' && content.media_url && (
            <video
              ref={videoRef}
              src={content.media_url}
              muted
              loop
              playsInline
              preload="none"
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: imgBlur > 0 ? `blur(${imgBlur}px)` : undefined,
                opacity: hovered ? 1 : 0,
                transition: 'filter 0.5s ease, opacity 0.4s ease',
              }}
            />
          )}

          {/* ── Locked overlay ─────────────────────────────────────────────── */}
          {isLocked && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{
                background: hovered
                  ? 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)'
                  : 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.3) 100%)',
                transition: 'background 0.5s ease',
              }}
            >
              {/* Default: lock icon + price */}
              <div
                className="flex flex-col items-center gap-2"
                style={{ opacity: hovered ? 0 : 1, transition: 'opacity 0.25s ease' }}
              >
                <div className="w-10 h-10 rounded-full bg-gold-muted border border-gold-border flex items-center justify-center">
                  <Lock className="w-4.5 h-4.5 text-gold" />
                </div>
                <span className="text-[10px] font-sans text-arc-muted uppercase tracking-widest">Members Only</span>
                {content.access_type === 'locked' && content.price > 0 && (
                  <span className="font-serif text-2xl text-gold leading-none">{formatCurrency(content.price)}</span>
                )}
              </div>

              {/* Hover: strong CTA */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.25s ease' }}
              >
                <div
                  className="w-12 h-12 rounded-full bg-gold flex items-center justify-center"
                  style={{ boxShadow: '0 0 24px rgba(212,175,55,0.5)' }}
                >
                  <Lock className="w-5 h-5 text-bg-primary" />
                </div>
                <span
                  className="font-sans font-semibold text-bg-primary bg-gold rounded-full text-sm tracking-wide"
                  style={{ padding: '9px 20px', boxShadow: '0 0 16px rgba(212,175,55,0.35)' }}
                >
                  {content.access_type === 'locked'
                    ? content.price > 0
                      ? `Unlock for ${formatCurrency(content.price)}`
                      : 'Unlock Access'
                    : 'Subscribe to View'}
                </span>
                <span className="text-[10px] text-white/50">Instant access · No commitment</span>
              </div>
            </div>
          )}

          {/* Price overlay on free content (hover) */}
          {!isLocked && content.price > 0 && (
            <div
              className="absolute bottom-3 right-3"
              style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.2s ease' }}
            >
              <span className="font-serif text-sm text-gold bg-bg-primary/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-gold/20">
                {formatCurrency(content.price)}
              </span>
            </div>
          )}

          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge type={badgeType} />
              {isAlmostGone && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-arc-error/20 border border-arc-error/40 text-arc-error text-[10px] font-medium">
                  <Zap className="w-2.5 h-2.5" />
                  Almost Gone · {spotsLeft} left
                </span>
              )}
              {isTrending && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-[10px] font-medium">
                  <Flame className="w-2.5 h-2.5" />
                  Trending
                </span>
              )}
              {isNew && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-medium">
                  <Sparkles className="w-2.5 h-2.5" />
                  New
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-primary/70 backdrop-blur-sm text-xs text-arc-secondary flex-shrink-0">
              {TYPE_ICONS[content.content_type]}
              <span className="capitalize">{content.content_type}</span>
            </div>
          </div>
        </div>

        {/* ── Info ────────────────────────────────────────────────────────── */}
        <div className="p-4">
          {showCreator && content.creator_name && (
            <div className="flex items-center gap-2 mb-2.5">
              <Avatar src={content.creator_avatar} name={content.creator_name} size="xs" />
              <span className="text-xs text-arc-secondary group-hover:text-gold transition-colors">
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
            <div className="flex items-center gap-3 text-xs text-arc-muted">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {formatCompactNumber(unlockCount)} unlocks
              </span>
              <span className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                </span>
                <Eye className="w-3 h-3" />
                {viewers}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-arc-muted">{timeAgo(content.created_at)}</span>
              {isAuthenticated && (
                <button
                  onClick={toggleSave}
                  title={saved ? 'Unsave' : 'Save'}
                  className={`p-1 rounded transition-colors ${saved ? 'text-gold' : 'text-arc-muted hover:text-arc-secondary'}`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-current' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
