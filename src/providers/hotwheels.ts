import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asNumber, asRecord, asString, fetchJson, type Provider } from "./types.ts";
import { checkFandomImageLicense } from "./fandom-image-license.ts";

const REPO_API = "https://api.github.com/repos/arthurfelipercosta/hotwheelsapi";
const RAW = "https://raw.githubusercontent.com/arthurfelipercosta/hotwheelsapi/main/python/data/castings/";
const FANDOM_API = "https://hotwheels.fandom.com/api.php";

function slugify(value:string):string{return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function strings(value:unknown):string[]{if(Array.isArray(value))return value.map(asString).filter((v):v is string=>Boolean(v));const r=asRecord(value);return r?Object.values(r).map(asString).filter((v):v is string=>Boolean(v)):[];}
function fileNameFromWikia(url:string):string|null{try{const u=new URL(url);const parts=u.pathname.split("/").filter(Boolean);const images=parts.indexOf("images");if(images<0)return null;const name=decodeURIComponent(parts[parts.length-1]);return name||null;}catch{return null;}}
async function castingFiles(signal:AbortSignal):Promise<string[]>{const payload=asRecord(await fetchJson(`${REPO_API}/git/trees/main?recursive=1`,signal,12000));return asArray(payload?.tree).map(asRecord).filter(Boolean).map((x)=>asString(x?.path)).filter((p):p is string=>Boolean(p&&p.startsWith("python/data/castings/")&&p.endsWith(".json"))).map((p)=>p.slice("python/data/castings/".length));}

export const hotWheelsProvider:Provider={
 id:"hotwheels-fandom",label:"Hot Wheels Wiki / Fandom",categories:["toy"],prefers:(q)=>q.category==="toy",
 async search(query:SearchQuery,signal){
  const raw=(query.title||query.providerQuery||query.raw).replace(/\b(hot\s*wheels|die[- ]?cast)\b/gi,"").trim();
  const needle=slugify(raw); if(!needle)return{candidates:[],warning:"Enter a Hot Wheels casting or model name."};
  const files=await castingFiles(signal);const tokens=needle.split("-").filter(Boolean);
  const matches=files.map((file)=>({file,slug:file.replace(/\.json$/,""),score:0})).map((m)=>({...m,score:(m.slug===needle?100:0)+(m.slug.includes(needle)?50:0)+tokens.filter((t)=>m.slug.includes(t)).length*8})).filter((m)=>m.score>0).sort((a,b)=>b.score-a.score).slice(0,12);
  const candidates:Candidate[]=[];
  for(const match of matches){
   const item=asRecord(await fetchJson(`${RAW}${encodeURIComponent(match.file)}`,signal));if(!item)continue;
   const name=asString(item.name)??match.slug.replace(/-/g," ");const id=asString(item.casting_id)??match.slug;const debut=asNumber(item.debut_year);const manufacturer=asString(item.manufacturer);const designer=asString(item.designer);
   const description=asRecord(item.description);const desc=asString(description?.["en-us"])??asString(description?.en)??null;
   const releaseRefs=strings(item.releases);let imageUrl:string|null=null;let imageLicense:string|null=null;let imageAttribution:string|null=null;
   const directImages=strings(item.images);
   for(const image of directImages.slice(0,3)){const file=fileNameFromWikia(image);if(!file)continue;try{const checked=await checkFandomImageLicense(FANDOM_API,file,signal);if(checked.reusable&&checked.imageUrl){imageUrl=checked.imageUrl;imageLicense=checked.license;imageAttribution=checked.attribution;break;}}catch{/* fail closed */}}
   const sourceUrl=`https://hotwheels.fandom.com/wiki/${encodeURIComponent(name.replace(/ /g,"_"))}`;
   candidates.push({id:`hotwheels:${id}`,provider:"hotwheels-fandom",providerLabel:"Hot Wheels Wiki / Fandom",providerKey:id,title:name,subtitle:[debut?`Debut ${debut}`:null,manufacturer].filter(Boolean).join(" • ")||null,category:"toy",year:debut,imageUrl,description:desc,sourceUrl,details:[...(manufacturer?[{label:"Manufacturer",value:manufacturer}]:[]),...(designer?[{label:"Designer",value:designer}]:[]),...(debut?[{label:"Debut year",value:String(debut)}]:[]),...(releaseRefs.length?[{label:"Catalog releases",value:String(releaseRefs.length)}]:[]),...(imageLicense?[{label:"Image license",value:imageLicense}]:[]),...(imageAttribution?[{label:"Image attribution",value:imageAttribution}]:[]),{label:"Catalog source",value:"Hot Wheels Wiki at Fandom (CC BY-SA 3.0)"}],score:match.score,matchReasons:["Hot Wheels catalog match"]});
  }
  return{candidates,warning:"Hot Wheels metadata is derived from the Hot Wheels Wiki at Fandom under CC BY-SA 3.0. Images are shown only when Shelfie can verify reusable file-level licensing; otherwise artwork is omitted."};
 }
};
