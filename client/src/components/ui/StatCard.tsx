import React from 'react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export default function StatCard({ label, value, sub, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('card-surface p-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-sans font-medium tracking-wider uppercase text-arc-secondary mb-2">
            {label}
          </p>
          <p className="font-serif text-2xl text-white mb-1">{value}</p>
          {sub && (
            <p className={cn(
              'text-xs font-sans',
              trend === 'up' ? 'text-arc-success' : trend === 'down' ? 'text-arc-error' : 'text-arc-muted',
            )}>
              {sub}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 p-2.5 rounded-lg bg-gold-muted border border-gold-border text-gold">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
