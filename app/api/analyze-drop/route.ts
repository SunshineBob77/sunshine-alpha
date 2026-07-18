import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { recognizeEntities, type RecognizedDate } from "@/app/lib/recognizeEntities";
import type { ChecklistItem } from "@/app/lib/captures";
import { SUNSHINE_DROP_CATEGORY } from "@/app/lib/systemDrops";
import {
  detectRiskFlags,
  resolveTemporal,
  shouldEscalateToAi,
  type RiskFlag,
  type TemporalResolutionOutput,
} from "@/app/lib/resolveTemporal";

const anthropic = new Anthropic();

const SPACE_IDS = [
  "personal",
  "work",
  "health",
  "family",
  "finance",
  "ideas",
  "travel",
  "recipes",
] as const;

const URL_PATTERN = /https?:\/\/\S+/i;

// A pasted link is a deterministic signal, not a wording inference - if the
// note contains a URL, treat it as a research request regardless of how the
// user phrased it ("review this", "check this out", or nothing at all).
const RESEARCH_TASK_WITH_URL = `1. This note contains a URL. Always treat it as a research request, regardless of phrasing. First use web_fetch to open and read the actual linked page (e.g. the real Reddit thread, article, or listing) - do not guess at its content. Synthesize 2-4 short, distinct bullet points from what you actually read (e.g. the thread's real consensus/top points, an article's key facts) as a JSON array of strings. If the fetch fails or the page is inaccessible (paywalled, blocked, deleted, requires login), fall back to web_search around the URL/topic instead and still return your best 2-4 bullet summary from that. Only use the value null if both fetching and searching genuinely turn up nothing useful. Respond with just the JSON array on one line.`;

const RESEARCH_TASK_DEFAULT = `1. Determine if this note is a research request (asking to find, look up, recommend, or research something — e.g. recipes, products, information). If yes, search the web and return 2-4 short, distinct bullet points as a JSON array of strings — each bullet a standalone fact or detail, not full sentences chained together (e.g. ["$20 cash cover at the door", "Live music starts at 8pm", "Full bar and pizza available"]). Respond with just the JSON array on one line. If no, use the value null.`;

function buildTemporalTask(
  taskNumber: number,
  rawText: string,
  referenceDatetime: string,
  captureTimezone: string,
  localCandidates: RecognizedDate[],
  riskFlags: RiskFlag[]
): string {
  const candidatesText =
    localCandidates.length > 0 ? JSON.stringify(localCandidates) : "none";
  const riskFlagsText = riskFlags.length > 0 ? riskFlags.join(", ") : "none";

  return `
${taskNumber}. Determine if this text refers to one specific, resolvable date or time.

Raw text: ${rawText}
Reference date/time: ${referenceDatetime}
Capture timezone: ${captureTimezone}
Locally-detected candidate(s): ${candidatesText}
Risk flags detected on the local candidate: ${riskFlagsText}

Rules:
- If the text clearly identifies a single intended date (e.g. "Meeting moved from Monday to Tuesday" clearly means Tuesday), resolve to that one date.
- If the text uses vague or uncertain language ("sometime", "around", "ish", "ASAP", "a couple weeks") without enough surrounding context to pin down a specific date, do NOT invent one — respond unresolved instead, even if a local candidate exists.
- If risk flags are present for a local candidate, treat that as a specific signal to be skeptical of that candidate's precision — a risk flag being present means the local parser itself considers this phrasing ambiguous, not just an example category. Do not resolve a flagged candidate to "resolved" unless the surrounding text provides genuinely disambiguating context beyond what's in the flagged phrase itself (e.g. "this weekend, the 18th" would be disambiguating; "this weekend" alone is not).
- Distinguish a date describing WHEN something is scheduled to happen from a date that's part of record-keeping content — an expense log, running tally, cost tracker, progress log, changelog, or status update. Record-keeping content often contains a date (when an entry was logged, or a past transaction date) but is NOT describing a future event. If the text reads as a log/tally/tracker/ledger — multiple line items, dollar amounts, "total to date," status sections like "Done"/"Queued"/"Known issues" — do not resolve a date from it even if one is present; respond unresolved instead.
- If the text has no temporal meaning at all, respond none.
- Only respond resolved when you have genuine confidence in one specific instant.
- "ASAP" and pure urgency language, without any resolvable date, must always be unresolved — never invent a date for urgency alone.
- If resolving a date-only reference with no explicit time of day, say so explicitly.`;
}

