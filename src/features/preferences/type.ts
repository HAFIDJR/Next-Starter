import type { DENSITY_VALUES, THEME_VALUES } from "./constants";

export type ThemePreference = (typeof THEME_VALUES)[number];
export type DensityPreference = (typeof DENSITY_VALUES)[number];
export type ResolvedColorScheme = "light" | "dark";

export type AppPreferences = {
  theme: ThemePreference;
  density: DensityPreference;
  timeZone: string | null;
};