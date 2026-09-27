import type { Candidate, Category, SearchQuery } from "../types.ts";
import type { TcgGame } from "../session.ts";
import { rankCandidates, type ScoredCandidate } from "../match.ts";
import { cardListsProvider } from "./cardlists.ts";
import { openLibraryProvider } from "./openlibrary.ts";
import { scryfallProvider } from "./scryfall.ts";
import { wikipediaProvider } from "./wikipedia.ts";
import { ygoprodeckProvider } from "./ygoprodeck.ts";
import { ProviderError, type Provider } from "./types.ts";

export const PROVIDERS: Provider[] = [cardListsProvider,scryfallProvider,ygoprodeckProvider,wikipediaProvider,openLibraryProvider];
export interface SearchOutcome { results:ScoredCandidate[]; warnings:string[]; error:string|null; }

function providersFor(category: Category, tcgGame: TcgGame | null, providers: Provider[]): Provider[] {
  const categoryProviders = providers.filter((provider) => provider.categories.includes(category));
  if (category !== "tcg") return categoryProviders;
  if (tcgGame === "magic") return categoryProviders.filter((provider) => provider.id === "scryfall");
  if (tcgGame === "yugioh") return categoryProviders.filter((provider) => provider.id === "ygoprodeck");
  // Games without a vetted provider never fall through to another game's API.
  return [];
}

export async function searchAll(
  query: SearchQuery,
  category: Category,
  signal: AbortSignal,
  tcgGame: TcgGame | null = null,
  providers: Provider[] = PROVIDERS,
): Promise<SearchOutcome> {
  const selectedProviders = providersFor(category, tcgGame, providers);
  if (!selectedProviders.length) {
    if (category === "tcg") return { results:[], warnings:[], error:"This TCG catalog is not connected yet. You can still add the item manually." };
    return { results:[], warnings:[], error:`No lookup provider is configured for ${category}.` };
  }
  const typedQuery={...query,category};
  const settled=await Promise.allSettled(selectedProviders.map((provider)=>provider.search(typedQuery,signal)));
  if(signal.aborted)return{results:[],warnings:[],error:null};
  const collected:Candidate[]=[],warnings:string[]=[],failures:string[]=[];
  settled.forEach((outcome,index)=>{const provider=selectedProviders[index];if(outcome.status==="fulfilled"){collected.push(...outcome.value.candidates);if(outcome.value.warning)warnings.push(`${provider.label}: ${outcome.value.warning}`);}else{const reason=outcome.reason;failures.push(`${provider.label}: ${reason instanceof ProviderError?reason.message:"Lookup service unavailable."}`);}});
  const error=failures.length===selectedProviders.length?failures.join(" "):null;
  if(failures.length&&!error)warnings.push(...failures);
  return{results:rankCandidates(typedQuery,collected),warnings,error};
}
