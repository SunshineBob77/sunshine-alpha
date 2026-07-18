// TODO(auth): trusts caller-supplied userId, no session validation - same
// posture as analyze-drop and the old morning-brief route this replaces.
// Needs real auth before beta (Harvard Boxing Club rollout = real attack
// surface).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { SUNSHINE_DROP_CATEGORY, DAILY_BRIEF_SYSTEM_DROP_TYPE } from "@/app/lib/systemDrops";
import { buildDailyBriefContent, type DailyBriefSpaceActivity } from "@/app/lib/dailyBrief";

// localDate is "YYYY-MM-DD" - the user's own local calendar day, computed
// client-side (same value used for the idempotency key). Parsed and
// re-formatted in UTC specifically to avoid any day-shift from the
// server's own timezone, since a bare date-only string parses as UTC
// midnight per the ISO 8601 spec - formatting it back in UTC guarantees
// no shift regardless of what timezone the server happens to run in.
function formatDisplayDate(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  return date.toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

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

    // Archive any prior day's unarchived brief regardless of whether we're
    // about to generate a new one - cheap, defensive, always safe (a
    // conditional UPDATE affecting 0 rows most of the time).
    await supabaseAdmin
      .from("captures")
      .update({ archived_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("source", "system")
      .eq("system_drop_type", DAILY_BRIEF_SYSTEM_DROP_TYPE)
      .is("archived_at", null)
      .neq("generated_for_date", localDate);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("captures")
      .select("*")
      .eq("user_id", userId)
      .eq("source", "system")
      .eq("system_drop_type", DAILY_BRIEF_SYSTEM_DROP_TYPE)
      .eq("generated_for_date", localDate)
      .maybeSingle();

    if (existingError) throw existingError;
    // Once/day cadence (decided over the old Morning Brief's per-load
    // greeting refresh): the activity summary and the last_visited_at
    // advance it's built from both happen exactly once, at first
    // generation of the day - a repeat open of the same calendar day just
    // returns this cached row unchanged, nothing here has a time-of-day
    // dependency the way the old greeting title did.
    if (existing) {
      return NextResponse.json({ capture: existing });
    }

    // Read the CURRENT last_visited_at before touching it - this is the
    // cutoff the activity summary below is computed against. Advancing it
    // only happens after a successful generation (below), so a failed
    // insert never silently loses visibility into activity that happened
    // in this window.
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

    const spaces = ((activityRows ?? []) as DailyBriefActivityRow[]).map(mapActivityRow);
    const title = `Daily Brief · ${formatDisplayDate(localDate)}`;
    const content = buildDailyBriefContent(spaces);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("captures")
      .insert({
        user_id: userId,
        text: content,
        formatted_text: content,
        title,
        category: SUNSHINE_DROP_CATEGORY,
        project: "",
        tags: [],
        mood: "",
        sunshine_summary: title,
        space_ids: [],
        is_actionable: false,
        source: "system",
        system_drop_type: DAILY_BRIEF_SYSTEM_DROP_TYPE,
        generated_for_date: localDate,
        daily_brief_activity: spaces,
      })
      .select()
      .single();

    if (insertError) {
      // Race: another tab/request generated today's brief between our
      // existence check and this insert - the partial unique index caught
      // it, so re-select and return the winner instead of erroring. The
      // winner's own request path is what advances last_visited_at, so
      // this branch deliberately doesn't touch it again.
      if (insertError.code === "23505") {
        const { data: raceWinner, error: raceError } = await supabaseAdmin
          .from("captures")
          .select("*")
          .eq("user_id", userId)
          .eq("source", "system")
          .eq("system_drop_type", DAILY_BRIEF_SYSTEM_DROP_TYPE)
          .eq("generated_for_date", localDate)
          .single();

        if (raceError) throw raceError;
        return NextResponse.json({ capture: raceWinner });
      }

      throw insertError;
    }

    // Advance the read-pointer now that generation actually succeeded.
    const { error: visitedError } = await supabaseAdmin
      .from("profiles")
      .update({ last_visited_at: new Date().toISOString() })
      .eq("id", userId);

    if (visitedError) console.error("Couldn't advance last_visited_at", visitedError);

    return NextResponse.json({ capture: inserted });
  } catch (error) {
    console.error("daily-brief generation failed", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
