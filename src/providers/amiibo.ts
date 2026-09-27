import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asRecord, asString, fetchJson, type Provider } from "./types.ts";

const API = "https://amiiboapi.org/api/amiibo/";

export const amiiboProvider: Provider = {
  id: "amiiboapi",
  label: "AmiiboAPI",
  categories: ["figure"],
  prefers: (query) => query.category === "figure",
  async search(query: SearchQuery, signal) {
    const term = (query.title || query.providerQuery || query.raw).replace(/\bamiibo\b/gi, "").trim();
    if (!term) return { candidates: [], warning: "Enter an amiibo name to search." };
    const url = new URL(API);
    if (term) url.searchParams.set("name", term);
    const payload = asRecord(await fetchJson(url.href, signal));
    const candidates: Candidate[] = [];
    for (const value of asArray(payload?.amiibo).slice(0, 40)) {
      const item = asRecord(value); if (!item) continue;
      const name = asString(item.name); if (!name) continue;
      const head = asString(item.head) ?? "";
      const tail = asString(item.tail) ?? "";
      const id = `${head}${tail}` || name;
      const series = asString(item.amiiboSeries);
      const gameSeries = asString(item.gameSeries);
      const type = asString(item.type);
      const image = asString(item.image);
      const release = asRecord(item.release);
      const releaseRegion = (["na", "jp", "eu", "au"] as const).find(region => asString(release?.[region]));
      const releaseDate = releaseRegion ? asString(release?.[releaseRegion]) : null;
      const year = releaseDate ? Number.parseInt(releaseDate.slice(0, 4), 10) : null;
      candidates.push({
        id: `amiiboapi:${id}`, provider: "amiiboapi", providerLabel: "AmiiboAPI", providerKey: id,
        title: name, subtitle: [series, type].filter(Boolean).join(" • ") || null,
        category: "figure", year: year && Number.isFinite(year) ? year : null,
        imageUrl: image, description: gameSeries ? `${gameSeries} amiibo` : null,
        sourceUrl: "https://amiiboapi.org/",
        details: [
          ...(series ? [{label:"Amiibo series",value:series}] : []),
          ...(gameSeries ? [{label:"Game series",value:gameSeries}] : []),
          ...(type ? [{label:"Type",value:type}] : []),
          ...(releaseDate ? [{label:`${{na:"North America",jp:"Japan",eu:"Europe",au:"Australia"}[releaseRegion!]} release`,value:releaseDate}] : []),
          {label:"Data source",value:"AmiiboAPI"}
        ], score: 0, matchReasons: []
      });
    }
    return { candidates, warning: null };
  }
};
