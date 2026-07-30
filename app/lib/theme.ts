import { supabase } from "./supabaseClient";

export type ThemePreference = "light" | "dark";

// See docs/theme-preference-schema.sql. Falls back to "dark" (the
// column's own DB default) if the row somehow returns null/unexpected -
// mirrors the "dark until proven otherwise" default the CSS tokens
// themselves already use, rather than risking a light flash on a
// malformed read.
export async function fetchThemePreference(userId: string): Promise<ThemePreference> {
  const { data, error } = await supabase
    .from("profiles")
    .select("theme_preference")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data?.theme_preference === "light" ? "light" : "dark";
}

// Persisted to the user's profile row, not localStorage - deliberately,
// per the design spec, so the preference follows the user across
// devices rather than being per-browser state (unlike e.g. OnboardingTip's
// dismiss flag, which genuinely is meant to be local-only).
export async function updateThemePreference(userId: string, theme: ThemePreference): Promise<void> {
  const { error } = await supabase.from("profiles").update({ theme_preference: theme }).eq("id", userId);
  if (error) throw error;
}
