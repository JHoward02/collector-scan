const STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "with", "at", "by",
  "from", "as", "is", "it", "its", "vol", "volume", "edition", "ed", "new", "very",
]);

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Meaningful keywords for overlap scoring. */
export function tokenize(value: string): string[] {
  const tokens = normalizeText(value)
    .split(" ")
    .map((token) => token.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  return [...new Set(tokens)];
}

export function truncate(value: string, max = 220): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : max).trimEnd()}…`;
}

export function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}