// Photo/Gallery capture v1 - a capture made with no typed caption is
// still saved with a short placeholder text (see DashboardContext's
// saveCapture, e.g. "📷 Photo") purely so every other code path that
// expects non-empty captures.text keeps working. That placeholder carries
// no real information of its own - this tells the model to look past it
// straight to the actual attached image instead of literally analyzing
// the words "Photo" or the filename. A real caption alongside the image
// is used together with it, not discarded.
const IMAGE_GUIDANCE = `

This note has an attached image (a photo, screenshot, or scan). If the note's own text is just a generic placeholder like "📷 Photo" or "📎 <filename>" - i.e. it carries no real information by itself - treat the image as the actual content: describe what's in it and extract any visible text via OCR, and base every task below on that rather than the placeholder. If the note ALSO has real user-authored text alongside the image (a caption), use both together - the caption for intent/context, the image for what it actually shows. If the image is unclear, low-quality, or nothing useful can be made out, it's fine to fall back to generic values (e.g. title "Photo", category "Memory") rather than guessing.`;

function buildSystemPrompt(
  hasUrl: boolean,
  hasImage: boolean,
  includeTemporalTask: boolean,
  rawText: string,
  referenceDatetime: string,
  captureTimezone: string,
  localCandidates: RecognizedDate[],
  riskFlags: RiskFlag[]
): string {
  const taskCount = includeTemporalTask ? "eight" : "seven";
  const temporalTask = includeTemporalTask
    ? buildTemporalTask(8, rawText, referenceDatetime, captureTimezone, localCandidates, riskFlags)
    : "";

  return `You are analyzing a short personal note (a "Drop").${hasImage ? IMAGE_GUIDANCE : ""} Do ${taskCount} independent things:

${hasUrl ? RESEARCH_TASK_WITH_URL : RESEARCH_TASK_DEFAULT}
2. Determine if this note contains a physical address (e.g. a hotel, restaurant, or event location). If yes, extract it exactly as written. If no, use the value null.
3. Reformat the note's own content for clean display, using Markdown. Detect its structure and format accordingly:
   - A list of items should become a real Markdown bullet list. Recognize list structure from:
     - Explicit separators: commas, "and", semicolons, or newlines.
     - Multiple imperative verb phrases run together with no punctuation at all (e.g. "Create website find URL upload code" has natural breaks between each verb phrase — bullet them separately), when each phrase clearly stands as an independent action.
   - If the note contains two or more complete sentences (each ending in its own period), ALWAYS give each sentence its own line — either as separate bullet points if they are separate actionable/memorable items, or as separate paragraph lines if they read more like a narrative. Never merge multiple complete sentences into one continuous run-on line.
   - Tabular or cost/price data → a real Markdown table. If the note already contains an existing table (e.g. cost/expense entries) and additional entries have been appended as plain text, merge ALL entries — old and new — into ONE unified table, not a table plus separate untabulated lines.
   - A single short reminder or thought → a plain sentence, no forced structure.
   - A longer multi-line note → preserve the original paragraph breaks, do not compress it into one line.
   When uncertain whether run-together phrases with no punctuation at all form a list or a single continuous thought, prefer bullets only if there are 2+ clearly distinct, independently actionable or memorable items; otherwise keep it as prose.
   Only reformat what's already there — do not add commentary, headers, or new content. This field must never be null.
4. Determine if this note describes a workout or exercise session. If it does NOT, use the value null. If it DOES, extract a JSON object with exactly these fields:
   - activity_type: string — the primary activity (e.g. "boxing", "running", "weightlifting")
   - rounds: number or null — the count of rounds/sets that make up the MAIN quantified structure of the session, if explicitly stated
   - round_length_minutes: number or null — the length of each of those main rounds in minutes, if explicitly stated
   - total_duration_minutes: number or null — ONLY set this if the total is explicitly stated outright, OR if rounds and round_length_minutes both describe the single same uniform structure and multiplying them cleanly gives the total. If the note describes multiple different round structures with different or unstated lengths, leave this null rather than guessing or estimating.
   - notes: string — free text capturing who they trained with, drills done, secondary activities/rounds that didn't cleanly fit the structured fields above, and anything else worth remembering. Do not leave out information just because it didn't fit a field above — put it here instead.
   Respond with just the JSON object on one line, or the literal word null.
5. Extract a short, specific title for this note — a few words capturing WHAT it's actually about (e.g. "Annual OOB Car Show 2026", "Boxing session with Joe", "Dentist appointment reminder"). This must be specific to the note's actual content, never a generic description like "Personal note" or "A reminder". This field must never be null.
6. Determine if this note is actionable — a to-do, checklist, or reminder describing something the person needs to DO (e.g. "buy toothpaste", "call the dentist", "register for the car show"). It is NOT actionable if it's a journal entry, idea, memory, reflection, or a note that just records information without describing a task to complete. Respond with exactly true or false.
7. Classify this note based on its full meaning and context, not just keyword matching:
   - category: one of "Achievement" (something the person accomplished or made progress on), "Task" (something to do, a reminder, or an action item), "Work" (work/job-related content that isn't itself a to-do), or "Memory" (a personal reflection, note, or record — the default when nothing else clearly fits).
   - space: the single best-fitting Space for this note's actual subject matter, one of: ${SPACE_IDS.join(", ")}. Use "personal" when nothing more specific clearly fits — it is the default, not a last resort to avoid.
${temporalTask}

Do not narrate what you're about to do or describe your search process — no preamble like "I'll search for..." or "Let me find...".

Respond with exactly this format and nothing else before or after it:
RESEARCH: <JSON array of bullet strings, or null>
ADDRESS: <address or null>
FORMATTED: <reformatted note>
WORKOUT: <JSON object or null>
TITLE: <short specific title>
ACTIONABLE: <true or false>
CATEGORY: <Achievement, Task, Work, or Memory>
SPACE: <one of ${SPACE_IDS.join(", ")}>
TEMPORAL: <JSON object: {"status": "resolved" | "unresolved" | "none", "eventAt": "<ISO string>" | null, "hasTime": true | false | null}, or null if this task was not included in the prompt>`;
}

