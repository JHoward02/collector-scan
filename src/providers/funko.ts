import type { Candidate, SearchQuery } from "../types.ts";
import { normalizeText } from "../text.ts";
import { asArray, asRecord, asString, fetchJson, type Provider } from "./types.ts";

const DATA_URL="https://raw.githubusercontent.com/kennymkchan/funko-pop-data/master/funko_pop.json";
const SOURCE_URL="https://github.com/kennymkchan/funko-pop-data";
let cache:unknown[]|null=null;

export const funkoProvider:Provider={
 id:"funko-data",label:"Funko Pop Data",categories:["figure"],prefers:(q)=>q.category==="figure",
 async search(query:SearchQuery,signal){
  if(!cache){const payload=await fetchJson(DATA_URL,signal);cache=asArray(payload);}
  const needle=normalizeText(query.raw.replace(/funko|pop!?/gi," "));
  const terms=needle.split(/\s+/).filter(Boolean);
  const matches=(cache??[]).map((value)=>asRecord(value)).filter((r):r is Record<string,unknown>=>Boolean(r)).filter((r)=>{
   const title=normalizeText(asString(r.title)??"");const series=asArray(r.series).map(asString).filter(Boolean).join(" ");const hay=normalizeText(`${title} ${series}`);
   return terms.length>0&&terms.every((term)=>hay.includes(term));
  }).slice(0,40);
  const candidates:Candidate[]=matches.map((r,index)=>{
   const title=asString(r.title)??"Funko Pop";const handle=asString(r.handle)??`${title}-${index}`;const series=asArray(r.series).map(asString).filter((v):v is string=>Boolean(v));const image=asString(r.image);
   return{id:`funko:${handle}`,provider:"funko-data",providerLabel:"Funko Pop Data",providerKey:handle,title,subtitle:series.slice(0,3).join(" • ")||"Funko Pop",category:"figure",year:null,imageUrl:image,description:null,sourceUrl:SOURCE_URL,details:[...(series.length?[{label:"Series",value:series.join(", ")}]:[]),{label:"Data source",value:"Funko Pop Data (MIT)"}],score:0,matchReasons:[]};
  });
  return{candidates,warning:candidates.length?"Funko Pop Data was last updated January 3, 2021, so newer releases may require the fallback search or manual entry.":"No match in the open Funko catalog. Try a broader name or add the item manually."};
 }
};
