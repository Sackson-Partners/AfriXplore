'use client';

import { useSyncedLocalStorage } from './useLocalStorage';
import { UserPreferences, DEFAULT_PREFERENCES, mergePreferences } from '@/lib/preferences';

export function usePreferences() {
  const [preferences, setPreferences] = useSyncedLocalStorage<UserPreferences>(
    'ain-platform-preferences',
    DEFAULT_PREFERENCES
  );

  // Ensure preferences are merged with defaults (handles version upgrades)
  const safePreferences = mergePreferences(preferences);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences((prev) => ({
      ...prev,
      ...updates,
      library: { ...prev.library, ...updates.library },
      convergence: { ...prev.convergence, ...updates.convergence },
      events: { ...prev.events, ...updates.events },
      display: { ...prev.display, ...updates.display },
    }));
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  return {
    preferences: safePreferences,
    updatePreferences,
    resetPreferences,
  };
}
