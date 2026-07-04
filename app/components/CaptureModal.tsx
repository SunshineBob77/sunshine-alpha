"use client";

import { useEffect, useRef, useState } from "react";
import type { Space } from "../lib/spaces";

type CaptureModalProps = {
  open: boolean;
  captureText: string;
  onCaptureTextChange: (text: string) => void;
  spaces: Space[];
  activeSpaceName: string;
  selectedSpaceIds: string[];
  onToggleSpace: (spaceId: string) => void;
  selectedSpacesLabel: string;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
};

export default function CaptureModal({
  open,
  captureText,
  onCaptureTextChange,
  spaces,
  activeSpaceName,
  selectedSpaceIds,
  onToggleSpace,
  selectedSpacesLabel,
  error,
  saving,
  onSave,
  onCancel,
}: CaptureModalProps) {
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef("");

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognitionCtor);
  }, []);

  useEffect(() => {
    if (!open) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }
  }, [open]);

  function toggleRecording() {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    setVoiceError(null);

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    baseTextRef.current = captureText ? captureText + " " : "";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      if (final) {
        baseTextRef.current += final;
      }

      onCaptureTextChange(baseTextRef.current + interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setVoiceError("Microphone access was denied.");
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white p-6 rounded-3xl ring-1 ring-black/5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <label className="block text-lg font-semibold mb-3 text-gray-900">
          What would you like to capture?
        </label>

        <textarea
          value={captureText}
          onChange={(event) => onCaptureTextChange(event.target.value)}
          className="w-full border border-gray-300 rounded-xl p-4 min-h-32 text-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          placeholder={`Capture into ${activeSpaceName}...`}
          autoFocus
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleRecording}
            disabled={!voiceSupported}
            title={voiceSupported ? undefined : "Voice input isn't supported in this browser"}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isRecording
                ? "bg-red-500 text-white shadow-md ring-4 ring-red-200 animate-pulse"
                : "bg-gray-100 text-gray-900 hover:bg-gray-200"
            }`}
          >
            {isRecording ? "⏹️ Stop" : "🎤 Speak"}
          </button>

          {isRecording && <span className="text-sm text-gray-500">Listening…</span>}
          {voiceError && <span className="text-sm text-red-600">{voiceError}</span>}
        </div>

        <div className="mt-5">
          <h3 className="font-semibold mb-3 text-gray-900">Choose Spaces</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {spaces.map((space) => {
              const isSelected = selectedSpaceIds.includes(space.id);

              return (
                <button
                  key={space.id}
                  onClick={() => onToggleSpace(space.id)}
                  className={`rounded-2xl p-3 text-center border-2 transition-all ${
                    isSelected
                      ? "border-amber-400 bg-amber-50 shadow-sm"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className="text-2xl">{space.icon}</div>
                  <div className="font-semibold text-gray-900">{space.name}</div>
                  {space.isShared && (
                    <div className="text-xs mt-1 text-gray-600">Shared</div>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-sm text-gray-500 mt-3">Selected: {selectedSpacesLabel}</p>
        </div>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onSave}
            disabled={saving}
            className="bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-500 hover:to-orange-400 text-gray-900 font-bold py-3 px-6 rounded-xl shadow-sm transition-all disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>

          <button
            onClick={onCancel}
            className="bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3 px-6 rounded-xl transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
