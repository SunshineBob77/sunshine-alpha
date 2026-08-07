"use client";

import { useMemo, useState } from "react";
import LifelineDropCard from "./LifelineDropCard";
import RemindersCard from "./RemindersCard";
import DropGroupCarousel from "./DropGroupCarousel";
import { useCaptures } from "@/app/lib/DashboardContext";
import { isAutoHidden } from "@/app/lib/autoHide";
import { groupCapturesByGroupId } from "@/app/lib/dropGroups";
import { NON_SPACE_FILTER_IDS } from "@/app/lib/spaces";
import type { Capture } from "@/app/lib/captures";

// Matches DropCard's own settle time, so the card doesn't get yanked out of
// the list mid-animation - it finishes its own "stay visible, then leave"
// sequence before the parent filter actually drops it.
const SETTLE_MS = 3000;

export default function LifelineFeed({
  captures,
  activeFilter,
  onSelectCapture,
  onOpenInvite,
}: {
  captures: Capture[];
  activeFilter: string;
  onSelectCapture: (id: number, options?: { edit?: boolean }) => void;
  // Shared-Space invite trigger v1 - passed straight through to
  // LifelineDropCard, which only actually uses it for a Drop whose
  // primary Space the viewer owns.
  onOpenInvite: (spaceId: string) => void;
}) {
  const { updateStatus, hideCapture, hideGroup, archiveCapture, undoCaptureState } = useCaptures();
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<number>>(new Set());

  // Archived is checked first and short-circuits every other branch (tucked
  // away everywhere except its own Space) except the Archived filter
  // itself. isHiddenNow only ever gates the literal "all" Lifeline view -
  // a hidden Drop stays fully visible in its own Space, and in the
  // Completed cross-cutting view, per spec. isHiddenNow itself is two
  // independent things ORed together: a manual hide (hiddenUntil is now
  // just a presence marker, not an expiry to compare against "now" - Hide
  // v2 has no duration) and a computed auto-hide for dated Drops more than
  // a week out (see isAutoHidden in autoHide.ts - purely derived, nothing
  // stored for this half).
  const filteredCaptures = useMemo(() => {
    return captures.filter((capture) => {
      if (pendingRemovalIds.has(capture.id)) return true;

      // Daily Brief v1 relocated to the Me screen (see
      // app/(dashboard)/me/page.tsx) - system Drops no longer have any
      // presence on the Lifeline at all, not even indirectly. Excluded
      // here (not just at render time) so the empty-state message below
      // still reflects "any real Drops in this view", not just "any rows
      // at all" - a user with zero real Drops but a Daily Brief must
      // still see "No Drops yet.", not a blank space with no explanation.
      if (capture.source === "system") return false;

      const isArchived = capture.userArchivedAt !== null;
      if (activeFilter === "archived") return isArchived;
      if (isArchived) return false;

      if (activeFilter === "completed") return capture.status === "completed";
      // Global Pinned v2 - restored. Cross-Space by design: every pinned
      // Drop regardless of which Space(s) it belongs to. Short-circuits
      // here same as "completed" above, so (like before) a hidden or
      // completed-but-pinned Drop still shows in this view - only the
      // earlier archived check already excludes an archived one.
      if (activeFilter === "pinned") return capture.pinned === true;

      const isManuallyHidden = capture.hiddenUntil !== null;
      const isHiddenNow = isManuallyHidden || isAutoHidden(capture);
      if (activeFilter === "hidden") return isHiddenNow;
      if (activeFilter === "all" && isHiddenNow) return false;

      if (capture.status === "completed") return false;

      return activeFilter === "all" || capture.spaceIds?.includes(activeFilter);
    });
  }, [captures, activeFilter, pendingRemovalIds]);

  // Pinned v2 - this per-Space sub-section is separate from (and coexists
  // with) the global Pinned filter branch above. Only meaningful while
  // viewing one specific, real Space (not "all"/Pinned/Completed/Hidden/
  // Archived, none of which have a single Space's membership to scope
  // pinned-ness by - "pinned" itself is in NON_SPACE_FILTER_IDS
  // specifically so the global Pinned view doesn't also try to render
  // this sub-section on top of itself) - filteredCaptures is already
  // scoped to that Space's own Drops at this point, so splitting it by
  // `pinned` here needs no separate spaceIds check of its own.
  const isRealSpaceView = !NON_SPACE_FILTER_IDS.has(activeFilter);
  const pinnedInSpace = useMemo(
    () => (isRealSpaceView ? filteredCaptures.filter((capture) => capture.pinned) : []),
    [filteredCaptures, isRealSpaceView]
  );
  const restCaptures = useMemo(
    () => (isRealSpaceView ? filteredCaptures.filter((capture) => !capture.pinned) : filteredCaptures),
    [filteredCaptures, isRealSpaceView]
  );

  // Per-Space mini-dashboard v1 - Recent, same scoping/exclusion pattern
  // Pinned already established: only meaningful in a real Space view, and
  // excluded from the list below it rather than duplicated (see
  // RECENT_COUNT). restCaptures is already recency-ordered (inherited
  // from captures' own fetchCaptures sort + saveCapture's prepend-on-
  // insert - never re-sorted here), so the first N of it are already
  // "the N most recent", no separate sort needed.
  const RECENT_COUNT = 3;
  const recentInSpace = useMemo(
    () => (isRealSpaceView ? restCaptures.slice(0, RECENT_COUNT) : []),
    [restCaptures, isRealSpaceView]
  );
  const remainingCaptures = useMemo(
    () => (isRealSpaceView ? restCaptures.slice(RECENT_COUNT) : restCaptures),
    [restCaptures, isRealSpaceView]
  );

  // Shared settle-then-remove helper - whichever action just fired, the
  // item may be about to leave the currently visible filtered view (or
  // move to a different one), so it stays visible through its own settle
  // animation first, same window DropCard's own internal collapse
  // animation uses (see DropCard.tsx's SETTLE_MS).
  function holdThroughSettle(id: number) {
    setPendingRemovalIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setPendingRemovalIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, SETTLE_MS);
  }

  async function handleToggleStatus(id: number, currentStatus: Capture["status"]) {
    const nextStatus = currentStatus === "completed" ? "active" : "completed";
    holdThroughSettle(id);
    await updateStatus(id, nextStatus);
  }

  async function handleToggleHide(id: number) {
    holdThroughSettle(id);
    await hideCapture(id);
  }

  // Onboarding Drop carousel v1 - the group-level equivalent of
  // handleToggleHide above, used both as this carousel's manual hide
  // fallback and as the automatic swipe-completion trigger (see
  // renderCard/renderGroup below). Holds every member through its own
  // settle animation, same as any other card leaving the view, so the
  // whole carousel animates out together rather than shrinking as each
  // member's hideCapture write lands at a slightly different time.
  function handleHideGroup(groupId: string) {
    for (const member of captures) {
      if (member.groupId === groupId) holdThroughSettle(member.id);
    }
    return hideGroup(groupId);
  }

  async function handleArchive(id: number) {
    holdThroughSettle(id);
    await archiveCapture(id);
  }

  async function handleUndo(id: number) {
    holdThroughSettle(id);
    await undoCaptureState(id);
  }

  function renderCard(capture: Capture) {
    // Onboarding Drop carousel v1 - this member's own Hide button hides
    // the WHOLE linked group, not just this one card (unlike an ordinary
    // Card Carousel v2 group, where each member's Hide is independent).
    // Otherwise tapping Hide on whichever slide happens to be showing
    // would just shrink the carousel by one card, leaving the rest
    // behind - not the "dismiss onboarding" fallback that's intended.
    const { groupId } = capture;
    const isOnboarding = capture.systemDropType === "onboarding" && groupId !== null;

    return (
      <LifelineDropCard
        key={capture.id}
        capture={capture}
        onSelect={onSelectCapture}
        onToggleStatus={() => handleToggleStatus(capture.id, capture.status)}
        onToggleHide={
          isOnboarding ? () => handleHideGroup(groupId as string) : () => handleToggleHide(capture.id)
        }
        onArchive={() => handleArchive(capture.id)}
        onUndo={() => handleUndo(capture.id)}
        onOpenInvite={onOpenInvite}
      />
    );
  }

  function renderGroup({ key, members }: { key: string; members: Capture[] }) {
    if (members.length <= 1) return renderCard(members[0]);

    // Onboarding Drop carousel v1 - the only group that auto-hides itself
    // once fully swiped through. Every other group (Card Carousel v2 user
    // groups, the Daily Brief carousel) gets no onAllSlidesVisited at all,
    // so DropGroupCarousel's default (never fires) applies unchanged.
    const isOnboardingGroup = members[0].systemDropType === "onboarding";

    return (
      <DropGroupCarousel
        key={key}
        slides={members.map((member) => renderCard(member))}
        onAllSlidesVisited={isOnboardingGroup ? () => handleHideGroup(key) : undefined}
      />
    );
  }

  const pinnedGroupedItems = useMemo(
    () => groupCapturesByGroupId(pinnedInSpace),
    [pinnedInSpace]
  );
  const recentGroupedItems = useMemo(
    () => groupCapturesByGroupId(recentInSpace),
    [recentInSpace]
  );
  const groupedItems = useMemo(
    () => groupCapturesByGroupId(remainingCaptures),
    [remainingCaptures]
  );

  return (
    <div className="space-y-3">
      {pinnedGroupedItems.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gold py-1">📌 Pinned</p>
          <div className="space-y-3">{pinnedGroupedItems.map(renderGroup)}</div>
          {(recentGroupedItems.length > 0 || groupedItems.length > 0) && (
            <div className="border-t border-ink/10 mt-3" aria-hidden="true" />
          )}
        </div>
      )}

      {/* Per-Space mini-dashboard v1 - Recent, same structure as Pinned
          above (curated Pinned content leads, since it's deliberate; the
          purely-chronological Recent convenience follows). */}
      {recentGroupedItems.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-dim py-1">🕐 Recent</p>
          <div className="space-y-3">{recentGroupedItems.map(renderGroup)}</div>
          {groupedItems.length > 0 && (
            <div className="border-t border-ink/10 mt-3" aria-hidden="true" />
          )}
        </div>
      )}

      {/* Reminders is a synthetic card, not a capture in this list - kept
          out of the "no Drops yet" empty-state decision entirely. Only
          shown on the literal "all" Lifeline view - a per-Space or
          Completed/Hidden/Archived view has no "upcoming" framing that
          makes sense. */}
      {activeFilter === "all" && <RemindersCard onSelectCapture={onSelectCapture} />}

      {filteredCaptures.length === 0 ? (
        <p className="text-ink-dim text-center mt-6">
          {activeFilter === "completed"
            ? "No completed Drops yet."
            : activeFilter === "archived"
              ? "No archived Drops yet."
              : activeFilter === "hidden"
                ? "No hidden Drops."
                : activeFilter === "all"
                  ? "No Drops yet."
                  : "No Drops in this Space yet."}
        </p>
      ) : (
        groupedItems.map(renderGroup)
      )}
    </div>
  );
}
