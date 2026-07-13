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
  recurrenceType: "yearly" | null;
  // Raw recurring phrase for the GENERAL case ("every Monday", "monthly",
  // "every other week") - separate from recurrenceType, which is a
  // structured enum reserved for the narrow birthday/anniversary
  // "yearly" detection below. No structured rule parsing in v1 - this is
  // free text only. Null whenever recurring came from the yearly path
  // instead (that path is already fully described by recurrenceType).
  recurrenceRawText: string | null;
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

// Display-only categorization of an already-detected recurrenceRawText
// phrase, exhaustive over every shape RECURRENCE_PHRASE_PATTERN can
// produce. This intentionally does NOT write to recurrenceType - that
// field is a DB-level enum constrained to `check (recurrence_type in
// ('yearly'))` (see docs/recurring-events-schema.sql), reserved for the
// structured birthday/anniversary path above. Widening that constraint to
// weekly/monthly/daily is a real schema decision (What enum values? Does
// anything besides display need to consume it structurally?) that hasn't
// been confirmed - so this only derives friendly text from the raw
// phrase at render time, never touches the DB.
export function describeRecurrence(phrase: string): string {
  const lower = phrase.toLowerCase();
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

export type RecurrenceCadence = "yearly" | "monthly" | "biweekly" | "weekly" | "daily";

// Coarse cadence classification for CALENDAR PROJECTION (month-view dots,
// timeline occurrences) - distinct from describeRecurrence's DISPLAY text
// above, though both read the same underlying signal. Deliberately
// excludes "every weekday"/"every weekend": projecting those correctly
// needs real day-of-week filtering (skip Sat/Sun, or skip Mon-Fri), which
// is exactly the "day-of-week array" logic detectRecurrencePhrase's own
// doc comment rules out - a Drop with one of those phrases still shows
// correctly on its own resolved date, it just doesn't project forward.
// "every other X" beyond week (e.g. "every other month") isn't doubled
// into its own interval either - a documented simplification: those
// phrasings are far rarer than weekly, and doubling every cadence's
// interval multiplies the branches here without a real capture to
// validate it against.
export function classifyRecurrenceCadence(
  recurring: boolean,
  recurrenceType: "yearly" | null,
  recurrenceRawText: string | null
): RecurrenceCadence | null {
  if (!recurring) return null;
  if (recurrenceType === "yearly") return "yearly";
  if (!recurrenceRawText) return null;

  const lower = recurrenceRawText.toLowerCase();
  const isOtherWeek =
    /\bother\b/.test(lower) &&
    lower.includes("week") &&
    !lower.includes("weekend") &&
    !lower.includes("weekday");
  if (lower === "biweekly" || isOtherWeek) return "biweekly";

  const WEEKDAY_NAMES = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  if (WEEKDAY_NAMES.some((day) => lower.includes(day))) return "weekly";
  if (lower.includes("weekend") || lower.includes("weekday")) return null;
  if (lower.includes("week") || lower === "weekly") return "weekly";
  if (lower.includes("month") || lower === "monthly") return "monthly";
  if (lower.includes("year") || lower === "yearly" || lower === "annually") return "yearly";
  if (
    lower.includes("day") ||
    lower === "daily" ||
    lower.includes("night") ||
    lower.includes("morning")
  ) {
    return "daily";
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
  if (!result.recurring) {
    const recurrenceRawText = detectRecurrencePhrase(input.rawText);
    if (recurrenceRawText) {
      result = { ...result, recurring: true, recurrenceRawText };
    }
  }

  return result;
}
