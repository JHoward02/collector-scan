import type { Candidate, SearchQuery } from "../types.ts";
import { asRecord, asString, fetchJson, type Provider } from "./types.ts";

const INDEX_URL="https://raw.githubusercontent.com/Kuroro1990/OPTCG/main/english/index/cards_by_id.json";

export const onePieceProvider:Provider={
  id:"onepiece-data",label:"Punk Records One Piece TCG Data",categories:["tcg"],prefers:(query)=>query.category==="tcg",
  async search(query:SearchQuery,signal){const payload=asRecord(await fetchJson(INDEX_URL,signal));const needle=query.providerQuery.trim().toLowerCase();const candidates:Candidate[]=[];
    if(!payload)return{candidates,warning:"One Piece community catalog could not be read."};
    for(const [key,value] of Object.entries(payload)){const card=asRecord(value);if(!card)continue;const name=asString(card.name),cardId=asString(card.card_id)??key;if(!name)continue;
      const searchable=`${name} ${cardId}`.toLowerCase();if(needle&&!searchable.includes(needle))continue;const colors=Array.isArray(card.colors)?card.colors.filter((x):x is string=>typeof x==="string").join(" / "):null;
      const category=asString(card.category),packId=asString(card.pack_id);
      candidates.push({id:`onepiece-data:${cardId}`,provider:"onepiece-data",providerLabel:"Punk Records One Piece TCG Data",providerKey:cardId,title:name,
        subtitle:[cardId,category].filter(Boolean).join(" • ")||"One Piece Card Game",category:"tcg",year:null,imageUrl:null,description:null,
        sourceUrl:"https://github.com/Kuroro1990/OPTCG",details:[{label:"Game",value:"One Piece Card Game"},{label:"Card",value:cardId},...(category?[{label:"Type",value:category}]:[]),...(colors?[{label:"Color",value:colors}]:[]),...(packId?[{label:"Pack ID",value:packId}]:[]),{label:"Data source",value:"Punk Records community dataset"}],score:0,matchReasons:[]});
      if(candidates.length>=40)break;
    }return{candidates,warning:null};
  }
};
