const categoryTone: Record<string, { icon: string; bg: string; dot: string; border: string }> = {
  Achievement: { icon: "🌟", bg: "bg-emerald-100", dot: "bg-emerald-400", border: "border-emerald-400" },
  Work: { icon: "💼", bg: "bg-blue-100", dot: "bg-blue-400", border: "border-blue-400" },
  Task: { icon: "🎯", bg: "bg-amber-100", dot: "bg-amber-400", border: "border-amber-400" },
  Memory: { icon: "💭", bg: "bg-purple-100", dot: "bg-purple-400", border: "border-purple-400" },
};

const fallbackTone = { icon: "🌞", bg: "bg-gray-100", dot: "bg-gray-300", border: "border-gray-300" };

export function getCategoryTone(category: string) {
  return categoryTone[category] ?? fallbackTone;
}
