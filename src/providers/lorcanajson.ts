import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asRecord, asString, fetchJson, type Provider } from "./types.ts";

const DATA_URL = "https://lorcanajson.org/files/current/en/allCards.json";

export const lorcanaJsonProvider: Provider = {
  id: "lorcanajson", label: "LorcanaJSON", categories: ["tcg"],
  prefers: (query) => query.category === "tcg",
  async search(query: SearchQuery, signal) {
    const payload = asRecord(await fetchJson(DATA_URL, signal));
    const cards = asArray(payload?.cards);
    const needle = query.providerQuery.trim().toLowerCase();
    const candidates: Candidate[] = [];
    for (const value of cards) {
      const card = asRecord(value); if (!card) continue;
      const fullName = asString(card.fullName) ?? asString(card.name); if (!fullName) continue;
      const number = asString(card.number) ?? (typeof card.number === "number" ? String(card.number) : null);
      const identifier = asString(card.fullIdentifier);
      const searchable = `${fullName} ${identifier ?? ""} ${number ?? ""}`.toLowerCase();
      if (needle && !searchable.includes(needle)) continue;
      const id = String(card.id ?? identifier ?? fullName);
      const images = asRecord(card.images);
      const set = asRecord(card.set);
      const setName = asString(set?.name) ?? asString(card.setName);
      const imageUrl = asString(images?.full) ?? asString(images?.thumbnail);
      candidates.push({ id:`lorcanajson:${id}`, provider:"lorcanajson", providerLabel:"LorcanaJSON", providerKey:id, title:fullName,
        subtitle:[setName,identifier ?? (number ? `#${number}` : null)].filter(Boolean).join(" • ") || "Disney Lorcana", category:"tcg", year:null,
        imageUrl, description:asString(card.fullText) ?? asString(card.flavorText), sourceUrl:"https://lorcanajson.org", details:[{label:"Game",value:"Disney Lorcana"},...(setName?[{label:"Set",value:setName}]:[]),...(identifier?[{label:"Card",value:identifier}]:[]),{label:"Data source",value:"LorcanaJSON"}], score:0, matchReasons:[] });
      if (candidates.length >= 40) break;
    }
    return { candidates, warning:null };
  },
};