// Used only for the edit-time re-analysis preview (temporalPreviewOnly) -
// a single-task, tool-free call so checking "does the new text suggest a
// different date" doesn't pay for the other 7 tasks or web tools it
// doesn't need.
function buildTemporalOnlySystemPrompt(
  rawText: string,
  referenceDatetime: string,
  captureTimezone: string,
  localCandidates: RecognizedDate[],
  riskFlags: RiskFlag[]
): string {
  return `You are analyzing a short personal note (a "Drop") for temporal content only. Do one thing:
${buildTemporalTask(1, rawText, referenceDatetime, captureTimezone, localCandidates, riskFlags)}

Do not narrate what you're about to do or describe your reasoning process.

Respond with exactly this format and nothing else before or after it:
TEMPORAL: <JSON object: {"status": "resolved" | "unresolved" | "none", "eventAt": "<ISO string>" | null, "hasTime": true | false | null}>`;
}

const PREAMBLE_PATTERN = /^[^.!?\n]*\b(I'll search|I will search|Let me|I'll look|I will look)\b[^.!?\n]*[.!?]+\s*/i;

function stripPreamble(text: string): string {
  return text.replace(PREAMBLE_PATTERN, "").trim();
}

function nullableValue(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  return value.length === 0 || value.toLowerCase() === "null" ? null : value;
}

