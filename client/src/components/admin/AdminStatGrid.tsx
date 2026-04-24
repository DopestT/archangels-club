import React from 'react';
import { DollarSign, Users, Briefcase, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatCompactNumber } from '../../lib/utils';

interface AdminStats {
  totalRevenue: number;
  totalUsers: number;
  totalCreators: number;
  pendingUsers: number;
  pendingCreators: number;
  pendingContent: number;
}

interface AdminStatGridProps {
  stats: AdminStats;
  className?: string;
}

export default function AdminStatGrid({ stats, className = '' }: AdminStatGridProps) {
  const items = [
    { label: 'Platform Revenue',    value: formatCurrency(stats.totalRevenue),           icon: <DollarSign className="w-4 h-4" />, color: 'text-gold',       bg: 'bg-gold/10 border-gold/20' },
    { label: 'Total Members',       value: formatCompactNumber(stats.totalUsers),         icon: <Users className="w-4 h-4" />,      color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20' },
    { label: 'Active Creators',     value: formatCompactNumber(stats.totalCreators),      icon: <Briefcase className="w-4 h-4" />,  color: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/20' },
    { label: 'Pending Access',      value: String(stats.pendingUsers),                    icon: <Clock className="w-4 h-4" />,      color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/20' },
    { label: 'Pending Creators',    value: String(stats.pendingCreators),                 icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/20' },
    { label: 'Content in Review',   value: String(stats.pendingContent),                  icon: <AlertTriangle className="w-4 h-4" />, color: 'text-arc-error', bg: 'bg-arc-error/10 border-arc-error/20' },
  ];

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 ${className}`}>
      {items.map(({ label, value, icon, color, bg }) => (
        <div key={label} className="card-surface p-4 rounded-xl">
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 ${bg} ${color}`}>
            {icon}
          </div>
          <p className="font-serif text-xl text-white">{value}</p>
          <p className="text-[11px] text-arc-muted mt-0.5 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}
