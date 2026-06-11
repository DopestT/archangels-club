import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Lock, Star } from 'lucide-react';

export interface LiveRoom {
  id: string;
  title: string;
  description: string | null;
  creator_name: string;
  creator_username: string;
  creator_avatar: string | null;
  access_type: 'free' | 'subscribers' | 'paid';
  price_cents: number | null;
  status: 'idle' | 'live' | 'ended';
  peak_viewer_count: number;
  started_at: string | null;
}

interface Props {
  room: LiveRoom;
}

function AccessBadge({ type, priceCents }: { type: LiveRoom['access_type']; priceCents: number | null }) {
  if (type === 'paid') {
    const price = priceCents ? `$${(priceCents / 100).toFixed(2)}` : '';
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800/40">
        <Lock size={10} /> Ticket {price}
      </span>
    );
  }
  if (type === 'subscribers') {
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-800/40">
        <Star size={10} /> Subscribers
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/40">
      Free
    </span>
  );
}

export default function LiveRoomCard({ room }: Props) {
  return (
    <Link
      to={`/live/${room.id}`}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/80 hover:border-yellow-600/40 hover:bg-zinc-800/60 transition-all duration-200 overflow-hidden group"
    >
      {/* Header bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-yellow-600 to-yellow-400" />

      <div className="p-4 space-y-3">
        {/* Live badge + access */}
        <div className="flex items-center justify-between gap-2">
          {room.status === 'live' ? (
            <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-red-600 text-white animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              LIVE
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-700 text-zinc-400">
              Starting Soon
            </span>
          )}
          <AccessBadge type={room.access_type} priceCents={room.price_cents} />
        </div>

        {/* Title */}
        <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 group-hover:text-yellow-300 transition-colors">
          {room.title}
        </h3>

        {/* Creator + viewers */}
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            {room.creator_avatar ? (
              <img src={room.creator_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-yellow-700/40 flex items-center justify-center text-yellow-400 text-[10px] font-bold">
                {room.creator_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className="text-zinc-400">{room.creator_name}</span>
          </div>
          {room.peak_viewer_count > 0 && (
            <span className="flex items-center gap-1 text-zinc-500">
              <Users size={11} /> {room.peak_viewer_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
