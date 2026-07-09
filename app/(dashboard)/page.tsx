"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import WeatherWidget from "@/app/components/WeatherWidget";
import DropDetailModal from "@/app/components/DropDetailModal";
import LifelineFeed from "@/app/components/LifelineFeed";
import { useCaptures } from "@/app/lib/DashboardContext";
import { useInviteShare } from "@/app/lib/useInviteShare";
import { getQuoteOfTheDay } from "@/app/lib/quotes";
import { defaultSpaces } from "@/app/lib/spaces";

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const filterOptions = [
  { id: "all", name: "All", icon: "🌞" },
  ...defaultSpaces.map((space) => ({ id: space.id, name: space.name, icon: space.icon })),
];

export default function Home() {
  const { user, captures, capturesLoading, capturesError, openCapture } = useCaptures();
  const [now] = useState(() => new Date());
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? null;

  const displayName =
    user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "there";
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  const { status: inviteStatus, handleInvite } = useInviteShare();
  const [activeFilter, setActiveFilter] = useState("all");
  const quote = getQuoteOfTheDay(now);

  const headerRef = useRef<HTMLElement>(null);
  // Generous initial estimate so content isn't clipped before the ResizeObserver
  // below measures the real height on mount (useLayoutEffect corrects it pre-paint).
  const [headerHeight, setHeaderHeight] = useState(280);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const updateHeight = () => setHeaderHeight(el.offsetHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header
        ref={headerRef}
        className="fixed top-0 inset-x-0 z-30 bg-amber-50/95 backdrop-blur-md border-b border-black/5 px-4 sm:px-8 py-4"
      >
        <div className="w-full max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/me" aria-label="Your profile" className="shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover ring-1 ring-black/5"
                  />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-semibold ring-1 ring-black/5">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>

              <p className="min-w-0 text-lg sm:text-xl font-bold text-gray-900 truncate">
                {getGreeting(now)}, {displayName} ☀️
              </p>
            </div>

            <div className="flex items-end gap-3 shrink-0">
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviteStatus === "sharing"}
                className="flex flex-col items-center gap-1 text-xs font-semibold text-gray-700 disabled:opacity-40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-400 text-white shadow-sm">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 21a8 8 0 0 1 13.292-6" />
                    <circle cx="10" cy="8" r="5" />
                    <path d="M19 16v6" />
                    <path d="M22 19h-6" />
                  </svg>
                </span>
                {inviteStatus === "sharing"
                  ? "…"
                  : inviteStatus === "copied"
                    ? "Copied!"
                    : inviteStatus === "error"
                      ? "Couldn't share"
                      : "Invite"}
              </button>

              <button
                type="button"
                onClick={openCapture}
                aria-label="Drop"
                className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 shadow-lg shadow-amber-300/60 text-white text-3xl font-bold ring-4 ring-white transition-transform hover:scale-105"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-4">
            <WeatherWidget variant="forecast" />
          </div>

          <div className="mt-4 text-center">
            <p className="italic text-gray-700 text-sm">
              “{quote.text}”{" "}
              <span className="not-italic text-gray-400 text-xs">— {quote.author}</span>
            </p>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveFilter(option.id)}
                className={`shrink-0 whitespace-nowrap text-sm font-semibold px-3.5 py-2 rounded-full transition-all ${
                  activeFilter === option.id
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 ring-1 ring-black/5 hover:ring-black/10"
                }`}
              >
                {option.icon} {option.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main
        className="flex flex-col items-center p-4 sm:p-8"
        style={{ paddingTop: headerHeight + 16 }}
      >
        <div className="w-full max-w-2xl">
          {capturesError && (
            <p className="text-sm text-red-600 mb-6 text-center">{capturesError}</p>
          )}

          {capturesLoading ? (
            <p className="text-gray-500 text-center">Loading your day…</p>
          ) : (
            <section>
              <LifelineFeed
                captures={captures}
                activeFilter={activeFilter}
                onSelectCapture={setSelectedCaptureId}
              />
            </section>
          )}
        </div>

        {selectedCapture && (
          <DropDetailModal
            capture={selectedCapture}
            onClose={() => setSelectedCaptureId(null)}
          />
        )}
      </main>
    </>
  );
}
