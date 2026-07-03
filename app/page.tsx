"use client";

import { useEffect, useMemo, useState } from "react";

type Space = {
  id: string;
  name: string;
  icon: string;
  color: string;
  isShared: boolean;
};

type Capture = {
  id: number;
  text: string;
  createdAt: string;
  category: string;
  project: string;
  tags: string[];
  mood: string;
  sunshineSummary: string;
  spaceIds: string[];
};

const defaultSpaces: Space[] = [
  { id: "personal", name: "Personal", icon: "🏠", color: "bg-yellow-100", isShared: false },
  { id: "work", name: "Work", icon: "💼", color: "bg-blue-100", isShared: false },
  { id: "health", name: "Health", icon: "❤️", color: "bg-red-100", isShared: false },
  { id: "family", name: "Family", icon: "👨‍👩‍👧", color: "bg-green-100", isShared: false },
  { id: "finance", name: "Finance", icon: "💰", color: "bg-emerald-100", isShared: false },
  { id: "ideas", name: "Ideas", icon: "💡", color: "bg-purple-100", isShared: false },
  { id: "travel", name: "Travel", icon: "✈️", color: "bg-sky-100", isShared: false },
  { id: "shared", name: "Shared Space", icon: "👥", color: "bg-pink-100", isShared: true },
];

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
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>(["personal"]);
  const [activeSpace, setActiveSpace] = useState("personal");

  useEffect(() => {
    const saved = localStorage.getItem("sunshine-captures");

    if (saved) {
      setCaptures(JSON.parse(saved));
    }
  }, []);

  const selectedSpaces = useMemo(() => {
    return defaultSpaces.filter((space) => selectedSpaceIds.includes(space.id));
  }, [selectedSpaceIds]);

  function toggleSpace(spaceId: string) {
    if (selectedSpaceIds.includes(spaceId)) {
      setSelectedSpaceIds(selectedSpaceIds.filter((id) => id !== spaceId));
      return;
    }

    setSelectedSpaceIds([...selectedSpaceIds, spaceId]);
  }

  function saveCapture() {
    if (!captureText.trim()) return;

    const meaning = analyzeCapture(captureText);

    const newCapture: Capture = {
      id: Date.now(),
      text: captureText.trim(),
      createdAt: new Date().toLocaleString(),
      spaceIds: selectedSpaceIds.length > 0 ? selectedSpaceIds : ["personal"],
      ...meaning,
    };

    const updatedCaptures = [newCapture, ...captures];

    setCaptures(updatedCaptures);
    localStorage.setItem("sunshine-captures", JSON.stringify(updatedCaptures));

    setCaptureText("");
    setSelectedSpaceIds(["personal"]);
    setIsCapturing(false);
  }

  function getSpacesForCapture(capture: Capture) {
    return defaultSpaces.filter((space) => capture.spaceIds?.includes(space.id));
  }

  return (
    <main className="min-h-screen bg-yellow-50 flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <section className="mt-10 mb-8">

  <h1 className="text-5xl font-bold text-center mb-8">
    🌞 Sunshine
  </h1>

  <div className="flex items-center justify-between">

    <div>
      <h2 className="text-3xl font-semibold">
        Good Morning, Bob
      </h2>

      <p className="text-gray-500 mt-1">
        Friday, July 3, 2026
      </p>
    </div>

    {!isCapturing && (
      <button
        onClick={() => setIsCapturing(true)}
        className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded-2xl shadow-lg text-xl"
      >
        + Capture
      </button>
    )}

  </div>

</section>

  <div className="bg-white rounded-2xl shadow p-6 text-left mb-8">
    <p className="italic text-lg mb-6">
      "Good morning, Sunshine."
    </p>

    <h3 className="font-bold text-xl mb-2">🎯 Today's Focus</h3>
    <ul className="list-disc ml-6 mb-6">
      <li>Build Sunshine Alpha</li>
      <li>Create Shared Spaces</li>
      <li>Test Capture and Vault</li>
      <li>Continue ADG Scotland Landing Page</li>
      <li>Evaluate Atlas opportunities</li>
    </ul>

    <h3 className="font-bold text-xl mb-2">🌟 Yesterday's Win</h3>
    <p className="mb-6">
      Sunshine moved from idea mode into real working software.
    </p>

    <h3 className="font-bold text-xl mb-2">💡 AI Insight</h3>
    <p>
      Shared Spaces may become Sunshine's biggest differentiator:
      not just shared files, but shared understanding.
    </p>
  </div>



        <section className="mt-10 bg-white rounded-2xl shadow p-5">
          <h2 className="text-2xl font-semibold mb-4">Spaces</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {defaultSpaces.map((space) => (
              <div
                key={space.id}
                className={`${space.color} rounded-xl p-3 text-center shadow-sm`}
              >
                <div className="text-2xl">{space.icon}</div>
                <div className="font-semibold">{space.name}</div>
                {space.isShared && (
                  <div className="text-xs mt-1 text-gray-600">Shared</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {isCapturing && (
          <section className="mt-8 bg-white p-6 rounded-2xl shadow-lg">
            <label className="block text-lg font-semibold mb-3">
              What would you like to capture?
            </label>

            <textarea
              value={captureText}
              onChange={(event) => setCaptureText(event.target.value)}
              className="w-full border border-gray-300 rounded-xl p-4 min-h-32 text-lg"
              placeholder="I made progress on Sunshine today."
              autoFocus
            />

            <div className="mt-5">
              <h3 className="font-semibold mb-3">Choose Spaces</h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {defaultSpaces.map((space) => {
                  const isSelected = selectedSpaceIds.includes(space.id);

                  return (
                    <button
                      key={space.id}
                      onClick={() => toggleSpace(space.id)}
                      className={`rounded-xl p-3 text-center border-2 ${
                        isSelected
                          ? "border-yellow-500 bg-yellow-100"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="text-2xl">{space.icon}</div>
                      <div className="font-semibold">{space.name}</div>
                      {space.isShared && (
                        <div className="text-xs mt-1 text-gray-600">Shared</div>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="text-sm text-gray-500 mt-3">
                Selected:{" "}
                {selectedSpaces.map((space) => `${space.icon} ${space.name}`).join(", ")}
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveCapture}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-xl"
              >
                Save
              </button>

              <button
                onClick={() => {
                  setIsCapturing(false);
                  setCaptureText("");
                  setSelectedSpaceIds(["personal"]);
                }}
                className="bg-gray-200 hover:bg-gray-300 text-black font-bold py-3 px-6 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        <section className="mt-12 text-center w-full">
          <h2 className="text-2xl font-semibold mb-2">Your Vault</h2>

          {captures.length === 0 ? (
            <p className="text-gray-600">No captures yet.</p>
          ) : (
            <div className="space-y-3 mt-4">
              {captures.map((capture) => (
                <div
                  key={capture.id}
                  className="bg-white rounded-xl shadow p-4 text-left"
                >
                  <p className="text-lg">{capture.text}</p>

                  <p className="text-sm text-yellow-700 font-semibold mt-3">
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
                    <span className="text-xs bg-yellow-100 px-2 py-1 rounded-full">
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
                    {capture.createdAt}
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