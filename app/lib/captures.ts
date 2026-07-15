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

export type ChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
};

// A checklist Drop needs confirmation before Complete only while at least
// one item is still unchecked - an empty or fully-checked list behaves
// exactly like a non-checklist Drop.
export function hasUncheckedChecklistItems(items: ChecklistItem[]): boolean {
  return items.length > 0 && items.some((item) => !item.checked);
}

export type PreviousState = {
  status: "active" | "completed";
  hiddenUntil: string | null;
  userArchivedAt: string | null;
};

// One entry per checked-off Reminders occurrence. occurrenceDate is which
// calendar-day occurrence was dismissed (distinguishes one recurring
// Drop's separate future dates from each other); dismissedOn is the day
// the checkbox was actually tapped, which is what lets the Reminders card
// keep it visible-but-greyed for the rest of that day and then drop it
// entirely from the next day on - see buildReminderGroups in reminders.ts.
export type ReminderDismissal = {
  occurrenceDate: string;
  dismissedOn: string;
};

// Card Carousel: a lightweight sub-card attached to a Drop (a photo
// caption, a follow-up thought, a related note) - deliberately NOT a full
// Drop of its own (no category/project/mood/temporal/AI fields), see
// docs/drop-attachments-schema.sql. Fetched embedded alongside its parent
// capture via a single PostgREST join, not a separate round trip.
export type DropAttachment = {
  id: number;
  createdBy: string;
  content: string;
  orderIndex: number;
  createdAt: string;
};

type DropAttachmentRow = {
  id: number;
  created_by: string;
  content: string;
  order_index: number;
  created_at: string;
};

