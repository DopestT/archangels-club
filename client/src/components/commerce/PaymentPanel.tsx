import React from 'react';
import { CreditCard, Zap, Crown, Lock } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import ActionButton from '../ui/ActionButton';

interface PaymentPanelProps {
  price: number;
  subscriptionPrice?: number;
  accessType: 'locked' | 'subscribers';
  subscriberDiscountPct?: number;
  unlockApiCall: () => Promise<Response>;
  subscribeApiCall?: () => Promise<Response>;
}

export default function PaymentPanel({
  price,
  subscriptionPrice,
  accessType,
  subscriberDiscountPct = 0,
  unlockApiCall,
  subscribeApiCall,
}: PaymentPanelProps) {
  const discountedPrice = subscriberDiscountPct > 0 ? price * (1 - subscriberDiscountPct / 100) : price;

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

      <div className="px-5 py-3 border-b border-white/8 flex items-center gap-3">
        <CreditCard className="w-4 h-4 text-arc-muted" />
        <span className="text-sm text-arc-secondary">•••• •••• •••• 4242</span>
        <span className="ml-auto text-xs text-arc-muted">VISA</span>
      </div>

      <div className="p-5 space-y-3">
        {accessType === 'locked' && (
          <ActionButton
            apiCall={unlockApiCall}
            label={<><Zap className="w-4 h-4" />Unlock for {formatCurrency(price)}</>}
            successLabel="Unlocked"
            className="btn-gold w-full py-3.5"
          />
        )}

        {subscriptionPrice && subscribeApiCall && (
          <ActionButton
            apiCall={subscribeApiCall}
            label={<><Crown className="w-4 h-4" />Subscribe — {formatCurrency(subscriptionPrice)}/mo</>}
            successLabel="Access granted"
            className="btn-outline w-full py-3"
          />
        )}

        <div className="flex items-center gap-1.5 text-xs text-arc-muted justify-center">
          <Lock className="w-3 h-3" />
          Secure payment · 80% goes directly to creator
        </div>
      </div>
    </div>
  );
}
