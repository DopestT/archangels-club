import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Lock, Star, Radio, ChevronUp, ChevronDown } from 'lucide-react';
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

  function scrollToIdx(idx: number) {
    containerRef.current?.scrollTo({ top: idx * window.innerHeight, behavior: 'smooth' });
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4 text-white">
        <button
          onClick={() => navigate('/live')}
          className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <Radio size={40} className="text-zinc-600" />
        <p className="text-zinc-400 text-sm">No live rooms available to you right now.</p>
        <p className="text-xs text-zinc-600">Subscribe to creators to unlock their private rooms.</p>
        <button
          onClick={() => navigate('/explore')}
          className="mt-2 px-5 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold transition-colors"
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
        className="fixed top-4 left-4 z-[60] p-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white hover:bg-black/80 transition-colors"
      >
        <ArrowLeft size={20} />
      </button>

      {/* Counter */}
      <div className="fixed top-4 right-4 z-[60] text-xs text-white/60 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10 tabular-nums">
        {currentIdx + 1} / {rooms.length}
      </div>

      {/* Prev */}
      {currentIdx > 0 && (
        <button
          onClick={() => scrollToIdx(currentIdx - 1)}
          className="fixed z-[60] p-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors"
          style={{ top: '50%', right: '1rem', transform: 'translateY(-3.5rem)' }}
        >
          <ChevronUp size={20} />
        </button>
      )}

      {/* Next */}
      {currentIdx < rooms.length - 1 && (
        <button
          onClick={() => scrollToIdx(currentIdx + 1)}
          className="fixed z-[60] p-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors"
          style={{ top: '50%', right: '1rem', transform: 'translateY(0.5rem)' }}
        >
          <ChevronDown size={20} />
        </button>
      )}

      {/* Swipe hint */}
      {rooms.length > 1 && currentIdx === 0 && (
        <div
          className="fixed bottom-28 inset-x-0 z-[60] flex justify-center pointer-events-none"
          style={{ animation: 'swipeHint 2.4s ease-in-out 1.2s 2 forwards' }}
        >
          <div className="flex flex-col items-center gap-1 text-white/40">
            <ChevronDown size={16} className="rotate-180" />
            <span className="text-xs tracking-wide">Swipe up</span>
          </div>
        </div>
      )}

      {/* Slides */}
      {rooms.map((room, i) => (
        <RoomSlide key={room.id} room={room} isActive={i === currentIdx} />
      ))}

      <style>{`
        @keyframes swipeHint {
          0%, 100% { opacity: 0; transform: translateY(0); }
          20%, 80% { opacity: 1; }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

function RoomSlide({ room, isActive }: { room: LiveRoom; isActive: boolean }) {
  const navigate = useNavigate();

  return (
    <div
      className="relative flex flex-col"
      style={{
        height: '100dvh',
        scrollSnapAlign: 'start',
        scrollSnapStop: 'always',
      } as React.CSSProperties}
    >
      {/* Background — blurred creator avatar or dark gradient */}
      {room.creator_avatar ? (
        <img
          src={room.creator_avatar}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(28px) brightness(0.3)', transform: 'scale(1.12)' }}
          aria-hidden
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #1c1514 0%, #0d0d0d 60%, #1a1208 100%)' }}
        />
      )}

      {/* Gradient vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/95" />

      {/* LIVE badge */}
      {room.status === 'live' && (
        <div className="absolute top-14 left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
          LIVE
        </div>
      )}

      {/* Bottom info panel */}
      <div className="relative z-10 mt-auto px-5 pb-8 space-y-4">
        {/* Creator row */}
        <div className="flex items-center gap-3">
          {room.creator_avatar ? (
            <img
              src={room.creator_avatar}
              alt={room.creator_name}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-yellow-500/60 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-yellow-700/40 flex items-center justify-center text-yellow-400 font-bold text-base ring-2 ring-yellow-500/60 shrink-0">
              {room.creator_name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{room.creator_name}</p>
            <p className="text-zinc-400 text-xs truncate">@{room.creator_username}</p>
          </div>
          {room.peak_viewer_count > 0 && (
            <div className="ml-auto flex items-center gap-1 text-xs text-zinc-400 shrink-0">
              <Users size={12} />
              <span>{room.peak_viewer_count}</span>
            </div>
          )}
        </div>

        {/* Title + description */}
        <div>
          <h2 className="text-white text-xl font-bold leading-snug line-clamp-2">{room.title}</h2>
          {room.description && (
            <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{room.description}</p>
          )}
        </div>

        {/* Access chip */}
        <AccessChip type={room.access_type} priceCents={room.price_cents} />

        {/* CTA */}
        <button
          onClick={() => navigate(`/live/${room.id}`)}
          className="w-full py-3.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black font-bold text-sm transition-colors"
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
      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800/40">
        <Lock size={11} />
        Ticket{price}
      </span>
    );
  }
  if (type === 'subscribers') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-purple-900/40 text-purple-300 border border-purple-800/40">
        <Star size={11} />
        Subscribers Only
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/40">
      Free
    </span>
  );
}
