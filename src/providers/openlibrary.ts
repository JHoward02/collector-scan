import type { Candidate, DetailRow, SearchQuery } from "../types.ts";
import { truncate } from "../text.ts";
import { asArray, asNumber, asRecord, asString, fetchJson, type Provider, type ProviderResult } from "./types.ts";

const ENDPOINT = "https://openlibrary.org/search.json";
const FIELDS = ["key","title","subtitle","author_name","first_publish_year","publish_year","publisher","isbn","cover_i","cover_edition_key","edition_key","number_of_pages_median","language","subject","edition_count","first_sentence"].join(",");

function strings(value: unknown): string[] { return asArray(value).map(asString).filter((entry):entry is string=>Boolean(entry)); }
function cleanIsbn(value:string):string{return value.replace(/[^0-9Xx]/g,"").toUpperCase();}
function isbnFromQuery(query:SearchQuery):string|null{const compact=cleanIsbn(query.raw);return compact.length===10||compact.length===13?compact:null;}
function coverUrl(coverId:number|null,isbn:string|null):string|null{if(coverId!=null)return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;return isbn?`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`:null;}
function sanitizeQuery(raw:string):string{return raw.replace(/[#"']/g," ").replace(/\s+/g," ").trim();}

function toCandidate(doc:unknown,requestedIsbn:string|null):Candidate|null{
  const record=asRecord(doc);if(!record)return null;const title=asString(record.title);if(!title)return null;
  const workKey=asString(record.key);const editionKeys=strings(record.edition_key);const coverEditionKey=asString(record.cover_edition_key);
  const authors=strings(record.author_name),publishers=strings(record.publisher),isbns=strings(record.isbn).map(cleanIsbn),languages=strings(record.language);
  const publishYears=asArray(record.publish_year).map(asNumber).filter((v):v is number=>v!=null);const firstYear=asNumber(record.first_publish_year);
  const pages=asNumber(record.number_of_pages_median),editions=asNumber(record.edition_count),coverId=asNumber(record.cover_i),subtitle=asString(record.subtitle),firstSentence=asString(record.first_sentence);
  const matchedIsbn=requestedIsbn&&isbns.includes(requestedIsbn)?requestedIsbn:(isbns.find((v)=>v.length===13)??isbns[0]??null);
  const editionKey=coverEditionKey??editionKeys[0]??null;const selectedYear=publishYears.length?Math.max(...publishYears):firstYear;
  const details:DetailRow[]=[];if(authors.length)details.push({label:"Author",value:authors.slice(0,3).join(", ")});if(publishers.length)details.push({label:"Publisher",value:publishers.slice(0,2).join(", ")});
  if(selectedYear!=null)details.push({label:"Published",value:String(selectedYear)});if(pages!=null)details.push({label:"Pages",value:String(pages)});if(matchedIsbn)details.push({label:"ISBN",value:matchedIsbn});if(editions!=null)details.push({label:"Known editions",value:String(editions)});if(languages.length)details.push({label:"Language",value:languages.slice(0,2).join(", ")});
  return {id:`openlibrary:${editionKey??workKey??title}`,provider:"openlibrary",providerLabel:"Open Library",providerKey:editionKey??workKey??title,title,subtitle:subtitle??(authors.length?authors.slice(0,2).join(", "):null),category:"book",year:selectedYear??null,imageUrl:coverUrl(coverId,matchedIsbn),description:firstSentence?truncate(firstSentence,300):null,sourceUrl:editionKey?`https://openlibrary.org/books/${editionKey}`:workKey?`https://openlibrary.org${workKey}`:null,details,score:0,matchReasons:[]};
}

export const openLibraryProvider:Provider={id:"openlibrary",label:"Open Library",categories:["book"],prefers:(query)=>query.category==="book",async search(query:SearchQuery,signal:AbortSignal):Promise<ProviderResult>{
  const url=new URL(ENDPOINT);const isbn=isbnFromQuery(query);if(isbn)url.searchParams.set("isbn",isbn);else url.searchParams.set("q",sanitizeQuery(query.title||query.providerQuery));url.searchParams.set("limit","20");url.searchParams.set("fields",FIELDS);
  const payload=asRecord(await fetchJson(url.href,signal));const candidates=asArray(payload?.docs).map((doc)=>toCandidate(doc,isbn)).filter((candidate):candidate is Candidate=>candidate!==null);
  return {candidates,warning:null};
}};
