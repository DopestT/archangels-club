import React from 'react';
import { DollarSign, Upload, Users, TrendingUp, Check } from 'lucide-react';
import ProgressBar from '../ui/ProgressBar';
import { formatCurrency } from '../../lib/utils';

interface First100TrackerProps {
  currentEarnings: number;
  goal?: number;
  className?: string;
}

const MILESTONES = [
  { label: 'First post', earnings: 0,   icon: <Upload className="w-3.5 h-3.5" />,    action: 'Upload your first content' },
  { label: 'First $10',  earnings: 10,  icon: <DollarSign className="w-3.5 h-3.5" />, action: 'Unlock a second content piece' },
  { label: 'First $25',  earnings: 25,  icon: <TrendingUp className="w-3.5 h-3.5" />, action: 'Set up a limited drop' },
  { label: 'First $50',  earnings: 50,  icon: <Users className="w-3.5 h-3.5" />,      action: 'Launch your subscription' },
  { label: 'First $100', earnings: 100, icon: <DollarSign className="w-3.5 h-3.5" />, action: 'You made it 🎉' },
];

export default function First100Tracker({ currentEarnings, goal = 100, className = '' }: First100TrackerProps) {
  const pct = Math.min(100, (currentEarnings / goal) * 100);
  const nextMilestone = MILESTONES.find(m => m.earnings > currentEarnings);
  const reached = MILESTONES.filter(m => m.earnings <= currentEarnings);

  return (
    <div className={`card-surface p-5 rounded-xl ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-arc-muted">First $100</p>
          <p className="font-serif text-xl text-gold mt-0.5">{formatCurrency(currentEarnings)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-arc-muted">Goal</p>
          <p className="font-serif text-white">{formatCurrency(goal)}</p>
        </div>
      </div>

      <ProgressBar value={pct} variant="gold" size="lg" className="mb-5" />

      {/* Milestones */}
      <div className="space-y-2">
        {MILESTONES.map((m) => {
          const done = currentEarnings >= m.earnings;
          const isCurrent = nextMilestone?.earnings === m.earnings;
          return (
            <div key={m.label} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isCurrent ? 'bg-gold/8 border border-gold/20' : 'bg-white/3 border border-transparent'}`}>
              <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 ${done ? 'bg-arc-success/15 border-arc-success/30 text-arc-success' : isCurrent ? 'bg-gold/10 border-gold/25 text-gold' : 'bg-white/5 border-white/10 text-arc-muted'}`}>
                {done ? <Check className="w-3 h-3" /> : m.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${done ? 'text-arc-success' : isCurrent ? 'text-white' : 'text-arc-muted'}`}>{m.label}</p>
                {isCurrent && <p className="text-[11px] text-gold mt-0.5">{m.action}</p>}
              </div>
              {done && <Check className="w-3.5 h-3.5 text-arc-success flex-shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
