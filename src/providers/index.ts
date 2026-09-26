import type { Candidate, SearchQuery } from "../types.ts";
import { rankCandidates, type ScoredCandidate } from "../match.ts";
import { openLibraryProvider } from "./openlibrary.ts";
import { wikipediaProvider } from "./wikipedia.ts";
import { ProviderError, type Provider } from "./types.ts";

export const PROVIDERS: Provider[] = [wikipediaProvider, openLibraryProvider];

export interface SearchOutcome {
  results: ScoredCandidate[];
  warnings: string[];
  /** Set when every provider failed; results may still be empty. */
  error: string | null;
}

/**
 * Query every provider in parallel. A provider that fails degrades to a warning
 * so one outage never hides the results another provider returned.
 */
export async function searchAll(
  query: SearchQuery,
  signal: AbortSignal,
  providers: Provider[] = PROVIDERS,
): Promise<SearchOutcome> {
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.search(query, signal)),
  );

  if (signal.aborted) return { results: [], warnings: [], error: null };

  const collected: Candidate[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];

  settled.forEach((outcome, index) => {
    const provider = providers[index];
    if (outcome.status === "fulfilled") {
      collected.push(...outcome.value.candidates);
      if (outcome.value.warning) warnings.push(`${provider.label}: ${outcome.value.warning}`);
    } else {
      const reason = outcome.reason;
      const message =
        reason instanceof ProviderError
          ? reason.message
          : "Lookup service unavailable.";
      failures.push(`${provider.label}: ${message}`);
    }
  });

  const error = failures.length === providers.length ? failures.join(" ") : null;
  if (failures.length && !error) warnings.push(...failures);

  return { results: rankCandidates(query, collected), warnings, error };
}
