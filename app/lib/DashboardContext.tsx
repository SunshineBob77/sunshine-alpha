"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { fetchCaptures, insertCapture, type Capture } from "./captures";
import { analyzeCapture } from "./analyzeCapture";
import CaptureModal from "../components/CaptureModal";

type DashboardContextValue = {
  user: User;
  captures: Capture[];
  capturesLoading: boolean;
  capturesError: string | null;
  isCapturing: boolean;
  openCapture: () => void;
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
        if (!cancelled) setCapturesError("Couldn't load your captures. Try refreshing.");
      })
      .finally(() => {
        if (!cancelled) setCapturesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user.id]);

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
    } catch (error) {
      console.error(error);
      setSaveError("Couldn't save your capture. Please try again.");
    } finally {
      setIsSaving(false);
    }
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
    </DashboardContext.Provider>
  );
}
