import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Zap, Image, Video, Music, FileText, Play, Flame, Sparkles, Eye } from 'lucide-react';
import type { Content } from '../../types';
import Avatar from '../ui/Avatar';
import { formatCurrency, formatCompactNumber } from '../../lib/utils';

interface FeedCardProps {
  content: Content;
}

// Stable pseudo-random viewer count seeded from content id — won't flicker between renders
function seededViewers(id: string): number {
  const n = id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return 5 + (n % 16); // 5–20
}

export default function FeedCard({ content }: FeedCardProps) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLocked = content.access_type !== 'free';
  const unlockCount = Number(content.unlock_count ?? 0);

  const spotsLeft = content.max_unlocks != null
    ? content.max_unlocks - unlockCount
    : null;
  const isAlmostGone = spotsLeft != null && spotsLeft > 0 && spotsLeft <= 10;
  const isTrending = !isAlmostGone && (unlockCount >= 5 || (content.score ?? 0) >= 20);
  const isNew = !isAlmostGone && (Date.now() - new Date(content.created_at).getTime() < 86_400_000);
  const viewers = seededViewers(content.id);

  function onMouseEnter() {
    setHovered(true);
    if (videoRef.current && content.media_url && !isLocked) {
      videoRef.current.play().catch(() => {});
      videoTimerRef.current = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }, 3000);
    }
  }

  function onMouseLeave() {
    setHovered(false);
    if (videoTimerRef.current) clearTimeout(videoTimerRef.current);
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
      <div
        className="relative rounded-2xl overflow-hidden bg-bg-surface aspect-[3/4] border border-white/5 transition-all duration-300 group-hover:border-gold/30 group-hover:scale-[1.02]"
        style={{ boxShadow: hovered ? '0 0 32px rgba(212,175,55,0.2)' : undefined }}
      >

        {/* Background preview image */}
        {content.preview_url ? (
          <img
            src={content.preview_url}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${isLocked ? 'locked-blur scale-105' : ''}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-bg-surface to-bg-hover">
            <div className="text-arc-muted opacity-20 scale-150">
              {content.content_type === 'video' ? <Video className="w-8 h-8" /> :
               content.content_type === 'audio' ? <Music className="w-8 h-8" /> :
               content.content_type === 'text' ? <FileText className="w-8 h-8" /> :
               <Image className="w-8 h-8" />}
            </div>
          </div>
        )}

        {/* Video preview on hover (non-locked) */}
        {content.content_type === 'video' && content.media_url && !isLocked && (
          <video
            ref={videoRef}
            src={content.media_url}
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          />
        )}

        {/* Dark gradient — keeps bottom text readable at all times */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />

        {/* Hover CTA */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-all duration-300"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          <div
            className="flex flex-col items-center gap-2.5 transition-transform duration-300"
            style={{ transform: hovered ? 'translateY(0)' : 'translateY(10px)' }}
          >
            <div className="w-14 h-14 rounded-full bg-gold flex items-center justify-center" style={{ boxShadow: '0 0 24px rgba(212,175,55,0.5)' }}>
              <Lock className="w-6 h-6 text-bg-primary" />
            </div>
            <span className="font-sans font-semibold text-sm text-bg-primary bg-gold rounded-full px-5 py-2.5 tracking-wide" style={{ boxShadow: '0 0 16px rgba(212,175,55,0.4)' }}>
              {isLocked
                ? content.price > 0 ? `Unlock · ${formatCurrency(content.price)}` : 'Unlock Access'
                : 'View Content'}
            </span>
          </div>
        </div>

        {/* Top-left badges — can stack up to 2 */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-10">
          <div className="flex flex-col gap-1">
            {isAlmostGone && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-arc-error text-white text-[10px] font-bold w-fit">
                <Zap className="w-2.5 h-2.5" />
                Almost Gone · {spotsLeft} left
              </span>
            )}
            {isNew && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold w-fit">
                <Sparkles className="w-2.5 h-2.5" />
                New
              </span>
            )}
            {isTrending && !isNew && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/90 text-white text-[10px] font-bold w-fit">
                <Flame className="w-2.5 h-2.5" />
                Trending
              </span>
            )}
            {isTrending && isNew && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/90 text-white text-[10px] font-bold w-fit">
                <Flame className="w-2.5 h-2.5" />
                Trending
              </span>
            )}
            {!isAlmostGone && !isTrending && !isNew && isLocked && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-gold text-[10px] border border-gold/30 w-fit">
                <Lock className="w-2.5 h-2.5" />
                {content.access_type === 'subscribers' ? 'Subscribers Only' : 'Locked Drop'}
              </span>
            )}
          </div>

          {/* Content type badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-arc-muted text-[10px]">
            {content.content_type === 'video' && <><Video className="w-2.5 h-2.5" /><span>Video</span></>}
            {content.content_type === 'audio' && <><Music className="w-2.5 h-2.5" /><span>Audio</span></>}
            {content.content_type === 'text' && <><FileText className="w-2.5 h-2.5" /><span>Text</span></>}
            {content.content_type === 'image' && <><Image className="w-2.5 h-2.5" /><span>Photo</span></>}
          </div>
        </div>

        {/* Video play indicator */}
        {content.content_type === 'video' && !isLocked && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center transition-opacity duration-300 group-hover:opacity-0">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          {/* Social proof + live viewers */}
          <div className="flex items-center justify-between mb-2.5">
            {unlockCount > 0 ? (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {Array.from({ length: Math.min(3, Math.ceil(unlockCount / 10) + 1) }).map((_, i) => (
                    <div key={i} className="w-4 h-4 rounded-full border border-gold/50" style={{ background: `hsl(${45 + i * 15}, 60%, 40%)` }} />
                  ))}
                </div>
                <span className="text-[11px] text-white/60">
                  <span className="text-white font-medium">{formatCompactNumber(unlockCount)}</span>
                  {' '}unlocked
                </span>
              </div>
            ) : <div />}

            {/* Live viewer count */}
            <div className="flex items-center gap-1 text-[10px] text-white/50">
              <span className="relative flex h-1.5 w-1.5 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
              </span>
              <Eye className="w-2.5 h-2.5" />
              <span>{viewers}</span>
            </div>
          </div>

          {/* Creator */}
          {content.creator_name && (
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar src={content.creator_avatar} name={content.creator_name} size="xs" />
              <span className="text-xs text-white/70">{content.creator_name}</span>
            </div>
          )}

          {/* Title */}
          <h3 className="font-serif text-sm text-white leading-snug line-clamp-2 mb-3 transition-colors duration-200 group-hover:text-gold">
            {content.title}
          </h3>

          {/* Price + CTA */}
          <div className="flex items-center justify-between gap-2">
            {content.access_type === 'locked' && content.price > 0 ? (
              <span className="font-serif text-xl text-gold leading-none">{formatCurrency(content.price)}</span>
            ) : content.access_type === 'subscribers' ? (
              <span className="text-xs text-arc-muted italic">Subscribers only</span>
            ) : (
              <span className="text-xs font-medium text-green-400">Free</span>
            )}

            <span className="flex-none text-[11px] font-semibold text-gold border border-gold/40 rounded-full px-3 py-1.5 bg-gold/10 backdrop-blur-sm transition-all duration-200 group-hover:bg-gold group-hover:text-bg-primary group-hover:border-gold">
              {isLocked ? 'Unlock →' : 'View →'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
