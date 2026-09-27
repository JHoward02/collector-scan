import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asRecord, asString, fetchJson, type Provider } from "./types.ts";

export const scryfallProvider: Provider = {
  id: "scryfall", label: "Scryfall", categories: ["trading-card"],
  prefers: (query) => query.category === "trading-card",
  async search(query: SearchQuery, signal) {
    const payload = asRecord(await fetchJson(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query.providerQuery)}`, signal));
    const candidates: Candidate[] = [];
    for (const value of asArray(payload?.data).slice(0, 40)) {
      const card = asRecord(value); if (!card) continue;
      const id = asString(card.id), name = asString(card.name); if (!id || !name) continue;
      const setName = asString(card.set_name), number = asString(card.collector_number), released = asString(card.released_at);
      const images = asRecord(card.image_uris); const imageUrl = asString(images?.normal) ?? asString(images?.small);
      candidates.push({ id:`scryfall:${id}`, provider:"scryfall", providerLabel:"Scryfall", providerKey:id, title:name,
        subtitle:[setName,number?`#${number}`:null].filter(Boolean).join(" • ") || "Magic: The Gathering", category:"trading-card",
        year:released ? Number.parseInt(released.slice(0,4),10) : null, imageUrl, description:asString(card.oracle_text),
        sourceUrl:asString(card.scryfall_uri), details:[{label:"Game",value:"Magic: The Gathering"},...(setName?[{label:"Set",value:setName}]:[]),...(number?[{label:"Card #",value:number}]:[]),{label:"Data source",value:"Scryfall"}], score:0, matchReasons:[] });
    }
    return { candidates, warning:null };
  },
};
