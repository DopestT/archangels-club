import React from 'react';
import { Package, ChevronRight, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../lib/utils';

interface PostPurchaseUpsellProps {
  bundleName?: string;
  bundlePrice?: number;
  bundleSavings?: number;
  relatedContent?: { id: string; title: string; price: number }[];
  subscriptionPrice?: number;
  onSubscribe?: () => void;
  onBundleUnlock?: () => void;
}

export default function PostPurchaseUpsell({ bundleName, bundlePrice, bundleSavings, relatedContent, subscriptionPrice, onSubscribe, onBundleUnlock }: PostPurchaseUpsellProps) {
  return (
    <div className="space-y-3">
      {bundleName && bundlePrice && (
        <div className="p-4 rounded-xl border border-gold/20 bg-gold/5">
          <div className="flex items-start gap-3">
            <Package className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white mb-0.5">{bundleName}</p>
              {bundleSavings && bundleSavings > 0 && (
                <p className="text-xs text-arc-success">Save {formatCurrency(bundleSavings)} with the bundle</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-serif text-gold">{formatCurrency(bundlePrice)}</p>
              <button onClick={onBundleUnlock} className="text-xs text-gold underline mt-0.5">Unlock bundle</button>
            </div>
          </div>
        </div>
      )}

      {relatedContent && relatedContent.length > 0 && (
        <div className="card-surface rounded-xl p-4">
          <p className="text-xs font-bold tracking-widest uppercase text-arc-muted mb-3">More to unlock</p>
          <div className="space-y-2">
            {relatedContent.map((c) => (
              <Link key={c.id} to={`/content/${c.id}`} className="flex items-center gap-3 py-1 hover:opacity-80 transition-opacity group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate group-hover:text-gold transition-colors">{c.title}</p>
                </div>
                <span className="text-sm font-serif text-gold flex-shrink-0">{formatCurrency(c.price)}</span>
                <ChevronRight className="w-3.5 h-3.5 text-arc-muted flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {subscriptionPrice && onSubscribe && (
        <button onClick={onSubscribe} className="w-full flex items-center justify-between p-4 rounded-xl border border-white/10 hover:border-gold/25 hover:bg-gold/5 transition-all group">
          <div className="flex items-center gap-3">
            <Crown className="w-4 h-4 text-gold" />
            <div className="text-left">
              <p className="text-sm text-white">Unlock everything</p>
              <p className="text-xs text-arc-muted">Subscribe for full access</p>
            </div>
          </div>
          <span className="font-serif text-gold">{formatCurrency(subscriptionPrice)}<span className="text-xs text-arc-muted font-sans">/mo</span></span>
        </button>
      )}
    </div>
  );
}
