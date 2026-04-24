import React from 'react';
import { Crown, Zap } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface PriceStackProps {
  price: number;
  subscriptionPrice: number;
  subscriberDiscountPct?: number;
  onUnlock?: () => void;
  onSubscribe?: () => void;
}

export default function PriceStack({ price, subscriptionPrice, subscriberDiscountPct = 0, onUnlock, onSubscribe }: PriceStackProps) {
  const discountedPrice = subscriberDiscountPct > 0 ? price * (1 - subscriberDiscountPct / 100) : price;
  const savings = price - discountedPrice;

  return (
    <div className="space-y-2">
      {/* Single unlock */}
      <div
        onClick={onUnlock}
        className={`flex items-center justify-between p-4 rounded-xl border border-white/10 ${onUnlock ? 'hover:border-gold/30 hover:bg-gold/4 cursor-pointer transition-all' : ''}`}
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-gold" />
          <div>
            <p className="text-sm font-medium text-white">Single Unlock</p>
            <p className="text-xs text-arc-muted">Permanent access to this content</p>
          </div>
        </div>
        <p className="font-serif text-xl text-gold">{formatCurrency(price)}</p>
      </div>

      {/* Subscription */}
      <div
        onClick={onSubscribe}
        className={`flex items-center justify-between p-4 rounded-xl border border-gold/20 bg-gold/5 ${onSubscribe ? 'hover:border-gold/40 hover:bg-gold/9 cursor-pointer transition-all' : ''}`}
      >
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-gold" />
          <div>
            <p className="text-sm font-medium text-gold">Subscribe</p>
            <p className="text-xs text-arc-muted">Unlock all subscriber content</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-serif text-xl text-gold">{formatCurrency(subscriptionPrice)}<span className="text-xs text-arc-muted font-sans">/mo</span></p>
          {subscriberDiscountPct > 0 && savings > 0 && (
            <p className="text-xs text-arc-success">Save {formatCurrency(savings)} on this post</p>
          )}
        </div>
      </div>

      {subscriberDiscountPct > 0 && (
        <p className="text-xs text-center text-arc-muted">
          Subscribers unlock this for <span className="text-gold">{formatCurrency(discountedPrice)}</span> — {subscriberDiscountPct}% off
        </p>
      )}
    </div>
  );
}
