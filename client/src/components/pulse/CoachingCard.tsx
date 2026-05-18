import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, AlertTriangle, Lightbulb, ChevronRight, X, Clock, Sparkles } from 'lucide-react';

export type CoachingVariant = 'opportunity' | 'warning' | 'info';
export type CoachingConfidence = 'high' | 'medium' | 'low';

export interface CoachingCardProps {
  issue: string;
  reason: string;
  action: string;
  confidence: CoachingConfidence;
  actionLabel: string;
  actionTo?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  onSnooze?: () => void;
  variant?: CoachingVariant;
  loading?: boolean;
}

const VARIANT: Record<CoachingVariant, {
  border: string; bg: string; label: string; iconCls: string; btnCls: string;
  accentBar: string;
  Icon: React.ElementType;
}> = {
  opportunity: {
    border:    'rgba(212,175,55,0.26)',
    bg:        'rgba(212,175,55,0.04)',
    label:     'text-gold',
    iconCls:   'text-gold bg-gold/10 border-gold/20',
    btnCls:    'bg-gold/10 text-gold border-gold/25 hover:bg-gold/20',
    accentBar: 'linear-gradient(180deg, rgba(212,175,55,0.85) 0%, rgba(212,175,55,0.2) 100%)',
    Icon: TrendingUp,
  },
  warning: {
    border:    'rgba(251,191,36,0.26)',
    bg:        'rgba(251,191,36,0.03)',
    label:     'text-amber-400',
    iconCls:   'text-amber-400 bg-amber-400/10 border-amber-400/20',
    btnCls:    'bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20',
    accentBar: 'linear-gradient(180deg, rgba(251,191,36,0.85) 0%, rgba(251,191,36,0.2) 100%)',
    Icon: AlertTriangle,
  },
  info: {
    border:    'rgba(96,165,250,0.20)',
    bg:        'rgba(96,165,250,0.02)',
    label:     'text-blue-400',
    iconCls:   'text-blue-400 bg-blue-400/10 border-blue-400/20',
    btnCls:    'bg-blue-400/10 text-blue-400 border-blue-400/25 hover:bg-blue-400/20',
    accentBar: 'linear-gradient(180deg, rgba(96,165,250,0.8) 0%, rgba(96,165,250,0.15) 100%)',
    Icon: Lightbulb,
  },
};

const CONF: Record<CoachingConfidence, { label: string; cls: string }> = {
  high:   { label: 'High signal',   cls: 'text-arc-success bg-arc-success/10 border-arc-success/22' },
  medium: { label: 'Medium signal', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/22' },
  low:    { label: 'Low signal',    cls: 'text-arc-muted bg-white/5 border-white/10' },
};

export default function CoachingCard({
  issue, reason, action, confidence,
  actionLabel, actionTo, onAction, onDismiss, onSnooze,
  variant = 'info', loading = false,
}: CoachingCardProps) {
  const [gone, setGone] = useState(false);
  const [snoozed, setSnoozed] = useState(false);

  if (gone || snoozed) return null;

  const cfg  = VARIANT[variant];
  const conf = CONF[confidence];
  const Icon = cfg.Icon;

  if (loading) {
    return (
      <div className="relative rounded-xl border border-white/6 bg-bg-surface p-4 overflow-hidden animate-pulse">
        <div className="absolute left-0 inset-y-0 w-[2px] rounded-l-xl bg-white/10" />
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/6 flex-shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3 bg-white/8 rounded w-3/5" />
            <div className="h-2 bg-white/5 rounded w-full" />
            <div className="h-2 bg-white/5 rounded w-4/5" />
            <div className="flex gap-2 pt-1">
              <div className="h-6 w-20 bg-white/5 rounded-full" />
              <div className="h-6 w-14 bg-white/5 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const ActionEl = actionTo
    ? (
      <Link
        to={actionTo}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${cfg.btnCls}`}
      >
        {actionLabel}
        <ChevronRight className="w-3 h-3" />
      </Link>
    )
    : onAction
    ? (
      <button
        onClick={() => { onAction?.(); }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${cfg.btnCls}`}
      >
        {actionLabel}
        <ChevronRight className="w-3 h-3" />
      </button>
    )
    : null;

  return (
    <div
      className="relative rounded-xl border p-4 overflow-hidden transition-all duration-300"
      style={{
        borderColor: cfg.border,
        background: cfg.bg,
        animation: 'recCardReveal 280ms ease both',
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 inset-y-0 w-[2px] rounded-l-xl"
        style={{ background: cfg.accentBar }}
      />

      {/* Header row */}
      <div className="flex items-start gap-3 mb-2.5">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${cfg.iconCls}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-[12px] font-semibold ${cfg.label}`}>{issue}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${conf.cls}`}>
              {conf.label}
            </span>
          </div>
          <p className="text-[11px] text-arc-muted leading-relaxed">{reason}</p>
        </div>
        <button
          onClick={() => { setGone(true); onDismiss?.(); }}
          className="w-5 h-5 flex items-center justify-center text-arc-muted/35 hover:text-arc-muted/70 transition-colors flex-shrink-0 -mt-0.5"
          aria-label="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Recommended action */}
      <div className="ml-11 mb-3">
        <div className="flex items-start gap-1.5">
          <Sparkles className="w-3 h-3 text-arc-muted/40 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-arc-secondary leading-relaxed">{action}</p>
        </div>
      </div>

      {/* CTA row */}
      <div className="ml-11 flex items-center gap-2 flex-wrap">
        {ActionEl}
        <button
          onClick={() => { setSnoozed(true); onSnooze?.(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] text-arc-muted hover:text-arc-secondary border border-white/6 hover:border-white/14 transition-all"
        >
          <Clock className="w-3 h-3" />
          Snooze
        </button>
      </div>
    </div>
  );
}
