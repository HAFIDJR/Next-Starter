import { z } from "zod";

import {
  DEFAULT_DENSITY,
  DEFAULT_THEME,
  DENSITY_VALUES,
  THEME_VALUES,
} from "./constants";

export const preferencesCookieSchema = z.object({
  theme: z.enum(THEME_VALUES).catch(DEFAULT_THEME),
  density: z.enum(DENSITY_VALUES).catch(DEFAULT_DENSITY),
  timeZone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    .catch(undefined),
});

export type PreferencesCookie = z.infer<typeof preferencesCookieSchema>;