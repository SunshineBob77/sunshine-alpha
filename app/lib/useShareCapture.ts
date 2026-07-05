"use client";

import { useState } from "react";
import { getOrCreateShare } from "./shares";
import { useCaptures } from "./DashboardContext";
import type { Capture } from "./captures";

export type ShareStatus = "idle" | "sharing" | "copied" | "error";

function copyToClipboard(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
}

export function useShareCapture(capture: Capture | null) {
  const { user } = useCaptures();
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [manualLink, setManualLink] = useState<string | null>(null);

  const sharerName =
    user.user_metadata?.full_name || user.email?.split("@")[0] || "there";

  async function handleShare() {
    if (!capture) return;

    setStatus("sharing");
    setManualLink(null);

    try {
      const share = await getOrCreateShare(capture, sharerName);
      const url = `${window.location.origin}/s/${share.id}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: `A drop of sunshine from ${sharerName}`,
            text: share.previewText,
            url,
          });
          setStatus("idle");
          return;
        } catch (error) {
          if ((error as DOMException)?.name === "AbortError") {
            setStatus("idle");
            return;
          }
          console.error(error);
          // fall through to clipboard fallback below
        }
      }

      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          copied = true;
        } catch {
          copied = false;
        }
      }

      if (!copied) {
        copied = copyToClipboard(url);
      }

      if (copied) {
        setStatus("copied");
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setManualLink(url);
        setStatus("error");
      }
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }

  return { status, manualLink, handleShare };
}
