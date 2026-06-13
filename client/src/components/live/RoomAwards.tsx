import React from 'react';
import { Crown, Zap, Clock, Users } from 'lucide-react';
import type { TopTipper } from './CrownRace';

interface Props {
  peakViewers: number;
  durationMinutes: number;
  totalRaisedCents: number;
  topTippers: TopTipper[];
  onClose: () => void;
}

export default function RoomAwards({ peakViewers, durationMinutes, totalRaisedCents, topTippers, onClose }: Props) {
  const topTipper = topTippers[0] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-zinc-950 border border-yellow-600/30 rounded-2xl p-6 shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-3xl mb-3">🏆</div>
        <h2 className="font-serif text-xl text-white mb-1">Stream Complete</h2>
        <p className="text-xs text-zinc-500 mb-6">Great session — here's how it went</p>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-zinc-900 rounded-xl p-3">
            <Users size={16} className="mx-auto text-zinc-500 mb-1" />
            <p className="text-sm font-bold text-white">{peakViewers}</p>
            <p className="text-[10px] text-zinc-500">Peak viewers</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3">
            <Clock size={16} className="mx-auto text-zinc-500 mb-1" />
            <p className="text-sm font-bold text-white">{durationMinutes}m</p>
            <p className="text-[10px] text-zinc-500">Duration</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3">
            <Zap size={16} className="mx-auto text-yellow-500 mb-1" />
            <p className="text-sm font-bold text-yellow-400">${(totalRaisedCents / 100).toFixed(0)}</p>
            <p className="text-[10px] text-zinc-500">Raised</p>
          </div>
        </div>

        {topTipper && (
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-5">
            <Crown size={18} className="text-yellow-400 flex-shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Crown Holder</p>
              <p className="text-sm font-semibold text-white truncate">{topTipper.display_name}</p>
              <p className="text-xs text-yellow-400">${(topTipper.total_cents / 100).toFixed(0)} sent</p>
            </div>
          </div>
        )}

        <button onClick={onClose} className="btn-gold w-full">
          Back to Studio
        </button>

        {/* TODO(room-awards): Add shareable awards card image generation */}
      </div>
    </div>
  );
}
