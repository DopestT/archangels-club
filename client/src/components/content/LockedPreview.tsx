import React from 'react';
import { Lock } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface LockedPreviewProps {
  price?: number;
  accessType?: 'locked' | 'subscribers';
  onUnlock?: () => void;
  ctaText?: string;
  className?: string;
}

export default function LockedPreview({ price, accessType = 'locked', onUnlock, ctaText, className = '' }: LockedPreviewProps) {
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg-primary/65 backdrop-blur-md ${className}`}>
      <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center shadow-gold-sm">
        <Lock className="w-6 h-6 text-gold" />
      </div>
      {accessType === 'locked' && price !== undefined && price > 0 && (
        <p className="font-serif text-2xl text-gold">{formatCurrency(price)}</p>
      )}
      {accessType === 'subscribers' && (
        <p className="text-xs font-medium text-gold tracking-widest uppercase">Subscribers Only</p>
      )}
      {onUnlock && (
        <button onClick={onUnlock} className="btn-gold text-sm px-5 py-2.5">
          {ctaText ?? (accessType === 'subscribers' ? 'Subscribe to Unlock' : 'Unlock Access')}
        </button>
      )}
    </div>
  );
}
