import type { Candidate, Category, SearchQuery } from "../types.ts";
import { rankCandidates, type ScoredCandidate } from "../match.ts";
import { cardListsProvider } from "./cardlists.ts";
import { openLibraryProvider } from "./openlibrary.ts";
import { wikipediaProvider } from "./wikipedia.ts";
import { ProviderError, type Provider } from "./types.ts";

export const PROVIDERS: Provider[] = [cardListsProvider, wikipediaProvider, openLibraryProvider];

export interface SearchOutcome {
  results: ScoredCandidate[];
  warnings: string[];
  /** Set when every selected provider failed; results may still be empty. */
  error: string | null;
}

/**
 * Query only providers that support the type the user explicitly selected.
 * This keeps unrelated APIs from being called for every search.
 */
export async function searchAll(
  query: SearchQuery,
  category: Category,
  signal: AbortSignal,
  providers: Provider[] = PROVIDERS,
): Promise<SearchOutcome> {
  const selectedProviders = providers.filter((provider) => provider.categories.includes(category));
  if (!selectedProviders.length) {
    return { results: [], warnings: [], error: `No lookup provider is configured for ${category}.` };
  }

  const typedQuery: SearchQuery = { ...query, category };
  const settled = await Promise.allSettled(
    selectedProviders.map((provider) => provider.search(typedQuery, signal)),
  );

  if (signal.aborted) return { results: [], warnings: [], error: null };

  const collected: Candidate[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];

  settled.forEach((outcome, index) => {
    const provider = selectedProviders[index];
    if (outcome.status === "fulfilled") {
      collected.push(...outcome.value.candidates);
      if (outcome.value.warning) warnings.push(`${provider.label}: ${outcome.value.warning}`);
    } else {
      const reason = outcome.reason;
      const message = reason instanceof ProviderError ? reason.message : "Lookup service unavailable.";
      failures.push(`${provider.label}: ${message}`);
    }
  });

  const error = failures.length === selectedProviders.length ? failures.join(" ") : null;
  if (failures.length && !error) warnings.push(...failures);

  return { results: rankCandidates(typedQuery, collected), warnings, error };
}
