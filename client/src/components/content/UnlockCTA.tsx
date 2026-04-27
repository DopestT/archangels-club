import React from 'react';
import { Lock, Crown, Zap } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import ActionButton from '../ui/ActionButton';

interface UnlockCTAProps {
  price: number;
  subscriptionPrice?: number;
  accessType: 'locked' | 'subscribers';
  subscriberDiscount?: number;
  unlockApiCall: () => Promise<Response>;
  subscribeApiCall?: () => Promise<Response>;
  disabled?: boolean;
}

export default function UnlockCTA({
  price,
  subscriptionPrice,
  accessType,
  subscriberDiscount = 0,
  unlockApiCall,
  subscribeApiCall,
  disabled,
}: UnlockCTAProps) {
  const discountedPrice = subscriberDiscount > 0 ? price * (1 - subscriberDiscount / 100) : price;

  if (accessType === 'subscribers') {
    return (
      <div className="p-5 rounded-2xl border border-gold/20 bg-gold/5 space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-gold" />
          <p className="text-sm font-medium text-white">Subscribers Only</p>
        </div>
        <p className="text-xs text-arc-secondary">This content is exclusive to active subscribers.</p>
        {subscribeApiCall && subscriptionPrice && (
          <ActionButton
            apiCall={subscribeApiCall}
            label={<><Crown className="w-4 h-4" />Subscribe for {formatCurrency(subscriptionPrice)}/mo</>}
            successLabel="Access granted"
            className="btn-gold w-full"
          />
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

      <ActionButton
        apiCall={unlockApiCall}
        label={<><Zap className="w-4 h-4" />Unlock for {formatCurrency(price)}</>}
        successLabel="Unlocked"
        className="btn-gold w-full"
        disabled={disabled}
      />

      {subscriberDiscount > 0 && subscribeApiCall && subscriptionPrice && (
        <div className="pt-3 border-t border-white/8">
          <p className="text-xs text-arc-muted mb-2">
            Subscribers pay only <span className="text-gold font-medium">{formatCurrency(discountedPrice)}</span> — save {subscriberDiscount}%
          </p>
          <ActionButton
            apiCall={subscribeApiCall}
            label={<><Crown className="w-3.5 h-3.5" />Subscribe for {formatCurrency(subscriptionPrice)}/mo</>}
            successLabel="Access granted"
            className="btn-outline w-full text-sm py-2.5"
          />
        </div>
      )}
    </div>
  );
}
