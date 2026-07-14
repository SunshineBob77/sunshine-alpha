"use client";

import { useMemo } from "react";
import DropCard from "./DropCard";
import RemindersContent from "./RemindersContent";
import { useCaptures } from "@/app/lib/DashboardContext";
import { buildReminderGroups } from "@/app/lib/reminders";

// Not a real capture - see docs/reminders-dismissal-schema.sql. Computed
// live from context on every render, so it never goes stale the way a
// once-a-day generated row would, and checkbox toggles reflect instantly
// with no server round-trip.
export default function RemindersCard({
  onSelectCapture,
}: {
  onSelectCapture: (id: number) => void;
}) {
  const { captures, toggleReminderOccurrence } = useCaptures();
  const todayKey = new Date().toLocaleDateString("en-CA");

  const { thisWeek, comingUp } = useMemo(
    () => buildReminderGroups(captures, todayKey),
    [captures, todayKey]
  );

  if (thisWeek.length === 0 && comingUp.length === 0) return null;

  return (
    <DropCard
      variant="dark"
      title="⏰ Reminders"
      spaceId={null}
      content=""
      createdAt={new Date().toISOString()}
      hideTimestamp
      clipped={false}
      customContent={
        <RemindersContent
          thisWeek={thisWeek}
          comingUp={comingUp}
          todayKey={todayKey}
          onToggle={toggleReminderOccurrence}
          onSelectCapture={onSelectCapture}
        />
      }
    />
  );
}
