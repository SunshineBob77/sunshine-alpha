"use client";

import { useState } from "react";
import { useCaptures } from "./DashboardContext";
import { copyToClipboard } from "./clipboard";

export type ShareStatus = "idle" | "sharing" | "copied" | "error";

export function useInviteShare() {
  const { user } = useCaptures();
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [manualLink, setManualLink] = useState<string | null>(null);

  const sharerName =
    user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "there";

  async function handleInvite() {
    setStatus("sharing");
    setManualLink(null);

    const url = `${window.location.origin}/s/invite?name=${encodeURIComponent(sharerName)}`;

    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${sharerName} is inviting you to Sunshine`,
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

  return { status, manualLink, handleInvite };
}
