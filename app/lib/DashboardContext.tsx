"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  fetchCaptures,
  insertCapture,
  deleteCapture,
  updateCaptureSpaces,
  updateCaptureText,
  type Capture,
} from "./captures";
import { analyzeCapture } from "./analyzeCapture";
import CaptureModal from "../components/CaptureModal";

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

  function analyzeDrop(id: number, text: string) {
    fetch("/api/analyze-drop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text }),
    })
      .then((response) => response.json())
      .then(
        (data: {
          result?: string | null;
          address?: string | null;
          formatted?: string | null;
          title?: string | null;
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
    await updateCaptureText(id, text);
    setCaptures((prev) =>
      prev.map((capture) => (capture.id === id ? { ...capture, text } : capture))
    );
    analyzeDrop(id, text);
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
