"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { fetchThemePreference, updateThemePreference, type ThemePreference } from "./theme";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// Unified light/dark theme v1. Defaults to "dark" (matches
// profiles.theme_preference's own DB default and globals.css's
// unstyled-default token values, see that file) until the real
// preference loads from the profile, so there's never a flash-to-light
// on mount.
//
// Sets a `data-theme` attribute on <html>, not a `.dark`/`.light` class +
// Tailwind's @custom-variant dark mechanism - see globals.css for why:
// this app does full token-level color swapping (bg-night/text-ink/etc.
// resolve differently per theme automatically), not per-utility `dark:`
// prefixing, so a plain attribute selector is all the CSS side needs.
export function ThemeProvider({ user, children }: { user: User; children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("dark");

  useEffect(() => {
    let cancelled = false;
    fetchThemePreference(user.id)
      .then((value) => {
        if (!cancelled) setThemeState(value);
      })
      .catch((error) => console.error("Couldn't load theme preference", error));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Optimistic - flips the attribute (and every token-driven color in the
  // app) immediately, then persists. A failed write leaves the UI on the
  // new theme with the DB out of sync until the next successful toggle;
  // acceptable for a preference this low-stakes, consistent with how
  // Pin/Hide/etc. elsewhere in this app already update local state before
  // their write settles rather than waiting on a round-trip first.
  async function setTheme(next: ThemePreference) {
    setThemeState(next);
    await updateThemePreference(user.id, next);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
