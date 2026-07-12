"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  fetchCaptures,
  insertCapture,
  deleteCapture,
  updateCaptureSpaces,
  updateCaptureText,
  updateCaptureStatus,
  updateCaptureTemporal,
  dismissCaptureTemporal,
  updateCapturePinned,
  mapRowToCapture,
  type Capture,
  type CaptureRow,
} from "./captures";
import { analyzeCapture } from "./analyzeCapture";
import { recognizeEntities } from "./recognizeEntities";
import {
  detectRiskFlags,
  resolveTemporal,
  shouldEscalateToAi,
  type TemporalResolutionOutput,
} from "./resolveTemporal";
import CaptureModal from "../components/CaptureModal";

// Two texts "look the same" temporally if the set of local date/time
// phrases they contain is identical - used only to decide whether a
// locked Drop needs the "update date from text?" suggestion surfaced, never
// to auto-write anything.
function temporalCandidatesChanged(oldText: string, newText: string): boolean {
  const oldRaws = recognizeEntities(oldText)
    .dates.map((candidate) => candidate.raw.toLowerCase())
    .sort();
  const newRaws = recognizeEntities(newText)
    .dates.map((candidate) => candidate.raw.toLowerCase())
    .sort();

  if (oldRaws.length !== newRaws.length) return true;
  return oldRaws.some((raw, index) => raw !== newRaws[index]);
}

type DashboardContextValue = {
  user: User;
  captures: Capture[];
  capturesLoading: boolean;
  capturesError: string | null;
  isCapturing: boolean;
  openCapture: () => void;
  removeCapture: (id: number) => Promise<void>;
  updateSpaces: (id: number, spaceIds: string[]) => Promise<void>;
  updateText: (id: number, text: string) => Promise<void>;
  updateStatus: (id: number, status: "active" | "completed") => Promise<void>;
  updatePinned: (id: number, pinned: boolean) => Promise<void>;
  updateTemporal: (
    id: number,
    input: { eventAt: string; eventHasTime: boolean; eventTimezone: string }
  ) => Promise<void>;
  dismissTemporal: (id: number) => Promise<void>;
  temporalSuggestions: Record<number, boolean>;
  dismissTemporalSuggestion: (id: number) => void;
  previewTemporalReanalysis: (id: number) => Promise<TemporalResolutionOutput>;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useCaptures() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useCaptures must be used within DashboardProvider");
  return ctx;
}

