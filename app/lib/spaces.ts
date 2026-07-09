export type Space = {
  id: string;
  name: string;
  icon: string;
  color: string;
  border: string;
  isShared: boolean;
};

export const defaultSpaces: Space[] = [
  { id: "personal", name: "Personal", icon: "🏠", color: "bg-yellow-100", border: "border-yellow-400", isShared: false },
  { id: "work", name: "Work", icon: "💼", color: "bg-blue-100", border: "border-blue-400", isShared: false },
  { id: "health", name: "Health", icon: "❤️", color: "bg-red-100", border: "border-red-400", isShared: false },
  { id: "family", name: "Family", icon: "👪", color: "bg-green-100", border: "border-green-400", isShared: false },
  { id: "finance", name: "Finance", icon: "💰", color: "bg-emerald-100", border: "border-emerald-400", isShared: false },
  { id: "ideas", name: "Ideas", icon: "💡", color: "bg-purple-100", border: "border-purple-400", isShared: false },
  { id: "travel", name: "Travel", icon: "✈️", color: "bg-sky-100", border: "border-sky-400", isShared: false },
  { id: "recipes", name: "Recipes", icon: "🍳", color: "bg-orange-100", border: "border-orange-400", isShared: false },
  { id: "shared", name: "Shared Space", icon: "👥", color: "bg-pink-100", border: "border-pink-400", isShared: true },
];
