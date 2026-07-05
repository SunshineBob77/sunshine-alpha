import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

const anthropic = new Anthropic();

const SYSTEM_PROMPT =
  "Determine if this note is a research request (asking to find, look up, recommend, or research something — e.g. recipes, products, information). If yes, search the web and return a concise, useful answer in 2-4 sentences. If no, respond with exactly the word null and nothing else. Do not narrate what you're about to do or describe your search process. Output only the final answer itself, starting directly with the substantive content. No preamble like 'I'll search for...' or 'Let me find...'";

const PREAMBLE_PATTERN = /^[^.!?\n]*\b(I'll search|I will search|Let me|I'll look|I will look)\b[^.!?\n]*[.!?]+\s*/i;

function stripPreamble(text: string): string {
  return text.replace(PREAMBLE_PATTERN, "").trim();
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

    const answer = stripPreamble(
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim()
    );

    const result = answer.length === 0 || answer.toLowerCase() === "null" ? null : answer;

    const { error } = await supabaseAdmin
      .from("captures")
      .update({ ai_research_result: result })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ result });
  } catch (error) {
    console.error("analyze-drop failed", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
