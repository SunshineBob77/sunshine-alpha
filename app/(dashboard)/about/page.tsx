"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import DropCard from "@/app/components/DropCard";
import DropGroupCarousel from "@/app/components/DropGroupCarousel";
import { useCaptures } from "@/app/lib/DashboardContext";

// Reached by tapping the logo/wordmark in DashboardHeader (see that
// file's own comment) - a plain dedicated route under (dashboard), same
// pattern as /ask and /me, not a modal. Back button mirrors
// spaces/shared/page.tsx's own "← Back to X" convention exactly (same
// classes, same router.push placement) - the established way a
// non-tab dashboard screen in this app gets "closeable".
export default function AboutPage() {
  const router = useRouter();
  const { captures, capturesLoading } = useCaptures();

  // Onboarding Drop carousel v1 - this is the "settled home" these 7
  // Drops move into once hidden from Lifeline (manually, or automatically
  // after a full swipe-through - see LifelineFeed's onAllSlidesVisited
  // wiring). Deliberately NOT filtered on hiddenUntil the way Lifeline's
  // own view is (see LifelineFeed.tsx's filteredCaptures) - these should
  // show here regardless of hidden state, since "hidden from Lifeline" is
  // exactly what lands them here in the first place. Sorted by id
  // ascending rather than trusting the shared captures array's own order
  // (createdAt-descending, with all 7 sharing near-identical created_at
  // from one multi-row insert) - id is the only field guaranteed to
  // reflect the real carousel display order these were created in (see
  // api/onboarding-drops/route.ts).
  const onboardingCaptures = useMemo(
    () =>
      captures
        .filter((capture) => capture.systemDropType === "onboarding")
        .sort((a, b) => a.id - b.id),
    [captures]
  );

  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Back to Lifeline"
            className="text-ink-dim hover:text-ink text-xl leading-none"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-ink">About Sunshine</h1>
        </div>

        <section className="bg-dusk rounded-3xl ring-1 ring-ink/10 shadow-sm p-7">
          <p className="text-ink leading-relaxed mb-4">
            Sunshine started as a simple problem: staying on the same page with a business
            partner across scattered notes, texts, and half-remembered conversations. Built by
            Bob Judge to solve that for himself and his wife and ADG.Boston co-founder Mary, it
            grew into something bigger — a place to drop anything in, and trust that it&apos;ll
            be there, organized, exactly when you need it again.
          </p>
          <p className="text-ink font-semibold">Drop it in. Ask for it later.</p>
        </section>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-ink-dim uppercase tracking-wide mb-2">
            Onboarding Drops
          </h2>
          {onboardingCaptures.length > 0 ? (
            <DropGroupCarousel
              slides={onboardingCaptures.map((capture) => (
                <DropCard
                  key={capture.id}
                  variant="dark"
                  title={capture.title ?? capture.sunshineSummary}
                  spaceId={null}
                  content={capture.text}
                  createdAt={capture.createdAt}
                  hideTimestamp
                  clipped={false}
                />
              ))}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-ink/20 p-4">
              <p className="text-xs text-ink-dim text-center">
                {capturesLoading ? "Loading…" : "No onboarding Drops yet."}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
