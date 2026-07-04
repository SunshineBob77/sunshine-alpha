"use client";

import { useEffect, useRef, useState } from "react";

type CaptureModalProps = {
  open: boolean;
  captureText: string;
  onCaptureTextChange: (text: string) => void;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
};

export default function CaptureModal({
  open,
  captureText,
  onCaptureTextChange,
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
          placeholder="What's on your mind?"
          autoFocus
        />

        <div className="mt-3 flex items-center gap-3">
          {voiceSupported ? (
            <>
              <button
                type="button"
                onClick={toggleRecording}
                className={`flex items-center gap-2 py-2 px-4 rounded-xl font-semibold transition-all ${
                  isRecording
                    ? "bg-red-500 text-white shadow-md ring-4 ring-red-200 animate-pulse"
                    : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                {isRecording ? "⏹️ Stop" : "🎤 Speak"}
              </button>

              {isRecording && <span className="text-sm text-gray-500">Listening…</span>}
              {voiceError && <span className="text-sm text-red-600">{voiceError}</span>}
            </>
          ) : (
            <p className="text-sm text-gray-500">
              🎤 This browser doesn't support in-app voice capture — tap the microphone on your
              keyboard to dictate instead.
            </p>
          )}
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
