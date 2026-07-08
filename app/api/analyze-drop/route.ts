import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are analyzing a short personal note (a "Drop"). Do three independent things:

1. Determine if this note is a research request (asking to find, look up, recommend, or research something — e.g. recipes, products, information). If yes, search the web and return a concise, useful answer in 2-4 sentences. If no, use the value null.
2. Determine if this note contains a physical address (e.g. a hotel, restaurant, or event location). If yes, extract it exactly as written. If no, use the value null.
3. Reformat the note's own content for clean display, using Markdown. Detect its structure and format accordingly:
   - A list of items (things separated by commas, "and", or newlines) → a real Markdown bullet list.
   - Tabular or cost/price data → a real Markdown table.
   - A single short reminder or thought → a plain sentence, no forced structure.
   - A longer multi-line note → preserve the original paragraph breaks, do not compress it into one line.
   Only reformat what's already there — do not add commentary, headers, or new content. This field must never be null.

Do not narrate what you're about to do or describe your search process — no preamble like "I'll search for..." or "Let me find...".

Respond with exactly this format and nothing else before or after it:
RESEARCH: <answer or null>
ADDRESS: <address or null>
FORMATTED: <reformatted note>`;

const PREAMBLE_PATTERN = /^[^.!?\n]*\b(I'll search|I will search|Let me|I'll look|I will look)\b[^.!?\n]*[.!?]+\s*/i;

function stripPreamble(text: string): string {
  return text.replace(PREAMBLE_PATTERN, "").trim();
}

function nullableValue(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  return value.length === 0 || value.toLowerCase() === "null" ? null : value;
}

function parseAnalysis(rawText: string): {
  research: string | null;
  address: string | null;
  formatted: string | null;
} {
  const researchMatch = rawText.match(/RESEARCH:\s*([\s\S]*?)\s*ADDRESS:/i);
  const addressMatch = rawText.match(/ADDRESS:\s*([\s\S]*?)\s*FORMATTED:/i);
  const formattedMatch = rawText.match(/FORMATTED:\s*([\s\S]*)$/i);

  if (!researchMatch || !addressMatch || !formattedMatch) {
    // Model didn't follow the format — fall back to treating the whole response as the research answer.
    return { research: nullableValue(stripPreamble(rawText)), address: null, formatted: null };
  }

  return {
    research: nullableValue(stripPreamble(researchMatch[1])),
    address: nullableValue(addressMatch[1]),
    formatted: nullableValue(formattedMatch[1]),
  };
}

export async function POST(request: Request) {
  const { id, text } = await request.json();

  if (!id || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing id or text" }, { status: 400 });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages: [{ role: "user", content: text }],
    });

    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const { research, address, formatted } = parseAnalysis(rawText);

    const { error } = await supabaseAdmin
      .from("captures")
      .update({
        ai_research_result: research,
        extracted_address: address,
        formatted_text: formatted,
      })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ result: research, address, formatted });
  } catch (error) {
    console.error("analyze-drop failed", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
