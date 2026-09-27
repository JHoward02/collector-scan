import type { Candidate, Category, SearchQuery } from "../types.ts";
import type { FigureLine, TcgGame, ToyLine } from "../session.ts";
import { getSearchSelection } from "../search-selection.ts";
import { rankCandidates, type ScoredCandidate } from "../match.ts";
import { amiiboProvider } from "./amiibo.ts";import { cardListsProvider } from "./cardlists.ts";import { discogsProvider } from "./discogs.ts";import { fabProvider } from "./fab.ts";import { funkoProvider } from "./funko.ts";import { gcdProvider } from "./gcd.ts";import { greenLightProvider } from "./greenlight.ts";import { hotWheelsProvider } from "./hotwheels.ts";import { matchboxProvider } from "./matchbox.ts";import { miniGtProvider,m2Provider,tomicaProvider,tarmacProvider } from "./diecast-fandom.ts";import { lorcanaJsonProvider } from "./lorcanajson.ts";import { onePieceProvider } from "./onepiece.ts";import { openLibraryProvider } from "./openlibrary.ts";import { pokemonProvider } from "./pokemon.ts";import { scryfallProvider } from "./scryfall.ts";import { ygoprodeckProvider } from "./ygoprodeck.ts";import { ProviderError,type Provider } from "./types.ts";
export const PROVIDERS:Provider[]=[amiiboProvider,hotWheelsProvider,matchboxProvider,greenLightProvider,miniGtProvider,m2Provider,tomicaProvider,tarmacProvider,discogsProvider,cardListsProvider,gcdProvider,scryfallProvider,ygoprodeckProvider,lorcanaJsonProvider,fabProvider,pokemonProvider,onePieceProvider,funkoProvider,openLibraryProvider];export interface SearchOutcome{results:ScoredCandidate[];warnings:string[];error:string|null;manualOnly?:boolean;}
const DIECAST_PROVIDER:Record<string,string>={"hot-wheels":"hotwheels-fandom",matchbox:"matchbox-fandom",greenlight:"greenlight-live","mini-gt":"minigt-fandom","m2-machines":"m2-fandom",tomica:"tomica-fandom","tarmac-works":"tarmac-fandom"};
function providersFor(category:Category,tcgGame:TcgGame|null,figureLine:FigureLine|null,toyLine:ToyLine|null,dieCastBrand:string|null,providers:Provider[]):Provider[]{const cp=providers.filter(p=>p.categories.includes(category));if(category==="comic")return cp.filter(p=>p.id==="gcd");if(category==="book")return cp.filter(p=>p.id==="openlibrary");if(category==="sports-card")return cp.filter(p=>p.id==="cardlists");if(category==="vinyl")return cp.filter(p=>p.id==="discogs");if(category==="figure"){const id=figureLine==="funko-pop"?"funko-data":figureLine==="amiibo"?"amiiboapi":null;return id?cp.filter(p=>p.id===id):[];}if(category==="toy"){if(toyLine==="die-cast"&&dieCastBrand){const id=DIECAST_PROVIDER[dieCastBrand];return id?cp.filter(p=>p.id===id):[];}return [];}if(category!=="tcg")return [];const id=tcgGame==="magic"?"scryfall":tcgGame==="yugioh"?"ygoprodeck":tcgGame==="lorcana"?"lorcanajson":tcgGame==="fab"?"fab":tcgGame==="pokemon"?"pokemon-data":tcgGame==="one-piece"?"onepiece-data":null;return id?cp.filter(p=>p.id===id):[];}
export async function searchAll(query: SearchQuery, categoryOrSignal: Category | AbortSignal, maybeSignal?: AbortSignal, tcgGameArg: TcgGame | null = null, providers: Provider[] = PROVIDERS): Promise<SearchOutcome> {
  const ui = getSearchSelection();
  const legacy = categoryOrSignal instanceof AbortSignal;
  const category = legacy ? ui.category : categoryOrSignal;
  const signal = legacy ? categoryOrSignal : maybeSignal as AbortSignal;
  const tcgGame = legacy ? ui.tcgGame : tcgGameArg;
  if (!category) return { results: [], warnings: [], error: "Choose a type first. Select what you're adding to your Shelfie so we know where to search." };
  if (category === "tcg" && !tcgGame) return { results: [], warnings: [], error: "Choose a TCG first so Shelfie only searches the right card catalog." };
  if (category === "figure" && !ui.figureLine) return { results: [], warnings: [], error: "Choose a figure type first: Amiibo, McFarlane, Funko Pop, Nendoroid, or Other." };
  if (category === "toy" && !ui.toyLine) return { results: [], warnings: [], error: "Choose a toy type first: LEGO, Transformers, or Die-Cast." };
  if (category === "toy" && ui.toyLine === "die-cast" && !ui.dieCastBrand) return { results: [], warnings: [], error: "Choose a die-cast brand first." };
  const selected = providersFor(category, tcgGame, ui.figureLine, ui.toyLine, ui.dieCastBrand, providers);
  if (!selected.length) return { results: [], warnings: [], error: null, manualOnly: true };
  const typed = { ...query, category };
  const settled = await Promise.allSettled(selected.map(p => p.search(typed, signal)));
  if (signal.aborted) return { results: [], warnings: [], error: null };
  const collected: Candidate[] = [], warnings: string[] = [], failures: string[] = [];
  settled.forEach((o, i) => {
    const p = selected[i];
    if (o.status === "fulfilled") {
      collected.push(...o.value.candidates);
      if (o.value.warning) warnings.push(`${p.label}: ${o.value.warning}`);
    } else {
      const r = o.reason;
      failures.push(`${p.label}: ${r instanceof ProviderError ? r.message : r instanceof Error ? r.message : "Lookup service unavailable."}`);
    }
  });
  const error = failures.length === selected.length ? failures.join(" ") : null;
  if (failures.length && !error) warnings.push(...failures);
  return { results: rankCandidates(typed, collected), warnings, error };
}
