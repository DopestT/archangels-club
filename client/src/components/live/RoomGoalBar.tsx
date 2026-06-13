import React from 'react';
import { Target } from 'lucide-react';

interface Props {
  goalAmountCents: number;
  goalTitle?: string | null;
  raisedCents: number;
}

export default function RoomGoalBar({ goalAmountCents, goalTitle, raisedCents }: Props) {
  const pct = Math.min(100, Math.round((raisedCents / goalAmountCents) * 100));
  const reached = raisedCents >= goalAmountCents;

  return (
    <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Target size={13} className={reached ? 'text-yellow-400' : 'text-zinc-500'} />
          <span className="text-xs text-zinc-400">{goalTitle ?? 'Stream Goal'}</span>
        </div>
        <span className={`text-xs font-semibold ${reached ? 'text-yellow-400' : 'text-zinc-300'}`}>
          ${(raisedCents / 100).toFixed(0)} / ${(goalAmountCents / 100).toFixed(0)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${reached ? 'bg-yellow-400' : 'bg-yellow-600/70'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {reached && (
        <p className="text-[10px] text-yellow-400 mt-1 text-center font-medium tracking-wider uppercase">
          Goal reached!
        </p>
      )}
    </div>
  );
}
