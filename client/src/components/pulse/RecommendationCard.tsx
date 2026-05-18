import React from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Star, Zap, BookOpen, Radio, MessageCircle,
  ChevronRight, Flame, Sparkles, Crown,
} from 'lucide-react';

export type SignalType =
  | 'picked-for-you'
  | 'most-collected'
  | 'rising-fast'
  | 'similar-to-vault'
  | 'recently-active'
  | 'custom-requests-open'
  | 'trending-tonight'
  | 'new-creator-discovery'
  | 'subscriber-opportunity';

export interface RecommendationCardProps {
  signal: SignalType;
  title: string;
  creator?: string;
  thumbnailUrl?: string;
  thumbnailColor?: string;
  reason?: string;
  price?: number;
  suggestedAction?: string;
  confidence?: 'high' | 'medium' | 'low';
  to: string;
  loading?: boolean;
  revealDelay?: number;
}

const SIGNAL_CONFIG: Record<SignalType, {
  label: string;
  labelCls: string;
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
  Icon: React.ElementType;
  iconCls: string;
}> = {
  'picked-for-you': {
    label: 'Picked for You',
    labelCls: 'text-gold bg-gold/12 border-gold/25',
    gradientFrom: 'rgba(212,175,55,0.28)',
    gradientTo: 'rgba(212,175,55,0.05)',
    glowColor: 'rgba(212,175,55,0.18)',
    Icon: Star,
    iconCls: 'text-gold',
  },
  'most-collected': {
    label: 'Most Collected',
    labelCls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
    gradientFrom: 'rgba(52,211,153,0.22)',
    gradientTo: 'rgba(52,211,153,0.04)',
    glowColor: 'rgba(52,211,153,0.16)',
    Icon: BookOpen,
    iconCls: 'text-emerald-400',
  },
  'rising-fast': {
    label: 'Rising Fast',
    labelCls: 'text-orange-400 bg-orange-400/10 border-orange-400/25',
    gradientFrom: 'rgba(251,146,60,0.24)',
    gradientTo: 'rgba(251,146,60,0.04)',
    glowColor: 'rgba(251,146,60,0.16)',
    Icon: TrendingUp,
    iconCls: 'text-orange-400',
  },
  'similar-to-vault': {
    label: 'Similar to Your Vault',
    labelCls: 'text-violet-400 bg-violet-400/10 border-violet-400/25',
    gradientFrom: 'rgba(167,139,250,0.24)',
    gradientTo: 'rgba(167,139,250,0.04)',
    glowColor: 'rgba(167,139,250,0.16)',
    Icon: Zap,
    iconCls: 'text-violet-400',
  },
  'recently-active': {
    label: 'Recently Active',
    labelCls: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
    gradientFrom: 'rgba(96,165,250,0.24)',
    gradientTo: 'rgba(96,165,250,0.04)',
    glowColor: 'rgba(96,165,250,0.16)',
    Icon: Radio,
    iconCls: 'text-blue-400',
  },
  'custom-requests-open': {
    label: 'Custom Requests Open',
    labelCls: 'text-rose-400 bg-rose-400/10 border-rose-400/25',
    gradientFrom: 'rgba(251,113,133,0.24)',
    gradientTo: 'rgba(251,113,133,0.04)',
    glowColor: 'rgba(251,113,133,0.16)',
    Icon: MessageCircle,
    iconCls: 'text-rose-400',
  },
  'trending-tonight': {
    label: 'Trending Tonight',
    labelCls: 'text-amber-300 bg-amber-300/10 border-amber-300/25',
    gradientFrom: 'rgba(252,211,77,0.22)',
    gradientTo: 'rgba(249,115,22,0.06)',
    glowColor: 'rgba(252,211,77,0.16)',
    Icon: Flame,
    iconCls: 'text-amber-300',
  },
  'new-creator-discovery': {
    label: 'New Discovery',
    labelCls: 'text-teal-400 bg-teal-400/10 border-teal-400/25',
    gradientFrom: 'rgba(45,212,191,0.22)',
    gradientTo: 'rgba(45,212,191,0.04)',
    glowColor: 'rgba(45,212,191,0.16)',
    Icon: Sparkles,
    iconCls: 'text-teal-400',
  },
  'subscriber-opportunity': {
    label: 'Subscriber Opportunity',
    labelCls: 'text-purple-400 bg-purple-400/10 border-purple-400/25',
    gradientFrom: 'rgba(192,132,252,0.22)',
    gradientTo: 'rgba(192,132,252,0.04)',
    glowColor: 'rgba(192,132,252,0.16)',
    Icon: Crown,
    iconCls: 'text-purple-400',
  },
};

