import React from 'react';
import { ShieldCheck, Lock, Crown, Star, Flame, Diamond, Zap, AlertTriangle, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

type BadgeType =
  | 'verified'
  | 'members'
  | 'locked'
  | 'free'
  | 'subscribers'
  | 'new'
  | 'limited'
  | 'selected-creator'
  | 'elite'
  | 'black-tier'
  | 'drop-live'
  | 'sold-out';

interface BadgeProps { type: BadgeType; className?: string; }

const BADGE_CONFIGS: Record<BadgeType, { icon?: React.ReactNode; label: string; cls: string }> = {
  'verified':          { icon: <ShieldCheck className="w-3 h-3" />, label: 'Verified',         cls: 'text-blue-400 bg-blue-400/10 border-blue-400/25' },
  'members':           { icon: <Crown className="w-3 h-3" />,       label: 'Members Only',     cls: 'text-gold bg-gold/10 border-gold/25' },
  'locked':            { icon: <Lock className="w-3 h-3" />,        label: 'Locked',           cls: 'text-arc-secondary bg-white/5 border-white/10' },
  'free':              { icon: <Star className="w-3 h-3" />,        label: 'Free Preview',     cls: 'text-arc-success bg-arc-success/10 border-arc-success/25' },
  'subscribers':       { icon: <Crown className="w-3 h-3" />,       label: 'Subscribers',      cls: 'text-gold bg-gold/10 border-gold/25' },
  'new':               {                                             label: 'New',              cls: 'text-arc-success bg-arc-success/10 border-arc-success/25' },
  'limited':           { icon: <Flame className="w-3 h-3" />,       label: 'Limited',          cls: 'text-amber-400 bg-amber-400/10 border-amber-400/25' },
  'selected-creator':  { icon: <Zap className="w-3 h-3" />,         label: 'Selected Creator', cls: 'text-gold bg-gold/10 border-gold/30' },
  'elite':             { icon: <Diamond className="w-3 h-3" />,     label: 'Elite',            cls: 'text-violet-400 bg-violet-400/10 border-violet-400/25' },
  'black-tier':        { icon: <Crown className="w-3 h-3" />,       label: 'Black Tier',       cls: 'text-white bg-white/8 border-white/15' },
  'drop-live':         { icon: <Zap className="w-3 h-3" />,         label: 'Drop Live',        cls: 'text-arc-success bg-arc-success/10 border-arc-success/30' },
  'sold-out':          { icon: <AlertTriangle className="w-3 h-3" />, label: 'Sold Out',       cls: 'text-arc-error bg-arc-error/10 border-arc-error/25' },
};

export function Badge({ type, className }: BadgeProps) {
  const { icon, label, cls } = BADGE_CONFIGS[type];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-sans font-medium rounded-full border', cls, className)}>
      {icon}
      {label}
    </span>
  );
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span title="Verified Creator" className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500', className)}>
      <ShieldCheck className="w-3 h-3 text-white" />
    </span>
  );
}

export function GoldVerifiedBadge({ className }: { className?: string }) {
  return (
    <span title="Selected Creator" className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full', className)} style={{ background: '#D4AF37' }}>
      <Check className="w-3 h-3 text-bg-primary" />
    </span>
  );
}
