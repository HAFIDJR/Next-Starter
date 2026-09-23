"use client";

import { useState } from "react";

import {
  updateBrowserPreferences,
} from "@/src/features/preferences/preferences-apply";
import type {
  AppPreferences,
  DensityPreference,
  ThemePreference,
} from "@/src/features/preferences/type";

type Props = {
  /** From the preferences cookie, so the first paint and this state agree. */
  initial: AppPreferences;
};

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    value: "light",
    label: "Light theme",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path
          strokeLinecap="round"
          d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"
        />
      </svg>
    ),
  },
  {
    value: "system",
    label: "Match system theme",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="12" rx="2" />
        <path strokeLinecap="round" d="M8.5 20h7" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark theme",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.5 14.5A8.5 8.5 0 019.5 3.5a8.5 8.5 0 1011 11z" />
      </svg>
    ),
  },
];

const DENSITY_OPTIONS: Array<{ value: DensityPreference; label: string }> = [
  { value: "cozy", label: "Comfortable spacing" },
  { value: "compact", label: "Compact spacing" },
];

export default function PreferencesControls({ initial }: Props) {
  const [theme, setTheme] = useState<ThemePreference>(initial.theme);
  const [density, setDensity] = useState<DensityPreference>(initial.density);

  // No mount-time sync needed: `initial` comes from the same cookie the pre-paint
  // script read, so state, classes and markup already agree on the first render.

  function changeTheme(next: ThemePreference) {
    setTheme(next);
    updateBrowserPreferences({ theme: next });
  }

  function changeDensity(next: DensityPreference) {
    setDensity(next);
    updateBrowserPreferences({ density: next });
  }

  return (
    <div className="flex items-center gap-1.5 pr-1">
      <div
        role="group"
        aria-label="Color theme"
        className="flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5"
      >
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => changeTheme(option.value)}
            title={option.label}
            aria-label={option.label}
            aria-pressed={theme === option.value}
            className={`rounded-[0.625rem] p-1.5 transition-all active:scale-95 ${
              theme === option.value
                ? "bg-sunken text-ink shadow-sm"
                : "text-faint hover:text-muted"
            }`}
          >
            {option.icon}
          </button>
        ))}
      </div>

      <div
        role="group"
        aria-label="Row density"
        className="hidden items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5 sm:flex"
      >
        {DENSITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => changeDensity(option.value)}
            title={option.label}
            aria-label={option.label}
            aria-pressed={density === option.value}
            className={`rounded-[0.625rem] px-2 py-1 text-[11px] font-medium capitalize transition-all active:scale-95 ${
              density === option.value
                ? "bg-sunken text-ink shadow-sm"
                : "text-faint hover:text-muted"
            }`}
          >
            {option.value}
          </button>
        ))}
      </div>
    </div>
  );
}