import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Lock, Star, Radio, Heart, Share2, ChevronUp } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { LiveRoom } from '../components/live/LiveRoomCard';

export default function LiveSwipeFeed() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    document.title = 'Live Now — Archangels Club';
    apiFetch('/api/live/eligible')
      .then(d => setRooms(d as LiveRoom[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || rooms.length === 0) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollTop / window.innerHeight);
      setCurrentIdx(Math.max(0, Math.min(idx, rooms.length - 1)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [rooms.length]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
        <p className="text-arc-muted text-[10px] tracking-[0.18em] uppercase">Loading rooms</p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-5 text-white px-6">
        <button
          onClick={() => navigate('/live')}
          className="absolute top-4 left-4 p-2.5 rounded-full bg-white/8 backdrop-blur-sm border border-white/10 hover:bg-white/15 transition-all arc-pressable"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-16 h-16 rounded-3xl bg-white/[0.04] border border-white/8 flex items-center justify-center">
          <Radio size={28} className="text-arc-muted" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold mb-1.5">No live rooms right now</p>
          <p className="text-arc-muted text-sm max-w-xs">Subscribe to creators to unlock their private rooms</p>
        </div>
        <button
          onClick={() => navigate('/explore')}
          className="btn-gold mt-1"
        >
          Explore Creators
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black overflow-y-scroll"
      style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {/* Back */}
      <button
        onClick={() => navigate('/live')}
        className="fixed top-4 left-4 z-[60] p-2.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-black/70 transition-all arc-pressable"
      >
        <ArrowLeft size={18} />
      </button>

      {/* Room counter */}
      <div className="fixed top-4 right-4 z-[60] text-[10px] text-white/50 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/8 tabular-nums tracking-wide">
        {currentIdx + 1} · {rooms.length}
      </div>

      {/* Swipe hint — shows briefly on first slide */}
      {rooms.length > 1 && currentIdx === 0 && (
        <div
          className="fixed bottom-36 inset-x-0 z-[60] flex justify-center pointer-events-none"
          style={{ animation: 'swipeHint 2.8s ease-in-out 1.2s 2 forwards', opacity: 0 }}
        >
          <div className="flex flex-col items-center gap-1.5 text-white/40">
            <ChevronUp size={14} style={{ animation: 'swipeHintBob 1s ease-in-out 1.5s 4 forwards' }} />
            <span className="text-[9px] tracking-[0.2em] uppercase">Swipe up</span>
          </div>
        </div>
      )}

      {/* Slides */}
      {rooms.map((room, i) => (
        <RoomSlide key={room.id} room={room} isActive={i === currentIdx} />
      ))}

      <style>{`
        @keyframes swipeHint {
          0%, 100% { opacity: 0; }
          20%, 80%  { opacity: 1; }
        }
        @keyframes swipeHintBob {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}

function RoomSlide({ room, isActive }: { room: LiveRoom; isActive: boolean }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);

  const infoStyle: React.CSSProperties = isActive
    ? { animation: 'liveInfoReveal 500ms cubic-bezier(0.22,1,0.36,1) 40ms both' }
    : { opacity: 0, transform: 'translateY(24px)' };

  const actionsStyle: React.CSSProperties = isActive
    ? { animation: 'liveActionReveal 480ms cubic-bezier(0.22,1,0.36,1) 180ms both' }
    : { opacity: 0, transform: 'translateX(16px)' };

  return (
    <div
      className="relative flex flex-col"
      style={{ height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always' } as React.CSSProperties}
    >
      {/* Blurred background */}
      {room.creator_avatar ? (
        <img
          src={room.creator_avatar}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(30px) brightness(0.22) saturate(1.3)', transform: 'scale(1.15)' }}
          aria-hidden
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 25% 35%, #1e1108 0%, #0d0d10 55%, #06060a 100%)' }}
        />
      )}

      {/* Gradient vignettes */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/45" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 115%, rgba(0,0,0,0.75) 0%, transparent 58%)' }}
      />

      {/* LIVE badge */}
      {room.status === 'live' && (
        <div
          className="absolute left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/90 backdrop-blur-sm text-white text-[10px] font-black"
          style={{ top: '5rem', letterSpacing: '0.14em' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-white"
            style={{ animation: 'pulseSignalDot 1.5s ease-in-out infinite' }}
          />
          LIVE
        </div>
      )}

      {/* Right-side TikTok-style action column */}
      <div
        className="absolute right-4 z-10 flex flex-col items-center gap-4"
        style={{ bottom: '9.5rem', ...actionsStyle }}
      >
        {/* Creator avatar with + badge */}
        <div className="relative mb-1">
          {room.creator_avatar ? (
            <img
              src={room.creator_avatar}
              alt={room.creator_name}
              className="w-12 h-12 rounded-full object-cover"
              style={{ boxShadow: '0 0 0 2.5px rgba(212,175,55,0.55), 0 0 18px rgba(212,175,55,0.18)' }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center text-gold font-bold text-base"
              style={{ boxShadow: '0 0 18px rgba(212,175,55,0.15)' }}
            >
              {room.creator_name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gold flex items-center justify-center shadow-gold-sm">
            <span className="text-[10px] font-black text-bg-primary leading-none">+</span>
          </div>
        </div>

        {/* Like */}
        <button
          onClick={() => setLiked(v => !v)}
          className="flex flex-col items-center gap-1.5 arc-pressable"
        >
          <div
            className="w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-all duration-200"
            style={{
              background: liked ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.38)',
              borderColor: liked ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.12)',
              boxShadow: liked ? '0 0 18px rgba(239,68,68,0.3)' : undefined,
            }}
          >
            <Heart
              className="w-5 h-5 transition-all duration-200"
              fill={liked ? '#f87171' : 'none'}
              color={liked ? '#f87171' : 'white'}
            />
          </div>
          <span className="text-white/55 text-[10px]">{liked ? 'Liked' : 'Like'}</span>
        </button>

        {/* Viewers */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-12 h-12 rounded-full bg-black/38 backdrop-blur-md border border-white/12 flex items-center justify-center">
            <Users className="w-5 h-5 text-white/80" />
          </div>
          <span className="text-white/55 text-[10px] tabular-nums">
            {room.peak_viewer_count > 0 ? room.peak_viewer_count.toLocaleString() : '—'}
          </span>
        </div>

        {/* Share */}
        <button className="flex flex-col items-center gap-1.5 arc-pressable">
          <div className="w-12 h-12 rounded-full bg-black/38 backdrop-blur-md border border-white/12 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white/80" />
          </div>
          <span className="text-white/55 text-[10px]">Share</span>
        </button>
      </div>

      {/* Bottom info panel */}
      <div
        className="relative z-10 mt-auto px-5 space-y-3"
        style={{
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
          ...infoStyle,
        }}
      >
        {/* Creator row */}
        <div className="flex items-center gap-3">
          {room.creator_avatar ? (
            <img
              src={room.creator_avatar}
              alt={room.creator_name}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-gold/50 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold font-bold text-sm ring-2 ring-gold/30 shrink-0">
              {room.creator_name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm leading-tight truncate">{room.creator_name}</p>
            <p className="text-white/45 text-xs truncate">@{room.creator_username}</p>
          </div>
          <button className="shrink-0 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/12 text-white text-xs font-semibold hover:bg-white/18 transition-all arc-pressable">
            Follow
          </button>
        </div>

        {/* Title + description */}
        <div>
          <h2 className="text-white text-[1.1rem] font-bold leading-snug line-clamp-2">{room.title}</h2>
          {room.description && (
            <p className="text-white/45 text-sm mt-1 line-clamp-2">{room.description}</p>
          )}
        </div>

        {/* Access chip */}
        <AccessChip type={room.access_type} priceCents={room.price_cents} />

        {/* CTA */}
        <button
          onClick={() => navigate(`/live/${room.id}`)}
          className="w-full py-3.5 rounded-2xl bg-gold hover:bg-gold-hover active:scale-[0.98] text-bg-primary font-bold text-[0.9rem] transition-all shadow-gold"
          tabIndex={isActive ? 0 : -1}
        >
          Enter Room
        </button>
      </div>
    </div>
  );
}

function AccessChip({ type, priceCents }: { type: LiveRoom['access_type']; priceCents: number | null }) {
  if (type === 'paid') {
    const price = priceCents ? ` · $${(priceCents / 100).toFixed(2)}` : '';
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gold/12 text-gold border border-gold/25 font-medium">
        <Lock size={10} />
        Ticket{price}
      </span>
    );
  }
  if (type === 'subscribers') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-purple-500/12 text-purple-300 border border-purple-400/20 font-medium">
        <Star size={10} />
        Subscribers Only
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-arc-success/12 text-arc-success border border-arc-success/20 font-medium">
      Free to Join
    </span>
  );
}
