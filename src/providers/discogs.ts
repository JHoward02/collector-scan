import type { Candidate, SearchQuery } from "../types.ts";
import { asArray, asNumber, asRecord, asString, fetchJson, type Provider } from "./types.ts";

const WORKER = "https://shelfie-api.jason-howard02.workers.dev/discogs/search";

function splitTitle(value: string): { artist: string | null; release: string } {
  const parts = value.split(" - ");
  if (parts.length < 2) return { artist: null, release: value };
  const artist = parts.shift()?.trim() || null;
  return { artist, release: parts.join(" - ").trim() };
}

export const discogsProvider: Provider = {
  id: "discogs",
  label: "Discogs",
  categories: ["vinyl"],
  prefers: (query) => query.category === "vinyl",
  async search(query: SearchQuery, signal) {
    const term = (query.providerQuery || query.title || query.raw).trim();
    if (!term) return { candidates: [], warning: "Enter an artist, album, catalog number, or barcode." };

    const payload = asRecord(await fetchJson(`${WORKER}?q=${encodeURIComponent(term)}`, signal));
    const candidates: Candidate[] = asArray(payload?.results).map(asRecord).filter(Boolean).map((row) => {
      const id = asString(row?.id) ?? "unknown";
      const rawTitle = asString(row?.title) ?? "Untitled release";
      const parsed = splitTitle(rawTitle);
      const year = asNumber(row?.year);
      const labels = asArray(row?.label).map(asString).filter((v): v is string => Boolean(v));
      const catalogNumbers = asArray(row?.catno).map(asString).filter((v): v is string => Boolean(v));
      const formats = asArray(row?.format).map(asString).filter((v): v is string => Boolean(v));
      const country = asString(row?.country);
      const uri = asString(row?.uri);
      const sourceUrl = uri ? `https://www.discogs.com${uri}` : `https://www.discogs.com/release/${id}`;

      return {
        id: `discogs:${id}`,
        provider: "discogs",
        providerLabel: "Discogs",
        providerKey: id,
        title: parsed.release,
        subtitle: [parsed.artist, year ? String(year) : null].filter(Boolean).join(" • ") || null,
        category: "vinyl",
        year,
        imageUrl: null,
        description: null,
        sourceUrl,
        details: [
          ...(parsed.artist ? [{ label: "Artist", value: parsed.artist }] : []),
          ...(labels.length ? [{ label: "Label", value: labels.join(", ") }] : []),
          ...(catalogNumbers.length ? [{ label: "Catalog #", value: catalogNumbers.join(", ") }] : []),
          ...(formats.length ? [{ label: "Format", value: formats.join(", ") }] : []),
          ...(country ? [{ label: "Country", value: country }] : []),
          { label: "Data", value: "Data provided by Discogs" },
        ],
        score: 70,
        matchReasons: ["Discogs vinyl release match"],
      };
    });

    return {
      candidates,
      warning: "Data provided by Discogs. Shelfie uses Discogs catalog metadata for identification and links results back to Discogs. Discogs images and marketplace data are not stored or displayed.",
    };
  },
};
