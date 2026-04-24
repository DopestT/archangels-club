import React, { useState } from 'react';
import { CreditCard, Zap, Crown, Lock } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface PaymentPanelProps {
  price: number;
  subscriptionPrice?: number;
  accessType: 'locked' | 'subscribers';
  subscriberDiscountPct?: number;
  onUnlock: () => Promise<void>;
  onSubscribe?: () => Promise<void>;
}

export default function PaymentPanel({ price, subscriptionPrice, accessType, subscriberDiscountPct = 0, onUnlock, onSubscribe }: PaymentPanelProps) {
  const [loading, setLoading] = useState<'unlock' | 'subscribe' | null>(null);
  const discountedPrice = subscriberDiscountPct > 0 ? price * (1 - subscriberDiscountPct / 100) : price;
  const platformFee = price * 0.2;
  const netToCreator = price * 0.8;

  async function handleUnlock() {
    setLoading('unlock');
    try { await onUnlock(); } finally { setLoading(null); }
  }
  async function handleSubscribe() {
    if (!onSubscribe) return;
    setLoading('subscribe');
    try { await onSubscribe(); } finally { setLoading(null); }
  }

  return (
    <div className="card-surface rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/8">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-arc-secondary">
            {accessType === 'locked' ? 'Unlock Price' : 'Subscription Required'}
          </p>
          <p className="font-serif text-2xl text-gold">{formatCurrency(price)}</p>
        </div>
        {subscriberDiscountPct > 0 && (
          <p className="text-xs text-arc-success text-right">
            Subscribers pay {formatCurrency(discountedPrice)} — {subscriberDiscountPct}% off
          </p>
        )}
      </div>

      {/* Placeholder payment method */}
      <div className="px-5 py-3 border-b border-white/8 flex items-center gap-3">
        <CreditCard className="w-4 h-4 text-arc-muted" />
        <span className="text-sm text-arc-secondary">•••• •••• •••• 4242</span>
        <span className="ml-auto text-xs text-arc-muted">VISA</span>
      </div>

      <div className="p-5 space-y-3">
        {accessType === 'locked' && (
          <button onClick={handleUnlock} disabled={loading !== null} className="btn-gold w-full py-3.5">
            {loading === 'unlock'
              ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <Zap className="w-4 h-4" />}
            Unlock for {formatCurrency(price)}
          </button>
        )}

        {subscriptionPrice && onSubscribe && (
          <button onClick={handleSubscribe} disabled={loading !== null} className="btn-outline w-full py-3">
            {loading === 'subscribe'
              ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <Crown className="w-4 h-4" />}
            Subscribe — {formatCurrency(subscriptionPrice)}/mo
          </button>
        )}

        <div className="flex items-center gap-1.5 text-xs text-arc-muted justify-center">
          <Lock className="w-3 h-3" />
          Secure payment · 80% goes directly to creator
        </div>
      </div>
    </div>
  );
}
