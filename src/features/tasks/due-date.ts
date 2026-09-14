import {
  formatDatePart,
  formatTimePart,
  fromZonedParts,
  isSameZonedDay,
  startOfZonedDay,
  zonedDayStartPlus,
  zonedDaysBetween,
} from "@/src/lib/timezone";

/**
 * Natural-language due dates, shared verbatim by the client (live preview) and
 * the server (authoritative parse). No date library: ordered regexes plus
 * calendar math in the viewer's zone.
 *
 * Day-only dates are stored at 23:59 in that zone, so "file taxes" typed at
 * 10am is not instantly overdue, while "friday 9am" is.
 */

export const ALL_DAY_TIME = "23:59";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const WEEKDAY_ALIASES: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_ALIASES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, twelve: 12,
};

const WEEKDAY_TOKEN =
  "sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday";
const MONTH_TOKEN =
  "jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december";

type ParseContext = { now: number; timeZone: string };

type DateHit = {
  start: number;
  end: number;
  /** Zoned midnight of the referenced day. */
  dayStart: number;
  /** Set for phrases that name an exact instant (`in 2 hours`). */
  instant?: number;
};

type TimeHit = { start: number; end: number; hour: number; minute: number };

function dayOffset(context: ParseContext, days: number) {
  return zonedDayStartPlus(context.now, days, context.timeZone);
}

function weekdayIndex(instant: number, timeZone: string): number {
  const index = WEEKDAY_SHORT.indexOf(
    formatDatePart(instant, timeZone, { weekday: "short" }),
  );

  return index === -1 ? 0 : index;
}

/** The next 1..7 future days, looking for a matching weekday. */
function nextWeekdayStart(context: ParseContext, target: number): number {
  for (let offset = 1; offset <= 7; offset += 1) {
    const dayStart = dayOffset(context, offset);

    if (weekdayIndex(dayStart, context.timeZone) === target) {
      return dayStart;
    }
  }

  return dayOffset(context, 1);
}

function calendarParts(instant: number | Date, timeZone: string) {
  return {
    year: Number(formatDatePart(instant, timeZone, { year: "numeric" })),
    month: Number(formatDatePart(instant, timeZone, { month: "2-digit" })),
    day: Number(formatDatePart(instant, timeZone, { day: "2-digit" })),
  };
}

/** `12/9` without a year means the next 12 Sep that has not passed yet. */
function rollForward(month: number, day: number, context: ParseContext): number {
  const year = calendarParts(context.now, context.timeZone).year;
  const build = (targetYear: number) =>
    fromZonedParts({ year: targetYear, month, day }, context.timeZone);

  const candidate = build(year);
  const todayStart = startOfZonedDay(context.now, context.timeZone);

  return candidate < todayStart ? build(year + 1) : candidate;
}

