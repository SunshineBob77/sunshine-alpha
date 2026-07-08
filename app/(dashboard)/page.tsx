"use client";

import { useState } from "react";
import Link from "next/link";
import WeatherWidget from "@/app/components/WeatherWidget";
import WeekStrip from "@/app/components/WeekStrip";
import DailyBriefingCard from "@/app/components/DailyBriefingCard";
import SpaceSummaryCards from "@/app/components/SpaceSummaryCards";
import DropDetailModal from "@/app/components/DropDetailModal";
import ShareButton from "@/app/components/ShareButton";
import { useCaptures } from "@/app/lib/DashboardContext";
import { useShareCapture } from "@/app/lib/useShareCapture";
import { getQuoteOfTheDay } from "@/app/lib/quotes";
import { caveat } from "@/app/lib/fonts";

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const { user, captures, capturesLoading, capturesError, openCapture } = useCaptures();
  const [now] = useState(() => new Date());
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? null;

  const displayName =
    user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "there";
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  const recentCaptures = captures.slice(0, 3);
  const mostRecentCapture = captures[0] ?? null;
  const { status: shareStatus, handleShare } = useShareCapture(mostRecentCapture);

  const quote = getQuoteOfTheDay(now);

  return (
    <main className="flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <section className="mt-4 sm:mt-8 mb-6">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-3xl sm:text-4xl leading-none shrink-0">🌞</span>
              <span
                className={`${caveat.className} text-2xl sm:text-3xl font-bold text-gray-900 truncate`}
              >
                Sunshine
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                aria-label="Search"
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white ring-1 ring-black/5 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>

              <Link href="/me" aria-label="Your profile">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover ring-1 ring-black/5"
                  />
                ) : (
                  <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-semibold ring-1 ring-black/5">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
            </div>
          </div>

          <div className="text-center mb-4">
            <p className="italic text-gray-700">
              “{quote.text}”{" "}
              <span className="not-italic text-gray-400 text-sm">— {quote.author}</span>
            </p>

            <div className="flex items-center gap-3 mt-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm">☀️</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/70 backdrop-blur rounded-3xl ring-1 ring-black/5 shadow-sm p-6">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 break-words">
                {getGreeting(now)}, {displayName} ☀️
              </h2>
              <p className="text-sm text-gray-500 mt-1">Let's make it a great day.</p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={openCapture}
                className="flex flex-col items-center gap-1 text-xs font-semibold text-gray-700"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 text-white text-lg shadow-sm">
                  🌞
                </span>
                Drop
              </button>

              <button
                type="button"
                onClick={handleShare}
                disabled={!mostRecentCapture || shareStatus === "sharing"}
                className="flex flex-col items-center gap-1 text-xs font-semibold text-gray-700 disabled:opacity-40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-700 shadow-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                    <path d="M16 6l-4-4-4 4" />
                    <path d="M12 2v13" />
                  </svg>
                </span>
                {shareStatus === "sharing" ? "…" : shareStatus === "copied" ? "Copied!" : "Share"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <WeatherWidget />
          </div>
        </section>

        <section className="mb-6">
          <WeekStrip captures={captures} />
        </section>

        {capturesError && (
          <p className="text-sm text-red-600 mb-6 text-center">{capturesError}</p>
        )}

        {capturesLoading ? (
          <p className="text-gray-500 text-center">Loading your day…</p>
        ) : (
          <>
            <section className="mb-6">
              <DailyBriefingCard captures={captures} onSelectCapture={setSelectedCaptureId} />
            </section>

            <section className="mb-6">
              <SpaceSummaryCards captures={captures} />
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-gray-900">Recent Drops</h2>

              {recentCaptures.length === 0 ? (
                <p className="text-gray-500">No Drops yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentCaptures.map((capture) => (
                    <div
                      key={capture.id}
                      className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-4 hover:ring-black/10 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedCaptureId(capture.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="text-gray-900 break-words">
                            {capture.text.length > 120
                              ? `${capture.text.slice(0, 120)}…`
                              : capture.text}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                            <span>{new Date(capture.createdAt).toLocaleString()}</span>
                            {capture.aiResearchResult && <span title="Sunshine found something">🔎</span>}
                            {capture.extractedAddress && <span title="Has a map link">📍</span>}
                          </div>
                        </button>

                        <div className="shrink-0">
                          <ShareButton capture={capture} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedCapture && (
        <DropDetailModal
          capture={selectedCapture}
          onClose={() => setSelectedCaptureId(null)}
        />
      )}
    </main>
  );
}
