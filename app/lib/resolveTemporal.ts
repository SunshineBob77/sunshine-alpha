// Pure temporal-resolution logic - no Supabase, no AI API calls, no UI.
// Decides how confidently a Drop's detected date/time can be trusted, and
// when it can't, what needs to go to (or come back from) the AI/UI layer.

export type RiskFlag = "vague_anchor" | "bare_hour" | "dropped_qualifier" | "abbreviation";

export type LocalCandidate = {
  raw: string;
  iso: string;
  hasTime: boolean;
  hasYear: boolean;
};

export type TemporalResolutionInput = {
  rawText: string;
  referenceDatetime: string;
  captureTimezone: string;
  localCandidates: LocalCandidate[];
  riskFlags: RiskFlag[];
};

export type TemporalResolutionOutput = {
  eventAt: string | null;
  eventHasTime: boolean | null;
  eventTimezone: string | null;
  eventStatus: "none" | "resolved" | "unresolved" | "dismissed";
  temporalConfidence: "high" | "low" | null;
  temporalRawText: string | null;
  recurring: boolean;
  // "yearly" is the narrow structured birthday/anniversary path below.
  // "day"/"week"/"month"/"year" are the general NUMERIC-INTERVAL path
  // (detectNumericRecurrence) - always paired with recurrenceInterval.
  // Non-numeric general recurrence ("every Monday", "monthly") leaves
  // this null and describes itself via recurrenceRawText alone, same as
  // before - it never had structured recurrenceType data to begin with.
  recurrenceType: "yearly" | "day" | "week" | "month" | "year" | null;
  // Raw recurring phrase for the GENERAL case ("every Monday", "monthly",
  // "every other week", "every 3 months") - separate from recurrenceType.
  // Still populated for the numeric-interval path too (display source for
  // describeRecurrence), even though that path also gets structured data.
  recurrenceRawText: string | null;
  // Multiplier for the numeric-interval path only (e.g. 3 for "every 3
  // months"). Null for every other path, including the "yearly" birthday
  // path (which has no interval concept) and non-numeric general phrases.
  recurrenceInterval: number | null;
};

// ---- Risk flag detection -------------------------------------------------

// Phrases that anchor to an imprecise point in time - chrono (or a human)
// has to pick a single instant out of something inherently fuzzy.
const VAGUE_ANCHOR_TERMS = ["weekend", "next week", "a couple", "sometime", "around"];

// Qualifiers that change the meaning of a time but are easy to silently
// drop during parsing (e.g. "EOD Friday" resolving to noon Friday, losing
// "end of day" entirely - confirmed as a real failure mode this session).
const DROPPED_QUALIFIER_TERMS = ["EOD", "ASAP"];

// "ish" is handled separately from the plain word list below: it needs to
// match both a standalone word ("Friday, ish") and a digit-glued suffix
// ("3ish"), but must NOT match ordinary English words that happen to end in
// "ish" (finish, British, stylish) - those have no word boundary before
// "ish" the way a deliberately glued approximation does.
const ISH_PATTERN = /\b\d+-?ish\b|\bish\b/i;

// Casual shorthand for calendar words. Deliberately a short, named list
// rather than a general slang dictionary - scope it up if more show up in
// real captures.
const ABBREVIATION_TERMS = ["tmrw", "tmr", "2mrw", "2moro", "tonite", "2nite"];

