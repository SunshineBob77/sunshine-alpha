"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ShareButton from "./ShareButton";
import DeleteDropButton from "./DeleteDropButton";
import DropContent from "./DropContent";
import ChecklistContent from "./ChecklistContent";
import { DropAttachmentImage, DropAttachmentFile } from "./DropAttachment";
import { assignableSpaces } from "@/app/lib/spaces";
import { getSpaceTone } from "@/app/lib/spaceTone";
import { getSpaceColor } from "@/app/lib/spaceColors";
import { useCaptures } from "@/app/lib/DashboardContext";
import { hasUncheckedChecklistItems } from "@/app/lib/captures";
import { isAutoHidden } from "@/app/lib/autoHide";
import type { Capture } from "@/app/lib/captures";
import { fetchMySpaces } from "@/app/lib/sharedSpaces";
import { describeRecurrence, type TemporalResolutionOutput } from "@/app/lib/resolveTemporal";

type PickerOption = {
  id: string;
  name: string;
  icon: string;
  isShared: boolean;
};

// Expanded Drop detail view v1 - `open` used to be this component's own
// local state, toggled by a "Edit Spaces"/"+ Add to Space" text button it
// rendered inline, right here in the scrollable body. That trigger moved
// into DropDetailModal's sticky toolbar (a plain 🗂️ icon, alongside every
// other action), so `open` is now owned by the parent and just passed
// down - this component renders only the revealed grid itself, nothing
// when closed.
function SpacePicker({ capture, open }: { capture: Capture; open: boolean }) {
  const { updateSpaces, spaceOverrides } = useCaptures();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharedSpaces, setSharedSpaces] = useState<PickerOption[]>([]);

  // Loaded on mount, not gated behind `open` - so the grid never shows a
  // loading flash the first time the toolbar's Space icon is tapped.
  useEffect(() => {
    let cancelled = false;

    fetchMySpaces()
      .then((spaces) => {
        if (cancelled) return;
        setSharedSpaces(
          spaces.map((space) => ({
            id: space.id,
            name: space.name,
            icon: space.icon,
            isShared: true,
          }))
        );
      })
      .catch((err) => console.error("Couldn't load shared spaces for Edit Spaces", err));

    return () => {
      cancelled = true;
    };
  }, []);

  // The hardcoded "shared" placeholder is replaced entirely here by real,
  // individually-selectable shared spaces from fetchMySpaces() - each by
  // its own real uuid/name, not lumped into one generic option. Personal
  // spaces are unaffected.
  const pickerOptions: PickerOption[] = useMemo(() => {
    const personalOptions = assignableSpaces
      .filter((space) => space.id !== "shared")
      .map((space) => ({
        id: space.id,
        name: spaceOverrides[space.id] ?? space.name,
        icon: space.icon,
        isShared: false,
      }));
    return [...personalOptions, ...sharedSpaces];
  }, [spaceOverrides, sharedSpaces]);

  async function toggleSpace(spaceId: string) {
    const current = capture.spaceIds ?? [];
    const next = current.includes(spaceId)
      ? current.filter((id) => id !== spaceId)
      : [...current, spaceId];

    setPendingId(spaceId);
    setError(null);

    try {
      await updateSpaces(capture.id, next);
    } catch (err) {
      console.error(err);
      setError("Couldn't update. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-2 p-3 bg-ink/5 rounded-2xl">
      {pickerOptions.map((option) => {
        const active = capture.spaceIds?.includes(option.id);
        // Unified theme system v1 - fill hex via inline style, same
        // as everywhere else this app renders a Space's color, rather
        // than the old per-Space Tailwind bg-*-100 class.
        const fill = getSpaceColor(option.id, sharedSpaces).fill;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => toggleSpace(option.id)}
            disabled={pendingId === option.id}
            style={active ? { backgroundColor: fill } : undefined}
            className={`text-xs px-2.5 py-1.5 rounded-full ring-1 transition-all disabled:opacity-50 ${
              active
                ? "ring-black/10 font-semibold"
                : "bg-ink/5 text-ink-dim ring-ink/10 hover:ring-ink/20"
            }`}
          >
            {active ? "✓ " : ""}
            {option.icon} {option.name}
            {option.isShared ? " · Shared" : ""}
          </button>
        );
      })}
      {sharedSpaces.length === 0 && (
        <p className="text-xs text-ink-dim w-full">
          You&apos;re not a member of any shared spaces yet.
        </p>
      )}
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  );
}

