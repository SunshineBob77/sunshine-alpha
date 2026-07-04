import { supabase } from "./supabaseClient";

export type Capture = {
  id: number;
  text: string;
  createdAt: string;
  category: string;
  project: string;
  tags: string[];
  mood: string;
  sunshineSummary: string;
  spaceIds: string[];
};

type CaptureRow = {
  id: number;
  text: string;
  created_at: string;
  category: string;
  project: string;
  tags: string[];
  mood: string;
  sunshine_summary: string;
  space_ids: string[];
};

function mapRowToCapture(row: CaptureRow): Capture {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    category: row.category,
    project: row.project,
    tags: row.tags ?? [],
    mood: row.mood,
    sunshineSummary: row.sunshine_summary,
    spaceIds: row.space_ids ?? [],
  };
}

export async function fetchCaptures(): Promise<Capture[]> {
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as CaptureRow[]).map(mapRowToCapture);
}

export async function insertCapture(input: {
  text: string;
  category: string;
  project: string;
  tags: string[];
  mood: string;
  sunshineSummary: string;
  spaceIds: string[];
}): Promise<Capture> {
  const { data, error } = await supabase
    .from("captures")
    .insert({
      text: input.text,
      category: input.category,
      project: input.project,
      tags: input.tags,
      mood: input.mood,
      sunshine_summary: input.sunshineSummary,
      space_ids: input.spaceIds,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRowToCapture(data as CaptureRow);
}
