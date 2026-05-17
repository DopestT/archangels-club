import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

// Matches server/src/services/memberRecommendations.ts MemberRecommendedCreator
export interface MemberRecommendedCreator {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  subscription_price: string;
  reason: string;
  signal: string;
  action: string;
  confidence: number;
  metric_label?: string;
  metric_value?: string | number;
}

export type RecommendationType =
  | 'trending'
  | 'most_collected'
  | 'similar_to_vault'
  | 'recently_active'
  | 'rising_fast'
  | 'custom_requests_open'
  | 'subscription_opportunity';

const TYPE_BADGE: Record<RecommendationType, { label: string; color: string; bg: string; border: string }> = {
  trending:               { label: 'Trending Now',           color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/20' },
  most_collected:         { label: 'Most Collected',         color: 'text-amber-400',     bg: 'bg-amber-500/10',    border: 'border-amber-500/20' },
  similar_to_vault:       { label: 'Similar to Your Vault',  color: 'text-purple-400',    bg: 'bg-purple-500/10',   border: 'border-purple-500/20' },
  recently_active:        { label: 'Recently Active',        color: 'text-arc-secondary', bg: 'bg-white/5',         border: 'border-white/10' },
  rising_fast:            { label: 'Rising Fast',            color: 'text-emerald-400',   bg: 'bg-emerald-500/10',  border: 'border-emerald-500/20' },
  custom_requests_open:   { label: 'Open for Requests',      color: 'text-gold',          bg: 'bg-gold/8',          border: 'border-gold/15' },
  subscription_opportunity: { label: 'Save with a Sub',      color: 'text-emerald-400',   bg: 'bg-emerald-500/8',   border: 'border-emerald-500/15' },
};

interface Props {
  creator: MemberRecommendedCreator;
  type: RecommendationType;
  compact?: boolean;
}

export default function RecommendationCard({ creator, type, compact = false }: Props) {
  const badge = TYPE_BADGE[type] ?? TYPE_BADGE['trending'];

  return (
    <Link
      to={`/creator/${creator.username}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-hover border border-white/5 hover:border-gold/20 transition-all group"
    >
      {/* Avatar */}
      {creator.avatar_url ? (
        <img
          src={creator.avatar_url}
          alt={creator.display_name}
          className="w-8 h-8 rounded-full object-cover border border-white/10 flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-serif text-gold">{creator.display_name[0]?.toUpperCase()}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-xs font-medium text-white truncate">{creator.display_name}</p>
          <span className={`text-[9px] font-semibold px-1.5 py-px rounded border flex-shrink-0 ${badge.color} ${badge.bg} ${badge.border}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-[10px] text-arc-muted truncate">
          @{creator.username} · {formatCurrency(parseFloat(creator.subscription_price))}/mo
        </p>
        {!compact && (
          <p className="text-[10px] text-arc-secondary mt-0.5 truncate">{creator.reason}</p>
        )}
      </div>

      <ChevronRight className="w-3.5 h-3.5 text-arc-muted opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
    </Link>
  );
}
