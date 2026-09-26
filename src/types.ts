/** Shared domain types for Collector Scan. */

export type Category = "comic" | "sports-card" | "book" | "other";
export type CategoryFilter = Category | "all";
export type ProviderId = "openlibrary" | "wikipedia";

export interface DetailRow {
  label: string;
  value: string;
}

/** A lookup result the user can pick from. */
export interface Candidate {
  /** Provider-qualified stable id, e.g. `wikipedia:12345`. */
  id: string;
  provider: ProviderId;
  providerLabel: string;
  providerKey: string;
  title: string;
  subtitle: string | null;
  category: Category;
  year: number | null;
  imageUrl: string | null;
  description: string | null;
  sourceUrl: string | null;
  details: DetailRow[];
  score: number;
  matchReasons: string[];
}

/** The interpreted form of whatever the user typed. */
export interface SearchQuery {
  raw: string;
  /** Title-ish text used for token matching. */
  title: string;
  /** Text sent to providers (keeps issue numbers and years). */
  providerQuery: string;
  category: Category | null;
  year: number | null;
  number: string | null;
  publisher: string | null;
  detectionReasons: string[];
}

export const CONDITIONS = [
  "mint",
  "near mint",
  "excellent",
  "good",
  "fair",
  "poor",
  "graded",
  "raw",
] as const;

export type Condition = (typeof CONDITIONS)[number];

/** A tracked collection entry. */
export interface CollectionItem {
  id: string;
  addedAt: number;
  updatedAt: number;
  title: string;
  subtitle: string | null;
  category: Category;
  year: number | null;
  imageUrl: string | null;
  description: string | null;
  sourceUrl: string | null;
  sourceLabel: string;
  details: DetailRow[];
  condition: Condition;
  grade: string;
  quantity: number;
  pricePaid: number | null;
  estimatedValue: number | null;
  notes: string;
  favorite: boolean;
}

export type SearchStatus = "idle" | "loading" | "ready" | "error";

export const CATEGORY_LABELS: Record<Category, string> = {
  comic: "Comic",
  "sports-card": "Sports card",
  book: "Book",
  other: "Collectible",
};

export const CATEGORY_GLYPHS: Record<Category, string> = {
  comic: "COMIC",
  "sports-card": "CARD",
  book: "BOOK",
  other: "ITEM",
};
