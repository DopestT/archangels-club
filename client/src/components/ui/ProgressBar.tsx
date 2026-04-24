import React from 'react';

interface ProgressBarProps {
  value: number;      // 0–100
  max?: number;       // default 100
  label?: string;
  sublabel?: string;
  showValue?: boolean;
  variant?: 'gold' | 'success' | 'error' | 'white';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const TRACK_H = { sm: 'h-1', md: 'h-1.5', lg: 'h-2.5' };

const BAR_COLORS: Record<NonNullable<ProgressBarProps['variant']>, string> = {
  gold:    'linear-gradient(90deg, #B8962E, #D4AF37, #E8C84A)',
  success: 'linear-gradient(90deg, #16a34a, #22C55E)',
  error:   'linear-gradient(90deg, #dc2626, #EF4444)',
  white:   'rgba(255,255,255,0.6)',
};

export default function ProgressBar({
  value, max = 100, label, sublabel, showValue = false,
  variant = 'gold', size = 'md', animated = false, className = '',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`space-y-1.5 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-xs text-arc-secondary">{label}</span>}
          {showValue && <span className="text-xs font-mono text-gold">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={`w-full ${TRACK_H[size]} bg-white/8 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${animated ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%`, background: BAR_COLORS[variant] }}
        />
      </div>
      {sublabel && <p className="text-xs text-arc-muted">{sublabel}</p>}
    </div>
  );
}
