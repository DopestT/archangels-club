import React from 'react';
import {
  DollarSign, Clock, TrendingUp, User, MessageSquare, Shield, ArrowRight,
} from 'lucide-react';

export interface Insight {
  id: string;
  category: string;
  text: string;
  reason: string;
  signal: string;
  action: string;
  confidence: 'high' | 'medium' | 'low';
  priority: number;
}

const STYLES: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  Payout:     { icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-red-400',    bg: 'bg-red-500/8',    border: 'border-red-500/20' },
  Compliance: { icon: <Shield className="w-3.5 h-3.5" />,    color: 'text-red-400',    bg: 'bg-red-500/8',    border: 'border-red-500/20' },
  Engagement: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/20' },
  Pricing:    { icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/8',  border: 'border-amber-500/20' },
  Content:    { icon: <Clock className="w-3.5 h-3.5" />,      color: 'text-gold',      bg: 'bg-gold/8',       border: 'border-gold/20' },
  Growth:     { icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20' },
  Profile:    { icon: <User className="w-3.5 h-3.5" />,       color: 'text-arc-secondary', bg: 'bg-white/4',  border: 'border-white/10' },
};

function getStyle(category: string) {
  return STYLES[category] ?? STYLES['Profile'];
}

interface Props {
  insight: Insight;
}

export default function CoachingCard({ insight }: Props) {
  const s = getStyle(insight.category);
  return (
    <div className={`rounded-xl p-4 border ${s.bg} ${s.border}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className={s.color}>{s.icon}</span>
        <span className={`text-[10px] font-semibold tracking-widest uppercase ${s.color}`}>
          {insight.category}
        </span>
        {insight.confidence === 'high' && (
          <span
            className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"
            title="High-confidence signal"
          />
        )}
      </div>

      <p className="text-xs text-white leading-relaxed mb-2">{insight.text}</p>

      <p className="text-[10px] text-arc-muted mb-3 leading-snug">
        <span className="text-arc-secondary font-medium">Signal:</span> {insight.signal}
      </p>

      <div className={`flex items-start gap-1.5 text-[10px] font-medium leading-snug ${s.color}`}>
        <ArrowRight className="w-3 h-3 flex-shrink-0 mt-px" />
        <span>{insight.action}</span>
      </div>
    </div>
  );
}
