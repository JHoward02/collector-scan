import type { CategoryFilter, SearchStatus } from "./types.ts";
import type { ScoredCandidate } from "./match.ts";

export type Tab = "search" | "collection";
export type SortKey = "recent" | "title" | "value" | "category";

/**
 * Activation-scoped UI state.
 *
 * Canvas disposes and remounts the page on every nested-route navigation, so
 * anything the user should not lose while drilling into a result has to live
 * outside a single mount. It is created in `activate` and cleared on
 * deactivation, which keeps it from leaking across enable/disable cycles or
 * backend switches.
 */
export interface AppSession {
  activeTab: Tab;
  query: string;
  categoryFilter: CategoryFilter;
  status: SearchStatus;
  results: ScoredCandidate[];
  warnings: string[];
  error: string | null;
  /** Query string the current results belong to, for stale-result detection. */
  resultsFor: string;
  /** Keyword count of the last search, used to temper displayed confidence. */
  resultTokens: number;
  collectionQuery: string;
  collectionFilter: CategoryFilter;
  collectionSort: SortKey;
  favoritesOnly: boolean;
  /** One-shot message shown as a toast after a remount. */
  flash: string | null;
}

export function createSession(): AppSession {
  return {
    activeTab: "search",
    query: "",
    categoryFilter: "all",
    status: "idle",
    results: [],
    warnings: [],
    error: null,
    resultsFor: "",
    resultTokens: 0,
    collectionQuery: "",
    collectionFilter: "all",
    collectionSort: "recent",
    favoritesOnly: false,
    flash: null,
  };
}

/** Drop every reference so a deactivated app leaves nothing behind. */
export function clearSession(session: AppSession): void {
  session.activeTab = "search";
  session.query = "";
  session.categoryFilter = "all";
  session.status = "idle";
  session.results = [];
  session.warnings = [];
  session.error = null;
  session.resultsFor = "";
  session.resultTokens = 0;
  session.collectionQuery = "";
  session.collectionFilter = "all";
  session.collectionSort = "recent";
  session.favoritesOnly = false;
  session.flash = null;
}
