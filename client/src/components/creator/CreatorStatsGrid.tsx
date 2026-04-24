import React from 'react';
import { DollarSign, Users, TrendingUp, Star, Calendar, Zap } from 'lucide-react';
import { formatCurrency, formatCompactNumber } from '../../lib/utils';

interface CreatorStats {
  totalEarnings: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  subscribers: number;
  unlocks: number;
}

interface CreatorStatsGridProps {
  stats: CreatorStats;
  className?: string;
}

export default function CreatorStatsGrid({ stats, className = '' }: CreatorStatsGridProps) {
  const items = [
    { label: 'Total Earnings', value: formatCurrency(stats.totalEarnings), icon: <DollarSign className="w-4 h-4" />, trend: null },
    { label: 'Today',          value: formatCurrency(stats.todayEarnings), icon: <Zap className="w-4 h-4" />,        trend: null },
    { label: 'This Week',      value: formatCurrency(stats.weekEarnings),  icon: <Calendar className="w-4 h-4" />,   trend: null },
    { label: 'This Month',     value: formatCurrency(stats.monthEarnings), icon: <TrendingUp className="w-4 h-4" />, trend: null },
    { label: 'Subscribers',    value: formatCompactNumber(stats.subscribers), icon: <Users className="w-4 h-4" />,   trend: null },
    { label: 'Content Unlocks',value: formatCompactNumber(stats.unlocks),  icon: <Star className="w-4 h-4" />,       trend: null },
  ];

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 ${className}`}>
      {items.map(({ label, value, icon }) => (
        <div key={label} className="card-surface p-4 rounded-xl text-center">
          <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mx-auto mb-2">
            {icon}
          </div>
          <p className="font-serif text-lg text-white">{value}</p>
          <p className="text-[11px] text-arc-muted mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}
