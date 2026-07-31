"use client";

import { useRouter } from "next/navigation";
import DropGroupCarousel from "@/app/components/DropGroupCarousel";

// Reached by tapping the logo/wordmark in DashboardHeader (see that
// file's own comment) - a plain dedicated route under (dashboard), same
// pattern as /ask and /me, not a modal. Back button mirrors
// spaces/shared/page.tsx's own "← Back to X" convention exactly (same
// classes, same router.push placement) - the established way a
// non-tab dashboard screen in this app gets "closeable".
export default function AboutPage() {
  const router = useRouter();

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

        {/* Onboarding Drop carousel shell v1 - scaffolding only, no real
            onboarding Drops yet. Wired directly to DropGroupCarousel with
            an empty slides array (not the me/page.tsx guard pattern of
            `slides.length > 1 ? <DropGroupCarousel/> : slides[0]`, which
            would skip the carousel entirely below 2 slides) so this
            actually exercises the same mechanism Card Carousel v2 groups
            and the Daily Brief carousel use. DropGroupCarousel itself
            doesn't error on zero slides, but it also has no built-in empty
            state - canLoop is false, no clones/dots/arrows render, and the
            height-tracking effect never measures a slide, so the
            component collapses to a literal 0-height nothing. The
            surrounding label + dashed border here is the "placeholder
            state" that makes the empty shell visible/confirmable, without
            inventing any actual onboarding step content. */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-ink-dim uppercase tracking-wide mb-2">
            Onboarding Drops
          </h2>
          <div className="rounded-2xl border border-dashed border-ink/20 p-4">
            <DropGroupCarousel slides={[]} />
            <p className="text-xs text-ink-dim text-center">No onboarding Drops yet.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
