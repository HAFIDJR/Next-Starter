import type { DENSITY_VALUES, THEME_VALUES } from "./constants";

export type ThemePreference = (typeof THEME_VALUES)[number];
export type DensityPreference = (typeof DENSITY_VALUES)[number];
export type ResolvedColorScheme = "light" | "dark";

/**
 * The full contents of the preferences cookie.
 *
 * `timeZone` is recorded by the client on load so the server can answer
 * "what is due today?" with the same day boundaries the user sees. It is only a
 * display hint, never used for authorization.
 */
export type AppPreferences = {
  theme: ThemePreference;
  density: DensityPreference;
  timeZone: string | null;
};
