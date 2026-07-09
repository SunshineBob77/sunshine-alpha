"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import WeatherWidget from "@/app/components/WeatherWidget";
import DropDetailModal from "@/app/components/DropDetailModal";
import LifelineFeed from "@/app/components/LifelineFeed";
import { useCaptures } from "@/app/lib/DashboardContext";
import { useInviteShare } from "@/app/lib/useInviteShare";

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

  const { status: inviteStatus, handleInvite } = useInviteShare();

  const headerRef = useRef<HTMLElement>(null);
  // Generous initial estimate so content isn't clipped before the ResizeObserver
  // below measures the real height on mount (useLayoutEffect corrects it pre-paint).
  const [headerHeight, setHeaderHeight] = useState(96);

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
        className="fixed top-0 inset-x-0 z-30 bg-amber-50/95 backdrop-blur-md border-b border-black/5 px-4 sm:px-8 py-3"
      >
        <div className="w-full max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/me" aria-label="Your profile" className="shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-1 ring-black/5"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-semibold ring-1 ring-black/5">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>

          <p className="min-w-0 flex-1 text-sm sm:text-base font-semibold text-gray-900 truncate">
            {getGreeting(now)}, {displayName} ☀️
          </p>

          <WeatherWidget compact />

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={openCapture}
              aria-label="Drop"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-sm"
            >
              🌞
            </button>

            <button
              type="button"
              onClick={handleInvite}
              disabled={inviteStatus === "sharing"}
              aria-label="Invite a friend"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-400 text-white shadow-sm disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="5" fill="white" />
                <path
                  d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-rose-500 text-[9px] font-bold shadow-sm">
                +
              </span>
            </button>
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
              <h2 className="text-xl font-semibold mb-3 text-gray-900">Lifeline</h2>
              <LifelineFeed captures={captures} onSelectCapture={setSelectedCaptureId} />
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
