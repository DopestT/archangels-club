import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import RecommendationCard, { RecommendationCardSkeleton, RecommendationCardProps } from './RecommendationCard';

export type StripFreshness = 'fresh' | 'stale' | 'fallback';
export type StripConfidence = 'high' | 'medium' | 'low';

export interface RecommendationStripProps {
  recommendations: RecommendationCardProps[];
  loading?: boolean;
  confidence?: StripConfidence;
  freshness?: StripFreshness;
  unlockedCount?: number;
  title?: string;
  hideWhenEmpty?: boolean;
}

const TRUST_NOTE: Record<StripConfidence, string> = {
  high: 'Based on your Vault and recent discovery.',
  medium: 'Based on your activity and platform signals.',
  low: 'Based on popular platform activity.',
};

const FRESHNESS_LABEL: Record<StripFreshness, { dot: string; text: string }> = {
  fresh: { dot: 'bg-arc-success', text: 'Signals updated' },
  stale: { dot: 'bg-amber-400', text: 'Signals refreshing…' },
  fallback: { dot: 'bg-white/20', text: 'Platform trends' },
};

function EmptyStateCold() {
  return (
    <div className="flex items-center justify-between py-3.5 px-1">
      <div className="flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-lg border border-gold/18 flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(212,175,55,0.06)',
          }}
        >
          <Sparkles
            className="w-3.5 h-3.5 text-gold/50"
            style={{ animation: 'shimmerIdle 3s ease-in-out infinite' }}
          />
        </div>
        <div>
          <p className="text-[12px] text-white/65 font-serif">Your Pulse is still learning.</p>
          <p className="text-[10px] text-arc-muted/70 mt-0.5">Explore a few profiles to wake the signal.</p>
        </div>
      </div>
      <Link
        to="/explore"
        className="flex-shrink-0 flex items-center gap-1 text-[10px] text-gold/80 hover:text-gold transition-colors ml-4"
      >
        Explore
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function EmptyStateWarm() {
  return (
    <div className="py-3.5 px-1">
      <div className="flex items-start gap-3">
        <div
          className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <Sparkles className="w-3.5 h-3.5 text-arc-muted" />
        </div>
        <div>
          <p className="text-[12px] text-white/60 font-serif">New creator signals are forming.</p>
          <p className="text-[10px] text-arc-muted mt-0.5 leading-relaxed">
            Collect or unlock more to sharpen your recommendations.
          </p>
          <p className="text-[9px] text-arc-muted/40 mt-2 italic">
            Recommended from real platform activity · No curated lists · No fake signals
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RecommendationStrip({
  recommendations,
  loading = false,
  confidence,
  freshness,
  unlockedCount = 0,
  title = 'Signal Intelligence',
  hideWhenEmpty = false,
}: RecommendationStripProps) {

  const hasData = recommendations.length > 0;
  const isEmpty = !loading && !hasData;

  if (isEmpty && hideWhenEmpty) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-0">
        <div className="flex items-center gap-2.5">
          <p className="text-[9px] font-bold tracking-[0.22em] uppercase text-arc-muted">{title}</p>
          {freshness && !loading && hasData && (
            <span className="flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${FRESHNESS_LABEL[freshness].dot}`}
                style={{ animation: freshness === 'fresh' ? 'pulseSignalDot 2.4s ease-in-out infinite' : undefined }}
              />
              <span className="text-[9px] text-arc-muted/50 italic">{FRESHNESS_LABEL[freshness].text}</span>
            </span>
          )}
        </div>
        {hasData && confidence && (
          <span className="text-[9px] text-arc-muted/45 italic max-w-[200px] text-right leading-snug">
            {TRUST_NOTE[confidence]}
          </span>
        )}
        {hasData && !confidence && (
          <span className="text-[9px] text-arc-muted/40 italic">
            Real signals only
          </span>
        )}
      </div>

      {/* Cards / states */}
      {loading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
          {[0, 1, 2, 3].map(i => (
            <RecommendationCardSkeleton key={i} delay={i * 60} />
          ))}
        </div>
      ) : isEmpty ? (
        unlockedCount > 0 ? <EmptyStateWarm /> : <EmptyStateCold />
      ) : (
        <>
          {/* Cards with right-edge fade when overflow likely */}
          <div className="relative">
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
              {recommendations.map((rec, i) => (
                <RecommendationCard
                  key={`${rec.signal}-${i}`}
                  {...rec}
                  revealDelay={i * 45}
                />
              ))}
            </div>
            {recommendations.length > 3 && (
              <div
                className="absolute right-0 top-0 bottom-2 w-14 pointer-events-none"
                style={{ background: 'linear-gradient(to right, transparent, rgba(10,10,14,0.92))' }}
              />
            )}
          </div>
          {/* Trust / freshness footer */}
          {(confidence === 'low' || freshness === 'fallback') && (
            <p className="text-[9px] text-arc-muted/30 italic mt-1.5 px-1">
              {freshness === 'fallback'
                ? 'Showing platform trends while your personal signal builds. No fake activity.'
                : 'Recommended from real platform activity. Based on popular signals, not your personal history.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
