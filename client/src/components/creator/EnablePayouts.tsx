/**
 * EnablePayouts — drop-in component for the Creator Studio payout card.
 *
 * Usage:
 *   import EnablePayouts from '@/components/creator/EnablePayouts';
 *   <EnablePayouts isAlreadyComplete={onboardingData?.steps?.payout_setup} onComplete={refetch} />
 */

import { useEffect } from 'react';
import { useStripeConnect } from '../../hooks/useStripeConnect';

interface EnablePayoutsProps {
  isAlreadyComplete?: boolean;
  onComplete?: () => void;
}

export default function EnablePayouts({ isAlreadyComplete = false, onComplete }: EnablePayoutsProps) {
  const {
    isLoading,
    isVerifying,
    error,
    status,
    startOnboarding,
    openPayoutDashboard,
  } = useStripeConnect();

  const complete = isAlreadyComplete || status?.complete === true;

  // Fire onComplete callback once verified
  useEffect(() => {
    if (status?.complete && onComplete) onComplete();
  }, [status?.complete, onComplete]);

  // ── Already connected ────────────────────────────────────────────────────
  if (complete) {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 text-lg">✓</span>
          <div>
            <p className="text-sm font-medium text-emerald-300">Payouts Active</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              You receive 70% of every payment — deposited weekly.
            </p>
          </div>
        </div>
        <button
          onClick={openPayoutDashboard}
          disabled={isLoading}
          className="text-xs font-medium text-gold hover:underline border border-gold/30 
                     rounded px-3 py-1.5 hover:bg-gold/5 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Opening…' : 'View Earnings →'}
        </button>
      </div>
    );
  }

  // ── Not yet connected ────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-bg-surface border border-white/8">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="text-gold text-lg mt-0.5 flex-shrink-0">⚡</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Enable payouts to start earning</p>
          <p className="text-xs text-arc-muted mt-0.5 leading-relaxed">
            Connect your bank via Stripe. Creators receive 70% of every payment — processed automatically.
          </p>

          {error && (
            <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
              <span>⚠</span> {error}
            </p>
          )}

          {isVerifying && (
            <p className="text-xs text-gold mt-1.5 animate-pulse">
              Verifying your account…
            </p>
          )}

          {status && !status.complete && status.currently_due.length > 0 && (
            <p className="text-xs text-orange-400 mt-1.5">
              Stripe needs more info before payouts can be activated.
            </p>
          )}
        </div>
      </div>

      <button
        onClick={startOnboarding}
        disabled={isLoading || isVerifying}
        className="flex-shrink-0 ml-4 flex items-center gap-1.5 text-xs font-semibold
                   bg-gold hover:bg-gold/90 text-black rounded px-3 py-2 
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <><span className="animate-spin inline-block">↻</span> Setting up…</>
        ) : (
          <><span>↗</span> Enable Payouts</>
        )}
      </button>
    </div>
  );
}
