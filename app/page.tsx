"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import WeatherWidget from "./components/WeatherWidget";
import AuthForm from "./components/AuthForm";
import CaptureModal from "./components/CaptureModal";
import { supabase } from "./lib/supabaseClient";
import { defaultSpaces } from "./lib/spaces";
import { fetchCaptures, insertCapture, type Capture } from "./lib/captures";

const stoicQuotes = [
  { text: "You have power over your mind - not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
  { text: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius" },
  { text: "It is not death that a man should fear, but he should fear never beginning to live.", author: "Marcus Aurelius" },
  { text: "If it is not right, do not do it; if it is not true, do not say it.", author: "Marcus Aurelius" },
  { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { text: "He who is brave is free.", author: "Seneca" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus" },
  { text: "It's not what happens to you, but how you react to it that matters.", author: "Epictetus" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "Only the educated are free.", author: "Epictetus" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus" },
  { text: "The obstacle is the way.", author: "Marcus Aurelius" },
  { text: "How much more grievous are the consequences of anger than the causes of it.", author: "Marcus Aurelius" },
  { text: "The best revenge is to be unlike him who performed the injury.", author: "Marcus Aurelius" },
  { text: "Man conquers the world by conquering himself.", author: "Zeno of Citium" },
  { text: "Well-being is realized by small steps, but is truly no small thing.", author: "Zeno of Citium" },
  { text: "He suffers more than necessary, who suffers before it is necessary.", author: "Seneca" },
  { text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca" },
  { text: "Every new beginning comes from some other beginning's end.", author: "Seneca" },
  { text: "Circumstances don't make the man, they only reveal him to himself.", author: "Epictetus" },
];

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function SectionHeading({
  icon,
  tone,
  children,
}: {
  icon: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${tone}`}
      >
        {icon}
      </span>
      <h3 className="font-semibold text-lg text-gray-900">{children}</h3>
    </div>
  );
}

function analyzeCapture(text: string) {
  const lowerText = text.toLowerCase();

  let category = "Memory";
  let project = "General";
  let mood = "Neutral";
  let tags: string[] = [];
  let sunshineSummary = "Captured a personal note.";

  if (
    lowerText.includes("software") ||
    lowerText.includes("code") ||
    lowerText.includes("coding") ||
    lowerText.includes("sunshine")
  ) {
    category = "Achievement";
    project = "Work";
    mood = "Positive";
    tags = ["software", "coding", "progress"];
    sunshineSummary = "You made progress building software today. ☀️";
  }

  if (
    lowerText.includes("uber") ||
    lowerText.includes("driving") ||
    lowerText.includes("ride")
  ) {
    category = "Work";
    project = "Work";
    mood = "Neutral";
    tags = ["work", "driving"];
    sunshineSummary = "You captured something related to driving work.";
  }

  if (
    lowerText.includes("remind") ||
    lowerText.includes("remember") ||
    lowerText.includes("todo")
  ) {
    category = "Task";
    project = "Personal";
    mood = "Neutral";
    tags = ["task", "reminder"];
    sunshineSummary = "This sounds like something to remember or act on.";
  }

  return {
    category,
    project,
    tags,
    mood,
    sunshineSummary,
  };
}

export default function Home() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [activeSpace, setActiveSpace] = useState("personal");
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>(["personal"]);
  const [now, setNow] = useState<Date | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [capturesLoading, setCapturesLoading] = useState(true);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const displayName =
    user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setCaptures([]);
    setCapturesLoading(true);

    fetchCaptures()
      .then((data) => {
        if (!cancelled) setCaptures(data);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setCaptureError("Couldn't load your captures. Try refreshing.");
      })
      .finally(() => {
        if (!cancelled) setCapturesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const quoteOfTheDay = useMemo(() => {
    const dayOfYear = now ? getDayOfYear(now) : 0;
    return stoicQuotes[dayOfYear % stoicQuotes.length];
  }, [now]);

  useEffect(() => {
    setSelectedSpaceIds([activeSpace]);
  }, [activeSpace]);

  const activeSpaceObject = useMemo(() => {
    return defaultSpaces.find((space) => space.id === activeSpace) || defaultSpaces[0];
  }, [activeSpace]);

  const selectedSpaces = useMemo(() => {
    return defaultSpaces.filter((space) => selectedSpaceIds.includes(space.id));
  }, [selectedSpaceIds]);

  const filteredCaptures = useMemo(() => {
    return captures.filter((capture) => capture.spaceIds?.includes(activeSpace));
  }, [captures, activeSpace]);

  function toggleSpace(spaceId: string) {
    if (selectedSpaceIds.includes(spaceId)) {
      const updatedSpaces = selectedSpaceIds.filter((id) => id !== spaceId);
      setSelectedSpaceIds(updatedSpaces.length > 0 ? updatedSpaces : [activeSpace]);
      return;
    }

    setSelectedSpaceIds([...selectedSpaceIds, spaceId]);
  }

  async function saveCapture() {
    if (!captureText.trim()) return;

    const meaning = analyzeCapture(captureText);
    const spaceIds = selectedSpaceIds.length > 0 ? selectedSpaceIds : [activeSpace];

    setCaptureError(null);
    setIsSaving(true);

    try {
      const newCapture = await insertCapture({
        text: captureText.trim(),
        spaceIds,
        ...meaning,
      });

      setCaptures((prev) => [newCapture, ...prev]);
      setCaptureText("");
      setSelectedSpaceIds([activeSpace]);
      setIsCapturing(false);
    } catch (error) {
      console.error(error);
      setCaptureError("Couldn't save your capture. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function getSpacesForCapture(capture: Capture) {
    return defaultSpaces.filter((space) => capture.spaceIds?.includes(space.id));
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-white" />
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-white flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <section className="mt-10 mb-8">
          <h1 className="text-5xl font-bold text-center mb-8 tracking-tight text-gray-900">
            <span className="mr-2">🌞</span>Sunshine
          </h1>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 bg-white/70 backdrop-blur rounded-3xl ring-1 ring-black/5 shadow-sm p-6">
            <div>
              <h2 className="text-3xl font-semibold text-gray-900">
                {now ? getGreeting(now) : "Good Morning"}, {displayName}
              </h2>

              <p className="text-gray-500 mt-1 text-sm">
                {now
                  ? now.toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : ""}
                {now && " · "}
                {now ? now.toLocaleTimeString() : ""}
              </p>

              <button
                onClick={() => supabase.auth.signOut()}
                className="text-xs text-gray-400 hover:text-gray-600 mt-2 underline"
              >
                Log out
              </button>
            </div>

            {!isCapturing && (
              <button
                onClick={() => setIsCapturing(true)}
                className="bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-500 hover:to-orange-400 text-gray-900 font-bold py-4 px-8 rounded-2xl shadow-md shadow-amber-200/60 text-xl whitespace-nowrap transition-all"
              >
                + Capture
              </button>
            )}
          </div>

          <div className="mt-4">
            <WeatherWidget />
          </div>
        </section>

        <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-left mb-8">
          <p className="italic text-lg mb-6 text-gray-800">
            "{quoteOfTheDay.text}"{" "}
            <span className="not-italic text-gray-500 text-base">- {quoteOfTheDay.author}</span>
          </p>

          <SectionHeading icon="🎯" tone="bg-amber-100">
            Today's Focus
          </SectionHeading>
          <ul className="list-disc ml-6 mb-7 text-gray-700 space-y-1">
            <li>Build Sunshine Alpha</li>
            <li>Create Shared Spaces</li>
            <li>Test Capture and Vault</li>
            <li>Continue ADG Scotland Landing Page</li>
            <li>Evaluate Atlas opportunities</li>
          </ul>

          <SectionHeading icon="🌟" tone="bg-emerald-100">
            Yesterday's Win
          </SectionHeading>
          <p className="mb-7 text-gray-700">
            Sunshine moved from idea mode into real working software.
          </p>

          <SectionHeading icon="💡" tone="bg-sky-100">
            AI Insight
          </SectionHeading>
          <p className="text-gray-700">
            Shared Spaces may become Sunshine's biggest differentiator:
            not just shared files, but shared understanding.
          </p>
        </section>

        <section className="mt-10 bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">Spaces</h2>

            {!isCapturing && (
              <button
                onClick={() => setIsCapturing(true)}
                className="self-start sm:self-auto bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-500 hover:to-orange-400 text-gray-900 font-bold py-3 px-5 rounded-xl shadow-sm transition-all"
              >
                + Capture in {activeSpaceObject.name}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {defaultSpaces.map((space) => (
              <button
                key={space.id}
                onClick={() => setActiveSpace(space.id)}
                className={`${space.color} rounded-2xl p-3 text-center ring-1 ring-black/5 transition-all ${
                  activeSpace === space.id
                    ? "ring-2 ring-amber-400 scale-[1.03] shadow-md"
                    : "shadow-sm hover:shadow-md hover:scale-[1.01]"
                }`}
              >
                <div className="text-2xl">{space.icon}</div>
                <div className="font-semibold text-gray-900">{space.name}</div>
                {space.isShared && (
                  <div className="text-xs mt-1 text-gray-600">Shared</div>
                )}
              </button>
            ))}
          </div>

          <p className="text-sm text-gray-500 mt-4">
            Active Space: {activeSpaceObject.icon} {activeSpaceObject.name}
          </p>
        </section>

        <CaptureModal
          open={isCapturing}
          captureText={captureText}
          onCaptureTextChange={setCaptureText}
          spaces={defaultSpaces}
          activeSpaceName={activeSpaceObject.name}
          selectedSpaceIds={selectedSpaceIds}
          onToggleSpace={toggleSpace}
          selectedSpacesLabel={selectedSpaces.map((space) => `${space.icon} ${space.name}`).join(", ")}
          error={captureError}
          saving={isSaving}
          onSave={saveCapture}
          onCancel={() => {
            setIsCapturing(false);
            setCaptureText("");
            setSelectedSpaceIds([activeSpace]);
            setCaptureError(null);
          }}
        />

        <section className="mt-12 text-center w-full">
          <h2 className="text-2xl font-semibold mb-2 text-gray-900">
            {activeSpaceObject.icon} {activeSpaceObject.name} Vault
          </h2>

          {capturesLoading ? (
            <p className="text-gray-500">Loading captures…</p>
          ) : filteredCaptures.length === 0 ? (
            <p className="text-gray-500">No captures in this Space yet.</p>
          ) : (
            <div className="space-y-3 mt-4">
              {filteredCaptures.map((capture) => (
                <div
                  key={capture.id}
                  className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-5 text-left"
                >
                  <p className="text-lg text-gray-900">{capture.text}</p>

                  <p className="text-sm text-amber-700 font-semibold mt-3">
                    {capture.sunshineSummary}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {getSpacesForCapture(capture).map((space) => (
                      <span
                        key={space.id}
                        className={`text-xs px-2 py-1 rounded-full ${space.color}`}
                      >
                        {space.icon} {space.name}
                        {space.isShared ? " · Shared" : ""}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-xs bg-amber-100 px-2 py-1 rounded-full">
                      {capture.category}
                    </span>

                    <span className="text-xs bg-blue-100 px-2 py-1 rounded-full">
                      {capture.project}
                    </span>

                    <span className="text-xs bg-green-100 px-2 py-1 rounded-full">
                      {capture.mood}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 mt-3">
                    {new Date(capture.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}   