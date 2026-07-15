"use client";

import { useEffect, useState } from "react";
import { getSignedAttachmentUrl } from "@/app/lib/storage";

// Photo/Gallery/File capture v1. Neither component here ever renders a
// stored URL directly - imagePath/filePath are private storage object
// paths (see docs/photo-file-capture-schema.sql), and a signed URL is
// requested fresh on mount every time a card mounts. This is what makes
// "photo visibility follows the same rules as the Drop it's attached to"
// actually true: the signed-URL request itself goes through storage RLS,
// which mirrors captures' own visibility, so a card for a Drop the
// viewer can't see would fail to sign a URL at all (getSignedAttachmentUrl
// throws, caught below) rather than ever exposing one.
//
// Deliberately doesn't block the rest of the card's render - both
// components resolve async and show a lightweight placeholder in the
// meantime, per "don't block the whole card on a slow image load."

export function DropAttachmentImage({
  imagePath,
  variant = "light",
}: {
  imagePath: string;
  variant?: "light" | "dark";
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);

    getSignedAttachmentUrl(imagePath)
      .then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl);
      })
      .catch((error) => {
        console.error("Couldn't load attached image", error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  // Fails silently - a broken/expired/inaccessible image must never take
  // the rest of the card down with it, same principle as analyze-drop's
  // own "still save fine with no rich analysis" requirement.
  if (failed) return null;

  return (
    <div
      className={`mb-2 overflow-hidden rounded-xl ${variant === "dark" ? "bg-ink/10" : "bg-gray-100"}`}
      style={{ aspectRatio: "4 / 3" }}
    >
      {url ? (
        // Plain <img>, not next/image - these are short-lived signed URLs
        // to a private bucket, not a stable public asset Next.js' image
        // optimizer could usefully cache/resize (see next.config's lack
        // of a remotePatterns entry for it, deliberately not added).
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse bg-black/5" />
      )}
    </div>
  );
}

export function DropAttachmentFile({
  filePath,
  fileName,
  variant = "light",
}: {
  filePath: string;
  fileName: string;
  variant?: "light" | "dark";
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getSignedAttachmentUrl(filePath)
      .then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl);
      })
      .catch((error) => console.error("Couldn't load attached file", error));

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        // Signed URL hasn't resolved (or failed) yet - nothing to open.
        if (!url) event.preventDefault();
      }}
      className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
        variant === "dark"
          ? "bg-ink/10 text-ink hover:bg-ink/15"
          : "bg-gray-100 text-gray-800 hover:bg-gray-200"
      }`}
    >
      <span>📎</span>
      <span className="truncate">{fileName}</span>
    </a>
  );
}
