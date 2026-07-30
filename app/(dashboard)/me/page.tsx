"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useCaptures } from "@/app/lib/DashboardContext";
import { useTheme } from "@/app/lib/ThemeContext";
import { fetchTotalDropsCount } from "@/app/lib/captures";
import {
  getOrCreateUserPreferences,
  updateUserPreferences,
  type UserPreferences,
} from "@/app/lib/userPreferences";
import LifelineDropCard from "@/app/components/LifelineDropCard";
import DropCard from "@/app/components/DropCard";
import DropGroupCarousel from "@/app/components/DropGroupCarousel";
import DropDetailModal from "@/app/components/DropDetailModal";
import { groupCapturesByGroupId } from "@/app/lib/dropGroups";

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
        checked ? "bg-amber-400" : "bg-ink/10"
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

// Unified theme system v1 - reuses the exact Toggle + settings-section
// pattern "Daily Brief settings" below already established, rather than
// inventing new UI for this. setTheme persists to the profile
// immediately (see ThemeContext.tsx) - `saving` here just guards against
// a double-tap mid-write, same convention as AccountSection/Daily Brief
// settings' own save flows elsewhere in this file.
function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    try {
      await setTheme(theme === "dark" ? "light" : "dark");
    } catch (error) {
      console.error("Couldn't save theme preference", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-dusk rounded-3xl ring-1 ring-ink/10 shadow-sm p-7 mt-6">
      <h2 className="text-lg font-bold text-ink mb-4">Appearance</h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-ink">Dark Mode</p>
          <p className="text-sm text-ink-dim">
            Switch between light and dark throughout Sunshine.
          </p>
        </div>
        <Toggle checked={theme === "dark"} onChange={handleToggle} disabled={saving} />
      </div>
    </section>
  );
}

// Total Drops stat v1 - warm/narrative phrasing to match the existing
// Daily Brief cards' tone (e.g. DailyBriefSpacesContent's "You're a
// member of N Shared Spaces."), not a bare number.
function TotalDropsContent({ count }: { count: number }) {
  return (
    <p className="text-ink-dim leading-relaxed">
      You&apos;ve captured {count} Drop{count === 1 ? "" : "s"} so far.
    </p>
  );
}