const CONFIDENCE_DOT: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-arc-success',
  medium: 'bg-amber-400',
  low: 'bg-white/20',
};

export function RecommendationCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="flex-none w-[188px] rounded-xl border border-white/6 bg-bg-surface overflow-hidden animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="h-[92px] bg-white/4" />
      <div className="p-3 space-y-2">
        <div className="h-2 bg-white/8 rounded w-2/3" />
        <div className="h-2.5 bg-white/6 rounded w-full" />
        <div className="h-2 bg-white/4 rounded w-1/2" />
      </div>
    </div>
  );
}

export default function RecommendationCard({
  signal, title, creator, thumbnailUrl, thumbnailColor, reason,
  price, suggestedAction, confidence, to, loading = false, revealDelay = 0,
}: RecommendationCardProps) {
  const cfg = SIGNAL_CONFIG[signal];
  const Icon = cfg.Icon;

  if (loading) return <RecommendationCardSkeleton delay={revealDelay} />;

  return (
    <Link
      to={to}
      className="flex-none w-[188px] sm:w-[196px] rounded-xl border border-white/6 bg-bg-surface overflow-hidden group hover:border-white/14 transition-colors duration-200"
      style={{
        boxShadow: 'none',
        animation: `recCardReveal 280ms ease both`,
        animationDelay: `${revealDelay}ms`,
        willChange: 'opacity, transform',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${cfg.glowColor}`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      {/* Visual area */}
      <div
        className="h-[92px] relative flex items-center justify-center overflow-hidden"
        style={{
          background: thumbnailUrl
            ? undefined
            : `radial-gradient(ellipse at 50% 40%, ${cfg.gradientFrom} 0%, ${thumbnailColor ?? cfg.gradientTo} 70%)`,
        }}
      >
        {thumbnailUrl ? (
          <>
            <img
              src={thumbnailUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-85 transition-opacity duration-300"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,10,14,0.7) 0%, transparent 55%)' }} />
          </>
        ) : (
          <Icon className={`w-7 h-7 opacity-35 group-hover:opacity-55 transition-opacity duration-200 ${cfg.iconCls}`} />
        )}

        {/* Signal pill — top left */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className={`text-[8.5px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full border backdrop-blur-sm ${cfg.labelCls}`}>
            {cfg.label}
          </span>
        </div>

        {/* Confidence dot — top right */}
        {confidence && (
          <div className={`absolute top-3 right-3 z-10 w-1.5 h-1.5 rounded-full flex-shrink-0 ${CONFIDENCE_DOT[confidence]}`}
            title={`${confidence} confidence`}
          />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-[12px] font-semibold text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors duration-200">{title}</p>
        {creator && <p className="text-[10px] text-arc-muted/70 mt-0.5 truncate">{creator}</p>}
        {reason && (
          <p className="text-[10px] text-arc-muted/55 mt-1.5 leading-relaxed line-clamp-2">{reason}</p>
        )}
        {suggestedAction && (
          <p className="text-[9px] font-bold tracking-wide text-gold/65 mt-1.5 group-hover:text-gold/85 transition-colors">
            {suggestedAction} →
          </p>
        )}
        <div className="flex items-center justify-between mt-2.5">
          {price !== undefined
            ? <span className="text-[11px] font-mono text-gold font-semibold">${price.toFixed(2)}</span>
            : <span />}
          <ChevronRight className="w-3 h-3 text-arc-muted/25 group-hover:text-gold/50 transition-colors duration-200" />
        </div>
      </div>
    </Link>
  );
}
