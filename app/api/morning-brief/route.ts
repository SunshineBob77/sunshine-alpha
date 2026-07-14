// TODO(auth): trusts caller-supplied userId, no session validation - same
// posture as analyze-drop. Needs real auth before beta (Harvard Boxing Club
// rollout = real attack surface).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getQuoteOfTheDay } from "@/app/lib/quotes";
import { SUNSHINE_DROP_CATEGORY } from "@/app/lib/systemDrops";

const WAKEFIELD_LAT = 42.5042;
const WAKEFIELD_LON = -71.0728;

const weatherByCode: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mostly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Foggy", icon: "🌫️" },
  48: { label: "Freezing fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌨️" },
  67: { label: "Freezing rain", icon: "🌨️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "❄️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "🌨️" },
  80: { label: "Rain showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌦️" },
  82: { label: "Violent showers", icon: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Snow showers", icon: "🌨️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm, hail", icon: "⛈️" },
  99: { label: "Thunderstorm, hail", icon: "⛈️" },
};

function describeWeather(code: number) {
  return weatherByCode[code] ?? { label: "Unknown", icon: "🌡️" };
}

async function fetchWeather() {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${WAKEFIELD_LAT}&longitude=${WAKEFIELD_LON}&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=2`
  );
  if (!response.ok) throw new Error("Weather request failed");
  const data = await response.json();

  return {
    today: {
      code: data.daily.weather_code[0] as number,
      high: Math.round(data.daily.temperature_2m_max[0]),
      low: Math.round(data.daily.temperature_2m_min[0]),
    },
    tomorrow: {
      code: data.daily.weather_code[1] as number,
      high: Math.round(data.daily.temperature_2m_max[1]),
      low: Math.round(data.daily.temperature_2m_min[1]),
    },
  };
}

// No "Good night" bucket - a midnight-wrapping late-night window (e.g.
// 9pm-5am) is the more bug-prone way to express this and was the actual
// cause of the "Goodnight" mismatch this replaces (see below): anything
// outside morning/afternoon just reads as evening, all the way through
// to 5am.
function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

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

function buildBriefTitle(localHour: number, localDate: string, displayName: string | undefined): string {
  const namePart = displayName ? `, ${displayName}` : "";
  return `${greetingForHour(localHour)}${namePart} · ${formatDisplayDate(localDate)} ☀️`;
}

function buildBriefContent(
  weather: Awaited<ReturnType<typeof fetchWeather>>,
  quote: { text: string; author: string } | null
): string {
  const today = describeWeather(weather.today.code);
  const tomorrow = describeWeather(weather.tomorrow.code);

  let content = `**Today:** ${today.icon} ${weather.today.high}°/${weather.today.low}° — ${today.label}\n**Tomorrow:** ${tomorrow.icon} ${weather.tomorrow.high}°/${weather.tomorrow.low}° — ${tomorrow.label}`;

  if (quote) {
    content += `\n\n*"${quote.text}"* — ${quote.author}`;
  }

  return content;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, localDate, localHour, displayName } = body as {
    userId?: string;
    localDate?: string;
    localHour?: number;
    displayName?: string;
  };

  if (!userId || !localDate || typeof localHour !== "number") {
    return NextResponse.json({ error: "Missing userId, localDate, or localHour" }, { status: 400 });
  }

  try {
    const { data: prefs, error: prefsError } = await supabaseAdmin
      .from("user_preferences")
      .select("morning_brief_enabled, morning_brief_quote_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (prefsError) throw prefsError;

    // No row yet means defaults (both enabled) - mirrors the column defaults
    // in the schema, so a user who's never touched /me still gets a brief.
    const briefEnabled = prefs?.morning_brief_enabled ?? true;
    const quoteEnabled = prefs?.morning_brief_quote_enabled ?? true;

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
      .eq("system_drop_type", "morning_brief")
      .is("archived_at", null)
      .neq("generated_for_date", localDate);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("captures")
      .select("*")
      .eq("user_id", userId)
      .eq("source", "system")
      .eq("system_drop_type", "morning_brief")
      .eq("generated_for_date", localDate)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      // The greeting is time-of-day-dependent but the brief itself is
      // only generated once per calendar day (gated on generated_for_date
      // above) - without this, whatever hour happened to be current at
      // FIRST generation gets frozen into the stored title for the rest
      // of the day. The client sends a fresh, correct localHour on every
      // app load (see DashboardContext.tsx), so recompute against that on
      // every fetch and update the row if the greeting's gone stale,
      // rather than only ever setting it once at generation time.
      const freshTitle = buildBriefTitle(localHour, localDate, displayName);

      if (existing.title !== freshTitle) {
        const { data: refreshed, error: refreshError } = await supabaseAdmin
          .from("captures")
          .update({ title: freshTitle, sunshine_summary: freshTitle })
          .eq("id", existing.id)
          .select()
          .single();

        if (refreshError) throw refreshError;
        return NextResponse.json({ capture: refreshed });
      }

      return NextResponse.json({ capture: existing });
    }

    const weather = await fetchWeather();
    const quote = quoteEnabled ? getQuoteOfTheDay(new Date(localDate)) : null;
    const title = buildBriefTitle(localHour, localDate, displayName);
    const content = buildBriefContent(weather, quote);

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
        system_drop_type: "morning_brief",
        generated_for_date: localDate,
      })
      .select()
      .single();

    if (insertError) {
      // Race: another tab/request generated today's brief between our
      // existence check and this insert - the partial unique index caught
      // it, so re-select and return the winner instead of erroring.
      if (insertError.code === "23505") {
        const { data: raceWinner, error: raceError } = await supabaseAdmin
          .from("captures")
          .select("*")
          .eq("user_id", userId)
          .eq("source", "system")
          .eq("system_drop_type", "morning_brief")
          .eq("generated_for_date", localDate)
          .single();

        if (raceError) throw raceError;
        return NextResponse.json({ capture: raceWinner });
      }

      throw insertError;
    }

    return NextResponse.json({ capture: inserted });
  } catch (error) {
    console.error("morning-brief generation failed", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
