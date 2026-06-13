import React from 'react';
import { Crown } from 'lucide-react';

export interface TopTipper {
  display_name: string;
  total_cents: number;
  rank: number;
}

interface Props {
  tippers: TopTipper[];
}

const RANK_STYLES = [
  'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  'text-zinc-300 border-zinc-600/40 bg-zinc-800/50',
  'text-amber-600 border-amber-700/40 bg-amber-900/20',
];

export default function CrownRace({ tippers }: Props) {
  if (tippers.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
      <div className="flex items-center gap-1.5 mb-2">
        <Crown size={13} className="text-yellow-400" />
        <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-500">Crown Race</span>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tippers.slice(0, 5).map((t, i) => (
          <div
            key={t.display_name}
            className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border text-center min-w-[72px] ${
              RANK_STYLES[i] ?? 'text-zinc-500 border-zinc-800 bg-zinc-900'
            }`}
          >
            <span className="text-[10px] font-bold">#{t.rank}</span>
            <span className="text-[11px] font-medium truncate max-w-[60px]">{t.display_name}</span>
            <span className="text-[10px] opacity-70">${(t.total_cents / 100).toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
