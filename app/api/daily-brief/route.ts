// TODO(auth): trusts caller-supplied userId, no session validation - same
// posture as analyze-drop and the old morning-brief route this replaces.
// Needs real auth before beta (Harvard Boxing Club rollout = real attack
// surface).
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  SUNSHINE_DROP_CATEGORY,
  DAILY_BRIEF_ACTIVITY_TYPE,
  DAILY_BRIEF_SPACES_TYPE,
  DAILY_BRIEF_CATEGORIES_TYPE,
  DAILY_BRIEF_COMPLETION_TYPE,
  DAILY_BRIEF_SYSTEM_DROP_TYPES,
  LEGACY_DAILY_BRIEF_SYSTEM_DROP_TYPE,
} from "@/app/lib/systemDrops";
import { buildDailyBriefContent, type DailyBriefSpaceActivity } from "@/app/lib/dailyBrief";
import {
  computeSpaceDropCounts,
  computeCategoryCounts,
  computeCompletionStats,
  buildDailyBriefSpacesContent,
  buildDailyBriefCategoriesContent,
  buildDailyBriefCompletionContent,
  type StatsCapture,
  type StatsSharedSpace,
} from "@/app/lib/dailyBriefStats";

// Raw shape of a get_daily_brief_activity() row (docs/daily-brief-schema.sql) -
// snake_case, as returned by supabaseAdmin.rpc.
type DailyBriefActivityRow = {
  space_id: string;
  space_name: string;
  space_icon: string;
  space_color: string;
  activity: { type: string; count: number }[];
  sole_actor_name: string | null;
};

