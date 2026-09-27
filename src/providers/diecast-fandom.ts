import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asRecord, asString, fetchJson, type Provider } from "./types.ts";
import { checkFandomImageLicense } from "../fandom-image-license.ts";

type Config={id:Candidate["provider"];label:string;host:string;brand:string;license:string};

export function createDieCastFandomProvider(config:Config):Provider{
 const api=`https://${config.host}/api.php`;
 return {id:config.id,label:config.label,categories:["toy"],prefers:q=>q.category==="toy",async search(query:SearchQuery,signal){
  const raw=(query.title||query.providerQuery||query.raw).replace(new RegExp(config.brand.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"ig"),"").replace(/die[- ]?cast/ig,"").trim();
  if(!raw)return{candidates:[],warning:`Enter a ${config.brand} model, release number, or vehicle name.`};
  const params=new URLSearchParams({action:"query",format:"json",origin:"*",generator:"search",gsrsearch:raw,gsrnamespace:"0",gsrlimit:"12",prop:"extracts|pageimages|info",exintro:"1",explaintext:"1",inprop:"url",piprop:"original|thumbnail",pithumbsize:"500"});
  const payload=asRecord(await fetchJson(`${api}?${params}`,signal));const pages=asRecord(asRecord(payload?.query)?.pages);const candidates:Candidate[]=[];
  for(const page of Object.values(pages??{}).map(asRecord).filter(Boolean)){
   const title=asString(page?.title);if(!title)continue;const pageid=asString(page?.pageid)??title;const extract=asString(page?.extract);const sourceUrl=asString(page?.fullurl)??`https://${config.host}/wiki/${encodeURIComponent(title.replace(/ /g,"_"))}`;
   const original=asRecord(page?.original);const thumb=asRecord(page?.thumbnail);const candidateImage=asString(original?.source)??asString(thumb?.source);let imageUrl:string|null=null;let license:string|null=null;let attribution:string|null=null;
   if(candidateImage){try{const infoParams=new URLSearchParams({action:"query",format:"json",origin:"*",prop:"images",titles:title,imlimit:"10"});const imagePayload=asRecord(await fetchJson(`${api}?${infoParams}`,signal));const imagePages=asRecord(asRecord(imagePayload?.query)?.pages);const images=Object.values(imagePages??{}).map(asRecord).filter(Boolean).flatMap(p=>asArray(p?.images)).map(asRecord).filter(Boolean).map(x=>asString(x?.title)).filter((x):x is string=>Boolean(x));for(const file of images.slice(0,6)){try{const checked=await checkFandomImageLicense(api,file,signal);if(checked.reusable&&checked.imageUrl){imageUrl=checked.imageUrl;license=checked.license;attribution=checked.attribution;break;}}catch{/* fail closed */}}}catch{/* metadata still usable */}}
   candidates.push({id:`${config.id}:${pageid}`,provider:config.id,providerLabel:config.label,providerKey:pageid,title,subtitle:config.brand,category:"toy",year:null,imageUrl,description:extract,sourceUrl,details:[{label:"Brand",value:config.brand},{label:"Catalog source",value:`${config.label} (${config.license})`},...(license?[{label:"Image license",value:license}]:[]),...(attribution?[{label:"Image attribution",value:attribution}]:[])],score:60,matchReasons:[`${config.brand} catalog match`]});
  }
  return{candidates,warning:`${config.brand} metadata comes from ${config.label} under ${config.license}. Images appear only when file-level reuse rights can be verified.`};
 }};
}

export const miniGtProvider=createDieCastFandomProvider({id:"minigt-fandom",label:"MINI GT Wiki / Fandom",host:"minigt.fandom.com",brand:"MINI GT",license:"CC BY-SA"});
export const m2Provider=createDieCastFandomProvider({id:"m2-fandom",label:"M2 Machines Wiki / Fandom",host:"m2machines.fandom.com",brand:"M2 Machines",license:"CC BY-SA"});
export const tomicaProvider=createDieCastFandomProvider({id:"tomica-fandom",label:"Tomica Wiki / Fandom",host:"tomica.fandom.com",brand:"Tomica",license:"CC BY-SA"});
export const tarmacProvider=createDieCastFandomProvider({id:"tarmac-fandom",label:"Tarmac Works Wiki / Fandom",host:"tarmacworks.fandom.com",brand:"Tarmac Works",license:"CC BY-SA"});
