import { cache } from "react";
import { supabase } from "./supabaseClient";
import type { Capture } from "./captures";

export type Share = {
  id: string;
  sharerName: string;
  title: string;
  previewText: string;
  category: string | null;
  spaceId: string | null;
  createdAt: string;
};

const SHARE_COLUMNS = "id, sharer_name, title, preview_text, category, space_id, created_at";

type ShareRow = {
  id: string;
  sharer_name: string;
  title: string;
  preview_text: string;
  category: string | null;
  space_id: string | null;
  created_at: string;
};

function mapRowToShare(row: ShareRow): Share {
  return {
    id: row.id,
    sharerName: row.sharer_name,
    title: row.title,
    previewText: row.preview_text,
    category: row.category,
    spaceId: row.space_id,
    createdAt: row.created_at,
  };
}

export async function getOrCreateShare(capture: Capture, sharerName: string): Promise<Share> {
  const { data: existing, error: selectError } = await supabase
    .from("shares")
    .select(SHARE_COLUMNS)
    .eq("capture_id", capture.id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return mapRowToShare(existing as ShareRow);

  const { data: inserted, error: insertError } = await supabase
    .from("shares")
    .insert({
      capture_id: capture.id,
      sharer_name: sharerName,
      title: capture.title ?? capture.sunshineSummary,
      preview_text: capture.formattedText ?? capture.text,
      category: capture.category,
      space_id: capture.spaceIds?.[0] ?? null,
    })
    .select(SHARE_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raceWinner, error: raceError } = await supabase
        .from("shares")
        .select(SHARE_COLUMNS)
        .eq("capture_id", capture.id)
        .single();

      if (raceError) throw raceError;
      return mapRowToShare(raceWinner as ShareRow);
    }

    throw insertError;
  }

  return mapRowToShare(inserted as ShareRow);
}

export const fetchShare = cache(async (id: string): Promise<Share | null> => {
  const { data, error } = await supabase
    .from("shares")
    .select(SHARE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // Malformed id (not a valid uuid) - treat as not found rather than a hard error.
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;

  return mapRowToShare(data as ShareRow);
});
