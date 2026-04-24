import React from 'react';
import { Package, Zap } from 'lucide-react';
import type { Bundle } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface BundleCardProps {
  bundle: Bundle;
  onUnlock?: () => void;
  loading?: boolean;
}

export default function BundleCard({ bundle, onUnlock, loading }: BundleCardProps) {
  const savings = bundle.individual_total - bundle.bundle_price;
  const savingsPct = Math.round((savings / bundle.individual_total) * 100);

  return (
    <div className="card-surface rounded-xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
          <Package className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-serif text-base text-white">{bundle.name}</p>
            {savingsPct > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-arc-success/10 border border-arc-success/25 text-arc-success">
                SAVE {savingsPct}%
              </span>
            )}
          </div>
          <p className="text-xs text-arc-muted mt-0.5">{bundle.content_ids.length} posts included</p>
        </div>
      </div>

      {bundle.description && (
        <p className="text-xs text-arc-secondary leading-relaxed mb-4">{bundle.description}</p>
      )}

      {bundle.content_titles && bundle.content_titles.length > 0 && (
        <div className="space-y-1 mb-4">
          {bundle.content_titles.slice(0, 4).map((t, i) => (
            <p key={i} className="text-xs text-arc-muted flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-gold/50 flex-shrink-0" />
              {t}
            </p>
          ))}
          {bundle.content_titles.length > 4 && (
            <p className="text-xs text-arc-muted pl-2.5">+{bundle.content_titles.length - 4} more</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/8">
        <div>
          <p className="font-serif text-xl text-gold">{formatCurrency(bundle.bundle_price)}</p>
          {savings > 0 && (
            <p className="text-xs text-arc-muted line-through">{formatCurrency(bundle.individual_total)}</p>
          )}
        </div>
        {onUnlock && (
          <button onClick={onUnlock} disabled={loading} className="btn-gold text-sm px-5 py-2.5">
            <Zap className="w-4 h-4" />
            Unlock Bundle
          </button>
        )}
      </div>
    </div>
  );
}