export function DashboardProvider({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [capturesLoading, setCapturesLoading] = useState(true);
  const [capturesError, setCapturesError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [temporalSuggestions, setTemporalSuggestions] = useState<Record<number, boolean>>({});

  function dismissTemporalSuggestion(id: number) {
    setTemporalSuggestions((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    setCaptures([]);
    setCapturesLoading(true);

    fetchCaptures()
      .then((data) => {
        if (!cancelled) setCaptures(data);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setCapturesError("Couldn't load your Drops. Try refreshing.");
      })
      .finally(() => {
        if (!cancelled) setCapturesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  // Fire-and-forget, once per full app load (this provider mounts once per
  // session, not per client-side route change) - the endpoint's own
  // idempotency check makes repeated mounts/tabs/days safe regardless.
  // Never awaited by the Lifeline load above, so it can't block it.
  useEffect(() => {
    const localDate = new Date().toLocaleDateString("en-CA");
    const localHour = new Date().getHours();
    const displayName = user.user_metadata?.full_name || null;

    fetch("/api/morning-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, localDate, localHour, displayName }),
    })
      .then((response) => response.json())
      .then((data: { capture?: CaptureRow; skipped?: boolean }) => {
        if (!data.capture) return;
        const brief = mapRowToCapture(data.capture);
        setCaptures((prev) => {
          if (prev.some((capture) => capture.id === brief.id)) {
            return prev.map((capture) => (capture.id === brief.id ? brief : capture));
          }
          return [brief, ...prev];
        });
      })
      .catch((error) => {
        console.error("morning-brief generation failed", error);
      });
  }, [user.id]);

  function analyzeDrop(id: number, text: string) {
    const captureTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    fetch("/api/analyze-drop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text, captureTimezone }),
    })
      .then((response) => response.json())
      .then(
        (data: {
          result?: string[] | null;
          address?: string | null;
          formatted?: string | null;
          title?: string | null;
          isActionable?: boolean;
          category?: string;
          spaceIds?: string[];
          eventAt?: string | null;
          eventHasTime?: boolean | null;
          eventTimezone?: string | null;
          eventStatus?: "none" | "resolved" | "unresolved" | "dismissed";
          temporalConfidence?: "high" | "low" | null;
          temporalRawText?: string | null;
          recurring?: boolean;
          recurrenceType?: "yearly" | null;
        }) => {
          if (data.result === undefined) return;
          setCaptures((prev) =>
            prev.map((capture) =>
              capture.id === id
                ? {
                    ...capture,
                    aiResearchResult: data.result ?? null,
                    extractedAddress: data.address ?? null,
                    formattedText: data.formatted ?? null,
                    title: data.title ?? null,
                    isActionable: data.isActionable ?? false,
                    category: data.category ?? capture.category,
                    spaceIds: data.spaceIds ?? capture.spaceIds,
                    // The route omits these entirely for a locked Drop -
                    // fall back to whatever's already in local state
                    // instead of clobbering it with undefined.
                    eventAt: data.eventAt !== undefined ? data.eventAt : capture.eventAt,
                    eventHasTime:
                      data.eventHasTime !== undefined ? data.eventHasTime : capture.eventHasTime,
                    eventTimezone:
                      data.eventTimezone !== undefined ? data.eventTimezone : capture.eventTimezone,
                    eventStatus: data.eventStatus ?? capture.eventStatus,
                    temporalConfidence:
                      data.temporalConfidence !== undefined
                        ? data.temporalConfidence
                        : capture.temporalConfidence,
                    temporalRawText:
                      data.temporalRawText !== undefined
                        ? data.temporalRawText
                        : capture.temporalRawText,
                    recurring: data.recurring !== undefined ? data.recurring : capture.recurring,
                    recurrenceType:
                      data.recurrenceType !== undefined
                        ? data.recurrenceType
                        : capture.recurrenceType,
                  }
                : capture
            )
          );
        }
      )
      .catch((error) => {
        console.error("analyze-drop request failed", error);
      });
  }

  async function saveCapture() {
    if (!captureText.trim()) return;

    const meaning = analyzeCapture(captureText);
    const entities = recognizeEntities(captureText.trim());

    setSaveError(null);
    setIsSaving(true);

    try {
      const newCapture = await insertCapture({
        text: captureText.trim(),
        spaceIds: [meaning.spaceId],
        category: meaning.category,
        project: meaning.project,
        tags: meaning.tags,
        mood: meaning.mood,
        sunshineSummary: meaning.sunshineSummary,
        entities,
      });

      setCaptures((prev) => [newCapture, ...prev]);
      setCaptureText("");
      setIsCapturing(false);

      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2500);

      analyzeDrop(newCapture.id, newCapture.text);
    } catch (error) {
      console.error(error);
      setSaveError("Couldn't save your Drop. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeCapture(id: number) {
    await deleteCapture(id);
    setCaptures((prev) => prev.filter((capture) => capture.id !== id));
  }

  async function updateSpaces(id: number, spaceIds: string[]) {
    await updateCaptureSpaces(id, spaceIds);
    setCaptures((prev) =>
      prev.map((capture) => (capture.id === id ? { ...capture, spaceIds } : capture))
    );
  }

  async function updateText(id: number, text: string) {
    const existing = captures.find((capture) => capture.id === id);
    const oldText = existing?.text ?? "";
    const wasLocked = existing?.temporalLocked ?? false;

    await updateCaptureText(id, text);
    setCaptures((prev) =>
      prev.map((capture) => (capture.id === id ? { ...capture, text } : capture))
    );

    // A locked Drop's date is never touched automatically - analyzeDrop()
    // below still re-runs the other 7 tasks as normal (route.ts itself
    // skips writing temporal fields when locked), but only a suggestion
    // gets surfaced here, never an auto-write. A dismissed Drop ("not a
    // calendar event") is also locked, but must stay fully quiet - it
    // should never resurface a "text changed, update date?" suggestion
    // either, or dismissal wouldn't really mean "stop asking."
    const wasDismissed = existing?.eventStatus === "dismissed";
    if (wasLocked && !wasDismissed) {
      const changed = temporalCandidatesChanged(oldText, text);
      setTemporalSuggestions((prev) => ({ ...prev, [id]: changed }));
    } else {
      dismissTemporalSuggestion(id);
    }

    analyzeDrop(id, text);
  }

  // Computes what the temporal fields WOULD be for a Drop's current text,
  // without writing anything - reuses the same gating rule and the same
  // /api/analyze-drop endpoint the automatic pipeline uses (only hitting
  // the AI when the local pass alone can't be trusted), rather than
  // duplicating the AI-calling code.
  async function previewTemporalReanalysis(id: number): Promise<TemporalResolutionOutput> {
    const capture = captures.find((c) => c.id === id);
    if (!capture) throw new Error("Capture not found");

    const captureTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localCandidates = recognizeEntities(capture.text).dates;
    const riskFlags = detectRiskFlags(capture.text);

    if (!shouldEscalateToAi(capture.text, localCandidates, riskFlags)) {
      return resolveTemporal(
        {
          rawText: capture.text,
          referenceDatetime: capture.createdAt,
          captureTimezone,
          localCandidates,
          riskFlags,
        },
        null
      );
    }

    const response = await fetch("/api/analyze-drop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        text: capture.text,
        captureTimezone,
        temporalPreviewOnly: true,
      }),
    });

    if (!response.ok) throw new Error("Preview request failed");

    const data: { temporal?: TemporalResolutionOutput } = await response.json();
    if (!data.temporal) throw new Error("No temporal preview returned");

    return data.temporal;
  }

  async function updateStatus(id: number, status: "active" | "completed") {
    await updateCaptureStatus(id, status);
    setCaptures((prev) =>
      prev.map((capture) => (capture.id === id ? { ...capture, status } : capture))
    );
  }

  async function dismissTemporal(id: number) {
    await dismissCaptureTemporal(id);
    setCaptures((prev) =>
      prev.map((capture) =>
        capture.id === id ? { ...capture, eventStatus: "dismissed", temporalLocked: true } : capture
      )
    );
    dismissTemporalSuggestion(id);
  }

  async function updatePinned(id: number, pinned: boolean) {
    await updateCapturePinned(id, pinned);
    setCaptures((prev) =>
      prev.map((capture) => (capture.id === id ? { ...capture, pinned } : capture))
    );
  }

  async function updateTemporal(
    id: number,
    input: { eventAt: string; eventHasTime: boolean; eventTimezone: string }
  ) {
    await updateCaptureTemporal(id, input);
    setCaptures((prev) =>
      prev.map((capture) =>
        capture.id === id
          ? {
              ...capture,
              eventAt: input.eventAt,
              eventHasTime: input.eventHasTime,
              eventTimezone: input.eventTimezone,
              eventStatus: "resolved",
              temporalConfidence: "high",
              temporalLocked: true,
              recurring: false,
              recurrenceType: null,
            }
          : capture
      )
    );
  }

  return (
    <DashboardContext.Provider
      value={{
        user,
        captures,
        capturesLoading,
        capturesError,
        isCapturing,
        openCapture: () => setIsCapturing(true),
        removeCapture,
        updateSpaces,
        updateText,
        updateStatus,
        updatePinned,
        updateTemporal,
        dismissTemporal,
        temporalSuggestions,
        dismissTemporalSuggestion,
        previewTemporalReanalysis,
      }}
    >
      {children}

      <CaptureModal
        open={isCapturing}
        captureText={captureText}
        onCaptureTextChange={setCaptureText}
        error={saveError}
        saving={isSaving}
        onSave={saveCapture}
        onCancel={() => {
          setIsCapturing(false);
          setCaptureText("");
          setSaveError(null);
        }}
      />

      {showSavedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg z-50">
          Your Drop has been added to Sunshine ☀️
        </div>
      )}
    </DashboardContext.Provider>
  );
}
