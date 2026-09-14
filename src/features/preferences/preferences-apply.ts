"use client";

import {
  DENSITY_VALUES,
  PREFERENCES_COOKIE_MAX_AGE_SECONDS,
  PREFERENCES_COOKIE_NAME,
  THEME_VALUES,
} from "./constants";
import type { AppPreferences, ResolvedColorScheme, ThemePreference } from "./type";
import { DEFAULT_DENSITY, DEFAULT_THEME } from "./constants";

/**
 * Browser-side mirror of `script.ts`: used by the toggle so a theme change is
 * applied to the live document and persisted for the next request, without a
 * round trip. Preferences are presentation, not secrets, so there is nothing to
 * validate on the server beyond `validation.ts`.
 */

const FALLBACK: AppPreferences = {
  theme: DEFAULT_THEME,
  density: DEFAULT_DENSITY,
  timeZone: null,
};

function readCookie(): AppPreferences {
  if (typeof document === "undefined") {
    return FALLBACK;
  }

  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${PREFERENCES_COOKIE_NAME}=`));

  if (!match) {
    return FALLBACK;
  }

  try {
    const parsed: unknown = JSON.parse(
      decodeURIComponent(match.slice(PREFERENCES_COOKIE_NAME.length + 1)),
    );

    if (typeof parsed !== "object" || parsed === null) {
      return FALLBACK;
    }

    const candidate = parsed as Record<string, unknown>;

    return {
      theme: (THEME_VALUES as readonly string[]).includes(String(candidate.theme))
        ? (candidate.theme as ThemePreference)
        : DEFAULT_THEME,
      density: (DENSITY_VALUES as readonly string[]).includes(
        String(candidate.density),
      )
        ? (candidate.density as AppPreferences["density"])
        : DEFAULT_DENSITY,
      timeZone:
        typeof candidate.timeZone === "string" ? candidate.timeZone : null,
    };
  } catch {
    return FALLBACK;
  }
}

function writeCookie(preferences: AppPreferences) {
  const attributes = [
    `${PREFERENCES_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(preferences))}`,
    "path=/",
    `max-age=${PREFERENCES_COOKIE_MAX_AGE_SECONDS}`,
    "samesite=lax",
  ];

  if (window.location.protocol === "https:") {
    attributes.push("secure");
  }

  document.cookie = attributes.join("; ");
}

export function systemScheme(): ResolvedColorScheme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveScheme(theme: ThemePreference): ResolvedColorScheme {
  return theme === "system" ? systemScheme() : theme;
}

export function applyPreferences(preferences: AppPreferences) {
  const root = document.documentElement;

  root.classList.toggle("dark", resolveScheme(preferences.theme) === "dark");
  root.dataset.density = preferences.density;
}

export function getBrowserPreferences(): AppPreferences {
  return {
    ...readCookie(),
    timeZone:
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      readCookie().timeZone ??
      null,
  };
}

export function updateBrowserPreferences(patch: Partial<AppPreferences>) {
  const next: AppPreferences = { ...readCookie(), ...patch };

  writeCookie(next);
  applyPreferences(next);

  return next;
}