const DATE_RULES: Array<{
  pattern: RegExp;
  resolve: (match: RegExpExecArray, context: ParseContext) => Omit<DateHit, "start" | "end"> | null;
}> = [
  {
    // 2026-09-20
    pattern: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
    resolve: (match, context) => {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }

      return {
        dayStart: fromZonedParts({ year, month, day }, context.timeZone),
      };
    },
  },
  {
    // 20/9 or 20.09.26 — day first, the Indonesian convention
    pattern: new RegExp(`\\b(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?\\b`),
    resolve: (match, context) => {
      const day = Number(match[1]);
      const month = Number(match[2]);

      if (day < 1 || day > 31 || month < 1 || month > 12) {
        return null;
      }

      const rawYear = match[3];

      if (!rawYear) {
        return { dayStart: rollForward(month, day, context) };
      }

      const year = Number(rawYear.length === 2 ? `20${rawYear}` : rawYear);

      return { dayStart: fromZonedParts({ year, month, day }, context.timeZone) };
    },
  },
  {
    pattern: /\b(?:tomorrow|tmrw|tmrrw|tmr|tom)\b/i,
    resolve: (_match, context) => ({ dayStart: dayOffset(context, 1) }),
  },
  {
    pattern: /\bnext week\b/i,
    resolve: (_match, context) => ({ dayStart: dayOffset(context, 7) }),
  },
  {
    // next friday = this coming friday + 7
    pattern: new RegExp(`\\bnext\\s+(${WEEKDAY_TOKEN})\\b`, "i"),
    resolve: (match, context) => {
      const target = WEEKDAY_ALIASES[match[1].toLowerCase()];

      if (target === undefined) {
        return null;
      }

      return { dayStart: nextWeekdayStart(context, target) + DAY };
    },
  },
  {
    // friday / on friday / this friday
    pattern: new RegExp(`\\b(?:on|this|by)?\\s*(${WEEKDAY_TOKEN})\\b`, "i"),
    resolve: (match, context) => {
      const target = WEEKDAY_ALIASES[match[1].toLowerCase()];

      if (target === undefined) {
        return null;
      }

      if (weekdayIndex(context.now, context.timeZone) === target) {
        return { dayStart: startOfZonedDay(context.now, context.timeZone) };
      }

      return { dayStart: nextWeekdayStart(context, target) };
    },
  },
  {
    pattern: /\b(today|tod)\b/i,
    resolve: (_match, context) => ({
      dayStart: startOfZonedDay(context.now, context.timeZone),
    }),
  },
  {
    // 20 sep / sep 20
    pattern: new RegExp(
      `\\b(?:(\\d{1,2})\\s+(${MONTH_TOKEN})|(${MONTH_TOKEN})\\.?\\s+(\\d{1,2}))\\b`,
      "i",
    ),
    resolve: (match, context) => {
      const day = Number(match[1] ?? match[4]);
      const month = MONTH_ALIASES[String(match[2] ?? match[3]).toLowerCase()];

      if (!month || !day || day < 1 || day > 31) {
        return null;
      }

      return { dayStart: rollForward(month, day, context) };
    },
  },
  {
    // in 3 days / in two hours
    pattern:
      /\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mo)\b/i,
    resolve: (match, context) => resolveRelative(match[1], match[2], context),
  },
  {
    // 3d / 2h / 1w shorthand, with or without the "in" prefix — consuming `in`
    // here is what stops "ship v2 in 5d" from leaving a dangling word behind.
    pattern: /\b(?:in\s+)?(\d+)\s*(mins?|minutes?|m|hrs?|hours?|h|days?|d|weeks?|w)\b/i,
    resolve: (match, context) => resolveRelative(match[1], match[2], context),
  },
];

function resolveRelative(
  rawAmount: string,
  rawUnit: string,
  context: ParseContext,
): Omit<DateHit, "start" | "end"> | null {
  const amount = NUMBER_WORDS[rawAmount.toLowerCase()] ?? Number(rawAmount);

  if (!amount || Number.isNaN(amount)) {
    return null;
  }

  const unit = rawUnit.toLowerCase();

  if (unit.startsWith("min") || unit === "m") {
    return { dayStart: context.now, instant: context.now + amount * MINUTE };
  }

  if (unit.startsWith("h")) {
    return { dayStart: context.now, instant: context.now + amount * HOUR };
  }

  if (unit.startsWith("w")) {
    return { dayStart: dayOffset(context, amount * 7) };
  }

  if (unit.startsWith("d")) {
    return { dayStart: dayOffset(context, amount) };
  }

  if (unit.startsWith("mo")) {
    // Months are approximated at 30 days on purpose: a month-granularity
    // reminder does not need calendar-exact math, and it keeps this file honest.
    return { dayStart: dayOffset(context, amount * 30) };
  }

  return null;
}