// A bare hour: "at 2", "at 10:30" with no am/pm marker, where the hour is
// in the 1-12 range (13-23 is unambiguous 24-hour time and isn't flagged).
const BARE_HOUR_PATTERNS = [
  /\bat\s+(\d{1,2})(?::\d{2})?\b(?!\s*(?:am|pm|a\.m\.|p\.m\.|o'?clock))/i,
  /\b(\d{1,2}):\d{2}\b(?!\s*(?:am|pm|a\.m\.|p\.m\.))/i,
];

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAnyTerm(text: string, terms: string[]): boolean {
  const pattern = new RegExp(`\\b(?:${terms.map(escapeRegExp).join("|")})\\b`, "i");
  return pattern.test(text);
}

function hasBareHour(text: string): boolean {
  return BARE_HOUR_PATTERNS.some((pattern) => {
    const match = text.match(pattern);
    if (!match) return false;
    const hour = Number(match[1]);
    return hour >= 1 && hour <= 12;
  });
}

// Recurring yearly life events (birthdays, anniversaries) are a narrow,
// specific exception to "no year = uncertain": a missing year here means
// "this happens every year," not vagueness. Deliberately a short, named
// term list rather than a general keyword dictionary, same discipline as
// the other term lists above - scope it up if more show up in real
// captures. Only applies to the single-candidate case: a Drop with
// several dates (e.g. multiple birthdays crammed into one note) is a
// different, harder problem - out of scope, still routes to unresolved
// exactly as before.
const RECURRING_LIFE_EVENT_TERMS = ["birthday", "bday", "b-day", "anniversary"];

export function isRecurringLifeEventCandidate(
  rawText: string,
  localCandidates: LocalCandidate[]
): boolean {
  return (
    localCandidates.length === 1 &&
    !localCandidates[0].hasYear &&
    matchesAnyTerm(rawText, RECURRING_LIFE_EVENT_TERMS)
  );
}

// General recurring-language detection - deliberately separate from
// isRecurringLifeEventCandidate above, which only covers the narrow
// birthday/anniversary + missing-year case and resolves a structured
// "yearly" recurrenceType. This covers everyday recurring phrasing
// ("every Monday", "monthly", "every other week", "daily") with NO
// structured rule parsing (no RRULE, no day-of-week arrays, no interval
// logic) - just capturing the matched phrase as-is for display. Purely
// local/regex, no AI call needed, same discipline as the risk-flag term
// lists above: a short, named pattern, not a general slang dictionary -
// scope it up if real captures show more phrasings.
const RECURRENCE_PHRASE_PATTERN =
  /\bevery\s+(?:other\s+)?(?:day|night|morning|week|month|year|weekday|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:daily|weekly|biweekly|monthly|yearly|annually)\b/i;

export function detectRecurrencePhrase(rawText: string): string | null {
  const match = rawText.match(RECURRENCE_PHRASE_PATTERN);
  return match ? match[0] : null;
}

export type NumericRecurrence = {
  phrase: string;
  unit: "day" | "week" | "month" | "year";
  interval: number;
};

// Sunshine is voice-first, so spelled-out numbers ("every three months")
// are the common case, not an edge case - confirmed by a real Drop that
// silently lost its recurrence data over exactly this. Deliberately a
// short, named word list (one through twelve) rather than general
// English number-word parsing ("twenty-five", "a dozen") - the same
// "narrow, named pattern, scope up later if real captures show more"
// discipline as every other term list in this file. The digit path
// (\d+) has no equivalent upper bound to mirror - any positive integer
// already matches there, only interval<1 is rejected - so this list's
// 1-12 range is the only bound, by construction, not an inconsistency.
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

// Single source of truth for both the regex alternation below AND
// describeRecurrence's own numeric-prefix check - the word list can
// never drift out of sync between detection and display.
const NUMBER_WORD_ALTERNATION = Object.keys(NUMBER_WORDS).join("|");

function parseIntervalCount(text: string): number {
  const lower = text.toLowerCase();
  return /^\d+$/.test(lower) ? Number(lower) : NUMBER_WORDS[lower];
}

// "every N day(s)/week(s)/month(s)/year(s)", N as a digit OR one of the
// spelled-out words above - unambiguous either way, so this is handled
// by regex rather than the AI escalation path (unlike date resolution,
// which genuinely needs semantic judgment about vague/relative
// phrasing). Anchored to this one word order - a miss just means
// recurrence isn't detected, the same safe failure mode the non-numeric
// RECURRENCE_PHRASE_PATTERN already has for phrasings it doesn't cover.
const NUMERIC_INTERVAL_PATTERN = new RegExp(
  `\\bevery\\s+(\\d+|${NUMBER_WORD_ALTERNATION})\\s+(day|week|month|year)s?\\b`,
  "i"
);

export function detectNumericRecurrence(rawText: string): NumericRecurrence | null {
  const match = rawText.match(NUMERIC_INTERVAL_PATTERN);
  if (!match) return null;

  const interval = parseIntervalCount(match[1]);
  if (!Number.isFinite(interval) || interval < 1) return null;

  return {
    phrase: match[0],
    unit: match[2].toLowerCase() as "day" | "week" | "month" | "year",
    interval,
  };
}

// Display-only categorization of an already-detected recurrenceRawText
// phrase - exhaustive over every shape RECURRENCE_PHRASE_PATTERN can
// produce, plus the numeric-interval phrases NUMERIC_INTERVAL_PATTERN
// produces (see docs/recurrence-interval-schema.sql for the schema side
// of that). Non-numeric phrases still derive display text purely from
// the raw phrase, matching describeRecurrence's original design; the
// numeric case is checked first below since it needs to preserve the
// count in the output ("Every 3 months", not just "Every month").
export function describeRecurrence(phrase: string): string {
  const lower = phrase.toLowerCase();

  // Reuses NUMERIC_INTERVAL_PATTERN's own word list (NUMBER_WORD_ALTERNATION)
  // and count-parsing (parseIntervalCount) rather than a second copy of
  // either - "every three months" and "every 3 months" both normalize to
  // the same "Every 3 months" display text.
  const numericMatch = lower.match(
    new RegExp(`^every\\s+(\\d+|${NUMBER_WORD_ALTERNATION})\\s+(day|week|month|year)s?\\b`)
  );
  if (numericMatch) {
    const count = parseIntervalCount(numericMatch[1]);
    const unit = numericMatch[2];
    return count === 1 ? `Every ${unit}` : `Every ${count} ${unit}s`;
  }

  const isOther = /\bother\b/.test(lower);
  const suffix = isOther ? "other " : "";

  const WEEKDAY_NAMES = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  if (lower === "biweekly") return "Every other week";
  if (WEEKDAY_NAMES.some((day) => lower.includes(day))) return `Every ${suffix}week`;
  if (lower.includes("weekend")) return `Every ${suffix}weekend`;
  if (lower.includes("weekday")) return `Every ${suffix}weekday`;
  if (lower.includes("week") || lower === "weekly") return `Every ${suffix}week`;
  if (lower.includes("month") || lower === "monthly") return `Every ${suffix}month`;
  if (lower.includes("year") || lower === "yearly" || lower === "annually") {
    return `Every ${suffix}year`;
  }
  if (lower.includes("day") || lower === "daily") return `Every ${suffix}day`;
  if (lower.includes("night")) return `Every ${suffix}night`;
  if (lower.includes("morning")) return `Every ${suffix}morning`;

  // Unreachable given RECURRENCE_PHRASE_PATTERN's own alternatives, kept
  // only as a safe fallback rather than an assumption the switch is
  // exhaustive forever.
  return phrase;
}

// Structured step for CALENDAR PROJECTION (month-view dots, timeline
// occurrences) - a generalization of what used to be a fixed cadence
// enum (yearly/monthly/biweekly/weekly/daily). "biweekly" is now just
// {unit:"week", interval:2}; the old fixed cadences are all
// {unit:X, interval:1}. Numeric-interval recurrence ("every 3 months")
// produces {unit:"month", interval:3} directly from structured data
// instead of re-parsing text.
export type RecurrenceStep = {
  unit: "year" | "month" | "week" | "day";
  interval: number;
};

// Coarse cadence classification for CALENDAR PROJECTION - distinct from
// describeRecurrence's DISPLAY text above, though both read the same
// underlying signal. Deliberately excludes "every weekday"/"every
// weekend": projecting those correctly needs real day-of-week filtering
// (skip Sat/Sun, or skip Mon-Fri), which is exactly the "day-of-week
// array" logic detectRecurrencePhrase's own doc comment rules out - a
// Drop with one of those phrases still shows correctly on its own
// resolved date, it just doesn't project forward.
export function classifyRecurrenceCadence(
  recurring: boolean,
  recurrenceType: "yearly" | "day" | "week" | "month" | "year" | null,
  recurrenceRawText: string | null,
  recurrenceInterval: number | null
): RecurrenceStep | null {
  if (!recurring) return null;

  // Numeric-interval path: already fully described by structured data,
  // no need to re-parse recurrenceRawText the way the text-only paths
  // below have to. Checked before the "yearly" birthday path since they
  // use different recurrenceType values ("year" vs "yearly") and can't
  // collide.
  if (recurrenceType && recurrenceType !== "yearly") {
    return { unit: recurrenceType, interval: recurrenceInterval ?? 1 };
  }

  if (recurrenceType === "yearly") return { unit: "year", interval: 1 };
  if (!recurrenceRawText) return null;

  const lower = recurrenceRawText.toLowerCase();
  const isOtherWeek =
    /\bother\b/.test(lower) &&
    lower.includes("week") &&
    !lower.includes("weekend") &&
    !lower.includes("weekday");
  if (lower === "biweekly" || isOtherWeek) return { unit: "week", interval: 2 };

  const WEEKDAY_NAMES = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  if (WEEKDAY_NAMES.some((day) => lower.includes(day))) return { unit: "week", interval: 1 };
  if (lower.includes("weekend") || lower.includes("weekday")) return null;
  if (lower.includes("week") || lower === "weekly") return { unit: "week", interval: 1 };
  if (lower.includes("month") || lower === "monthly") return { unit: "month", interval: 1 };
  if (lower.includes("year") || lower === "yearly" || lower === "annually") {
    return { unit: "year", interval: 1 };
  }
  if (
    lower.includes("day") ||
    lower === "daily" ||
    lower.includes("night") ||
    lower.includes("morning")
  ) {
    return { unit: "day", interval: 1 };
  }

  return null;
}

// A single clean local candidate is normally trusted immediately, no AI
// needed - but that assumes a short, single-focus note. A long multi-line
// note (a progress log, changelog, running expense tally) can contain
// exactly one date near the start describing when the entry was logged,
// not when something is scheduled - a false-positive risk the local
// fast-path alone can't see (confirmed against two real Drops: a dev
// progress log and a cost tally, both of which got a confidently wrong
// resolved date this way). Keyword-matching on "progress"/"tally" doesn't
// generalize - the progress-log example never contained either word in
// its raw text (only in an AI-generated title, unavailable at this local-
// only stage). Length/shape is the signal that's actually present and
// structural, so that's what this checks instead.
//
// 10 is a documented judgment call from exactly those two examples, not
// a tuned constant - revisit if real usage shows it's off in either
// direction (false positives on long single-event notes, or false
// negatives on shorter logs), but don't over-tune it now.
const MULTI_SECTION_LINE_THRESHOLD = 10;

export function looksLikeMultiSectionLog(rawText: string): boolean {
  const nonEmptyLines = rawText.split("\n").filter((line) => line.trim().length > 0);
  return nonEmptyLines.length >= MULTI_SECTION_LINE_THRESHOLD;
}

// Shared gating rule: only escalate to the AI when the local pass alone
// can't be trusted. A clean single candidate with no risk flags is
// resolved directly, with no AI call at all - used by both
// analyze-drop/route.ts (deciding whether to include the TEMPORAL task in
// the prompt) and the client's edit-time re-analysis preview (deciding
// whether it can resolve locally or needs to hit the endpoint), so the two
// can never drift out of sync with each other. A recognized recurring
// life event also short-circuits here (checked first) - it resolves
// confidently from the local candidate alone, so escalating to the AI
// would just be a wasted call. A single clean candidate embedded in a
// long multi-section log also escalates now (checked second) - the
// opposite direction from the recurring-event short-circuit, since here
// the local pass genuinely can't be trusted despite looking clean.
export function shouldEscalateToAi(
  rawText: string,
  localCandidates: LocalCandidate[],
  riskFlags: RiskFlag[]
): boolean {
  if (isRecurringLifeEventCandidate(rawText, localCandidates)) return false;

  if (
    localCandidates.length === 1 &&
    riskFlags.length === 0 &&
    looksLikeMultiSectionLog(rawText)
  ) {
    return true;
  }

  return (
    localCandidates.length === 0 ||
    (localCandidates.length === 1 && riskFlags.length > 0) ||
    localCandidates.length >= 2
  );
}

export function detectRiskFlags(rawText: string): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (matchesAnyTerm(rawText, VAGUE_ANCHOR_TERMS)) flags.push("vague_anchor");
  if (hasBareHour(rawText)) flags.push("bare_hour");
  if (matchesAnyTerm(rawText, DROPPED_QUALIFIER_TERMS) || ISH_PATTERN.test(rawText)) {
    flags.push("dropped_qualifier");
  }
  if (matchesAnyTerm(rawText, ABBREVIATION_TERMS)) flags.push("abbreviation");

  return flags;
}

// ---- Resolution -----------------------------------------------------------

const NONE_RESULT_BASE: Omit<TemporalResolutionOutput, "temporalRawText"> = {
  eventAt: null,
  eventHasTime: null,
  eventTimezone: null,
  eventStatus: "none",
  temporalConfidence: null,
  recurring: false,
  recurrenceType: null,
  recurrenceRawText: null,
  recurrenceInterval: null,
};

function fromAiResult(aiResult: TemporalResolutionOutput): TemporalResolutionOutput {
  return { ...aiResult };
}

function unresolvedResult(temporalRawText: string | null = null): TemporalResolutionOutput {
  return {
    eventAt: null,
    eventHasTime: null,
    eventTimezone: null,
    eventStatus: "unresolved",
    temporalConfidence: null,
    temporalRawText,
    recurring: false,
    recurrenceType: null,
    recurrenceRawText: null,
    recurrenceInterval: null,
  };
}

export function resolveTemporal(
  input: TemporalResolutionInput,
  aiResult: TemporalResolutionOutput | null
): TemporalResolutionOutput {
  const { localCandidates, riskFlags, rawText } = input;
  let result: TemporalResolutionOutput;

  if (isRecurringLifeEventCandidate(rawText, localCandidates)) {
    // Missing year + birthday/anniversary phrasing means "every year," not
    // uncertainty - resolves confidently from the local candidate alone
    // (chrono's forwardDate already picked the next upcoming occurrence),
    // regardless of any risk flags that would otherwise force an AI
    // escalation. Checked before every other branch below.
    const candidate = localCandidates[0];
    result = {
      eventAt: candidate.iso,
      eventHasTime: candidate.hasTime,
      eventTimezone: input.captureTimezone,
      eventStatus: "resolved",
      temporalConfidence: "high",
      temporalRawText: null, // set by the universal rule below
      recurring: true,
      recurrenceType: "yearly",
      recurrenceRawText: null, // structured "yearly" already fully describes this
      recurrenceInterval: null,
    };
  } else if (
    localCandidates.length === 1 &&
    riskFlags.length === 0 &&
    !looksLikeMultiSectionLog(rawText)
  ) {
    // Clean, unambiguous single local match in a short, single-focus note
    // - AI is not called for this case, so aiResult is expected to be
    // null.
    const candidate = localCandidates[0];
    result = {
      eventAt: candidate.iso,
      eventHasTime: candidate.hasTime,
      eventTimezone: input.captureTimezone,
      eventStatus: "resolved",
      temporalConfidence: "high",
      temporalRawText: null, // set by the universal rule below
      recurring: false,
      recurrenceType: null,
      recurrenceRawText: null,
      recurrenceInterval: null,
    };
  } else if (
    localCandidates.length === 1 &&
    (riskFlags.length > 0 || looksLikeMultiSectionLog(rawText))
  ) {
    // One candidate, but something about it is risky enough to defer to
    // the AI - either a real risk flag (vague anchor, bare hour, dropped
    // qualifier, abbreviation), or the candidate sits inside a long
    // multi-section log where a single date is more likely to describe
    // when the entry was logged than something scheduled.
    if (!aiResult) {
      result = unresolvedResult();
    } else if (aiResult.eventStatus === "resolved") {
      result = fromAiResult(aiResult);
    } else {
      result = unresolvedResult();
    }
  } else if (localCandidates.length === 0) {
    // No local candidate at all - trust the AI's judgment call as-is,
    // whatever status it lands on (resolved / unresolved / none).
    if (!aiResult) {
      result = { ...NONE_RESULT_BASE, temporalRawText: null };
    } else {
      result = fromAiResult(aiResult);
    }
  } else {
    // Two or more candidates - genuinely ambiguous which one is "the"
    // event. If the AI confidently picked one, use it; otherwise surface
    // all candidates via the original text so the user can pick.
    if (aiResult && aiResult.eventStatus === "resolved") {
      result = fromAiResult(aiResult);
    } else {
      // Explicitly preserves rawText even in the unresolved case here,
      // per spec - unlike the other unresolved branches, which have no
      // instruction to do so and default to null.
      result = unresolvedResult(input.rawText);
    }
  }

  // Universal rules, applied regardless of which branch produced `result`
  // (including the branch-3 "trust aiResult as-is" pass-through, which
  // could otherwise smuggle in a value that violates either rule below):
  if (result.eventStatus === "resolved") {
    // Every 'resolved' output carries the full original text, not
    // whatever narrower span the AI or chrono matched - Law 3, never
    // lose the original.
    result = { ...result, temporalRawText: input.rawText };
  } else {
    // 'high'/'low' confidence is only meaningful once something is
    // actually resolved - 'unresolved' and 'none' always carry null.
    result = { ...result, temporalConfidence: null };
  }

  // General recurring-language detection is independent of the date/time
  // branch above - a Drop can be resolved-date AND recurring, or recurring
  // with no resolved date at all. Only applies when the birthday/
  // anniversary path hasn't already set a structured yearly recurrence.
  // Numeric-interval phrasing ("every 3 months") is checked first since
  // it carries structured data (recurrenceType/recurrenceInterval) the
  // non-numeric fallback can't produce; a numeric phrase never matches
  // the non-numeric RECURRENCE_PHRASE_PATTERN anyway (confirmed - it
  // requires a unit word directly after "every ", with no room for a
  // number in between), so there's no risk of double-processing.
  if (!result.recurring) {
    const numeric = detectNumericRecurrence(input.rawText);
    if (numeric) {
      result = {
        ...result,
        recurring: true,
        recurrenceRawText: numeric.phrase,
        recurrenceType: numeric.unit,
        recurrenceInterval: numeric.interval,
      };
    } else {
      const recurrenceRawText = detectRecurrencePhrase(input.rawText);
      if (recurrenceRawText) {
        result = { ...result, recurring: true, recurrenceRawText };
      }
    }
  }

  return result;
}
