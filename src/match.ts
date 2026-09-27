import { CATEGORY_LABELS, type Candidate, type SearchQuery } from "./types.ts";
import { normalizeText, tokenize } from "./text.ts";

export interface ScoredCandidate extends Candidate {
  score: number;
  matchReasons: string[];
}

/**
 * Pages that describe or rank collectibles rather than being one. They match
 * strongly on keywords ("List of ... issues") but are never what the user is
 * holding, so they are demoted rather than hidden.
 */
const NON_ITEM_PATTERNS = [
  /\blist of\b/,
  /\bdisambiguation\b/,
  /\b\(\s*(?:film|movie|tv|television|video game|soundtrack|album)\s*\)/,
  /\bindex of\b/,
  /\bcategory:/,
];

/**
 * Relevance scoring for a user-typed query.
 *
 * Title overlap dominates and description text is weighted far lower: provider
 * summaries mention the query many times, so counting them equally let list and
 * adaptation pages tie with the actual item. Every adjustment records a reason
 * so the UI can show the user why a match was suggested.
 */
export function scoreCandidate(
  query: SearchQuery,
  candidate: Candidate,
): { score: number; reasons: string[] } {
  const tokens = tokenize(query.title);
  const titleHaystack = normalizeText(`${candidate.title} ${candidate.subtitle ?? ""}`);
  const detailHaystack = normalizeText(
    [
      candidate.year == null ? "" : String(candidate.year),
      ...candidate.details.map((row) => `${row.label} ${row.value}`),
    ].join(" "),
  );

  let titleHits = 0;
  let detailHits = 0;
  for (const token of tokens) {
    if (titleHaystack.includes(token)) titleHits += 1;
    else if (detailHaystack.includes(token)) detailHits += 1;
  }

  // A description-only match is worth a quarter of a title match.
  const coverage = tokens.length > 0 ? (titleHits + detailHits * 0.25) / tokens.length : 0;
  let score = coverage;
  const reasons: string[] = [];
  if (titleHits > 0) reasons.push(`${titleHits}/${tokens.length} in title`);

  if (query.number && normalizeText(`${candidate.title} ${detailHaystack}`).includes(query.number.toLowerCase())) {
    score += 0.25;
    reasons.push(`issue ${query.number}`);
  }
  if (query.year && (candidate.year === query.year || detailHaystack.includes(String(query.year)))) {
    score += 0.15;
    reasons.push(String(query.year));
  }
  if (query.category && candidate.category === query.category) {
    score += 0.1;
    reasons.push(CATEGORY_LABELS[candidate.category]);
  }
  if (query.publisher && detailHaystack.includes(query.publisher)) {
    score += 0.08;
    reasons.push(query.publisher);
  }

  const exact = normalizeText(query.title);
  if (exact.length >= 3 && normalizeText(candidate.title).includes(exact)) {
    score += 0.3;
    reasons.push("title match");
  }

  // "(video game)" can identify the collectible itself, rather than an adaptation.
  const referenceTitle = candidate.category === "video-game"
    ? candidate.title.replace(/\(\s*video game\s*\)/i, "")
    : candidate.title;
  if (NON_ITEM_PATTERNS.some((pattern) => pattern.test(referenceTitle.toLowerCase()))) {
    score -= 0.25;
    reasons.push("reference page");
  }

  // Small tie-breaker only: a cover helps the user confirm a match at a glance,
  // but must never outrank stronger textual relevance.
  if (candidate.imageUrl) {
    score += 0.05;
    reasons.push("has image");
  }

  // Deliberately not clamped: boosts can push a strong match past 1, and that
  // spread is what keeps ordering meaningful. Callers clamp for display only.
  return { score: Math.max(0, score), reasons };
}

/**
 * Coarse confidence band for display. A raw percentage implies a precision the
 * keyword overlap does not have, so the UI shows a band and lets the reason
 * chips carry the specifics.
 *
 * A one-keyword query is capped: "Watchmen" matches a series, a film, a list
 * page and a book equally well, so calling any of them a strong match would be
 * asserting something the query cannot support.
 */
export function confidenceLabel(score: number, queryTokenCount = 2): string {
  const capped = queryTokenCount <= 1 ? Math.min(score, 0.75) : score;
  if (capped >= 0.9) return "Strong match";
  if (capped >= 0.6) return "Good match";
  if (capped >= 0.35) return "Possible match";
  return "Weak match";
}

/** Score, drop duplicates, and order best-first. */
export function rankCandidates(query: SearchQuery, candidates: Candidate[]): ScoredCandidate[] {
  const seen = new Set<string>();
  const scored: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidate.id || normalizeText(candidate.title);
    if (seen.has(key)) continue;
    seen.add(key);
    const { score, reasons } = scoreCandidate(query, candidate);
    scored.push({ ...candidate, score, matchReasons: reasons });
  }
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored;
}
