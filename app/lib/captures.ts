import { supabase } from "./supabaseClient";
import type { RecognizedEntities } from "./recognizeEntities";

// AI research answers are stored as JSON-encoded bullet arrays in the
// existing ai_research_result text column (no schema change) - but rows
// written before this change hold plain prose. Parsing here means every
// caller gets a value that's either string[] (new) or string (legacy),
// and can render either without knowing which format is in the DB.
export function parseResearchResult(raw: string | null): string | string[] | null {
  if (raw == null) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
  } catch {
    // Not JSON - old-format plain-text research result, return as-is.
  }

  return raw;
}

export type Capture = {
  id: number;
  text: string;
  createdAt: string;
  category: string;
  project: string;
  tags: string[];
  mood: string;
  sunshineSummary: string;
  spaceIds: string[];
  aiResearchResult: string | string[] | null;
  extractedAddress: string | null;
  formattedText: string | null;
  title: string | null;
  status: "active" | "completed" | "deleted";
  isActionable: boolean;
  spaceManuallySet: boolean;
  entities: RecognizedEntities | null;
};

type CaptureRow = {
  id: number;
  text: string;
  created_at: string;
  category: string;
  project: string;
  tags: string[];
  mood: string;
  sunshine_summary: string;
  space_ids: string[];
  ai_research_result: string | null;
  extracted_address: string | null;
  formatted_text: string | null;
  title: string | null;
  status: "active" | "completed" | "deleted";
  is_actionable: boolean;
  space_manually_set: boolean;
  entities: RecognizedEntities | null;
};

function mapRowToCapture(row: CaptureRow): Capture {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    category: row.category,
    project: row.project,
    tags: row.tags ?? [],
    mood: row.mood,
    sunshineSummary: row.sunshine_summary,
    spaceIds: row.space_ids ?? [],
    aiResearchResult: parseResearchResult(row.ai_research_result),
    extractedAddress: row.extracted_address ?? null,
    formattedText: row.formatted_text ?? null,
    title: row.title ?? null,
    status: row.status ?? "active",
    isActionable: row.is_actionable ?? false,
    spaceManuallySet: row.space_manually_set ?? false,
    entities: row.entities ?? null,
  };
}

export async function fetchCaptures(): Promise<Capture[]> {
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as CaptureRow[]).map(mapRowToCapture);
}

export async function insertCapture(input: {
  text: string;
  category: string;
  project: string;
  tags: string[];
  mood: string;
  sunshineSummary: string;
  spaceIds: string[];
  entities: RecognizedEntities;
}): Promise<Capture> {
  const { data, error } = await supabase
    .from("captures")
    .insert({
      text: input.text,
      category: input.category,
      project: input.project,
      tags: input.tags,
      mood: input.mood,
      sunshine_summary: input.sunshineSummary,
      space_ids: input.spaceIds,
      entities: input.entities,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRowToCapture(data as CaptureRow);
}

export async function deleteCapture(id: number): Promise<void> {
  const { error } = await supabase.from("captures").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCaptureSpaces(id: number, spaceIds: string[]): Promise<void> {
  // Manually touching Space assignment permanently protects this Drop from
  // future AI re-classification overwriting the user's choice.
  const { error } = await supabase
    .from("captures")
    .update({ space_ids: spaceIds, space_manually_set: true })
    .eq("id", id);

  if (error) throw error;
}

export async function updateCaptureText(id: number, text: string): Promise<void> {
  const { error } = await supabase.from("captures").update({ text }).eq("id", id);
  if (error) throw error;
}

export async function updateCaptureStatus(
  id: number,
  status: "active" | "completed"
): Promise<void> {
  const { error } = await supabase.from("captures").update({ status }).eq("id", id);
  if (error) throw error;
}
