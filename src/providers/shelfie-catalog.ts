import { CATEGORIES, type Candidate, type Category, type SearchQuery } from "../types.ts";
import { normalizeText, tokenize } from "../text.ts";
import { fetchJson, type Provider } from "./types.ts";

interface CatalogRecord {
  id: string; title: string; category: Category; year: number | null;
  line: string; maker: string; identifier: string; imageUrl: string | null; sourceUrl: string;
}

const DATA_URL = `${import.meta.env.BASE_URL}community-catalog.json`;
let catalog: CatalogRecord[] | null = null;

function record(value: unknown): value is CatalogRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as CatalogRecord;
  return typeof r.id === "string" && /^issue-\d+$/.test(r.id) && typeof r.title === "string" &&
    CATEGORIES.includes(r.category) && typeof r.sourceUrl === "string" &&
    r.sourceUrl.startsWith("https://github.com/JHoward02/collector-scan/issues/");
}

export const shelfieCatalogProvider: Provider = {
  id: "shelfie-catalog", label: "Shelfie catalog", categories: [...CATEGORIES], prefers: () => true,
  async search(query: SearchQuery, signal: AbortSignal) {
    if (!catalog) {
      try {
        const data = await fetchJson(DATA_URL, signal);
        catalog = Array.isArray(data) ? data.filter(record) : [];
      } catch {
        // The shared catalog is optional when running in Canvas or offline.
        return { candidates: [], warning: null };
      }
    }
    const terms = tokenize(query.title);
    const candidates: Candidate[] = catalog.filter(item => item.category === query.category &&
      terms.length > 0 && terms.every(term => normalizeText(`${item.title} ${item.maker} ${item.line} ${item.identifier}`).includes(term)))
      .slice(0, 40).map(item => ({
        id: `shelfie:${item.id}`, provider: "shelfie-catalog", providerLabel: "Shelfie catalog", providerKey: item.id,
        title: item.title, subtitle: item.maker || item.line || null, category: item.category,
        year: item.year, imageUrl: item.imageUrl, description: null, sourceUrl: item.sourceUrl,
        details: [item.line ? { label: "Line / game", value: item.line } : null,
          item.maker ? { label: "Maker", value: item.maker } : null,
          item.identifier ? { label: "Identifier", value: item.identifier } : null]
          .filter((detail): detail is { label: string; value: string } => detail !== null),
        score: 0, matchReasons: [],
      }));
    return { candidates, warning: null };
  },
};
