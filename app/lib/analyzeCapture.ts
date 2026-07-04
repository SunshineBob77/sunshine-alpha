const spaceKeywords: [string, string[]][] = [
  [
    "health",
    ["doctor", "workout", "gym", "exercise", "run", "diet", "sleep", "medicine", "appointment", "therapy", "sick", "pain", "health"],
  ],
  ["family", ["family", "mom", "dad", "kids", "son", "daughter", "wife", "husband", "parents", "birthday", "school"]],
  ["finance", ["money", "bill", "budget", "bank", "invoice", "payment", "tax", "finance", "expense", "rent", "mortgage", "savings"]],
  ["travel", ["flight", "trip", "vacation", "hotel", "airport", "passport", "travel", "itinerary", "packing"]],
  ["ideas", ["idea", "concept", "brainstorm", "invention", "someday", "vision"]],
  [
    "work",
    ["work", "job", "meeting", "client", "boss", "office", "project", "deadline", "software", "code", "coding", "uber", "driving", "ride", "shift", "email"],
  ],
];

const urgentKeywords = ["urgent", "asap", "important", "emergency", "deadline", "critical"];

function guessSpaceId(lowerText: string): string {
  for (const [spaceId, keywords] of spaceKeywords) {
    if (keywords.some((keyword) => lowerText.includes(keyword))) return spaceId;
  }
  return "personal";
}

export function analyzeCapture(text: string) {
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

  if (urgentKeywords.some((keyword) => lowerText.includes(keyword)) && !tags.includes("urgent")) {
    tags = [...tags, "urgent"];
  }

  const spaceId = guessSpaceId(lowerText);

  return {
    category,
    project,
    tags,
    mood,
    sunshineSummary,
    spaceId,
  };
}
