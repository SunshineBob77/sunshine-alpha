import { supabase } from "./supabaseClient";
import type { RecognizedEntities } from "./recognizeEntities";
import type { DailyBriefSpaceActivity } from "./dailyBrief";
import type { DailyBriefStatsPayload } from "./dailyBriefStats";

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

export type Capture = {
  id: number;
  userId: string;
  text: string;
  createdAt: string;
  // Only bumped by the DB trigger on genuine content changes (text,
  // formatted_text, title, checklist_items, space_ids) - see
  // captures_bump_updated_at in docs/daily-brief-schema.sql. State/
  // housekeeping toggles (pin, hide, archive, undo, reminder dismissals)
  // deliberately don't touch this.
  updatedAt: string;
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
  // Card Carousel v2: two or more captures sharing the same groupId are
  // members of the same swipeable carousel, each a full independent Drop
  // with its own complete lifecycle - null means a normal standalone
  // Drop, unaffected. See docs/drop-groups-schema.sql. No embedding/join
  // needed - group siblings are found by filtering the already-loaded
  // captures array client-side (see LifelineFeed.tsx), same as every
  // other purely-derived view in this app.
  groupId: string | null;
  // Photo/Gallery/File capture v1 - see docs/photo-file-capture-schema.sql.
  // At most one of imagePath/filePath is ever set per Drop (whichever
  // attach flow was used at capture time). Both are storage object paths
  // within the private "drop-attachments" bucket, not URLs - rendering
  // always goes through a freshly-requested signed URL (see
  // app/lib/storage.ts's getSignedAttachmentUrl), never a stored one, so
  // access naturally stays gated by the same RLS that governs whether the
  // Drop itself is visible. fileName is the original filename, needed
  // only for file_path (a non-image attachment has no thumbnail to label
  // itself with - imagePath needs no equivalent since it renders directly).
  imagePath: string | null;
  filePath: string | null;
  fileName: string | null;
  // Daily Brief v1 - only ever set on the source='system'/
  // system_drop_type='daily_brief_activity' row (see
  // app/api/daily-brief/route.ts). Null for every other Drop, including
  // old archived Morning Brief rows and the other 3 Daily Brief cards.
  dailyBriefActivity: DailyBriefSpaceActivity[] | null;
  // Daily Brief carousel v1 - the frozen stat snapshot for the 3
  // non-Activity cards (Spaces/Categories/Completion), self-describing
  // via its own `kind` field. Null for every other Drop, including the
  // Activity card itself. See dailyBriefStats.ts.
  dailyBriefStats: DailyBriefStatsPayload | null;
};

export type CaptureRow = {
  id: number;
  user_id: string;
  text: string;
  created_at: string;
  updated_at: string;
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
  group_id: string | null;
  image_path: string | null;
  file_path: string | null;
  file_name: string | null;
  daily_brief_activity: DailyBriefSpaceActivity[] | null;
  daily_brief_stats: DailyBriefStatsPayload | null;
};

export function mapRowToCapture(row: CaptureRow): Capture {
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    groupId: row.group_id ?? null,
    imagePath: row.image_path ?? null,
    filePath: row.file_path ?? null,
    fileName: row.file_name ?? null,
    dailyBriefActivity: row.daily_brief_activity ?? null,
    dailyBriefStats: row.daily_brief_stats ?? null,
  };
}

export async function fetchCaptures(): Promise<Capture[]> {
  // Archived System Drops (e.g. yesterday's Daily Brief) stay in the DB
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
  // True when spaceIds came from an explicit context (e.g. capturing
  // while viewing a specific Space's filtered Lifeline) rather than the
  // keyword-based guess in analyzeCapture() - without this, the
  // background analyze-drop AI pass that fires right after every capture
  // would silently overwrite spaceIds moments later (it only respects an
  // existing assignment when space_manually_set is already true). Same
  // flag updateCaptureSpaces already sets whenever a user edits via the
  // Edit Spaces picker.
  spaceManuallySet?: boolean;
  // Card Carousel v2 - set when this capture was created via an existing
  // Drop's own "+" (adding to its group), never by the ordinary capture
  // flow. Absent/null means a normal standalone Drop.
  groupId?: string | null;
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
      group_id: input.groupId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRowToCapture(data as CaptureRow);
}

// Card Carousel v2 - ensures a Drop has a groupId, assigning a fresh one
// if it doesn't yet, idempotently returning the existing one if it does.
// Goes through the assign_group_id() SECURITY DEFINER function
// (docs/drop-groups-assign-function.sql) rather than a direct
// UPDATE - captures' UPDATE policy is owner-only, so a non-owner Shared
// Space member's "+" tap on someone else's still-ungrouped Drop would
// otherwise silently fail to write anything (found live, during
// verification: the two captures never ended up sharing a group_id at
// all). The function re-derives visibility itself (it runs with elevated
// privileges internally, bypassing RLS, so it can't just rely on RLS
// having already filtered the row) and row-locks to avoid a race if two
// members tap "+" on the same ungrouped Drop at once.
export async function assignGroupId(captureId: number): Promise<string> {
  const { data, error } = await supabase.rpc("assign_group_id", { target_capture_id: captureId });
  if (error) throw error;
  return data as string;
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

// Photo/Gallery/File capture v1 - called once, right after the upload
// that follows insertCapture(), since the storage object's path depends
// on the capture's own id (see app/lib/storage.ts). Only ever sets one of
// the two attachment kinds per call - the caller decides which, this
// doesn't try to enforce mutual exclusivity itself.
export async function updateCaptureAttachment(
  id: number,
  input: { imagePath?: string; filePath?: string; fileName?: string }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (input.imagePath !== undefined) payload.image_path = input.imagePath;
  if (input.filePath !== undefined) payload.file_path = input.filePath;
  if (input.fileName !== undefined) payload.file_name = input.fileName;

  const { error } = await supabase.from("captures").update(payload).eq("id", id);
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

