import type { Candidate, Category, SearchQuery } from "../types.ts";
import { rankCandidates, type ScoredCandidate } from "../match.ts";
import { cardListsProvider } from "./cardlists.ts";
import { openLibraryProvider } from "./openlibrary.ts";
import { scryfallProvider } from "./scryfall.ts";
import { wikipediaProvider } from "./wikipedia.ts";
import { ygoprodeckProvider } from "./ygoprodeck.ts";
import { ProviderError, type Provider } from "./types.ts";
export const PROVIDERS: Provider[] = [cardListsProvider,scryfallProvider,ygoprodeckProvider,wikipediaProvider,openLibraryProvider];
export interface SearchOutcome { results:ScoredCandidate[]; warnings:string[]; error:string|null; }
export async function searchAll(query:SearchQuery,categoryOrSignal:Category|AbortSignal,maybeSignal?:AbortSignal,providers:Provider[]=PROVIDERS):Promise<SearchOutcome>{
 if(categoryOrSignal instanceof AbortSignal)return{results:[],warnings:[],error:"Choose a type first. Select what you're adding to your Shelfie so we know where to search."};
 const category=categoryOrSignal,signal=maybeSignal as AbortSignal; const selectedProviders=providers.filter(p=>p.categories.includes(category));
 if(!selectedProviders.length)return{results:[],warnings:[],error:`No lookup provider is configured for ${category}.`};
 const typedQuery={...query,category}; const settled=await Promise.allSettled(selectedProviders.map(p=>p.search(typedQuery,signal)));
 if(signal.aborted)return{results:[],warnings:[],error:null}; const collected:Candidate[]=[],warnings:string[]=[],failures:string[]=[];
 settled.forEach((outcome,index)=>{const provider=selectedProviders[index];if(outcome.status==="fulfilled"){collected.push(...outcome.value.candidates);if(outcome.value.warning)warnings.push(`${provider.label}: ${outcome.value.warning}`);}else{const reason=outcome.reason;failures.push(`${provider.label}: ${reason instanceof ProviderError?reason.message:"Lookup service unavailable."}`);}});
 const error=failures.length===selectedProviders.length?failures.join(" "):null;if(failures.length&&!error)warnings.push(...failures);return{results:rankCandidates(typedQuery,collected),warnings,error};
}