function formatEventDate(eventAt: string, hasTime: boolean | null): string {
  const date = new Date(eventAt);
  return hasTime
    ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildEventAtIso(dateValue: string, timeValue: string | null): string | null {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);

  if (timeValue) {
    const [hours, minutes] = timeValue.split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0).toISOString();
  }

  // All-day: anchor at local noon rather than midnight, so converting to
  // UTC for storage never shifts the calendar date to the day before/after
  // when read back in a different timezone.
  return new Date(year, month - 1, day, 12, 0, 0).toISOString();
}

// The birthday/anniversary path (recurrenceType: "yearly") keeps its
// original "Every year" wording untouched. General recurring-phrase
// detection never sets recurrenceType (that DB enum is constrained to
// 'yearly' only) - it only sets recurring + recurrenceRawText, so those
// Drops get their badge text derived from the raw phrase instead.
function recurrenceBadgeText(capture: Capture): string | null {
  if (!capture.recurring) return null;
  if (capture.recurrenceType === "yearly") return "🎂 Every year";
  if (capture.recurrenceRawText) return `🔁 ${describeRecurrence(capture.recurrenceRawText)}`;
  return null;
}

function TemporalEditor({ capture }: { capture: Capture }) {
  const { updateTemporal, dismissTemporal } = useCaptures();
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    setError(null);
    try {
      await dismissTemporal(capture.id);
    } catch (err) {
      console.error(err);
      setError("Couldn't save. Try again.");
      setDismissing(false);
    }
  }

  function startEditing() {
    setDateValue(capture.eventAt ? toDateInputValue(capture.eventAt) : "");
    setTimeValue(capture.eventAt && capture.eventHasTime ? toTimeInputValue(capture.eventAt) : "");
    setAllDay(capture.eventAt ? !capture.eventHasTime : true);
    setError(null);
    setOpen(true);
  }

  async function handleSave() {
    const iso = buildEventAtIso(dateValue, allDay ? null : timeValue || null);
    if (!iso) {
      setError("Pick a date first.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateTemporal(capture.id, {
        eventAt: iso,
        eventHasTime: !allDay,
        eventTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (open) {
    return (
      <div className="mb-3 p-3 bg-ink/5 rounded-2xl">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={dateValue}
            onChange={(event) => setDateValue(event.target.value)}
            className="text-sm border border-ink/20 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {!allDay && (
            <input
              type="time"
              value={timeValue}
              onChange={(event) => setTimeValue(event.target.value)}
              className="text-sm border border-ink/20 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}
          <label className="flex items-center gap-1.5 text-xs text-ink-dim">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
            />
            All-day
          </label>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-ink px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            disabled={saving}
            className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
          >
            Cancel
          </button>
        </div>

        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  if (capture.eventStatus === "resolved" && capture.eventAt) {
    const recurrenceBadge = recurrenceBadgeText(capture);

    return (
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full">
          📅 {formatEventDate(capture.eventAt, capture.eventHasTime)}
          {recurrenceBadge ? ` · ${recurrenceBadge}` : ""}
        </span>
        <button
          type="button"
          onClick={startEditing}
          className="text-xs font-semibold text-ink-dim hover:text-ink"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-xs font-semibold text-ink-dim hover:text-ink disabled:opacity-60"
        >
          {dismissing ? "…" : "Not a calendar event"}
        </button>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
      </div>
    );
  }

  if (capture.eventStatus === "unresolved") {
    return (
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={startEditing}
          className="text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1.5 rounded-full transition-all"
        >
          ⚠️ Date unclear{capture.temporalRawText ? ` — "${capture.temporalRawText}"` : ""} · Set date
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-xs font-semibold text-ink-dim hover:text-ink disabled:opacity-60"
        >
          {dismissing ? "…" : "Not a calendar event"}
        </button>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
      </div>
    );
  }

  // 'none' and 'dismissed' both land here - optional, collapsed by
  // default. For 'dismissed' this quiet "+ Add a date" is also the entire
  // undo path: picking a date calls updateTemporal, which overwrites
  // event_status straight to 'resolved'. No separate "un-dismiss" control
  // needed.
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={startEditing}
        className="text-xs font-semibold text-ink-dim hover:text-ink"
      >
        + Add a date
      </button>
    </div>
  );
}

// Surfaced only for a locked Drop whose text has changed in a way that
// looks temporally different from what's locked in. Never auto-writes -
// tapping the initial button only fetches a preview; overwriting the
// locked value requires a second, explicit confirm tap.
function TemporalEditSuggestion({ capture }: { capture: Capture }) {
  const { previewTemporalReanalysis, dismissTemporalSuggestion, updateTemporal } = useCaptures();
  const [preview, setPreview] = useState<TemporalResolutionOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    try {
      const result = await previewTemporalReanalysis(capture.id);
      setPreview(result);
    } catch (err) {
      console.error(err);
      setError("Couldn't check. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview || !preview.eventAt || preview.eventHasTime === null) return;

    setConfirming(true);
    setError(null);
    try {
      await updateTemporal(capture.id, {
        eventAt: preview.eventAt,
        eventHasTime: preview.eventHasTime,
        eventTimezone: preview.eventTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      dismissTemporalSuggestion(capture.id);
      setPreview(null);
    } catch (err) {
      console.error(err);
      setError("Couldn't save. Try again.");
    } finally {
      setConfirming(false);
    }
  }

  function handleDismiss() {
    dismissTemporalSuggestion(capture.id);
    setPreview(null);
    setError(null);
  }

  if (preview) {
    return (
      <div className="mb-3 p-3 bg-blue-50 rounded-2xl text-sm">
        {preview.eventStatus === "resolved" && preview.eventAt ? (
          <>
            <p className="text-ink mb-2">
              New date from text:{" "}
              <strong>{formatEventDate(preview.eventAt, preview.eventHasTime)}</strong>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-ink px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
              >
                {confirming ? "Updating…" : "Update date"}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                disabled={confirming}
                className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
              >
                Keep current
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-ink-dim mb-2">Still unclear from the new text.</p>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-3 py-1.5 rounded-full transition-all"
            >
              Dismiss
            </button>
          </>
        )}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mb-3 flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={handleCheck}
        disabled={loading}
        className="text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-full transition-all disabled:opacity-60"
      >
        {loading ? "Checking…" : "🔄 Text changed — update date from text?"}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-xs text-ink-dim hover:text-ink"
      >
        Dismiss
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  );
}

export default function DropDetailModal({
  capture,
  onClose,
}: {
  capture: Capture;
  onClose: () => void;
}) {
  const {
    user,
    updateText,
    updateStatus,
    updateChecklistItems,
    retryAnalysis,
    hideCapture,
    archiveCapture,
    undoCaptureState,
    updatePinned,
    addToGroup,
    temporalSuggestions,
    spaceOverrides,
    sharedSpaces,
  } = useCaptures();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(capture.text);
  const [draftTitle, setDraftTitle] = useState(capture.title ?? "");
  const [savingText, setSavingText] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  // Expanded Drop detail view v1 - the Space-reassignment grid's own open
  // state, lifted up from SpacePicker so the toolbar's 🗂️ button can
  // drive it (see SpacePicker's own doc comment).
  const [spacePickerOpen, setSpacePickerOpen] = useState(false);
  // Only "More" (Delete/Archive/Undo) expands into a panel now - Hide is
  // a direct single-tap toggle, same simplification as DropCard.tsx.
  const [moreOpen, setMoreOpen] = useState(false);
  const [retryingAnalysis, setRetryingAnalysis] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Expanded Drop detail view v1 - scoped to the sticky footer specifically
  // now, not "the modal's own box" (there's no longer an outside-the-modal
  // backdrop to distinguish from - this view fills the whole screen).
  // Tapping anywhere in the header or scrollable body still collapses the
  // More panel, same as tapping outside the old centered card did.
  const footerRef = useRef<HTMLDivElement>(null);

  const tone = getSpaceTone(capture.spaceIds?.[0], sharedSpaces);
  const spaceColor = getSpaceColor(capture.spaceIds?.[0], sharedSpaces);
  const toneName = spaceOverrides[capture.spaceIds?.[0] ?? ""] ?? tone.name;
  const isUrgent = capture.tags?.includes("urgent") ?? false;
  const isCompleted = capture.status === "completed";
  const isSunshineDrop = capture.source === "system";
  const isHiddenNow = capture.hiddenUntil !== null || isAutoHidden(capture);
  // Same reasoning as LifelineDropCard.tsx: always true outside a shared
  // space, only meaningfully false when this modal was opened on another
  // member's Drop in a shared space's Lifeline. RLS already rejects the
  // underlying write regardless (owner-only UPDATE/DELETE on captures) -
  // this just stops the modal's own independent action row from offering
  // controls that would silently no-op, since it doesn't reuse
  // LifelineDropCard's gating at all (separate component, separate wiring).
  const isOwnCapture = capture.userId === user.id;

  // Cursor at the END of the existing text, not the start - autoFocus
  // alone leaves a controlled textarea's cursor at position 0, which
  // interrupts voice dictation (has to manually reposition before
  // continuing). Runs once per entry into edit mode.
  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  // Tapping anywhere outside the sticky footer (the header, or the
  // scrollable body) collapses the More panel if it's open - same intent
  // as the old "tap elsewhere in the modal" behavior, rescoped to the
  // footer specifically now that there's no backdrop-vs-modal boundary
  // left to use instead (this view fills the whole screen).
  useEffect(() => {
    if (!moreOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (footerRef.current && !footerRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [moreOpen]);

  async function handleSaveText() {
    if (!draft.trim()) return;
    if (!draftTitle.trim()) {
      setTitleError("Title can't be empty.");
      return;
    }
    setTitleError(null);
    setSavingText(true);
    setTextError(null);
    try {
      await updateText(capture.id, draft.trim(), draftTitle.trim());
      setEditing(false);
    } catch (err) {
      console.error(err);
      setTextError("Couldn't save. Try again.");
    } finally {
      setSavingText(false);
    }
  }

  // Deliberately does NOT auto-close the modal, and doesn't need the
  // card list's settle-then-remove animation (LifelineFeed/SpacesPage's
  // pendingRemovalIds) - that mechanism only exists to keep a card
  // visible in its new state briefly before the LIST's own filter drops
  // it, and the modal was never part of that list-rendering concern in
  // the first place. Matches how every other in-modal action already
  // behaves here (Space toggling, temporal edits) - the modal stays open
  // until the user closes it, showing the live updated state.
  function handleToggleStatus() {
    // Checklist state and Drop status are independent - unchecked items
    // never block completion, they just require one confirmation before it
    // happens. Un-completing never needs this (only guards active -> completed).
    if (!isCompleted && hasUncheckedChecklistItems(capture.checklistItems)) {
      setConfirmingComplete(true);
      return;
    }

    commitToggleStatus();
  }

  async function commitToggleStatus() {
    setConfirmingComplete(false);
    setTogglingStatus(true);
    try {
      await updateStatus(capture.id, isCompleted ? "active" : "completed");
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingStatus(false);
    }
  }

  function handleToggleChecklistItem(itemId: string) {
    const next = capture.checklistItems.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    updateChecklistItems(capture.id, next);
  }

  // Same "stay open, reflect live state" convention as every other
  // in-modal action here (Space toggling, temporal edits, Complete) -
  // no auto-close, no list settle animation to coordinate with.
  async function handleToggleHideTap() {
    await hideCapture(capture.id);
  }

  async function handleArchiveTap() {
    setMoreOpen(false);
    await archiveCapture(capture.id);
  }

  async function handleUndoTap() {
    setMoreOpen(false);
    await undoCaptureState(capture.id);
  }

  function handleEditTap() {
    setMoreOpen(false);
    setDraft(capture.text);
    setDraftTitle(capture.title ?? "");
    setTextError(null);
    setTitleError(null);
    setEditing((prev) => !prev);
  }

  // Expanded Drop detail view v1 - same "stay open, reflect live state"
  // convention as every other in-toolbar action (no settle animation to
  // coordinate with; this view isn't part of any list-rendering concern).
  function handleTogglePin() {
    updatePinned(capture.id, !capture.pinned);
  }

  function handleToggleSpacePicker() {
    setMoreOpen(false);
    setSpacePickerOpen((prev) => !prev);
  }

  // addToGroup opens the global capture-composer modal (DashboardContext's
  // CaptureModal, pre-wired to land the new capture in this Drop's group) -
  // a second full-screen overlay, so this view closes first rather than
  // stacking two of them. Matches DropCard's own "+"/onAddToGroup - same
  // action, just reached from inside the expanded view now too.
  function handleAddToGroupTap() {
    onClose();
    addToGroup(capture.id);
  }

  // Analyze-drop failure tracking v1 - fire-and-forget, same as every
  // other analyze-drop trigger (saveCapture, updateText). The brief local
  // "Retrying…" disabled state just guards against a double-tap; the
  // banner itself disappears on its own once retryAnalysis's response
  // flips capture.analysisStatus away from 'failed'.
  function handleRetryAnalysis() {
    setRetryingAnalysis(true);
    retryAnalysis(capture.id);
    setTimeout(() => setRetryingAnalysis(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-night">
      {/* Fixed header - title/edit-title input, Space icon badge, Close.
          Expanded Drop detail view v1 - no longer a centered card over a
          backdrop (see the toolbar comment below for the fuller
          rationale), so the old 2px per-Space colored border has no card
          edge to sit on anymore. Replaced by a thin accent bar right
          below this header (see just below) - same identity hex, much
          less visual weight than a full border. */}
      <div className="shrink-0 flex items-start justify-between gap-3 px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {editing ? (
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder={capture.sunshineSummary}
                aria-label="Drop title"
                className="w-full font-bold text-lg text-ink bg-transparent border border-ink/20 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              {titleError && <p className="text-xs text-red-600 mt-1">{titleError}</p>}
            </div>
          ) : (
            <p className="font-bold text-lg text-ink min-w-0">
              {capture.title ?? capture.sunshineSummary}
            </p>
          )}
          <span
            className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs mt-0.5"
            title={toneName}
          >
            <span
              className="flex h-full w-full items-center justify-center rounded-full"
              style={{ backgroundColor: spaceColor.fill }}
            >
              {tone.icon}
            </span>
            {isUrgent && (
              <span
                className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white"
                title="Urgent"
              />
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-dim hover:text-ink text-xl leading-none"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Space color identity cue v1 - a thin accent bar, reusing the
          exact same spaceColor.identity hex DropCard's own border
          already uses per Space (Family gold #F0A339, Health red
          #E24B4A, Work blue #378ADD, Harvard green #639922, Personal
          pink #D4537E, Sunshine/system #FFC940) - one shared lookup
          (getSpaceColor/spaceColors.ts) rather than a second color map.
          Theme-independent by design, same as DropCard's own border
          already is (one hex per Space, unchanged across light/dark),
          so this reads correctly in both themes with no extra handling.
          Glance-able, not the old border's full weight. */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: spaceColor.identity }} />

      {/* Scrollable body - everything that isn't a persistent action now
          lives here, between the fixed header and the sticky footer
          toolbar below. */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <SpacePicker capture={capture} open={spacePickerOpen} />
        <TemporalEditor capture={capture} />
        {capture.temporalLocked && temporalSuggestions[capture.id] && (
          <TemporalEditSuggestion capture={capture} />
        )}

        {capture.imagePath && <DropAttachmentImage imagePath={capture.imagePath} />}
        {capture.filePath && capture.fileName && (
          <DropAttachmentFile filePath={capture.filePath} fileName={capture.fileName} />
        )}

        {editing ? (
          <div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-full border border-ink/20 rounded-xl p-3 text-lg min-h-32 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={handleSaveText}
                disabled={savingText}
                className="text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-ink px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
              >
                {savingText ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(capture.text);
                  setDraftTitle(capture.title ?? "");
                  setEditing(false);
                  setTextError(null);
                  setTitleError(null);
                }}
                disabled={savingText}
                className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
            {textError && <p className="text-xs text-red-600 mt-1">{textError}</p>}
          </div>
        ) : (
          <div className="text-lg text-ink">
            {capture.checklistItems.length > 0 ? (
              <ChecklistContent
                items={capture.checklistItems}
                onToggle={isOwnCapture ? handleToggleChecklistItem : () => {}}
                readOnly={!isOwnCapture}
              />
            ) : (
              <DropContent content={capture.formattedText ?? capture.text} />
            )}
          </div>
        )}

        <p className="text-sm text-ink-dim mt-3">
          {new Date(capture.createdAt).toLocaleString()}
        </p>

        {capture.aiResearchResult && (
          <div className="mt-4 rounded-2xl bg-ink/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm bg-sky-100">
                🔎
              </span>
              <h3 className="font-semibold text-sm text-ink">Sunshine found this</h3>
            </div>
            {Array.isArray(capture.aiResearchResult) ? (
              <ul className="text-sm text-ink list-disc ml-5 space-y-1">
                {capture.aiResearchResult.map((bullet, index) => (
                  <li key={index} className="break-words">
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink break-words">{capture.aiResearchResult}</p>
            )}
          </div>
        )}

        {/* Analyze-drop failure tracking v1 - distinguishes "the pass
            failed/never completed" from "the model looked and legitimately
            found nothing" (the aiResearchResult block above, which stays
            silent in that case). Only the owner can retry - matches every
            other write action in this view. */}
        {capture.analysisStatus === "failed" && isOwnCapture && (
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm bg-amber-100">
                ⚠️
              </span>
              <p className="text-sm text-amber-800">Sunshine couldn&apos;t finish analyzing this Drop.</p>
            </div>
            <button
              type="button"
              onClick={handleRetryAnalysis}
              disabled={retryingAnalysis}
              className="text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-ink px-3 py-1.5 rounded-full transition-all disabled:opacity-60 shrink-0"
            >
              {retryingAnalysis ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}

        {/* Moved out of the action toolbar below - this is a link to
            external content related to the Drop's own text (same family
            as the "Sunshine found this" block above it), not a Drop
            action/mutation the way everything in the toolbar is. */}
        {capture.extractedAddress && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(capture.extractedAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full transition-all"
          >
            📍 Open in Maps
          </a>
        )}
      </div>

      {/* Expanded Drop detail view v1 - sticky bottom toolbar, replacing
          the old scroll-with-content action row. Every Drop action lives
          here now: Pin, Edit, Space reassignment (SpacePicker's toggle,
          relocated from inline body content), "+" add-to-group, Complete,
          Share, Hide, and a Delete/Archive/Undo overflow behind "More" -
          those three stay tucked away rather than getting their own
          icons, same density tradeoff DropCard's own "More" panel already
          made, now with one more icon's worth of density pressure (Pin/
          Edit/Space/+ all landed here too) tipping it further that way.
          Pin/Edit/Space/+ are icon-only, matching how the first three
          looked as header-row buttons on the compact card before this
          move; Complete/Share/Hide/More keep their existing text+emoji
          labels unchanged - a full-screen view has the width for both
          without feeling cramped. */}
      <div
        ref={footerRef}
        className="shrink-0 border-t border-ink/10 bg-dusk px-3 sm:px-4 pt-2 pb-3"
      >
        {confirmingComplete && (
          <div className="flex items-center justify-center gap-2 flex-wrap mb-2 pb-2 border-b border-ink/10 text-center">
            <span className="text-xs text-ink-dim">
              This checklist still has unchecked items. Complete anyway?
            </span>
            <button
              type="button"
              onClick={commitToggleStatus}
              disabled={togglingStatus}
              className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
            >
              Complete anyway
            </button>
            <button
              type="button"
              onClick={() => setConfirmingComplete(false)}
              disabled={togglingStatus}
              className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        )}

        {moreOpen && isOwnCapture && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap mb-2 pb-2 border-b border-ink/10">
            <DeleteDropButton captureId={capture.id} onDeleted={onClose} />
            <button
              type="button"
              onClick={handleArchiveTap}
              className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-2 py-1.5 rounded-full transition-all"
            >
              🗄️ Archive
            </button>
            <button
              type="button"
              onClick={handleUndoTap}
              disabled={!capture.previousState}
              aria-label="Undo last change"
              className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-2 py-1.5 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↩️ Undo
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {isOwnCapture && (
            <button
              type="button"
              onClick={handleTogglePin}
              aria-label={capture.pinned ? "Unpin" : "Pin"}
              title={capture.pinned ? "Unpin" : "Pin"}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base transition-all ${
                capture.pinned
                  ? "opacity-100 bg-gold/20"
                  : "opacity-70 hover:opacity-100 hover:bg-ink/10"
              }`}
            >
              📌
            </button>
          )}

          {!isSunshineDrop && isOwnCapture && (
            <button
              type="button"
              onClick={handleEditTap}
              aria-label="Edit"
              title="Edit"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base transition-all ${
                editing ? "bg-gold/20" : "text-ink hover:bg-ink/10"
              }`}
            >
              ✏️
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleSpacePicker}
            aria-label="Change Space"
            title="Change Space"
            aria-expanded={spacePickerOpen}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base transition-all ${
              spacePickerOpen ? "bg-gold/20" : "text-ink hover:bg-ink/10"
            }`}
          >
            🗂️
          </button>

          {!isSunshineDrop && (
            <button
              type="button"
              onClick={handleAddToGroupTap}
              aria-label="Add to this Drop's carousel"
              title="Add another card to this Drop"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-xl leading-none text-ink bg-ink/15 hover:bg-ink/25 transition-all"
            >
              +
            </button>
          )}

          {capture.isActionable && isOwnCapture && !confirmingComplete && (
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              aria-label={isCompleted ? "Mark as active" : "Mark as completed"}
              className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all disabled:opacity-60 ${
                isCompleted ? "bg-orange-500 text-white" : "bg-ink/5 hover:bg-ink/10 text-ink-dim"
              }`}
            >
              {isCompleted ? "● Completed" : "○ Completed"}
            </button>
          )}

          <ShareButton capture={capture} />

          {!isSunshineDrop && isOwnCapture && (
            <button
              type="button"
              onClick={handleToggleHideTap}
              aria-label={isHiddenNow ? "Unhide" : "Hide"}
              className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
                isHiddenNow ? "bg-gray-800 text-white" : "bg-ink/5 hover:bg-ink/10 text-ink-dim"
              }`}
            >
              {isHiddenNow ? "🙉 Unhide" : "🙈 Hide"}
            </button>
          )}

          {isOwnCapture && (
            <button
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-expanded={moreOpen}
              className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
                moreOpen ? "bg-gray-800 text-white" : "bg-ink/5 hover:bg-ink/10 text-ink-dim"
              }`}
            >
              ⋯ More
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
