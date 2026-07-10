import { defaultSpaces } from "./spaces";

export const unassignedSpaceTone = {
  name: "Unsorted",
  icon: "📦",
  color: "bg-gray-100",
  border: "border-gray-300",
};

export function getSpaceTone(spaceId: string | null | undefined) {
  const space = defaultSpaces.find((candidate) => candidate.id === spaceId);
  return space ?? unassignedSpaceTone;
}
