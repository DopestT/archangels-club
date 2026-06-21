import React, { createContext, useContext, useEffect, useState } from 'react';

export type FlagKey =
  | 'enable_live_rooms'
  | 'enable_gold_purchases'
  | 'enable_gold_gifts'
  | 'enable_vault_purchases'
  | 'enable_creator_uploads'
  | 'enable_creator_publishing'
  | 'enable_creator_onboarding'
  | 'enable_admin_moderation'
  | 'enable_launch_tuning_banner'
  | 'enable_email_notifications';

type FlagMap = Record<FlagKey, boolean>;

// Fail-open defaults — if the API is down, all features stay enabled
const ALL_ON: FlagMap = {
  enable_live_rooms:           true,
  enable_gold_purchases:       true,
  enable_gold_gifts:           true,
  enable_vault_purchases:      true,
  enable_creator_uploads:      true,
  enable_creator_publishing:   true,
  enable_creator_onboarding:   true,
  enable_admin_moderation:     true,
  enable_launch_tuning_banner: false,
  enable_email_notifications:  true,
};

interface FeatureFlagsCtx {
  flags: FlagMap;
  isLoaded: boolean;
  refresh: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsCtx>({
  flags: ALL_ON,
  isLoaded: false,
  refresh: async () => {},
});

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FlagMap>(ALL_ON);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch('/api/config/flags');
      if (res.ok) {
        const data = await res.json();
        if (data?.flags) setFlags({ ...ALL_ON, ...data.flags });
      }
    } catch {
      // Network failure — keep current flags (fail-open)
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    refresh();
    // Re-fetch flags every 60 seconds while the tab is open
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, isLoaded, refresh }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

export function useFeatureFlag(key: FlagKey): boolean {
  return useContext(FeatureFlagsContext).flags[key];
}
