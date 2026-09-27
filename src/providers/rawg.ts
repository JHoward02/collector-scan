import type { Candidate, DetailRow, SearchQuery } from "../types.ts";
import { asArray, asNumber, asRecord, asString, fetchJson, type Provider } from "./types.ts";

const ENDPOINT = "https://api.rawg.io/api/games";

function apiKey(): string | null {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="rawg-api-key"]')?.content?.trim();
  return meta || null;
}
function names(value: unknown): string[] {
  return asArray(value).map(asRecord).map((v)=>asString(v?.name)).filter((v):v is string=>Boolean(v));
}

export const rawgProvider: Provider = {
  id:"rawg", label:"RAWG", categories:["video-game"], prefers:(query)=>query.category==="video-game",
  async search(query:SearchQuery,signal){
    const key=apiKey();
    if(!key) throw new Error("Video game search is awaiting its RAWG API key configuration.");
    const url=new URL(ENDPOINT);url.searchParams.set("key",key);url.searchParams.set("search",query.title||query.providerQuery);url.searchParams.set("page_size","20");url.searchParams.set("search_precise","true");
    const payload=asRecord(await fetchJson(url.href,signal));const candidates:Candidate[]=[];
    for(const value of asArray(payload?.results)){const game=asRecord(value);if(!game)continue;const id=asNumber(game.id),title=asString(game.name);if(id==null||!title)continue;
      const released=asString(game.released),platforms=asArray(game.platforms).map(asRecord).map((p)=>asString(asRecord(p?.platform)?.name)).filter((v):v is string=>Boolean(v));
      const genres=names(game.genres);const stores=asArray(game.stores).map(asRecord).map((s)=>asString(asRecord(s?.store)?.name)).filter((v):v is string=>Boolean(v));
      const year=released?Number.parseInt(released.slice(0,4),10):null;const details:DetailRow[]=[];
      if(platforms.length)details.push({label:"Platforms",value:platforms.slice(0,6).join(", ")});if(released)details.push({label:"Released",value:released});if(genres.length)details.push({label:"Genres",value:genres.join(", ")});if(stores.length)details.push({label:"Stores",value:stores.slice(0,4).join(", ")});details.push({label:"Data source",value:"RAWG"});
      candidates.push({id:`rawg:${id}`,provider:"rawg",providerLabel:"RAWG",providerKey:String(id),title,subtitle:platforms.slice(0,3).join(" • ")||released||null,category:"video-game",year:year&&Number.isFinite(year)?year:null,imageUrl:asString(game.background_image),description:null,sourceUrl:`https://rawg.io/games/${asString(game.slug)??id}`,details,score:0,matchReasons:[]});
    }
    return {candidates,warning:null};
  }
};