function parseResearch(raw: string | undefined): string[] | null {
  const value = (raw ?? "").trim();
  if (value.length === 0 || value.toLowerCase() === "null") return null;

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      const bullets = parsed.map((item) => item.trim()).filter(Boolean);
      return bullets.length > 0 ? bullets : null;
    }
  } catch {
    // Model didn't return valid JSON - fall through to treating the raw
    // text as a single bullet rather than discarding the research answer.
  }

  const plain = nullableValue(stripPreamble(value));
  return plain ? [plain] : null;
}

type WorkoutExtraction = {
  activity_type: string;
  rounds: number | null;
  round_length_minutes: number | null;
  total_duration_minutes: number | null;
  notes: string | null;
};

function parseWorkout(raw: string | undefined): WorkoutExtraction | null {
  const value = (raw ?? "").trim();
  if (value.length === 0 || value.toLowerCase() === "null") return null;

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed.activity_type !== "string") return null;

    return {
      activity_type: parsed.activity_type,
      rounds: typeof parsed.rounds === "number" ? parsed.rounds : null,
      round_length_minutes:
        typeof parsed.round_length_minutes === "number" ? parsed.round_length_minutes : null,
      total_duration_minutes:
        typeof parsed.total_duration_minutes === "number" ? parsed.total_duration_minutes : null,
      notes: typeof parsed.notes === "string" ? parsed.notes : null,
    };
  } catch {
    console.error("Failed to parse WORKOUT JSON", value);
    return null;
  }
}

const VALID_CATEGORIES = ["Achievement", "Task", "Work", "Memory"];

function parseCategory(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  const match = VALID_CATEGORIES.find((c) => c.toLowerCase() === value.toLowerCase());
  return match ?? "Memory";
}

function parseSpace(raw: string | undefined): (typeof SPACE_IDS)[number] {
  const value = (raw ?? "").trim().toLowerCase();
  const match = SPACE_IDS.find((s) => s === value);
  return match ?? "personal";
}

type TemporalExtraction = {
  status: "resolved" | "unresolved" | "none";
  eventAt: string | null;
  hasTime: boolean | null;
};

const VALID_TEMPORAL_STATUSES = ["resolved", "unresolved", "none"];

function parseTemporal(raw: string | undefined): TemporalExtraction | null {
  const value = (raw ?? "").trim();
  if (value.length === 0 || value.toLowerCase() === "null") return null;

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || !VALID_TEMPORAL_STATUSES.includes(parsed.status)) {
      return null;
    }

    return {
      status: parsed.status,
      eventAt: typeof parsed.eventAt === "string" ? parsed.eventAt : null,
      hasTime: typeof parsed.hasTime === "boolean" ? parsed.hasTime : null,
    };
  } catch {
    console.error("Failed to parse TEMPORAL JSON", value);
    return null;
  }
}

const ANALYSIS_LABELS = [
  "RESEARCH",
  "ADDRESS",
  "FORMATTED",
  "WORKOUT",
  "TITLE",
  "ACTIONABLE",
  "CATEGORY",
  "SPACE",
  "TEMPORAL",
] as const;

type AnalysisLabel = (typeof ANALYSIS_LABELS)[number];

