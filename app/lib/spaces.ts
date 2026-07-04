export type Space = {
  id: string;
  name: string;
  icon: string;
  color: string;
  isShared: boolean;
};

export const defaultSpaces: Space[] = [
  { id: "personal", name: "Personal", icon: "🏠", color: "bg-yellow-100", isShared: false },
  { id: "work", name: "Work", icon: "💼", color: "bg-blue-100", isShared: false },
  { id: "health", name: "Health", icon: "❤️", color: "bg-red-100", isShared: false },
  { id: "family", name: "Family", icon: "👨‍👩‍👧", color: "bg-green-100", isShared: false },
  { id: "finance", name: "Finance", icon: "💰", color: "bg-emerald-100", isShared: false },
  { id: "ideas", name: "Ideas", icon: "💡", color: "bg-purple-100", isShared: false },
  { id: "travel", name: "Travel", icon: "✈️", color: "bg-sky-100", isShared: false },
  { id: "shared", name: "Shared Space", icon: "👥", color: "bg-pink-100", isShared: true },
];
