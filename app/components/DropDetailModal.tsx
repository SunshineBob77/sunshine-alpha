"use client";

import { useEffect, useRef, useState } from "react";
import ShareButton from "./ShareButton";
import DeleteDropButton from "./DeleteDropButton";
import DropContent from "./DropContent";
import ChecklistContent from "./ChecklistContent";
import { assignableSpaces } from "@/app/lib/spaces";
import { getSpaceTone } from "@/app/lib/spaceTone";
import { useCaptures } from "@/app/lib/DashboardContext";
import { hasUncheckedChecklistItems } from "@/app/lib/captures";
import { isAutoHidden } from "@/app/lib/autoHide";
import type { Capture } from "@/app/lib/captures";
import { describeRecurrence, type TemporalResolutionOutput } from "@/app/lib/resolveTemporal";

function SpacePicker({ capture }: { capture: Capture }) {
  const { updateSpaces, spaceOverrides } = useCaptures();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeSpaces = assignableSpaces.filter((space) => capture.spaceIds?.includes(space.id));

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

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        {activeSpaces.map((space) => (
          <span key={space.id} className={`text-xs px-2 py-1 rounded-full ${space.color}`}>
            {space.icon} {spaceOverrides[space.id] ?? space.name}
            {space.isShared ? " · Shared" : ""}
          </span>
        ))}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-full transition-all"
        >
          {open ? "Done" : activeSpaces.length > 0 ? "Edit Spaces" : "+ Add to Space"}
        </button>
      </div>

      {open && (
        <div className="mt-2 flex flex-wrap gap-2 p-3 bg-gray-50 rounded-2xl">
          {assignableSpaces.map((space) => {
            const active = capture.spaceIds?.includes(space.id);
            return (
              <button
                key={space.id}
                type="button"
                onClick={() => toggleSpace(space.id)}
                disabled={pendingId === space.id}
                className={`text-xs px-2.5 py-1.5 rounded-full ring-1 transition-all disabled:opacity-50 ${
                  active
                    ? `${space.color} ring-black/10 font-semibold`
                    : "bg-white text-gray-500 ring-gray-200 hover:ring-gray-300"
                }`}
              >
                {active ? "✓ " : ""}
                {space.icon} {spaceOverrides[space.id] ?? space.name}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
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
      <div className="mb-3 p-3 bg-gray-50 rounded-2xl">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={dateValue}
            onChange={(event) => setDateValue(event.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {!allDay && (
            <input
              type="time"
              value={timeValue}
              onChange={(event) => setTimeValue(event.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
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
            className="text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-gray-900 px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
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
            className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
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
          className="text-xs font-semibold text-gray-500 hover:text-gray-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-xs font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-60"
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
          className="text-xs font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-60"
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
        className="text-xs font-semibold text-gray-400 hover:text-gray-600"
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
            <p className="text-gray-800 mb-2">
              New date from text:{" "}
              <strong>{formatEventDate(preview.eventAt, preview.eventHasTime)}</strong>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-gray-900 px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
              >
                {confirming ? "Updating…" : "Update date"}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                disabled={confirming}
                className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
              >
                Keep current
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-2">Still unclear from the new text.</p>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-all"
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
        className="text-xs text-gray-400 hover:text-gray-600"
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
    hideCapture,
    archiveCapture,
    undoCaptureState,
    temporalSuggestions,
    spaceOverrides,
  } = useCaptures();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(capture.text);
  const [savingText, setSavingText] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  // Only "More" expands into a panel now - Hide is a direct single-tap
  // toggle, same simplification as DropCard.tsx.
  const [moreOpen, setMoreOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const tone = getSpaceTone(capture.spaceIds?.[0]);
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

  // Tapping elsewhere in the modal (but not outside it - the backdrop's
  // own onClick already closes the whole modal) collapses whichever
  // panel is open. Scoped to the modal's own inner box via boxRef.
  useEffect(() => {
    if (!moreOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [moreOpen]);

  async function handleSaveText() {
    if (!draft.trim()) return;
    setSavingText(true);
    setTextError(null);
    try {
      await updateText(capture.id, draft.trim());
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
    setTextError(null);
    setEditing((prev) => !prev);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={boxRef}
        className={`w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white p-6 rounded-3xl border-[5px] ${tone.border} shadow-lg`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <p className="font-bold text-lg text-gray-900 min-w-0">
              {capture.title ?? capture.sunshineSummary}
            </p>
            <span
              className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs mt-0.5"
              title={toneName}
            >
              <span
                className={`flex h-full w-full items-center justify-center rounded-full ${tone.color}`}
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
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <SpacePicker capture={capture} />
        <TemporalEditor capture={capture} />
        {capture.temporalLocked && temporalSuggestions[capture.id] && (
          <TemporalEditSuggestion capture={capture} />
        )}

        {editing ? (
          <div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 text-lg min-h-32 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={handleSaveText}
                disabled={savingText}
                className="text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-gray-900 px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
              >
                {savingText ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(capture.text);
                  setEditing(false);
                  setTextError(null);
                }}
                disabled={savingText}
                className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
            {textError && <p className="text-xs text-red-600 mt-1">{textError}</p>}
          </div>
        ) : (
          <div className="text-lg text-gray-900">
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

        <p className="text-sm text-gray-500 mt-3">
          {new Date(capture.createdAt).toLocaleString()}
        </p>

        {capture.aiResearchResult && (
          <div className="mt-4 rounded-2xl bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm bg-sky-100">
                🔎
              </span>
              <h3 className="font-semibold text-sm text-gray-900">Sunshine found this</h3>
            </div>
            {Array.isArray(capture.aiResearchResult) ? (
              <ul className="text-sm text-gray-800 list-disc ml-5 space-y-1">
                {capture.aiResearchResult.map((bullet, index) => (
                  <li key={index} className="break-words">
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-800 break-words">{capture.aiResearchResult}</p>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            {capture.isActionable &&
              isOwnCapture &&
              (confirmingComplete ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-600">
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
                    className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={togglingStatus}
                  aria-label={isCompleted ? "Mark as active" : "Mark as completed"}
                  className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all disabled:opacity-60 ${
                    isCompleted
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                  }`}
                >
                  {isCompleted ? "● Completed" : "○ Completed"}
                </button>
              ))}

            <ShareButton capture={capture} />

            {!isSunshineDrop && isOwnCapture && (
              <button
                type="button"
                onClick={handleToggleHideTap}
                aria-label={isHiddenNow ? "Unhide" : "Hide"}
                className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
                  isHiddenNow
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
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
                  moreOpen
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                }`}
              >
                ⋯ More
              </button>
            )}

            {capture.extractedAddress && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(capture.extractedAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full transition-all"
              >
                📍 Open in Maps
              </a>
            )}
          </div>

          {moreOpen && isOwnCapture && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleEditTap}
                  aria-label="Edit Drop text"
                  className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1.5 rounded-full transition-all"
                >
                  ✏️ Edit
                </button>
                <DeleteDropButton captureId={capture.id} onDeleted={onClose} />
                <button
                  type="button"
                  onClick={handleArchiveTap}
                  className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1.5 rounded-full transition-all"
                >
                  🗄️ Archive
                </button>
                <button
                  type="button"
                  onClick={handleUndoTap}
                  disabled={!capture.previousState}
                  aria-label="Undo last change"
                  className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1.5 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↩️ Undo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
