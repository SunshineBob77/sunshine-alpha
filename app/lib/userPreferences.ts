import { supabase } from "./supabaseClient";

export type UserPreferences = {
  dailyBriefEnabled: boolean;
};

type UserPreferencesRow = {
  daily_brief_enabled: boolean;
};

function mapRow(row: UserPreferencesRow): UserPreferences {
  return {
    dailyBriefEnabled: row.daily_brief_enabled,
  };
}

// Row-per-user, created on first read - mirrors getOrCreateShare's
// select-then-insert-with-race-fallback pattern in shares.ts.
export async function getOrCreateUserPreferences(userId: string): Promise<UserPreferences> {
  const { data: existing, error: selectError } = await supabase
    .from("user_preferences")
    .select("daily_brief_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return mapRow(existing as UserPreferencesRow);

  const { data: inserted, error: insertError } = await supabase
    .from("user_preferences")
    .insert({ user_id: userId })
    .select("daily_brief_enabled")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raceWinner, error: raceError } = await supabase
        .from("user_preferences")
        .select("daily_brief_enabled")
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
  if (patch.dailyBriefEnabled !== undefined) update.daily_brief_enabled = patch.dailyBriefEnabled;

  const { error } = await supabase.from("user_preferences").update(update).eq("user_id", userId);
  if (error) throw error;
}
