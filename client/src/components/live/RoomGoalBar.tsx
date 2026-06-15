import React from 'react';

interface Props {
  goalAmountCents: number;
  goalTitle?: string | null;
  raisedCents: number;
}

export default function RoomGoalBar({ goalAmountCents, goalTitle, raisedCents }: Props) {
  const pct     = Math.min(100, (raisedCents / goalAmountCents) * 100);
  const reached = raisedCents >= goalAmountCents;

  // Convert cents to "Gold" (100 cents = 100 Gold as a 1:1 cosmetic mapping)
  const raisedGold = Math.round(raisedCents / 1);
  const goalGold   = Math.round(goalAmountCents / 1);
  const remaining  = Math.max(0, goalGold - raisedGold);

  return (
    <div
      className="rounded-xl px-4 py-4"
      style={{
        background: 'rgba(12,11,14,0.95)',
        border: '1px solid rgba(212,175,55,0.12)',
        boxShadow: reached ? '0 0 20px rgba(212,175,55,0.07)' : 'none',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[9px] tracking-[0.2em] text-zinc-600 uppercase mb-0.5">Room Goal</p>
          <p className="text-sm font-medium text-white">{goalTitle ?? 'Unlock Private Encore'}</p>
        </div>
        {reached ? (
          <span
            className="text-[9px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded-full"
            style={{ color: '#d4af37', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            Reached
          </span>
        ) : (
          <span className="text-[10px] text-zinc-600 tabular-nums mt-0.5">
            {remaining.toLocaleString()} Gold remaining
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="h-1 rounded-full overflow-hidden mb-2"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${pct}%`,
            background: reached
              ? 'linear-gradient(90deg, #d4af37, #f0d060)'
              : 'linear-gradient(90deg, #a8832a, #d4af37)',
            boxShadow: pct > 5 ? '0 0 8px rgba(212,175,55,0.35)' : 'none',
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] tabular-nums" style={{ color: '#d4af37' }}>
          {raisedGold.toLocaleString()} Gold
        </span>
        <span className="text-[11px] text-zinc-600 tabular-nums">
          {goalGold.toLocaleString()} Gold
        </span>
      </div>
    </div>
  );
}
