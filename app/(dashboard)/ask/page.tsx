"use client";

import { useEffect, useMemo, useState } from "react";
import { useCaptures } from "@/app/lib/DashboardContext";
import { searchCaptures, tokenizeSearchQuery } from "@/app/lib/searchCaptures";
import { isAggregationQuery, detectWorkoutQuery } from "@/app/lib/aggregationIntent";
import DropCard from "@/app/components/DropCard";
import DropDetailModal from "@/app/components/DropDetailModal";

// Debounce for the aggregation route only - v1's plain keyword search
// above stays instant/per-keystroke (already in-memory, no network call).
// This one hits the network, so it waits for a pause in typing the same
// way any other network-backed search field would.
const AGGREGATION_DEBOUNCE_MS = 400;

export default function AskSunshinePage() {
  const { captures, capturesLoading, user } = useCaptures();
  const [query, setQuery] = useState("");
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? null;

  const results = useMemo(() => searchCaptures(captures, query), [captures, query]);
  const trimmedQuery = query.trim();
  // Distinguishes "nothing typed" from "typed something, but it was all
  // filler words (e.g. just 'find')" - both need the placeholder state
  // rather than a literal "no results", since neither one was ever a
  // real search to begin with.
  const hasSearchTerms = useMemo(() => tokenizeSearchQuery(query).length > 0, [query]);
  const isAggregation = useMemo(() => isAggregationQuery(trimmedQuery), [trimmedQuery]);
  // Pure/derived, not effect state - null whenever the query isn't
  // workout-shaped at all, which is also what the effect below keys off
  // of to decide whether there's a fetch to run in the first place.
  const workoutIntent = useMemo(() => detectWorkoutQuery(trimmedQuery), [trimmedQuery]);

  // Ask Sunshine v2 - a direct synthesized answer shown above the v1
  // results below, not a replacement for them. Two tiers: a real
  // workout_entries-backed total (aggregationAnswer non-null) when the
  // query looks workout-shaped AND actually matches stored activity data,
  // or - whenever the question is aggregation-shaped at all but that
  // lookup comes back empty/inapplicable - a generic "Found N matching
  // Drops" line computed entirely client-side from `results` (see the
  // render below), no second network call needed for that fallback.
  const [aggregationAnswer, setAggregationAnswer] = useState<string | null>(null);
  const [aggregationLoading, setAggregationLoading] = useState(false);

  useEffect(() => {
    // No fetch to run - nothing here to reset either, since the render
    // below only ever reads aggregationAnswer/aggregationLoading through
    // the effectiveAggregation* values, which already ignore both
    // whenever workoutIntent is null. A stale answer from a previous
    // workout-shaped query never leaks into a still-mounted, no-longer-
    // workout-shaped render.
    if (!workoutIntent) return;

    let cancelled = false;
    setAggregationLoading(true);

    const timer = setTimeout(() => {
      fetch("/api/ask-sunshine-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, query: trimmedQuery }),
      })
        .then((response) => response.json())
        .then((data: { answer?: string | null }) => {
          if (cancelled) return;
          setAggregationAnswer(data.answer ?? null);
        })
        .catch((error) => {
          if (cancelled) return;
          console.error("ask-sunshine-v2 failed", error);
          setAggregationAnswer(null);
        })
        .finally(() => {
          if (!cancelled) setAggregationLoading(false);
        });
    }, AGGREGATION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workoutIntent, trimmedQuery, user.id]);

  // Render-time guards against the "no fetch ran, state is stale" case
  // described above.
  const effectiveAggregationAnswer = workoutIntent ? aggregationAnswer : null;
  const effectiveAggregationLoading = workoutIntent ? aggregationLoading : false;

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

        {!hasSearchTerms ? (
          <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-center">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-lg text-gray-800 font-semibold mb-2">
              {trimmedQuery ? "Add a specific word to search for" : "Search your Drops"}
            </p>
            <p className="text-gray-500">
              {trimmedQuery ? (
                <>
                  &ldquo;{trimmedQuery}&rdquo; doesn&apos;t have a specific word to search for yet -
                  try adding a name, place, or topic (e.g. &ldquo;find ADG&rdquo; instead of just
                  &ldquo;find&rdquo;).
                </>
              ) : (
                <>
                  Type a keyword above to find Drops by title, content, category, project, or tags.
                  Natural phrasing like &ldquo;find ADG&rdquo; or &ldquo;show me birthdays&rdquo;
                  works too. Aggregate questions work now too, e.g. &ldquo;how many rounds did I
                  box this month&rdquo; - a direct answer shows up above your matching Drops.
                </>
              )}
            </p>
          </section>
        ) : capturesLoading ? (
          <p className="text-gray-500 text-center">Loading your Drops…</p>
        ) : (
          <>
            {isAggregation && !effectiveAggregationLoading && (
              <div className="bg-amber-50 ring-1 ring-amber-200 text-amber-900 rounded-2xl px-4 py-3 mb-4 text-sm font-semibold">
                {effectiveAggregationAnswer ??
                  `Found ${results.length} matching Drop${results.length === 1 ? "" : "s"}.`}
              </div>
            )}

            {results.length === 0 ? (
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
          </>
        )}
      </div>

      {selectedCapture && (
        <DropDetailModal capture={selectedCapture} onClose={() => setSelectedCaptureId(null)} />
      )}
    </main>
  );
}
