import { supabase } from "./supabaseClient";

export type UserPreferences = {
  morningBriefEnabled: boolean;
  morningBriefQuoteEnabled: boolean;
};

type UserPreferencesRow = {
  morning_brief_enabled: boolean;
  morning_brief_quote_enabled: boolean;
};

function mapRow(row: UserPreferencesRow): UserPreferences {
  return {
    morningBriefEnabled: row.morning_brief_enabled,
    morningBriefQuoteEnabled: row.morning_brief_quote_enabled,
  };
}

// Row-per-user, created on first read - mirrors getOrCreateShare's
// select-then-insert-with-race-fallback pattern in shares.ts.
export async function getOrCreateUserPreferences(userId: string): Promise<UserPreferences> {
  const { data: existing, error: selectError } = await supabase
    .from("user_preferences")
    .select("morning_brief_enabled, morning_brief_quote_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return mapRow(existing as UserPreferencesRow);

  const { data: inserted, error: insertError } = await supabase
    .from("user_preferences")
    .insert({ user_id: userId })
    .select("morning_brief_enabled, morning_brief_quote_enabled")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raceWinner, error: raceError } = await supabase
        .from("user_preferences")
        .select("morning_brief_enabled, morning_brief_quote_enabled")
        .eq("user_id", userId)
        .single();

      if (raceError) throw raceError;
      return mapRow(raceWinner as UserPreferencesRow);
    }

    throw insertError;
  }

  return mapRow(inserted as UserPreferencesRow);
}

export async function updateUserPreferences(
  userId: string,
  patch: Partial<UserPreferences>
): Promise<void> {
  const update: Partial<UserPreferencesRow> = {};
  if (patch.morningBriefEnabled !== undefined) update.morning_brief_enabled = patch.morningBriefEnabled;
  if (patch.morningBriefQuoteEnabled !== undefined)
    update.morning_brief_quote_enabled = patch.morningBriefQuoteEnabled;

  const { error } = await supabase.from("user_preferences").update(update).eq("user_id", userId);
  if (error) throw error;
}