function mapActivityRow(row: DailyBriefActivityRow): DailyBriefSpaceActivity {
  return {
    spaceId: row.space_id,
    spaceName: row.space_name,
    spaceIcon: row.space_icon,
    spaceColor: row.space_color,
    activity: row.activity,
    soleActorName: row.sole_actor_name,
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, localDate } = body as { userId?: string; localDate?: string };

  if (!userId || !localDate) {
    return NextResponse.json({ error: "Missing userId or localDate" }, { status: 400 });
  }

  try {
    const { data: prefs, error: prefsError } = await supabaseAdmin
      .from("user_preferences")
      .select("daily_brief_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (prefsError) throw prefsError;

    // No row yet means the default (enabled) - mirrors the column default
    // in the schema, so a user who's never touched /me still gets a brief.
    const briefEnabled = prefs?.daily_brief_enabled ?? true;

    if (!briefEnabled) {
      return NextResponse.json({ skipped: true });
    }

    // Archive any prior day's unarchived brief regardless of whether
    // we're about to generate a new one - cheap, defensive, always safe
    // (a conditional UPDATE affecting 0 rows most of the time). Sweeps
    // the legacy single-card type too, so anyone whose already-generated
    // single-card brief predates the carousel rework doesn't keep it
    // sitting alongside the new 4-card group forever.
    await supabaseAdmin
      .from("captures")
      .update({ archived_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("source", "system")
      .in("system_drop_type", [...DAILY_BRIEF_SYSTEM_DROP_TYPES, LEGACY_DAILY_BRIEF_SYSTEM_DROP_TYPE])
      .is("archived_at", null)
      .neq("generated_for_date", localDate);

    // Once/day cadence: if all 4 cards already exist for today, this is a
    // repeat open of the same calendar day - return them as-is, nothing
    // here has a time-of-day dependency that would need refreshing.
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("captures")
      .select("*")
      .eq("user_id", userId)
      .eq("source", "system")
      .eq("generated_for_date", localDate)
      .in("system_drop_type", DAILY_BRIEF_SYSTEM_DROP_TYPES);

    if (existingError) throw existingError;

    if ((existingRows ?? []).length === DAILY_BRIEF_SYSTEM_DROP_TYPES.length) {
      return NextResponse.json({ captures: existingRows });
    }

    // Read the CURRENT last_visited_at before touching it - this is the
    // cutoff the Activity card is computed against. Advancing it only
    // happens after a successful generation (below), so a failed
    // generation never silently loses visibility into activity that
    // happened in this window.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("last_visited_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    // Defensive fallback only - every user gets a profiles row via the
    // handle_new_user trigger, and last_visited_at is backfilled/defaulted
    // to now() for all of them (see docs/daily-brief-schema.sql), so this
    // should never actually be null in practice.
    const since = profile?.last_visited_at ?? new Date(0).toISOString();

    const { data: activityRows, error: activityError } = await supabaseAdmin.rpc(
      "get_daily_brief_activity",
      { p_user_id: userId, p_since: since }
    );

    if (activityError) throw activityError;

    const activitySpaces = ((activityRows ?? []) as DailyBriefActivityRow[]).map(mapActivityRow);

    // The 3 stat cards are frozen/server-computed now, same as every
    // other system Drop - see dailyBriefStats.ts's header for why this
    // reverses an earlier same-night iteration that computed them live,
    // client-side, on every render. Fetched here rather than reusing the
    // browser-client-coupled fetchCaptures()/fetchMySpaces() - this is a
    // server route with an arbitrary userId, not "the current session".
    const { data: ownCaptureRows, error: ownCapturesError } = await supabaseAdmin
      .from("captures")
      .select("user_id, source, category, space_ids, status")
      .eq("user_id", userId)
      .eq("source", "user");

    if (ownCapturesError) throw ownCapturesError;

    const statsCaptures: StatsCapture[] = (ownCaptureRows ?? []).map((row) => ({
      userId: row.user_id,
      source: row.source,
      category: row.category,
      spaceIds: row.space_ids ?? [],
      status: row.status,
    }));

    const { data: memberRows, error: memberError } = await supabaseAdmin
      .from("space_members")
      .select("space_id")
      .eq("user_id", userId)
      .is("removed_at", null);

    if (memberError) throw memberError;

    const sharedSpaceIds = (memberRows ?? []).map((row) => row.space_id as string);
    let statsSharedSpaces: StatsSharedSpace[] = [];

    if (sharedSpaceIds.length > 0) {
      const { data: spaceRows, error: spaceError } = await supabaseAdmin
        .from("spaces")
        .select("id, name, icon")
        .in("id", sharedSpaceIds);

      if (spaceError) throw spaceError;
      statsSharedSpaces = spaceRows ?? [];
    }

    const spaceCounts = computeSpaceDropCounts(statsCaptures, userId, statsSharedSpaces);
    const categoryCounts = computeCategoryCounts(statsCaptures, userId);
    const completionStats = computeCompletionStats(statsCaptures, userId);

    // One fresh group_id per day, shared by all 4 rows - the whole point
    // is that LifelineFeed.tsx's grouping pass (see groupByGroupId) picks
    // these up and renders them as one DropGroupCarousel, exactly the
    // same mechanism Card Carousel v2 already uses for user Drops.
    const groupId = randomUUID();

    const baseRow = {
      user_id: userId,
      category: SUNSHINE_DROP_CATEGORY,
      project: "",
      tags: [],
      mood: "",
      space_ids: [],
      is_actionable: false,
      source: "system",
      generated_for_date: localDate,
      group_id: groupId,
    };

    const activityTitle = "Daily Brief · Activity";
    const activityContent = buildDailyBriefContent(activitySpaces);

    const spacesTitle = "Daily Brief · Spaces";
    const spacesContent = buildDailyBriefSpacesContent(statsSharedSpaces.length, spaceCounts);

    const categoriesTitle = "Daily Brief · Categories";
    const categoriesContent = buildDailyBriefCategoriesContent(categoryCounts);

    const completionTitle = "Daily Brief · Completion";
    const completionContent = buildDailyBriefCompletionContent(completionStats);

    // Listed in the order they should read left-to-right in the
    // carousel - a single multi-row INSERT/UPSERT assigns each row's
    // auto-incrementing id in this same order, which is what
    // LifelineFeed.tsx's groupByGroupId sorts by as a tiebreaker (all 4
    // rows can share the exact same created_at, since Postgres's now()
    // is stable within one statement).
    const rows = [
      {
        ...baseRow,
        text: activityContent,
        formatted_text: activityContent,
        title: activityTitle,
        sunshine_summary: activityTitle,
        system_drop_type: DAILY_BRIEF_ACTIVITY_TYPE,
        daily_brief_activity: activitySpaces,
        daily_brief_stats: null,
      },
      {
        ...baseRow,
        text: spacesContent,
        formatted_text: spacesContent,
        title: spacesTitle,
        sunshine_summary: spacesTitle,
        system_drop_type: DAILY_BRIEF_SPACES_TYPE,
        daily_brief_activity: null,
        daily_brief_stats: {
          kind: "spaces",
          sharedSpaceCount: statsSharedSpaces.length,
          items: spaceCounts,
        },
      },
      {
        ...baseRow,
        text: categoriesContent,
        formatted_text: categoriesContent,
        title: categoriesTitle,
        sunshine_summary: categoriesTitle,
        system_drop_type: DAILY_BRIEF_CATEGORIES_TYPE,
        daily_brief_activity: null,
        daily_brief_stats: { kind: "categories", items: categoryCounts },
      },
      {
        ...baseRow,
        text: completionContent,
        formatted_text: completionContent,
        title: completionTitle,
        sunshine_summary: completionTitle,
        system_drop_type: DAILY_BRIEF_COMPLETION_TYPE,
        daily_brief_activity: null,
        daily_brief_stats: { kind: "completion", ...completionStats },
      },
    ];

    // ignoreDuplicates so a concurrent request that already inserted some
    // of today's 4 rows between our existence check and this upsert just
    // fills in whatever's still missing, rather than erroring - no 23505
    // race-catch needed the way the old single-row insert had.
    const { error: upsertError } = await supabaseAdmin
      .from("captures")
      .upsert(rows, {
        onConflict: "user_id,generated_for_date,system_drop_type",
        ignoreDuplicates: true,
      });

    if (upsertError) throw upsertError;

    // Re-select rather than trusting the upsert's own response - with
    // ignoreDuplicates, Postgres's RETURNING only reflects newly-inserted
    // rows, not ones skipped as pre-existing duplicates, so a partial-race
    // scenario needs a fresh read to return the true, complete set of 4.
    const { data: finalRows, error: finalError } = await supabaseAdmin
      .from("captures")
      .select("*")
      .eq("user_id", userId)
      .eq("source", "system")
      .eq("generated_for_date", localDate)
      .in("system_drop_type", DAILY_BRIEF_SYSTEM_DROP_TYPES)
      .order("id", { ascending: true });

    if (finalError) throw finalError;

    // Advance the read-pointer now that generation actually succeeded.
    const { error: visitedError } = await supabaseAdmin
      .from("profiles")
      .update({ last_visited_at: new Date().toISOString() })
      .eq("id", userId);

    if (visitedError) console.error("Couldn't advance last_visited_at", visitedError);

    return NextResponse.json({ captures: finalRows });
  } catch (error) {
    console.error("daily-brief generation failed", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
