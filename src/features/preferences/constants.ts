export const PREFERENCES_COOKIE_NAME = "taskly_prefs";

/** Non-httpOnly on purpose: the no-flash script and the toggle both write it. */
export const PREFERENCES_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const THEME_VALUES = ["light", "dark", "system"] as const;
export const DENSITY_VALUES = ["cozy", "compact"] as const;

export const DEFAULT_THEME = "system";
export const DEFAULT_DENSITY = "cozy";