// Finds each label's own first occurrence independently, rather than the
// old approach of nine chained pairwise regexes (LABEL_A:...LABEL_B:).
// That chain meant a SINGLE missing label broke the boundary for every
// field before and after it too, and the whole response fell into the
// "model didn't follow the format" branch below - discarding every field
// wholesale, including ones the model got right. Confirmed as a real
// production loss: a whiteboard-photo capture's response had a perfect,
// richly-detailed FORMATTED transcription and a specific TITLE, but the
// model simply never emitted a WORKOUT: line (an obviously-inapplicable
// field it apparently judged not worth stating "null" for on a long,
// content-heavy response) - the old parser's formattedMatch required
// literally finding "WORKOUT:" after "FORMATTED:", so that alone erased
// the title, category, actionable flag, AND the entire transcription,
// replacing all of it with generic fallback values.
//
// Here, each label found in the response has its content bounded by
// whichever OTHER label is found next (whichever one that happens to
// be), not a fixed expected neighbor - so one missing label only means
// that one field comes back empty/undefined (each field's own parser
// already treats undefined the same as "null"/absent), never affects any
// other field's extraction.
function parseLabeledSections(rawText: string): Partial<Record<AnalysisLabel, string>> {
  const positions: { label: AnalysisLabel; start: number; contentStart: number }[] = [];

  for (const label of ANALYSIS_LABELS) {
    const match = rawText.match(new RegExp(`\\b${label}:`, "i"));
    if (match && match.index !== undefined) {
      positions.push({ label, start: match.index, contentStart: match.index + match[0].length });
    }
  }

  positions.sort((a, b) => a.start - b.start);

  const sections: Partial<Record<AnalysisLabel, string>> = {};
  for (let i = 0; i < positions.length; i++) {
    const end = i + 1 < positions.length ? positions[i + 1].start : rawText.length;
    sections[positions[i].label] = rawText.slice(positions[i].contentStart, end).trim();
  }

  return sections;
}

function parseAnalysis(rawText: string): {
  research: string[] | null;
  address: string | null;
  formatted: string | null;
  workout: WorkoutExtraction | null;
  title: string | null;
  isActionable: boolean;
  category: string;
  spaceId: (typeof SPACE_IDS)[number];
  temporal: TemporalExtraction | null;
} {
  const sections = parseLabeledSections(rawText);

  if (Object.keys(sections).length === 0) {
    // Genuinely unstructured response - not even one recognizable label
    // anywhere, not just one missing. Same last-resort fallback as
    // before: treat the whole thing as a research answer rather than
    // silently dropping it.
    return {
      research: parseResearch(rawText),
      address: null,
      formatted: null,
      workout: null,
      title: null,
      isActionable: false,
      category: "Memory",
      spaceId: "personal",
      temporal: null,
    };
  }

  return {
    research: parseResearch(sections.RESEARCH),
    address: nullableValue(sections.ADDRESS),
    formatted: nullableValue(sections.FORMATTED),
    workout: parseWorkout(sections.WORKOUT),
    title: nullableValue(sections.TITLE),
    isActionable: (sections.ACTIONABLE ?? "").trim().toLowerCase().startsWith("true"),
    category: parseCategory(sections.CATEGORY),
    spaceId: parseSpace(sections.SPACE),
    temporal: parseTemporal(sections.TEMPORAL),
  };
}

const BULLET_LINE_PATTERN = /^\s*(?:[-*]|\d+\.)\s+(.+)$/;

// Checklist detection reuses the FORMATTED task's own decision (see task 3
// in buildSystemPrompt) about whether this note's content is list-like,
// rather than asking the model a second time - a Drop becomes a checklist
// when the formatted output is a bullet list, and there are enough items
// to be a "list" rather than one lone reminder (2+). A single leading
// non-bullet line is tolerated as a heading/title (e.g. "Grocery list"
// above the actual items) and excluded from the "are these all bullets"
// check - but only ever one such line, not an arbitrary prefix of prose.
// Re-analysis (e.g. after an edit) re-derives this from scratch each time,
// so existing items are matched back in by their (trimmed, lowercased)
// text to preserve checked state and id - a checklist a user has already
// started checking off must not silently reset just because the Drop's
// text was touched again.
function extractChecklistItems(
  formatted: string | null,
  existingItems: ChecklistItem[]
): ChecklistItem[] {
  if (!formatted) return [];

  const lines = formatted
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const itemLines =
    lines.length > 0 && !BULLET_LINE_PATTERN.test(lines[0]) ? lines.slice(1) : lines;

  if (itemLines.length < 2) return [];

  const matches = itemLines.map((line) => line.match(BULLET_LINE_PATTERN));
  if (matches.some((match) => !match)) return [];

  const existingByText = new Map(
    existingItems.map((item) => [item.text.trim().toLowerCase(), item])
  );

  return matches.map((match) => {
    const text = match![1].trim();
    const existing = existingByText.get(text.toLowerCase());
    return {
      id: existing?.id ?? randomUUID(),
      text,
      checked: existing?.checked ?? false,
    };
  });
}

