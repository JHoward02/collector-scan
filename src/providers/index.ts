import type { Candidate, Category, SearchQuery } from "../types.ts";
import type { TcgGame } from "../session.ts";
import { getSearchSelection } from "../search-selection.ts";
import { rankCandidates, type ScoredCandidate } from "../match.ts";
import { cardListsProvider } from "./cardlists.ts";
import { fabProvider } from "./fab.ts";
import { gcdProvider } from "./gcd.ts";
import { lorcanaJsonProvider } from "./lorcanajson.ts";
import { onePieceProvider } from "./onepiece.ts";
import { openLibraryProvider } from "./openlibrary.ts";
import { pokemonProvider } from "./pokemon.ts";
import { scryfallProvider } from "./scryfall.ts";
import { wikipediaProvider } from "./wikipedia.ts";
import { ygoprodeckProvider } from "./ygoprodeck.ts";
import { ProviderError, type Provider } from "./types.ts";

export const PROVIDERS:Provider[]=[cardListsProvider,gcdProvider,scryfallProvider,ygoprodeckProvider,lorcanaJsonProvider,fabProvider,pokemonProvider,onePieceProvider,wikipediaProvider,openLibraryProvider];
export interface SearchOutcome{results:ScoredCandidate[];warnings:string[];error:string|null;}
function providersFor(category:Category,tcgGame:TcgGame|null,providers:Provider[]):Provider[]{const cp=providers.filter((p)=>p.categories.includes(category));if(category==="comic")return cp.filter((p)=>p.id==="gcd");if(category==="book")return cp.filter((p)=>p.id==="openlibrary");if(category==="video-game")return cp.filter((p)=>p.id==="wikipedia");if(category!=="tcg")return cp;const id=tcgGame==="magic"?"scryfall":tcgGame==="yugioh"?"ygoprodeck":tcgGame==="lorcana"?"lorcanajson":tcgGame==="fab"?"fab":tcgGame==="pokemon"?"pokemon-data":tcgGame==="one-piece"?"onepiece-data":null;return id?cp.filter((p)=>p.id===id):[];}
export async function searchAll(query:SearchQuery,categoryOrSignal:Category|AbortSignal,maybeSignal?:AbortSignal,tcgGameArg:TcgGame|null=null,providers:Provider[]=PROVIDERS):Promise<SearchOutcome>{const ui=getSearchSelection();const legacy=categoryOrSignal instanceof AbortSignal;const category=legacy?ui.category:categoryOrSignal;const signal=legacy?categoryOrSignal:maybeSignal as AbortSignal;const tcgGame=legacy?ui.tcgGame:tcgGameArg;if(!category)return{results:[],warnings:[],error:"Choose a type first. Select what you're adding to your Shelfie so we know where to search."};if(category==="tcg"&&!tcgGame)return{results:[],warnings:[],error:"Choose a TCG first so Shelfie only searches the right card catalog."};const selected=providersFor(category,tcgGame,providers);if(!selected.length){if(category==="tcg")return{results:[],warnings:[],error:"This TCG catalog is not connected yet. You can still add the item manually."};return{results:[],warnings:[],error:`No lookup provider is configured for ${category}.`};}const typed={...query,category};const settled=await Promise.allSettled(selected.map((p)=>p.search(typed,signal)));if(signal.aborted)return{results:[],warnings:[],error:null};const collected:Candidate[]=[],warnings:string[]=[],failures:string[]=[];settled.forEach((o,i)=>{const p=selected[i];if(o.status==="fulfilled"){collected.push(...o.value.candidates);if(o.value.warning)warnings.push(`${p.label}: ${o.value.warning}`);}else{const r=o.reason;failures.push(`${p.label}: ${r instanceof ProviderError?r.message:r instanceof Error?r.message:"Lookup service unavailable."}`);}});const error=failures.length===selected.length?failures.join(" "):null;if(failures.length&&!error)warnings.push(...failures);return{results:rankCandidates(typed,collected),warnings,error};}
