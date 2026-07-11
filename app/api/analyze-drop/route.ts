import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import type { RecognizedEntities, RecognizedDate } from "@/app/lib/recognizeEntities";
import {
  detectRiskFlags,
  resolveTemporal,
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
  rawText: string,
  referenceDatetime: string,
  captureTimezone: string,
  localCandidates: RecognizedDate[]
): string {
  const candidatesText =
    localCandidates.length > 0 ? JSON.stringify(localCandidates) : "none";

  return `
8. Determine if this text refers to one specific, resolvable date or time.

Raw text: ${rawText}
Reference date/time: ${referenceDatetime}
Capture timezone: ${captureTimezone}
Locally-detected candidate(s): ${candidatesText}

Rules:
- If the text clearly identifies a single intended date (e.g. "Meeting moved from Monday to Tuesday" clearly means Tuesday), resolve to that one date.
- If the text uses vague or uncertain language ("sometime", "around", "ish", "ASAP", "a couple weeks") without enough surrounding context to pin down a specific date, do NOT invent one — respond unresolved instead, even if a local candidate exists.
- If the text has no temporal meaning at all, respond none.
- Only respond resolved when you have genuine confidence in one specific instant.
- "ASAP" and pure urgency language, without any resolvable date, must always be unresolved — never invent a date for urgency alone.
- If resolving a date-only reference with no explicit time of day, say so explicitly.`;
}