const TIME_RULES: Array<{
  pattern: RegExp;
  resolve: (match: RegExpExecArray) => Omit<TimeHit, "start" | "end"> | null;
}> = [
  {
    // 9:30pm
    pattern: /\b(1[0-2]|0?[1-9]):([0-5]\d)\s*(am|pm)\b/i,
    resolve: (match) => ({
      hour: to24(Number(match[1]), match[2]),
      minute: Number(match[3]),
    }),
  },
  {
    // 9am
    pattern: /\b(1[0-2]|0?[1-9])\s*(am|pm)\b/i,
    resolve: (match) => ({ hour: to24(Number(match[1]), match[2]), minute: 0 }),
  },
  {
    // at 18:30 / @18:30
    pattern: /(?:^|[\s,(])(?:at|@)\s*(2[0-3]|[01]?\d):([0-5]\d)\b/i,
    resolve: (match) => ({ hour: Number(match[1]), minute: Number(match[2]) }),
  },
  {
    pattern: /\b(noon|midnight|morning|afternoon|evening|tonight|night)\b/i,
    resolve: (match) => {
      switch (match[1].toLowerCase()) {
        case "noon":
          return { hour: 12, minute: 0 };
        case "midnight":
          return { hour: 0, minute: 0 };
        case "morning":
          return { hour: 9, minute: 0 };
        case "afternoon":
          return { hour: 14, minute: 0 };
        case "tonight":
          return { hour: 20, minute: 0 };
        default:
          return { hour: 18, minute: 0 };
      }
    },
  },
];

function to24(hour: number, meridiem: string) {
  const suffix = meridiem.toLowerCase();

  if (suffix === "am") {
    return hour === 12 ? 0 : hour;
  }

  return hour === 12 ? 12 : hour + 12;
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}

function cleanTitle(raw: string) {
  return raw
    .replace(/^\s*(?:due(?:\s+date)?|when)\s*[:\-]?\s*/i, "")
    .replace(/\s*(?:due|due on|due date|by|for|on|at)\s*$/i, "")
    .replace(/[,;:.\-]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:.\-]+/, "")
    .trim();
}

export type ParsedDraft = {
  /** Input with the due phrases removed, or the untouched input when nothing parsed. */
  title: string;
  dueAt: Date | null;
  hasTime: boolean;
  /** Phrases that were consumed, so the UI can show what was understood. */
  consumed: string[];
};

export function parseDueText(
  input: string,
  options: { now?: Date; timeZone: string },
): ParsedDraft {
  const context: ParseContext = {
    now: (options.now ?? new Date()).getTime(),
    timeZone: options.timeZone,
  };

  const text = input.trim();
  const consumed: string[] = [];
  const ranges: Array<{ start: number; end: number }> = [];

  let date: DateHit | null = null;

  for (const rule of DATE_RULES) {
    const match = rule.pattern.exec(text);

    if (!match) {
      continue;
    }

    const resolved = rule.resolve(match, context);

    if (!resolved) {
      continue;
    }

    date = {
      ...resolved,
      start: match.index,
      end: match.index + match[0].length,
    };
    ranges.push({ start: date.start, end: date.end });
    consumed.push(text.slice(date.start, date.end).trim());
    break;
  }

  let time: TimeHit | null = null;

  if (date?.instant === undefined) {
    for (const rule of TIME_RULES) {
      const match = rule.pattern.exec(text);

      if (!match) {
        continue;
      }

      const candidate = { start: match.index, end: match.index + match[0].length };

      if (ranges.some((range) => overlaps(candidate, range))) {
        continue;
      }

      const resolved = rule.resolve(match);

      if (!resolved) {
        continue;
      }

      time = { ...candidate, ...resolved };
      ranges.push(candidate);
      consumed.push(text.slice(candidate.start, candidate.end).trim());
      break;
    }
  }

  if (!date && !time) {
    return { title: text, dueAt: null, hasTime: false, consumed: [] };
  }

  let dueAt: number;
  let hasTime = time !== null;

  if (date?.instant !== undefined && date !== null) {
    dueAt = date.instant as number;
    hasTime = true;
  } else {
    const dayStart =
      date?.dayStart ?? startOfZonedDay(context.now, context.timeZone);

    if (time) {
      const parts = calendarParts(dayStart, context.timeZone);
      const stamp = fromZonedParts(
        { ...parts, hour: time.hour, minute: time.minute },
        context.timeZone,
      );

      // A bare time that already passed means tomorrow.
      dueAt = date || stamp >= context.now ? stamp : stamp + DAY;
    } else {
      dueAt = dayStart + 23 * HOUR + 59 * MINUTE;
      hasTime = false;
    }
  }

  let title = text;

  for (const range of ranges.sort((a, b) => b.start - a.start)) {
    title = `${title.slice(0, range.start)} ${title.slice(range.end)}`;
  }

  title = cleanTitle(title);

  if (!title) {
    // "tomorrow" on its own is a title, not a task with a date.
    return { title: text, dueAt: null, hasTime: false, consumed: [] };
  }

  return { title, dueAt: new Date(dueAt), hasTime, consumed };
}

