import type { Capture } from "./captures";

const categoryPriority = ["Task", "Achievement", "Work", "Memory"];

const oneLinerByCategory: Record<string, string> = {
  Task: "Mostly to-dos and reminders.",
  Achievement: "Full of recent wins.",
  Work: "Notes from work.",
  Memory: "Personal reflections and notes.",
};

const fallbackBySpace: Record<string, string> = {
  personal: "Everyday life, at a glance.",
  health: "Tracking how you're feeling.",
  family: "Moments with the people you love.",
  finance: "Keeping tabs on money matters.",
  ideas: "Sparks worth coming back to.",
  travel: "Plans and memories from the road.",
  recipes: "Something delicious to try.",
  shared: "Shared with your circle.",
};

export function summarizeSpace(
  captures: Capture[],
  spaceId?: string
): { count: number; oneLiner: string } {
  const count = captures.length;

  if (count === 0) {
    return { count: 0, oneLiner: "" };
  }

  const hasUrgent = captures.some((capture) => capture.tags?.includes("urgent"));
  if (hasUrgent) {
    return { count, oneLiner: "⚠️ Something urgent needs attention." };
  }

  const counts: Record<string, number> = {};
  for (const capture of captures) {
    counts[capture.category] = (counts[capture.category] ?? 0) + 1;
  }

  let dominant = categoryPriority[0];
  let bestCount = -1;

  for (const category of categoryPriority) {
    const current = counts[category] ?? 0;
    if (current > bestCount) {
      bestCount = current;
      dominant = category;
    }
  }

  const oneLiner =
    dominant === "Memory"
      ? (spaceId && fallbackBySpace[spaceId]) || oneLinerByCategory.Memory
      : oneLinerByCategory[dominant] ?? oneLinerByCategory.Memory;

  return { count, oneLiner };
}
