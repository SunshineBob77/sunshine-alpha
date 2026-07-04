"use client";

import { useState } from "react";
import WeatherWidget from "@/app/components/WeatherWidget";
import WeekStrip from "@/app/components/WeekStrip";
import DailyBriefingCard from "@/app/components/DailyBriefingCard";
import SpaceSummaryCards from "@/app/components/SpaceSummaryCards";
import { useCaptures } from "@/app/lib/DashboardContext";

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function Home() {
  const { user, captures, capturesLoading, capturesError } = useCaptures();
  const [now] = useState(() => new Date());

  const displayName =
    user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "there";

  const recentCaptures = captures.slice(0, 3);

  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <section className="mt-10 mb-6">
          <h1 className="text-5xl font-bold text-center mb-8 tracking-tight text-gray-900">
            <span className="mr-2">🌞</span>Sunshine
          </h1>

          <div className="bg-white/70 backdrop-blur rounded-3xl ring-1 ring-black/5 shadow-sm p-6">
            <h2 className="text-3xl font-semibold text-gray-900">
              {getGreeting(now)}, {displayName}
            </h2>
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
              <DailyBriefingCard captures={captures} />
            </section>

            <section className="mb-6">
              <SpaceSummaryCards captures={captures} />
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-gray-900">Recent Captures</h2>

              {recentCaptures.length === 0 ? (
                <p className="text-gray-500">Nothing captured yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentCaptures.map((capture) => (
                    <div
                      key={capture.id}
                      className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-4 text-left"
                    >
                      <p className="text-gray-900">
                        {capture.text.length > 120
                          ? `${capture.text.slice(0, 120)}…`
                          : capture.text}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        {new Date(capture.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
