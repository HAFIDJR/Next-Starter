type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  formatterCache.set(timeZone, formatter);

  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The zone to render in: the user's own if we know it, else the runtime's. */
export function resolveTimeZone(candidate?: string | null): string {
  if (candidate && isValidTimeZone(candidate)) {
    return candidate;
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function readParts(date: Date, timeZone: string): Parts {
  const entries = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(entries.year),
    month: Number(entries.month),
    day: Number(entries.day),
    hour: Number(entries.hour) % 24,
    minute: Number(entries.minute),
    second: Number(entries.second),
  };
}

/** Offset (ms) between the zone's wall clock and UTC at a given instant. */
function zoneOffsetMs(timeZone: string, instant: number): number {
  const parts = readParts(new Date(instant), timeZone);

  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - instant
  );
}

export function fromZonedParts(
  parts: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
  },
  timeZone: string,
): number {
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
  );
  const firstGuess = naive - zoneOffsetMs(timeZone, naive);

  return naive - zoneOffsetMs(timeZone, firstGuess);
}

export function startOfZonedDay(
  instant: number | Date,
  timeZone: string,
): number {
  const date = instant instanceof Date ? instant : new Date(instant);
  const parts = readParts(date, timeZone);

  return fromZonedParts(
    { year: parts.year, month: parts.month, day: parts.day },
    timeZone,
  );
}

/** [start, end) of the calendar day the viewer is currently in. */
export function zonedDayRange(instant: number | Date, timeZone: string) {
  const start = startOfZonedDay(instant, timeZone);

  // Whole days, not `+1 day` on the calendar: `Asia/Jakarta` has no DST, and for
  // zones that do this matches how a "today" filter should behave at the edges.
  return { start, end: start + DAY_IN_MS };
}

export function zonedCalendarParts(instant: number | Date, timeZone: string) {
  const date = instant instanceof Date ? instant : new Date(instant);
  const parts = readParts(date, timeZone);

  return { year: parts.year, month: parts.month, day: parts.day };
}

export function zonedDayStartPlus(
  instant: number | Date,
  days: number,
  timeZone: string,
): number {
  const parts = zonedCalendarParts(instant, timeZone);

  return fromZonedParts({ ...parts, day: parts.day + days }, timeZone);
}

export function isSameZonedDay(
  left: number | Date,
  right: number | Date,
  timeZone: string,
): boolean {
  const leftDate = left instanceof Date ? left : new Date(left);
  const rightDate = right instanceof Date ? right : new Date(right);

  return (
    startOfZonedDay(leftDate, timeZone) === startOfZonedDay(rightDate, timeZone)
  );
}

export function zonedDaysBetween(
  from: number | Date,
  to: number | Date,
  timeZone: string,
): number {
  const fromDate = from instanceof Date ? from : new Date(from);
  const toDate = to instanceof Date ? to : new Date(to);

  return Math.round(
    (startOfZonedDay(toDate, timeZone) - startOfZonedDay(fromDate, timeZone)) /
      DAY_IN_MS,
  );
}

export function formatDatePart(
  instant: number | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  instant = instant instanceof Date ? instant : new Date(instant);

  // If the date is invalid (NaN timestamp), return fallback
  if (isNaN(instant.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(
    instant,
  );
}

export function formatTimePart(
  instant: number | Date,
  timeZone: string,
): string {
  const date = instant instanceof Date ? instant : new Date(instant);

  if (isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export { DAY_IN_MS };
