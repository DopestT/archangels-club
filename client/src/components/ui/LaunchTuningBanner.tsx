import React from 'react';
import { useFeatureFlag } from '../../context/FeatureFlagsContext';

export function LaunchTuningBanner() {
  const show = useFeatureFlag('enable_launch_tuning_banner');
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-[#C8A96A] text-black text-center py-2 px-4 text-xs font-semibold tracking-wide z-50"
    >
      Archangels Club is currently in launch tuning. Some features may be briefly unavailable.
      Thank you for your patience.
    </div>
  );
}
