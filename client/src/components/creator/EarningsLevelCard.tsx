import React from 'react';
import { Diamond, Zap, TrendingUp, Crown } from 'lucide-react';
import ProgressBar from '../ui/ProgressBar';
import { formatCurrency } from '../../lib/utils';

const LEVELS = [
  { id: 'rising',    label: 'Rising',     min: 0,     max: 500,   icon: <Zap className="w-4 h-4" />,       color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/25' },
  { id: 'verified',  label: 'Verified',   min: 500,   max: 2000,  icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/25' },
  { id: 'elite',     label: 'Elite',      min: 2000,  max: 10000, icon: <Crown className="w-4 h-4" />,      color: 'text-gold',       bg: 'bg-gold/10 border-gold/25' },
  { id: 'legendary', label: 'Legendary',  min: 10000, max: Infinity, icon: <Diamond className="w-4 h-4" />, color: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/25' },
];

interface EarningsLevelCardProps {
  totalEarnings: number;
  className?: string;
}

export default function EarningsLevelCard({ totalEarnings, className = '' }: EarningsLevelCardProps) {
  const level = LEVELS.find(l => totalEarnings >= l.min && totalEarnings < l.max) ?? LEVELS[LEVELS.length - 1];
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const pct = nextLevel
    ? Math.round(((totalEarnings - level.min) / (nextLevel.min - level.min)) * 100)
    : 100;

  return (
    <div className={`card-surface p-5 rounded-xl ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${level.bg} ${level.color}`}>
          {level.icon}
        </div>
        <div>
          <p className="text-xs text-arc-muted">Creator Level</p>
          <p className={`font-serif text-lg ${level.color}`}>{level.label}</p>
        </div>
      </div>

      <ProgressBar value={pct} variant="gold" size="md" className="mb-3" />

      <div className="flex justify-between text-xs">
        <span className="text-arc-muted">{formatCurrency(totalEarnings)}</span>
        {nextLevel && (
          <span className="text-arc-muted">
            {formatCurrency(nextLevel.min)} to unlock <span className={nextLevel.color ?? 'text-white'}>{nextLevel.label}</span>
          </span>
        )}
      </div>
    </div>
  );
}
