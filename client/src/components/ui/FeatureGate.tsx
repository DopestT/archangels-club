import React from 'react';
import { useFeatureFlag, type FlagKey } from '../../context/FeatureFlagsContext';

interface FeatureGateProps {
  flag: FlagKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Default maintenance UI shown when a feature is disabled.
function MaintenanceMessage({ flag }: { flag: FlagKey }) {
  const LABELS: Record<FlagKey, string> = {
    enable_live_rooms:           'Live Rooms',
    enable_gold_purchases:       'Gold Purchases',
    enable_gold_gifts:           'Gold Gifts',
    enable_vault_purchases:      'Vault Access',
    enable_creator_uploads:      'Content Uploads',
    enable_creator_publishing:   'Content Publishing',
    enable_creator_onboarding:   'Creator Applications',
    enable_admin_moderation:     'Admin Moderation',
    enable_launch_tuning_banner: 'Launch Tuning',
    enable_email_notifications:  'Email Notifications',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-[#C8A96A]/10 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-[#C8A96A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
        </svg>
      </div>
      <p className="text-white/60 text-sm font-medium mb-1">{LABELS[flag]} — Premium Maintenance</p>
      <p className="text-white/35 text-xs max-w-xs">
        This feature is temporarily offline for tuning. Existing access and paid content remain intact.
        We'll be back shortly.
      </p>
    </div>
  );
}

/**
 * Renders children only when the named flag is enabled.
 * Shows a premium maintenance message (or custom fallback) when disabled.
 */
export function FeatureGate({ flag, children, fallback }: FeatureGateProps) {
  const enabled = useFeatureFlag(flag);
  if (!enabled) return <>{fallback ?? <MaintenanceMessage flag={flag} />}</>;
  return <>{children}</>;
}