// Daily Brief v1 - relocated here from the Lifeline (see
// app/components/LifelineFeed.tsx, which no longer renders source='system'
// captures at all). Same 4 linked system Drops, same generation/content
// logic (app/api/daily-brief/route.ts, fired fire-and-forget from
// DashboardContext on every app load, entirely unrelated to where the
// result is displayed) - only the display location and the card's visual
// theme (light here, vs. dark on the Lifeline) changed.
//
// Total Drops stat v1 added alongside it here, as a 5th slide in the same
// carousel - deliberately NOT a server-generated Daily Brief system Drop
// like the other 4: those are frozen "since your last visit" snapshots by
// design, but a lifetime total needs no such freezing, so it's computed
// live client-side instead (fetchTotalDropsCount, a direct count query -
// the already-loaded `captures` array excludes archived Drops entirely
// and would undercount). Positioned first - a simple, always-current
// "here's your total" opener before the more detailed since-last-visit
// breakdowns.
function StatsSection({
  onSelectCapture,
}: {
  onSelectCapture: (id: number) => void;
}) {
  const { captures, user, updateStatus, hideCapture, archiveCapture, undoCaptureState } =
    useCaptures();
  const router = useRouter();
  const [totalDrops, setTotalDrops] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTotalDropsCount(user.id)
      .then((count) => {
        if (!cancelled) setTotalDrops(count);
      })
      .catch((error) => console.error("Couldn't load total Drops count", error));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const dailyBriefCaptures = captures.filter(
    (capture) => capture.source === "system" && capture.userArchivedAt === null
  );

  function renderDailyBriefCard(capture: (typeof dailyBriefCaptures)[number]) {
    return (
      <LifelineDropCard
        key={capture.id}
        capture={capture}
        // Unified theme system v1 - "dark" is the token-driven path (see
        // DropCard.tsx's variant doc comment), correct for any
        // authenticated screen regardless of the user's actual chosen
        // theme. Was hardcoded "light" (a fixed, theme-independent
        // appearance) back when Me was itself permanently light.
        variant="dark"
        onSelect={onSelectCapture}
        onToggleStatus={() =>
          updateStatus(capture.id, capture.status === "completed" ? "active" : "completed")
        }
        onToggleHide={() => hideCapture(capture.id)}
        onArchive={() => archiveCapture(capture.id)}
        onUndo={() => undoCaptureState(capture.id)}
        onNavigateToSpace={(spaceId) => router.push(`/?space=${spaceId}`)}
      />
    );
  }

  const totalDropsSlide =
    totalDrops !== null ? (
      <DropCard
        key="total-drops"
        variant="dark"
        title="✨ Total Drops"
        spaceId={null}
        content=""
        createdAt={new Date().toISOString()}
        hideTimestamp
        clipped={false}
        customContent={<TotalDropsContent count={totalDrops} />}
      />
    ) : null;

  // Daily Brief disabled/not generated yet - Total Drops still stands on
  // its own (it doesn't depend on Daily Brief at all), no carousel needed
  // for a single slide.
  if (dailyBriefCaptures.length === 0) {
    return totalDropsSlide ? <div className="mt-6">{totalDropsSlide}</div> : null;
  }

  const groups = groupCapturesByGroupId(dailyBriefCaptures);

  return (
    <div className="mt-6 space-y-3">
      {groups.map(({ key, members }, index) => {
        // Only ever one Daily Brief group per day in practice (route.ts
        // archives the prior day's before generating a new one) - Total
        // Drops rides along with whichever group renders first so it's
        // never duplicated across groups in the (currently unreachable)
        // multi-group edge case.
        const slides =
          index === 0 && totalDropsSlide
            ? [totalDropsSlide, ...members.map(renderDailyBriefCard)]
            : members.map(renderDailyBriefCard);

        return slides.length > 1 ? (
          <DropGroupCarousel key={key} slides={slides} />
        ) : (
          slides[0]
        );
      })}
    </div>
  );
}

// Account section v2 - collapsed to a compact avatar + name row by
// default (people rarely touch email/log-out, so this shouldn't compete
// with Stats/Daily Brief for attention at the top of the page). "Manage
// account" reveals email + Log out inline - same expand-in-place pill
// pattern already used elsewhere (e.g. DropDetailModal's SpacePicker
// "+ Add to Space"/"Done" toggle), not a new component/pattern.
function AccountSection({ name, email }: { name: string; email: string | undefined }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="bg-dusk rounded-2xl ring-1 ring-ink/10 shadow-sm p-4 mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">🙂</span>
          <p className="font-semibold text-ink truncate">{name}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-2.5 py-1 rounded-full transition-all shrink-0"
        >
          {expanded ? "Done" : "Manage account"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-ink/10 text-center">
          <p className="text-ink-dim">{email}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-4 bg-ink/5 hover:bg-ink/10 text-ink font-bold py-3 px-6 rounded-xl transition-all"
          >
            Log out
          </button>
        </div>
      )}
    </section>
  );
}

export default function MePage() {
  const { user, captures } = useCaptures();
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";

  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? null;

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
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight text-ink">Me</h1>

        <StatsSection onSelectCapture={setSelectedCaptureId} />

        {prefs && (
          <section className="bg-dusk rounded-3xl ring-1 ring-ink/10 shadow-sm p-7 mt-6">
            <h2 className="text-lg font-bold text-ink mb-4">Daily Brief settings</h2>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">Daily Brief</p>
                <p className="text-sm text-ink-dim">
                  A summary of what&apos;s new across your Shared Spaces, waiting for you each day.
                </p>
              </div>
              <Toggle
                checked={prefs.dailyBriefEnabled}
                onChange={() => togglePref("dailyBriefEnabled")}
              />
            </div>
          </section>
        )}

        <AppearanceSection />

        <AccountSection name={name} email={user.email} />
      </div>

      {selectedCapture && (
        <DropDetailModal capture={selectedCapture} onClose={() => setSelectedCaptureId(null)} />
      )}
    </main>
  );
}
