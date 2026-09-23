import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { resolveTimeZone } from "@/src/lib/timezone";

import {
  DEFAULT_DENSITY,
  DEFAULT_THEME,
  PREFERENCES_COOKIE_NAME,
} from "./constants";
import type { AppPreferences } from "./type";
import { preferencesCookieSchema } from "./validation";

export function parsePreferences(raw: string | undefined): AppPreferences {
  const fallback: AppPreferences = {
    theme: DEFAULT_THEME,
    density: DEFAULT_DENSITY,
    timeZone: null,
  };

  if (!raw) {
    return fallback;
  }

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return fallback;
  }

  const result = preferencesCookieSchema.safeParse(json);

  if (!result.success) {
    return fallback;
  }

  return {
    theme: result.data.theme,
    density: result.data.density,
    timeZone: result.data.timeZone ?? null,
  };
}


export const getPreferences = cache(async (): Promise<AppPreferences> => {
  const cookieStore = await cookies();

  return parsePreferences(cookieStore.get(PREFERENCES_COOKIE_NAME)?.value);
});


export function resolvedSchemeOnServer(
  preferences: AppPreferences,
): "light" | "dark" {
  return preferences.theme === "dark" ? "dark" : "light";
}

/** Class list for `<html>`, so the first paint already matches the preference. */
export function documentClassForPreferences(
  preferences: AppPreferences,
): string | undefined {
  return resolvedSchemeOnServer(preferences) === "dark" ? "dark" : undefined;
}

export function documentDataAttributesForPreferences(preferences: AppPreferences) {
  return { "data-density": preferences.density } as const;
}


export function preferencesTimeZone(preferences: AppPreferences): string {
  return resolveTimeZone(preferences.timeZone);
}