export type DueTone = "overdue" | "today" | "soon" | "future";

export type DueDescription = {
  text: string;
  tone: DueTone;
  allDay: boolean;
  daysAway: number;
};

export function isAllDayDue(dueAt: Date, timeZone: string): boolean {
  return formatTimePart(dueAt, timeZone) === ALL_DAY_TIME;
}

/**
 * Formats a due date for `timeZone`. `now` is injected (from the server) so the
 * first paint agrees with every later client render — calling `new Date()`
 * inside render would be a hydration mismatch waiting to happen.
 */
export function describeDue(
  dueAt: Date | null,
  options: { now: Date; timeZone: string; completed?: boolean },
): DueDescription | null {
  if (!dueAt) {
    return null;
  }

  const { now, timeZone } = options;
  const allDay = isAllDayDue(dueAt, timeZone);
  const daysAway = zonedDaysBetween(now, dueAt, timeZone);
  const passed = dueAt.getTime() < now.getTime();

  let dayLabel: string;

  if (daysAway === 0) {
    dayLabel = "Today";
  } else if (daysAway === 1) {
    dayLabel = "Tomorrow";
  } else if (daysAway === -1) {
    dayLabel = "Yesterday";
  } else if (daysAway > 1 && daysAway <= 6) {
    dayLabel = formatDatePart(dueAt, timeZone, { weekday: "short" });
  } else if (daysAway < -1 && daysAway >= -6) {
    dayLabel = `${Math.abs(daysAway)} days overdue`;
  } else {
    const sameYear =
      formatDatePart(now, timeZone, { year: "numeric" }) ===
      formatDatePart(dueAt, timeZone, { year: "numeric" });

    dayLabel = formatDatePart(dueAt, timeZone, {
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    });
  }

  let tone: DueTone;

  if (options.completed) {
    tone = "future";
  } else if (passed || daysAway < 0) {
    tone = "overdue";
  } else if (daysAway === 0) {
    tone = "today";
  } else if (daysAway <= 2) {
    tone = "soon";
  } else {
    tone = "future";
  }

  return {
    text: allDay
      ? dayLabel
      : `${dayLabel} · ${formatTimePart(dueAt, timeZone)}`,
    tone,
    allDay,
    daysAway,
  };
}

/** For `<input type="datetime-local">`, which needs zoned wall-clock fields. */
export function toDateTimeLocalValue(dueAt: Date | null, timeZone: string): string {
  if (!dueAt) {
    return "";
  }

  const parts = calendarParts(dueAt, timeZone);
  const [hour, minute] = formatTimePart(dueAt, timeZone).split(":");

  return [
    `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    `${hour}:${minute}`,
  ].join("T");
}

/** Local wall time from `<input type="datetime-local">` → real instant in `timeZone`. */
export function fromDateTimeLocalValue(
  value: string,
  timeZone: string,
): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());

  if (!match) {
    return null;
  }

  const instant = fromZonedParts(
    {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
    },
    timeZone,
  );

  return Number.isFinite(instant) ? new Date(instant) : null;
}

export { isSameZonedDay };
