// Pure aggregation-intent detection for Ask Sunshine v2 - no Supabase, no
// AI, no UI. Detects whether an Ask Sunshine query is asking for a
// count/total rather than a plain keyword search, and if so, whether it
// also looks like a workout_entries-backed question (an activity term
// plus optionally a calendar-aligned date range). Follows the same
// discipline as resolveTemporal.ts's risk-flag/recurrence-phrase
// detection: small named term lists, not general dictionaries - scope up
// if real queries show more phrasings.
//
// Called from both app/(dashboard)/ask/page.tsx (client, to decide
// whether to fire the aggregation route at all) and
// app/api/ask-sunshine-v2/route.ts (server, as the authoritative source
// for what actually gets queried - the route re-derives everything from
// the raw query itself rather than trusting client-computed structured
// fields, since activityQuery feeds directly into an ilike pattern).

import { tokenizeSearchQuery } from "./searchCaptures";

export function isAggregationQuery(query: string): boolean {
  return /\bhow many\b|\bhow much\b|\btotal\b|\bcount\b/i.test(query);
}

export type DateRange = {
  start: string; // YYYY-MM-DD, inclusive - matches workout_entries.date's plain `date` type
  end: string; // YYYY-MM-DD, exclusive
  label: string; // "this month", "this week", etc. - display text for the answer
};

function toDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Sunday-start, matching WeekStrip.tsx's own startOfWeek convention
// (date.getDate() - date.getDay()) - not re-exported from there since
// it's a local, unexported helper in a component file, but the same
// calculation.
function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const DATE_RANGE_PATTERNS: [RegExp, string, (ref: Date) => { start: Date; end: Date }][] = [
  [
    /\btoday\b/i,
    "today",
    (ref) => {
      const start = startOfDay(ref);
      return { start, end: addDays(start, 1) };
    },
  ],
  [
    /\bthis week\b/i,
    "this week",
    (ref) => {
      const start = startOfWeek(ref);
      return { start, end: addDays(start, 7) };
    },
  ],
  [
    /\blast month\b/i,
    "last month",
    (ref) => ({
      start: new Date(ref.getFullYear(), ref.getMonth() - 1, 1),
      end: new Date(ref.getFullYear(), ref.getMonth(), 1),
    }),
  ],
  [
    /\bthis month\b/i,
    "this month",
    (ref) => ({
      start: new Date(ref.getFullYear(), ref.getMonth(), 1),
      end: new Date(ref.getFullYear(), ref.getMonth() + 1, 1),
    }),
  ],
  [
    /\bthis year\b/i,
    "this year",
    (ref) => ({
      start: new Date(ref.getFullYear(), 0, 1),
      end: new Date(ref.getFullYear() + 1, 0, 1),
    }),
  ],
];

function detectDateRange(query: string, referenceDate: Date): DateRange | null {
  for (const [pattern, label, buildRange] of DATE_RANGE_PATTERNS) {
    if (pattern.test(query)) {
      const { start, end } = buildRange(referenceDate);
      return { start: toDateKey(start), end: toDateKey(end), label };
    }
  }
  return null;
}

const MINUTES_METRIC_PATTERN = /\bminutes?\b|\bmins?\b|\bduration\b/i;

// v2 only supports summing rounds or total_duration_minutes - "how many
// TIMES did I box" (a session count, not a sum) is a real, different
// third shape this deliberately doesn't cover yet (would need count(*)
// instead of sum()). Flagging the gap rather than silently answering the
// wrong question - defaults to "rounds" whenever the query doesn't
// clearly ask for minutes/duration.
function detectMetric(query: string): "rounds" | "minutes" {
  return MINUTES_METRIC_PATTERN.test(query) ? "minutes" : "rounds";
}

// Everything that isn't the activity itself: the base FILLER_WORDS
// searchCaptures.ts already strips (how/many/what/of/did/a/etc.), plus
// aggregation-specific filler (much/total/count), plus the date-range and
// metric vocabulary above - so "how many rounds did I box this month"
// reduces to just "box", not "box rounds this month". "did" is deliberately
// NOT repeated here - it's already in searchCaptures.ts's base FILLER_WORDS
// (tokenizeSearchQuery, called below, strips it before this set is ever
// checked), so listing it twice would just be dead code inviting the two
// lists to drift out of sync with each other.
const AGGREGATION_EXTRA_FILLER = new Set([
  "much",
  "total",
  "count",
  "do",
  "does",
  "i",
  "my",
  "this",
  "last",
  "week",
  "month",
  "year",
  "today",
  "round",
  "rounds",
  "minute",
  "minutes",
  "min",
  "mins",
  "duration",
]);

function extractActivityQuery(query: string): string | null {
  const tokens = tokenizeSearchQuery(query).filter((token) => !AGGREGATION_EXTRA_FILLER.has(token));
  return tokens.length > 0 ? tokens.join(" ") : null;
}

export type WorkoutQueryIntent = {
  activityQuery: string;
  metric: "rounds" | "minutes";
  dateRange: DateRange | null;
};

// Null whenever the query isn't aggregation-shaped at all, OR it is but
// nothing meaningful is left once filler/date/metric words are stripped
// (e.g. a bare "how many" with nothing else). No hardcoded "looks like a
// workout question" keyword whitelist - activityQuery is deliberately
// whatever's left over for ANY aggregation-shaped query, workout-related
// or not (e.g. "how many times did I go to the dentist" produces
// activityQuery "times go to the dentist"). The disambiguation happens
// downstream, in the route's ilike match against real activity_type
// values - unrelated text simply won't match any row, which is a
// simpler and more robust filter than trying to keep a workout-specific
// keyword list in sync with whatever activity_type strings the AI has
// actually written.
export function detectWorkoutQuery(
  query: string,
  referenceDate: Date = new Date()
): WorkoutQueryIntent | null {
  if (!isAggregationQuery(query)) return null;

  const activityQuery = extractActivityQuery(query);
  if (!activityQuery) return null;

  return {
    activityQuery,
    metric: detectMetric(query),
    dateRange: detectDateRange(query, referenceDate),
  };
}
