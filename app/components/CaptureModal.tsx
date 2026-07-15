"use client";

import { useEffect, useRef, useState } from "react";

// Photo/Gallery/File capture v1 - a single pending attachment lives
// alongside captureText, lifted up into DashboardContext (same pattern as
// captureText itself) so saveCapture() can pick it up directly when Save
// is tapped. "image" covers both Photo and Gallery (identical file-input
// mechanics, only the `capture` attribute differs) - "file" is the
// generic non-image picker. At most one pending attachment at a time;
// picking a new one replaces whatever was pending before.
export type PendingAttachment = { file: File; kind: "image" | "file" };

type CaptureModalProps = {
  open: boolean;
  captureText: string;
  onCaptureTextChange: (text: string) => void;
  pendingAttachment: PendingAttachment | null;
  onPendingAttachmentChange: (attachment: PendingAttachment | null) => void;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
};

// Client-side only - the real ceiling is whatever Supabase Storage's own
// project limits allow, this is just a fast, friendly guard so a huge
// video-length file doesn't sit uploading for minutes before failing.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export default function CaptureModal({
  open,
  captureText,
  onCaptureTextChange,
  pendingAttachment,
  onPendingAttachmentChange,
  error,
  saving,
  onSave,
  onCancel,
}: CaptureModalProps) {
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Local object-URL preview for an image attachment only (a generic File
  // renders as a plain filename chip, nothing to preview) - created fresh
  // whenever the pending file changes, revoked on cleanup so this never
  // leaks across picks or across modal closes.
  useEffect(() => {
    if (!pendingAttachment || pendingAttachment.kind !== "image") {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(pendingAttachment.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingAttachment]);

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

  function handleFilePicked(kind: "image" | "file", event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Always clear the input's own value, even on failure - otherwise
    // picking the exact same file twice in a row (e.g. retake -> cancel
    // -> pick the same photo again) wouldn't fire a new change event.
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError("That file's too large (max 10MB).");
      return;
    }

    setAttachmentError(null);
    onPendingAttachmentChange({ file, kind });
  }

  function handleRemoveAttachment() {
    setAttachmentError(null);
    onPendingAttachmentChange(null);
  }

  if (!open) return null;

  const canSave = !saving && (captureText.trim().length > 0 || pendingAttachment !== null);

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
          What would you like to drop into Sunshine?
        </label>

        <textarea
          value={captureText}
          onChange={(event) => onCaptureTextChange(event.target.value)}
          className="w-full border border-gray-300 rounded-xl p-4 min-h-32 text-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          placeholder="What's on your mind?"
          autoFocus
        />

        {pendingAttachment && (
          <div className="mt-3 flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            {pendingAttachment.kind === "image" && previewUrl ? (
              <img
                src={previewUrl}
                alt="Selected photo"
                className="h-16 w-16 rounded-lg object-cover shrink-0"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-2xl">
                📄
              </span>
            )}
            <p className="min-w-0 flex-1 truncate text-sm text-gray-700">
              {pendingAttachment.file.name}
            </p>
            <button
              type="button"
              onClick={handleRemoveAttachment}
              aria-label="Remove attachment"
              className="shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {voiceSupported ? (
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
          ) : (
            <p className="text-sm text-gray-500">
              🎤 This browser doesn't support in-app voice input — tap the microphone on your
              keyboard to dictate instead.
            </p>
          )}

          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="flex items-center gap-2 py-2 px-4 rounded-xl font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 transition-all"
          >
            📷 Photo
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center gap-2 py-2 px-4 rounded-xl font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 transition-all"
          >
            🖼️ Gallery
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 py-2 px-4 rounded-xl font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 transition-all"
          >
            📎 File
          </button>

          {isRecording && <span className="text-sm text-gray-500">Listening…</span>}
          {voiceError && <span className="text-sm text-red-600">{voiceError}</span>}
        </div>

        {/* Camera capture - `capture="environment"` is what steers mobile
            browsers to open the camera directly instead of the library.
            No effect on desktop, which just falls back to a file picker. */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => handleFilePicked("image", event)}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleFilePicked("image", event)}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => handleFilePicked("file", event)}
        />

        {attachmentError && <p className="text-sm text-red-600 mt-2">{attachmentError}</p>}
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onSave}
            disabled={!canSave}
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
