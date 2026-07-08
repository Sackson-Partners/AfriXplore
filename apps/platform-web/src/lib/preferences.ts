export interface UserPreferences {
  // Library view preferences
  library: {
    viewMode: 'grid' | 'list';
    sortBy: 'name' | 'dpi' | 'convergence' | 'country';
    sortOrder: 'asc' | 'desc';
    filters: {
      countries: string[];
      commodities: string[];
      systemType: string;
      dpiMin: number;
    };
  };

  // Convergence preferences
  convergence: {
    scoreFilter: 'all' | 'certified' | 'high' | 'medium';
    pageSize: number;
  };

  // Events preferences
  events: {
    pageSize: number;
  };

  // Display preferences
  display: {
    dismissedAlerts: string[];
    theme: 'dark' | 'light';
  };
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  library: {
    viewMode: 'list',
    sortBy: 'name',
    sortOrder: 'asc',
    filters: {
      countries: [],
      commodities: [],
      systemType: 'All',
      dpiMin: 0,
    },
  },
  convergence: {
    scoreFilter: 'all',
    pageSize: 20,
  },
  events: {
    pageSize: 20,
  },
  display: {
    dismissedAlerts: [],
    theme: 'dark',
  },
};

/**
 * Merge partial preferences with defaults
 */
export function mergePreferences(
  stored: Partial<UserPreferences> | null
): UserPreferences {
  if (!stored) return DEFAULT_PREFERENCES;

  return {
    library: { ...DEFAULT_PREFERENCES.library, ...stored.library },
    convergence: { ...DEFAULT_PREFERENCES.convergence, ...stored.convergence },
    events: { ...DEFAULT_PREFERENCES.events, ...stored.events },
    display: { ...DEFAULT_PREFERENCES.display, ...stored.display },
  };
}
