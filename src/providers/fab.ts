import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asRecord, asString, fetchJson, type Provider } from "./types.ts";

const DATA_URL = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/develop/json/english/card-reference.json";

export const fabProvider: Provider = {
  id:"fab", label:"Flesh and Blood Cards", categories:["tcg"], prefers:(query)=>query.category === "tcg",
  async search(query: SearchQuery, signal) {
    const payload = await fetchJson(DATA_URL, signal);
    const cards = Array.isArray(payload) ? payload : asArray(asRecord(payload)?.cards);
    const needle=query.providerQuery.trim().toLowerCase(); const candidates:Candidate[]=[];
    for(const value of cards){const card=asRecord(value);if(!card)continue;
      const name=asString(card.name);if(!name)continue;
      const id=asString(card.unique_id)??asString(card.id)??name;
      const setCode=asString(card.set_id)??asString(card.set); const cardNumber=asString(card.card_number)??asString(card.identifier);
      const searchable=`${name} ${setCode??""} ${cardNumber??""}`.toLowerCase();if(needle&&!searchable.includes(needle))continue;
      candidates.push({id:`fab:${id}`,provider:"fab",providerLabel:"Flesh and Blood Cards",providerKey:id,title:name,
        subtitle:[setCode,cardNumber].filter(Boolean).join(" • ")||"Flesh and Blood",category:"tcg",year:null,imageUrl:asString(card.image_url)??asString(card.image),
        description:asString(card.functional_text)??asString(card.text),sourceUrl:"https://github.com/the-fab-cube/flesh-and-blood-cards",
        details:[{label:"Game",value:"Flesh and Blood"},...(setCode?[{label:"Set",value:setCode}]:[]),...(cardNumber?[{label:"Card",value:cardNumber}]:[]),{label:"Data source",value:"Flesh and Blood Cards"}],score:0,matchReasons:[]});
      if(candidates.length>=40)break;
    }
    return {candidates,warning:null};
  },
};
