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

// Shared gating rule: only escalate to the AI when the local pass alone
// can't be trusted. A clean single candidate with no risk flags is
// resolved directly, with no AI call at all - used by both
// analyze-drop/route.ts (deciding whether to include the TEMPORAL task in
// the prompt) and the client's edit-time re-analysis preview (deciding
// whether it can resolve locally or needs to hit the endpoint), so the two
// can never drift out of sync with each other. A recognized recurring
// life event also short-circuits here (checked first) - it resolves
// confidently from the local candidate alone, so escalating to the AI
// would just be a wasted call.
export function shouldEscalateToAi(
  rawText: string,
  localCandidates: LocalCandidate[],
  riskFlags: RiskFlag[]
): boolean {
  if (isRecurringLifeEventCandidate(rawText, localCandidates)) return false;

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
    };
  } else if (localCandidates.length === 1 && riskFlags.length === 0) {
    // Clean, unambiguous single local match - AI is not called for this
    // case, so aiResult is expected to be null.
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
    };
  } else if (localCandidates.length === 1 && riskFlags.length > 0) {
    // One candidate, but something about it is risky enough to defer to
    // the AI (vague anchor, bare hour, dropped qualifier, abbreviation).
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

  return result;
}
