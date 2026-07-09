import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are analyzing a short personal note (a "Drop"). Do four independent things:

1. Determine if this note is a research request (asking to find, look up, recommend, or research something — e.g. recipes, products, information). If yes, search the web and return a concise, useful answer in 2-4 sentences. If no, use the value null.
2. Determine if this note contains a physical address (e.g. a hotel, restaurant, or event location). If yes, extract it exactly as written. If no, use the value null.
3. Reformat the note's own content for clean display, using Markdown. Detect its structure and format accordingly:
   - A list of items (things separated by commas, "and", or newlines) → a real Markdown bullet list.
   - Tabular or cost/price data → a real Markdown table.
   - A single short reminder or thought → a plain sentence, no forced structure.
   - A longer multi-line note → preserve the original paragraph breaks, do not compress it into one line.
   Only reformat what's already there — do not add commentary, headers, or new content. This field must never be null.
4. Determine if this note describes a workout or exercise session. If it does NOT, use the value null. If it DOES, extract a JSON object with exactly these fields:
   - activity_type: string — the primary activity (e.g. "boxing", "running", "weightlifting")
   - rounds: number or null — the count of rounds/sets that make up the MAIN quantified structure of the session, if explicitly stated
   - round_length_minutes: number or null — the length of each of those main rounds in minutes, if explicitly stated
   - total_duration_minutes: number or null — ONLY set this if the total is explicitly stated outright, OR if rounds and round_length_minutes both describe the single same uniform structure and multiplying them cleanly gives the total. If the note describes multiple different round structures with different or unstated lengths, leave this null rather than guessing or estimating.
   - notes: string — free text capturing who they trained with, drills done, secondary activities/rounds that didn't cleanly fit the structured fields above, and anything else worth remembering. Do not leave out information just because it didn't fit a field above — put it here instead.
   Respond with just the JSON object on one line, or the literal word null.

Do not narrate what you're about to do or describe your search process — no preamble like "I'll search for..." or "Let me find...".

Respond with exactly this format and nothing else before or after it:
RESEARCH: <answer or null>
ADDRESS: <address or null>
FORMATTED: <reformatted note>
WORKOUT: <JSON object or null>`;

const PREAMBLE_PATTERN = /^[^.!?\n]*\b(I'll search|I will search|Let me|I'll look|I will look)\b[^.!?\n]*[.!?]+\s*/i;

function stripPreamble(text: string): string {
  return text.replace(PREAMBLE_PATTERN, "").trim();
}

function nullableValue(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  return value.length === 0 || value.toLowerCase() === "null" ? null : value;
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

function parseAnalysis(rawText: string): {
  research: string | null;
  address: string | null;
  formatted: string | null;
  workout: WorkoutExtraction | null;
} {
  const researchMatch = rawText.match(/RESEARCH:\s*([\s\S]*?)\s*ADDRESS:/i);
  const addressMatch = rawText.match(/ADDRESS:\s*([\s\S]*?)\s*FORMATTED:/i);
  const formattedMatch = rawText.match(/FORMATTED:\s*([\s\S]*?)\s*WORKOUT:/i);
  const workoutMatch = rawText.match(/WORKOUT:\s*([\s\S]*)$/i);

  if (!researchMatch || !addressMatch || !formattedMatch || !workoutMatch) {
    // Model didn't follow the format — fall back to treating the whole response as the research answer.
    return {
      research: nullableValue(stripPreamble(rawText)),
      address: null,
      formatted: null,
      workout: null,
    };
  }

  return {
    research: nullableValue(stripPreamble(researchMatch[1])),
    address: nullableValue(addressMatch[1]),
    formatted: nullableValue(formattedMatch[1]),
    workout: parseWorkout(workoutMatch[1]),
  };
}

export async function POST(request: Request) {
  const { id, text } = await request.json();

  if (!id || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing id or text" }, { status: 400 });
  }

  try {
    const { data: captureRow, error: captureLookupError } = await supabaseAdmin
      .from("captures")
      .select("user_id, created_at")
      .eq("id", id)
      .single();

    if (captureLookupError) throw captureLookupError;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages: [{ role: "user", content: text }],
    });

    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const { research, address, formatted, workout } = parseAnalysis(rawText);

    const { error } = await supabaseAdmin
      .from("captures")
      .update({
        ai_research_result: research,
        extracted_address: address,
        formatted_text: formatted,
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

    return NextResponse.json({ result: research, address, formatted, workout });
  } catch (error) {
    console.error("analyze-drop failed", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
