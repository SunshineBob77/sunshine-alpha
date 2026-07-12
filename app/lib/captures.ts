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
  eventAt: string | null;
  eventHasTime: boolean | null;
  eventTimezone: string | null;
  eventStatus: "none" | "resolved" | "unresolved" | "dismissed";
  temporalConfidence: "high" | "low" | null;
  temporalRawText: string | null;
  temporalLocked: boolean;
  source: "user" | "system";
  systemDropType: string | null;
  generatedForDate: string | null;
  archivedAt: string | null;
  pinned: boolean;
};

export type CaptureRow = {
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
  event_at: string | null;
  event_has_time: boolean | null;
  event_timezone: string | null;
  event_status: "none" | "resolved" | "unresolved" | "dismissed" | null;
  temporal_confidence: "high" | "low" | null;
  temporal_raw_text: string | null;
  temporal_locked: boolean;
  source: "user" | "system";
  system_drop_type: string | null;
  generated_for_date: string | null;
  archived_at: string | null;
  pinned: boolean;
};

export function mapRowToCapture(row: CaptureRow): Capture {
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
    eventAt: row.event_at ?? null,
    eventHasTime: row.event_has_time ?? null,
    eventTimezone: row.event_timezone ?? null,
    eventStatus: row.event_status ?? "none",
    temporalConfidence: row.temporal_confidence ?? null,
    temporalRawText: row.temporal_raw_text ?? null,
    temporalLocked: row.temporal_locked ?? false,
    source: row.source ?? "user",
    systemDropType: row.system_drop_type ?? null,
    generatedForDate: row.generated_for_date ?? null,
    archivedAt: row.archived_at ?? null,
    pinned: row.pinned ?? false,
  };
}

export async function fetchCaptures(): Promise<Capture[]> {
  // Archived System Drops (e.g. yesterday's Morning Brief) stay in the DB
  // and remain directly queryable, they just drop out of the active
  // Lifeline view - same as how completed Drops are handled elsewhere.
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const captures = (data as CaptureRow[]).map(mapRowToCapture);

  // Non-archived System Drops are pinned to the top of the Lifeline for
  // their day, regardless of how many user Drops get created after them.
  return captures.sort((a, b) => {
    const aSystem = a.source === "system" ? 1 : 0;
    const bSystem = b.source === "system" ? 1 : 0;
    if (aSystem !== bSystem) return bSystem - aSystem;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
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

export async function updateCaptureTemporal(
  id: number,
  input: { eventAt: string; eventHasTime: boolean; eventTimezone: string }
): Promise<void> {
  // Manually setting/correcting a date locks it, mirroring
  // updateCaptureSpaces's space_manually_set - future automatic
  // re-analysis on text edits must never silently overwrite a user's
  // own correction. temporal_raw_text is deliberately not touched here:
  // it represents what the original capture said, not the correction.
  const { error } = await supabase
    .from("captures")
    .update({
      event_at: input.eventAt,
      event_has_time: input.eventHasTime,
      event_timezone: input.eventTimezone,
      event_status: "resolved",
      temporal_confidence: "high",
      temporal_locked: true,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function dismissCaptureTemporal(id: number): Promise<void> {
  // "Not a calendar event" - sets temporal_locked alongside event_status
  // so this reuses the exact same protection updateCaptureTemporal relies
  // on (analyze-drop/route.ts already unconditionally skips the temporal
  // task and all temporal writes for a locked Drop) - no new gating logic
  // needed for a future edit/re-analysis to leave this alone.
  const { error } = await supabase
    .from("captures")
    .update({ event_status: "dismissed", temporal_locked: true })
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

export async function updateCapturePinned(id: number, pinned: boolean): Promise<void> {
  const { error } = await supabase.from("captures").update({ pinned }).eq("id", id);
  if (error) throw error;
}
