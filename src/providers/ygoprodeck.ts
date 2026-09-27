import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asRecord, asString, fetchJson, type Provider } from "./types.ts";

export const ygoprodeckProvider: Provider = {
  id:"ygoprodeck", label:"YGOPRODeck", categories:["trading-card"], prefers:(query)=>query.category === "trading-card",
  async search(query: SearchQuery, signal) {
    const payload = asRecord(await fetchJson(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query.providerQuery)}`, signal));
    const candidates: Candidate[] = [];
    for (const value of asArray(payload?.data).slice(0,40)) {
      const card=asRecord(value); if(!card) continue; const id=asString(card.id), name=asString(card.name); if(!id||!name) continue;
      const sets=asArray(card.card_sets); const firstSet=asRecord(sets[0]); const setName=asString(firstSet?.set_name), setCode=asString(firstSet?.set_code);
      const image=asRecord(asArray(card.card_images)[0]);
      candidates.push({id:`ygoprodeck:${id}`,provider:"ygoprodeck",providerLabel:"YGOPRODeck",providerKey:id,title:name,
        subtitle:[setName,setCode].filter(Boolean).join(" • ")||"Yu-Gi-Oh!",category:"trading-card",year:null,imageUrl:asString(image?.image_url_small)??asString(image?.image_url),
        description:asString(card.desc),sourceUrl:`https://ygoprodeck.com/card/${id}`,details:[{label:"Game",value:"Yu-Gi-Oh!"},...(setName?[{label:"Set",value:setName}]:[]),...(setCode?[{label:"Set code",value:setCode}]:[]),{label:"Data source",value:"YGOPRODeck"}],score:0,matchReasons:[]});
    }
    return {candidates,warning:null};
  },
};
