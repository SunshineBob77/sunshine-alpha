"use client";

import { useMemo, useState } from "react";
import { useCaptures } from "@/app/lib/DashboardContext";
import { searchCaptures } from "@/app/lib/searchCaptures";
import DropCard from "@/app/components/DropCard";
import DropDetailModal from "@/app/components/DropDetailModal";

export default function AskSunshinePage() {
  const { captures, capturesLoading } = useCaptures();
  const [query, setQuery] = useState("");
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? null;

  const results = useMemo(() => searchCaptures(captures, query), [captures, query]);
  const trimmedQuery = query.trim();

  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight text-gray-900">
          Ask Sunshine
        </h1>

        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your Drops…"
          autoFocus
          className="w-full text-base bg-white border border-gray-300 rounded-2xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent mb-6"
        />

        {!trimmedQuery ? (
          <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-center">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-lg text-gray-800 font-semibold mb-2">Search your Drops</p>
            <p className="text-gray-500">
              Type a keyword above to find Drops by title, content, category, project, or tags.
              Straightforward keyword search for now - conversational answers and smarter queries
              (like totals across your Drops) are coming later.
            </p>
          </section>
        ) : capturesLoading ? (
          <p className="text-gray-500 text-center">Loading your Drops…</p>
        ) : results.length === 0 ? (
          <p className="text-gray-500 text-center">No Drops match &ldquo;{trimmedQuery}&rdquo;.</p>
        ) : (
          <div className="space-y-3">
            {results.map((capture) => (
              // Bare DropCard, no action-row props at all - a search
              // result is a read-focused preview, not another place to
              // wire up Complete/Hide/Edit/Delete (that's what tapping
              // through to DropDetailModal is for, which already handles
              // ownership-gating and Shared Spaces correctly on its own,
              // regardless of how it was opened).
              <DropCard
                key={capture.id}
                title={capture.title ?? capture.sunshineSummary}
                spaceId={capture.spaceIds?.[0]}
                content={capture.formattedText ?? capture.text}
                createdAt={capture.createdAt}
                isUrgent={capture.tags?.includes("urgent") ?? false}
                isPinned={capture.pinned}
                checklistItems={capture.checklistItems}
                onTitleTap={() => setSelectedCaptureId(capture.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedCapture && (
        <DropDetailModal capture={selectedCapture} onClose={() => setSelectedCaptureId(null)} />
      )}
    </main>
  );
}
