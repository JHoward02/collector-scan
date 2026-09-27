import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asRecord, asString, fetchJson, type Provider } from "./types.ts";

const SETS_URL = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json";
const CARDS_BASE = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en";

export const pokemonProvider: Provider = {
  id:"pokemon-data", label:"Pokémon TCG Data", categories:["tcg"], prefers:(query)=>query.category === "tcg",
  async search(query: SearchQuery, signal) {
    const sets=asArray(await fetchJson(SETS_URL,signal)); const needle=query.providerQuery.trim().toLowerCase(); const candidates:Candidate[]=[];
    // The upstream repository is now legacy/historical. Search set files newest-first
    // without touching the retiring API, and clearly identify the source in results.
    for(const setValue of [...sets].reverse()){
      const set=asRecord(setValue); const setId=asString(set?.id),setName=asString(set?.name); if(!setId)continue;
      let cards:unknown[]=[]; try{cards=asArray(await fetchJson(`${CARDS_BASE}/${encodeURIComponent(setId)}.json`,signal,5000));}catch{continue;}
      for(const value of cards){const card=asRecord(value);if(!card)continue;const name=asString(card.name),id=asString(card.id);if(!name||!id)continue;
        const number=asString(card.number);const searchable=`${name} ${number??""} ${setName??""}`.toLowerCase();if(needle&&!searchable.includes(needle))continue;
        const images=asRecord(card.images); candidates.push({id:`pokemon-data:${id}`,provider:"pokemon-data",providerLabel:"Pokémon TCG Data",providerKey:id,title:name,
          subtitle:[setName,number?`#${number}`:null].filter(Boolean).join(" • ")||"Pokémon TCG",category:"tcg",year:null,imageUrl:asString(images?.small)??asString(images?.large),
          description:null,sourceUrl:`https://github.com/PokemonTCG/pokemon-tcg-data`,details:[{label:"Game",value:"Pokémon TCG"},...(setName?[{label:"Set",value:setName}]:[]),...(number?[{label:"Card #",value:number}]:[]),{label:"Data source",value:"Pokémon TCG Data (legacy)"}],score:0,matchReasons:[]});
        if(candidates.length>=40)return{candidates,warning:"Pokémon TCG Data is a legacy/historical catalog, so the newest releases may be missing."};
      }
    }
    return{candidates,warning:"Pokémon TCG Data is a legacy/historical catalog, so the newest releases may be missing."};
  },
};
