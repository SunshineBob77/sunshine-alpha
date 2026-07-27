"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useCaptures } from "@/app/lib/DashboardContext";
import {
  getOrCreateUserPreferences,
  updateUserPreferences,
  type UserPreferences,
} from "@/app/lib/userPreferences";
import LifelineDropCard from "@/app/components/LifelineDropCard";
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

// Daily Brief v1 - relocated here from the Lifeline (see
// app/components/LifelineFeed.tsx, which no longer renders source='system'
// captures at all). Same 4 linked system Drops, same generation/content
// logic (app/api/daily-brief/route.ts, fired fire-and-forget from
// DashboardContext on every app load, entirely unrelated to where the
// result is displayed) - only the display location and the card's visual
// theme (light here, vs. dark on the Lifeline) changed.
function DailyBriefSection({
  onSelectCapture,
}: {
  onSelectCapture: (id: number) => void;
}) {
  const { captures, updateStatus, hideCapture, archiveCapture, undoCaptureState } = useCaptures();
  const router = useRouter();

  const dailyBriefCaptures = captures.filter(
    (capture) => capture.source === "system" && capture.userArchivedAt === null
  );

  if (dailyBriefCaptures.length === 0) return null;

  function renderCard(capture: (typeof dailyBriefCaptures)[number]) {
    return (
      <LifelineDropCard
        key={capture.id}
        capture={capture}
        variant="light"
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

  return (
    <div className="mt-6 space-y-3">
      {groupCapturesByGroupId(dailyBriefCaptures).map(({ key, members }) =>
        members.length > 1 ? (
          <DropGroupCarousel key={key} slides={members.map(renderCard)} />
        ) : (
          renderCard(members[0])
        )
      )}
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
    <section className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-4 mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">🙂</span>
          <p className="font-semibold text-gray-900 truncate">{name}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-full transition-all shrink-0"
        >
          {expanded ? "Done" : "Manage account"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <p className="text-gray-500">{email}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-4 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3 px-6 rounded-xl transition-all"
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
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight text-gray-900">Me</h1>

        <DailyBriefSection onSelectCapture={setSelectedCaptureId} />

        {prefs && (
          <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 mt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Daily Brief settings</h2>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">Daily Brief</p>
                <p className="text-sm text-gray-500">
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

        <AccountSection name={name} email={user.email} />
      </div>

      {selectedCapture && (
        <DropDetailModal capture={selectedCapture} onClose={() => setSelectedCaptureId(null)} />
      )}
    </main>
  );
}
