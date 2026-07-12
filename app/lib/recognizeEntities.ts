import * as chrono from "chrono-node";

export type RecognizedDate = {
  raw: string;
  iso: string;
  hasTime: boolean;
  hasYear: boolean;
};

export type RecognizedEntities = {
  dates: RecognizedDate[];
  urls: string[];
  phoneNumbers: string[];
  addresses: string[];
};

const URL_PATTERN =
  /\bhttps?:\/\/[^\s<>"')\]]+|\bwww\.[^\s<>"')\]]+\.[a-z]{2,}(?:\/[^\s<>"')\]]*)?/gi;

const PHONE_PATTERN = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;

const STREET_SUFFIXES = [
  "Street", "St", "Avenue", "Ave", "Boulevard", "Blvd", "Road", "Rd",
  "Drive", "Dr", "Lane", "Ln", "Court", "Ct", "Place", "Pl", "Way",
  "Terrace", "Ter", "Circle", "Cir", "Parkway", "Pkwy", "Highway", "Hwy",
  "Trail", "Trl", "Square", "Sq",
];

const ADDRESS_PATTERN = new RegExp(
  `\\b\\d{1,6}\\s+(?:[A-Z][a-zA-Z'.-]*\\s){1,4}(?:${STREET_SUFFIXES.join("|")})\\.?\\b`,
  "g"
);

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()))).filter(Boolean);
}

function extractDates(text: string, referenceDate: Date): RecognizedDate[] {
  const results = chrono.parse(text, referenceDate, { forwardDate: true });

  return results.map((result) => ({
    raw: result.text,
    iso: result.start.date().toISOString(),
    hasTime: result.start.isCertain("hour"),
    hasYear: result.start.isCertain("year"),
  }));
}

// Recognize stage: cheap, local, pattern-based entity extraction. Deliberately
// scoped to unambiguous types only (dates/times, URLs, phone numbers,
// structured street addresses) - no web lookups, no disambiguation of
// businesses/products/people. Those stay in the Understand-stage LLM call.
export function recognizeEntities(
  text: string,
  referenceDate: Date = new Date()
): RecognizedEntities {
  return {
    dates: extractDates(text, referenceDate),
    urls: dedupe(text.match(URL_PATTERN) ?? []),
    phoneNumbers: dedupe(text.match(PHONE_PATTERN) ?? []),
    addresses: dedupe(text.match(ADDRESS_PATTERN) ?? []),
  };
}