function buildAiTemporalResult(
  temporal: TemporalExtraction | null,
  captureTimezone: string
): TemporalResolutionOutput | null {
  if (!temporal) return null;

  return {
    eventAt: temporal.eventAt,
    eventHasTime: temporal.hasTime,
    eventTimezone: captureTimezone,
    eventStatus: temporal.status,
    // The model isn't asked for a confidence value directly - its own
    // instructions already gate 'resolved' on genuine confidence, so
    // 'high' is the correct label when it commits to that status.
    // resolveTemporal's universal rule nulls this out for any non-resolved
    // status regardless of what's passed here.
    temporalConfidence: temporal.status === "resolved" ? "high" : null,
    temporalRawText: null,
    // The AI temporal task is never asked about recurrence - only
    // resolveTemporal's own local detectors (the narrow recurring-life-
    // event path, and the general recurring-phrase overlay applied after
    // this result comes back) ever set these.
    recurring: false,
    recurrenceType: null,
    recurrenceRawText: null,
    recurrenceInterval: null,
  };
}

// Claude's vision input only accepts these four exact media types -
// notably NOT image/heic, which is what an iPhone's photo library
// sometimes still reports even though Safari/WebKit usually transcodes a
// file-input pick to JPEG first. Anything outside this set gets treated
// as "can't run vision on this" rather than mislabeling the bytes (e.g.
// forcing a HEIC blob's bytes through as media_type "image/jpeg" would
// just make the API fail to decode it) - the request still goes through,
// just without the image block, so a genuinely unsupported format
// degrades to text-only analysis instead of failing the whole call.
const SUPPORTED_IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedImageMediaType = (typeof SUPPORTED_IMAGE_MEDIA_TYPES)[number];

function isSupportedImageMediaType(value: string): value is SupportedImageMediaType {
  return (SUPPORTED_IMAGE_MEDIA_TYPES as readonly string[]).includes(value);
}

// Photo/Gallery capture v1 - downloads the attached image from the
// private "drop-attachments" bucket (service-role client, bypasses RLS,
// same as every other supabaseAdmin call in this route) and returns it
// base64-encoded for a Claude vision content block. Returns null on any
// failure (download error, or an unsupported format) rather than
// throwing - a broken/missing/unsupported image must never take down the
// rest of analysis, it just silently falls back to text-only (see the
// try/catch at the call site below).
async function downloadImageAsBase64(
  imagePath: string
): Promise<{ data: string; mediaType: SupportedImageMediaType } | null> {
  const { data: blob, error } = await supabaseAdmin.storage
    .from("drop-attachments")
    .download(imagePath);

  if (error || !blob) {
    console.error("Couldn't download attached image for analysis", error);
    return null;
  }

  if (!isSupportedImageMediaType(blob.type)) {
    console.error("Attached image has an unsupported media type for vision analysis", blob.type);
    return null;
  }

  const arrayBuffer = await blob.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer).toString("base64"),
    mediaType: blob.type,
  };
}

