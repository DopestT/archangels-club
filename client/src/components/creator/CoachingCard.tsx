import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Clock, TrendingUp, User, MessageSquare, Shield,
  Crown, Package, ArrowRight,
} from 'lucide-react';

// Matches server/src/services/intelligence.ts CoachingCard
export interface Insight {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  body: string;
  cta_label: string;
  cta_action: string;
  signal: string;
  confidence: number; // 0–1
}

const CTA_ROUTES: Record<string, string> = {
  go_to_payouts:   '/creator',
  go_to_content:   '/creator/media',
  go_to_upload:    '/upload',
  go_to_settings:  '/creator',
  go_to_messages:  '/messages',
  go_to_profile:   '/creator',
  go_to_bundles:   '/creator',
};

const TYPE_STYLES: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  payout_setup:               { icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-red-400',    bg: 'bg-red-500/8',     border: 'border-red-500/20' },
  compliance_guidance:        { icon: <Shield className="w-3.5 h-3.5" />,    color: 'text-red-400',    bg: 'bg-red-500/8',     border: 'border-red-500/20' },
  inactivity_risk:            { icon: <Clock className="w-3.5 h-3.5" />,      color: 'text-gold',      bg: 'bg-gold/8',        border: 'border-gold/20' },
  conversion_issue:           { icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/8',   border: 'border-amber-500/20' },
  pricing_help:               { icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/8',   border: 'border-amber-500/20' },
  subscription_opportunity:   { icon: <Crown className="w-3.5 h-3.5" />,      color: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20' },
  response_coaching:          { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/20' },
  bundle_suggestion:          { icon: <Package className="w-3.5 h-3.5" />,    color: 'text-gold',      bg: 'bg-gold/8',        border: 'border-gold/20' },
  custom_request_opportunity: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-gold',   bg: 'bg-gold/8',        border: 'border-gold/20' },
  profile_incomplete:         { icon: <User className="w-3.5 h-3.5" />,       color: 'text-arc-secondary', bg: 'bg-white/4',   border: 'border-white/10' },
};

function getStyle(type: string) {
  return TYPE_STYLES[type] ?? TYPE_STYLES['profile_incomplete'];
}

interface Props {
  insight: Insight;
}

export default function CoachingCard({ insight }: Props) {
  const navigate = useNavigate();
  const s = getStyle(insight.type);
  const route = CTA_ROUTES[insight.cta_action] ?? '/creator';

  return (
    <div className={`rounded-xl p-4 border ${s.bg} ${s.border}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className={s.color}>{s.icon}</span>
        <span className={`text-[10px] font-semibold tracking-widest uppercase ${s.color}`}>
          {insight.priority === 'high' ? 'Action Required' : insight.priority === 'medium' ? 'Suggestion' : 'Tip'}
        </span>
        {insight.priority === 'high' && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
        )}
      </div>

      <p className="text-xs font-medium text-white mb-1.5">{insight.title}</p>
      <p className="text-[11px] text-arc-secondary leading-relaxed mb-2.5">{insight.body}</p>

      <p className="text-[10px] text-arc-muted mb-3 leading-snug">
        <span className="text-arc-secondary font-medium">Signal:</span> {insight.signal}
      </p>

      <button
        onClick={() => navigate(route)}
        className={`flex items-center gap-1.5 text-[10px] font-semibold leading-snug transition-opacity hover:opacity-70 ${s.color}`}
      >
        <ArrowRight className="w-3 h-3 flex-shrink-0" />
        {insight.cta_label}
      </button>
    </div>
  );
}
