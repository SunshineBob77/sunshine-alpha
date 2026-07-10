// Shared by the share-page metadata (generateMetadata) and its og:image route -
// both need the same plain-text, cleanly-truncated preview of a Drop's content.

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]+$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Truncates at a clean sentence or word boundary rather than a raw character
// slice, so previews never cut off mid-word.
export function truncatePreview(text: string, maxLength = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const hardCut = trimmed.slice(0, maxLength);

  const sentenceEnd = Math.max(
    hardCut.lastIndexOf(". "),
    hardCut.lastIndexOf("! "),
    hardCut.lastIndexOf("? ")
  );
  if (sentenceEnd > maxLength * 0.5) {
    return trimmed.slice(0, sentenceEnd + 1).trim();
  }

  const wordEnd = hardCut.lastIndexOf(" ");
  const cut = wordEnd > maxLength * 0.5 ? hardCut.slice(0, wordEnd) : hardCut;
  return `${cut.trim()}…`;
}
