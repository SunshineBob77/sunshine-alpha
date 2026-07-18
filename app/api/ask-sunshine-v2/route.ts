// TODO(auth): trusts caller-supplied userId, no session validation - same
// posture as analyze-drop and daily-brief.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { detectWorkoutQuery } from "@/app/lib/aggregationIntent";

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, query } = body as { userId?: string; query?: string };

  if (!userId || !query) {
    return NextResponse.json({ error: "Missing userId or query" }, { status: 400 });
  }

  // Re-derived from the raw query here, not trusted from the client -
  // this is what feeds the ilike pattern and date filter below, so it has
  // to come from the same source of truth on both sides (see
  // app/lib/aggregationIntent.ts's header).
  const intent = detectWorkoutQuery(query);
  if (!intent) {
    return NextResponse.json({ answer: null });
  }

  try {
    let dbQuery = supabaseAdmin
      .from("workout_entries")
      .select("rounds, total_duration_minutes")
      .eq("user_id", userId)
      .ilike("activity_type", `%${intent.activityQuery}%`);

    if (intent.dateRange) {
      dbQuery = dbQuery.gte("date", intent.dateRange.start).lt("date", intent.dateRange.end);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) {
      // No matching workout data - let the client fall back to the
      // generic "Found N matching Drops" synthesis instead.
      return NextResponse.json({ answer: null });
    }

    const total = rows.reduce((sum, row) => {
      const value = intent.metric === "rounds" ? row.rounds : row.total_duration_minutes;
      return sum + (value ?? 0);
    }, 0);

    const metricLabel =
      intent.metric === "rounds" ? (total === 1 ? "round" : "rounds") : "minutes";
    const rangeSuffix = intent.dateRange ? ` ${intent.dateRange.label}` : "";

    return NextResponse.json({ answer: `You did ${total} ${metricLabel}${rangeSuffix}.` });
  } catch (error) {
    console.error("ask-sunshine-v2 aggregation failed", error);
    return NextResponse.json({ error: "Aggregation failed" }, { status: 500 });
  }
}
