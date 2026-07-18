// Daily Brief v1 - shared types + plain-text formatting, used by
// app/api/daily-brief/route.ts to build both the structured
// daily_brief_activity column (rendered as tappable rows by
// DailyBriefContent.tsx, Lifeline-only) and the plain text/formatted_text
// fallback (everything else that renders a Drop's content as markdown -
// search results, the public share page, Ask's bare DropCard).
//
// {type, count} is deliberately a list, not hardcoded added/edited
// fields - a future "comments" activity type just needs a case in
// describeActivityCount below, no restructuring of the stored shape.
export type DailyBriefActivityCount = {
  type: string;
  count: number;
};

export type DailyBriefSpaceActivity = {
  spaceId: string;
  spaceName: string;
  spaceIcon: string;
  spaceColor: string;
  activity: DailyBriefActivityCount[];
  // Populated only when this Space's total activity count is exactly 1
  // (see get_daily_brief_activity in docs/daily-brief-schema.sql) - the
  // only case attribution is shown for, e.g. "1 new Drop from Mary".
  soleActorName: string | null;
};

function describeActivityCount({ type, count }: DailyBriefActivityCount): string {
  if (type === "added") return count === 1 ? "1 new Drop" : `${count} new Drops`;
  if (type === "edited") return count === 1 ? "1 edit" : `${count} edits`;
  // Extensible fallback for a future activity type that hasn't gotten its
  // own phrasing yet.
  return count === 1 ? `1 ${type}` : `${count} ${type}`;
}

export function formatDailyBriefSpaceLine(space: DailyBriefSpaceActivity): string {
  const parts = space.activity.map(describeActivityCount).join(", ");
  const totalCount = space.activity.reduce((sum, item) => sum + item.count, 0);
  const attribution = totalCount === 1 && space.soleActorName ? ` from ${space.soleActorName}` : "";
  return `${space.spaceName}: ${parts}${attribution}`;
}

export function buildDailyBriefContent(spaces: DailyBriefSpaceActivity[]): string {
  if (spaces.length === 0) {
    return "No new activity in your Shared Spaces since you were last here.";
  }
  return spaces.map(formatDailyBriefSpaceLine).join("\n");
}
