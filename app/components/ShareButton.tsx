"use client";

import { useState } from "react";
import { getOrCreateShare } from "@/app/lib/shares";
import { useCaptures } from "@/app/lib/DashboardContext";
import type { Capture } from "@/app/lib/captures";

type Status = "idle" | "sharing" | "copied" | "error";

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

export default function ShareButton({ capture }: { capture: Capture }) {
  const { user } = useCaptures();
  const [status, setStatus] = useState<Status>("idle");
  const [manualLink, setManualLink] = useState<string | null>(null);

  const sharerName =
    user.user_metadata?.full_name || user.email?.split("@")[0] || "there";

  async function handleShare() {
    setStatus("sharing");
    setManualLink(null);

    try {
      const share = await getOrCreateShare(capture, sharerName);
      const url = `${window.location.origin}/s/${share.id}`;

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

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleShare}
        disabled={status === "sharing"}
        className="text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
      >
        {status === "sharing" && "Sharing…"}
        {status === "copied" && "Copied!"}
        {status === "idle" && "🔗 Share"}
        {status === "error" && (manualLink ? "Copy link below" : "Couldn't share")}
      </button>

      {manualLink && (
        <input
          readOnly
          value={manualLink}
          onFocus={(event) => event.target.select()}
          className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 w-56"
        />
      )}
    </div>
  );
}
