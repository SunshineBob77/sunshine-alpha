"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useCaptures } from "@/app/lib/DashboardContext";
import {
  getOrCreateUserPreferences,
  updateUserPreferences,
  type UserPreferences,
} from "@/app/lib/userPreferences";

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-amber-400" : "bg-gray-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function MePage() {
  const { user } = useCaptures();
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";

  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrCreateUserPreferences(user.id).then((data) => {
      if (!cancelled) setPrefs(data);
    });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  async function togglePref(key: keyof UserPreferences) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await updateUserPreferences(user.id, { [key]: next[key] });
  }

  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight text-gray-900">Me</h1>

        <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-center">
          <div className="text-4xl mb-3">🙂</div>
          <p className="text-xl font-semibold text-gray-900">{name}</p>
          <p className="text-gray-500 mt-1">{user.email}</p>

          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-6 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3 px-6 rounded-xl transition-all"
          >
            Log out
          </button>
        </section>

        {prefs && (
          <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 mt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Morning Brief</h2>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">Daily Morning Brief</p>
                <p className="text-sm text-gray-500">
                  A greeting, today &amp; tomorrow&apos;s weather, waiting for you each day.
                </p>
              </div>
              <Toggle
                checked={prefs.morningBriefEnabled}
                onChange={() => togglePref("morningBriefEnabled")}
              />
            </div>

            <div className="flex items-center justify-between gap-4 mt-5 pt-5 border-t border-black/5">
              <div>
                <p className="font-semibold text-gray-900">Include a daily quote</p>
                <p className="text-sm text-gray-500">A short Stoic quote alongside the weather.</p>
              </div>
              <Toggle
                checked={prefs.morningBriefQuoteEnabled}
                onChange={() => togglePref("morningBriefQuoteEnabled")}
                disabled={!prefs.morningBriefEnabled}
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