export async function POST(request: Request) {
  const {
    id,
    text,
    captureTimezone: requestTimezone,
    temporalPreviewOnly,
    imagePath,
  } = await request.json();

  if (!id || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing id or text" }, { status: 400 });
  }

  // The client sends its real IANA timezone (Intl.DateTimeFormat().resolvedOptions().timeZone)
  // captured at the moment analyzeDrop() fires. Fall back to UTC only for
  // requests from a caller that doesn't send it (e.g. a stale client build) -
  // this is a plain default, not an offset-derived guess.
  const captureTimezone =
    typeof requestTimezone === "string" && requestTimezone.trim() ? requestTimezone : "UTC";

  try {
    const { data: captureRow, error: captureLookupError } = await supabaseAdmin
      .from("captures")
      .select(
        "user_id, created_at, space_ids, space_manually_set, temporal_locked, checklist_items, source"
      )
      .eq("id", id)
      .single();

    if (captureLookupError) throw captureLookupError;

    // Sunshine Drop cards (system-generated, e.g. Daily Brief) are never
    // content-classified by AI - their category/Space identity is fixed
    // regardless of what's in their body text. This is the authoritative
    // skip: whatever caller hit this route (an edit, a future re-analysis
    // job, anything) can never reclassify a system Drop into a real
    // content Space. DropCard's own isSunshineDrop rendering guard is a
    // display-only backstop on top of this, not the source of truth.
    // Deliberately placed before the temporalPreviewOnly branch too, so
    // no path through this route can touch a system Drop's identity.
    if (captureRow.source === "system") {
      const { error: systemUpdateError } = await supabaseAdmin
        .from("captures")
        .update({ category: SUNSHINE_DROP_CATEGORY, space_ids: [] })
        .eq("id", id);

      if (systemUpdateError) throw systemUpdateError;

      return NextResponse.json({
        skipped: true,
        category: SUNSHINE_DROP_CATEGORY,
        spaceIds: [],
      });
    }

    // Always computed fresh from the current text rather than trusted from
    // the stored entities column, which updateCaptureText never refreshes -
    // this is what keeps risk-flag/candidate detection correct after an
    // edit, not just at creation time.
    const freshEntities = recognizeEntities(text);
    const hasUrl = freshEntities.urls.length > 0 || URL_PATTERN.test(text);
    const localCandidates = freshEntities.dates;
    const riskFlags = detectRiskFlags(text);
    const referenceDatetime = captureRow.created_at as string;
    const includeTemporalTask = shouldEscalateToAi(text, localCandidates, riskFlags);

    // Lightweight path used only by the edit-time "update date from text?"
    // suggestion in DropDetailModal, after a locked Drop's text changes.
    // Computes and returns a temporal resolution WITHOUT writing anything -
    // the user must explicitly confirm before it overwrites a locked value.
    if (temporalPreviewOnly) {
      let temporal: TemporalExtraction | null = null;

      if (includeTemporalTask) {
        const response = await anthropic.messages.create({
          model: "claude-opus-4-8",
          max_tokens: 512,
          system: buildTemporalOnlySystemPrompt(
            text,
            referenceDatetime,
            captureTimezone,
            localCandidates,
            riskFlags
          ),
          messages: [{ role: "user", content: text }],
        });

        const rawText = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();

        const temporalMatch = rawText.match(/TEMPORAL:\s*([\s\S]*)$/i);
        temporal = parseTemporal(temporalMatch?.[1]);
      }

      const temporalResolution = resolveTemporal(
        { rawText: text, referenceDatetime, captureTimezone, localCandidates, riskFlags },
        buildAiTemporalResult(temporal, captureTimezone)
      );

      return NextResponse.json({ temporal: temporalResolution });
    }

    const temporalLocked = captureRow.temporal_locked ?? false;
    // A locked Drop's date was set/corrected manually - never let an
    // automatic edit-triggered pass silently overwrite it. The other 7
    // tasks still run normally either way.
    const effectiveIncludeTemporalTask = !temporalLocked && includeTemporalTask;

    // A download failure degrades to hasImage=false (plain text analysis)
    // rather than failing the request - matches the "still save fine with
    // no rich analysis" requirement for a broken/missing attachment.
    const image = typeof imagePath === "string" && imagePath ? await downloadImageAsBase64(imagePath) : null;
    const hasImage = image !== null;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: buildSystemPrompt(
        hasUrl,
        hasImage,
        effectiveIncludeTemporalTask,
        text,
        referenceDatetime,
        captureTimezone,
        localCandidates,
        riskFlags
      ),
      tools: hasUrl
        ? [
            { type: "web_search_20260209", name: "web_search" },
            { type: "web_fetch_20260209", name: "web_fetch" },
          ]
        : [{ type: "web_search_20260209", name: "web_search" }],
      messages: [
        {
          role: "user",
          content: image
            ? [
                {
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: image.mediaType,
                    data: image.data,
                  },
                },
                { type: "text" as const, text },
              ]
            : text,
        },
      ],
    });

    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const { research, address, formatted, workout, title, isActionable, category, spaceId, temporal } =
      parseAnalysis(rawText);

    // Never overwrite a Space the user manually assigned/changed themselves -
    // AI classification only applies while a Drop is still on its original
    // auto-assigned Space.
    const nextSpaceIds = captureRow.space_manually_set ? captureRow.space_ids : [spaceId];

    const existingChecklistItems = (captureRow.checklist_items ?? []) as ChecklistItem[];
    const checklistItems = extractChecklistItems(formatted, existingChecklistItems);

    const updatePayload: Record<string, unknown> = {
      ai_research_result: research ? JSON.stringify(research) : null,
      extracted_address: address,
      formatted_text: formatted,
      title,
      is_actionable: isActionable,
      category,
      space_ids: nextSpaceIds,
      checklist_items: checklistItems,
    };

    let temporalResolution: TemporalResolutionOutput | null = null;

    if (!temporalLocked) {
      temporalResolution = resolveTemporal(
        { rawText: text, referenceDatetime, captureTimezone, localCandidates, riskFlags },
        buildAiTemporalResult(temporal, captureTimezone)
      );

      updatePayload.event_at = temporalResolution.eventAt;
      updatePayload.event_has_time = temporalResolution.eventHasTime;
      updatePayload.event_timezone = temporalResolution.eventTimezone;
      updatePayload.event_status = temporalResolution.eventStatus;
      updatePayload.temporal_confidence = temporalResolution.temporalConfidence;
      updatePayload.temporal_raw_text = temporalResolution.temporalRawText;
      updatePayload.recurring = temporalResolution.recurring;
      updatePayload.recurrence_type = temporalResolution.recurrenceType;
      updatePayload.recurrence_raw_text = temporalResolution.recurrenceRawText;
      updatePayload.recurrence_interval = temporalResolution.recurrenceInterval;
    }
    // else: temporal columns are simply omitted from the update - locked,
    // untouched, exactly as they were before this edit.

    const { error } = await supabaseAdmin.from("captures").update(updatePayload).eq("id", id);

    if (error) throw error;

    if (workout) {
      const { error: workoutError } = await supabaseAdmin.from("workout_entries").upsert(
        {
          capture_id: id,
          user_id: captureRow.user_id,
          activity_type: workout.activity_type,
          rounds: workout.rounds,
          round_length_minutes: workout.round_length_minutes,
          total_duration_minutes: workout.total_duration_minutes,
          notes: workout.notes,
          date: captureRow.created_at.slice(0, 10),
        },
        { onConflict: "capture_id" }
      );

      if (workoutError) throw workoutError;
    } else {
      // Not a workout (or no longer one, after an edit) - clear any stale entry. No-op if none exists.
      const { error: deleteError } = await supabaseAdmin
        .from("workout_entries")
        .delete()
        .eq("capture_id", id);

      if (deleteError) throw deleteError;
    }

    return NextResponse.json({
      result: research,
      address,
      formatted,
      workout,
      title,
      isActionable,
      category,
      spaceIds: nextSpaceIds,
      checklistItems,
      ...(temporalResolution
        ? {
            eventAt: temporalResolution.eventAt,
            eventHasTime: temporalResolution.eventHasTime,
            eventTimezone: temporalResolution.eventTimezone,
            eventStatus: temporalResolution.eventStatus,
            temporalConfidence: temporalResolution.temporalConfidence,
            temporalRawText: temporalResolution.temporalRawText,
            recurring: temporalResolution.recurring,
            recurrenceType: temporalResolution.recurrenceType,
            recurrenceRawText: temporalResolution.recurrenceRawText,
            recurrenceInterval: temporalResolution.recurrenceInterval,
          }
        : {}),
    });
  } catch (error) {
    console.error("analyze-drop failed", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