function buildSystemPrompt(
  hasUrl: boolean,
  includeTemporalTask: boolean,
  rawText: string,
  referenceDatetime: string,
  captureTimezone: string,
  localCandidates: RecognizedDate[]
): string {
  const taskCount = includeTemporalTask ? "eight" : "seven";
  const temporalTask = includeTemporalTask
    ? buildTemporalTask(rawText, referenceDatetime, captureTimezone, localCandidates)
    : "";

  return `You are analyzing a short personal note (a "Drop"). Do ${taskCount} independent things:

${hasUrl ? RESEARCH_TASK_WITH_URL : RESEARCH_TASK_DEFAULT}
2. Determine if this note contains a physical address (e.g. a hotel, restaurant, or event location). If yes, extract it exactly as written. If no, use the value null.
3. Reformat the note's own content for clean display, using Markdown. Detect its structure and format accordingly:
   - A list of items should become a real Markdown bullet list. Recognize list structure from:
     - Explicit separators: commas, "and", semicolons, or newlines.
     - Multiple imperative verb phrases run together with no punctuation at all (e.g. "Create website find URL upload code" has natural breaks between each verb phrase — bullet them separately), when each phrase clearly stands as an independent action.
   - If the note contains two or more complete sentences (each ending in its own period), ALWAYS give each sentence its own line — either as separate bullet points if they are separate actionable/memorable items, or as separate paragraph lines if they read more like a narrative. Never merge multiple complete sentences into one continuous run-on line.
   - Tabular or cost/price data → a real Markdown table.
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
  const researchMatch = rawText.match(/RESEARCH:\s*([\s\S]*?)\s*ADDRESS:/i);
  const addressMatch = rawText.match(/ADDRESS:\s*([\s\S]*?)\s*FORMATTED:/i);
  const formattedMatch = rawText.match(/FORMATTED:\s*([\s\S]*?)\s*WORKOUT:/i);
  const workoutMatch = rawText.match(/WORKOUT:\s*([\s\S]*?)\s*TITLE:/i);
  const titleMatch = rawText.match(/TITLE:\s*([\s\S]*?)\s*ACTIONABLE:/i);
  const actionableMatch = rawText.match(/ACTIONABLE:\s*([\s\S]*?)\s*CATEGORY:/i);
  const categoryMatch = rawText.match(/CATEGORY:\s*([\s\S]*?)\s*SPACE:/i);
  const spaceMatch = rawText.match(/SPACE:\s*([\s\S]*?)\s*TEMPORAL:/i);
  const temporalMatch = rawText.match(/TEMPORAL:\s*([\s\S]*)$/i);

  if (
    !researchMatch ||
    !addressMatch ||
    !formattedMatch ||
    !workoutMatch ||
    !titleMatch ||
    !actionableMatch ||
    !categoryMatch ||
    !spaceMatch ||
    !temporalMatch
  ) {
    // Model didn't follow the format — fall back to treating the whole response as the research answer.
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
    research: parseResearch(researchMatch[1]),
    address: nullableValue(addressMatch[1]),
    formatted: nullableValue(formattedMatch[1]),
    workout: parseWorkout(workoutMatch[1]),
    title: nullableValue(titleMatch[1]),
    isActionable: actionableMatch[1].trim().toLowerCase().startsWith("true"),
    category: parseCategory(categoryMatch[1]),
    spaceId: parseSpace(spaceMatch[1]),
    temporal: parseTemporal(temporalMatch[1]),
  };
}

export async function POST(request: Request) {
  const { id, text, captureTimezone: requestTimezone } = await request.json();

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
      .select("user_id, created_at, space_ids, space_manually_set, entities")
      .eq("id", id)
      .single();

    if (captureLookupError) throw captureLookupError;

    // Deterministic trigger, not a wording inference: prefer the already
    // -computed entities.urls (Recognize stage), but also check the raw
    // text directly in case entities is missing or stale (e.g. an edited
    // Drop - updateCaptureText doesn't currently recompute entities).
    const entities = captureRow.entities as RecognizedEntities | null;
    const hasUrl = (entities?.urls?.length ?? 0) > 0 || URL_PATTERN.test(text);

    const localCandidates: RecognizedDate[] = entities?.dates ?? [];
    const riskFlags = detectRiskFlags(text);
    const referenceDatetime = captureRow.created_at as string;

    // Only ask the AI about temporal resolution when the local pass alone
    // can't be trusted: nothing found, a single candidate with a risk flag,
    // or multiple candidates to disambiguate. A clean single candidate with
    // no risk flags skips the AI task entirely (see the resolveTemporal call
    // below, which is called directly with aiResult: null in that case).
    const includeTemporalTask =
      localCandidates.length === 0 ||
      (localCandidates.length === 1 && riskFlags.length > 0) ||
      localCandidates.length >= 2;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: buildSystemPrompt(
        hasUrl,
        includeTemporalTask,
        text,
        referenceDatetime,
        captureTimezone,
        localCandidates
      ),
      tools: hasUrl
        ? [
            { type: "web_search_20260209", name: "web_search" },
            { type: "web_fetch_20260209", name: "web_fetch" },
          ]
        : [{ type: "web_search_20260209", name: "web_search" }],
      messages: [{ role: "user", content: text }],
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

    // aiResult is null both when the TEMPORAL task was intentionally skipped
    // (clean single candidate) and when it was included but the model's JSON
    // didn't parse - resolveTemporal treats both cases identically (safe
    // degradation), so there's no need to distinguish them here.
    const aiTemporalResult: TemporalResolutionOutput | null =
      includeTemporalTask && temporal
        ? {
            eventAt: temporal.eventAt,
            eventHasTime: temporal.hasTime,
            eventTimezone: captureTimezone,
            eventStatus: temporal.status,
            // The model isn't asked for a confidence value directly - its own
            // instructions already gate 'resolved' on genuine confidence, so
            // 'high' is the correct label when it commits to that status.
            // resolveTemporal's universal rule nulls this out for any
            // non-resolved status regardless of what's passed here.
            temporalConfidence: temporal.status === "resolved" ? "high" : null,
            temporalRawText: null,
          }
        : null;

    const temporalResolution = resolveTemporal(
      {
        rawText: text,
        referenceDatetime,
        captureTimezone,
        localCandidates,
        riskFlags,
      },
      aiTemporalResult
    );

    const { error } = await supabaseAdmin
      .from("captures")
      .update({
        ai_research_result: research ? JSON.stringify(research) : null,
        extracted_address: address,
        formatted_text: formatted,
        title,
        is_actionable: isActionable,
        category,
        space_ids: nextSpaceIds,
        event_at: temporalResolution.eventAt,
        event_has_time: temporalResolution.eventHasTime,
        event_timezone: temporalResolution.eventTimezone,
        event_status: temporalResolution.eventStatus,
        temporal_confidence: temporalResolution.temporalConfidence,
        temporal_raw_text: temporalResolution.temporalRawText,
      })
      .eq("id", id);

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
      eventAt: temporalResolution.eventAt,
      eventHasTime: temporalResolution.eventHasTime,
      eventTimezone: temporalResolution.eventTimezone,
      eventStatus: temporalResolution.eventStatus,
      temporalConfidence: temporalResolution.temporalConfidence,
      temporalRawText: temporalResolution.temporalRawText,
    });
  } catch (error) {
    console.error("analyze-drop failed", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
