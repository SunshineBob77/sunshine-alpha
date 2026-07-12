import { supabase } from "./supabaseClient";

export type SpaceOverrides = Record<string, string>;

type OverrideRow = {
  space_id: string;
  custom_name: string;
};

// One row per renamed Space (no row = using the default name) - simpler
// than a get-or-create-with-defaults pattern like user_preferences, since
// "no override" is itself a valid, common, first-class state here rather
// than something needing a default row.
export async function fetchSpaceOverrides(userId: string): Promise<SpaceOverrides> {
  const { data, error } = await supabase
    .from("user_space_overrides")
    .select("space_id, custom_name")
    .eq("user_id", userId);

  if (error) throw error;

  const overrides: SpaceOverrides = {};
  for (const row of data as OverrideRow[]) {
    overrides[row.space_id] = row.custom_name;
  }
  return overrides;
}

export async function renameSpace(
  userId: string,
  spaceId: string,
  customName: string
): Promise<void> {
  const { error } = await supabase
    .from("user_space_overrides")
    .upsert(
      { user_id: userId, space_id: spaceId, custom_name: customName, updated_at: new Date().toISOString() },
      { onConflict: "user_id,space_id" }
    );

  if (error) throw error;
}
