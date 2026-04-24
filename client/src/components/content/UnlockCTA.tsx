import React from 'react';
import { Lock, Crown, Zap } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface UnlockCTAProps {
  price: number;
  subscriptionPrice?: number;
  accessType: 'locked' | 'subscribers';
  subscriberDiscount?: number;
  onUnlock: () => void;
  onSubscribe?: () => void;
  loading?: boolean;
}

export default function UnlockCTA({ price, subscriptionPrice, accessType, subscriberDiscount = 0, onUnlock, onSubscribe, loading }: UnlockCTAProps) {
  const discountedPrice = subscriberDiscount > 0 ? price * (1 - subscriberDiscount / 100) : price;

  if (accessType === 'subscribers') {
    return (
      <div className="p-5 rounded-2xl border border-gold/20 bg-gold/5 space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-gold" />
          <p className="text-sm font-medium text-white">Subscribers Only</p>
        </div>
        <p className="text-xs text-arc-secondary">This content is exclusive to active subscribers.</p>
        {onSubscribe && subscriptionPrice && (
          <button onClick={onSubscribe} className="btn-gold w-full">
            <Crown className="w-4 h-4" />
            Subscribe for {formatCurrency(subscriptionPrice)}/mo
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl border border-white/10 bg-bg-surface space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-arc-secondary" />
          <p className="text-sm font-medium text-white">Unlock Access</p>
        </div>
        <p className="font-serif text-2xl text-gold">{formatCurrency(price)}</p>
      </div>

      <button onClick={onUnlock} disabled={loading} className="btn-gold w-full">
        {loading
          ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          : <Zap className="w-4 h-4" />}
        Unlock for {formatCurrency(price)}
      </button>

      {subscriberDiscount > 0 && onSubscribe && subscriptionPrice && (
        <div className="pt-3 border-t border-white/8">
          <p className="text-xs text-arc-muted mb-2">
            Subscribers pay only <span className="text-gold font-medium">{formatCurrency(discountedPrice)}</span> — save {subscriberDiscount}%
          </p>
          <button onClick={onSubscribe} className="btn-outline w-full text-sm py-2.5">
            <Crown className="w-3.5 h-3.5" />
            Subscribe for {formatCurrency(subscriptionPrice)}/mo
          </button>
        </div>
      )}
    </div>
  );
}
