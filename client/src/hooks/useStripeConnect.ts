/**
 * useStripeConnect — handles the full Stripe Connect onboarding flow.
 *
 * Flow:
 *   1. startOnboarding() → POST /api/creators/connect/onboard → redirects to Stripe
 *   2. Stripe redirects back to /dashboard/studio?connect=complete
 *   3. useEffect detects ?connect=complete → calls checkStatus()
 *   4. checkStatus() → GET /api/creators/connect/status → marks DB complete
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export interface ConnectStatus {
  complete: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  currently_due: string[];
  past_due: string[];
}

export interface UseStripeConnectReturn {
  isLoading:           boolean;
  isVerifying:         boolean;
  error:               string | null;
  status:              ConnectStatus | null;
  startOnboarding:     () => Promise<void>;
  checkStatus:         () => Promise<ConnectStatus | null>;
  openPayoutDashboard: () => Promise<void>;
}

export function useStripeConnect(): UseStripeConnectReturn {
  const [isLoading,   setIsLoading]   = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [status,      setStatus]      = useState<ConnectStatus | null>(null);

  // On mount: detect return from Stripe onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectParam = params.get('connect');

    if (connectParam === 'complete') {
      checkStatus().then(() => {
        window.history.replaceState({}, '', window.location.pathname);
      });
    } else if (connectParam === 'refresh') {
      setError('Your session expired. Click "Enable Payouts" to try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startOnboarding(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/creators/connect/onboard', { method: 'POST' });

      if (data.already_complete) {
        await checkStatus();
        return;
      }
      if (!data.url) throw new Error('No redirect URL returned from server.');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payout setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function checkStatus(): Promise<ConnectStatus | null> {
    setIsVerifying(true);
    setError(null);
    try {
      const data: ConnectStatus = await apiFetch('/api/creators/connect/status');
      setStatus(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check payout status.');
      return null;
    } finally {
      setIsVerifying(false);
    }
  }

  async function openPayoutDashboard(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/creators/connect/dashboard');
      if (!data.url) throw new Error('No dashboard URL returned.');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open payout dashboard.');
    } finally {
      setIsLoading(false);
    }
  }

  return { isLoading, isVerifying, error, status, startOnboarding, checkStatus, openPayoutDashboard };
}
