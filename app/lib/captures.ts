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
  aiResearchResult: string | null;
  extractedAddress: string | null;
  formattedText: string | null;
  title: string | null;
  status: "active" | "completed" | "deleted";
  isActionable: boolean;
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
  ai_research_result: string | null;
  extracted_address: string | null;
  formatted_text: string | null;
  title: string | null;
  status: "active" | "completed" | "deleted";
  is_actionable: boolean;
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
    aiResearchResult: row.ai_research_result ?? null,
    extractedAddress: row.extracted_address ?? null,
    formattedText: row.formatted_text ?? null,
    title: row.title ?? null,
    status: row.status ?? "active",
    isActionable: row.is_actionable ?? false,
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

export async function deleteCapture(id: number): Promise<void> {
  const { error } = await supabase.from("captures").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCaptureSpaces(id: number, spaceIds: string[]): Promise<void> {
  const { error } = await supabase
    .from("captures")
    .update({ space_ids: spaceIds })
    .eq("id", id);

  if (error) throw error;
}

export async function updateCaptureText(id: number, text: string): Promise<void> {
  const { error } = await supabase.from("captures").update({ text }).eq("id", id);
  if (error) throw error;
}

export async function updateCaptureStatus(
  id: number,
  status: "active" | "completed"
): Promise<void> {
  const { error } = await supabase.from("captures").update({ status }).eq("id", id);
  if (error) throw error;
}
