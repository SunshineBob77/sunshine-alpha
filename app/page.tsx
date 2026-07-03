"use client";

import { useEffect, useState } from "react";

type Capture = {
  id: number;
  text: string;
  createdAt: string;
  category: string;
  project: string;
  tags: string[];
  mood: string;
  sunshineSummary: string;
};

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
    project = "Sunshine";
    mood = "Positive";
    tags = ["software", "coding", "progress"];
    sunshineSummary = "You made progress building Sunshine today. ☀️";
  }

  if (
    lowerText.includes("uber") ||
    lowerText.includes("driving") ||
    lowerText.includes("ride")
  ) {
    category = "Work";
    project = "Uber";
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
    project = "General";
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

  useEffect(() => {
    const saved = localStorage.getItem("sunshine-captures");

    if (saved) {
      setCaptures(JSON.parse(saved));
    }
  }, []);

  function saveCapture() {
    if (!captureText.trim()) return;

    const meaning = analyzeCapture(captureText);

    const newCapture: Capture = {
      id: Date.now(),
      text: captureText.trim(),
      createdAt: new Date().toLocaleString(),
      ...meaning,
    };

    const updatedCaptures = [newCapture, ...captures];

    setCaptures(updatedCaptures);
    localStorage.setItem("sunshine-captures", JSON.stringify(updatedCaptures));

    setCaptureText("");
    setIsCapturing(false);
  }

  return (
    <main className="min-h-screen bg-yellow-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-4">🌞 Sunshine</h1>

      <p className="text-2xl mb-8">Welcome, Bob.</p>

      {!isCapturing ? (
        <button
          onClick={() => setIsCapturing(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded-2xl shadow-lg text-xl"
        >
          + Capture
        </button>
      ) : (
        <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-lg">
          <label className="block text-lg font-semibold mb-3">
            What would you like to capture?
          </label>

          <textarea
            value={captureText}
            onChange={(event) => setCaptureText(event.target.value)}
            className="w-full border border-gray-300 rounded-xl p-4 min-h-32 text-lg"
            placeholder="I made some software today."
            autoFocus
          />

          <div className="flex gap-3 mt-4">
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
              }}
              className="bg-gray-200 hover:bg-gray-300 text-black font-bold py-3 px-6 rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-12 text-center w-full max-w-md">
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
      </div>
    </main>
  );
}