function mapRowToAttachment(row: DropAttachmentRow): DropAttachment {
  return {
    id: row.id,
    createdBy: row.created_by,
    content: row.content,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
}

export type Capture = {
  id: number;
  userId: string;
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
  recurring: boolean;
  recurrenceType: "yearly" | "day" | "week" | "month" | "year" | null;
  recurrenceRawText: string | null;
  recurrenceInterval: number | null;
  checklistItems: ChecklistItem[];
  hiddenUntil: string | null;
  userArchivedAt: string | null;
  previousState: PreviousState | null;
  reminderDismissedDates: ReminderDismissal[];
  attachments: DropAttachment[];
};

export type CaptureRow = {
  id: number;
  user_id: string;
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
  recurring: boolean;
  recurrence_type: "yearly" | "day" | "week" | "month" | "year" | null;
  recurrence_raw_text: string | null;
  recurrence_interval: number | null;
  checklist_items: ChecklistItem[] | null;
  hidden_until: string | null;
  user_archived_at: string | null;
  previous_state: PreviousState | null;
  reminder_dismissed_dates: ReminderDismissal[] | null;
  // Embedded via PostgREST's join on the drop_attachments -> captures FK
  // (see fetchCaptures' select string) - null when the embed wasn't
  // requested, empty array when requested but there are none.
  drop_attachments: DropAttachmentRow[] | null;
};

export function mapRowToCapture(row: CaptureRow): Capture {
  return {
    id: row.id,
    userId: row.user_id,
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
    recurring: row.recurring ?? false,
    recurrenceType: row.recurrence_type ?? null,
    recurrenceRawText: row.recurrence_raw_text ?? null,
    recurrenceInterval: row.recurrence_interval ?? null,
    checklistItems: row.checklist_items ?? [],
    hiddenUntil: row.hidden_until ?? null,
    userArchivedAt: row.user_archived_at ?? null,
    previousState: row.previous_state ?? null,
    reminderDismissedDates: row.reminder_dismissed_dates ?? [],
    // Sorted defensively even though the fetchCaptures query already
    // orders the embed server-side - insertCaptureAttachment's own local
    // append (see DashboardContext.addAttachment) relies on this same
    // ordering guarantee holding after a full re-fetch too.
    attachments: (row.drop_attachments ?? [])
      .map(mapRowToAttachment)
      .sort((a, b) => a.orderIndex - b.orderIndex),
  };
}

export async function fetchCaptures(): Promise<Capture[]> {
  // Archived System Drops (e.g. yesterday's Morning Brief) stay in the DB
  // and remain directly queryable, they just drop out of the active
  // Lifeline view - same as how completed Drops are handled elsewhere.
  const { data, error } = await supabase
    .from("captures")
    .select("*, drop_attachments(*)")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .order("order_index", { foreignTable: "drop_attachments", ascending: true });

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
  // True when spaceIds came from an explicit context (e.g. capturing
  // while viewing a specific Space's filtered Lifeline) rather than the
  // keyword-based guess in analyzeCapture() - without this, the
  // background analyze-drop AI pass that fires right after every capture
  // would silently overwrite spaceIds moments later (it only respects an
  // existing assignment when space_manually_set is already true). Same
  // flag updateCaptureSpaces already sets whenever a user edits via the
  // Edit Spaces picker.
  spaceManuallySet?: boolean;
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
      space_manually_set: input.spaceManuallySet ?? false,
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
  // A manual date is always a specific, authoritative one-time value -
  // clears recurring even if it was previously auto-detected as such,
  // since the user is now overriding with an explicit date rather than
  // relying on next-occurrence detection.
  const { error } = await supabase
    .from("captures")
    .update({
      event_at: input.eventAt,
      event_has_time: input.eventHasTime,
      event_timezone: input.eventTimezone,
      event_status: "resolved",
      temporal_confidence: "high",
      recurring: false,
      recurrence_type: null,
      recurrence_raw_text: null,
      recurrence_interval: null,
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
  // needed for a future edit/re-analysis to leave this alone. Also clears
  // recurring/recurrence_type/recurrence_raw_text/recurrence_interval - a
  // Drop the user says isn't a calendar item at all shouldn't keep
  // floating a recurrence flag either.
  const { error } = await supabase
    .from("captures")
    .update({
      event_status: "dismissed",
      temporal_locked: true,
      recurring: false,
      recurrence_type: null,
      recurrence_raw_text: null,
      recurrence_interval: null,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function updateCaptureText(id: number, text: string): Promise<void> {
  const { error } = await supabase.from("captures").update({ text }).eq("id", id);
  if (error) throw error;
}

export async function updateCaptureStatus(
  id: number,
  status: "active" | "completed",
  previousState?: PreviousState | null
): Promise<void> {
  const payload: Record<string, unknown> = { status };
  // Only touched when transitioning TO completed (see DashboardContext.updateStatus)
  // - un-completing is already its own direct undo-equivalent action and
  // never needs a snapshot.
  if (previousState !== undefined) payload.previous_state = previousState;

  const { error } = await supabase.from("captures").update(payload).eq("id", id);
  if (error) throw error;
}

export async function updateCaptureHide(
  id: number,
  hiddenUntil: string | null,
  previousState: PreviousState | null
): Promise<void> {
  const { error } = await supabase
    .from("captures")
    .update({ hidden_until: hiddenUntil, previous_state: previousState })
    .eq("id", id);

  if (error) throw error;
}

export async function updateCaptureArchive(
  id: number,
  archived: boolean,
  previousState: PreviousState | null
): Promise<void> {
  const { error } = await supabase
    .from("captures")
    .update({
      user_archived_at: archived ? new Date().toISOString() : null,
      previous_state: previousState,
    })
    .eq("id", id);

  if (error) throw error;
}

// Single-level undo: restores exactly the three fields Complete/Hide/
// Archive touch, then clears previous_state - no redo chain, matching
// the "single-level, not a full history stack" scope.
export async function updateCaptureUndo(
  id: number,
  previousState: PreviousState
): Promise<void> {
  const { error } = await supabase
    .from("captures")
    .update({
      status: previousState.status,
      hidden_until: previousState.hiddenUntil,
      user_archived_at: previousState.userArchivedAt,
      previous_state: null,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function updateCapturePinned(id: number, pinned: boolean): Promise<void> {
  const { error } = await supabase.from("captures").update({ pinned }).eq("id", id);
  if (error) throw error;
}

export async function updateCaptureChecklistItems(
  id: number,
  items: ChecklistItem[]
): Promise<void> {
  const { error } = await supabase
    .from("captures")
    .update({ checklist_items: items })
    .eq("id", id);

  if (error) throw error;
}

export async function updateCaptureReminderDismissals(
  id: number,
  dismissals: ReminderDismissal[]
): Promise<void> {
  const { error } = await supabase
    .from("captures")
    .update({ reminder_dismissed_dates: dismissals })
    .eq("id", id);

  if (error) throw error;
}

// Card Carousel - orderIndex is computed by the caller (current max
// among the parent's already-loaded attachments + 1, see
// DashboardContext.addAttachment) rather than here, since the caller
// already has that array in local state and computing it there avoids an
// extra round trip. RLS (drop_attachments' insert policy) is the actual
// write boundary - "friendly invite" model, any active member of the
// parent Drop's space can attach, not just its owner; created_by is
// still pinned to the real caller regardless of whose Drop it is.
export async function insertCaptureAttachment(
  parentCaptureId: number,
  content: string,
  orderIndex: number
): Promise<DropAttachment> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("drop_attachments")
    .insert({
      parent_capture_id: parentCaptureId,
      created_by: userData.user.id,
      content,
      order_index: orderIndex,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRowToAttachment(data as DropAttachmentRow);
}
