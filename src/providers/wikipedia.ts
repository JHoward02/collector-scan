import type { Candidate, Category, DetailRow, SearchQuery } from "../types.ts";
import { truncate } from "../text.ts";
import {
  asNumber,
  asRecord,
  asString,
  fetchJson,
  type Provider,
  type ProviderResult,
} from "./types.ts";

const ENDPOINT = "https://en.wikipedia.org/w/api.php";
const CATEGORIES: Category[] = ["comic", "sports-card", "other"];

const CARD_HINTS = /baseball card|trading card|sports card|topps|panini|rookie card|card set|cardboard/i;
const COMIC_HINTS = /comic book|comics|graphic novel|superhero|issue of|marvel|dc comics/i;
const YEAR_IN_TEXT = /\b(1[89]\d{2}|20\d{2})\b/;

function inferCategory(title: string, extract: string | null): Category {
  const haystack = `${title} ${extract ?? ""}`;
  if (CARD_HINTS.test(haystack)) return "sports-card";
  if (COMIC_HINTS.test(haystack)) return "comic";
  return "other";
}

function inferYear(title: string, extract: string | null): number | null {
  const haystack = `${title} ${extract ?? ""}`;
  const match = haystack.match(YEAR_IN_TEXT);
  return match ? Number.parseInt(match[1], 10) : null;
}

function toCandidate(page: unknown): Candidate | null {
  const record = asRecord(page);
  if (!record) return null;
  const title = asString(record.title);
  if (!title) return null;
  // Namespace-0 pages only; disambiguation pages carry no collection value.
  const extract = asString(record.extract);
  if (extract && /may refer to:/i.test(extract)) return null;

  const pageId = asNumber(record.pageid);
  const thumbnail = asRecord(record.thumbnail);
  const imageUrl = asString(thumbnail?.source);
  const sourceUrl = asString(record.fullurl) ?? (pageId == null ? null : `https://en.wikipedia.org/?curid=${pageId}`);
  const category = inferCategory(title, extract);
  const year = inferYear(title, extract);

  const details: DetailRow[] = [{ label: "Source", value: "Wikipedia" }];
  if (pageId != null) details.push({ label: "Page ID", value: String(pageId) });
  if (year != null) details.push({ label: "Referenced year", value: String(year) });

  return {
    id: `wikipedia:${pageId ?? title}`,
    provider: "wikipedia",
    providerLabel: "Wikipedia",
    providerKey: pageId == null ? title : String(pageId),
    title,
    subtitle: extract ? truncate(extract, 120) : null,
    category,
    year,
    imageUrl,
    description: extract ? truncate(extract, 400) : null,
    sourceUrl,
    details,
    score: 0,
    matchReasons: [],
  };
}

export const wikipediaProvider: Provider = {
  id: "wikipedia",
  label: "Wikipedia",
  categories: CATEGORIES,
  prefers: (query: SearchQuery) => query.category === "comic" || query.category === "sports-card",
  async search(query: SearchQuery, signal: AbortSignal): Promise<ProviderResult> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query.providerQuery);
    url.searchParams.set("gsrlimit", "10");
    url.searchParams.set("gsrnamespace", "0");
    url.searchParams.set("prop", "pageimages|extracts|info");
    url.searchParams.set("exintro", "1");
    url.searchParams.set("explaintext", "1");
    url.searchParams.set("exsentences", "3");
    url.searchParams.set("piprop", "thumbnail");
    url.searchParams.set("pithumbsize", "480");
    // Comic and trading-card covers are almost always non-free files, which
    // pageimages skips unless asked; without this every comic row is imageless.
    url.searchParams.set("pilicense", "any");
    url.searchParams.set("inprop", "url");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("formatversion", "2");

    const payload = asRecord(await fetchJson(url.href, signal));
    const queryBlock = asRecord(payload?.query);
    const pages = Array.isArray(queryBlock?.pages) ? queryBlock.pages : [];
    const candidates = pages
      .map(toCandidate)
      .filter((candidate): candidate is Candidate => candidate !== null);

    return {
      candidates,
      warning: candidates.length === 0 ? "Wikipedia returned no matching articles." : null,
    };
  },
};
