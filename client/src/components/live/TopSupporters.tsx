import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface Supporter {
  display_name: string;
  total_cents: number;
  rank: number;
}

interface Props {
  supporters: Supporter[];
  collapsible?: boolean;
}

export default function TopSupporters({ supporters, collapsible = false }: Props) {
  const [open, setOpen] = useState(true);

  if (supporters.length === 0) return null;

  const RANK_COLORS = ['#d4af37', '#9ca3af', '#92673b'];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(12,11,14,0.95)',
        border: '1px solid rgba(212,175,55,0.1)',
      }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => collapsible && setOpen(v => !v)}
        disabled={!collapsible}
      >
        <div>
          <p className="text-[9px] tracking-[0.2em] text-zinc-600 uppercase text-left">Room Patrons</p>
        </div>
        {collapsible && (
          open
            ? <ChevronUp size={14} className="text-zinc-700" />
            : <ChevronDown size={14} className="text-zinc-700" />
        )}
      </button>

      {/* Gold separator */}
      {open && (
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.15), transparent)' }} />
      )}

      {/* List */}
      {open && (
        <div className="px-4 py-3 space-y-2">
          {supporters.slice(0, 5).map((s, i) => (
            <div key={`${s.display_name}-${s.rank}`} className="flex items-center gap-3">
              <span
                className="text-[10px] font-bold tabular-nums w-4 text-right flex-shrink-0"
                style={{ color: RANK_COLORS[i] ?? '#3f3f46' }}
              >
                {s.rank}
              </span>
              <span className="text-xs text-zinc-300 flex-1 truncate">{s.display_name}</span>
              <span
                className="text-[11px] tabular-nums flex-shrink-0 font-medium"
                style={{ color: i === 0 ? '#d4af37' : '#71717a' }}
              >
                {Math.round(s.total_cents / 1).toLocaleString()}G
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
