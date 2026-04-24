import React, { useEffect, useState } from 'react';
import { Zap, Clock, AlertTriangle, XCircle } from 'lucide-react';

type DropState = 'coming' | 'live' | 'sold_out' | 'expired';

interface DropCountdownProps {
  releaseTime?: string;   // ISO – when drop goes live
  expiresTime?: string;   // ISO – when drop ends
  remainingUnlocks?: number;
  maxUnlocks?: number;
  className?: string;
}

function diff(target: Date): { d: number; h: number; m: number; s: number } {
  const ms = Math.max(0, target.getTime() - Date.now());
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-2xl font-bold text-white tabular-nums">{pad(value)}</span>
      <span className="text-[10px] text-arc-muted uppercase tracking-widest">{label}</span>
    </div>
  );
}

export default function DropCountdown({ releaseTime, expiresTime, remainingUnlocks, maxUnlocks, className = '' }: DropCountdownProps) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const release = releaseTime ? new Date(releaseTime) : null;
  const expires = expiresTime ? new Date(expiresTime) : null;

  let state: DropState = 'live';
  if (remainingUnlocks !== undefined && remainingUnlocks <= 0) state = 'sold_out';
  else if (expires && now > expires.getTime()) state = 'expired';
  else if (release && now < release.getTime()) state = 'coming';

  const targetDate = state === 'coming' ? release : expires;
  const countdown = targetDate ? diff(targetDate) : null;

  const CONFIG = {
    coming:   { icon: <Clock className="w-4 h-4" />,         label: 'Drop starts in',    cls: 'border-amber-500/25 bg-amber-500/8',  text: 'text-amber-400' },
    live:     { icon: <Zap className="w-4 h-4" />,           label: 'Drop ends in',      cls: 'border-arc-success/25 bg-arc-success/8', text: 'text-arc-success' },
    sold_out: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Sold Out',          cls: 'border-arc-error/25 bg-arc-error/8',  text: 'text-arc-error' },
    expired:  { icon: <XCircle className="w-4 h-4" />,       label: 'Drop Ended',        cls: 'border-white/10 bg-white/4',          text: 'text-arc-muted' },
  }[state];

  return (
    <div className={`rounded-2xl border p-5 ${CONFIG.cls} ${className}`}>
      <div className={`flex items-center gap-1.5 mb-4 text-sm font-medium ${CONFIG.text}`}>
        {CONFIG.icon}
        {CONFIG.label}
      </div>

      {countdown && state !== 'sold_out' && state !== 'expired' && (
        <div className="flex items-center gap-4 mb-4">
          {countdown.d > 0 && <Unit value={countdown.d} label="days" />}
          <Unit value={countdown.h} label="hrs" />
          <Unit value={countdown.m} label="min" />
          <Unit value={countdown.s} label="sec" />
        </div>
      )}

      {remainingUnlocks !== undefined && maxUnlocks !== undefined && state === 'live' && (
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-arc-muted">Unlocks remaining</span>
            <span className={`font-mono font-medium ${remainingUnlocks <= 5 ? 'text-arc-error' : 'text-arc-success'}`}>
              {remainingUnlocks}/{maxUnlocks}
            </span>
          </div>
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(remainingUnlocks / maxUnlocks) * 100}%`, background: 'linear-gradient(90deg, #22C55E, #4ade80)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
