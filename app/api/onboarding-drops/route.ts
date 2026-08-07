// TODO(auth): trusts caller-supplied userId, no session validation - same
// posture as analyze-drop and daily-brief. Needs real auth before beta.
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// Shared with LifelineFeed.tsx (recognizes this group to wire up
// swipe-completion/group-hide) and app/(dashboard)/about/page.tsx (queries
// for these to render in the About Us carousel) so the three can never
// drift apart on the string value.
export const ONBOARDING_SYSTEM_DROP_TYPE = "onboarding";

// Real title/content pairs, in the order they should read left-to-right in
// the carousel - a single multi-row INSERT assigns each row's
// auto-incrementing id in this same order, which is what
// groupCapturesByGroupId (dropGroups.ts) sorts by as a tiebreaker (rows in
// the same insert share the exact same created_at, since Postgres's now()
// is stable within one statement). ONLY EVER APPEND here - the top-up
// logic below assumes an existing user's already-created rows exactly
// match this array's own prefix, by position, not by content.
const ONBOARDING_SLIDES: { title: string; text: string }[] = [
  {
    title: "Drop it in. Ask for it later.",
    text: "Everything you capture here becomes a Drop. Type it, snap it, or paste it in - Sunshine organizes it so you don't have to.",
  },
  {
    title: "Just capture",
    text: "No folders to pick, no tags to remember. Just type, snap a photo, or paste something in, and Sunshine figures out what it is.",
  },
  {
    title: "Spaces",
    text: "Your Drops organize themselves into Spaces - Family, Work, Health, and more. Spaces are just views, not boxes - nothing's ever locked away in one.",
  },
  {
    title: "Ask Sunshine",
    text: "Ask things like \"how many times did I...\" or \"where's that address again?\" - Sunshine remembers so you don't have to.",
  },
  {
    title: "Shared Spaces",
    text: "Invite people you share life with into a Space, so a Drop reaches everyone who needs it.",
  },
  {
    title: "More than words",
    text: "Snap a photo of a whiteboard, a receipt, or a flyer, and Sunshine reads what's actually in it.",
  },
  {
    title: "Just talk",
    text: "Ramble into Sunshine like you're talking to a friend, and it turns what you said into bullets or a checklist automatically - no formatting to think about.",
  },
  {
    title: "Combine Drops",
    text: "See the + on a card? Tap it to link related Drops into a carousel - like grouping photos from one event, or steps in one project.",
  },
  {
    title: "Fix anything",
    text: "Sunshine won't always get it exactly right - no one does. Tap a Drop to edit its text or title, and if it lands in the wrong Space, just switch it. Nothing's locked in.",
  },
  {
    title: "Know your buttons",
    text: "Pin keeps something at the top. Hide tucks it out of Lifeline (it's still in its Space). Complete checks it off. Delete removes it for good.",
  },
];

export async function POST(request: Request) {
  const body = await request.json();
  const { userId } = body as { userId?: string };

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    // Top-up idempotency check, not a plain "any row exists -> skip" -
    // this needs to stay correct as ONBOARDING_SLIDES grows over time
    // (see slides 8-10, added after some real accounts already had the
    // original 7). If this user has fewer onboarding rows than
    // ONBOARDING_SLIDES currently has entries, insert exactly the missing
    // tail slides (by array position, not by matching title/content -
    // robust even if the user has since manually retitled one of their
    // own copies) into their EXISTING group_id, so they join the same
    // carousel rather than getting a second one. No per-day/per-session
    // concept the way Daily Brief has - this is create-once-then-top-up-
    // forever, so a plain select-then-insert is enough; unlike
    // daily-brief/route.ts there's no natural per-row distinguishing key
    // to build a compound unique constraint + upsert(ignoreDuplicates)
    // around (multiple rows intentionally share the same
    // system_drop_type), so a narrow race window on simultaneous
    // requests is accepted rather than forcing content fields like title
    // into a schema-level uniqueness constraint.
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("captures")
      .select("id, group_id")
      .eq("user_id", userId)
      .eq("system_drop_type", ONBOARDING_SYSTEM_DROP_TYPE)
      .order("id", { ascending: true });

    if (existingError) throw existingError;

    const existingCount = (existingRows ?? []).length;

    if (existingCount >= ONBOARDING_SLIDES.length) {
      return NextResponse.json({ skipped: true });
    }

    // Reuse the existing carousel's group_id when topping up an
    // already-started group; only a genuinely new user gets a fresh one.
    const groupId = existingCount > 0 ? (existingRows![0].group_id as string) : randomUUID();
    const missingSlides = ONBOARDING_SLIDES.slice(existingCount);

    const baseRow = {
      user_id: userId,
      category: "Memory",
      project: "",
      tags: [],
      mood: "",
      space_ids: [],
      space_manually_set: true,
      is_actionable: false,
      checklist_items: [],
      // source: "user" (NOT "system") is deliberate - LifelineFeed.tsx
      // unconditionally excludes every source==="system" capture from
      // Lifeline, which would make "show in Lifeline at signup"
      // impossible. Being a normal user-owned Drop also means it gets a
      // real Hide control and all of Card Carousel v2's existing
      // plumbing for free, at the cost of repurposing system_drop_type
      // outside its usual source==="system" pairing.
      source: "user",
      system_drop_type: ONBOARDING_SYSTEM_DROP_TYPE,
      group_id: groupId,
      // Pre-completed and never routed through analyze-drop - this is
      // fixed Sunshine-authored copy, not user content to classify,
      // reformat, or retitle. DashboardContext.tsx's onboarding-drops
      // effect never calls analyzeDrop() for these rows.
      analysis_status: "complete",
      analysis_attempts: 0,
    };

    const rows = missingSlides.map((slide) => ({
      ...baseRow,
      text: slide.text,
      formatted_text: slide.text,
      title: slide.title,
      sunshine_summary: slide.title,
    }));

    const { data: insertedRows, error: insertError } = await supabaseAdmin
      .from("captures")
      .insert(rows)
      .select("*")
      .order("id", { ascending: true });

    if (insertError) throw insertError;

    return NextResponse.json({ captures: insertedRows });
  } catch (error) {
    console.error("onboarding-drops generation failed", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
